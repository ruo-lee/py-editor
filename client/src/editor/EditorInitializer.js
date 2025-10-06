import * as monaco from 'monaco-editor';
import {
    configureTypeScriptDefaults,
    registerPythonLanguage,
    getDefaultEditorOptions,
    WELCOME_HTML,
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
        const editorOptions = getDefaultEditorOptions(this.context.currentTheme, false);
        this.context.editor = monaco.editor.create(
            document.getElementById('editor'),
            editorOptions
        );

        // Show welcome page
        this.showWelcomePage();

        this.setupEditorEventHandlers();
        this.setupKeyboardTracking();
        this.setupContentChangeTracking();

        // Setup code completion
        this.context.setupCodeCompletion();

        // Initialize syntax checking debounce
        this.context.syntaxCheckTimeout = null;

        // Setup cursor position tracking for status bar
        this.setupCursorPositionTracking();

        // Fix Find widget aria-hidden issue
        this.setupFindWidgetFix();
    }

    setupFindWidgetFix() {
        // Use MutationObserver to detect Find widget visibility
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                const target = mutation.target;

                // Detect when Find widget becomes visible
                if (target.classList && target.classList.contains('find-widget')) {
                    const isVisible = target.classList.contains('visible');

                    if (isVisible) {
                        // Force release Ctrl key state when Find opens
                        this.context.ctrlPressed = false;
                        this.context.updateCursorStyle();
                        this.context.clearLinkDecorations();

                        // Prevent editor from stealing focus
                        setTimeout(() => {
                            const findInput = target.querySelector('.input, textarea');
                            if (findInput) {
                                findInput.focus();
                            }
                        }, 50);
                    }

                    // Remove aria-hidden to prevent accessibility issues
                    if (target.getAttribute('aria-hidden') === 'true') {
                        target.removeAttribute('aria-hidden');
                    }
                }
            });
        });

        // Observe the editor container for Find widget
        const editorContainer = document.querySelector('.editor-container');
        if (editorContainer) {
            observer.observe(editorContainer, {
                attributes: true,
                attributeFilter: ['class', 'aria-hidden'],
                subtree: true,
            });
        }

        // Also listen for Ctrl+F keydown to immediately release Ctrl state
        this.context.editor.onKeyDown((e) => {
            // Detect Ctrl+F or Cmd+F
            const isFind = (this.context.isMac ? e.metaKey : e.ctrlKey) && e.code === 'KeyF';
            if (isFind) {
                // Immediately release Ctrl state
                setTimeout(() => {
                    this.context.ctrlPressed = false;
                    this.context.updateCursorStyle();
                    this.context.clearLinkDecorations();
                }, 10);
            }
        });
    }

    showWelcomePage() {
        const editorContainer = document.getElementById('editor');
        if (editorContainer) {
            // Hide Monaco editor
            this.context.editor.getDomNode().style.display = 'none';

            // Create welcome page element
            const welcomePage = document.createElement('div');
            welcomePage.id = 'welcomePage';
            welcomePage.innerHTML = WELCOME_HTML;
            editorContainer.parentElement.appendChild(welcomePage);

            // Setup welcome page event listeners
            this.setupWelcomePageEvents();
        }
    }

    hideWelcomePage() {
        const welcomePage = document.getElementById('welcomePage');
        if (welcomePage) {
            welcomePage.remove();
        }
        // Show Monaco editor (only if editor exists)
        if (this.context.editor && this.context.editor.getDomNode()) {
            this.context.editor.getDomNode().style.display = 'block';
        }
    }

    setupWelcomePageEvents() {
        // New File button
        const newFileBtn = document.getElementById('welcomeNewFile');
        if (newFileBtn) {
            newFileBtn.addEventListener('click', () => {
                const newFileBtn = document.getElementById('newFileBtn');
                if (newFileBtn) {
                    newFileBtn.click();
                }
            });
        }

        // API Request button
        const apiRequestBtn = document.getElementById('welcomeApiRequest');
        if (apiRequestBtn) {
            apiRequestBtn.addEventListener('click', () => {
                const apiToggleBtn = document.getElementById('apiToggleBtn');
                if (apiToggleBtn) {
                    apiToggleBtn.click();
                }
            });
        }
    }

    setupEditorEventHandlers() {
        // Handle Ctrl+Click for go-to-definition manually
        this.context.editor.onMouseDown(async (e) => {
            // Ignore if clicking on Monaco widgets (Find, Replace, etc.)
            if (this.isMonacoWidgetTarget(e.event.target)) {
                return;
            }

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
            // Ignore if Find widget or any Monaco widget is focused
            if (this.isMonacoWidgetFocused(e.target)) {
                return;
            }

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
            // Ignore if Find widget or any Monaco widget is focused
            if (this.isMonacoWidgetFocused(e.target)) {
                return;
            }

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

    isMonacoWidgetFocused(target) {
        // Check if the focused element is inside a Monaco widget (Find, Replace, etc.)
        if (!target) return false;

        // Check if target or any parent has Monaco widget classes
        let element = target;
        while (element && element !== document.body) {
            const classList = element.classList;
            if (
                classList &&
                (classList.contains('find-widget') ||
                    classList.contains('monaco-inputbox') ||
                    classList.contains('monaco-findInput') ||
                    classList.contains('input') ||
                    element.tagName === 'TEXTAREA' ||
                    element.tagName === 'INPUT')
            ) {
                return true;
            }
            element = element.parentElement;
        }
        return false;
    }

    isMonacoWidgetTarget(target) {
        // Check if the clicked target is part of a Monaco widget
        if (!target) return false;

        let element = target;
        while (element && element !== document.body) {
            const classList = element.classList;
            if (
                classList &&
                (classList.contains('find-widget') ||
                    classList.contains('editor-widget') ||
                    classList.contains('monaco-inputbox') ||
                    classList.contains('monaco-findInput') ||
                    classList.contains('button') ||
                    classList.contains('monaco-action-bar'))
            ) {
                return true;
            }
            element = element.parentElement;
        }
        return false;
    }

    setupContentChangeTracking() {
        // NOTE: Content change tracking is now handled at MODEL level (in FileLoader)
        // to prevent duplicate notifications when the same model is used in split editors.
        // Saved state updates are also handled at model level.
        // No editor-level listeners needed here anymore
    }

    setupCursorPositionTracking() {
        // Track cursor position changes for status bar
        this.context.editor.onDidChangeCursorPosition((e) => {
            const position = e.position;
            window.dispatchEvent(
                new CustomEvent('editor-cursor-change', {
                    detail: {
                        line: position.lineNumber,
                        column: position.column,
                    },
                })
            );
        });
    }
}
