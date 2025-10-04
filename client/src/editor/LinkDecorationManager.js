import * as monaco from 'monaco-editor';

/**
 * LinkDecorationManager - Manages Ctrl+Click link decorations
 */
export class LinkDecorationManager {
    constructor(context) {
        this.context = context;
    }

    async showLinkAtPosition(position, editorSide = 'left') {
        const editor = editorSide === 'right' ? this.context.rightEditor : this.context.editor;
        const model = editor.getModel();
        if (!model) {
            return;
        }

        const word = model.getWordAtPosition(position);
        if (!word) {
            this.clearLinkDecorations(editorSide);
            return;
        }

        // Check if definition actually exists before showing link
        const hasDefinition = await this.checkDefinitionExists(model, position, editorSide);

        if (hasDefinition) {
            const range = {
                startLineNumber: position.lineNumber,
                startColumn: word.startColumn,
                endLineNumber: position.lineNumber,
                endColumn: word.endColumn,
            };

            if (editorSide === 'right') {
                this.context.rightCurrentLinkDecorations = editor.deltaDecorations(
                    this.context.rightCurrentLinkDecorations || [],
                    [
                        {
                            range: range,
                            options: {
                                inlineClassName: 'ctrl-hover-link',
                                stickiness:
                                    monaco.editor.TrackedRangeStickiness
                                        .NeverGrowsWhenTypingAtEdges,
                            },
                        },
                    ]
                );
            } else {
                this.context.currentLinkDecorations = editor.deltaDecorations(
                    this.context.currentLinkDecorations || [],
                    [
                        {
                            range: range,
                            options: {
                                inlineClassName: 'ctrl-hover-link',
                                stickiness:
                                    monaco.editor.TrackedRangeStickiness
                                        .NeverGrowsWhenTypingAtEdges,
                            },
                        },
                    ]
                );
            }
        } else {
            this.clearLinkDecorations(editorSide);
        }
    }

    async checkDefinitionExists(model, position, editorSide) {
        try {
            // Quick check using LSP provider manager
            if (this.context.lspProviderManager) {
                const result = await this.context.lspProviderManager.checkDefinition(
                    model,
                    position,
                    editorSide
                );
                return result !== null;
            }
            return false;
        } catch (error) {
            // If check fails, don't show link
            return false;
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
        const editor = editorSide === 'right' ? this.context.rightEditor : this.context.editor;

        if (!editor) {
            return;
        }

        if (editorSide === 'right') {
            if (this.context.rightCurrentLinkDecorations) {
                this.context.rightCurrentLinkDecorations = editor.deltaDecorations(
                    this.context.rightCurrentLinkDecorations,
                    []
                );
            }
        } else {
            if (this.context.currentLinkDecorations) {
                this.context.currentLinkDecorations = editor.deltaDecorations(
                    this.context.currentLinkDecorations,
                    []
                );
            }
        }
    }
}
