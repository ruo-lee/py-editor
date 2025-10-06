import { getModelRefCounter } from '../utils/modelRefCounter.js';

/**
 * UnifiedTabManager - Unified tab management for all editors
 * Handles tab creation, switching, closing for left, right, or merged editor
 * Replaces separate TabManager and RightTabManager for better maintainability
 */
export class UnifiedTabManager {
    constructor(context, editorId) {
        this.context = context;
        this.editorId = editorId; // 'left' or 'right'
        this.tabBarId = editorId === 'left' ? 'tabBar' : 'tabBar2';
        this.filePathBarId = editorId === 'left' ? 'filePathBar' : 'filePathBar2';

        // Get model reference counter
        this.modelRefCounter = getModelRefCounter();

        // Note: Don't store editor/openTabs references - get them dynamically
        // because rightEditor may not be created yet when this is constructed

        this.setupDragAndDrop();
    }

    /**
     * Get tab bar element (may be created dynamically in split view)
     */
    getTabBar() {
        return document.getElementById(this.tabBarId);
    }

    /**
     * Get tab container element (scrollable area for tabs)
     */
    getTabContainer() {
        const tabBar = this.getTabBar();
        if (!tabBar) return null;

        // Look for tab-bar-tabs container, create if not exists
        let container = tabBar.querySelector('.tab-bar-tabs');
        if (!container) {
            container = document.createElement('div');
            container.className = 'tab-bar-tabs';
            // Insert before tab-bar-actions
            const actions = tabBar.querySelector('.tab-bar-actions');
            if (actions) {
                tabBar.insertBefore(container, actions);
            } else {
                tabBar.appendChild(container);
            }
        }
        return container;
    }

    /**
     * Get editor instance (dynamically to handle late initialization)
     */
    getEditor() {
        return this.editorId === 'left' ? this.context.editor : this.context.rightEditor;
    }

    /**
     * Get open tabs map (dynamically)
     */
    getOpenTabs() {
        return this.editorId === 'left' ? this.context.openTabs : this.context.rightOpenTabs;
    }

    /**
     * Get active file for this editor
     */
    getActiveFile() {
        return this.editorId === 'left' ? this.context.activeFile : this.context.rightActiveFile;
    }

    /**
     * Set active file for this editor
     */
    setActiveFile(filepath) {
        if (this.editorId === 'left') {
            this.context.activeFile = filepath;
        } else {
            this.context.rightActiveFile = filepath;
        }
    }

    /**
     * Open or switch to a tab
     */
    openTab(filepath, isStdlib = false) {
        const tabContainer = this.getTabContainer();
        if (!tabContainer) {
            return;
        }

        // Check if tab UI element already exists (not just in openTabs)
        const existingTabElement = tabContainer.querySelector(
            `[data-file="${filepath}"], [data-filepath="${filepath}"]`
        );

        if (existingTabElement) {
            this.switchTab(filepath);
            return;
        }

        // Create new tab UI element (even if already in openTabs Map)
        const tab = this.createTabElement(filepath, isStdlib);

        tabContainer.appendChild(tab);

        this.switchTab(filepath);
        this.updateActionButtonsVisibility();
    }

