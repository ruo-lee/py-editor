import * as monaco from 'monaco-editor';

/**
 * FileOperationsAdvanced - Advanced file operations (duplicate, delete, move, copy)
 */
export class FileOperationsAdvanced {
    constructor(context) {
        this.context = context;

        // Cache for file existence checks
        this.fileExistsCache = new Map();
        this.cacheTimeout = 3000; // 3 seconds cache
    }

    async duplicateItem(filePath, type) {
        const fileName = filePath.split('/').pop();
        const extension = fileName.includes('.') ? '.' + fileName.split('.').pop() : '';
        const baseName = fileName.replace(extension, '');
        const parentPath = filePath.substring(0, filePath.lastIndexOf('/'));

        let copyName = `${baseName}_copy${extension}`;
        let counter = 1;

        // Check if copy already exists and increment counter
        while (await this.fileExists(parentPath ? `${parentPath}/${copyName}` : copyName)) {
            copyName = `${baseName}_copy${counter}${extension}`;
            counter++;
        }

        try {
            // Save expanded folder states before reloading
            const expandedFolders = this.context.fileExplorerInstance.getExpandedFolders();

            const newPath = parentPath ? `${parentPath}/${copyName}` : copyName;
            await this.copyItem(filePath, newPath, type);

            // Reload and restore expanded folders
            await this.context.loadFileExplorer();

            // Restore expanded folders after a short delay to ensure DOM is ready
            setTimeout(() => {
                this.context.fileExplorerInstance.restoreExpandedFolders(expandedFolders);
            }, 100);
        } catch (error) {
            alert('Failed to duplicate: ' + error.message);
        }
    }

    async deleteItem(filePath, type, skipConfirmation = false) {
        const performDelete = async (path, type) => {
            const response = await fetch(this.context.buildUrl(`/api/files/${path}`), {
                method: 'DELETE',
                headers: this.context.getFetchHeaders(),
            });

            if (!response.ok) {
                throw new Error('Failed to delete item');
            }

            // Close tab if file is open
            if (type === 'file' && this.context.openTabs.has(path)) {
                this.context.closeTab(path);
            }

            // Close all tabs in folder if folder is deleted
            if (type === 'folder') {
                const tabsToClose = [];
                for (const tabPath of this.context.openTabs.keys()) {
                    if (tabPath.startsWith(path + '/')) {
                        tabsToClose.push(tabPath);
                    }
                }
                tabsToClose.forEach((tabPath) => this.context.closeTab(tabPath));
            }

            // Clear selected directory if it was deleted or is a child of deleted directory
            if (
                this.context.selectedDirectory === path ||
                this.context.selectedDirectory.startsWith(path + '/')
            ) {
                this.context.selectedDirectory = '';
            }
        };

        const afterDelete = async () => {
            // Save expanded folder states before reloading
            const expandedFolders = this.context.fileExplorerInstance.getExpandedFolders();

            await this.context.loadFileExplorer();

            // Restore expanded folders after a short delay
            setTimeout(() => {
                this.context.fileExplorerInstance.restoreExpandedFolders(expandedFolders);
            }, 100);
        };

        if (skipConfirmation) {
            // Skip confirmation and delete directly
            await performDelete(filePath, type);
        } else {
            // Show confirmation dialog
            await this.context.dialogManager.showDeleteConfirmation(
                filePath,
                type,
                performDelete,
                afterDelete
            );
        }
    }

