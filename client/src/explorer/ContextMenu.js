/**
 * ContextMenu.js
 *
 * Manages context menu creation and interaction for files and directories.
 */

export class ContextMenu {
    constructor() {
        this.currentMenu = null;
        this.closeHandler = null;
    }

    /**
     * Show context menu for a file or directory
     * @param {MouseEvent} event - The context menu event
     * @param {string} filePath - Path to the file/directory
     * @param {string} type - 'file' or 'directory'
     * @param {Object} actions - Object containing action callbacks
     */
    show(event, filePath, type, actions = {}) {
        this.close();

        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.style.left = event.pageX + 'px';
        menu.style.top = event.pageY + 'px';

        const fileName = filePath.split('/').pop();
        const isDirectory = type === 'directory';

        let menuItems = [];

        if (isDirectory) {
            menuItems = [
                { text: 'New File', action: actions.createFile },
                { text: 'New Folder', action: actions.createFolder },
                { separator: true },
                { text: 'Rename', action: actions.rename },
                { text: 'Duplicate', action: actions.duplicate },
                { separator: true },
                { text: 'Download as ZIP', action: actions.download },
                { separator: true },
                { text: 'Copy Path', action: actions.copyPath },
                { text: 'Copy Relative Path', action: actions.copyRelativePath },
                { separator: true },
                {
                    text: 'Delete',
                    action: actions.delete,
                    class: 'destructive',
                },
            ];
        } else {
            menuItems = [
                { text: 'Open', action: actions.open },
                { separator: true },
                { text: 'Rename', action: actions.rename },
                { text: 'Duplicate', action: actions.duplicate },
                { separator: true },
                { text: 'Download', action: actions.download },
                { separator: true },
                { text: 'Copy Path', action: actions.copyPath },
                { text: 'Copy Relative Path', action: actions.copyRelativePath },
                { separator: true },
                {
                    text: 'Delete',
                    action: actions.delete,
                    class: 'destructive',
                },
            ];
        }

        this.renderMenuItems(menu, menuItems);
        document.body.appendChild(menu);
        this.currentMenu = menu;

        // Close menu when clicking outside
        this.closeHandler = this.close.bind(this);
        setTimeout(() => {
            document.addEventListener('click', this.closeHandler, { once: true });
        }, 0);
    }

    /**
     * Show context menu for empty space in the explorer
     * @param {MouseEvent} event - The context menu event
     * @param {Object} actions - Object containing action callbacks
     */
    showEmptySpaceMenu(event, actions = {}) {
        this.close();

        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.style.left = event.pageX + 'px';
        menu.style.top = event.pageY + 'px';

        const menuItems = [
            { text: 'New File', action: actions.createFile },
            { text: 'New Folder', action: actions.createFolder },
            { separator: true },
            { text: 'Refresh', action: actions.refresh },
        ];

        this.renderMenuItems(menu, menuItems);
        document.body.appendChild(menu);
        this.currentMenu = menu;

        // Close menu when clicking outside
        this.closeHandler = this.close.bind(this);
        setTimeout(() => {
            document.addEventListener('click', this.closeHandler, { once: true });
        }, 0);
    }

    /**
     * Render menu items into the menu container
     * @param {HTMLElement} menu - The menu container element
     * @param {Array} menuItems - Array of menu item objects
     */
    renderMenuItems(menu, menuItems) {
        menuItems.forEach((item) => {
            if (item.separator) {
                const separator = document.createElement('div');
                separator.className = 'context-menu-separator';
                menu.appendChild(separator);
            } else {
                const menuItem = document.createElement('div');
                menuItem.className = `context-menu-item ${item.class || ''}`;
                menuItem.textContent = item.text;

                if (item.action) {
                    menuItem.addEventListener('click', () => {
                        item.action();
                        this.close();
                    });
                }

                menu.appendChild(menuItem);
            }
        });
    }

    /**
     * Close the current context menu
     */
    close() {
        if (this.currentMenu) {
            this.currentMenu.remove();
            this.currentMenu = null;
        }

        if (this.closeHandler) {
            document.removeEventListener('click', this.closeHandler);
            this.closeHandler = null;
        }
    }

    /**
     * Check if a menu is currently open
     */
    isOpen() {
        return this.currentMenu !== null;
    }
}
