import * as monaco from 'monaco-editor';

/**
 * LSP (Language Server Protocol) Client
 * Handles communication with Python language server via WebSocket
 */
export class LSPClient {
    constructor(snippets, getFallbackValidation) {
        this.languageClient = null;
        this.messageId = 1;
        this.pendingRequests = new Map();
        this.snippets = snippets;
        this.setupBasicValidation = getFallbackValidation;

        // Promise resolvers for async LSP requests
        this.completionResolve = null;
        this.definitionResolve = null;
        this.hoverResolve = null;
        this.referencesResolve = null;

        // Callback for when LSP is initialized
        this.onInitialized = null;
    }

    /**
     * Check if connected to language server
     */
    isConnected() {
        return this.languageClient && this.languageClient.readyState === WebSocket.OPEN;
    }

    /**
     * Initialize connection to language server
     */
    async connect() {
        try {
            const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${wsProtocol}//${window.location.host}`;

            this.languageClient = new WebSocket(wsUrl);

            this.languageClient.onopen = () => {
                this.initialize();
            };

            this.languageClient.onmessage = (event) => {
                try {
                    const response = JSON.parse(event.data);
                    this.handleResponse(response);
                } catch (error) {
                    console.error('Failed to parse LSP response:', error);
                }
            };

            this.languageClient.onerror = (error) => {
                console.error('Language server error:', error);
                this.setupBasicValidation();
            };

            this.languageClient.onclose = () => {
                this.setupBasicValidation();
            };
        } catch (error) {
            console.error('Failed to connect to language server:', error);
            this.setupBasicValidation();
        }
    }

    /**
     * Send initialize request to LSP server
     */
    initialize() {
        const initializeRequest = {
            jsonrpc: '2.0',
            id: this.messageId++,
            method: 'initialize',
            params: {
                processId: null,
                clientInfo: {
                    name: 'Python IDE',
                    version: '1.0.0',
                },
                rootUri: 'file:///app/workspace',
                capabilities: {
                    textDocument: {
                        completion: {
                            dynamicRegistration: false,
                            completionItem: {
                                snippetSupport: true,
                                documentationFormat: ['markdown', 'plaintext'],
                            },
                        },
                        definition: {
                            dynamicRegistration: false,
                            linkSupport: true,
                        },
                        hover: {
                            dynamicRegistration: false,
                            contentFormat: ['markdown', 'plaintext'],
                        },
                        synchronization: {
                            dynamicRegistration: false,
                            willSave: true,
                            didSave: true,
                        },
                    },
                },
                workspaceFolders: [
                    {
                        uri: 'file:///app/workspace',
                        name: 'workspace',
                    },
                ],
            },
        };

        this.sendRequest(initializeRequest);
    }

    /**
     * Send request to LSP server
     */
    sendRequest(request) {
        if (this.languageClient && this.languageClient.readyState === WebSocket.OPEN) {
            this.languageClient.send(JSON.stringify(request));

            if (request.id) {
                this.pendingRequests.set(request.id, request);
            }
        }
    }

