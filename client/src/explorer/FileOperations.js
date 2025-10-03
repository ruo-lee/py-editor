/**
 * FileOperations.js
 *
 * Handles file and directory operations via API calls:
 * - Create, read, update, delete files/directories
 * - Rename, duplicate, move operations
 * - Upload/download operations
 */

export class FileOperations {
    constructor(apiBaseUrl = '') {
        this.apiBaseUrl = apiBaseUrl;
    }

    /**
     * Load file explorer structure from server
     */
    async loadFileExplorer() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/files`);
            if (!response.ok) {
                throw new Error('Failed to load file explorer');
            }
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error loading file explorer:', error);
            throw error;
        }
    }

    /**
     * Create a new file
     * @param {string} fileName - Name of the file to create
     * @param {string} directory - Directory path (optional)
     */
    async createFile(fileName, directory = '') {
        try {
            const filePath = directory ? `${directory}/${fileName}` : fileName;
            const response = await fetch(`${this.apiBaseUrl}/api/files`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: filePath, content: '' }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to create file');
            }

            return await response.json();
        } catch (error) {
            console.error('Error creating file:', error);
            throw error;
        }
    }

    /**
     * Create a new directory
     * @param {string} folderName - Name of the folder to create
     * @param {string} directory - Parent directory path (optional)
     */
    async createDirectory(folderName, directory = '') {
        try {
            const folderPath = directory ? `${directory}/${folderName}` : folderName;
            const response = await fetch(`${this.apiBaseUrl}/api/directories`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: folderPath }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to create directory');
            }

            return await response.json();
        } catch (error) {
            console.error('Error creating directory:', error);
            throw error;
        }
    }

    /**
     * Read file content
     * @param {string} filePath - Path to the file
     */
    async readFile(filePath) {
        try {
            const response = await fetch(
                `${this.apiBaseUrl}/api/files/${encodeURIComponent(filePath)}`
            );

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to read file');
            }

            const data = await response.json();
            return data.content;
        } catch (error) {
            console.error('Error reading file:', error);
            throw error;
        }
    }

    /**
     * Save file content
     * @param {string} filePath - Path to the file
     * @param {string} content - File content
     */
    async saveFile(filePath, content) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/files`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: filePath, content }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to save file');
            }

            return await response.json();
        } catch (error) {
            console.error('Error saving file:', error);
            throw error;
        }
    }

    /**
     * Delete a file or directory
     * @param {string} path - Path to the file/directory
     * @param {string} type - 'file' or 'directory'
     */
    async deleteItem(path, type) {
        try {
            const endpoint =
                type === 'directory'
                    ? `${this.apiBaseUrl}/api/directories/${encodeURIComponent(path)}`
                    : `${this.apiBaseUrl}/api/files/${encodeURIComponent(path)}`;

            const response = await fetch(endpoint, {
                method: 'DELETE',
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to delete item');
            }

            return await response.json();
        } catch (error) {
            console.error('Error deleting item:', error);
            throw error;
        }
    }

    /**
     * Rename a file or directory
     * @param {string} oldPath - Current path
     * @param {string} newName - New name
     */
    async renameItem(oldPath, newName) {
        try {
            const pathParts = oldPath.split('/');
            pathParts[pathParts.length - 1] = newName;
            const newPath = pathParts.join('/');

            const response = await fetch(`${this.apiBaseUrl}/api/move`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sourcePath: oldPath, targetPath: newPath }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to rename item');
            }

            return await response.json();
        } catch (error) {
            console.error('Error renaming item:', error);
            throw error;
        }
    }

    /**
     * Duplicate a file or directory
     * @param {string} sourcePath - Path to duplicate
     * @param {string} type - 'file' or 'directory'
     */
    async duplicateItem(sourcePath, type) {
        try {
            // Generate new name (add "- Copy" suffix)
            const pathParts = sourcePath.split('/');
            const fileName = pathParts[pathParts.length - 1];
            const fileExt = fileName.includes('.') ? `.${fileName.split('.').pop()}` : '';
            const baseName = fileExt ? fileName.slice(0, -fileExt.length) : fileName;
            const newName = `${baseName} - Copy${fileExt}`;
            pathParts[pathParts.length - 1] = newName;
            const targetPath = pathParts.join('/');

            const response = await fetch(`${this.apiBaseUrl}/api/duplicate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sourcePath, targetPath }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to duplicate item');
            }

            return await response.json();
        } catch (error) {
            console.error('Error duplicating item:', error);
            throw error;
        }
    }

    /**
     * Move a file or directory
     * @param {string} sourcePath - Source path
     * @param {string} targetDirectory - Target directory path
     */
    async moveItem(sourcePath, targetDirectory) {
        try {
            const fileName = sourcePath.split('/').pop();
            const targetPath = targetDirectory ? `${targetDirectory}/${fileName}` : fileName;

            const response = await fetch(`${this.apiBaseUrl}/api/move`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sourcePath, targetPath }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to move item');
            }

            return await response.json();
        } catch (error) {
            console.error('Error moving item:', error);
            throw error;
        }
    }

    /**
     * Download a file or directory
     * @param {string} path - Path to download
     */
    async downloadItem(path) {
        try {
            const url = `${this.apiBaseUrl}/api/download/${encodeURIComponent(path)}`;
            const link = document.createElement('a');
            link.href = url;
            link.download = path.split('/').pop();
            link.click();
        } catch (error) {
            console.error('Error downloading item:', error);
            throw error;
        }
    }

    /**
     * Upload files to a directory
     * @param {FileList} files - Files to upload
     * @param {string} targetDirectory - Target directory path
     */
    async uploadFiles(files, targetDirectory = '') {
        try {
            const formData = new FormData();
            formData.append('targetDir', targetDirectory);

            for (let i = 0; i < files.length; i++) {
                formData.append('files', files[i]);
            }

            const response = await fetch(`${this.apiBaseUrl}/api/upload`, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to upload files');
            }

            return await response.json();
        } catch (error) {
            console.error('Error uploading files:', error);
            throw error;
        }
    }

    /**
     * Upload a directory structure
     * @param {DataTransferItemList} items - Drag-and-drop items
     * @param {string} targetDirectory - Target directory path
     */
    async uploadDirectory(items, targetDirectory = '') {
        const files = [];

        // Recursively read directory entries
        const readEntry = async (entry, path = '') => {
            if (entry.isFile) {
                return new Promise((resolve) => {
                    entry.file((file) => {
                        files.push({ file, path: path + file.name });
                        resolve();
                    });
                });
            } else if (entry.isDirectory) {
                const dirReader = entry.createReader();
                const entries = await new Promise((resolve) => {
                    dirReader.readEntries((entries) => resolve(entries));
                });

                for (const childEntry of entries) {
                    await readEntry(childEntry, path + entry.name + '/');
                }
            }
        };

        // Process all items
        for (let i = 0; i < items.length; i++) {
            const entry = items[i].webkitGetAsEntry();
            if (entry) {
                await readEntry(entry);
            }
        }

        // Upload all collected files
        const formData = new FormData();
        formData.append('targetDir', targetDirectory);

        files.forEach(({ file, path }) => {
            formData.append('files', file);
            formData.append('paths', path);
        });

        const response = await fetch(`${this.apiBaseUrl}/api/upload-directory`, {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to upload directory');
        }

        return await response.json();
    }

    /**
     * Copy text to clipboard
     * @param {string} text - Text to copy
     */
    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
        } catch (error) {
            // Fallback for older browsers
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
        }
    }
}
