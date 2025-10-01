import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';

// Configure Monaco Editor environment
self.MonacoEnvironment = {
    getWorker() {
        return new editorWorker();
    }
};

class PythonIDE {
    constructor() {
        this.editor = null;
        this.openTabs = new Map();
        this.activeFile = null;
        this.fileExplorer = document.getElementById('fileExplorer');
        this.tabBar = document.getElementById('tabBar');
        this.filePathBar = document.getElementById('filePathBar');
        this.executeButton = document.getElementById('executeButton');
        this.outputPanel = document.getElementById('outputPanel');
        this.languageClient = null;
        this.snippets = {};
        this.ctrlPressed = false;
        this.currentLinkDecorations = [];
        this.rightCurrentLinkDecorations = []; // For right editor
        this.selectedDirectory = ''; // Currently selected directory for context menu operations
        this.contextMenuTarget = null; // Target element for context menu

        // Parse workspace folder from URL
        const urlParams = new URLSearchParams(window.location.search);
        this.workspaceFolder = urlParams.get('folder') || '';

        // Split view state
        this.splitViewActive = false;
        this.rightEditor = null;
        this.rightOpenTabs = new Map();
        this.rightActiveFile = null;
        this.focusedEditor = 'left'; // 'left' or 'right' - tracks which editor has focus
        this.syncInProgress = false; // Prevents infinite sync loops
        this.modelChangeListeners = new Map(); // Stores change listeners for cleanup

        this.initializeEditor();
        this.initializeLanguageServer();
        this.loadSnippets();
        this.loadFileExplorer();
        this.setupEventListeners();
        this.initializeSidebarResize();
    }

    // Helper method to add workspace folder to requests
    getFetchHeaders() {
        const headers = { 'Content-Type': 'application/json' };
        if (this.workspaceFolder && this.workspaceFolder.trim() !== '') {
            headers['x-workspace-folder'] = this.workspaceFolder;
        }
        return headers;
    }

    buildUrl(path, params = {}) {
        const url = new URL(path, window.location.origin);
        if (this.workspaceFolder && this.workspaceFolder.trim() !== '') {
            url.searchParams.set('folder', this.workspaceFolder);
        }
        Object.entries(params).forEach(([key, value]) => {
            url.searchParams.set(key, value);
        });
        return url.toString();
    }

    async initializeEditor() {
        // Configure Monaco Editor
        monaco.languages.typescript.javascriptDefaults.setEagerModelSync(true);

        // Python language configuration
        monaco.languages.register({ id: 'python' });

        this.editor = monaco.editor.create(document.getElementById('editor'), {
            value: '# Welcome to Python IDE\\n# Create or open a Python file to get started\\n',
            language: 'python',
            theme: 'vs-dark',
            fontSize: 14,
            lineNumbers: 'on',
            minimap: { enabled: false },
            automaticLayout: true,
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            folding: true,
            foldingStrategy: 'indentation',
            showFoldingControls: 'always',
            tabSize: 4,
            insertSpaces: true,
            autoIndent: 'full',
            formatOnPaste: true,
            formatOnType: true,
            bracketPairColorization: {
                enabled: true
            },
            guides: {
                indentation: true
            },
            // Disable Monaco's built-in go-to-definition
            gotoLocation: {
                multiple: 'goto'
            }
        });

        // Add Ctrl+Click for go-to-definition
        this.editor.onMouseDown((e) => {
            if (e.event.ctrlKey || e.event.metaKey) {
                e.event.preventDefault();
                e.event.stopPropagation();
                this.handleCtrlClick(e.target.position);
            }
        });

        // Add Ctrl+hover link styling
        this.editor.onMouseMove((e) => {
            this.handleMouseMove(e);
        });

        // Clear link decorations when mouse leaves editor
        this.editor.onMouseLeave(() => {
            this.clearLinkDecorations();
        });

        // Monaco Editor keyboard events (support Mac Cmd key)
        this.editor.onKeyDown((e) => {
            const isModifierPressed = this.isMac ? e.metaKey : e.ctrlKey;
            if (isModifierPressed || e.ctrlKey || e.metaKey) {
                this.ctrlPressed = true;
                this.updateCursorStyle();
            }
        });

        this.editor.onKeyUp((e) => {
            const isModifierPressed = this.isMac ? e.metaKey : e.ctrlKey;
            if (!isModifierPressed && !e.ctrlKey && !e.metaKey) {
                this.ctrlPressed = false;
                this.updateCursorStyle();
                this.clearLinkDecorations();
            }
        });

        // Track key states (support both Ctrl and Cmd)
        this.ctrlPressed = false;
        this.isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

        document.addEventListener('keydown', (e) => {
            const isModifierPressed = this.isMac ? e.metaKey : e.ctrlKey;
            if (isModifierPressed || e.ctrlKey || e.metaKey) {
                this.ctrlPressed = true;
                this.updateCursorStyle();
            }
        });

        document.addEventListener('keyup', (e) => {
            const isModifierPressed = this.isMac ? e.metaKey : e.ctrlKey;
            if (!isModifierPressed && !e.ctrlKey && !e.metaKey) {
                this.ctrlPressed = false;
                this.updateCursorStyle();
                this.clearLinkDecorations();
            }
        });

        // Auto-save on change
        this.editor.onDidChangeModelContent(() => {
            if (this.activeFile) {
                this.saveFile(this.activeFile);
                // Notify language server of changes
                const content = this.editor.getValue();
                this.notifyDocumentChanged(this.activeFile, content);
            }
        });

        // Setup code completion
        this.setupCodeCompletion();
    }

    setupCodeCompletion() {
        monaco.languages.registerCompletionItemProvider('python', {
            provideCompletionItems: (model, position) => {
                const suggestions = [];

                // Add snippet suggestions
                Object.entries(this.snippets).forEach(([key, snippet]) => {
                    suggestions.push({
                        label: snippet.prefix,
                        kind: monaco.languages.CompletionItemKind.Snippet,
                        insertText: snippet.body.join('\n'),
                        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                        documentation: snippet.description,
                        detail: 'Python Snippet'
                    });
                });

                // Add basic Python keywords
                const keywords = [
                    'def', 'class', 'if', 'elif', 'else', 'for', 'while',
                    'try', 'except', 'finally', 'with', 'import', 'from',
                    'return', 'yield', 'pass', 'break', 'continue'
                ];

                keywords.forEach(keyword => {
                    suggestions.push({
                        label: keyword,
                        kind: monaco.languages.CompletionItemKind.Keyword,
                        insertText: keyword,
                        detail: 'Python Keyword'
                    });
                });

                return { suggestions };
            }
        });
    }

    async initializeLanguageServer() {
        try {
            const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${wsProtocol}//${window.location.host}`;

            this.languageClient = new WebSocket(wsUrl);
            this.messageId = 1;
            this.pendingRequests = new Map();

            this.languageClient.onopen = () => {
                // Language server connected
                this.initializeLSP();
            };

            this.languageClient.onmessage = (event) => {
                try {
                    const response = JSON.parse(event.data);
                    this.handleLSPResponse(response);
                } catch (error) {
                    console.error('Failed to parse LSP response:', error);
                }
            };

            this.languageClient.onerror = (error) => {
                console.error('Language server error:', error);
                this.setupBasicValidation();
            };

            this.languageClient.onclose = () => {
                // Language server disconnected
                this.setupBasicValidation();
            };
        } catch (error) {
            console.error('Failed to connect to language server:', error);
            this.setupBasicValidation();
        }
    }

    initializeLSP() {
        const initializeRequest = {
            jsonrpc: '2.0',
            id: this.messageId++,
            method: 'initialize',
            params: {
                processId: null,
                clientInfo: {
                    name: 'Python IDE',
                    version: '1.0.0'
                },
                rootUri: 'file:///app/workspace',
                capabilities: {
                    textDocument: {
                        completion: {
                            dynamicRegistration: false,
                            completionItem: {
                                snippetSupport: true,
                                documentationFormat: ['markdown', 'plaintext']
                            }
                        },
                        definition: {
                            dynamicRegistration: false,
                            linkSupport: true
                        },
                        hover: {
                            dynamicRegistration: false,
                            contentFormat: ['markdown', 'plaintext']
                        },
                        synchronization: {
                            dynamicRegistration: false,
                            willSave: true,
                            didSave: true
                        }
                    }
                },
                workspaceFolders: [{
                    uri: 'file:///app/workspace',
                    name: 'workspace'
                }]
            }
        };

        this.sendLSPRequest(initializeRequest);
    }

    sendLSPRequest(request) {
        if (this.languageClient && this.languageClient.readyState === WebSocket.OPEN) {
            this.languageClient.send(JSON.stringify(request));

            if (request.id) {
                this.pendingRequests.set(request.id, request);
            }
        }
    }

    handleLSPResponse(response) {
        if (response.id && this.pendingRequests.has(response.id)) {
            const request = this.pendingRequests.get(response.id);
            this.pendingRequests.delete(response.id);

            switch (request.method) {
                case 'initialize':
                    this.handleInitializeResponse(response);
                    break;
                case 'textDocument/completion':
                    this.handleCompletionResponse(response);
                    break;
                case 'textDocument/definition':
                    this.handleDefinitionResponse(response);
                    break;
                case 'textDocument/hover':
                    this.handleHoverResponse(response);
                    break;
            }
        }
    }

    handleInitializeResponse(response) {
        if (response.result) {
            // Send initialized notification
            this.sendLSPRequest({
                jsonrpc: '2.0',
                method: 'initialized',
                params: {}
            });

            this.setupAdvancedFeatures();
        }
    }

    setupAdvancedFeatures() {
        // Enhanced autocomplete
        monaco.languages.registerCompletionItemProvider('python', {
            triggerCharacters: ['.', ' '],
            provideCompletionItems: async (model, position) => {
                return this.getCompletionItems(model, position);
            }
        });

        // Go-to-definition
        monaco.languages.registerDefinitionProvider('python', {
            provideDefinition: async (model, position) => {
                return this.getDefinition(model, position);
            }
        });

        // Hover information
        monaco.languages.registerHoverProvider('python', {
            provideHover: async (model, position) => {
                return this.getHover(model, position);
            }
        });
    }

    setupBasicValidation() {
        monaco.languages.registerDocumentFormattingEditProvider('python', {
            provideDocumentFormattingEdits: (model) => {
                // Basic Python formatting
                const value = model.getValue();
                const lines = value.split('\\n');
                const formatted = lines.map(line => {
                    // Basic indentation fixes
                    return line.replace(/^\\s+/, (match) => {
                        const spaces = match.length;
                        const tabs = Math.floor(spaces / 4);
                        return '    '.repeat(tabs);
                    });
                });

                return [{
                    range: model.getFullModelRange(),
                    text: formatted.join('\\n')
                }];
            }
        });
    }

