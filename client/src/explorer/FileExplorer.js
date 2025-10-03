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

        // Callbacks
        this.onFileClick = options.onFileClick || (() => {});
        this.onFolderClick = options.onFolderClick || (() => {});
        this.onContextMenu = options.onContextMenu || (() => {});
        this.onFileMove = options.onFileMove || (() => {});
        this.onExternalFileDrop = options.onExternalFileDrop || (() => {});
    }

    /**
     * Render the file tree
     * @param {Array} files - Array of file/folder objects
     * @param {HTMLElement} container - Container element (optional, defaults to this.container)
     * @param {number} level - Nesting level for recursion
     */
    render(files, container = this.container, level = 0) {
        if (level === 0) {
            container.innerHTML = '';
            this.setupExplorerDropZone(container);
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
                if (content.children.length === 0) {
                    this.render(item.children, content, level + 1);
                }
            } else {
                content.classList.remove('expanded');
                toggle.classList.remove('expanded');
            }
        });

        // Directory selection for creating files/folders
        element.addEventListener('click', (e) => {
            if (e.target === toggle) return; // Don't select when clicking toggle
            e.stopPropagation();

            this.clearSelection();
            element.classList.add('selected');
            this.selectedDirectory = item.path;
            this.selectedItem = { path: item.path, type: 'directory' };

            this.onFolderClick(item.path);
        });

        // Right-click context menu
        element.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.onContextMenu(e, item.path, 'directory');
        });

        // Drag and drop events
        this.setupDragEvents(element, item);
        this.setupDropZone(element, item);

        container.appendChild(element);
        container.appendChild(content);
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

            this.clearSelection();
            element.classList.add('selected');
            this.selectedItem = { path: item.path, type: 'file' };

            this.onFileClick(item.path);
        });

        // Right-click context menu
        element.addEventListener('contextmenu', (e) => {
            e.preventDefault();
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
    }

    /**
     * Setup drop zone for the entire explorer (for external file uploads)
     */
    setupExplorerDropZone(container) {
        container.addEventListener('dragover', (e) => {
            // Only allow external files
            if (e.dataTransfer.types.includes('Files')) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
                container.classList.add('drag-over');
            }
        });

        container.addEventListener('dragleave', (e) => {
            if (e.target === container) {
                container.classList.remove('drag-over');
            }
        });

        container.addEventListener('drop', async (e) => {
            e.preventDefault();
            container.classList.remove('drag-over');

            // External file/directory upload
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
        });
    }

    /**
     * Setup drag events for a file/folder element
     */
    setupDragEvents(element, item) {
        element.addEventListener('dragstart', (e) => {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData(
                'application/json',
                JSON.stringify({
                    path: item.path,
                    name: item.name,
                    type: item.type,
                })
            );
            element.classList.add('dragging');
        });

        element.addEventListener('dragend', (e) => {
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
                if (data.path !== item.path) {
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
}
