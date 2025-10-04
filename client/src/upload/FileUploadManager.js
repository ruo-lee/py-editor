/**
 * FileUploadManager.js
 * Manages file upload and drag-and-drop operations
 */

export class FileUploadManager {
    constructor(context) {
        this.context = context;
    }

    /**
     * Handle item move (drag and drop within explorer)
     */
    async handleItemMove(draggedItem, targetPath) {
        // targetPath can be empty string for root, so check for undefined/null only
        if (!draggedItem || targetPath === undefined || targetPath === null) return;

        // Prevent moving into itself
        if (
            draggedItem.type === 'directory' &&
            targetPath &&
            targetPath.startsWith(draggedItem.path)
        ) {
            alert('Cannot move a folder into itself');
            return;
        }

        // Check if item with same name exists
        const newPath = targetPath ? `${targetPath}/${draggedItem.name}` : draggedItem.name;
        if (newPath !== draggedItem.path) {
            // Check if target exists
            if (await this.context.checkIfFileExists(newPath)) {
                if (!confirm(`"${draggedItem.name}" already exists. Do you want to replace it?`)) {
                    return;
                }
            }

            try {
                // Save expanded folder states before moving
                const expandedFolders = this.context.fileExplorerInstance.getExpandedFolders();

                await this.context.moveItem(draggedItem.path, newPath);
                await this.context.loadFileExplorer();

                // Restore expanded folders and selection after move
                setTimeout(() => {
                    this.context.fileExplorerInstance.restoreExpandedFolders(expandedFolders);
                    this.context.fileExplorerInstance.restoreSelection(targetPath);
                }, 100);
            } catch (error) {
                console.error('Failed to move item:', error);
                alert('Failed to move item: ' + error.message);
            }
        }
    }

    /**
     * Handle external file drop
     */
    async handleExternalFileDrop(files, targetPath) {
        await this.handleDroppedItems(files, targetPath);
    }

    /**
     * Handle dropped items (from external drag)
     */
    async handleDroppedItems(items, targetPath) {
        try {
            const allFiles = [];

            for (const item of items) {
                if (item.kind === 'file') {
                    const entry = item.webkitGetAsEntry();
                    if (entry) {
                        await this.traverseFileTree(entry, targetPath, allFiles);
                    }
                }
            }

            if (allFiles.length > 0) {
                await this.handleFileUpload(allFiles, targetPath);
            }
        } catch (error) {
            console.error('Failed to process dropped items:', error);
            alert('Failed to process dropped items: ' + error.message);
        }
    }

    /**
     * Traverse file tree for directory uploads
     */
    async traverseFileTree(item, path, allFiles) {
        if (item.isFile) {
            return new Promise((resolve) => {
                item.file((file) => {
                    const fullPath = path ? `${path}/${file.name}` : file.name;
                    allFiles.push({ file, path: fullPath });
                    resolve();
                });
            });
        } else if (item.isDirectory) {
            const dirReader = item.createReader();
            return new Promise((resolve) => {
                dirReader.readEntries(async (entries) => {
                    for (const entry of entries) {
                        const newPath = path ? `${path}/${item.name}` : item.name;
                        await this.traverseFileTree(entry, newPath, allFiles);
                    }
                    resolve();
                });
            });
        }
    }

    /**
     * Handle file upload
     */
    async handleFileUpload(filesOrArray, targetPath) {
        try {
            let filesToUpload = [];

            // Check if it's already an array with {file, path} objects
            if (Array.isArray(filesOrArray) && filesOrArray.length > 0 && filesOrArray[0].file) {
                // Already in correct format from traverseFileTree
                filesToUpload = filesOrArray;
            } else {
                // Convert FileList or File array to {file, path} format
                for (const file of filesOrArray) {
                    const fullPath = targetPath ? `${targetPath}/${file.name}` : file.name;
                    filesToUpload.push({ file, path: fullPath });
                }
            }

            for (const { file, path } of filesToUpload) {
                const content = await file.text();

                const response = await fetch(this.context.buildUrl(`/api/files/${path}`), {
                    method: 'POST',
                    headers: this.context.getFetchHeaders(),
                    body: JSON.stringify({ content }),
                });

                if (!response.ok) {
                    throw new Error(`Failed to upload ${file.name}`);
                }
            }

            this.context.loadFileExplorer();
        } catch (error) {
            console.error('Failed to upload files:', error);
            alert('Failed to upload files: ' + error.message);
        }
    }
}