    async getCompletionItems(model, position) {
        try {
            const uri = model.uri.toString();
            const text = model.getValue();

            // Get the proper file path from the active file
            const filePath = this.activeFile || 'temp.py';

            // Determine correct URI based on file path
            let fileUri;
            if (filePath.startsWith('/usr/local/lib/python3.11/')) {
                // Standard library file - use absolute path
                fileUri = `file://${filePath}`;
            } else {
                // Workspace file - use workspace prefix
                fileUri = `file:///app/workspace/${filePath}`;
            }

            // Notify language server of document changes
            this.sendLSPRequest({
                jsonrpc: '2.0',
                method: 'textDocument/didChange',
                params: {
                    textDocument: {
                        uri: fileUri,
                        version: Date.now()
                    },
                    contentChanges: [{
                        text: text
                    }]
                }
            });

            // Request completion
            const completionRequest = {
                jsonrpc: '2.0',
                id: this.messageId++,
                method: 'textDocument/completion',
                params: {
                    textDocument: {
                        uri: fileUri
                    },
                    position: {
                        line: position.lineNumber - 1,
                        character: position.column - 1
                    }
                }
            };

            return new Promise((resolve) => {
                this.completionResolve = resolve;
                this.sendLSPRequest(completionRequest);

                // Fallback to basic snippets after timeout
                setTimeout(() => {
                    if (this.completionResolve === resolve) {
                        this.completionResolve = null;
                        resolve(this.getBasicCompletions());
                    }
                }, 1000);
            });
        } catch (error) {
            console.error('Completion error:', error);
            return this.getBasicCompletions();
        }
    }

    getBasicCompletions() {
        const suggestions = [];

        // Add snippet suggestions
        Object.entries(this.snippets).forEach(([key, snippet]) => {
            suggestions.push({
                label: snippet.prefix,
                kind: monaco.languages.CompletionItemKind.Snippet,
                insertText: snippet.body.join('\n'),
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: snippet.description,
                detail: 'Python Snippet'
            });
        });

        // Add basic Python keywords
        const keywords = [
            'def', 'class', 'if', 'elif', 'else', 'for', 'while',
            'try', 'except', 'finally', 'with', 'import', 'from',
            'return', 'yield', 'pass', 'break', 'continue', 'lambda',
            'and', 'or', 'not', 'in', 'is', 'None', 'True', 'False'
        ];

        keywords.forEach(keyword => {
            suggestions.push({
                label: keyword,
                kind: monaco.languages.CompletionItemKind.Keyword,
                insertText: keyword,
                detail: 'Python Keyword'
            });
        });

        return { suggestions };
    }

    handleCompletionResponse(response) {
        if (this.completionResolve) {
            const resolve = this.completionResolve;
            this.completionResolve = null;

            if (response.result && response.result.items) {
                const suggestions = response.result.items.map(item => ({
                    label: item.label,
                    kind: this.convertCompletionItemKind(item.kind),
                    insertText: item.insertText || item.label,
                    detail: item.detail || '',
                    documentation: item.documentation || '',
                    sortText: item.sortText
                }));

                resolve({ suggestions });
            } else {
                resolve(this.getBasicCompletions());
            }
        }
    }

    convertCompletionItemKind(lspKind) {
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
            15: monaco.languages.CompletionItemKind.Snippet
        };