    /**
     * Handle LSP server responses
     */
    handleResponse(response) {
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
                case 'textDocument/references':
                    this.handleReferencesResponse(response);
                    break;
            }
        }
    }

    /**
     * Handle initialize response from LSP server
     */
    handleInitializeResponse(response) {
        if (response.result) {
            // Send initialized notification
            this.sendRequest({
                jsonrpc: '2.0',
                method: 'initialized',
                params: {},
            });

            // Call the initialization callback to register providers
            if (this.onInitialized) {
                this.onInitialized();
            }
        }
    }

    /**
     * Register Monaco providers for LSP features
     */
    registerProviders() {
        // Enhanced autocomplete
        monaco.languages.registerCompletionItemProvider('python', {
            triggerCharacters: ['.', ' '],
            provideCompletionItems: async (model, position) => {
                return this.getCompletions(model, position);
            },
        });

        // Go-to-definition
        monaco.languages.registerDefinitionProvider('python', {
            provideDefinition: async (model, position) => {
                const filePath = this.activeFile || 'temp.py';
                const content = model.getValue();
                return this.getDefinition(filePath, content, position);
            },
        });

        // Hover information
        monaco.languages.registerHoverProvider('python', {
            provideHover: async (model, position) => {
                const filePath = this.activeFile || 'temp.py';
                const content = model.getValue();
                return this.getHover(filePath, content, position);
            },
        });
    }

    /**
     * Get completions from LSP server
     */
    async getCompletions(model, position, activeFile = 'temp.py') {
        try {
            const text = model.getValue();
            const fileUri = this.getFileUri(activeFile);

            // Notify language server of document changes
            this.sendRequest({
                jsonrpc: '2.0',
                method: 'textDocument/didChange',
                params: {
                    textDocument: {
                        uri: fileUri,
                        version: Date.now(),
                    },
                    contentChanges: [{ text }],
                },
            });

            // Request completion
            const completionRequest = {
                jsonrpc: '2.0',
                id: this.messageId++,
                method: 'textDocument/completion',
                params: {
                    textDocument: { uri: fileUri },
                    position: {
                        line: position.lineNumber - 1,
                        character: position.column - 1,
                    },
                },
            };

            return new Promise((resolve) => {
                this.completionResolve = resolve;
                this.sendRequest(completionRequest);

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

    /**
     * Get basic completions (fallback when LSP is unavailable)
     */
    getBasicCompletions() {
        const suggestions = [];

        // Add snippet suggestions
        Object.entries(this.snippets).forEach(([_key, snippet]) => {
            suggestions.push({
                label: snippet.prefix,
                kind: monaco.languages.CompletionItemKind.Snippet,
                insertText: snippet.body.join('\n'),
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: snippet.description,
                detail: 'Python Snippet',
            });
        });

        // Add basic Python keywords
        const keywords = [
            'def',
            'class',
            'if',
            'elif',
            'else',
            'for',
            'while',
            'try',
            'except',
            'finally',
            'with',
            'import',
            'from',
            'return',
            'yield',
            'pass',
            'break',
            'continue',
            'lambda',
            'and',
            'or',
            'not',
            'in',
            'is',
            'None',
            'True',
            'False',
        ];

        keywords.forEach((keyword) => {
            suggestions.push({
                label: keyword,
                kind: monaco.languages.CompletionItemKind.Keyword,
                insertText: keyword,
                detail: 'Python Keyword',
            });
        });

        return { suggestions };
    }

    /**
     * Handle completion response from LSP server
     */
    handleCompletionResponse(response) {
        if (this.completionResolve) {
            const resolve = this.completionResolve;
            this.completionResolve = null;

            if (response.result && response.result.items) {
                const suggestions = response.result.items.map((item) => ({
                    label: item.label,
                    kind: this.convertCompletionItemKind(item.kind),
                    insertText: item.insertText || item.label,
                    detail: item.detail || '',
                    documentation: item.documentation || '',
                    sortText: item.sortText,
                }));

                resolve({ suggestions });
            } else {
                resolve(this.getBasicCompletions());
            }
        }
    }

    /**
     * Convert LSP completion item kind to Monaco kind
     */
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
            15: monaco.languages.CompletionItemKind.Snippet,
        };

        return kindMap[lspKind] || monaco.languages.CompletionItemKind.Text;
    }

    /**
     * Get definition location from LSP server
     */
    async getDefinition(filePath, content, position) {
        try {
            const fileUri = this.getFileUri(filePath);

            // Ensure document is synchronized before requesting definition
            await this.ensureDocumentSynchronized(filePath, content);

            const requestId = this.messageId++;
            const definitionRequest = {
                jsonrpc: '2.0',
                id: requestId,
                method: 'textDocument/definition',
                params: {
                    textDocument: { uri: fileUri },
                    position: {
                        line: position.lineNumber - 1,
                        character: position.column - 1,
                    },
                },
            };

            return new Promise((resolve) => {
                this.definitionResolve = resolve;
                this.sendRequest(definitionRequest);

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

    /**
     * Ensure document is synchronized with LSP server
     */
    async ensureDocumentSynchronized(filePath, content) {
        // Don't synchronize stdlib files - they are read-only and not tracked by LSP
        if (this.isStdlibFile(filePath)) {
            return;
        }

        const fileUri = this.getFileUri(filePath);

        // Send didChange to ensure document is up to date
        this.sendRequest({
            jsonrpc: '2.0',
            method: 'textDocument/didChange',
            params: {
                textDocument: {
                    uri: fileUri,
                    version: Date.now(),
                },
                contentChanges: [{ text: content }],
            },
        });

        // Give LSP time to process the change
        await new Promise((resolve) => setTimeout(resolve, 100));
    }

    /**
     * Handle definition response from LSP server
     */
    handleDefinitionResponse(response) {
        if (this.definitionResolve) {
            const resolve = this.definitionResolve;
            this.definitionResolve = null;

            // Check for errors in response (e.g., pylsp plugin errors)
            if (response.error) {
                console.warn('LSP definition error:', response.error);
                resolve(null);
                return;
            }

            if (response.result) {
                // Handle both array and single object results
                const locations = Array.isArray(response.result)
                    ? response.result
                    : [response.result];

                if (locations.length > 0) {
                    const location = locations[0];

                    if (location.uri && location.range) {
                        // Handle both workspace and stdlib file URIs
                        let filePath;
                        if (location.uri.startsWith('file:///app/workspace/')) {
                            // Workspace file - remove the workspace prefix and decode URI components
                            const encodedPath = location.uri.replace('file:///app/workspace/', '');
                            // Decode each path component to handle non-ASCII filenames (e.g., Korean)
                            filePath = encodedPath
                                .split('/')
                                .map((component) => decodeURIComponent(component))
                                .join('/');
                        } else if (location.uri.startsWith('file://')) {
                            // Other file (like stdlib) - remove file:// protocol
                            filePath = location.uri.replace('file://', '');
                        } else {
                            // Already a relative path
                            filePath = location.uri;
                        }

                        const result = {
                            filePath: filePath,
                            range: {
                                startLineNumber: location.range.start.line + 1,
                                startColumn: location.range.start.character + 1,
                                endLineNumber: location.range.end.line + 1,
                                endColumn: location.range.end.character + 1,
                            },
                        };

                        resolve(result);
                        return;
                    }
                }
            }

            resolve(null);
        }
    }

    /**
     * Get hover information from LSP server
     */
    async getHover(filePath, content, position) {
        try {
            // Don't request hover for stdlib files - they are read-only and not tracked by LSP
            if (this.isStdlibFile(filePath)) {
                return null;
            }

            const fileUri = this.getFileUri(filePath);

            const hoverRequest = {
                jsonrpc: '2.0',
                id: this.messageId++,
                method: 'textDocument/hover',
                params: {
                    textDocument: { uri: fileUri },
                    position: {
                        line: position.lineNumber - 1,
                        character: position.column - 1,
                    },
                },
            };

            return new Promise((resolve) => {
                this.hoverResolve = resolve;
                this.sendRequest(hoverRequest);

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

    /**
     * Handle hover response from LSP server
     */
    handleHoverResponse(response) {
        if (this.hoverResolve) {
            const resolve = this.hoverResolve;
            this.hoverResolve = null;

            if (response.result && response.result.contents) {
                let content = '';
                if (Array.isArray(response.result.contents)) {
                    content = response.result.contents
                        .map((c) => (typeof c === 'string' ? c : c.value))
                        .join('\n\n');
                } else if (typeof response.result.contents === 'string') {
                    content = response.result.contents;
                } else if (response.result.contents.value) {
                    content = response.result.contents.value;
                }

                if (content) {
                    resolve({
                        contents: [{ value: content }],
                    });
                    return;
                }
            }

            resolve(null);
        }
    }

    /**
     * Notify LSP server when file is opened
     */
    notifyDidOpen(filePath, content, languageId = 'python') {
        // Don't notify LSP about stdlib files - they are read-only
        if (this.isStdlibFile(filePath)) {
            return;
        }

        const fileUri = this.getFileUri(filePath);

        // Track opened documents to avoid duplicate didOpen notifications
        if (!this.openedDocuments) {
            this.openedDocuments = new Set();
        }

        // Only send didOpen if not already opened
        if (this.openedDocuments.has(fileUri)) {
            return; // Already opened, skip
        }

        this.openedDocuments.add(fileUri);

        this.sendRequest({
            jsonrpc: '2.0',
            method: 'textDocument/didOpen',
            params: {
                textDocument: {
                    uri: fileUri,
                    languageId,
                    version: 1,
                    text: content,
                },
            },
        });
    }

    /**
     * Check if filepath is a stdlib file (read-only)
     */
    isStdlibFile(filepath) {
        if (!filepath) return false;

        // Remove file:// prefix if present
        const cleanPath = filepath.startsWith('file://')
            ? filepath.replace('file://', '')
            : filepath;

        // Stdlib files and site-packages are read-only
        return (
            cleanPath.startsWith('/usr/local/lib/python') ||
            cleanPath.startsWith('/usr/lib/python') ||
            cleanPath.includes('/site-packages/') ||
            cleanPath.includes('/dist-packages/')
        );
    }

    /**
     * Notify LSP server when file is changed
     */
    notifyDidChange(filePath, content) {
        // Don't notify LSP about stdlib files - they are read-only
        if (this.isStdlibFile(filePath)) {
            return;
        }

        const fileUri = this.getFileUri(filePath);

        this.sendRequest({
            jsonrpc: '2.0',
            method: 'textDocument/didChange',
            params: {
                textDocument: {
                    uri: fileUri,
                    version: Date.now(),
                },
                contentChanges: [{ text: content }],
            },
        });
    }

    /**
     * Notify LSP server when file is closed
     */
    notifyDidClose(filePath) {
        // Don't notify LSP about stdlib files - they are read-only
        if (this.isStdlibFile(filePath)) {
            return;
        }

        const fileUri = this.getFileUri(filePath);

        // Remove from opened documents tracking
        if (this.openedDocuments) {
            this.openedDocuments.delete(fileUri);
        }

        this.sendRequest({
            jsonrpc: '2.0',
            method: 'textDocument/didClose',
            params: {
                textDocument: { uri: fileUri },
            },
        });
    }

    /**
     * Get file URI for LSP requests
     * Stdlib files get their actual system paths, workspace files get /app/workspace/ prefix
     */
    getFileUri(filePath) {
        if (typeof filePath !== 'string') {
            console.warn('getFileUri received non-string filePath:', filePath);
            return 'file:///app/workspace/temp.py';
        }

        // Stdlib files: use actual system path
        if (this.isStdlibFile(filePath)) {
            return `file://${filePath}`;
        }

        // Workspace files: add /app/workspace/ prefix
        // Remove leading slash to avoid double slashes
        const normalizedPath = filePath.startsWith('/') ? filePath.slice(1) : filePath;

        // Encode path components for LSP (needed for non-ASCII characters like Korean)
        // LSP uses encoded URIs as document keys
        // IMPORTANT: Only encode once - LSP expects URI-encoded format, not double-encoded
        const encodedPath = normalizedPath
            .split('/')
            .map((component) => {
                // Check if already encoded (to avoid double encoding)
                try {
                    const decoded = decodeURIComponent(component);
                    // If decoding changes it, it's already encoded - use as is
                    if (decoded !== component) {
                        return component;
                    }
                } catch (e) {
                    // Decoding failed, probably not encoded
                }
                // Not encoded - encode it now
                return encodeURIComponent(component);
            })
            .join('/');

        return `file:///app/workspace/${encodedPath}`;
    }

    /**
     * Get completion items from LSP
     */
    async getCompletionItems(filePath, content, position) {
        return new Promise((resolve) => {
            const fileUri = this.getFileUri(filePath);

            this.completionResolve = resolve;

            const request = {
                jsonrpc: '2.0',
                id: this.messageId++,
                method: 'textDocument/completion',
                params: {
                    textDocument: { uri: fileUri },
                    position: {
                        line: position.lineNumber - 1,
                        character: position.column - 1,
                    },
                },
            };

            this.pendingRequests.set(request.id, request);
            this.sendRequest(request);

            // Timeout after 2 seconds
            setTimeout(() => {
                if (this.completionResolve === resolve) {
                    this.completionResolve = null;
                    resolve({ items: [] });
                }
            }, 2000);
        });
    }

    /**
     * Handle references response from LSP server
     */
    handleReferencesResponse(response) {
        if (this.referencesResolve) {
            const resolve = this.referencesResolve;
            this.referencesResolve = null;

            if (response.result && Array.isArray(response.result)) {
                resolve(response.result);
            } else {
                resolve(null);
            }
        }
    }

    /**
     * Get references from LSP
     */
    async getReferences(filePath, content, position, includeDeclaration = true) {
        return new Promise((resolve) => {
            const fileUri = this.getFileUri(filePath);

            this.referencesResolve = resolve;

            const request = {
                jsonrpc: '2.0',
                id: this.messageId++,
                method: 'textDocument/references',
                params: {
                    textDocument: { uri: fileUri },
                    position: {
                        line: position.lineNumber - 1,
                        character: position.column - 1,
                    },
                    context: {
                        includeDeclaration: includeDeclaration,
                    },
                },
            };

            this.pendingRequests.set(request.id, request);
            this.sendRequest(request);

            // Timeout after 2 seconds
            setTimeout(() => {
                if (this.referencesResolve === resolve) {
                    this.referencesResolve = null;
                    resolve(null);
                }
            }, 2000);
        });
    }

    /**
     * Disconnect from LSP server
     */
    disconnect() {
        if (this.languageClient) {
            this.languageClient.close();
            this.languageClient = null;
        }
    }
}
