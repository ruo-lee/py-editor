/**
 * EventManager.js
 * Manages all event listeners for the application
 */

export class EventManager {
    constructor(context) {
        this.context = context;
    }

    /**
     * Setup all event listeners
     */
    setupAllListeners() {
        this.setupButtonListeners();
        this.setupExplorerListeners();
        this.setupKeyboardShortcuts();
        this.setupOutputPanelListeners();
        this.setupEditorFocusListeners();
        this.setupGlobalListeners();
    }

    /**
     * Setup button event listeners
     */
    setupButtonListeners() {
        const {
            executeButton,
            themeToggleBtn,
            splitToggleBtn,
            newFileBtn,
            newFolderBtn,
            refreshBtn,
            collapseAllBtn,
            toggleHiddenBtn,
        } = this.getElements();

        if (executeButton) {
            executeButton.addEventListener('click', () => {
                this.context.executeCode('left');
            });
        }

        if (themeToggleBtn) {
            themeToggleBtn.addEventListener('click', () => {
                this.context.toggleTheme();
            });
        }

        if (splitToggleBtn) {
            splitToggleBtn.addEventListener('click', () => {
                this.context.toggleSplit();
            });
        }

        if (newFileBtn) {
            newFileBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                // Keep selected directory if a directory is selected, otherwise use root
                if (!this.context.selectedItem || this.context.selectedItem.type !== 'directory') {
                    this.context.selectedDirectory = '';
                }
                this.context.showCreateDialog('file');
            });
        }

        if (newFolderBtn) {
            newFolderBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                // Keep selected directory if a directory is selected, otherwise use root
                if (!this.context.selectedItem || this.context.selectedItem.type !== 'directory') {
                    this.context.selectedDirectory = '';
                }
                this.context.showCreateDialog('folder');
            });
        }

        if (refreshBtn) {
            refreshBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.context.loadFileExplorer();
            });
        }

        if (collapseAllBtn) {
            collapseAllBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.context.collapseAllFolders();
            });
        }

        if (toggleHiddenBtn) {
            toggleHiddenBtn.addEventListener('click', () => {
                this.context.toggleHiddenFiles();
            });
        }
    }

    /**
     * Setup keyboard shortcuts
     */
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl+S / Cmd+S: Save file
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                if (this.context.activeFile) {
                    this.context.saveFile(this.context.activeFile);
                }
            }

            // Ctrl+R / Cmd+R: Execute code
            if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
                e.preventDefault();
                this.context.executeCode();
            }

            // Delete / Cmd+Backspace: Delete selected file/directory
            const isDeleteKey =
                e.key === 'Delete' || (e.key === 'Backspace' && (e.metaKey || e.ctrlKey));

            if (isDeleteKey) {
                // Check if we have any selected items in file explorer
                if (
                    this.context.fileExplorerInstance &&
                    this.context.fileExplorerInstance.selectedItems &&
                    this.context.fileExplorerInstance.selectedItems.length > 0
                ) {
                    const activeElement = document.activeElement;

                    // Check if we're in any input field (but NOT Monaco editor)
                    const isInInput =
                        activeElement?.tagName === 'TEXTAREA' || activeElement?.tagName === 'INPUT';

                    // Allow deletion unless we're in a text input field
                    if (!isInInput) {
                        e.preventDefault();
                        // Pass the first selected item (deleteItem will check selectedItems array internally)
                        const firstItem = this.context.fileExplorerInstance.selectedItems[0];
                        this.context.deleteItem(firstItem.path, firstItem.type);
                    }
                }
            }

            // Escape: Close dialogs
            if (e.key === 'Escape') {
                this.context.closeDialog();
            }
        });
    }

    /**
     * Setup file explorer listeners
     */
    setupExplorerListeners() {
        const fileExplorer = this.context.fileExplorer;
        if (!fileExplorer) return;

        // Right-click on empty space
        fileExplorer.addEventListener('contextmenu', (e) => {
            if (e.target === fileExplorer || e.target.closest('.file-item') === null) {
                e.preventDefault();
                this.context.showEmptySpaceContextMenu(e);
            }
        });

        // Click on empty space to deselect
        fileExplorer.addEventListener('click', (e) => {
            if (
                e.target === fileExplorer ||
                (e.target.classList.contains('folder-content') && e.target.children.length === 0)
            ) {
                // Clear previous selections
                document.querySelectorAll('.file-item.selected').forEach((el) => {
                    el.classList.remove('selected');
                });
                this.context.selectedDirectory = '';
                this.context.selectedItem = null;
            }
        });
    }

    /**
     * Setup output panel listeners
     */
    setupOutputPanelListeners() {
        const { outputPanelClose, outputPanelResizer } = this.getElements();

        if (outputPanelClose) {
            outputPanelClose.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();

                // Always collapse panel when close button is clicked
                if (this.context.problemsManager) {
                    this.context.problemsManager.collapsePanel();
                }
            });
        }

        if (outputPanelResizer && this.context.outputPanel) {
            this.context.setupOutputPanelResize(
                outputPanelResizer,
                this.context.outputPanel,
                this.context
            );
        }
    }

    /**
     * Setup editor focus listeners
     */
    setupEditorFocusListeners() {
        // Focus editor when clicking on editor area (except Monaco widgets)
        const editorContainer = document.querySelector('.editor-container');
        if (editorContainer) {
            editorContainer.addEventListener('click', (e) => {
                // Don't focus editor if clicking on Monaco widgets (find, context menu, etc.)
                if (
                    e.target.closest(
                        '.monaco-editor-overlaymessage, .find-widget, .monaco-menu, .monaco-contextmenu, .monaco-inputbox, .suggest-widget, .parameter-hints-widget, .quick-input-widget'
                    )
                ) {
                    return;
                }
                if (this.context.editor) {
                    this.context.editor.focus();
                }
            });
        }

        // Focus right editor when clicking on right editor area (split view)
        const rightEditorContainer = document.querySelector(
            '#rightEditorContainer .editor-container'
        );
        if (rightEditorContainer) {
            rightEditorContainer.addEventListener('click', (e) => {
                // Don't focus editor if clicking on Monaco widgets
                if (
                    e.target.closest(
                        '.monaco-editor-overlaymessage, .find-widget, .monaco-menu, .monaco-contextmenu, .monaco-inputbox, .suggest-widget, .parameter-hints-widget, .quick-input-widget'
                    )
                ) {
                    return;
                }
                if (this.context.rightEditor) {
                    this.context.rightEditor.focus();
                }
            });
        }
    }

    /**
     * Setup global event listeners
     */
    setupGlobalListeners() {
        // Close context menu on click outside
        document.addEventListener('click', () => {
            this.context.closeContextMenu();
        });
    }

    /**
     * Get all DOM elements
     */
    getElements() {
        return {
            executeButton: this.context.executeButton,
            themeToggleBtn: document.getElementById('themeToggleBtn'),
            splitToggleBtn: document.getElementById('splitToggleBtn'),
            newFileBtn: document.getElementById('newFileBtn'),
            newFolderBtn: document.getElementById('newFolderBtn'),
            refreshBtn: document.getElementById('refreshBtn'),
            collapseAllBtn: document.getElementById('collapseAllBtn'),
            toggleHiddenBtn: document.getElementById('toggleHiddenBtn'),
            outputPanelClose: document.getElementById('outputPanelClose'),
            outputPanelResizer: document.getElementById('outputPanelResizer'),
        };
    }
}
