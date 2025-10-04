/**
 * DialogManager.js
 * Manages all dialog interactions (create, rename, delete confirmations)
 */

export class DialogManager {
    constructor(callbacks = {}) {
        this.callbacks = callbacks;
    }

    /**
     * Close all dialogs
     */
    closeAll() {
        const dialogs = document.querySelectorAll('.input-dialog');
        dialogs.forEach((dialog) => dialog.remove());
    }

    /**
     * Show create file/folder dialog
     * @param {string} type - 'file' or 'folder'
     * @param {string} selectedDirectory - Currently selected directory
     * @param {Function} onCreate - Callback(fullPath, type)
     * @param {Function} onCheckExists - Callback(path) => boolean
     * @param {Function} onRefresh - Callback to refresh file explorer
     */
    showCreateDialog(type, selectedDirectory, onCreate, onCheckExists, onRefresh) {
        this.closeAll();

        const currentDir = selectedDirectory || '';
        const dirDisplay = currentDir ? ` in ${currentDir}` : ' in root';

        const dialog = document.createElement('div');
        dialog.className = 'input-dialog';
        dialog.innerHTML = `
            <div class="input-dialog-content">
                <h3>Create New ${type === 'file' ? 'File' : 'Folder'}${dirDisplay}</h3>
                <input type="text" id="nameInput" placeholder="Enter ${type} name..." />
                <div class="input-dialog-buttons">
                    <button class="dialog-button secondary" onclick="this.closest('.input-dialog').remove()">Cancel</button>
                    <button class="dialog-button primary" id="createBtn">Create</button>
                </div>
            </div>
        `;

        document.body.appendChild(dialog);

        const input = dialog.querySelector('#nameInput');
        const createBtn = dialog.querySelector('#createBtn');

        input.focus();

        const create = async () => {
            const name = input.value.trim();
            if (!name) return;

            try {
                const fullPath = selectedDirectory ? `${selectedDirectory}/${name}` : name;

                // Check if file/folder already exists
                if (await onCheckExists(fullPath)) {
                    alert(`A ${type} named "${name}" already exists in this directory.`);
                    return;
                }

                await onCreate(fullPath, type);
                dialog.remove();
                onRefresh();
            } catch (error) {
                alert('Failed to create ' + type + ': ' + error.message);
            }
        };

        createBtn.addEventListener('click', create);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                create();
            }
        });
    }

    /**
     * Show rename dialog
     * @param {string} filePath - Current file/folder path
     * @param {string} type - 'file' or 'folder'
     * @param {Function} onRename - Callback(oldPath, newPath)
     * @param {Function} onRefresh - Callback to refresh file explorer
     */
    showRenameDialog(filePath, type, onRename, onRefresh) {
        const currentName = filePath.split('/').pop();
        const parentPath = filePath.substring(0, filePath.lastIndexOf('/'));

        const dialog = document.createElement('div');
        dialog.className = 'input-dialog';
        dialog.innerHTML = `
            <div class="input-dialog-content">
                <h3>Rename ${type === 'file' ? 'File' : 'Folder'}</h3>
                <input type="text" id="renameInput" value="${currentName}" />
                <div class="input-dialog-buttons">
                    <button class="dialog-button secondary" onclick="this.closest('.input-dialog').remove()">Cancel</button>
                    <button class="dialog-button primary" id="renameBtn">Rename</button>
                </div>
            </div>
        `;

        document.body.appendChild(dialog);

        const input = dialog.querySelector('#renameInput');
        const renameBtn = dialog.querySelector('#renameBtn');

        input.focus();
        input.select();

        const rename = async () => {
            const newName = input.value.trim();
            if (!newName || newName === currentName) {
                dialog.remove();
                return;
            }

            try {
                const newPath = parentPath ? `${parentPath}/${newName}` : newName;
                await onRename(filePath, newPath);
                dialog.remove();
                onRefresh();
            } catch (error) {
                alert('Failed to rename: ' + error.message);
            }
        };

        renameBtn.addEventListener('click', rename);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') rename();
            if (e.key === 'Escape') dialog.remove();
        });
    }

    /**
     * Show delete confirmation dialog
     * @param {string} filePath - File/folder path to delete
     * @param {string} type - 'file' or 'folder'
     * @param {Function} onDelete - Callback(path, type)
     * @param {Function} onRefresh - Callback to refresh file explorer
     * @returns {Promise<boolean>} Whether deletion was confirmed
     */
    async showDeleteConfirmation(filePath, type, onDelete, onRefresh) {
        const fileName = filePath.split('/').pop();
        const confirmMsg = `Are you sure you want to delete "${fileName}"?`;

        if (!confirm(confirmMsg)) return false;

        try {
            await onDelete(filePath, type);
            onRefresh();
            return true;
        } catch (error) {
            alert('Failed to delete: ' + error.message);
            return false;
        }
    }
}
