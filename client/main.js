import * as monaco from 'monaco-editor';

class PythonIDE {
    constructor() {
        this.editor = null;
        this.openTabs = new Map();
        this.activeFile = null;
        this.fileExplorer = document.getElementById('fileExplorer');
        this.tabBar = document.getElementById('tabBar');
        this.executeButton = document.getElementById('executeButton');
        this.outputPanel = document.getElementById('outputPanel');
        this.languageClient = null;
        this.snippets = {};
        this.ctrlPressed = false;
        this.currentLinkDecorations = [];

        this.initializeEditor();
        this.initializeLanguageServer();
        this.loadSnippets();
        this.loadFileExplorer();
        this.setupEventListeners();
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

        // Track key states
        this.ctrlPressed = false;
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                this.ctrlPressed = true;
                this.updateCursorStyle();
            }
        });

        document.addEventListener('keyup', (e) => {
            if (!e.ctrlKey && !e.metaKey) {
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
                console.log('Language server connected');
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
                console.log('Language server disconnected');
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
        console.log('Received LSP response:', {
            id: response.id,
            method: response.method,
            hasResult: !!response.result,
            hasError: !!response.error
        });

        if (response.id && this.pendingRequests.has(response.id)) {
            const request = this.pendingRequests.get(response.id);
            this.pendingRequests.delete(response.id);

            console.log('Processing response for method:', request.method);

            switch (request.method) {
                case 'initialize':
                    this.handleInitializeResponse(response);
                    break;
                case 'textDocument/completion':
                    this.handleCompletionResponse(response);
                    break;
                case 'textDocument/definition':
                    console.log('Definition response:', response);
                    this.handleDefinitionResponse(response);
                    break;
                case 'textDocument/hover':
                    this.handleHoverResponse(response);
                    break;
            }
        } else {
            console.log('No pending request for response ID:', response.id);
        }
    }

    handleInitializeResponse(response) {
        if (response.result) {
            console.log('Language server initialized');

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
            const fileUri = `file:///app/workspace/${filePath}`;

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
            const fileUri = `file:///app/workspace/${filePath}`;

            console.log('Requesting definition at:', {
                file: filePath,
                uri: fileUri,
                position: {
                    line: position.lineNumber - 1,
                    character: position.column - 1
                }
            });

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

            console.log('Sending definition request:', definitionRequest);

            return new Promise((resolve) => {
                this.definitionResolve = resolve;
                this.sendLSPRequest(definitionRequest);

                setTimeout(() => {
                    if (this.definitionResolve === resolve) {
                        console.log('Definition request timed out');
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
        const fileUri = `file:///app/workspace/${filePath}`;

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
        console.log('handleDefinitionResponse called with:', response);

        if (this.definitionResolve) {
            const resolve = this.definitionResolve;
            this.definitionResolve = null;

            if (response.result) {
                console.log('Definition result:', response.result);

                // Handle both array and single object results
                const locations = Array.isArray(response.result) ? response.result : [response.result];

                if (locations.length > 0) {
                    const location = locations[0];
                    console.log('First location:', location);

                    if (location.uri && location.range) {
                        const uri = location.uri.replace('file:///app/workspace/', '');
                        console.log('Resolved URI:', uri);

                        resolve({
                            uri: monaco.Uri.file(uri),
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

            console.log('No valid definition found, resolving null');
            resolve(null);
        } else {
            console.log('No definition resolve callback found');
        }
    }

    async getHover(model, position) {
        try {
            // Use the active file path for proper LSP resolution
            const filePath = this.activeFile || 'temp.py';
            const fileUri = `file:///app/workspace/${filePath}`;

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
        if (definition) {
            const filePath = definition.uri.path;
            await this.openFile(filePath);

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
        if (this.ctrlPressed && e.target.position) {
            this.showLinkAtPosition(e.target.position);
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
        if (!model) return;

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
                        className: 'ctrl-hover-link',
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
            this.sendLSPRequest({
                jsonrpc: '2.0',
                method: 'textDocument/didOpen',
                params: {
                    textDocument: {
                        uri: `file:///app/workspace/${filepath}`,
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
            this.sendLSPRequest({
                jsonrpc: '2.0',
                method: 'textDocument/didChange',
                params: {
                    textDocument: {
                        uri: `file:///app/workspace/${filepath}`,
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
        } catch (error) {
            this.fileExplorer.innerHTML = '<div class="error">Failed to load files</div>';
        }
    }

    renderFileExplorer(files, container = this.fileExplorer, level = 0) {
        if (level === 0) {
            container.innerHTML = '';
        }

        files.forEach(item => {
            const element = document.createElement('div');

            if (item.type === 'directory') {
                element.className = 'file-item folder-item';
                element.innerHTML = `
                    <span class="folder-toggle">▶</span>
                    <span class="file-icon">📁</span>
                    <span>${item.name}</span>
                `;

                const content = document.createElement('div');
                content.className = 'folder-content';
                content.style.display = 'none';

                element.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const toggle = element.querySelector('.folder-toggle');
                    if (content.style.display === 'none') {
                        content.style.display = 'block';
                        toggle.textContent = '▼';
                        if (content.children.length === 0) {
                            this.renderFileExplorer(item.children, content, level + 1);
                        }
                    } else {
                        content.style.display = 'none';
                        toggle.textContent = '▶';
                    }
                });

                container.appendChild(element);
                container.appendChild(content);
            } else {
                element.className = 'file-item';
                element.innerHTML = `
                    <span class="file-icon">${this.getFileIcon(item.name)}</span>
                    <span>${item.name}</span>
                `;

                element.addEventListener('click', () => {
                    this.openFile(item.path);
                });

                container.appendChild(element);
            }
        });
    }

    getFileIcon(filename) {
        const ext = filename.split('.').pop()?.toLowerCase();
        switch (ext) {
            case 'py': return '🐍';
            case 'json': return '📄';
            case 'txt': return '📝';
            case 'md': return '📖';
            default: return '📄';
        }
    }

    async openFile(filepath) {
        try {
            if (this.openTabs.has(filepath)) {
                this.switchToTab(filepath);
                return;
            }

            const response = await fetch(`/api/files/${filepath}`);
            const data = await response.json();

            const model = monaco.editor.createModel(
                data.content,
                this.getLanguageFromFile(filepath),
                monaco.Uri.file(filepath)
            );

            this.openTabs.set(filepath, {
                model,
                saved: true
            });

            // Notify language server of opened document
            this.notifyDocumentOpened(filepath, data.content);

            this.createTab(filepath);
            this.switchToTab(filepath);

        } catch (error) {
            console.error('Failed to open file:', error);
        }
    }

    getLanguageFromFile(filepath) {
        const ext = filepath.split('.').pop()?.toLowerCase();
        switch (ext) {
            case 'py': return 'python';
            case 'js': return 'javascript';
            case 'json': return 'json';
            case 'html': return 'html';
            case 'css': return 'css';
            default: return 'plaintext';
        }
    }

    createTab(filepath) {
        const filename = filepath.split('/').pop();
        const tab = document.createElement('div');
        tab.className = 'tab';
        tab.dataset.filepath = filepath;
        tab.innerHTML = `
            <span>${filename}</span>
            <span class="tab-close">×</span>
        `;

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

            // Show execute button for Python files
            const isPython = filepath.endsWith('.py');
            this.executeButton.style.display = isPython ? 'block' : 'none';
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
            this.showCreateDialog('file');
        });

        document.getElementById('newFolderBtn').addEventListener('click', () => {
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
    }

    showCreateDialog(type) {
        this.closeDialog();

        const dialog = document.createElement('div');
        dialog.className = 'input-dialog';
        dialog.innerHTML = `
            <div class="input-dialog-content">
                <h3>Create New ${type === 'file' ? 'File' : 'Folder'}</h3>
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
                if (type === 'file') {
                    await this.createFile(name);
                } else {
                    await this.createFolder(name);
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
        // Create a temporary file in the folder to ensure it exists
        const response = await fetch(`/api/files/${foldername}/.gitkeep`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ content: '' })
        });

        if (!response.ok) {
            throw new Error('Failed to create folder');
        }
    }

    closeDialog() {
        const dialogs = document.querySelectorAll('.input-dialog');
        dialogs.forEach(dialog => dialog.remove());
    }

    closeContextMenu() {
        const menus = document.querySelectorAll('.context-menu');
        menus.forEach(menu => menu.remove());
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