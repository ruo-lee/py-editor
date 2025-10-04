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

        // Register document formatting provider
        monaco.languages.registerDocumentFormattingEditProvider('python', {
            provideDocumentFormattingEdits: (model) => {
                // Basic Python formatting
                const value = model.getValue();
                const lines = value.split('\\n');
                const formatted = lines.map((line) => {
                    // Basic indentation fixes
                    return line.replace(/^\\s+/, (match) => {
                        const spaces = match.length;
                        const tabs = Math.floor(spaces / 4);
                        return '    '.repeat(tabs);
                    });
                });

                return [
                    {
                        range: model.getFullModelRange(),
                        text: formatted.join('\\n'),
                    },
                ];
            },
        });
    }
}
