/**
 * LSPManager.js
 * Manages Language Server Protocol interactions
 */
import * as monaco from 'monaco-editor';

export class LSPManager {
    constructor(context) {
        this.context = context;
    }

    /**
     * Get completion items at position
     */
    async getCompletionItems(model, position) {
        const filePath = this.context.activeFile;
        if (!filePath || !this.context.lspClientInstance?.isConnected()) {
            return this.context.getBasicCompletions();
        }

        const content = model.getValue();

        try {
            const response = await Promise.race([
                this.context.lspClientInstance.getCompletionItems(filePath, content, position),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('LSP timeout')), 2000)
                ),
            ]);

            if (!response || !response.items || response.items.length === 0) {
                return this.context.getBasicCompletions();
            }

            const suggestions = response.items.map((item) => ({
                label: item.label,
                kind: this.mapCompletionItemKind(item.kind),
                insertText: item.insertText || item.label,
                insertTextRules:
                    item.insertTextFormat === 2
                        ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
                        : undefined,
                documentation: item.documentation?.value || item.detail || '',
                detail: item.detail || '',
            }));

            return { suggestions };
        } catch (error) {
            console.warn('LSP completion failed, using fallback:', error);
            return this.context.getBasicCompletions();
        }
    }

    /**
     * Get definition at position
     */
    async getDefinition(model, position, editorSide = 'left') {
        const activeFile =
            editorSide === 'right' ? this.context.rightActiveFile : this.context.activeFile;

        if (!activeFile || !this.context.lspClientInstance?.isConnected()) {
            return null;
        }

        const content = model.getValue();

        await this.context.ensureDocumentSynchronized(activeFile, content);

        try {
            // LSPClient.getDefinition() already returns processed {filePath, range} object
            const result = await this.context.lspClientInstance.getDefinition(
                activeFile,
                content,
                position
            );

            if (!result) {
                return null;
            }

            return result;
        } catch (error) {
            console.error('Failed to get definition:', error);
            return null;
        }
    }

    /**
     * Get hover information at position
     */
    async getHover(model, position, editorSide = 'left') {
        // Get the correct activeFile based on which editor is being used
        const filePath =
            editorSide === 'right' ? this.context.rightActiveFile : this.context.activeFile;

        // If no activeFile, try to extract from model URI
        if (!filePath && model && model.uri) {
            const modelUri = model.uri.toString();
            if (modelUri.startsWith('stdlib://') || modelUri.startsWith('file://')) {
                // Don't request hover for stdlib files or untracked files
                return null;
            }
        }

        if (!filePath || !this.context.lspClientInstance?.isConnected()) {
            return null;
        }

        // Check if file is a stdlib file
        if (this.context.isStdlibFile && this.context.isStdlibFile(filePath)) {
            return null;
        }

        const content = model.getValue();

        // Ensure document is synchronized with LSP before requesting hover
        await this.ensureDocumentSynchronized(filePath, content);

        try {
            const response = await this.context.lspClientInstance.getHover(
                filePath,
                content,
                position
            );

            if (!response || !response.contents) {
                return null;
            }

            let hoverContent = '';
            if (typeof response.contents === 'string') {
                hoverContent = response.contents;
            } else if (response.contents.value) {
                hoverContent = response.contents.value;
            } else if (Array.isArray(response.contents)) {
                hoverContent = response.contents
                    .map((c) => (typeof c === 'string' ? c : c.value))
                    .join('\n');
            }

            return {
                contents: [{ value: hoverContent }],
            };
        } catch (error) {
            console.error('Failed to get hover:', error);
            return null;
        }
    }

    /**
     * Handle Ctrl+Click for go-to-definition
     */
    async handleCtrlClick(position, editorSide = 'left') {
        const editor = editorSide === 'right' ? this.context.rightEditor : this.context.editor;
        const model = editor.getModel();
        if (!model) return;

        try {
            const definition = await this.getDefinition(model, position, editorSide);
            if (definition && definition.filePath) {
                const filePath = definition.filePath;
                const range = definition.range;

                // Monaco expects position format: { lineNumber, column }
                const monacoPosition = {
                    lineNumber: range.startLineNumber,
                    column: range.startColumn,
                };

                if (this.context.splitViewActive && editorSide === 'right') {
                    if (!this.context.rightOpenTabs.has(filePath)) {
                        await this.context.openFileInSplit(filePath);
                    } else if (this.context.rightTabManager) {
                        this.context.rightTabManager.switchTab(filePath);
                    }
                    this.context.rightEditor.setPosition(monacoPosition);
                    this.context.rightEditor.revealPositionInCenter(monacoPosition);
                } else {
                    if (!this.context.openTabs.has(filePath)) {
                        await this.context.openFile(filePath);
                    } else {
                        this.context.tabManager.switchTab(filePath);
                    }
                    this.context.editor.setPosition(monacoPosition);
                    this.context.editor.revealPositionInCenter(monacoPosition);
                }
            }
        } catch (error) {
            console.error('Ctrl+Click navigation error:', error);
        }
    }

    /**
     * Map LSP completion item kind to Monaco kind
     */
    mapCompletionItemKind(kind) {
        const kindMap = {
            1: monaco.languages.CompletionItemKind.Text,
            2: monaco.languages.CompletionItemKind.Method,
            3: monaco.languages.CompletionItemKind.Function,
            4: monaco.languages.CompletionItemKind.Constructor,
            5: monaco.languages.CompletionItemKind.Field,
            6: monaco.languages.CompletionItemKind.Variable,
            7: monaco.languages.CompletionItemKind.Class,
            8: monaco.languages.CompletionItemKind.Interface,
            9: monaco.languages.CompletionItemKind.Module,
            10: monaco.languages.CompletionItemKind.Property,
            11: monaco.languages.CompletionItemKind.Unit,
            12: monaco.languages.CompletionItemKind.Value,
            13: monaco.languages.CompletionItemKind.Enum,
            14: monaco.languages.CompletionItemKind.Keyword,
            15: monaco.languages.CompletionItemKind.Snippet,
        };
        return kindMap[kind] || monaco.languages.CompletionItemKind.Text;
    }

    /**
     * Ensure document is synchronized with LSP server
     * For stdlib files, skip didChange as LSP already knows them and they're read-only
     */
    async ensureDocumentSynchronized(filePath, content) {
        // Skip didChange for stdlib files - LSP already knows them
        if (
            filePath.startsWith('/usr/local/lib/python3.11/') ||
            filePath.startsWith('/usr/lib/python')
        ) {
            return;
        }

        // Workspace file - send didChange
        const fileUri = `file:///app/workspace/${filePath}`;
        this.context.sendLSPRequest({
            jsonrpc: '2.0',
            method: 'textDocument/didChange',
            params: {
                textDocument: {
                    uri: fileUri,
                    version: Date.now(),
                },
                contentChanges: [
                    {
                        text: content,
                    },
                ],
            },
        });

        // Give LSP time to process the change
        await new Promise((resolve) => setTimeout(resolve, 100));
    }

    /**
     * Handle go-to-definition for imports
     */
    async handleGoToDefinition(position) {
        // Basic go-to-definition for imports
        const model = this.context.editor.getModel();
        if (!model) return;

        const word = model.getWordAtPosition(position);
        if (!word) return;

        const line = model.getLineContent(position.lineNumber);

        // Check if it's an import statement
        const importMatch = line.match(/^\s*(?:from\s+([\w.]+)\s+)?import\s+([\w,\s]+)/);
        if (importMatch) {
            const module = importMatch[1] || importMatch[2].split(',')[0].trim();
            const pythonFile = `${module.replace('.', '/')}.py`;

            // Try to open the file if it exists in workspace
            try {
                await this.context.openFile(pythonFile);
            } catch (error) {
                // Module file not found in workspace
            }
        }
    }

    /**
     * Notify LSP that a document was opened
     */
    notifyDocumentOpened(filepath, content) {
        // Don't notify LSP about stdlib files - they are read-only
        if (this.context.isStdlibFile(filepath)) {
            return;
        }

        // Delegate to LSPClient
        if (this.context.lspClientInstance) {
            this.context.lspClientInstance.notifyDidOpen(filepath, content);
        }
    }

    /**
     * Notify LSP that a document was changed
     */
    notifyDocumentChanged(filepath, content) {
        // Don't notify LSP about stdlib files - they are read-only
        if (this.context.isStdlibFile(filepath)) {
            return;
        }

        // Delegate to LSPClient
        if (this.context.lspClientInstance) {
            this.context.lspClientInstance.notifyDidChange(filepath, content);
        }
    }

    /**
     * Notify LSP that a document was closed
     */
    notifyDocumentClosed(filepath) {
        // Don't notify LSP about stdlib files - they are read-only
        if (this.context.isStdlibFile(filepath)) {
            return;
        }

        // Delegate to LSPClient
        if (this.context.lspClientInstance) {
            this.context.lspClientInstance.notifyDidClose(filepath);
        }
    }
}
