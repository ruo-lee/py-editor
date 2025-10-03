/**
 * TabManager - Tab management for Monaco Editor
 * Handles tab creation, switching, closing, and drag-and-drop reordering
 */
export class TabManager {
    constructor(tabBarElement, onTabSwitch, onTabClose) {
        this.tabBar = tabBarElement;
        this.openTabs = new Map();
        this.activeFile = null;
        this.onTabSwitch = onTabSwitch; // Callback when tab is switched
        this.onTabClose = onTabClose; // Callback when tab is closed

        this.setupDragAndDrop();
    }

    /**
     * Create or switch to a tab
     */
    openTab(filePath, isStdlib = false) {
        // If tab already exists, just switch to it
        if (this.openTabs.has(filePath)) {
            this.switchTab(filePath);
            return;
        }

        // Create new tab
        const tab = this.createTabElement(filePath, isStdlib);
        this.tabBar.appendChild(tab);
        this.openTabs.set(filePath, tab);

        this.switchTab(filePath);
    }

    /**
     * Create tab DOM element
     */
    createTabElement(filePath, isStdlib = false) {
        const tab = document.createElement('div');
        tab.className = 'tab' + (isStdlib ? ' stdlib-tab' : '');
        tab.dataset.file = filePath;
        tab.draggable = true;

        const fileName = filePath.split('/').pop();

        tab.innerHTML = `
            <span class="tab-label" title="${filePath}">${fileName}</span>
            <span class="tab-close">×</span>
        `;

        // Tab click to switch
        tab.addEventListener('click', (e) => {
            if (!e.target.classList.contains('tab-close')) {
                this.switchTab(filePath);
            }
        });

        // Close button
        const closeBtn = tab.querySelector('.tab-close');
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.closeTab(filePath);
        });

        return tab;
    }

    /**
     * Switch to a tab
     */
    switchTab(filePath) {
        // Deactivate all tabs
        this.openTabs.forEach((tab) => {
            tab.classList.remove('active');
        });

        // Activate selected tab
        const tab = this.openTabs.get(filePath);
        if (tab) {
            tab.classList.add('active');
            this.activeFile = filePath;

            // Call callback
            if (this.onTabSwitch) {
                this.onTabSwitch(filePath);
            }
        }
    }

    /**
     * Close a tab
     */
    closeTab(filePath) {
        const tab = this.openTabs.get(filePath);
        if (!tab) return;

        // Remove from DOM
        tab.remove();
        this.openTabs.delete(filePath);

        // If closing active tab, switch to another
        if (this.activeFile === filePath) {
            const remainingTabs = Array.from(this.openTabs.keys());
            if (remainingTabs.length > 0) {
                // Switch to last remaining tab
                this.switchTab(remainingTabs[remainingTabs.length - 1]);
            } else {
                this.activeFile = null;
            }
        }

        // Call callback
        if (this.onTabClose) {
            this.onTabClose(filePath);
        }
    }

    /**
     * Close all tabs
     */
    closeAllTabs() {
        const files = Array.from(this.openTabs.keys());
        files.forEach((file) => this.closeTab(file));
    }

    /**
     * Get active file path
     */
    getActiveFile() {
        return this.activeFile;
    }

    /**
     * Get all open files
     */
    getOpenFiles() {
        return Array.from(this.openTabs.keys());
    }

    /**
     * Check if file is open
     */
    isFileOpen(filePath) {
        return this.openTabs.has(filePath);
    }

    /**
     * Setup drag and drop for tab reordering
     */
    setupDragAndDrop() {
        let draggedTab = null;

        this.tabBar.addEventListener('dragstart', (e) => {
            if (e.target.classList.contains('tab')) {
                draggedTab = e.target;
                e.target.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
            }
        });

        this.tabBar.addEventListener('dragend', (e) => {
            if (e.target.classList.contains('tab')) {
                e.target.classList.remove('dragging');
                draggedTab = null;
            }
        });

        this.tabBar.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';

            const afterElement = this.getDragAfterElement(e.clientX);
            if (afterElement == null) {
                this.tabBar.appendChild(draggedTab);
            } else {
                this.tabBar.insertBefore(draggedTab, afterElement);
            }
        });
    }

    /**
     * Get element to insert dragged tab after
     */
    getDragAfterElement(x) {
        const draggableElements = [...this.tabBar.querySelectorAll('.tab:not(.dragging)')];

        return draggableElements.reduce(
            (closest, child) => {
                const box = child.getBoundingClientRect();
                const offset = x - box.left - box.width / 2;

                if (offset < 0 && offset > closest.offset) {
                    return { offset: offset, element: child };
                } else {
                    return closest;
                }
            },
            { offset: Number.NEGATIVE_INFINITY }
        ).element;
    }

    /**
     * Update tab label (e.g., for unsaved changes indicator)
     */
    updateTabLabel(filePath, label) {
        const tab = this.openTabs.get(filePath);
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
    markAsModified(filePath, isModified = true) {
        const tab = this.openTabs.get(filePath);
        if (tab) {
            const labelElement = tab.querySelector('.tab-label');
            if (labelElement) {
                const fileName = filePath.split('/').pop();
                labelElement.textContent = isModified ? `● ${fileName}` : fileName;
            }
        }
    }
}
