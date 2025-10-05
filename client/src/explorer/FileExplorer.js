/**
 * FileExplorer.js
 *
 * Manages file tree rendering, folder expansion/collapse, file selection,
 * and drag-and-drop functionality for the file explorer.
 */

export class FileExplorer {
    constructor(containerElement, options = {}) {
        this.container = containerElement;
        this.showHiddenFiles = options.showHiddenFiles || false;
        this.getFileIcon = options.getFileIcon || this.defaultGetFileIcon.bind(this);

        // State
        this.selectedDirectory = '';
        this.selectedItem = null;
        this.selectedItems = []; // Multi-selection support
        this.lastClickedItem = null; // For shift+click range selection
        this.allFileElements = []; // Ordered list of all file elements for range selection
        this.dropZoneInitialized = false;
        this.expandedFolders = new Set(); // Track expanded folders

        // Callbacks
        this.onFileClick = options.onFileClick || (() => {});
        this.onFolderClick = options.onFolderClick || (() => {});
        this.onContextMenu = options.onContextMenu || (() => {});
        this.onFileMove = options.onFileMove || (() => {});
        this.onExternalFileDrop = options.onExternalFileDrop || (() => {});
    }

    /**
     * Save currently expanded folders state
     */
    saveExpandedState() {
        this.expandedFolders.clear();
        const expandedElements = this.container.querySelectorAll('.folder-toggle.expanded');
        expandedElements.forEach((toggle) => {
            const folderElement = toggle.closest('.file-item[data-type="directory"]');
            if (folderElement) {
                const path = folderElement.getAttribute('data-path');
                if (path) {
                    this.expandedFolders.add(path);
                }
            }
        });
    }

    /**
     * Render the file tree
     * @param {Array} files - Array of file/folder objects
     * @param {HTMLElement} container - Container element (optional, defaults to this.container)
     * @param {number} level - Nesting level for recursion
     */
    render(files, container = this.container, level = 0) {
        if (level === 0) {
            // Save expanded state before clearing
            this.saveExpandedState();

            container.innerHTML = '';
            // Reset file elements tracking for range selection
            this.allFileElements = [];

            // Setup drop zone on the workspace content area (entire panel) - only once
            if (!this.dropZoneInitialized) {
                const workspaceContent = document.getElementById('workspaceContent');
                if (workspaceContent) {
                    this.setupExplorerDropZone(workspaceContent);
                    this.dropZoneInitialized = true;
                }
            }
        }

        files.forEach((item) => {
            // Filter hidden files (files/folders starting with .)
            if (!this.showHiddenFiles && item.name.startsWith('.')) {
                return;
            }

            const element = document.createElement('div');

            if (item.type === 'directory') {
                this.renderDirectory(element, item, container, level);
            } else {
                this.renderFile(element, item, container);
                // Track file elements in order for range selection
                this.allFileElements.push({ element, item });
            }
        });
    }

