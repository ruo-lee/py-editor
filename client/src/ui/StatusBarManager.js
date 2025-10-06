/**
 * StatusBarManager - Manages status bar information display
 */
export class StatusBarManager {
    constructor(ide) {
        this.ide = ide;
        this.userId = null;
        this.lspConnected = false;

        // DOM elements
        this.userIdText = document.getElementById('userIdText');
        this.userIdBadge = document.getElementById('userIdBadge');
        this.lspStatus = document.getElementById('lspStatus');
        this.lspText = document.getElementById('lspText');
        this.lspIcon = document.getElementById('lspIcon');
        this.cursorPosition = document.getElementById('cursorPosition');
        this.timeText = document.getElementById('timeText');

        this.setupEventListeners();
        this.setupLSPEventListeners();
        this.setupEditorEventListeners();
        this.startClock();
    }

    setupLSPEventListeners() {
        // Listen for userId from LSP connection
        window.addEventListener('lsp-userId', (event) => {
            this.setUserId(event.detail);
        });

        // Listen for LSP connection status from main.js
        window.addEventListener('lsp-connected', () => {
            this.setLSPStatus(true);
        });

        window.addEventListener('lsp-disconnected', () => {
            this.setLSPStatus(false);
        });
    }

    setupEditorEventListeners() {
        // Listen for cursor position changes
        window.addEventListener('editor-cursor-change', (event) => {
            this.updateCursorPosition(event.detail.line, event.detail.column);
        });
    }

    setupEventListeners() {
        // User ID click to copy
        this.userIdBadge.addEventListener('click', () => {
            if (this.userId) {
                this.copyToClipboard(this.userId);
            }
        });

        // LSP status click to reconnect
        this.lspStatus.addEventListener('click', () => {
            if (!this.lspConnected) {
                this.reconnectLSP();
            }
        });
    }

    setUserId(userId) {
        this.userId = userId;
        // Display shortened version
        const shortened =
            userId.length > 20 ? `${userId.slice(0, 10)}...${userId.slice(-7)}` : userId;
        this.userIdText.textContent = shortened;
        this.userIdBadge.title = `User ID: ${userId}\nClick to copy`;
    }

    setLSPStatus(connected) {
        this.lspConnected = connected;

        // Remove all status classes
        this.lspStatus.classList.remove('connected', 'disconnected', 'connecting');

        if (connected) {
            this.lspStatus.classList.add('connected');
            this.lspText.textContent = 'LSP: Ready';
            this.lspIcon.className = 'codicon codicon-pass-filled';
        } else {
            this.lspStatus.classList.add('disconnected');
            this.lspText.textContent = 'LSP: Disconnected';
            this.lspIcon.className = 'codicon codicon-error';
        }
    }

    setLSPConnecting() {
        this.lspStatus.classList.remove('connected', 'disconnected');
        this.lspStatus.classList.add('connecting');
        this.lspText.textContent = 'LSP: Connecting...';
        this.lspIcon.className = 'codicon codicon-sync';
    }

    updateCursorPosition(line, column) {
        this.cursorPosition.textContent = `Ln ${line}, Col ${column}`;
    }

    startClock() {
        const updateTime = () => {
            const now = new Date();
            // Korean time (UTC+9)
            const koreanTime = new Date(now.getTime() + 9 * 60 * 60 * 1000);
            const hours = String(koreanTime.getUTCHours()).padStart(2, '0');
            const minutes = String(koreanTime.getUTCMinutes()).padStart(2, '0');
            this.timeText.textContent = `${hours}:${minutes}`;
        };

        updateTime();
        setInterval(updateTime, 1000); // Update every second
    }

    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            this.showCopyNotification();
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    }

    showCopyNotification() {
        // Temporary visual feedback
        const originalText = this.userIdText.textContent;
        this.userIdText.textContent = 'Copied!';
        this.userIdBadge.style.backgroundColor = 'rgba(78, 201, 176, 0.2)';

        setTimeout(() => {
            this.userIdText.textContent = originalText;
            this.userIdBadge.style.backgroundColor = '';
        }, 1000);
    }

    reconnectLSP() {
        this.setLSPConnecting();
        // Trigger LSP reconnection
        if (this.ide.lspClientInstance) {
            this.ide.lspClientInstance.connect();
        }
    }
}
