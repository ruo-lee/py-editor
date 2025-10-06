import * as monaco from 'monaco-editor';

/**
 * FormatManager - Manages document formatting functionality
 * Integrates with LSP Black formatter for Python code
 */
export class FormatManager {
    constructor(context) {
        this.context = context;
        this.formatBtn = document.getElementById('formatBtn');
        this.isFormatting = false;
        this.autoFormatOnSave = localStorage.getItem('auto-format-on-save') === 'true';
    }

    /**
     * Initialize format functionality
     */
    initialize() {
        // Format button event - use focused editor
        this.formatBtn?.addEventListener('click', () => {
            // Determine which editor is focused
            const editorSide = this.context.focusedEditor || 'left';
            this.formatDocument(editorSide);
        });

        // Shift+Alt+F keyboard shortcut for left editor
        if (this.context.editor) {
            this.context.editor.addAction({
                id: 'format-document',
                label: 'Format Document',
                keybindings: [monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF],
                run: () => this.formatDocument('left'),
            });
        }

        // Initialize button visibility
        this.updateVisibility(!!this.context.activeFile);
    }

    /**
     * Initialize format functionality for right editor (split view)
     */
    initializeRightEditor() {
        if (!this.context.rightEditor) return;

        // Shift+Alt+F keyboard shortcut for right editor
        this.context.rightEditor.addAction({
            id: 'format-document-right',
            label: 'Format Document',
            keybindings: [monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF],
            run: () => this.formatDocument('right'),
        });
    }

    /**
     * Format current document
     * @param {string} editorSide - 'left' or 'right' for split view support
     */
    async formatDocument(editorSide = null) {
        if (this.isFormatting) return;

        // Determine which editor to use
        let editor;
        if (editorSide === 'right' && this.context.rightEditor) {
            editor = this.context.rightEditor;
        } else if (editorSide === 'left' || !editorSide) {
            editor = this.context.editor;
        } else {
            // Fallback: use focused editor if no side specified
            editor =
                this.context.focusedEditor === 'right'
                    ? this.context.rightEditor || this.context.editor
                    : this.context.editor;
        }

        const model = editor?.getModel();
        if (!model) return;

        // Only format Python files
        const language = model.getLanguageId();
        if (language !== 'python') {
            console.log('Format is only available for Python files');
            return;
        }

        this.isFormatting = true;
        this.showFormatIndicator();

        try {
            // Use Monaco's built-in format action (which calls LSP Black formatter)
            const formatAction = editor.getAction('editor.action.formatDocument');
            if (formatAction) {
                await formatAction.run();
                this.showFormatSuccess();
            }
        } catch (error) {
            console.error('Format failed:', error);
            this.showFormatError(error);
        } finally {
            this.isFormatting = false;
            this.hideFormatIndicator();
        }
    }

    /**
     * Show formatting in progress
     */
    showFormatIndicator() {
        this.formatBtn?.classList.add('formatting');
        const icon = this.formatBtn?.querySelector('i');
        if (icon) {
            icon.className = 'codicon codicon-loading codicon-modifier-spin';
        }
    }

    /**
     * Hide formatting indicator
     */
    hideFormatIndicator() {
        this.formatBtn?.classList.remove('formatting');
        const icon = this.formatBtn?.querySelector('i');
        if (icon) {
            icon.className = 'codicon codicon-symbol-keyword';
        }
    }

    /**
     * Show format success feedback
     */
    showFormatSuccess() {
        // Visual feedback: briefly change icon
        const icon = this.formatBtn?.querySelector('i');
        if (icon) {
            icon.className = 'codicon codicon-check';
            setTimeout(() => {
                icon.className = 'codicon codicon-symbol-keyword';
            }, 1000);
        }
    }

    /**
     * Show format error feedback
     */
    showFormatError(error) {
        const icon = this.formatBtn?.querySelector('i');
        if (icon) {
            icon.className = 'codicon codicon-error';
            setTimeout(() => {
                icon.className = 'codicon codicon-symbol-keyword';
            }, 2000);
        }

        // Log error for debugging
        console.error('Format error:', error);
    }

    /**
     * Update button visibility based on active file
     */
    updateVisibility(hasActiveFile) {
        if (this.formatBtn) {
            this.formatBtn.style.display = hasActiveFile ? 'flex' : 'none';
        }
    }

    /**
     * Enable/disable auto-format on save
     */
    setAutoFormatOnSave(enabled) {
        this.autoFormatOnSave = enabled;
        localStorage.setItem('auto-format-on-save', enabled);
    }

    /**
     * Trigger format on save if enabled
     */
    async formatOnSave() {
        if (this.autoFormatOnSave && !this.isFormatting) {
            await this.formatDocument();
        }
    }
}
