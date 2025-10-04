import * as monaco from 'monaco-editor';
import { LocalModuleResolver } from '../lsp/LocalModuleResolver.js';

/**
 * LSPProviderManager - Registers Monaco language providers for LSP features
 */
export class LSPProviderManager {
    constructor(context) {
        this.context = context;
        this.localModuleResolver = new LocalModuleResolver(context);
    }

    /**
     * Register all LSP providers for Monaco Editor
     */
    registerAllProviders() {
        this.registerDefinitionProvider();
        this.registerHoverProvider();
        this.registerReferenceProvider();
    }

    /**
     * Helper to determine which editor a model belongs to
     */
    getEditorSide(model) {
        if (this.context.rightEditor && this.context.rightEditor.getModel() === model) {
            return 'right';
        }
        return 'left';
    }

    /**
     * Check if definition exists (for Ctrl+hover link detection)
     * Returns true if definition can be found, false otherwise
     */
    async checkDefinition(model, position, editorSide) {
        try {
            const word = model.getWordAtPosition(position);
            if (!word) {
                return null;
            }

            // Try LSP first
            const definition = await this.context.lspManager.getDefinition(
                model,
                position,
                editorSide
            );
            if (definition && definition.filePath) {
                return definition;
            }

            // Try local module resolver
            const activeFile =
                editorSide === 'right' ? this.context.rightActiveFile : this.context.activeFile;

            // Check import line
            let localResult = await this.localModuleResolver.resolveLocalImport(
                model,
                position,
                activeFile
            );

            if (localResult) {
                return localResult;
            }

            // Check symbol in imports
            localResult = await this.localModuleResolver.findSymbolSource(
                model,
                word.word,
                activeFile
            );
            if (localResult) {
                return localResult;
            }

            return null;
        } catch (error) {
            console.error('checkDefinition error:', error);
            return null;
        }
    }

    /**
     * Register Definition Provider for Go to Definition (Ctrl+Click)
     * Note: This is only for Monaco's internal features like peek definition
     * Actual Ctrl+Click is handled manually in handleCtrlClick()
     */
    registerDefinitionProvider() {
        monaco.languages.registerDefinitionProvider('python', {
            provideDefinition: async (_model, _position) => {
                // Disable Monaco's internal definition provider
                // We handle Ctrl+Click manually via onMouseDown events
                // This prevents "Model not found" errors
                return null;
            },
        });
    }

