import * as monaco from 'monaco-editor';

/**
 * EditorManager - Monaco Editor instance management
 * Handles editor creation, model management, and editor-specific features
 */
export class EditorManager {
    constructor(containerElement, theme = 'vs-dark') {
        this.container = containerElement;
        this.editor = null;
        this.currentTheme = theme;
        this.modelChangeListeners = new Map();
    }

    /**
     * Create Monaco Editor instance
     */
    createEditor(initialContent = '', language = 'python') {
        this.editor = monaco.editor.create(this.container, {
            value: initialContent,
            language: language,
            theme: this.currentTheme,
            automaticLayout: true,
            minimap: { enabled: true },
            scrollBeyondLastLine: false,
            fontSize: 14,
            lineNumbers: 'on',
            renderWhitespace: 'selection',
            tabSize: 4,
            insertSpaces: true,
        });

        return this.editor;
    }

    /**
     * Get or create model for file
     */
    getOrCreateModel(filePath, content, language = 'python') {
        const uri = monaco.Uri.file(filePath);
        let model = monaco.editor.getModel(uri);

        if (!model) {
            model = monaco.editor.createModel(content, language, uri);
        }

        return model;
    }

    /**
     * Set model to editor
     */
    setModel(model) {
        if (this.editor) {
            this.editor.setModel(model);
        }
    }

    /**
     * Get current model
     */
    getModel() {
        return this.editor ? this.editor.getModel() : null;
    }

    /**
     * Get editor instance
     */
    getEditor() {
        return this.editor;
    }

    /**
     * Set editor content
     */
    setValue(content) {
        if (this.editor) {
            this.editor.setValue(content);
        }
    }

    /**
     * Get editor content
     */
    getValue() {
        return this.editor ? this.editor.getValue() : '';
    }

    /**
     * Focus editor
     */
    focus() {
        if (this.editor) {
            this.editor.focus();
        }
    }

    /**
     * Set theme
     */
    setTheme(theme) {
        this.currentTheme = theme;
        if (this.editor) {
            monaco.editor.setTheme(theme);
        }
    }

    /**
     * Get current theme
     */
    getTheme() {
        return this.currentTheme;
    }

    /**
     * Add change listener to model
     */
    onDidChangeModelContent(callback) {
        if (this.editor) {
            const model = this.editor.getModel();
            if (model) {
                const listener = model.onDidChangeContent(callback);
                this.modelChangeListeners.set(model.uri.toString(), listener);
                return listener;
            }
        }
        return null;
    }

    /**
     * Remove change listener
     */
    removeChangeListener(modelUri) {
        const listener = this.modelChangeListeners.get(modelUri);
        if (listener) {
            listener.dispose();
            this.modelChangeListeners.delete(modelUri);
        }
    }

    /**
     * Set editor position
     */
    setPosition(position) {
        if (this.editor) {
            this.editor.setPosition(position);
            this.editor.revealPositionInCenter(position);
        }
    }

    /**
     * Get editor position
     */
    getPosition() {
        return this.editor ? this.editor.getPosition() : null;
    }

    /**
     * Set editor selection
     */
    setSelection(selection) {
        if (this.editor) {
            this.editor.setSelection(selection);
            this.editor.revealRangeInCenter(selection);
        }
    }

    /**
     * Layout editor (useful when container size changes)
     */
    layout() {
        if (this.editor) {
            this.editor.layout();
        }
    }

    /**
     * Dispose editor and clean up
     */
    dispose() {
        // Dispose all change listeners
        this.modelChangeListeners.forEach((listener) => listener.dispose());
        this.modelChangeListeners.clear();

        // Dispose editor
        if (this.editor) {
            this.editor.dispose();
            this.editor = null;
        }
    }

    /**
     * Add action to editor
     */
    addAction(actionDescriptor) {
        if (this.editor) {
            return this.editor.addAction(actionDescriptor);
        }
        return null;
    }

    /**
     * Add command to editor
     */
    addCommand(keybinding, handler) {
        if (this.editor) {
            return this.editor.addCommand(keybinding, handler);
        }
        return null;
    }

    /**
     * Delta decorations (for highlighting, etc.)
     */
    deltaDecorations(oldDecorations, newDecorations) {
        if (this.editor) {
            return this.editor.deltaDecorations(oldDecorations, newDecorations);
        }
        return [];
    }

    /**
     * Reveal line in center
     */
    revealLineInCenter(lineNumber) {
        if (this.editor) {
            this.editor.revealLineInCenter(lineNumber);
        }
    }

    /**
     * Get line content
     */
    getLineContent(lineNumber) {
        const model = this.getModel();
        if (model) {
            return model.getLineContent(lineNumber);
        }
        return '';
    }

    /**
     * Get word at position
     */
    getWordAtPosition(position) {
        const model = this.getModel();
        if (model) {
            return model.getWordAtPosition(position);
        }
        return null;
    }

    /**
     * On mouse down
     */
    onMouseDown(listener) {
        if (this.editor) {
            return this.editor.onMouseDown(listener);
        }
        return null;
    }

    /**
     * On mouse move
     */
    onMouseMove(listener) {
        if (this.editor) {
            return this.editor.onMouseMove(listener);
        }
        return null;
    }

    /**
     * On key down
     */
    onKeyDown(listener) {
        if (this.editor) {
            return this.editor.onKeyDown(listener);
        }
        return null;
    }

    /**
     * On key up
     */
    onKeyUp(listener) {
        if (this.editor) {
            return this.editor.onKeyUp(listener);
        }
        return null;
    }

    /**
     * On did focus editor
     */
    onDidFocusEditorText(listener) {
        if (this.editor) {
            return this.editor.onDidFocusEditorText(listener);
        }
        return null;
    }

    /**
     * On did blur editor
     */
    onDidBlurEditorText(listener) {
        if (this.editor) {
            return this.editor.onDidBlurEditorText(listener);
        }
        return null;
    }
}
