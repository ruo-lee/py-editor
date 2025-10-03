/**
 * API Request Panel Module
 * Lightweight API testing tool integrated into PY-EDITOR
 */

export class ApiPanel {
    constructor() {
        this.domains = this.loadDomains();
        this.selectedDomain = localStorage.getItem('api-selected-domain') || '';
        this.currentRequest = {
            method: 'GET',
            url: '',
            headers: [],
            params: [],
            body: '',
        };
        this.responseEditor = null;
        this.bodyEditor = null;
    }

    loadDomains() {
        const saved = localStorage.getItem('api-domains');
        return saved ? JSON.parse(saved) : [];
    }

    saveDomains() {
        localStorage.setItem('api-domains', JSON.stringify(this.domains));
    }

    createPanel() {
        const panel = document.createElement('div');
        panel.id = 'apiPanel';
        panel.className = 'api-panel';
        panel.innerHTML = `
            <div class="api-panel-header">
                <div class="api-panel-title">API Request</div>
                <button class="api-panel-close" id="apiPanelClose" title="Close">
                    <i class="codicon codicon-close"></i>
                </button>
            </div>

            <div class="api-panel-content">
                <!-- Request Configuration -->
                <div class="api-request-section">
                    <!-- Domain Selector -->
                    <div class="api-domain-row">
                        <select class="api-domain-select" id="apiDomainSelect">
                            <option value="">No Domain</option>
                            ${this.domains.map((d) => `<option value="${d.url}" ${d.url === this.selectedDomain ? 'selected' : ''}>${d.name}</option>`).join('')}
                        </select>
                        <button class="api-domain-btn" id="apiDomainManage" title="Manage Domains">
                            <i class="codicon codicon-settings-gear"></i>
                        </button>
                    </div>

                    <!-- URL Input -->
                    <div class="api-url-row">
                        <select class="api-method-select" id="apiMethod">
                            <option value="GET">GET</option>
                            <option value="POST">POST</option>
                            <option value="PUT">PUT</option>
                            <option value="PATCH">PATCH</option>
                            <option value="DELETE">DELETE</option>
                        </select>
                        <input type="text" class="api-url-input" id="apiUrl" placeholder="/api/endpoint" />
                        <button class="api-send-btn" id="apiSend">Send</button>
                    </div>

                    <!-- Tabs -->
                    <div class="api-tabs">
                        <button class="api-tab active" data-tab="params">Params</button>
                        <button class="api-tab" data-tab="headers">Headers</button>
                        <button class="api-tab" data-tab="body">Body</button>
                    </div>

                    <!-- Tab Contents -->
                    <div class="api-tab-content">
                        <!-- Params Tab -->
                        <div class="api-tab-panel active" id="apiTabParams">
                            <div class="api-kv-list" id="apiParamsList"></div>
                            <button class="api-add-btn" id="apiAddParam">
                                <i class="codicon codicon-add"></i> Add Parameter
                            </button>
                        </div>

                        <!-- Headers Tab -->
                        <div class="api-tab-panel" id="apiTabHeaders">
                            <div class="api-kv-list" id="apiHeadersList"></div>
                            <button class="api-add-btn" id="apiAddHeader">
                                <i class="codicon codicon-add"></i> Add Header
                            </button>
                        </div>

                        <!-- Body Tab -->
                        <div class="api-tab-panel" id="apiTabBody">
                            <div class="api-body-editor" id="apiBodyEditor"></div>
                        </div>
                    </div>
                </div>

                <!-- Response Section -->
                <div class="api-response-section">
                    <div class="api-response-header">
                        <span class="api-response-title">Response</span>
                        <span class="api-response-meta" id="apiResponseMeta"></span>
                    </div>
                    <div class="api-response-editor" id="apiResponseEditor"></div>
                </div>
            </div>
        `;
        return panel;
    }

    initialize(monaco) {
        this.monaco = monaco;
        this.setupEventListeners();
        this.initializeEditors();
        this.addInitialRows();
    }

    initializeEditors() {
        // Body Editor (JSON)
        const bodyEditorEl = document.getElementById('apiBodyEditor');
        if (bodyEditorEl && this.monaco) {
            this.bodyEditor = this.monaco.editor.create(bodyEditorEl, {
                value: '{\n  \n}',
                language: 'json',
                theme: document.body.classList.contains('light-theme') ? 'vs' : 'vs-dark',
                minimap: { enabled: false },
                fontSize: 13,
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                automaticLayout: true,
            });
        }

        // Response Editor (Read-only)
        const responseEditorEl = document.getElementById('apiResponseEditor');
        if (responseEditorEl && this.monaco) {
            this.responseEditor = this.monaco.editor.create(responseEditorEl, {
                value: '',
                language: 'json',
                theme: document.body.classList.contains('light-theme') ? 'vs' : 'vs-dark',
                minimap: { enabled: false },
                fontSize: 13,
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                readOnly: true,
                automaticLayout: true,
            });
        }
    }