    /**
     * Handle Ctrl+Click manually - this ensures we control when files are opened
     */
    async handleCtrlClick(model, position, editorSide) {
        try {
            let definition = await this.context.lspManager.getDefinition(
                model,
                position,
                editorSide
            );

            // If LSP didn't find definition, try local module resolver
            if (!definition || !definition.filePath) {
                const activeFile =
                    editorSide === 'right' ? this.context.rightActiveFile : this.context.activeFile;

                // First try: Check if we're on an import line
                let localResult = await this.localModuleResolver.resolveLocalImport(
                    model,
                    position,
                    activeFile
                );

                // Second try: If not an import line, get the symbol and search imports
                if (!localResult) {
                    const word = model.getWordAtPosition(position);
                    if (word) {
                        localResult = await this.localModuleResolver.findSymbolSource(
                            model,
                            word.word,
                            activeFile
                        );
                    }
                }

                if (localResult) {
                    // Found a local module - convert to definition format
                    let lineNumber = 1;
                    let column = 1;

                    if (localResult.symbol) {
                        const symbolPos = await this.localModuleResolver.findSymbolInFile(
                            localResult.filePath,
                            localResult.symbol
                        );
                        lineNumber = symbolPos.lineNumber;
                        column = symbolPos.column;
                    }

                    definition = {
                        filePath: localResult.filePath,
                        range: {
                            startLineNumber: lineNumber,
                            startColumn: column,
                            endLineNumber: lineNumber,
                            endColumn: column + (localResult.symbol?.length || 0),
                        },
                    };
                }
            }

            if (!definition || !definition.filePath) {
                // Reset Ctrl state
                this.context.ctrlPressed = false;
                this.context.updateCursorStyle();
                this.context.clearLinkDecorations(editorSide);
                return;
            }

            // Check if clicking on the definition itself (same file and near same position)
            const activeFile =
                editorSide === 'right' ? this.context.rightActiveFile : this.context.activeFile;

            const isSameFile = definition.filePath === activeFile;
            const isNearPosition =
                isSameFile &&
                definition.range &&
                Math.abs(definition.range.startLineNumber - position.lineNumber) <= 2;

            // If clicking on definition, show references instead
            if (isNearPosition) {
                if (this.context.referencesProvider) {
                    await this.context.referencesProvider.showReferences(
                        model,
                        position,
                        editorSide
                    );
                }
                // Reset Ctrl state
                this.context.ctrlPressed = false;
                this.context.updateCursorStyle();
                this.context.clearLinkDecorations(editorSide);
                return;
            }

            // Open the file in the appropriate editor
            const targetEditor = this.context.splitViewActive ? editorSide : 'left';
            await this.context.fileLoader.openFile(definition.filePath, targetEditor);

            // Wait for file to load
            await new Promise((resolve) => setTimeout(resolve, 200));

            // Navigate to position
            const editor =
                targetEditor === 'right' ? this.context.rightEditor : this.context.editor;
            if (editor && definition.range) {
                editor.setSelection(definition.range);
                editor.revealRangeInCenter(definition.range);
                editor.focus();
            }
        } catch (error) {
            console.error('Ctrl+Click failed:', error);
            // Reset Ctrl state on error
            this.context.ctrlPressed = false;
            this.context.updateCursorStyle();
            this.context.clearLinkDecorations(editorSide);
        }
    }

    /**
     * Check if a file is already open in any editor
     */
    isFileOpen(filePath) {
        // Check left editor tabs
        if (this.context.openTabs.has(filePath)) {
            return true;
        }
        // Check right editor tabs
        if (this.context.rightOpenTabs && this.context.rightOpenTabs.has(filePath)) {
            return true;
        }
        return false;
    }

    /**
     * Register Hover Provider for showing documentation on hover
     */
    registerHoverProvider() {
        monaco.languages.registerHoverProvider('python', {
            provideHover: async (model, position) => {
                try {
                    // Determine which editor the model belongs to
                    const editorSide = this.getEditorSide(model);
                    const hoverInfo = await this.context.lspManager.getHover(
                        model,
                        position,
                        editorSide
                    );

                    if (!hoverInfo || !hoverInfo.contents) {
                        return null;
                    }

                    return hoverInfo;
                } catch (error) {
                    console.error('Hover provider error:', error);
                    return null;
                }
            },
        });
    }

    /**
     * Register Reference Provider for Find All References
     */
    registerReferenceProvider() {
        monaco.languages.registerReferenceProvider('python', {
            provideReferences: async (model, position, context) => {
                try {
                    const filePath = this.context.activeFile;
                    if (!filePath || !this.context.lspClientInstance?.isConnected()) {
                        return null;
                    }

                    const content = model.getValue();
                    const response = await this.context.lspClientInstance.getReferences(
                        filePath,
                        content,
                        position,
                        context.includeDeclaration
                    );

                    if (!response || response.length === 0) {
                        return null;
                    }

                    // Convert LSP locations to Monaco locations
                    return response.map((ref) => {
                        const uri = monaco.Uri.file(
                            ref.uri.replace('file://', '').replace('/app/workspace/', '')
                        );
                        return {
                            uri: uri,
                            range: {
                                startLineNumber: ref.range.start.line + 1,
                                startColumn: ref.range.start.character + 1,
                                endLineNumber: ref.range.end.line + 1,
                                endColumn: ref.range.end.character + 1,
                            },
                        };
                    });
                } catch (error) {
                    console.error('References provider error:', error);
                    return null;
                }
            },
        });
    }
}