        return kindMap[lspKind] || monaco.languages.CompletionItemKind.Text;
    }

    async getDefinition(model, position, editorSide = 'left') {
        try {
            // Use the appropriate active file path based on editor side
            let filePath;
            if (editorSide === 'right') {
                filePath = this.rightActiveFile || this.activeFile || 'temp.py';
            } else {
                filePath = this.activeFile || 'temp.py';
            }

            let fileUri;
            if (filePath.startsWith('/usr/local/lib/python3.11/')) {
                // Standard library file - use absolute path
                fileUri = `file://${filePath}`;
            } else {
                // Workspace file - use workspace prefix
                fileUri = `file:///app/workspace/${filePath}`;
            }

            // Ensure document is synchronized before requesting definition
            await this.ensureDocumentSynchronized(filePath, model.getValue());

            const requestId = this.messageId++;
            const definitionRequest = {
                jsonrpc: '2.0',
                id: requestId,
                method: 'textDocument/definition',
                params: {
                    textDocument: {
                        uri: fileUri
                    },
                    position: {
                        line: position.lineNumber - 1,
                        character: position.column - 1
                    }
                }
            };

            return new Promise((resolve) => {
                this.definitionResolve = resolve;
                this.sendLSPRequest(definitionRequest);

                setTimeout(() => {
                    if (this.definitionResolve === resolve) {
                        this.definitionResolve = null;
                        resolve(null);
                    }
                }, 5000);
            });
        } catch (error) {
            console.error('Definition error:', error);
            return null;
        }
    }

    async ensureDocumentSynchronized(filePath, content) {
        let fileUri;
        if (filePath.startsWith('/usr/local/lib/python3.11/')) {
            // Standard library file - use absolute path
            fileUri = `file://${filePath}`;
        } else {
            // Workspace file - use workspace prefix
            fileUri = `file:///app/workspace/${filePath}`;
        }

        // Send didChange to ensure document is up to date
        this.sendLSPRequest({
            jsonrpc: '2.0',
            method: 'textDocument/didChange',
            params: {
                textDocument: {
                    uri: fileUri,
                    version: Date.now()
                },
                contentChanges: [{
                    text: content
                }]
            }
        });

        // Give LSP time to process the change
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    handleDefinitionResponse(response) {
        if (this.definitionResolve) {
            const resolve = this.definitionResolve;
            this.definitionResolve = null;

            if (response.result) {
                // Handle both array and single object results
                const locations = Array.isArray(response.result) ? response.result : [response.result];

                if (locations.length > 0) {
                    const location = locations[0];

                    if (location.uri && location.range) {
                        // Handle both workspace and stdlib file URIs
                        let filePath;
                        if (location.uri.startsWith('file:///app/workspace/')) {
                            // Workspace file - remove the workspace prefix
                            filePath = location.uri.replace('file:///app/workspace/', '');
                        } else if (location.uri.startsWith('file://')) {
                            // Other file (like stdlib) - remove file:// protocol
                            filePath = location.uri.replace('file://', '');
                        } else {
                            // Already a relative path
                            filePath = location.uri;
                        }

                        resolve({
                            filePath: filePath,
                            range: {
                                startLineNumber: location.range.start.line + 1,
                                startColumn: location.range.start.character + 1,
                                endLineNumber: location.range.end.line + 1,
                                endColumn: location.range.end.character + 1
                            }
                        });
                        return;
                    }
                }
            }

            resolve(null);
        }
    }

    async getHover(model, position) {
        try {
            // Use the active file path for proper LSP resolution
            const filePath = this.activeFile || 'temp.py';

            // Determine correct URI based on file path
            let fileUri;
            if (filePath.startsWith('/usr/local/lib/python3.11/')) {
                // Standard library file - use absolute path
                fileUri = `file://${filePath}`;
            } else {
                // Workspace file - use workspace prefix
                fileUri = `file:///app/workspace/${filePath}`;
            }

            const hoverRequest = {
                jsonrpc: '2.0',
                id: this.messageId++,
                method: 'textDocument/hover',
                params: {
                    textDocument: {
                        uri: fileUri
                    },
                    position: {
                        line: position.lineNumber - 1,
                        character: position.column - 1
                    }
                }
            };

            return new Promise((resolve) => {
                this.hoverResolve = resolve;
                this.sendLSPRequest(hoverRequest);

                setTimeout(() => {
                    if (this.hoverResolve === resolve) {
                        this.hoverResolve = null;
                        resolve(null);
                    }
                }, 1000);
            });
        } catch (error) {
            console.error('Hover error:', error);
            return null;
        }
    }

    handleHoverResponse(response) {
        if (this.hoverResolve) {
            const resolve = this.hoverResolve;
            this.hoverResolve = null;

            if (response.result && response.result.contents) {
                let content = '';
                if (Array.isArray(response.result.contents)) {
                    content = response.result.contents.map(c =>
                        typeof c === 'string' ? c : c.value
                    ).join('\n\n');
                } else if (typeof response.result.contents === 'string') {
                    content = response.result.contents;
                } else if (response.result.contents.value) {
                    content = response.result.contents.value;
                }

                resolve({
                    contents: [{
                        value: content
                    }]
                });
            } else {
                resolve(null);
            }
        }
    }

    async handleCtrlClick(position, editorSide = 'left') {
        if (!position) return;

        const editor = editorSide === 'right' ? this.rightEditor : this.editor;
        if (!editor) return;

        try {
            const definition = await this.getDefinition(editor.getModel(), position, editorSide);

            if (!definition || !definition.filePath || !definition.range) {
                console.log('No definition found');
                return;
            }

            console.log('Opening file:', definition.filePath);
            await this.openFile(definition.filePath);

            // Get the editor that now has the file open
            const targetEditor = this.splitViewActive && this.focusedEditor === 'right'
                ? this.rightEditor
                : this.editor;

            if (!targetEditor) return;

            // Navigate to the definition position
            targetEditor.setPosition({
                lineNumber: definition.range.startLineNumber,
                column: definition.range.startColumn
            });

            // Highlight the definition briefly
            const decorations = targetEditor.deltaDecorations([], [{
                range: definition.range,
                options: {
                    className: 'highlight-definition',
                    isWholeLine: false
                }
            }]);

            setTimeout(() => {
                try {
                    if (targetEditor) {
                        targetEditor.deltaDecorations(decorations, []);
                    }
                } catch (e) {
                    // Editor may have been disposed
                }
            }, 2000);
        } catch (error) {
            console.error('Ctrl+Click navigation error:', error);
        }
    }

    handleMouseMove(e, editorSide = 'left') {
        if (this.ctrlPressed && e.target) {
            // Monaco 에디터의 마우스 이벤트에서 position 추출
            const position = e.target.position;

            if (position) {
                this.showLinkAtPosition(position, editorSide);
            } else {
                this.clearLinkDecorations(editorSide);
            }
        } else {
            this.clearLinkDecorations(editorSide);
        }
    }

    updateCursorStyle() {
        const editor = document.querySelector('.monaco-editor');
        if (editor) {
            if (this.ctrlPressed) {
                editor.style.cursor = 'pointer';
            } else {
                editor.style.cursor = 'text';
            }
        }
    }

    showLinkAtPosition(position, editorSide = 'left') {
        const editor = editorSide === 'right' ? this.rightEditor : this.editor;
        const model = editor.getModel();
        if (!model) {
            return;
        }

        const word = model.getWordAtPosition(position);
        if (!word) {
            this.clearLinkDecorations(editorSide);
            return;
        }

        // Check if this is a linkable element (variable, function, import)
        const line = model.getLineContent(position.lineNumber);
        const isLinkable = this.isLinkableElement(line, word.word, position);

        if (isLinkable) {
            const range = {
                startLineNumber: position.lineNumber,
                startColumn: word.startColumn,
                endLineNumber: position.lineNumber,
                endColumn: word.endColumn
            };

            if (editorSide === 'right') {
                this.rightCurrentLinkDecorations = editor.deltaDecorations(
                    this.rightCurrentLinkDecorations || [],
                    [{
                        range: range,
                        options: {
                            inlineClassName: 'ctrl-hover-link',
                            stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
                        }
                    }]
                );
            } else {
                this.currentLinkDecorations = editor.deltaDecorations(
                    this.currentLinkDecorations || [],
                    [{
                        range: range,
                        options: {
                            inlineClassName: 'ctrl-hover-link',
                            stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
                        }
                    }]
                );
            }
        } else {
            this.clearLinkDecorations(editorSide);
        }
    }

    isLinkableElement(line, word, position) {
        // Check for imports
        if (line.includes('import') || line.includes('from')) {
            return true;
        }

        // Check for function calls
        const afterWord = line.substring(position.column - 1);
        if (afterWord.startsWith('(')) {
            return true;
        }

        // Check for attribute access
        const beforeWord = line.substring(0, position.column - word.length - 1);
        if (beforeWord.endsWith('.')) {
            return true;
        }

        // Check if it's a variable or function name
        return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(word);
    }

    clearLinkDecorations(editorSide = 'left') {
        if (editorSide === 'right') {
            if (this.rightCurrentLinkDecorations && this.rightEditor) {
                this.rightCurrentLinkDecorations = this.rightEditor.deltaDecorations(
                    this.rightCurrentLinkDecorations,
                    []
                );
            }
        } else {
            if (this.currentLinkDecorations) {
                this.currentLinkDecorations = this.editor.deltaDecorations(
                    this.currentLinkDecorations,
                    []
                );
            }
        }
    }

    notifyDocumentOpened(filepath, content) {
        if (this.languageClient && this.languageClient.readyState === WebSocket.OPEN) {
            // Determine correct URI based on file path
            let fileUri;
            if (filepath.startsWith('/usr/local/lib/python3.11/')) {
                // Standard library file - use absolute path
                fileUri = `file://${filepath}`;
            } else {
                // Workspace file - use workspace prefix
                fileUri = `file:///app/workspace/${filepath}`;
            }

            this.sendLSPRequest({
                jsonrpc: '2.0',
                method: 'textDocument/didOpen',
                params: {
                    textDocument: {
                        uri: fileUri,
                        languageId: 'python',
                        version: 1,
                        text: content
                    }
                }
            });
        }
    }

    notifyDocumentChanged(filepath, content) {
        if (this.languageClient && this.languageClient.readyState === WebSocket.OPEN) {
            // Determine correct URI based on file path
            let fileUri;
            if (filepath.startsWith('/usr/local/lib/python3.11/')) {
                // Standard library file - use absolute path
                fileUri = `file://${filepath}`;
            } else {
                // Workspace file - use workspace prefix
                fileUri = `file:///app/workspace/${filepath}`;
            }

            this.sendLSPRequest({
                jsonrpc: '2.0',
                method: 'textDocument/didChange',
                params: {
                    textDocument: {
                        uri: fileUri,
                        version: Date.now()
                    },
                    contentChanges: [{
                        text: content
                    }]
                }
            });
        }
    }

    async loadSnippets() {
        try {
            const response = await fetch('/api/snippets');
            this.snippets = await response.json();
        } catch (error) {
            console.error('Failed to load snippets:', error);
        }
    }

    async loadFileExplorer() {
        try {
            const url = this.workspaceFolder
                ? `/api/files?folder=${encodeURIComponent(this.workspaceFolder)}`
                : '/api/files';
            const response = await fetch(url);
            const data = await response.json();

            // Handle new response format
            const files = data.files || data;
            this.renderFileExplorer(files);

            // Restore selected directory highlight after refresh
            if (this.selectedDirectory) {
                const selectedElement = document.querySelector(`[data-path="${this.selectedDirectory}"][data-type="directory"]`);
                if (selectedElement) {
                    selectedElement.classList.add('selected');
                } else {
                    // Directory no longer exists, clear selection
                    this.selectedDirectory = '';
                }
            }
        } catch (error) {
            this.fileExplorer.innerHTML = '<div class="error">Failed to load files</div>';
        }
    }

    renderFileExplorer(files, container = this.fileExplorer, level = 0) {
        if (level === 0) {
            container.innerHTML = '';
            this.setupExplorerDropZone(container);
        }

        files.forEach(item => {
            const element = document.createElement('div');

            if (item.type === 'directory') {
                element.className = 'file-item folder-item';
                element.setAttribute('data-path', item.path);
                element.setAttribute('data-type', 'directory');
                element.setAttribute('draggable', 'true');
                element.innerHTML = `
                    <i class="codicon codicon-chevron-right folder-toggle"></i>
                    <i class="codicon codicon-folder file-icon" style="color: #dcb67a;"></i>
                    <span>${item.name}</span>
                `;

                const content = document.createElement('div');
                content.className = 'folder-content';

                // Directory toggle functionality
                const toggle = element.querySelector('.folder-toggle');
                toggle.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const isExpanded = content.classList.contains('expanded');

                    if (!isExpanded) {
                        content.classList.add('expanded');
                        toggle.classList.add('expanded');
                        if (content.children.length === 0) {
                            this.renderFileExplorer(item.children, content, level + 1);
                        }
                    } else {
                        content.classList.remove('expanded');
                        toggle.classList.remove('expanded');
                    }
                });

                // Directory selection for creating files/folders
                element.addEventListener('click', (e) => {
                    if (e.target === toggle) return; // Don't select when clicking toggle
                    e.stopPropagation();

                    // Clear previous selections
                    document.querySelectorAll('.file-item.selected').forEach(el => {
                        el.classList.remove('selected');
                    });

                    element.classList.add('selected');
                    this.selectedDirectory = item.path;
                });

                // Right-click context menu
                element.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    this.showContextMenu(e, item.path, 'directory');
                });

                // 드래그 앤 드롭 이벤트
                this.setupDragEvents(element, item);
                this.setupDropZone(element, item);

                container.appendChild(element);
                container.appendChild(content);
            } else {
                element.className = 'file-item';
                element.setAttribute('data-path', item.path);
                element.setAttribute('data-type', 'file');
                element.setAttribute('draggable', 'true');
                element.innerHTML = `
                    <span class="file-icon">${this.getFileIcon(item.name)}</span>
                    <span>${item.name}</span>
                `;

                element.addEventListener('click', () => {
                    this.openFile(item.path);
                });

                // Right-click context menu
                element.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    this.showContextMenu(e, item.path, 'file');
                });

                // 드래그 앤 드롭 이벤트
                this.setupDragEvents(element, item);

                container.appendChild(element);
            }
        });
    }

    setupExplorerDropZone(container) {
        // 파일 탐색기 전체 영역을 드롭 존으로 설정 (루트에 파일 업로드)
        container.addEventListener('dragover', (e) => {
            // 외부 파일만 허용
            if (e.dataTransfer.types.includes('Files')) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
                container.classList.add('drag-over');
            }
        });

        container.addEventListener('dragleave', (e) => {
            if (e.target === container) {
                container.classList.remove('drag-over');
            }
        });

        container.addEventListener('drop', async (e) => {
            e.preventDefault();
            container.classList.remove('drag-over');

            // 외부 파일/디렉토리 업로드
            const items = e.dataTransfer.items;

            if (items && items.length > 0) {
                // Check if we can use the items API
                let hasEntry = false;
                for (let i = 0; i < items.length; i++) {
                    if (items[i].webkitGetAsEntry) {
                        hasEntry = true;
                        break;
                    }
                }

                if (hasEntry) {
                    await this.handleDroppedItems(items, '');
                    return;
                }
            }

            // Fallback for browsers that don't support items API
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                await this.handleFileUpload(files, '');
            }
        });
    }

    setupDragEvents(element, item) {
        element.addEventListener('dragstart', (e) => {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('application/json', JSON.stringify({
                path: item.path,
                name: item.name,
                type: item.type
            }));
            element.classList.add('dragging');
        });

        element.addEventListener('dragend', (e) => {
            element.classList.remove('dragging');
            document.querySelectorAll('.drag-over').forEach(el => {
                el.classList.remove('drag-over');
            });
        });
    }

    setupDropZone(element, item) {
        if (item.type !== 'directory') return;

        element.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();

            const jsonData = e.dataTransfer.types.includes('application/json');
            const filesData = e.dataTransfer.types.includes('Files');

            if (jsonData || filesData) {
                e.dataTransfer.dropEffect = jsonData ? 'move' : 'copy';
                element.classList.add('drag-over');
            }
        });

        element.addEventListener('dragleave', (e) => {
            if (e.target === element) {
                element.classList.remove('drag-over');
            }
        });

        element.addEventListener('drop', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            element.classList.remove('drag-over');

            // 내부 파일/폴더 이동
            const jsonData = e.dataTransfer.getData('application/json');
            if (jsonData) {
                const data = JSON.parse(jsonData);
                await this.handleItemMove(data, item.path);
                return;
            }

            // 외부 파일/디렉토리 업로드
            const items = e.dataTransfer.items;

            if (items && items.length > 0) {
                // Check if we can use the items API
                let hasEntry = false;
                for (let i = 0; i < items.length; i++) {
                    if (items[i].webkitGetAsEntry) {
                        hasEntry = true;
                        break;
                    }
                }

                if (hasEntry) {
                    await this.handleDroppedItems(items, item.path);
                    return;
                }
            }

            // Fallback for browsers that don't support items API
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                await this.handleFileUpload(files, item.path);
            }
        });
    }

    async handleItemMove(draggedItem, targetPath) {
        try {
            // 자기 자신에게 드롭하는 경우 무시
            if (draggedItem.path === targetPath) {
                return;
            }

            // 하위 폴더로 이동하는 경우 방지
            if (targetPath.startsWith(draggedItem.path + '/')) {
                alert('Cannot move a folder into itself');
                return;
            }

            const newPath = `${targetPath}/${draggedItem.name}`;

            // 이미 같은 이름의 파일이 있는지 확인
            if (await this.fileExists(newPath)) {
                if (!confirm(`"${draggedItem.name}" already exists. Do you want to replace it?`)) {
                    return;
                }
            }

            const response = await fetch(this.buildUrl('/api/move'), {
                method: 'POST',
                headers: this.getFetchHeaders(),
                body: JSON.stringify({
                    source: draggedItem.path,
                    destination: newPath
                })
            });

            if (!response.ok) {
                throw new Error('Failed to move item');
            }

            // Update selected directory if it was moved
            if (this.selectedDirectory === draggedItem.path) {
                this.selectedDirectory = newPath;
            } else if (this.selectedDirectory.startsWith(draggedItem.path + '/')) {
                this.selectedDirectory = this.selectedDirectory.replace(draggedItem.path, newPath);
            }

            // 열린 탭 업데이트
            if (this.openTabs.has(draggedItem.path)) {
                const tabData = this.openTabs.get(draggedItem.path);
                this.openTabs.delete(draggedItem.path);
                this.openTabs.set(newPath, tabData);

                if (this.activeFile === draggedItem.path) {
                    this.activeFile = newPath;
                }

                const tab = document.querySelector(`[data-filepath="${draggedItem.path}"]`);
                if (tab) {
                    tab.setAttribute('data-filepath', newPath);
                    tab.querySelector('span').textContent = draggedItem.name;
                }
            }

            this.loadFileExplorer();
        } catch (error) {
            alert('Failed to move item: ' + error.message);
        }
    }

    async handleDroppedItems(items, targetPath) {
        try {
            const allFiles = [];

            // Process all dropped items
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                if (item.kind === 'file') {
                    const entry = item.webkitGetAsEntry();
                    if (entry) {
                        await this.traverseFileTree(entry, '', allFiles);
                    }
                }
            }

            if (allFiles.length === 0) {
                return;
            }

            // Upload all collected files
            await this.handleFileUpload(allFiles, targetPath);
        } catch (error) {
            alert('Failed to process dropped items: ' + error.message);
        }
    }

    async traverseFileTree(item, path, allFiles) {
        return new Promise((resolve, reject) => {
            if (item.isFile) {
                item.file((file) => {
                    // Store file with its relative path
                    allFiles.push({
                        file: file,
                        relativePath: path + file.name
                    });
                    resolve();
                }, reject);
            } else if (item.isDirectory) {
                const dirReader = item.createReader();
                const dirPath = path + item.name + '/';

                const readEntries = () => {
                    dirReader.readEntries(async (entries) => {
                        if (entries.length === 0) {
                            resolve();
                            return;
                        }

                        // Process all entries in this directory
                        for (const entry of entries) {
                            await this.traverseFileTree(entry, dirPath, allFiles);
                        }

                        // Continue reading (readEntries returns max 100 entries at a time)
                        readEntries();
                    }, reject);
                };

                readEntries();
            }
        });
    }

    async handleFileUpload(filesOrArray, targetPath) {
        try {
            const formData = new FormData();

            // Handle both File[] and {file, relativePath}[] formats
            if (Array.isArray(filesOrArray) && filesOrArray.length > 0 && filesOrArray[0].file) {
                // Directory upload with relative paths
                for (const item of filesOrArray) {
                    formData.append('files', item.file);
                    formData.append('relativePaths', item.relativePath);
                }
            } else {
                // Simple file upload
                for (const file of filesOrArray) {
                    formData.append('files', file);
                }
            }

            formData.append('targetPath', targetPath);

            const url = (this.workspaceFolder && this.workspaceFolder.trim() !== '')
                ? `/api/upload?folder=${encodeURIComponent(this.workspaceFolder)}`
                : '/api/upload';

            const response = await fetch(url, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to upload files: ${errorText}`);
            }

            const result = await response.json();

            // 성공 메시지 표시
            const msg = document.createElement('div');
            msg.style.cssText = `
                position: fixed; top: 20px; right: 20px; background: #4CAF50;
                color: white; padding: 8px 16px; border-radius: 4px; z-index: 9999;
                font-size: 14px; pointer-events: none;
            `;
            msg.textContent = `Uploaded ${result.files.length} file(s)`;
            document.body.appendChild(msg);
            setTimeout(() => msg.remove(), 2000);

            this.loadFileExplorer();
        } catch (error) {
            alert('Failed to upload files: ' + error.message);
        }
    }

    getFileIcon(filename) {
        const ext = filename.split('.').pop()?.toLowerCase();
        const color = this.getFileIconColor(ext);

        // Use Codicon font icons (VSCode icons)
        const icon = (glyph, iconColor = '#c5c5c5') => {
            return `<i class="codicon codicon-${glyph}" style="color: ${iconColor}; font-size: 16px;"></i>`;
        };

        switch (ext) {
            case 'py':
                return icon('symbol-method', '#4b8bbe');
            case 'js':
                return icon('symbol-method', '#f0db4f');
            case 'jsx':
                return icon('react', '#61dafb');
            case 'ts':
                return icon('symbol-method', '#3178c6');
            case 'tsx':
                return icon('react', '#3178c6');
            case 'json':
                return icon('json', '#f0db4f');
            case 'html': case 'htm':
                return icon('code', '#e34c26');
            case 'css': case 'scss': case 'sass':
                return icon('symbol-color', '#5d8fdb');
            case 'md': case 'markdown':
                return icon('markdown', '#c5c5c5');
            case 'txt':
                return icon('file', '#c5c5c5');
            case 'yml': case 'yaml': case 'config': case 'conf':
                return icon('settings-gear', '#e65c5c');
            case 'xml':
                return icon('code', '#c5c5c5');
            case 'csv':
                return icon('table', '#4db380');
            case 'log':
                return icon('output', '#c5c5c5');
            case 'sql':
                return icon('database', '#c5c5c5');
            case 'sh': case 'bash':
                return icon('terminal-bash', '#6bc267');
            case 'php':
                return icon('symbol-method', '#9b7cc4');
            case 'java':
                return icon('symbol-method', '#5d9bd6');
            case 'c': case 'cpp': case 'h':
                return icon('file-code', '#5d9bd6');
            case 'go':
                return icon('symbol-method', '#5dc9e2');
            case 'rs':
                return icon('file-code', '#e6b8a2');
            case 'swift':
                return icon('symbol-method', '#f27b5b');
            case 'kt': case 'kts':
                return icon('file-code', '#a87dff');
            case 'rb':
                return icon('ruby', '#e65c5c');
            case 'env':
                return icon('symbol-key', '#ffd966');
            case 'dockerfile':
                return icon('file-code', '#4db3e8');
            case 'gitignore':
                return icon('diff-ignored', '#c5c5c5');
            case 'lock':
                return icon('lock', '#c5c5c5');
            case 'zip': case 'tar': case 'gz':
                return icon('file-zip', '#c5c5c5');
            case 'png': case 'jpg': case 'jpeg': case 'gif': case 'svg':
                return icon('file-media', '#c58ae0');
            case 'pdf':
                return icon('file-pdf', '#f46060');
            default:
                return icon('file', '#c5c5c5');
        }
    }

    getFileIconColor(ext) {
        // Return color for each file type (for reference, actual color is in SVG)
        const colors = {
            'py': '#3776ab',
            'js': '#f0db4f',
            'jsx': '#f0db4f',
            'ts': '#3178c6',
            'tsx': '#3178c6',
            'html': '#e34c26',
            'css': '#264de4',
            'json': '#858585',
        };
        return colors[ext] || '#858585';
    }

    async openFile(filepath) {
        try {
            // If split view is active, open in focused editor
            if (this.splitViewActive) {
                if (this.focusedEditor === 'right') {
                    // Open in right editor
                    if (this.rightOpenTabs.has(filepath)) {
                        this.switchToTabInSplit(filepath);
                        return;
                    }
                    await this.openFileInSplit(filepath);
                    return;
                } else {
                    // Open in left editor (default)
                    if (this.openTabs.has(filepath)) {
                        this.switchToTab(filepath);
                        return;
                    }
                }
            } else {
                // No split view, check if already open
                if (this.openTabs.has(filepath)) {
                    this.switchToTab(filepath);
                    return;
                }
            }

            let response, data;

            // Check if this is a Python standard library file
            if (filepath.startsWith('/usr/local/lib/python3.11/')) {
                // Extract the relative path from the stdlib base path
                const stdlibPath = filepath.replace('/usr/local/lib/python3.11/', '');
                response = await fetch(`/api/stdlib/${stdlibPath}`);

                if (!response.ok) {
                    throw new Error(`Failed to load stdlib file: ${filepath}`);
                }

                data = await response.json();
            } else {
                // Regular workspace file
                response = await fetch(this.buildUrl(`/api/files/${filepath}`));

                if (!response.ok) {
                    throw new Error(`Failed to load file: ${filepath}`);
                }

                data = await response.json();
            }

            const model = monaco.editor.createModel(
                data.content,
                this.getLanguageFromFile(filepath),
                monaco.Uri.file(filepath)
            );

            this.openTabs.set(filepath, {
                model,
                saved: true,
                isStdlib: filepath.startsWith('/usr/local/lib/python3.11/')
            });

            // Notify language server for all Python files
            this.notifyDocumentOpened(filepath, data.content);

            this.createTab(filepath);
            this.switchToTab(filepath);

        } catch (error) {
            console.error('Failed to open file:', error);
            // Show user-friendly error message
            alert(`Could not open file: ${filepath.split('/').pop()}\nError: ${error.message}`);
        }
    }

    getLanguageFromFile(filepath) {
        const ext = filepath.split('.').pop()?.toLowerCase();
        switch (ext) {
            case 'py':
            case 'pyi': // Python stub files
                return 'python';
            case 'js': return 'javascript';
            case 'json': return 'json';
            case 'html': return 'html';
            case 'css': return 'css';
            default: return 'plaintext';
        }
    }

    createTab(filepath) {
        const filename = filepath.split('/').pop();
        const isStdlib = filepath.startsWith('/usr/local/lib/python3.11/');
        const tab = document.createElement('div');
        tab.className = 'tab';
        tab.dataset.filepath = filepath;
        tab.innerHTML = `
            <span class="tab-label">${filename}${isStdlib ? ' (read-only)' : ''}</span>
            <i class="codicon codicon-close tab-close"></i>
        `;

        if (isStdlib) {
            tab.classList.add('stdlib-tab');
        }

        // Make tab draggable
        tab.setAttribute('draggable', 'true');

        // Tab click handler
        tab.addEventListener('click', (e) => {
            if (e.target.classList.contains('tab-close')) {
                this.closeTab(filepath);
            } else {
                this.focusedEditor = 'left';
                this.switchToTab(filepath);
                if (this.splitViewActive) {
                    this.updateEditorFocusVisual();
                }
            }
        });

        // Tab drag handlers for reordering
        tab.addEventListener('dragstart', (e) => {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', filepath);
            e.dataTransfer.setData('editor-group', 'left');
            tab.classList.add('dragging');
        });

        tab.addEventListener('dragend', (e) => {
            tab.classList.remove('dragging');
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('drag-over'));
        });

        tab.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';

            const draggingTab = document.querySelector('.tab.dragging');
            if (draggingTab && draggingTab !== tab && draggingTab.closest('#tabBar')) {
                const rect = tab.getBoundingClientRect();
                const midpoint = rect.left + rect.width / 2;

                if (e.clientX < midpoint) {
                    tab.parentNode.insertBefore(draggingTab, tab);
                } else {
                    tab.parentNode.insertBefore(draggingTab, tab.nextSibling);
                }
            }
        });

        // Tab right-click context menu
        tab.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.showTabContextMenu(e, filepath);
        });

        this.tabBar.appendChild(tab);
    }

    switchToTab(filepath) {
        // Update active tab styling
        document.querySelectorAll('.tab').forEach(tab => {
            tab.classList.remove('active');
        });

        const tab = document.querySelector(`[data-filepath="${filepath}"]`);
        if (tab) {
            tab.classList.add('active');
        }

        // Switch editor model
        const tabData = this.openTabs.get(filepath);
        if (tabData) {
            this.editor.setModel(tabData.model);
            this.activeFile = filepath;

            // Update file path display
            this.updateFilePathDisplay(filepath, tabData.isStdlib);

            // Update active file highlighting in explorer
            this.updateActiveFileHighlight();

            // Show execute button for Python files (not for stdlib files)
            const isPython = filepath.endsWith('.py');
            this.executeButton.style.display = (isPython && !tabData.isStdlib) ? 'block' : 'none';

            // Setup sync if same file is open in both editors
            if (this.splitViewActive) {
                this.setupModelSync(filepath);
            }
        }
    }

    closeTab(filepath) {
        // Cleanup sync listener if exists
        this.cleanupSyncListener(filepath);

        const tabData = this.openTabs.get(filepath);
        if (tabData) {
            tabData.model.dispose();
            this.openTabs.delete(filepath);
        }

        const tab = document.querySelector(`[data-filepath="${filepath}"]`);
        if (tab) {
            tab.remove();
        }

        // Switch to another tab if this was active
        if (this.activeFile === filepath) {
            const remainingTabs = document.querySelectorAll('.tab');
            if (remainingTabs.length > 0) {
                const newFilepath = remainingTabs[0].dataset.filepath;
                this.switchToTab(newFilepath);
            } else {
                this.activeFile = null;
                this.editor.setModel(null);
                this.executeButton.style.display = 'none';
            }
        }
    }

    async saveFile(filepath) {
        const tabData = this.openTabs.get(filepath);
        if (!tabData) return;

        try {
            const content = tabData.model.getValue();
            await fetch(this.buildUrl(`/api/files/${filepath}`), {
                method: 'POST',
                headers: this.getFetchHeaders(),
                body: JSON.stringify({ content })
            });

            tabData.saved = true;
        } catch (error) {
            console.error('Failed to save file:', error);
        }
    }

    async executeCode(editorGroup = 'left') {
        const activeFile = editorGroup === 'left' ? this.activeFile : this.rightActiveFile;
        const openTabs = editorGroup === 'left' ? this.openTabs : this.rightOpenTabs;
        const outputPanel = editorGroup === 'left' ? this.outputPanel : document.getElementById('outputPanel2');

        if (!activeFile || !activeFile.endsWith('.py')) return;

        const tabData = openTabs.get(activeFile);
        if (!tabData) return;

        const code = tabData.model.getValue();
        const filename = activeFile.split('/').pop();

        try {
            if (outputPanel) {
                outputPanel.style.display = 'block';
                outputPanel.className = 'output-panel';
                outputPanel.textContent = 'Executing...';
            }

            const response = await fetch('/api/execute', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ code, filename })
            });

            const result = await response.json();

            if (outputPanel) {
                if (result.success) {
                    outputPanel.textContent = result.output || 'Code executed successfully (no output)';
                } else {
                    outputPanel.className = 'output-panel error';
                    outputPanel.textContent = result.error || 'Execution failed';
                }
            }
        } catch (error) {
            if (outputPanel) {
                outputPanel.className = 'output-panel error';
                outputPanel.textContent = 'Failed to execute code: ' + error.message;
            }
        }
    }

    async handleGoToDefinition(position) {
        // Basic go-to-definition for imports
        const model = this.editor.getModel();
        if (!model) return;

        const word = model.getWordAtPosition(position);
        if (!word) return;

        const line = model.getLineContent(position.lineNumber);

        // Check if it's an import statement
        const importMatch = line.match(/^\\s*(?:from\\s+([\\w.]+)\\s+)?import\\s+([\\w,\\s]+)/);
        if (importMatch) {
            const module = importMatch[1] || importMatch[2].split(',')[0].trim();
            const pythonFile = `${module.replace('.', '/')}.py`;

            // Try to open the file if it exists in workspace
            try {
                await this.openFile(pythonFile);
            } catch (error) {
                console.log('Module file not found in workspace:', pythonFile);
            }
        }
    }

    setupEventListeners() {
        this.executeButton.addEventListener('click', () => {
            this.executeCode('left');
        });

        // Split toggle button
        const splitToggleBtn = document.getElementById('splitToggleBtn');
        if (splitToggleBtn) {
            splitToggleBtn.addEventListener('click', () => {
                this.toggleSplit();
            });
        }

        // Explorer actions
        document.getElementById('newFileBtn').addEventListener('click', () => {
            // Clear selection when using toolbar button (create in root)
            this.selectedDirectory = '';
            this.showCreateDialog('file');
        });

        document.getElementById('newFolderBtn').addEventListener('click', () => {
            // Clear selection when using toolbar button (create in root)
            this.selectedDirectory = '';
            this.showCreateDialog('folder');
        });

        document.getElementById('refreshBtn').addEventListener('click', () => {
            this.loadFileExplorer();
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                if (this.activeFile) {
                    this.saveFile(this.activeFile);
                }
            }

            if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
                e.preventDefault();
                this.executeCode();
            }

            // Close dialogs with Escape
            if (e.key === 'Escape') {
                this.closeDialog();
            }
        });

        // Close context menu on click outside
        document.addEventListener('click', () => {
            this.closeContextMenu();
        });

        // File explorer empty space context menu
        this.fileExplorer.addEventListener('contextmenu', (e) => {
            // Check if the right-click is on empty space (not on a file/folder item)
            if (e.target === this.fileExplorer || e.target.closest('.file-item') === null) {
                e.preventDefault();
                this.showEmptySpaceContextMenu(e);
            }
        });

        // Click on empty space to deselect
        this.fileExplorer.addEventListener('click', (e) => {
            if (e.target === this.fileExplorer || (e.target.classList.contains('folder-content') && e.target.children.length === 0)) {
                // Clear previous selections
                document.querySelectorAll('.file-item.selected').forEach(el => {
                    el.classList.remove('selected');
                });
                this.selectedDirectory = '';
            }
        });
    }

    showCreateDialog(type) {
        this.closeDialog();

        const currentDir = this.selectedDirectory || '';
        const dirDisplay = currentDir ? ` in ${currentDir}` : ' in root';

        const dialog = document.createElement('div');
        dialog.className = 'input-dialog';
        dialog.innerHTML = `
            <div class="input-dialog-content">
                <h3>Create New ${type === 'file' ? 'File' : 'Folder'}${dirDisplay}</h3>
                <input type="text" id="nameInput" placeholder="Enter ${type} name..." />
                <div class="input-dialog-buttons">
                    <button class="dialog-button secondary" onclick="this.closest('.input-dialog').remove()">Cancel</button>
                    <button class="dialog-button primary" id="createBtn">Create</button>
                </div>
            </div>
        `;

        document.body.appendChild(dialog);

        const input = dialog.querySelector('#nameInput');
        const createBtn = dialog.querySelector('#createBtn');

        input.focus();

        const create = async () => {
            const name = input.value.trim();
            if (!name) return;

            try {
                const fullPath = this.selectedDirectory ? `${this.selectedDirectory}/${name}` : name;

                // Check if file/folder already exists
                if (await this.checkIfFileExists(fullPath)) {
                    alert(`A ${type} named "${name}" already exists in this directory.`);
                    return;
                }

                if (type === 'file') {
                    await this.createFile(fullPath);
                } else {
                    await this.createFolder(fullPath);
                }
                dialog.remove();
                this.loadFileExplorer();
            } catch (error) {
                alert('Failed to create ' + type + ': ' + error.message);
            }
        };

        createBtn.addEventListener('click', create);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                create();
            }
        });
    }

    async createFile(filename) {
        const content = filename.endsWith('.py') ?
            `#!/usr/bin/env python3\n\"\"\"\n${filename} - Description\n\"\"\"\n\n\ndef main():\n    pass\n\n\nif __name__ == "__main__":\n    main()\n` :
            '';

        const response = await fetch(this.buildUrl(`/api/files/${filename}`), {
            method: 'POST',
            headers: this.getFetchHeaders(),
            body: JSON.stringify({ content })
        });

        if (!response.ok) {
            throw new Error('Failed to create file');
        }
    }

    async createFolder(foldername) {
        // Create folder using mkdir API
        const response = await fetch(this.buildUrl('/api/mkdir'), {
            method: 'POST',
            headers: this.getFetchHeaders(),
            body: JSON.stringify({ path: foldername })
        });

        if (!response.ok) {
            throw new Error('Failed to create folder');
        }
    }

    async checkIfFileExists(filepath) {
        try {
            const response = await fetch(`/api/files/${filepath}`);
            return response.ok;
        } catch (error) {
            return false;
        }
    }

    closeDialog() {
        const dialogs = document.querySelectorAll('.input-dialog');
        dialogs.forEach(dialog => dialog.remove());

        // Keep selected directory when dialog is closed (don't clear)
        // This allows users to create multiple files in the same directory
    }

    closeContextMenu() {
        const menus = document.querySelectorAll('.context-menu');
        menus.forEach(menu => menu.remove());
    }

    updateFilePathDisplay(filepath, isStdlib = false) {
        if (!this.filePathBar) return;

        if (filepath) {
            // Format the file path for display
            let displayPath = filepath;
            if (isStdlib) {
                displayPath = `Python Standard Library: ${filepath}`;
                this.filePathBar.className = 'file-path-bar stdlib';
            } else {
                displayPath = `Workspace: ${filepath}`;
                this.filePathBar.className = 'file-path-bar';
            }
            this.filePathBar.textContent = displayPath;
            this.filePathBar.title = filepath; // Show full path on hover
        } else {
            this.filePathBar.textContent = '';
            this.filePathBar.className = 'file-path-bar';
        }
    }

    updateActiveFileHighlight() {
        // Clear all active highlights
        document.querySelectorAll('.file-item.active').forEach(el => {
            el.classList.remove('active');
        });

        // Highlight current active file
        if (this.activeFile) {
            const activeElement = document.querySelector(`[data-path="${this.activeFile}"][data-type="file"]`);
            if (activeElement) {
                activeElement.classList.add('active');
            }
        }
    }

    initializeSidebarResize() {
        const sidebar = document.getElementById('sidebar');
        const resizer = document.getElementById('sidebarResizer');

        let isResizing = false;

        resizer.addEventListener('mousedown', (e) => {
            isResizing = true;
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            e.preventDefault();
        });

        const handleMouseMove = (e) => {
            if (!isResizing) return;
            const newWidth = e.clientX;
            const minWidth = 200;
            const maxWidth = 600;

            if (newWidth >= minWidth && newWidth <= maxWidth) {
                sidebar.style.width = newWidth + 'px';
            }
        };

        const handleMouseUp = () => {
            isResizing = false;
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }

    showTabContextMenu(event, filepath, editorGroup = 'left') {
        this.closeContextMenu();

        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.style.left = event.pageX + 'px';
        menu.style.top = event.pageY + 'px';

        const filename = filepath.split('/').pop();
        const tabData = editorGroup === 'left' ? this.openTabs.get(filepath) : this.rightOpenTabs.get(filepath);
        const isStdlib = tabData?.isStdlib || false;

        const closeAction = editorGroup === 'left' ? () => this.closeTab(filepath) : () => this.closeTabInSplit(filepath);
        const closeOthersAction = editorGroup === 'left' ? () => this.closeOtherTabs(filepath) : () => this.closeOtherTabsInSplit(filepath);
        const closeAllAction = editorGroup === 'left' ? () => this.closeAllTabs() : () => this.closeAllTabsInSplit();
        const closeRightAction = editorGroup === 'left' ? () => this.closeTabsToRight(filepath) : () => this.closeTabsToRightInSplit(filepath);

        const menuItems = [
            { text: 'Close', action: closeAction },
            { text: 'Close Others', action: closeOthersAction },
            { text: 'Close All', action: closeAllAction },
            { text: 'Close Tabs to the Right', action: closeRightAction },
            { separator: true },
            { text: 'Copy File Name', action: () => this.copyToClipboard(filename) },
            { text: 'Copy Path', action: () => this.copyToClipboard(filepath) },
            { text: 'Copy Relative Path', action: () => this.copyToClipboard(`./${filepath}`) },
        ];

        // Add download option only for non-stdlib files
        if (!isStdlib) {
            menuItems.push(
                { separator: true },
                { text: 'Download', action: () => this.downloadItem(filepath) }
            );
        }

        menuItems.forEach(item => {
            if (item.separator) {
                const separator = document.createElement('div');
                separator.className = 'context-menu-separator';
                menu.appendChild(separator);
            } else {
                const menuItem = document.createElement('div');
                menuItem.className = `context-menu-item ${item.class || ''}`;
                menuItem.textContent = item.text;
                menuItem.addEventListener('click', () => {
                    item.action();
                    this.closeContextMenu();
                });
                menu.appendChild(menuItem);
            }
        });

        document.body.appendChild(menu);

        // Close menu when clicking outside
        setTimeout(() => {
            document.addEventListener('click', this.closeContextMenu.bind(this), { once: true });
        }, 0);
    }

    closeOtherTabs(keepFilepath) {
        const allTabs = Array.from(document.querySelectorAll('.tab'));
        allTabs.forEach(tab => {
            const filepath = tab.dataset.filepath;
            if (filepath !== keepFilepath) {
                this.closeTab(filepath);
            }
        });
    }

    closeAllTabs() {
        const allTabs = Array.from(document.querySelectorAll('.tab'));
        allTabs.forEach(tab => {
            this.closeTab(tab.dataset.filepath);
        });
    }

    closeTabsToRight(fromFilepath) {
        const allTabs = Array.from(document.querySelectorAll('.tab'));
        const fromIndex = allTabs.findIndex(tab => tab.dataset.filepath === fromFilepath);

        if (fromIndex !== -1) {
            for (let i = fromIndex + 1; i < allTabs.length; i++) {
                this.closeTab(allTabs[i].dataset.filepath);
            }
        }
    }


    setupSplitResize(divider, leftGroup, rightGroup) {
        let isDragging = false;
        let startX = 0;
        let startLeftWidth = 0;
        let startRightWidth = 0;

        divider.addEventListener('mousedown', (e) => {
            isDragging = true;
            startX = e.clientX;
            startLeftWidth = leftGroup.offsetWidth;
            startRightWidth = rightGroup.offsetWidth;
            document.body.style.cursor = 'col-resize';
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;

            const delta = e.clientX - startX;
            const newLeftWidth = startLeftWidth + delta;
            const newRightWidth = startRightWidth - delta;
            const totalWidth = startLeftWidth + startRightWidth;

            if (newLeftWidth > 200 && newRightWidth > 200) {
                const leftPercent = (newLeftWidth / totalWidth) * 100;
                const rightPercent = (newRightWidth / totalWidth) * 100;

                leftGroup.style.flex = `0 0 ${leftPercent}%`;
                rightGroup.style.flex = `0 0 ${rightPercent}%`;
            }
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                document.body.style.cursor = '';
            }
        });
    }

    async openFileInSplit(filepath) {
        if (!this.splitViewActive || !this.rightEditor) return;

        try {
            // Check if already open in right editor
            if (this.rightOpenTabs.has(filepath)) {
                this.switchToTabInSplit(filepath);
                return;
            }

            let response, data;

            // Check if this is a Python standard library file
            if (filepath.startsWith('/usr/local/lib/python3.11/')) {
                // Extract the relative path from the stdlib base path
                const stdlibPath = filepath.replace('/usr/local/lib/python3.11/', '');
                response = await fetch(`/api/stdlib/${stdlibPath}`);

                if (!response.ok) {
                    throw new Error(`Failed to load stdlib file: ${filepath}`);
                }

                data = await response.json();
            } else {
                // Regular workspace file
                response = await fetch(this.buildUrl(`/api/files/${filepath}`));

                if (!response.ok) {
                    throw new Error(`Failed to load file: ${filepath}`);
                }

                data = await response.json();
            }

            const model = monaco.editor.createModel(
                data.content,
                this.getLanguageFromFile(filepath),
                monaco.Uri.file(filepath + '_split')
            );

            this.rightOpenTabs.set(filepath, {
                model,
                saved: true,
                isStdlib: filepath.startsWith('/usr/local/lib/python3.11/')
            });

            // Notify language server for all Python files
            this.notifyDocumentOpened(filepath, data.content);

            this.createTabInSplit(filepath);
            this.switchToTabInSplit(filepath);

        } catch (error) {
            console.error('Failed to open file in split:', error);
            alert(`Could not open file: ${filepath.split('/').pop()}\nError: ${error.message}`);
        }
    }

    createTabInSplit(filepath) {
        const filename = filepath.split('/').pop();
        const tabBar2 = document.getElementById('tabBar2');
        const isStdlib = filepath.startsWith('/usr/local/lib/python3.11/');

        const tab = document.createElement('div');
        tab.className = 'tab';
        tab.dataset.filepath = filepath;
        tab.innerHTML = `
            <span class="tab-label">${filename}${isStdlib ? ' (read-only)' : ''}</span>
            <i class="codicon codicon-close tab-close"></i>
        `;

        if (isStdlib) {
            tab.classList.add('stdlib-tab');
        }

        // Make tab draggable
        tab.setAttribute('draggable', 'true');

        tab.addEventListener('click', (e) => {
            if (e.target.classList.contains('tab-close')) {
                this.closeTabInSplit(filepath);
            } else {
                this.focusedEditor = 'right';
                this.switchToTabInSplit(filepath);
                this.updateEditorFocusVisual();
            }
        });

        // Tab drag handlers
        tab.addEventListener('dragstart', (e) => {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', filepath);
            e.dataTransfer.setData('editor-group', 'right');
            tab.classList.add('dragging');
        });

        tab.addEventListener('dragend', (e) => {
            tab.classList.remove('dragging');
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('drag-over'));
        });

        tab.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';

            const draggingTab = document.querySelector('.tab.dragging');
            if (draggingTab && draggingTab !== tab && draggingTab.closest('#tabBar2')) {
                const rect = tab.getBoundingClientRect();
                const midpoint = rect.left + rect.width / 2;

                if (e.clientX < midpoint) {
                    tab.parentNode.insertBefore(draggingTab, tab);
                } else {
                    tab.parentNode.insertBefore(draggingTab, tab.nextSibling);
                }
            }
        });

        // Tab right-click context menu
        tab.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.showTabContextMenu(e, filepath, 'right');
        });

        tabBar2.appendChild(tab);
    }

    switchToTabInSplit(filepath) {
        // Update active tab styling
        document.querySelectorAll('#tabBar2 .tab').forEach(tab => {
            tab.classList.remove('active');
        });

        const tab = document.querySelector(`#tabBar2 [data-filepath="${filepath}"]`);
        if (tab) {
            tab.classList.add('active');
        }

        // Switch editor model
        const tabData = this.rightOpenTabs.get(filepath);
        if (tabData && this.rightEditor) {
            this.rightEditor.setModel(tabData.model);
            this.rightActiveFile = filepath;

            // Update file path display
            const filePathBar2 = document.getElementById('filePathBar2');
            if (filePathBar2) {
                filePathBar2.textContent = filepath;
            }

            // Show execute button for Python files (not for stdlib files)
            const executeButton2 = document.getElementById('executeButton2');
            if (executeButton2) {
                const isPython = filepath.endsWith('.py');
                executeButton2.style.display = (isPython && !tabData.isStdlib) ? 'block' : 'none';
            }

            // Setup sync if same file is open in both editors
            this.setupModelSync(filepath);
        }
    }

    closeTabInSplit(filepath) {
        // Cleanup sync listener if exists
        this.cleanupSyncListener(filepath);

        const tabData = this.rightOpenTabs.get(filepath);
        if (tabData) {
            tabData.model.dispose();
            this.rightOpenTabs.delete(filepath);
        }

        const tab = document.querySelector(`#tabBar2 [data-filepath="${filepath}"]`);
        if (tab) {
            tab.remove();
        }

        // If no more tabs, close split view
        if (this.rightOpenTabs.size === 0) {
            this.closeSplitView();
        } else if (this.rightActiveFile === filepath) {
            // Switch to another tab
            const remainingTabs = document.querySelectorAll('#tabBar2 .tab');
            if (remainingTabs.length > 0) {
                this.switchToTabInSplit(remainingTabs[0].dataset.filepath);
            }
        }
    }

    closeOtherTabsInSplit(keepFilepath) {
        const allTabs = Array.from(document.querySelectorAll('#tabBar2 .tab'));
        allTabs.forEach(tab => {
            const filepath = tab.dataset.filepath;
            if (filepath !== keepFilepath) {
                this.closeTabInSplit(filepath);
            }
        });
    }

    closeAllTabsInSplit() {
        const allTabs = Array.from(document.querySelectorAll('#tabBar2 .tab'));
        allTabs.forEach(tab => {
            this.closeTabInSplit(tab.dataset.filepath);
        });
    }

    closeTabsToRightInSplit(fromFilepath) {
        const allTabs = Array.from(document.querySelectorAll('#tabBar2 .tab'));
        const fromIndex = allTabs.findIndex(tab => tab.dataset.filepath === fromFilepath);

        if (fromIndex !== -1) {
            for (let i = fromIndex + 1; i < allTabs.length; i++) {
                this.closeTabInSplit(allTabs[i].dataset.filepath);
            }
        }
    }

    closeSplitView(mergeTabsToLeft = false) {
        if (!this.splitViewActive) return;

        // Merge right tabs to left if requested
        if (mergeTabsToLeft) {
            this.rightOpenTabs.forEach((tabData, filepath) => {
                // Check if tab is not already open in left editor
                if (!this.openTabs.has(filepath)) {
                    // Create new model for left editor (don't reuse right model)
                    const newModel = monaco.editor.createModel(
                        tabData.model.getValue(),
                        tabData.model.getLanguageId(),
                        monaco.Uri.file(filepath)
                    );
                    this.openTabs.set(filepath, {
                        model: newModel,
                        saved: tabData.saved,
                        isStdlib: tabData.isStdlib
                    });
                    this.createTab(filepath);
                }
            });
        }

        // Dispose right editor
        if (this.rightEditor) {
            this.rightEditor.dispose();
            this.rightEditor = null;
        }

        // Dispose all right tab models
        this.rightOpenTabs.forEach(tabData => {
            tabData.model.dispose();
        });
        this.rightOpenTabs.clear();
        this.rightActiveFile = null;

        // Remove right group and divider
        const rightGroup = document.getElementById('editorGroup2');
        const divider = document.getElementById('splitDivider');
        const leftGroup = document.getElementById('editorGroup1');

        if (rightGroup) rightGroup.remove();
        if (divider) divider.remove();
        if (leftGroup) {
            leftGroup.classList.remove('split');
            leftGroup.style.flex = '1';
        }

        this.splitViewActive = false;
        this.focusedEditor = 'left';

        // Cleanup sync listeners
        this.cleanupAllSyncListeners();

        // Update split button icon
        this.updateSplitButtonIcon();
    }

    setupModelSync(filepath) {
        // Check if same file is open in both editors
        const leftTab = this.openTabs.get(filepath);
        const rightTab = this.rightOpenTabs.get(filepath);

        if (!leftTab || !rightTab || !this.splitViewActive) {
            return;
        }

        // Cleanup existing listeners for this file
        this.cleanupSyncListener(filepath);

        const leftModel = leftTab.model;
        const rightModel = rightTab.model;

        // Create listener for left editor changes
        const leftListener = leftModel.onDidChangeContent((e) => {
            if (this.syncInProgress) return;

            this.syncInProgress = true;

            // Apply changes to right model
            e.changes.forEach(change => {
                const range = new monaco.Range(
                    change.range.startLineNumber,
                    change.range.startColumn,
                    change.range.endLineNumber,
                    change.range.endColumn
                );
                rightModel.pushEditOperations(
                    [],
                    [{
                        range: range,
                        text: change.text
                    }],
                    () => null
                );
            });

            this.syncInProgress = false;
        });

        // Create listener for right editor changes
        const rightListener = rightModel.onDidChangeContent((e) => {
            if (this.syncInProgress) return;

            this.syncInProgress = true;

            // Apply changes to left model
            e.changes.forEach(change => {
                const range = new monaco.Range(
                    change.range.startLineNumber,
                    change.range.startColumn,
                    change.range.endLineNumber,
                    change.range.endColumn
                );
                leftModel.pushEditOperations(
                    [],
                    [{
                        range: range,
                        text: change.text
                    }],
                    () => null
                );
            });

            this.syncInProgress = false;
        });

        // Store listeners for cleanup
        this.modelChangeListeners.set(filepath, {
            leftListener,
            rightListener
        });
    }

    cleanupSyncListener(filepath) {
        const listeners = this.modelChangeListeners.get(filepath);
        if (listeners) {
            listeners.leftListener.dispose();
            listeners.rightListener.dispose();
            this.modelChangeListeners.delete(filepath);
        }
    }

    cleanupAllSyncListeners() {
        this.modelChangeListeners.forEach((listeners) => {
            listeners.leftListener.dispose();
            listeners.rightListener.dispose();
        });
        this.modelChangeListeners.clear();
    }

    toggleSplit() {
        if (this.splitViewActive) {
            // Close split view and merge all tabs to left
            this.closeSplitView(true);
        } else {
            // Create split view
            this.createSplitView();
        }
    }

    createSplitView() {
        if (this.splitViewActive) return;

        const editorArea = document.getElementById('editorArea');
        const leftGroup = document.getElementById('editorGroup1');

        // Create divider
        const divider = document.createElement('div');
        divider.className = 'split-divider';
        divider.id = 'splitDivider';

        // Create right editor group
        const rightGroup = document.createElement('div');
        rightGroup.className = 'editor-group';
        rightGroup.id = 'editorGroup2';
        rightGroup.innerHTML = `
            <div class="tab-bar" id="tabBar2"></div>
            <div class="file-path-bar" id="filePathBar2"></div>
            <div class="editor-container">
                <div id="editor2"></div>
                <button class="execute-button" id="executeButton2" style="display: none;">Run</button>
            </div>
            <div class="output-panel" id="outputPanel2" style="display: none;"></div>
        `;

        // Add to DOM
        leftGroup.classList.add('split');
        editorArea.appendChild(divider);
        editorArea.appendChild(rightGroup);

        // Initialize right editor
        this.rightEditor = monaco.editor.create(document.getElementById('editor2'), {
            value: '# Click here and open a file to edit',
            language: 'python',
            theme: 'vs-dark',
            fontSize: 14,
            lineNumbers: 'on',
            minimap: { enabled: false },
            automaticLayout: true,
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            folding: true,
            foldingStrategy: 'indentation',
            showFoldingControls: 'always',
            tabSize: 4,
            insertSpaces: true,
            autoIndent: 'full',
            formatOnPaste: true,
            formatOnType: true,
            bracketPairColorization: {
                enabled: true
            },
            // Disable Monaco's built-in go-to-definition
            gotoLocation: {
                multiple: 'goto'
            }
        });

        this.splitViewActive = true;

        // Setup Ctrl+Click for right editor
        this.rightEditor.onMouseDown((e) => {
            if (e.event.ctrlKey || e.event.metaKey) {
                e.event.preventDefault();
                e.event.stopPropagation();
                this.handleCtrlClick(e.target.position, 'right');
            }
        });

        // Setup Ctrl+hover for right editor
        this.rightEditor.onMouseMove((e) => {
            this.handleMouseMove(e, 'right');
        });

        // Clear link decorations when mouse leaves right editor
        this.rightEditor.onMouseLeave(() => {
            this.clearLinkDecorations('right');
        });

        // Setup divider resize
        this.setupSplitResize(divider, leftGroup, rightGroup);

        // Setup execute button for right editor
        const executeButton2 = document.getElementById('executeButton2');
        if (executeButton2) {
            executeButton2.addEventListener('click', () => {
                this.executeCode('right');
            });
        }

        // Setup editor focus tracking
        this.setupEditorFocusTracking();

        // Setup tab bar drop zones for cross-editor tab movement
        this.setupTabBarDropZones();

        // Update split button icon
        this.updateSplitButtonIcon();
    }

    setupTabBarDropZones() {
        const leftTabBar = document.getElementById('tabBar');
        const rightTabBar = document.getElementById('tabBar2');

        if (leftTabBar) {
            this.setupTabBarDrop(leftTabBar, 'left');
        }

        if (rightTabBar) {
            this.setupTabBarDrop(rightTabBar, 'right');
        }
    }

    setupTabBarDrop(tabBar, targetEditor) {
        tabBar.addEventListener('dragover', (e) => {
            const draggingTab = document.querySelector('.tab.dragging');
            if (draggingTab) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                tabBar.style.background = 'rgba(0, 122, 204, 0.1)';
            }
        });

        tabBar.addEventListener('dragleave', (e) => {
            if (e.target === tabBar) {
                tabBar.style.background = '';
            }
        });

        tabBar.addEventListener('drop', (e) => {
            e.preventDefault();
            tabBar.style.background = '';

            const filepath = e.dataTransfer.getData('text/plain');
            const sourceEditor = e.dataTransfer.getData('editor-group');

            if (!filepath) return;

            // Move tab between editors
            if (sourceEditor !== targetEditor) {
                this.moveTabBetweenEditors(filepath, sourceEditor, targetEditor);
            }
        });
    }

    async moveTabBetweenEditors(filepath, fromEditor, toEditor) {
        const sourceTabs = fromEditor === 'left' ? this.openTabs : this.rightOpenTabs;
        const targetTabs = toEditor === 'left' ? this.openTabs : this.rightOpenTabs;

        const tabData = sourceTabs.get(filepath);
        if (!tabData) return;

        // Create new model for target editor
        const newModel = monaco.editor.createModel(
            tabData.model.getValue(),
            tabData.model.getLanguageId(),
            monaco.Uri.file(filepath + (toEditor === 'right' ? '_split' : ''))
        );

        // Add to target editor
        targetTabs.set(filepath, {
            model: newModel,
            saved: tabData.saved,
            isStdlib: tabData.isStdlib
        });

        // Remove from source editor
        if (fromEditor === 'left') {
            this.closeTab(filepath);
        } else {
            this.closeTabInSplit(filepath);
        }

        // Create tab in target editor and switch to it
        if (toEditor === 'left') {
            this.createTab(filepath);
            this.switchToTab(filepath);
            this.focusedEditor = 'left';
        } else {
            this.createTabInSplit(filepath);
            this.switchToTabInSplit(filepath);
            this.focusedEditor = 'right';
        }

        this.updateEditorFocusVisual();
    }

    updateSplitButtonIcon() {
        const splitToggleBtn = document.getElementById('splitToggleBtn');
        if (splitToggleBtn) {
            const icon = splitToggleBtn.querySelector('i');
            if (icon) {
                if (this.splitViewActive) {
                    icon.className = 'codicon codicon-screen-normal';
                    splitToggleBtn.title = 'Close Split Editor';
                } else {
                    icon.className = 'codicon codicon-split-horizontal';
                    splitToggleBtn.title = 'Split Editor';
                }
            }
        }
    }

    setupEditorFocusTracking() {
        // Track focus on left editor
        const leftEditorContainer = document.querySelector('#editorGroup1 .editor-container');
        if (leftEditorContainer) {
            leftEditorContainer.addEventListener('click', () => {
                this.focusedEditor = 'left';
                this.updateEditorFocusVisual();
            });
        }

        // Track focus on right editor
        const rightEditorContainer = document.querySelector('#editorGroup2 .editor-container');
        if (rightEditorContainer) {
            rightEditorContainer.addEventListener('click', () => {
                this.focusedEditor = 'right';
                this.updateEditorFocusVisual();
            });
        }
    }

    updateEditorFocusVisual() {
        const leftGroup = document.getElementById('editorGroup1');
        const rightGroup = document.getElementById('editorGroup2');

        if (leftGroup && rightGroup) {
            if (this.focusedEditor === 'left') {
                leftGroup.style.opacity = '1';
                rightGroup.style.opacity = '0.7';
            } else {
                leftGroup.style.opacity = '0.7';
                rightGroup.style.opacity = '1';
            }
        }
    }


    showContextMenu(event, filePath, type) {
        this.closeContextMenu();

        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.style.left = event.pageX + 'px';
        menu.style.top = event.pageY + 'px';

        const fileName = filePath.split('/').pop();
        const isDirectory = type === 'directory';

        let menuItems = [];

        if (isDirectory) {
            menuItems = [
                { text: 'New File', action: () => this.createFileInDirectory(filePath) },
                { text: 'New Folder', action: () => this.createFolderInDirectory(filePath) },
                { separator: true },
                { text: 'Rename', action: () => this.renameItem(filePath, type) },
                { text: 'Duplicate', action: () => this.duplicateItem(filePath, type) },
                { separator: true },
                { text: 'Download as ZIP', action: () => this.downloadItem(filePath) },
                { separator: true },
                { text: 'Copy Path', action: () => this.copyToClipboard(filePath) },
                { text: 'Copy Relative Path', action: () => this.copyToClipboard(`./${filePath}`) },
                { separator: true },
                { text: 'Delete', action: () => this.deleteItem(filePath, type), class: 'destructive' }
            ];
        } else {
            menuItems = [
                { text: 'Open', action: () => this.openFile(filePath) },
                { separator: true },
                { text: 'Rename', action: () => this.renameItem(filePath, type) },
                { text: 'Duplicate', action: () => this.duplicateItem(filePath, type) },
                { separator: true },
                { text: 'Download', action: () => this.downloadItem(filePath) },
                { separator: true },
                { text: 'Copy Path', action: () => this.copyToClipboard(filePath) },
                { text: 'Copy Relative Path', action: () => this.copyToClipboard(`./${filePath}`) },
                { separator: true },
                { text: 'Delete', action: () => this.deleteItem(filePath, type), class: 'destructive' }
            ];
        }

        menuItems.forEach(item => {
            if (item.separator) {
                const separator = document.createElement('div');
                separator.className = 'context-menu-separator';
                menu.appendChild(separator);
            } else {
                const menuItem = document.createElement('div');
                menuItem.className = `context-menu-item ${item.class || ''}`;
                menuItem.textContent = item.text;
                menuItem.addEventListener('click', () => {
                    item.action();
                    this.closeContextMenu();
                });
                menu.appendChild(menuItem);
            }
        });

        document.body.appendChild(menu);

        // Close menu when clicking outside
        setTimeout(() => {
            document.addEventListener('click', this.closeContextMenu.bind(this), { once: true });
        }, 0);
    }

    showEmptySpaceContextMenu(event) {
        this.closeContextMenu();

        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.style.left = event.pageX + 'px';
        menu.style.top = event.pageY + 'px';

        const menuItems = [
            { text: 'New File', action: () => { this.selectedDirectory = ''; this.showCreateDialog('file'); } },
            { text: 'New Folder', action: () => { this.selectedDirectory = ''; this.showCreateDialog('folder'); } },
            { separator: true },
            { text: 'Refresh', action: () => this.loadFileExplorer() }
        ];

        menuItems.forEach(item => {
            if (item.separator) {
                const separator = document.createElement('div');
                separator.className = 'context-menu-separator';
                separator.style.cssText = 'height: 1px; background: #3e3e42; margin: 4px 0;';
                menu.appendChild(separator);
            } else {
                const menuItem = document.createElement('div');
                menuItem.className = 'context-menu-item';
                menuItem.textContent = item.text;
                menuItem.addEventListener('click', () => {
                    item.action();
                    this.closeContextMenu();
                });
                menu.appendChild(menuItem);
            }
        });

        document.body.appendChild(menu);

        // Close menu when clicking outside
        setTimeout(() => {
            document.addEventListener('click', this.closeContextMenu.bind(this), { once: true });
        }, 0);
    }

    async createFileInDirectory(dirPath) {
        this.selectedDirectory = dirPath;
        this.showCreateDialog('file');
    }

    async createFolderInDirectory(dirPath) {
        this.selectedDirectory = dirPath;
        this.showCreateDialog('folder');
    }

    async renameItem(filePath, type) {
        const currentName = filePath.split('/').pop();
        const parentPath = filePath.substring(0, filePath.lastIndexOf('/'));

        const dialog = document.createElement('div');
        dialog.className = 'input-dialog';
        dialog.innerHTML = `
            <div class="input-dialog-content">
                <h3>Rename ${type === 'file' ? 'File' : 'Folder'}</h3>
                <input type="text" id="renameInput" value="${currentName}" />
                <div class="input-dialog-buttons">
                    <button class="dialog-button secondary" onclick="this.closest('.input-dialog').remove()">Cancel</button>
                    <button class="dialog-button primary" id="renameBtn">Rename</button>
                </div>
            </div>
        `;

        document.body.appendChild(dialog);

        const input = dialog.querySelector('#renameInput');
        const renameBtn = dialog.querySelector('#renameBtn');

        input.focus();
        input.select();

        const rename = async () => {
            const newName = input.value.trim();
            if (!newName || newName === currentName) {
                dialog.remove();
                return;
            }

            try {
                const newPath = parentPath ? `${parentPath}/${newName}` : newName;
                await this.moveItem(filePath, newPath);
                dialog.remove();
                this.loadFileExplorer();
            } catch (error) {
                alert('Failed to rename: ' + error.message);
            }
        };

        renameBtn.addEventListener('click', rename);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') rename();
            if (e.key === 'Escape') dialog.remove();
        });
    }

    async duplicateItem(filePath, type) {
        const fileName = filePath.split('/').pop();
        const extension = fileName.includes('.') ? '.' + fileName.split('.').pop() : '';
        const baseName = fileName.replace(extension, '');
        const parentPath = filePath.substring(0, filePath.lastIndexOf('/'));

        let copyName = `${baseName}_copy${extension}`;
        let counter = 1;

        // Check if copy already exists and increment counter
        while (await this.fileExists(parentPath ? `${parentPath}/${copyName}` : copyName)) {
            copyName = `${baseName}_copy${counter}${extension}`;
            counter++;
        }

        try {
            const newPath = parentPath ? `${parentPath}/${copyName}` : copyName;
            await this.copyItem(filePath, newPath, type);
            this.loadFileExplorer();
        } catch (error) {
            alert('Failed to duplicate: ' + error.message);
        }
    }

    async deleteItem(filePath, type) {
        const fileName = filePath.split('/').pop();
        const confirmMsg = `Are you sure you want to delete "${fileName}"?`;

        if (!confirm(confirmMsg)) return;

        try {
            const response = await fetch(`/api/files/${filePath}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                throw new Error('Failed to delete item');
            }

            // Close tab if file is open
            if (type === 'file' && this.openTabs.has(filePath)) {
                this.closeTab(filePath);
            }

            // Clear selected directory if it was deleted or is a child of deleted directory
            if (this.selectedDirectory === filePath || this.selectedDirectory.startsWith(filePath + '/')) {
                this.selectedDirectory = '';
            }

            this.loadFileExplorer();
        } catch (error) {
            alert('Failed to delete: ' + error.message);
        }
    }

    async moveItem(oldPath, newPath) {
        // For now, we'll simulate move by copy + delete
        const response = await fetch(`/api/files/${oldPath}`);
        if (!response.ok) throw new Error('File not found');

        const data = await response.json();

        // Create new file
        await fetch(`/api/files/${newPath}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: data.content })
        });

        // Delete old file
        await fetch(`/api/files/${oldPath}`, { method: 'DELETE' });

        // Update selected directory if it was moved
        if (this.selectedDirectory === oldPath) {
            this.selectedDirectory = newPath;
        } else if (this.selectedDirectory.startsWith(oldPath + '/')) {
            this.selectedDirectory = this.selectedDirectory.replace(oldPath, newPath);
        }

        // Update open tabs
        if (this.openTabs.has(oldPath)) {
            const tabData = this.openTabs.get(oldPath);
            this.openTabs.delete(oldPath);
            this.openTabs.set(newPath, tabData);
            this.activeFile = newPath;

            // Update tab display
            const tab = document.querySelector(`[data-filepath="${oldPath}"]`);
            if (tab) {
                tab.setAttribute('data-filepath', newPath);
                tab.querySelector('span').textContent = newPath.split('/').pop();
            }
        }
    }

    async copyItem(sourcePath, targetPath, type) {
        if (type === 'file') {
            const response = await fetch(`/api/files/${sourcePath}`);
            if (!response.ok) throw new Error('File not found');

            const data = await response.json();

            await fetch(`/api/files/${targetPath}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: data.content })
            });
        } else {
            // For directories, we'd need server-side support
            throw new Error('Directory duplication not yet implemented');
        }
    }

    async fileExists(filePath) {
        try {
            const response = await fetch(`/api/files/${filePath}`);
            return response.ok;
        } catch {
            return false;
        }
    }

    copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            // Show brief success message
            const msg = document.createElement('div');
            msg.style.cssText = `
                position: fixed; top: 20px; right: 20px; background: #4CAF50;
                color: white; padding: 8px 16px; border-radius: 4px; z-index: 9999;
                font-size: 14px; pointer-events: none;
            `;
            msg.textContent = 'Path copied to clipboard';
            document.body.appendChild(msg);
            setTimeout(() => msg.remove(), 2000);
        }).catch(() => {
            alert('Failed to copy to clipboard');
        });
    }

    downloadItem(filePath) {
        // 다운로드 링크 생성
        const downloadUrl = `/api/download/${filePath}`;
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = ''; // 서버에서 파일명 결정
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // 성공 메시지 표시
        const msg = document.createElement('div');
        msg.style.cssText = `
            position: fixed; top: 20px; right: 20px; background: #4CAF50;
            color: white; padding: 8px 16px; border-radius: 4px; z-index: 9999;
            font-size: 14px; pointer-events: none;
        `;
        msg.textContent = 'Download started';
        document.body.appendChild(msg);
        setTimeout(() => msg.remove(), 2000);
    }
}

// Initialize the IDE when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new PythonIDE();
});

// Handle Monaco Editor worker
self.MonacoEnvironment = {
    getWorkerUrl: function (moduleId, label) {
        if (label === 'json') {
            return './monaco-editor/esm/vs/language/json/json.worker.js';
        }
        if (label === 'css' || label === 'scss' || label === 'less') {
            return './monaco-editor/esm/vs/language/css/css.worker.js';
        }
        if (label === 'html' || label === 'handlebars' || label === 'razor') {
            return './monaco-editor/esm/vs/language/html/html.worker.js';
        }
        if (label === 'typescript' || label === 'javascript') {
            return './monaco-editor/esm/vs/language/typescript/ts.worker.js';
        }
        return './monaco-editor/esm/vs/editor/editor.worker.js';
    }
};