    /**
     * Create tab DOM element
     */
    createTabElement(filepath, isStdlib = false) {
        const filename = filepath.split('/').pop();

        const tab = document.createElement('div');
        tab.className = 'tab' + (isStdlib ? ' stdlib-tab' : '');
        tab.dataset.file = filepath;
        tab.dataset.filepath = filepath; // Support both for compatibility
        tab.draggable = true;

        tab.innerHTML = `
            <span class="tab-label" title="${filepath}">${filename}${isStdlib ? ' (read-only)' : ''}</span>
            <span class="tab-close">×</span>
        `;

        // Tab click to switch
        tab.addEventListener('click', (e) => {
            if (!e.target.classList.contains('tab-close')) {
                this.context.focusedEditor = this.editorId;
                this.switchTab(filepath);
                if (this.context.updateEditorFocusVisual) {
                    this.context.updateEditorFocusVisual();
                }
            }
        });

        // Close button
        const closeBtn = tab.querySelector('.tab-close');
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.closeTab(filepath);
        });

        // Tab right-click context menu
        tab.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            if (this.context.tabContextMenuManager) {
                this.context.tabContextMenuManager.showTabContextMenu(e, filepath, this.editorId);
            }
        });

        // Tab drag handlers for reordering and moving between editors
        this.setupTabDragHandlers(tab, filepath);

        return tab;
    }

    /**
     * Switch to a tab
     */
    switchTab(filepath) {
        const tabContainer = this.getTabContainer();
        if (!tabContainer) return;

        const editor = this.getEditor();
        const openTabs = this.getOpenTabs();

        // Deactivate all tabs in this tab container
        tabContainer.querySelectorAll('.tab').forEach((tab) => {
            tab.classList.remove('active');
        });

        // Activate selected tab
        const tab = tabContainer.querySelector(
            `[data-file="${filepath}"], [data-filepath="${filepath}"]`
        );
        if (tab) {
            tab.classList.add('active');
            // Scroll tab into view smoothly
            tab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }

        this.setActiveFile(filepath);

        // Update file path display
        const filePathBar = document.getElementById(this.filePathBarId);
        const tabData = openTabs.get(filepath);
        const isStdlib = tabData?.isStdlib || false;

        if (filePathBar && this.context.updateFilePathDisplayForElement) {
            this.context.updateFilePathDisplayForElement(filePathBar, filepath, isStdlib);
        }

        // Switch editor model
        if (tabData && tabData.model && editor) {
            editor.setModel(tabData.model);

            // Ensure LSP knows about the opened file
            if (this.context.lspInitialized && this.context.notifyDocumentOpened) {
                this.context.notifyDocumentOpened(filepath, tabData.model.getValue());
            }

            // Hide references panel when switching tabs (UX improvement)
            if (this.context.referencesPanel) {
                this.context.referencesPanel.hide(this.editorId);
            }

            // Show/hide execute button based on file type and stdlib status
            const executeButton =
                this.editorId === 'left'
                    ? document.getElementById('executeButton')
                    : document.getElementById('executeButton2');

            if (executeButton) {
                const isPython = filepath.endsWith('.py');
                executeButton.style.display = isPython && !tabData.isStdlib ? 'block' : 'none';
            }

            // Don't auto-focus editor to allow file explorer keyboard shortcuts
            // User can click on editor area to focus when needed
        }

        // Clear file explorer visual selection (CSS class only)
        // This prevents multiple files from appearing highlighted
        // But preserves selectedItems array for multi-select operations
        if (this.context.fileExplorerInstance) {
            document.querySelectorAll('.file-item.selected').forEach((el) => {
                el.classList.remove('selected');
            });
        }

        // Update active file highlighting in explorer
        if (this.context.updateActiveFileHighlight) {
            this.context.updateActiveFileHighlight();
        }

        // Call legacy callback if exists (for backward compatibility)
        if (this.onTabSwitch) {
            this.onTabSwitch(filepath);
        }
    }

    /**
     * Update action buttons visibility based on editor focus
     */
    updateActionButtonsVisibility() {
        const tabBar = this.getTabBar();
        if (!tabBar) return;

        const executeButton = tabBar.querySelector('.execute-btn');
        const splitToggleButton = tabBar.querySelector('.split-toggle-btn');

        // Show buttons only when this editor is focused
        const isFocused = this.context.focusedEditor === this.editorId;

        if (splitToggleButton) {
            splitToggleButton.style.display = isFocused ? 'flex' : 'none';
        }

        // Execute button visibility also depends on file type (handled in switchTab)
        if (executeButton && isFocused) {
            const activeFile = this.getActiveFile();
            if (activeFile) {
                const openTabs = this.getOpenTabs();
                const tabData = openTabs.get(activeFile);
                const isPython = activeFile.endsWith('.py');
                const isStdlib = tabData?.isStdlib || false;
                executeButton.style.display = isPython && !isStdlib ? 'flex' : 'none';
            }
        } else if (executeButton) {
            executeButton.style.display = 'none';
        }
    }

    /**
     * Close a tab
     * @param {string} filepath - Path of file to close
     * @param {boolean} disposeModel - Whether to dispose the Monaco model (default: true)
     */
    closeTab(filepath, disposeModel = true, clearEditor = true) {
        const tabContainer = this.getTabContainer();
        if (!tabContainer) return;

        const editor = this.getEditor();
        const openTabs = this.getOpenTabs();

        const tab = tabContainer.querySelector(
            `[data-file="${filepath}"], [data-filepath="${filepath}"]`
        );
        if (!tab) return;

        // Cleanup drag event listeners before removing from DOM
        if (tab._dragHandlers) {
            tab.removeEventListener('dragstart', tab._dragHandlers.dragstart);
            tab.removeEventListener('dragend', tab._dragHandlers.dragend);
            tab.removeEventListener('dragover', tab._dragHandlers.dragover);
            delete tab._dragHandlers;
            delete tab._dragHandlersAttached;
        }

        // Remove from DOM
        tab.remove();

        // Handle model disposal using reference counter
        const tabData = openTabs.get(filepath);
        if (disposeModel && tabData && tabData.model) {
            const modelUri = tabData.model.uri.toString();

            // Cleanup model listener before removing reference
            if (this.context.fileLoader) {
                this.context.fileLoader.cleanupModelListener(modelUri);
            }

            // Remove reference - model will be disposed when refCount reaches 0
            const wasDisposed = this.modelRefCounter.removeReference(modelUri);

            if (wasDisposed) {
                console.debug('Model disposed after last reference removed', {
                    filepath,
                    editorId: this.editorId,
                });
            }
        }

        openTabs.delete(filepath);

        // If closing active tab, switch to another
        if (this.getActiveFile() === filepath) {
            const remainingTabs = Array.from(tabContainer.querySelectorAll('.tab'));
            if (remainingTabs.length > 0) {
                const nextFilepath =
                    remainingTabs[remainingTabs.length - 1].dataset.file ||
                    remainingTabs[remainingTabs.length - 1].dataset.filepath;
                this.switchTab(nextFilepath);
            } else {
                this.setActiveFile(null);
                // Only clear editor if clearEditor is true (default behavior)
                if (clearEditor && editor) {
                    editor.setModel(null);
                }
                // Clear file path bar when no tabs remain
                const filePathBar = document.getElementById(this.filePathBarId);
                if (filePathBar) {
                    filePathBar.textContent = '';
                }
                // Update button visibility when no tabs remain
                this.updateActionButtonsVisibility();

                // Update placeholder visibility for right editor
                if (this.editorId === 'right' && this.context.splitViewManager) {
                    this.context.splitViewManager.updatePlaceholderVisibility();
                }
            }
        } else {
            // Update button visibility even when not active tab
            this.updateActionButtonsVisibility();
        }

        // Call legacy callback if exists (for backward compatibility)
        if (this.onTabClose) {
            this.onTabClose(filepath);
        }
    }

    /**
     * Close all tabs
     */
    closeAllTabs() {
        const openTabs = this.getOpenTabs();
        const files = Array.from(openTabs.keys());
        files.forEach((file) => this.closeTab(file));
    }

    /**
     * Close other tabs (keep only specified one)
     */
    closeOtherTabs(keepFilepath) {
        const openTabs = this.getOpenTabs();
        const files = Array.from(openTabs.keys());
        files.forEach((file) => {
            if (file !== keepFilepath) {
                this.closeTab(file);
            }
        });
    }

    /**
     * Close tabs to the right of specified tab
     */
    closeTabsToRight(fromFilepath) {
        const tabContainer = this.getTabContainer();
        if (!tabContainer) return;

        const allTabs = Array.from(tabContainer.querySelectorAll('.tab'));
        const fromIndex = allTabs.findIndex(
            (tab) => tab.dataset.file === fromFilepath || tab.dataset.filepath === fromFilepath
        );

        if (fromIndex === -1) return;

        for (let i = fromIndex + 1; i < allTabs.length; i++) {
            const filepath = allTabs[i].dataset.file || allTabs[i].dataset.filepath;
            this.closeTab(filepath);
        }
    }

    /**
     * Get all open files
     */
    getOpenFiles() {
        const openTabs = this.getOpenTabs();
        return Array.from(openTabs.keys());
    }

    /**
     * Check if file is open
     */
    isFileOpen(filepath) {
        const openTabs = this.getOpenTabs();
        return openTabs.has(filepath);
    }

    /**
     * Update tab label
     */
    updateTabLabel(filepath, label) {
        const tabContainer = this.getTabContainer();
        if (!tabContainer) return;

        const tab = tabContainer.querySelector(
            `[data-file="${filepath}"], [data-filepath="${filepath}"]`
        );
        if (tab) {
            const labelElement = tab.querySelector('.tab-label');
            if (labelElement) {
                labelElement.textContent = label;
            }
        }
    }

    /**
     * Mark tab as modified (unsaved changes)
     */
    markAsModified(filepath, isModified = true) {
        const tabContainer = this.getTabContainer();
        if (!tabContainer) return;

        const tab = tabContainer.querySelector(
            `[data-file="${filepath}"], [data-filepath="${filepath}"]`
        );
        if (tab) {
            const labelElement = tab.querySelector('.tab-label');
            if (labelElement) {
                const filename = filepath.split('/').pop();
                labelElement.textContent = isModified ? `● ${filename}` : filename;
            }
        }
    }

    /**
     * Setup drag and drop for tab reordering
     */
    setupDragAndDrop() {
        // This will be called on construction, but tabBar might not exist yet in split view
        // So we'll set it up lazily when first tab is created
    }

    /**
     * Setup drag handlers for a tab element
     */
    setupTabDragHandlers(tab, filepath) {
        // Check if handlers already exist to prevent duplicates
        if (tab._dragHandlersAttached) {
            return;
        }

        const dragStartHandler = (e) => {
            e.dataTransfer.effectAllowed = 'move';
            // Read filepath from tab element to handle renamed files
            const currentFilepath = tab.dataset.filepath || tab.dataset.file || filepath;
            e.dataTransfer.setData('text/plain', currentFilepath);
            e.dataTransfer.setData('editor-group', this.editorId);
            tab.classList.add('dragging');
        };

        const dragEndHandler = (_e) => {
            tab.classList.remove('dragging');
            document.querySelectorAll('.tab').forEach((t) => t.classList.remove('drag-over'));
        };

        const dragOverHandler = (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';

            const draggingTab = document.querySelector('.tab.dragging');
            const _tabBar = this.getTabBar();

            if (draggingTab && draggingTab !== tab && draggingTab.closest(`#${this.tabBarId}`)) {
                const rect = tab.getBoundingClientRect();
                const midpoint = rect.left + rect.width / 2;

                if (e.clientX < midpoint) {
                    tab.parentNode.insertBefore(draggingTab, tab);
                } else {
                    tab.parentNode.insertBefore(draggingTab, tab.nextSibling);
                }
            }
        };

        tab.addEventListener('dragstart', dragStartHandler);
        tab.addEventListener('dragend', dragEndHandler);
        tab.addEventListener('dragover', dragOverHandler);

        // Store handlers for cleanup
        tab._dragHandlers = {
            dragstart: dragStartHandler,
            dragend: dragEndHandler,
            dragover: dragOverHandler,
        };

        // Mark as attached
        tab._dragHandlersAttached = true;
    }

    /**
     * Legacy methods for backward compatibility
     */

    // For old TabManager API
    setCallbacks(onTabSwitch, onTabClose) {
        this.onTabSwitch = onTabSwitch;
        this.onTabClose = onTabClose;
    }

    // Aliases for RightTabManager compatibility
    createTabInSplit(filepath) {
        const isStdlib = filepath.startsWith('/usr/local/lib/python3.11/');
        this.openTab(filepath, isStdlib);
    }

    switchToTabInSplit(filepath) {
        this.switchTab(filepath);
    }

    closeTabInSplit(filepath) {
        this.closeTab(filepath);
    }

    closeOtherTabsInSplit(keepFilepath) {
        this.closeOtherTabs(keepFilepath);
    }

    closeAllTabsInSplit() {
        this.closeAllTabs();
    }

    closeTabsToRightInSplit(fromFilepath) {
        this.closeTabsToRight(fromFilepath);
    }
}
