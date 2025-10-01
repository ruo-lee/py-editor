import * as monaco from 'monaco-editor';

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
        this.selectedDirectory = ''; // Currently selected directory for context menu operations
        this.contextMenuTarget = null; // Target element for context menu

        this.initializeEditor();
        this.initializeLanguageServer();
        this.loadSnippets();
        this.loadFileExplorer();
        this.setupEventListeners();
        this.initializeSidebarResize();
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
            }
        });

        // Add Ctrl+Click for go-to-definition
        this.editor.onMouseDown((e) => {
            if (e.event.ctrlKey || e.event.metaKey) {
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

    async getDefinition(model, position) {
        try {
            // Use the active file path for proper LSP resolution
            const filePath = this.activeFile || 'temp.py';
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

    async handleCtrlClick(position) {
        if (!position) return;

        const definition = await this.getDefinition(this.editor.getModel(), position);
        if (definition && definition.filePath) {
            console.log('Opening file:', definition.filePath);
            await this.openFile(definition.filePath);

            // Navigate to the definition position
            this.editor.setPosition({
                lineNumber: definition.range.startLineNumber,
                column: definition.range.startColumn
            });

            // Highlight the definition briefly
            this.editor.deltaDecorations([], [{
                range: definition.range,
                options: {
                    className: 'highlight-definition',
                    isWholeLine: false
                }
            }]);

            setTimeout(() => {
                this.editor.deltaDecorations([], []);
            }, 2000);
        }
    }

    handleMouseMove(e) {
        if (this.ctrlPressed && e.target) {
            // Monaco 에디터의 마우스 이벤트에서 position 추출
            const position = e.target.position;

            if (position) {
                this.showLinkAtPosition(position);
            } else {
                this.clearLinkDecorations();
            }
        } else {
            this.clearLinkDecorations();
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

    showLinkAtPosition(position) {
        const model = this.editor.getModel();
        if (!model) {
            return;
        }

        const word = model.getWordAtPosition(position);
        if (!word) {
            this.clearLinkDecorations();
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

            this.currentLinkDecorations = this.editor.deltaDecorations(
                this.currentLinkDecorations || [],
                [{
                    range: range,
                    options: {
                        inlineClassName: 'ctrl-hover-link',
                        stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
                    }
                }]
            );
        } else {
            this.clearLinkDecorations();
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

    clearLinkDecorations() {
        if (this.currentLinkDecorations) {
            this.currentLinkDecorations = this.editor.deltaDecorations(
                this.currentLinkDecorations,
                []
            );
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
            const response = await fetch('/api/files');
            const files = await response.json();
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
                    <span class="folder-toggle">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M6 4l4 4-4 4V4z"/>
                        </svg>
                    </span>
                    <span class="file-icon">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="#dcb67a" style="display: block;">
                            <path d="M1.5 3v10h13V5.5H7L5.5 3h-4zm1 1h2.8l1.5 2.5h7.2v6.5h-11V4z"/>
                        </svg>
                    </span>
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

            // 외부 파일 업로드
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

            const response = await fetch('/api/move', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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

    async handleFileUpload(files, targetPath) {
        try {
            const formData = new FormData();

            for (const file of files) {
                formData.append('files', file);
            }
            formData.append('targetPath', targetPath);

            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error('Failed to upload files');
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

        // SVG icon template
        const svgIcon = (path, color = '#c5c5c5') => {
            return `<svg width="16" height="16" viewBox="0 0 16 16" fill="${color}" style="display: block;">
                ${path}
            </svg>`;
        };

        switch (ext) {
            case 'py':
                return svgIcon('<path d="M7.5 1.5c-1.5 0-2.7.3-3.5.8-.8.5-1.2 1.2-1.2 2v2.2c0 .8.4 1.5 1.2 2 .8.5 2 .8 3.5.8s2.7-.3 3.5-.8c.8-.5 1.2-1.2 1.2-2V4.3c0-.8-.4-1.5-1.2-2-.8-.5-2-.8-3.5-.8zm0 1c1.3 0 2.4.2 3 .6.6.4.8.8.8 1.2 0 .4-.2.8-.8 1.2-.6.4-1.7.6-3 .6s-2.4-.2-3-.6c-.6-.4-.8-.8-.8-1.2 0-.4.2-.8.8-1.2.6-.4 1.7-.6 3-.6zm-3.8 5.2c.8.5 2 .8 3.8.8s3-.3 3.8-.8v1.8c0 .4-.2.8-.8 1.2-.6.4-1.7.6-3 .6s-2.4-.2-3-.6c-.6-.4-.8-.8-.8-1.2V7.7zm0 3.5c.8.5 2 .8 3.8.8s3-.3 3.8-.8v1.8c0 .4-.2.8-.8 1.2-.6.4-1.7.6-3 .6s-2.4-.2-3-.6c-.6-.4-.8-.8-.8-1.2v-1.8z"/>', '#6b9bd2');
            case 'js': case 'jsx':
                return svgIcon('<path d="M2.5 2.5h11v11h-11v-11zm1 1v9h9v-9h-9zm2 2h1v5h-1v-5zm3 0h1v3.5c0 .3-.1.5-.3.7-.2.2-.4.3-.7.3h-.5v-1h.5v-3.5z"/>', '#f0db4f');
            case 'ts': case 'tsx':
                return svgIcon('<path d="M2.5 2.5h11v11h-11v-11zm1 1v9h9v-9h-9zm2 2h4v1h-1.5v4h-1v-4h-1.5v-1zm5 0h1v5h-1v-5z"/>', '#519aba');
            case 'json':
                return svgIcon('<path d="M5 3.5h-.5c-.3 0-.5.2-.5.5v1.5c0 .3-.2.5-.5.5h-.5v1h.5c.3 0 .5.2.5.5v1.5c0 .3.2.5.5.5h.5v-1h-.5v-1.5c0-.5-.2-.9-.5-1.2.3-.3.5-.7.5-1.2v-1.5h.5v-1zm6 0h.5c.3 0 .5.2.5.5v1.5c0 .3.2.5.5.5h.5v1h-.5c-.3 0-.5.2-.5.5v1.5c0 .3-.2.5-.5.5h-.5v-1h.5v-1.5c0-.5.2-.9.5-1.2-.3-.3-.5-.7-.5-1.2v-1.5h-.5v-1z"/>', '#c5c5c5');
            case 'html': case 'htm':
                return svgIcon('<path d="M2 2.5v11h12v-11h-12zm1 1h10v9h-10v-9zm2 2v1h1v2h1v-2h1v-1h-3zm4 0v3h3v-1h-2v-.5h2v-1h-2v-.5h2v-1h-3z"/>', '#e65c5c');
            case 'css': case 'scss': case 'sass':
                return svgIcon('<path d="M2.5 2.5v11h11v-11h-11zm1 1h9v9h-9v-9zm2 2v1h4v1h-3v3h4v-1h-3v-1h3v-3h-5z"/>', '#5d8fdb');
            case 'md': case 'markdown':
                return svgIcon('<path d="M2 4.5v7h12v-7h-12zm1 1h10v5h-10v-5zm1.5 1v3l1-1.5 1 1.5v-3h1v3h1l1.5-1.5v1.5h1v-3h-7.5z"/>', '#c5c5c5');
            case 'txt':
                return svgIcon('<path d="M3.5 2.5l7 0 3 3v8h-10v-11zm1 1v9h8v-6.5h-2.5v-2.5h-5.5zm5.5 0v2h2l-2-2zm-4 3h5v1h-5v-1zm0 2h5v1h-5v-1z"/>', '#c5c5c5');
            case 'yml': case 'yaml': case 'config': case 'conf':
                return svgIcon('<path d="M2 2.5v11h12v-11h-12zm1 1h10v9h-10v-9zm2 1v1h1v-1h-1zm2 0v1h4v-1h-4zm-2 2v1h1v-1h-1zm2 0v1h4v-1h-4zm-2 2v1h1v-1h-1zm2 0v1h4v-1h-4z"/>', '#e65c5c');
            case 'xml':
                return svgIcon('<path d="M3 3v10h10v-10h-10zm1 1h8v8h-8v-8zm1 2l1.5 2-1.5 2h1l1-1.3 1 1.3h1l-1.5-2 1.5-2h-1l-1 1.3-1-1.3h-1z"/>', '#c5c5c5');
            case 'csv':
                return svgIcon('<path d="M3.5 2.5l7 0 3 3v8h-10v-11zm1 1v9h8v-6.5h-2.5v-2.5h-5.5zm5.5 0v2h2l-2-2zm-4 3v4h5v-4h-5zm1 1h1v2h-1v-2zm2 0h1v2h-1v-2z"/>', '#4db380');
            case 'log':
                return svgIcon('<path d="M3.5 2.5v11h9v-11h-9zm1 1h7v9h-7v-9zm1 2v1h5v-1h-5zm0 2v1h4v-1h-4zm0 2v1h5v-1h-5z"/>', '#c5c5c5');
            case 'sql':
                return svgIcon('<path d="M8 3c-2.2 0-4 .7-4 1.5v7c0 .8 1.8 1.5 4 1.5s4-.7 4-1.5v-7c0-.8-1.8-1.5-4-1.5zm0 1c1.7 0 3 .4 3 .5s-1.3.5-3 .5-3-.4-3-.5 1.3-.5 3-.5zm-3 2.2c.8.5 1.8.8 3 .8s2.2-.3 3-.8v1.3c0 .1-1.3.5-3 .5s-3-.4-3-.5v-1.3zm0 2.5c.8.5 1.8.8 3 .8s2.2-.3 3-.8v1.3c0 .1-1.3.5-3 .5s-3-.4-3-.5v-1.3z"/>', '#c5c5c5');
            case 'sh': case 'bash':
                return svgIcon('<path d="M2 4v8h12v-8h-12zm1 1h10v6h-10v-6zm1.5 1.5v1h1v-1h-1zm2 0v1h4v-1h-4zm-2 2v1h3v-1h-3zm4 0v1h2v-1h-2z"/>', '#6bc267');
            case 'php':
                return svgIcon('<path d="M2 5v6h12v-6h-12zm1 1h10v4h-10v-4zm1 1v2h1.5c.3 0 .5-.2.5-.5v-1c0-.3-.2-.5-.5-.5h-1.5zm3 0v2h1v-1.5h.5v1.5h1v-2h-2.5zm3 0v2h1.5c.3 0 .5-.2.5-.5v-1c0-.3-.2-.5-.5-.5h-1.5zm-5 .5h.5v1h-.5v-1zm5 0h.5v1h-.5v-1z"/>', '#9b7cc4');
            case 'java':
                return svgIcon('<path d="M6 3c-.5 1-.5 2-.5 2s1 1 2.5 1 2.5-1 2.5-1-.1-1-.5-2c-.3.5-1 1-2 1s-1.7-.5-2-1zm-1 4c0 1 .5 2 1.5 2.5-.5.5-.5 1-.5 1s1 .5 2 .5 2-.5 2-.5-.1-.5-.5-1c1-.5 1.5-1.5 1.5-2.5 0 0-1 1-3 1s-3-1-3-1zm1 4.5s0 1 2 1.5c2-.5 2-1.5 2-1.5s-1 .5-2 .5-2-.5-2-.5z"/>', '#5d9bd6');
            case 'c': case 'cpp': case 'h':
                return svgIcon('<path d="M8 3c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm0 1c2.2 0 4 1.8 4 4s-1.8 4-4 4-4-1.8-4-4 1.8-4 4-4zm-1.5 2v1.5h-1v1h1v1.5h1v-1.5h1v-1h-1v-1.5h-1z"/>', '#5d9bd6');
            case 'go':
                return svgIcon('<path d="M3 6c-.5 0-1 .5-1 1v2c0 .5.5 1 1 1h2c.5 0 1-.5 1-1v-2c0-.5-.5-1-1-1h-2zm5 0v1h5v-1h-5zm-5 1h2v2h-2v-2zm5 1v1h3v-1h-3z"/>', '#5dc9e2');
            case 'rs':
                return svgIcon('<path d="M8 3l-5 2.5v5l5 2.5 5-2.5v-5l-5-2.5zm0 1.5l3.5 1.8v3.4l-3.5 1.8-3.5-1.8v-3.4l3.5-1.8z"/>', '#e6b8a2');
            case 'swift':
                return svgIcon('<path d="M3 4c-.5 0-1 .5-1 1v6c0 .5.5 1 1 1h10c.5 0 1-.5 1-1v-6c0-.5-.5-1-1-1h-10zm0 1h10v6h-10v-6zm2 1.5c-.3.3-.5.7-.5 1.5 0 1.1.9 2 2 2 .4 0 .8-.1 1-.3.3.2.7.3 1 .3 1.1 0 2-.9 2-2s-.9-2-2-2c-.3 0-.7.1-1 .3-.2-.2-.6-.3-1-.3-.8 0-1.2.2-1.5.5z"/>', '#f27b5b');
            case 'kt': case 'kts':
                return svgIcon('<path d="M3 3v10h10v-10h-10zm1 1h8l-4 4-4 4v-8zm0 8l4-4 4 4h-8z"/>', '#a87dff');
            case 'rb':
                return svgIcon('<path d="M8 2l-6 3v6l6 3 6-3v-6l-6-3zm0 1.5l4.5 2.2v4.6l-4.5 2.2-4.5-2.2v-4.6l4.5-2.2z"/>', '#e65c5c');
            case 'env':
                return svgIcon('<path d="M8 3c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm0 1c2.2 0 4 1.8 4 4s-1.8 4-4 4-4-1.8-4-4 1.8-4 4-4zm-1 2v1h-1v2h1v1h2v-1h1v-2h-1v-1h-2zm1 1v2h-1v-2h1z"/>', '#ffd966');
            case 'dockerfile':
                return svgIcon('<path d="M2 6v6h12v-6h-12zm1 1h2v1h-2v-1zm3 0h2v1h-2v-1zm3 0h2v1h-2v-1zm3 0h2v1h-2v-1zm-9 2h2v1h-2v-1zm3 0h2v1h-2v-1zm3 0h2v1h-2v-1zm3 0h2v1h-2v-1z"/>', '#4db3e8');
            case 'gitignore':
                return svgIcon('<path d="M3 3v10h10v-10h-10zm1 1h8v8h-8v-8zm2 2v1h4v-1h-4zm0 2v1h3v-1h-3z"/>', '#c5c5c5');
            case 'lock':
                return svgIcon('<path d="M8 2c-1.1 0-2 .9-2 2v2h-1v6h6v-6h-1v-2c0-1.1-.9-2-2-2zm0 1c.6 0 1 .4 1 1v2h-2v-2c0-.6.4-1 1-1zm-2 4h4v4h-4v-4zm2 1v2h1v-2h-1z"/>', '#c5c5c5');
            case 'zip': case 'tar': case 'gz':
                return svgIcon('<path d="M6 2v1h1v1h-1v1h1v1h-1v1h1v1h-1v1h1v1h-1v2c0 .5.5 1 1 1h4c.5 0 1-.5 1-1v-8l-3-3h-3zm1 1h2v1h-2v-1zm3 0v2h2l-2-2zm-3 2h2v1h-2v-1zm0 2h2v1h-2v-1zm-1 2h6v2h-6v-2z"/>', '#c5c5c5');
            case 'png': case 'jpg': case 'jpeg': case 'gif': case 'svg':
                return svgIcon('<path d="M2 3v10h12v-10h-12zm1 1h10v8h-10v-8zm1 1v6l2-2 1 1 2-2 2 2v-5h-7zm1.5 1c.3 0 .5.2.5.5s-.2.5-.5.5-.5-.2-.5-.5.2-.5.5-.5z"/>', '#c58ae0');
            case 'pdf':
                return svgIcon('<path d="M3.5 2.5l7 0 3 3v8h-10v-11zm1 1v9h8v-6.5h-2.5v-2.5h-5.5zm5.5 0v2h2l-2-2zm-4 3.5c.3 0 .5.2.5.5s-.2.5-.5.5h-.5v1h-.5v-2.5h1zm2 0v2.5h-.5v-1h-.5v1h-.5v-2.5h1.5zm2 0c.3 0 .5.2.5.5v1.5c0 .3-.2.5-.5.5h-1v-2.5h1zm-3.5.5v.5h.5v-.5h-.5zm2 0v1.5h.5v-1.5h-.5z"/>', '#f46060');
            default:
                return svgIcon('<path d="M3.5 2.5l7 0 3 3v8h-10v-11zm1 1v9h8v-6.5h-2.5v-2.5h-5.5zm5.5 0v2h2l-2-2zm-4.5 3h5v1h-5v-1zm0 2h5v1h-5v-1z"/>', '#c5c5c5');
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
            if (this.openTabs.has(filepath)) {
                this.switchToTab(filepath);
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
                response = await fetch(`/api/files/${filepath}`);

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
            <span>${filename}${isStdlib ? ' (read-only)' : ''}</span>
            <span class="tab-close">×</span>
        `;

        if (isStdlib) {
            tab.classList.add('stdlib-tab');
        }

        tab.addEventListener('click', (e) => {
            if (e.target.classList.contains('tab-close')) {
                this.closeTab(filepath);
            } else {
                this.switchToTab(filepath);
            }
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
        }
    }

    closeTab(filepath) {
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
            await fetch(`/api/files/${filepath}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ content })
            });

            tabData.saved = true;
        } catch (error) {
            console.error('Failed to save file:', error);
        }
    }

    async executeCode() {
        if (!this.activeFile || !this.activeFile.endsWith('.py')) return;

        const tabData = this.openTabs.get(this.activeFile);
        if (!tabData) return;

        const code = tabData.model.getValue();
        const filename = this.activeFile.split('/').pop();

        try {
            this.outputPanel.style.display = 'block';
            this.outputPanel.className = 'output-panel';
            this.outputPanel.textContent = 'Executing...';

            const response = await fetch('/api/execute', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ code, filename })
            });

            const result = await response.json();

            if (result.success) {
                this.outputPanel.textContent = result.output || 'Code executed successfully (no output)';
            } else {
                this.outputPanel.className = 'output-panel error';
                this.outputPanel.textContent = result.error || 'Execution failed';
            }
        } catch (error) {
            this.outputPanel.className = 'output-panel error';
            this.outputPanel.textContent = 'Failed to execute code: ' + error.message;
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
            this.executeCode();
        });

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

        const response = await fetch(`/api/files/${filename}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ content })
        });

        if (!response.ok) {
            throw new Error('Failed to create file');
        }
    }

    async createFolder(foldername) {
        // Create folder using mkdir API
        const response = await fetch('/api/mkdir', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
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