    /**
     * Render a directory item
     */
    renderDirectory(element, item, container, level) {
        element.className = 'file-item folder-item';
        element.setAttribute('data-path', item.path);
        element.setAttribute('data-type', 'directory');
        element.setAttribute('draggable', 'true');
        element.innerHTML = `
            <i class="codicon codicon-chevron-right folder-toggle"></i>
            <span>${item.name}</span>
        `;

        const content = document.createElement('div');
        content.className = 'folder-content';

        // Directory toggle functionality
        const toggle = element.querySelector('.folder-toggle');
        toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const isExpanded = content.classList.contains('expanded');

            if (!isExpanded) {
                content.classList.add('expanded');
                toggle.classList.add('expanded');
                this.expandedFolders.add(item.path); // Track expansion
                if (content.children.length === 0) {
                    this.render(item.children, content, level + 1);
                }
            } else {
                content.classList.remove('expanded');
                toggle.classList.remove('expanded');
                this.expandedFolders.delete(item.path); // Track collapse
            }
        });

        // Directory selection for creating files/folders
        element.addEventListener('click', (e) => {
            if (e.target === toggle) return; // Don't select when clicking toggle
            e.stopPropagation();

            // Focus the file explorer to enable keyboard shortcuts
            this.container.focus();

            // Multi-selection with Cmd/Ctrl key
            if (e.metaKey || e.ctrlKey) {
                this.toggleSelection(element, item, 'directory');
            } else {
                // Check if clicking on already selected item in multi-selection
                const isAlreadySelected =
                    this.selectedItems.length > 1 &&
                    this.selectedItems.some((selectedItem) => selectedItem.path === item.path);

                if (!isAlreadySelected) {
                    this.clearSelection();
                    element.classList.add('selected');
                    this.selectedDirectory = item.path;
                    this.selectedItem = { path: item.path, name: item.name, type: 'directory' };
                    this.selectedItems = [{ path: item.path, name: item.name, type: 'directory' }];
                }
            }

            this.onFolderClick(item.path);
        });

        // Right-click context menu
        element.addEventListener('contextmenu', (e) => {
            e.preventDefault();

            // If right-clicked item is not already selected, clear and select only this item
            const isAlreadySelected = this.selectedItems.some(
                (selectedItem) => selectedItem.path === item.path
            );

            if (!isAlreadySelected) {
                this.clearSelection();
                element.classList.add('selected');
                this.selectedDirectory = item.path;
                this.selectedItem = { path: item.path, name: item.name, type: 'directory' };
                this.selectedItems = [{ path: item.path, name: item.name, type: 'directory' }];
            }

            this.onContextMenu(e, item.path, 'directory');
        });

        // Drag and drop events
        this.setupDragEvents(element, item);
        this.setupDropZone(element, item);

        container.appendChild(element);
        container.appendChild(content);

        // Restore expanded state if this folder was previously expanded
        if (this.expandedFolders.has(item.path)) {
            content.classList.add('expanded');
            toggle.classList.add('expanded');
            // Render children if not already rendered
            if (content.children.length === 0 && item.children) {
                this.render(item.children, content, level + 1);
            }
        }
    }

    /**
     * Render a file item
     */
    renderFile(element, item, container) {
        element.className = 'file-item';
        element.setAttribute('data-path', item.path);
        element.setAttribute('data-type', 'file');
        element.setAttribute('draggable', 'true');
        element.innerHTML = `
            <span class="file-icon">${this.getFileIcon(item.name)}</span>
            <span>${item.name}</span>
        `;

        element.addEventListener('click', (e) => {
            e.stopPropagation();

            // Focus the file explorer to enable keyboard shortcuts
            this.container.focus();

            if (e.shiftKey && (e.metaKey || e.ctrlKey)) {
                // Ctrl+Shift+Click: Range selection from last clicked item
                this.selectRange(element, item, 'file');
            } else if (e.metaKey || e.ctrlKey) {
                // Ctrl+Click: Toggle selection (add/remove from selection)
                this.toggleSelection(element, item, 'file');
                this.lastClickedItem = item;
            } else {
                // Normal click: Clear previous selection and select only this item
                this.clearSelection();
                element.classList.add('selected');
                this.selectedItem = { path: item.path, name: item.name, type: 'file' };
                this.selectedItems = [{ path: item.path, name: item.name, type: 'file' }];
                this.lastClickedItem = item;

                // Open file but keep focus on explorer for keyboard shortcuts
                this.onFileClick(item.path);
            }
        });

        // Right-click context menu
        element.addEventListener('contextmenu', (e) => {
            e.preventDefault();

            // If right-clicked item is not already selected, clear and select only this item
            const isAlreadySelected = this.selectedItems.some(
                (selectedItem) => selectedItem.path === item.path
            );

            if (!isAlreadySelected) {
                this.clearSelection();
                element.classList.add('selected');
                this.selectedItem = { path: item.path, name: item.name, type: 'file' };
                this.selectedItems = [{ path: item.path, name: item.name, type: 'file' }];
            }

            this.onContextMenu(e, item.path, 'file');
        });

        // Drag and drop events
        this.setupDragEvents(element, item);

        container.appendChild(element);
    }

    /**
     * Clear all selections in the file explorer
     */
    clearSelection() {
        document.querySelectorAll('.file-item.selected').forEach((el) => {
            el.classList.remove('selected');
        });
        this.selectedItems = [];
    }

    /**
     * Toggle selection for multi-select with Cmd/Ctrl
     */
    toggleSelection(element, item, type) {
        const itemData = { path: item.path, name: item.name, type: type };
        const existingIndex = this.selectedItems.findIndex(
            (selectedItem) => selectedItem.path === item.path
        );

        if (existingIndex >= 0) {
            // Deselect
            element.classList.remove('selected');
            this.selectedItems.splice(existingIndex, 1);
        } else {
            // Select
            element.classList.add('selected');
            this.selectedItems.push(itemData);
        }

        // Update selectedItem to the last selected item
        if (this.selectedItems.length > 0) {
            this.selectedItem = this.selectedItems[this.selectedItems.length - 1];
        } else {
            this.selectedItem = null;
        }
    }

    /**
     * Select range of files from last clicked item to current item (Ctrl+Shift+Click)
     */
    selectRange(element, item, type) {
        if (!this.lastClickedItem || this.allFileElements.length === 0) {
            // No previous selection, just select this item
            this.clearSelection();
            element.classList.add('selected');
            this.selectedItems = [{ path: item.path, name: item.name, type: type }];
            this.selectedItem = this.selectedItems[0];
            this.lastClickedItem = item;
            return;
        }

        // Find indices of last clicked item and current item
        const lastIndex = this.allFileElements.findIndex(
            (fileEl) => fileEl.item.path === this.lastClickedItem.path
        );
        const currentIndex = this.allFileElements.findIndex(
            (fileEl) => fileEl.item.path === item.path
        );

        if (lastIndex === -1 || currentIndex === -1) {
            return;
        }

        // Determine range direction
        const startIndex = Math.min(lastIndex, currentIndex);
        const endIndex = Math.max(lastIndex, currentIndex);

        // Clear previous selection
        this.clearSelection();

        // Select all items in range
        for (let i = startIndex; i <= endIndex; i++) {
            const fileEl = this.allFileElements[i];
            fileEl.element.classList.add('selected');
            this.selectedItems.push({
                path: fileEl.item.path,
                name: fileEl.item.name,
                type: 'file',
            });
        }

        // Update selectedItem to the last item in the range
        if (this.selectedItems.length > 0) {
            this.selectedItem = this.selectedItems[this.selectedItems.length - 1];
        }
    }

    /**
     * Setup drop zone for the entire explorer (for external file uploads and root moves)
     */
    setupExplorerDropZone(container) {
        container.addEventListener('dragover', (e) => {
            const hasInternalDrag = e.dataTransfer.types.includes('application/json');
            const hasExternalFiles = e.dataTransfer.types.includes('Files');

            // Allow both internal drags (move to root) and external files
            if (hasInternalDrag || hasExternalFiles) {
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = hasInternalDrag ? 'move' : 'copy';
                container.classList.add('drag-over');
            }
        });

        container.addEventListener('dragleave', (e) => {
            // Check if we're leaving the container bounds (not just moving to a child)
            const rect = container.getBoundingClientRect();
            if (
                e.clientX < rect.left ||
                e.clientX >= rect.right ||
                e.clientY < rect.top ||
                e.clientY >= rect.bottom
            ) {
                container.classList.remove('drag-over');
            }
        });

        container.addEventListener('drop', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            container.classList.remove('drag-over');

            // Internal file/folder move to root
            if (e.dataTransfer.types.includes('application/json')) {
                const data = JSON.parse(e.dataTransfer.getData('application/json'));
                // Check if multiple items are being moved
                if (data.isMultiple && data.items) {
                    // Move multiple items to root
                    for (const draggedItem of data.items) {
                        this.onFileMove(draggedItem, '');
                    }
                } else {
                    // Move single item to root (empty string path)
                    this.onFileMove(data, '');
                }
                return;
            }

            // External file/directory upload
            if (e.dataTransfer.types.includes('Files')) {
                const items = e.dataTransfer.items;

                if (items && items.length > 0) {
                    // Check if we can use the items API
                    let hasEntry = false;
                    for (let i = 0; i < items.length; i++) {
                        if (items[i].webkitGetAsEntry) {
                            hasEntry = true;
                            break;
                        }
                    }

                    if (hasEntry) {
                        this.onExternalFileDrop(items, '', 'items');
                        return;
                    }
                }

                // Fallback for browsers that don't support items API
                const files = e.dataTransfer.files;
                if (files.length > 0) {
                    this.onExternalFileDrop(files, '', 'files');
                }
            }
        });
    }

    /**
     * Setup drag events for a file/folder element
     */
    setupDragEvents(element, item) {
        element.addEventListener('dragstart', (e) => {
            e.dataTransfer.effectAllowed = 'move';

            // Check if dragging multiple items
            if (this.selectedItems.length > 1) {
                // Dragging multiple items
                e.dataTransfer.setData(
                    'application/json',
                    JSON.stringify({
                        items: this.selectedItems,
                        isMultiple: true,
                    })
                );
            } else {
                // Dragging single item
                e.dataTransfer.setData(
                    'application/json',
                    JSON.stringify({
                        path: item.path,
                        name: item.name,
                        type: item.type,
                    })
                );
            }

            element.classList.add('dragging');
        });

        element.addEventListener('dragend', (_e) => {
            element.classList.remove('dragging');
            document.querySelectorAll('.drag-over').forEach((el) => {
                el.classList.remove('drag-over');
            });
        });
    }

    /**
     * Setup drop zone for a directory element
     */
    setupDropZone(element, item) {
        if (item.type !== 'directory') return;

        element.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();

            const jsonData = e.dataTransfer.types.includes('application/json');
            const filesData = e.dataTransfer.types.includes('Files');

            if (jsonData || filesData) {
                e.dataTransfer.dropEffect = jsonData ? 'move' : 'copy';
                element.classList.add('drag-over');
            }
        });

        element.addEventListener('dragleave', (e) => {
            if (e.target === element) {
                element.classList.remove('drag-over');
            }
        });

        element.addEventListener('drop', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            element.classList.remove('drag-over');

            // Internal file/folder move
            if (e.dataTransfer.types.includes('application/json')) {
                const data = JSON.parse(e.dataTransfer.getData('application/json'));

                // Check if multiple items are being moved
                if (data.isMultiple && data.items) {
                    // Move multiple items
                    for (const draggedItem of data.items) {
                        if (draggedItem.path !== item.path) {
                            this.onFileMove(draggedItem, item.path);
                        }
                    }
                } else if (data.path !== item.path) {
                    // Move single item
                    this.onFileMove(data, item.path);
                }
                return;
            }

            // External file/directory drop
            const items = e.dataTransfer.items;
            if (items && items.length > 0) {
                let hasEntry = false;
                for (let i = 0; i < items.length; i++) {
                    if (items[i].webkitGetAsEntry) {
                        hasEntry = true;
                        break;
                    }
                }

                if (hasEntry) {
                    this.onExternalFileDrop(items, item.path, 'items');
                    return;
                }
            }

            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.onExternalFileDrop(files, item.path, 'files');
            }
        });
    }

    /**
     * Get selected directory path
     */
    getSelectedDirectory() {
        return this.selectedDirectory;
    }

    /**
     * Get selected item (file or directory)
     */
    getSelectedItem() {
        return this.selectedItem;
    }

    /**
     * Set selected directory
     */
    setSelectedDirectory(path) {
        this.selectedDirectory = path;
    }

    /**
     * Toggle hidden files visibility
     */
    toggleHiddenFiles() {
        this.showHiddenFiles = !this.showHiddenFiles;
        return this.showHiddenFiles;
    }

    /**
     * Default file icon getter (can be overridden via options)
     */
    defaultGetFileIcon(fileName) {
        const ext = fileName.split('.').pop().toLowerCase();
        const iconMap = {
            py: '🐍',
            js: '📜',
            json: '📋',
            md: '📝',
            txt: '📄',
            html: '🌐',
            css: '🎨',
            jpg: '🖼️',
            jpeg: '🖼️',
            png: '🖼️',
            gif: '🖼️',
            svg: '🖼️',
        };
        return iconMap[ext] || '📄';
    }

    /**
     * Get all currently expanded folder paths
     */
    getExpandedFolders() {
        const expandedPaths = [];
        this.container.querySelectorAll('.folder-content.expanded').forEach((content) => {
            const folderElement = content.previousElementSibling;
            if (folderElement) {
                const path = folderElement.getAttribute('data-path');
                if (path) {
                    expandedPaths.push(path);
                }
            }
        });
        return expandedPaths;
    }

    /**
     * Restore expanded folder states
     */
    restoreExpandedFolders(paths) {
        if (!paths || paths.length === 0) return;

        paths.forEach((path) => {
            this.expandFolder(path);
        });
    }

    /**
     * Expand a folder by path
     */
    expandFolder(path) {
        const element = this.container.querySelector(
            `[data-path="${path}"][data-type="directory"]`
        );
        if (element) {
            const toggle = element.querySelector('.folder-toggle');
            const content = element.nextElementSibling;

            if (toggle && content && !content.classList.contains('expanded')) {
                toggle.click();
            }
        }
    }

    /**
     * Collapse a folder by path
     */
    collapseFolder(path) {
        const element = this.container.querySelector(
            `[data-path="${path}"][data-type="directory"]`
        );
        if (element) {
            const toggle = element.querySelector('.folder-toggle');
            const content = element.nextElementSibling;

            if (toggle && content && content.classList.contains('expanded')) {
                toggle.click();
            }
        }
    }

    /**
     * Clear the entire file explorer
     */
    clear() {
        this.container.innerHTML = '';
        this.selectedDirectory = '';
        this.selectedItem = null;
    }

    /**
     * Restore selection for a directory after refresh
     */
    restoreSelection(path) {
        const selectedElement = this.container.querySelector(
            `[data-path="${path}"][data-type="directory"]`
        );
        if (selectedElement) {
            selectedElement.classList.add('selected');
            this.selectedDirectory = path;
            this.selectedItem = { path, type: 'directory' };
            return true;
        }
        return false;
    }
}
