import * as monaco from 'monaco-editor';
import {
    configureTypeScriptDefaults,
    registerPythonLanguage,
    getDefaultEditorOptions,
} from '../config/editorConfig.js';

/**
 * EditorInitializer - Handles Monaco editor initialization and event setup
 */
export class EditorInitializer {
    constructor(context) {
        this.context = context;
    }

    async initializeEditor() {
        // Configure Monaco Editor
        configureTypeScriptDefaults(monaco);

        // Python language configuration
        registerPythonLanguage(monaco);

        // Create editor with default options
        const editorOptions = getDefaultEditorOptions(this.context.currentTheme, true);
        this.context.editor = monaco.editor.create(
            document.getElementById('editor'),
            editorOptions
        );

        this.setupEditorEventHandlers();
        this.setupKeyboardTracking();
        this.setupContentChangeTracking();

        // Setup code completion
        this.context.setupCodeCompletion();

        // Initialize syntax checking debounce
        this.context.syntaxCheckTimeout = null;
    }

    setupEditorEventHandlers() {
        // Handle Ctrl+Click for go-to-definition manually
        this.context.editor.onMouseDown(async (e) => {
            const isModifierPressed = this.context.isMac ? e.event.metaKey : e.event.ctrlKey;

            if (isModifierPressed && e.target.position) {
                e.event.preventDefault();
                e.event.stopPropagation();

                // Get definition at cursor position
                const model = this.context.editor.getModel();
                const position = e.target.position;

                if (model && position) {
                    await this.context.lspProviderManager.handleCtrlClick(model, position, 'left');
                }
            }
        });

        // Add Ctrl+hover link styling
        this.context.editor.onMouseMove((e) => {
            this.context.handleMouseMove(e);
        });

        // Clear link decorations when mouse leaves editor
        this.context.editor.onMouseLeave(() => {
            this.context.clearLinkDecorations();
        });

        // Monaco Editor keyboard events (support Mac Cmd key)
        this.context.editor.onKeyDown((e) => {
            // Check if Ctrl (or Cmd on Mac) key is pressed
            if (this.context.isMac && (e.code === 'MetaLeft' || e.code === 'MetaRight')) {
                this.context.ctrlPressed = true;
                this.context.updateCursorStyle();
            } else if (
                !this.context.isMac &&
                (e.code === 'ControlLeft' || e.code === 'ControlRight')
            ) {
                this.context.ctrlPressed = true;
                this.context.updateCursorStyle();
            }
        });

        this.context.editor.onKeyUp((e) => {
            // Check if Ctrl (or Cmd on Mac) key is released
            if (this.context.isMac && (e.code === 'MetaLeft' || e.code === 'MetaRight')) {
                this.context.ctrlPressed = false;
                this.context.updateCursorStyle();
                this.context.clearLinkDecorations();
            } else if (
                !this.context.isMac &&
                (e.code === 'ControlLeft' || e.code === 'ControlRight')
            ) {
                this.context.ctrlPressed = false;
                this.context.updateCursorStyle();
                this.context.clearLinkDecorations();
            }
        });
    }

    setupKeyboardTracking() {
        // Track key states (support both Ctrl and Cmd)
        this.context.ctrlPressed = false;
        this.context.isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

        document.addEventListener('keydown', (e) => {
            // Check if Ctrl (or Cmd on Mac) key is pressed
            if (this.context.isMac && e.key === 'Meta') {
                this.context.ctrlPressed = true;
                this.context.updateCursorStyle();
            } else if (!this.context.isMac && e.key === 'Control') {
                this.context.ctrlPressed = true;
                this.context.updateCursorStyle();
            }
        });

        document.addEventListener('keyup', (e) => {
            // Check if Ctrl (or Cmd on Mac) key is released
            if (this.context.isMac && e.key === 'Meta') {
                this.context.ctrlPressed = false;
                this.context.updateCursorStyle();
                this.context.clearLinkDecorations();
            } else if (!this.context.isMac && e.key === 'Control') {
                this.context.ctrlPressed = false;
                this.context.updateCursorStyle();
                this.context.clearLinkDecorations();
            }
        });
    }

    setupContentChangeTracking() {
        // Auto-save on change
        this.context.editor.onDidChangeModelContent((_event) => {
            // Get the model that changed
            const model = this.context.editor.getModel();
            if (!model) return;

            // Get the file path from the model's URI
            const uri = model.uri.toString();

            // Skip stdlib files - they use stdlib:// URI scheme
            if (uri.startsWith('stdlib://')) {
                return;
            }

            let filePath = uri.replace('file://', '').replace('inmemory://', '');

            // Use activeFile as fallback if we can't get path from model
            if (!filePath && this.context.activeFile) {
                filePath = this.context.activeFile;
            }

            if (filePath) {
                this.context.saveFile(filePath);
                // Notify language server of changes
                const content = model.getValue();
                this.context.notifyDocumentChanged(filePath, content);

                // Real-time syntax checking (debounced)
                this.context.debouncedSyntaxCheck();
            }
        });
    }
}
