/**
 * TabContextMenuManager.js
 * Manages tab context menus
 */

export class TabContextMenuManager {
    constructor(context) {
        this.context = context;
    }

    /**
     * Show tab context menu
     */
    showTabContextMenu(event, filepath, editorGroup = 'left') {
        this.context.closeContextMenu();

        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.style.left = event.pageX + 'px';
        menu.style.top = event.pageY + 'px';

        const openTabs =
            editorGroup === 'left' ? this.context.openTabs : this.context.rightOpenTabs;
        const hasOtherTabs = openTabs.size > 1;

        menu.innerHTML = `
            <div class="context-menu-item" data-action="close">Close</div>
            ${hasOtherTabs ? '<div class="context-menu-item" data-action="close-others">Close Others</div>' : ''}
            ${hasOtherTabs ? '<div class="context-menu-item" data-action="close-all">Close All</div>' : ''}
            ${
                this.context.splitViewActive && editorGroup === 'left'
                    ? '<div class="context-menu-separator"></div><div class="context-menu-item" data-action="move-to-right">Move to Right</div>'
                    : ''
            }
            ${
                this.context.splitViewActive && editorGroup === 'right'
                    ? '<div class="context-menu-separator"></div><div class="context-menu-item" data-action="move-to-left">Move to Left</div>'
                    : ''
            }
        `;

        document.body.appendChild(menu);

        menu.addEventListener('click', async (e) => {
            e.stopPropagation();
            const action = e.target.getAttribute('data-action');

            switch (action) {
                case 'close':
                    this.context.closeTab(filepath, editorGroup);
                    break;
                case 'close-others':
                    this.closeOtherTabs(filepath, editorGroup);
                    break;
                case 'close-all':
                    this.closeAllTabsInGroup(editorGroup);
                    break;
                case 'move-to-right':
                    await this.context.moveTabBetweenEditors(filepath, 'left', 'right');
                    break;
                case 'move-to-left':
                    await this.context.moveTabBetweenEditors(filepath, 'right', 'left');
                    break;
            }

            menu.remove();
        });

        // Close menu on click outside
        setTimeout(() => {
            document.addEventListener(
                'click',
                () => {
                    menu.remove();
                },
                { once: true }
            );
        }, 0);
    }

    /**
     * Close other tabs
     */
    closeOtherTabs(filepath, editorGroup = 'left') {
        const openTabs =
            editorGroup === 'left' ? this.context.openTabs : this.context.rightOpenTabs;
        const tabsToClose = Array.from(openTabs.keys()).filter((path) => path !== filepath);

        tabsToClose.forEach((path) => {
            this.context.closeTab(path, editorGroup);
        });
    }

    /**
     * Close all tabs in editor group
     */
    closeAllTabsInGroup(editorGroup = 'left') {
        if (editorGroup === 'left') {
            this.context.closeAllTabs();
        } else {
            this.context.closeAllTabsInSplit();
        }
    }
}
