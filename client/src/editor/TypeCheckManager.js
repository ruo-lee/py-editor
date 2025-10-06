/**
 * TypeCheckManager - Manages type checking functionality via mypy
 * Allows users to toggle type checking on/off for memory optimization
 */
export class TypeCheckManager {
    constructor(context) {
        this.context = context;
        this.typeCheckBtn = document.getElementById('typeCheckBtn');
        this.enabled = localStorage.getItem('type-check-enabled') === 'true';
    }

    /**
     * Initialize type check functionality
     */
    initialize() {
        // Set initial button state
        this.updateButtonState();

        // Toggle button event
        this.typeCheckBtn?.addEventListener('click', () => {
            this.toggle();
        });

        // Apply initial configuration to LSP if already connected
        if (this.context.lspClientInstance?.isConnected()) {
            this.notifyLSP();
        }
    }

    /**
     * Toggle type checking on/off
     */
    toggle() {
        this.enabled = !this.enabled;
        localStorage.setItem('type-check-enabled', this.enabled);

        this.updateButtonState();
        this.notifyLSP();

        // Show user feedback
        this.showToggleFeedback();

        // Re-validate current file if type checking was enabled
        if (this.enabled && this.context.activeFile) {
            setTimeout(() => {
                this.triggerTypeCheck();
            }, 500);
        }
    }

    /**
     * Update button visual state
     */
    updateButtonState() {
        if (this.typeCheckBtn) {
            if (this.enabled) {
                this.typeCheckBtn.classList.add('active');
                this.typeCheckBtn.title = 'Type Checking: ON (Click to disable)';
            } else {
                this.typeCheckBtn.classList.remove('active');
                this.typeCheckBtn.title = 'Type Checking: OFF (Click to enable)';
            }
        }
    }

    /**
     * Notify LSP server of configuration change
     */
    notifyLSP() {
        if (!this.context.lspClientInstance?.isConnected()) {
            return;
        }

        // Send workspace configuration change to LSP
        this.context.lspClientInstance.sendRequest({
            jsonrpc: '2.0',
            method: 'workspace/didChangeConfiguration',
            params: {
                settings: {
                    pylsp: {
                        plugins: {
                            pylsp_mypy: {
                                enabled: this.enabled,
                                live_mode: false, // Keep false for memory optimization
                                strict: false,
                                dmypy: false,
                            },
                        },
                    },
                },
            },
        });
    }

    /**
     * Manually trigger type check for current file
     */
    async triggerTypeCheck() {
        const model = this.context.editor?.getModel();
        if (!model || !this.enabled || !this.context.activeFile) {
            return;
        }

        // Notify LSP of document change to trigger type checking
        const content = model.getValue();
        if (this.context.lspManager) {
            await this.context.lspManager.notifyDocumentChanged(this.context.activeFile, content);
        }
    }

    /**
     * Show visual feedback when toggling
     */
    showToggleFeedback() {
        const icon = this.typeCheckBtn?.querySelector('i');
        if (!icon) return;

        // Brief animation feedback
        const originalClass = icon.className;
        icon.className = 'codicon codicon-check';

        setTimeout(() => {
            icon.className = 'codicon codicon-type-hierarchy';
        }, 300);
    }

    /**
     * Get current type checking state
     */
    isEnabled() {
        return this.enabled;
    }

    /**
     * Enable type checking programmatically
     */
    enable() {
        if (!this.enabled) {
            this.toggle();
        }
    }

    /**
     * Disable type checking programmatically
     */
    disable() {
        if (this.enabled) {
            this.toggle();
        }
    }
}
