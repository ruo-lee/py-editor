import * as monaco from 'monaco-editor';

/**
 * ValidationManager - Manages syntax validation and checking
 */
export class ValidationManager {
    constructor(context) {
        this.context = context;
    }

    setupBasicValidation() {
        // Setup validation for the main editor
        if (this.context.editor) {
            this.context.editor.onDidChangeModelContent(() => {
                const model = this.context.editor.getModel();
                if (model) {
                    const filepath = this.context.activeFile;
                    if (filepath && this.context.openTabs.has(filepath)) {
                        const tabData = this.context.openTabs.get(filepath);
                        tabData.saved = false;
                    }

                    // LSP handles syntax checking automatically
                }
            });
        }

        // Note: Document formatting is now handled by LSPProviderManager
        // which registers a provider that uses the Black formatter via LSP
    }
}