    setupEventListeners() {
        // Close panel
        document.getElementById('apiPanelClose').addEventListener('click', () => {
            this.hide();
        });

        // Tab switching
        document.querySelectorAll('.api-tab').forEach((tab) => {
            tab.addEventListener('click', (e) => {
                const tabName = e.target.dataset.tab;
                this.switchTab(tabName);
            });
        });

        // Add buttons
        document.getElementById('apiAddParam').addEventListener('click', () => {
            this.addKeyValueRow('params');
        });

        document.getElementById('apiAddHeader').addEventListener('click', () => {
            this.addKeyValueRow('headers');
        });

        // Send request
        document.getElementById('apiSend').addEventListener('click', () => {
            this.sendRequest();
        });

        // Domain management
        document.getElementById('apiDomainManage').addEventListener('click', () => {
            this.showDomainManagement();
        });

        document.getElementById('apiDomainSelect').addEventListener('change', (e) => {
            this.selectedDomain = e.target.value;
            localStorage.setItem('api-selected-domain', this.selectedDomain);
        });
    }

    addInitialRows() {
        this.addKeyValueRow('params');
        this.addKeyValueRow('headers');
    }

    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.api-tab').forEach((tab) => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });

        // Update tab panels
        document.querySelectorAll('.api-tab-panel').forEach((panel) => {
            panel.classList.remove('active');
        });

        const targetPanel = {
            params: 'apiTabParams',
            headers: 'apiTabHeaders',
            body: 'apiTabBody',
        }[tabName];