    async moveItem(oldPath, newPath) {
        // Use the /api/move endpoint for both files and folders
        const response = await fetch(this.context.buildUrl('/api/move'), {
            method: 'POST',
            headers: this.context.getFetchHeaders(),
            body: JSON.stringify({
                sourcePath: oldPath,
                targetPath: newPath,
            }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to move item');
        }

        // Update selected directory if it was moved
        if (this.context.selectedDirectory === oldPath) {
            this.context.selectedDirectory = newPath;
        } else if (this.context.selectedDirectory.startsWith(oldPath + '/')) {
            this.context.selectedDirectory = this.context.selectedDirectory.replace(
                oldPath,
                newPath
            );
        }

        // Check if file is open in both editors
        const isOpenInLeft = this.context.openTabs.has(oldPath);
        const isOpenInRight = this.context.rightOpenTabs && this.context.rightOpenTabs.has(oldPath);

        // Get model once before any disposal
        let oldModel = null;
        let content = null;
        let language = null;

        if (isOpenInLeft) {
            oldModel = this.context.openTabs.get(oldPath).model;
            content = oldModel.getValue();
            language = oldModel.getLanguageId();
        } else if (isOpenInRight) {
            oldModel = this.context.rightOpenTabs.get(oldPath).model;
            content = oldModel.getValue();
            language = oldModel.getLanguageId();
        }

        // Create new model once if file is open anywhere
        let newModel = null;
        if (oldModel) {
            newModel = monaco.editor.createModel(content, language, monaco.Uri.file(newPath));
        }

        // Update left editor if file is open
        if (isOpenInLeft) {
            const tabData = this.context.openTabs.get(oldPath);

            // Update tab data
            this.context.openTabs.delete(oldPath);
            this.context.openTabs.set(newPath, {
                ...tabData,
                model: newModel,
            });
            this.context.activeFile = newPath;

            // Update editor model
            this.context.editor.setModel(newModel);

            // Notify LSP: close old file, open new file
            this.context.notifyDocumentClosed(oldPath);
            this.context.notifyDocumentOpened(newPath, content);

            // Update tab display
            const tab = document.querySelector(
                `#tabBar [data-filepath="${oldPath}"], #tabBar [data-file="${oldPath}"]`
            );
            if (tab) {
                tab.setAttribute('data-filepath', newPath);
                tab.setAttribute('data-file', newPath);
                const label = tab.querySelector('.tab-label');
                if (label) {
                    label.textContent = newPath.split('/').pop();
                    label.setAttribute('title', newPath);
                }
            }
        }

        // Update right editor if file is open
        if (isOpenInRight) {
            const tabData = this.context.rightOpenTabs.get(oldPath);

            // Update tab data
            this.context.rightOpenTabs.delete(oldPath);
            this.context.rightOpenTabs.set(newPath, {
                ...tabData,
                model: newModel,
            });

            if (this.context.rightActiveFile === oldPath) {
                this.context.rightActiveFile = newPath;
            }

            // Update right editor model if this file is currently active
            if (this.context.rightEditor && this.context.rightActiveFile === newPath) {
                this.context.rightEditor.setModel(newModel);
            }

            // Update tab display for right editor
            const tab = document.querySelector(
                `#tabBar2 [data-filepath="${oldPath}"], #tabBar2 [data-file="${oldPath}"]`
            );
            if (tab) {
                tab.setAttribute('data-filepath', newPath);
                tab.setAttribute('data-file', newPath);
                const label = tab.querySelector('.tab-label');
                if (label) {
                    label.textContent = newPath.split('/').pop();
                    label.setAttribute('title', newPath);
                }
            }
        }

        // Dispose old model only after both editors are updated
        if (oldModel) {
            oldModel.dispose();
        }

        // Update file path display bars for both editors (always update if file is active)
        if (isOpenInLeft && this.context.activeFile === newPath) {
            const filePathBar = document.getElementById('filePathBar');
            if (filePathBar && this.context.updateFilePathDisplayForElement) {
                this.context.updateFilePathDisplayForElement(filePathBar, newPath, false);
            }
        }

        if (isOpenInRight && this.context.rightActiveFile === newPath) {
            const rightFilePathBar = document.getElementById('filePathBar2');
            if (rightFilePathBar && this.context.updateFilePathDisplayForElement) {
                this.context.updateFilePathDisplayForElement(rightFilePathBar, newPath, false);
            }
        }
    }

    async copyItem(sourcePath, targetPath, _type) {
        // Use the new /api/duplicate endpoint which supports both files and directories
        const response = await fetch(this.context.buildUrl('/api/duplicate'), {
            method: 'POST',
            headers: {
                ...this.context.getFetchHeaders(),
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ sourcePath, targetPath }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to duplicate item');
        }
    }

    async fileExists(filePath) {
        // Check cache first
        const cached = this.fileExistsCache.get(filePath);
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached.exists;
        }

        try {
            const response = await fetch(this.context.buildUrl(`/api/files/${filePath}`), {
                headers: this.context.getFetchHeaders(),
            });
            const exists = response.ok;

            // Cache the result
            this.fileExistsCache.set(filePath, {
                exists,
                timestamp: Date.now(),
            });

            return exists;
        } catch {
            // Cache negative result
            this.fileExistsCache.set(filePath, {
                exists: false,
                timestamp: Date.now(),
            });
            return false;
        }
    }

    async renameItem(filePath, type) {
        this.context.dialogManager.showRenameDialog(
            filePath,
            type,
            (oldPath, newPath) => this.moveItem(oldPath, newPath),
            async () => {
                // Save expanded folder states before reloading
                const expandedFolders = this.context.fileExplorerInstance.getExpandedFolders();

                await this.context.loadFileExplorer();

                // Restore expanded folders after a short delay
                setTimeout(() => {
                    this.context.fileExplorerInstance.restoreExpandedFolders(expandedFolders);
                }, 100);
            }
        );
    }
}
