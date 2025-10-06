/**
 * TabDragDropManager - Manages tab drag and drop between editors
 */
export class TabDragDropManager {
    constructor(context) {
        this.context = context;
    }

    setupTabBarDropZones() {
        const leftTabBar = document.getElementById('tabBar');
        const rightTabBar = document.getElementById('tabBar2');

        if (leftTabBar) {
            this.setupTabBarDrop(leftTabBar, 'left');
        }

        if (rightTabBar) {
            this.setupTabBarDrop(rightTabBar, 'right');
        }
    }

    setupTabBarDrop(tabBar, targetEditor) {
        tabBar.addEventListener('dragover', (e) => {
            const draggingTab = document.querySelector('.tab.dragging');
            if (draggingTab) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                tabBar.classList.add('drag-over');
            }
        });

        tabBar.addEventListener('dragleave', (e) => {
            // Check if we're truly leaving the tab bar (not just entering a child element)
            const rect = tabBar.getBoundingClientRect();
            if (
                e.clientX < rect.left ||
                e.clientX >= rect.right ||
                e.clientY < rect.top ||
                e.clientY >= rect.bottom
            ) {
                tabBar.classList.remove('drag-over');
            }
        });

        tabBar.addEventListener('drop', (e) => {
            e.preventDefault();
            tabBar.classList.remove('drag-over');

            const filepath = e.dataTransfer.getData('text/plain');
            const sourceEditor = e.dataTransfer.getData('editor-group');

            if (!filepath) return;

            // Move tab between editors
            if (sourceEditor !== targetEditor) {
                this.moveTabBetweenEditors(filepath, sourceEditor, targetEditor);
            }
        });
    }

    async moveTabBetweenEditors(filepath, fromEditor, toEditor) {
        const sourceTabs =
            fromEditor === 'left' ? this.context.openTabs : this.context.rightOpenTabs;
        const targetTabs = toEditor === 'left' ? this.context.openTabs : this.context.rightOpenTabs;
        const sourceTabManager =
            fromEditor === 'left' ? this.context.tabManager : this.context.rightTabManager;
        const targetTabManager =
            toEditor === 'left' ? this.context.tabManager : this.context.rightTabManager;

        if (!sourceTabManager || !targetTabManager) {
            console.error('Tab managers not initialized');
            return;
        }

        const tabData = sourceTabs.get(filepath);
        if (!tabData) return;

        // Check if tab already exists in target editor
        if (targetTabs.has(filepath)) {
            // Just close from source and switch to existing tab in target
            sourceTabManager.closeTab(filepath, false); // Don't dispose - still used in target
            targetTabManager.switchTab(filepath);

            // Update placeholder if moving to right editor
            if (
                toEditor === 'right' &&
                this.context.splitViewManager?.updatePlaceholderVisibility
            ) {
                this.context.splitViewManager.updatePlaceholderVisibility();
            }
            return;
        }

        // Share the same model between editors - don't create a new one
        // Both editors will use the same Monaco model instance

        // Remove from source editor FIRST (before adding to target)
        // We need to remove the tab UI but NOT dispose the model
        sourceTabs.delete(filepath);
        sourceTabManager.closeTab(filepath, false); // Don't dispose model - we're sharing it

        // Add to target editor with the SAME model instance
        targetTabs.set(filepath, {
            model: tabData.model, // Share the same model
            saved: tabData.saved,
            isStdlib: tabData.isStdlib,
        });

        // Create tab in target editor and switch to it
        const isStdlib = filepath.startsWith('/usr/local/lib/python3.11/');
        targetTabManager.openTab(filepath, isStdlib);

        // Note: No need to manually set model or notify LSP here
        // The openTab() call above already triggers switchTab() which:
        // 1. Sets the model on the editor
        // 2. Notifies LSP about the opened document
        // This prevents duplicate didOpen notifications

        // Update placeholder if moving to right editor
        if (toEditor === 'right' && this.context.splitViewManager?.updatePlaceholderVisibility) {
            this.context.splitViewManager.updatePlaceholderVisibility();
        }

        this.context.focusedEditor = toEditor;
        this.context.updateEditorFocusVisual();
    }

    setupEditorFocusTracking() {
        const leftEditorGroup = document.getElementById('leftEditorGroup');
        const rightEditorGroup = document.getElementById('rightEditorGroup');

        leftEditorGroup?.addEventListener('click', () => {
            this.context.focusedEditor = 'left';
            this.context.updateEditorFocusVisual();
        });

        rightEditorGroup?.addEventListener('click', () => {
            this.context.focusedEditor = 'right';
            this.context.updateEditorFocusVisual();
        });
    }

    updateEditorFocusVisual() {
        const leftGroup = document.getElementById('leftEditorGroup');
        const rightGroup = document.getElementById('rightEditorGroup');

        if (this.context.focusedEditor === 'left') {
            leftGroup?.classList.add('focused');
            rightGroup?.classList.remove('focused');
        } else {
            leftGroup?.classList.remove('focused');
            rightGroup?.classList.add('focused');
        }

        // Update action button visibility for both editors
        if (this.context.tabManager?.updateActionButtonsVisibility) {
            this.context.tabManager.updateActionButtonsVisibility();
        }
        if (this.context.rightTabManager?.updateActionButtonsVisibility) {
            this.context.rightTabManager.updateActionButtonsVisibility();
        }
    }
}