        document.getElementById(targetPanel).classList.add('active');
    }

    addKeyValueRow(type) {
        const container =
            type === 'params'
                ? document.getElementById('apiParamsList')
                : document.getElementById('apiHeadersList');

        const row = document.createElement('div');
        row.className = 'api-kv-row';
        row.innerHTML = `
            <input type="text" class="api-kv-key" placeholder="Key" />
            <input type="text" class="api-kv-value" placeholder="Value" />
            <button class="api-kv-delete" title="Delete">
                <i class="codicon codicon-trash"></i>
            </button>
        `;

        row.querySelector('.api-kv-delete').addEventListener('click', () => {
            row.remove();
        });

        container.appendChild(row);
    }

    collectKeyValuePairs(type) {
        const container =
            type === 'params'
                ? document.getElementById('apiParamsList')
                : document.getElementById('apiHeadersList');
        const rows = container.querySelectorAll('.api-kv-row');
        const pairs = [];

        rows.forEach((row) => {
            const key = row.querySelector('.api-kv-key').value.trim();
            const value = row.querySelector('.api-kv-value').value.trim();
            if (key) {
                pairs.push({ key, value });
            }
        });

        return pairs;
    }

    async sendRequest() {
        const method = document.getElementById('apiMethod').value;
        const urlPath = document.getElementById('apiUrl').value.trim();
        const params = this.collectKeyValuePairs('params');
        const headers = this.collectKeyValuePairs('headers');
        const body = this.bodyEditor ? this.bodyEditor.getValue() : '';

        // Build full URL
        let fullUrl = this.selectedDomain + urlPath;

        // Validate URL
        if (!fullUrl) {
            this.showError('Please enter a URL');
            return;
        }

        // Show loading
        const metaEl = document.getElementById('apiResponseMeta');
        metaEl.textContent = 'Sending...';
        metaEl.className = 'api-response-meta loading';

        const startTime = Date.now();

        try {
            const response = await fetch('/api/proxy-request', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    method,
                    url: fullUrl,
                    params,
                    headers,
                    body: body.trim() ? body : null,
                }),
            });

            const duration = Date.now() - startTime;
            const contentType = response.headers.get('content-type');

            // Handle SSE streaming
            if (contentType && contentType.includes('text/event-stream')) {
                await this.handleSSEResponse(response, duration);
                return;
            }

            // Handle regular JSON response
            const data = await response.json();

            if (data.error) {
                this.showError(data.error);
                metaEl.textContent = `Error - ${duration}ms`;
                metaEl.className = 'api-response-meta error';
            } else {
                this.showResponse(data, duration);
            }
        } catch (error) {
            const duration = Date.now() - startTime;
            this.showError(error.message);
            metaEl.textContent = `Error - ${duration}ms`;
            metaEl.className = 'api-response-meta error';
        }
    }

    async handleSSEResponse(response, duration) {
        const metaEl = document.getElementById('apiResponseMeta');
        metaEl.textContent = `Streaming... - ${duration}ms`;
        metaEl.className = 'api-response-meta streaming';

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulatedData = '';

        try {
            let reading = true;
            while (reading) {
                const { done, value } = await reader.read();
                if (done) {
                    reading = false;
                    break;
                }

                const chunk = decoder.decode(value, { stream: true });
                accumulatedData += chunk;

                // Update response editor with accumulated data
                if (this.responseEditor) {
                    this.responseEditor.setValue(accumulatedData);
                }
            }

            metaEl.textContent = `Streaming Complete - ${duration}ms`;
            metaEl.className = 'api-response-meta success';
        } catch (error) {
            this.showError(error.message);
            metaEl.textContent = `Streaming Error - ${duration}ms`;
            metaEl.className = 'api-response-meta error';
        }
    }

    showResponse(data, duration) {
        const metaEl = document.getElementById('apiResponseMeta');
        metaEl.textContent = `${data.status} ${data.statusText} - ${duration}ms`;
        metaEl.className = 'api-response-meta success';

        if (this.responseEditor) {
            const formattedBody =
                typeof data.body === 'string' ? data.body : JSON.stringify(data.body, null, 2);
            this.responseEditor.setValue(formattedBody);
        }
    }

    showError(message) {
        if (this.responseEditor) {
            this.responseEditor.setValue(`Error: ${message}`);
        }
    }

    showDomainManagement() {
        const dialog = document.createElement('div');
        dialog.className = 'api-domain-dialog';
        dialog.innerHTML = `
            <div class="api-domain-dialog-content">
                <div class="api-domain-dialog-header">
                    <h3>Manage Domains</h3>
                    <button class="api-domain-dialog-close">
                        <i class="codicon codicon-close"></i>
                    </button>
                </div>
                <div class="api-domain-dialog-body">
                    <div class="api-domain-list" id="apiDomainList"></div>
                    <div class="api-domain-add">
                        <input type="text" id="apiDomainName" placeholder="Domain Name (e.g., Production)" />
                        <input type="text" id="apiDomainUrl" placeholder="Base URL (e.g., https://api.example.com)" />
                        <button id="apiDomainAddBtn">Add Domain</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(dialog);

        // Render domain list
        this.renderDomainList();

        // Event listeners
        dialog.querySelector('.api-domain-dialog-close').addEventListener('click', () => {
            dialog.remove();
        });

        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) {
                dialog.remove();
            }
        });

        document.getElementById('apiDomainAddBtn').addEventListener('click', () => {
            const name = document.getElementById('apiDomainName').value.trim();
            const url = document.getElementById('apiDomainUrl').value.trim();

            if (name && url) {
                this.domains.push({ name, url });
                this.saveDomains();
                this.renderDomainList();
                this.updateDomainSelector();
                document.getElementById('apiDomainName').value = '';
                document.getElementById('apiDomainUrl').value = '';
            }
        });
    }

    renderDomainList() {
        const list = document.getElementById('apiDomainList');
        if (!list) return;

        list.innerHTML = this.domains
            .map(
                (domain, index) => `
            <div class="api-domain-item">
                <div class="api-domain-info">
                    <div class="api-domain-name">${domain.name}</div>
                    <div class="api-domain-url">${domain.url}</div>
                </div>
                <button class="api-domain-delete" data-index="${index}">
                    <i class="codicon codicon-trash"></i>
                </button>
            </div>
        `
            )
            .join('');

        // Delete handlers
        list.querySelectorAll('.api-domain-delete').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.currentTarget.dataset.index);
                this.domains.splice(index, 1);
                this.saveDomains();
                this.renderDomainList();
                this.updateDomainSelector();
            });
        });
    }

    updateDomainSelector() {
        const selector = document.getElementById('apiDomainSelect');
        if (!selector) return;

        selector.innerHTML = `
            <option value="">No Domain</option>
            ${this.domains.map((d) => `<option value="${d.url}" ${d.url === this.selectedDomain ? 'selected' : ''}>${d.name}</option>`).join('')}
        `;
    }

    show() {
        const panel = document.getElementById('apiPanel');
        if (panel) {
            panel.classList.add('visible');
        }
    }

    hide() {
        const panel = document.getElementById('apiPanel');
        if (panel) {
            panel.classList.remove('visible');
        }
    }

    updateTheme(theme) {
        if (this.bodyEditor) {
            this.monaco.editor.setTheme(theme);
        }
        if (this.responseEditor) {
            this.monaco.editor.setTheme(theme);
        }
    }
}
