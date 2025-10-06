/**
 * fileService.js - File system operations service
 */

const fs = require('fs').promises;
const path = require('path');

/**
 * Get directory structure recursively
 */
async function getDirectoryStructure(dirPath, basePath) {
    const items = [];
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        const relativePath = path.relative(basePath, fullPath);

        if (entry.isDirectory()) {
            const children = await getDirectoryStructure(fullPath, basePath);
            items.push({
                name: entry.name,
                type: 'directory',
                path: relativePath,
                children,
            });
        } else {
            items.push({
                name: entry.name,
                type: 'file',
                path: relativePath,
            });
        }
    }

    return items.sort((a, b) => {
        if (a.type !== b.type) {
            return a.type === 'directory' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
    });
}

/**
 * Read file content
 */
async function readFile(filePath) {
    return await fs.readFile(filePath, 'utf8');
}

/**
 * Write file content
 */
async function writeFile(filePath, content) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, 'utf8');
}

/**
 * Delete file or directory
 */
async function deleteItem(itemPath) {
    const stat = await fs.stat(itemPath);
    if (stat.isDirectory()) {
        await fs.rm(itemPath, { recursive: true });
    } else {
        await fs.unlink(itemPath);
    }
}

/**
 * Create directory
 */
async function createDirectory(dirPath) {
    await fs.mkdir(dirPath, { recursive: true });
}

/**
 * Move/rename file or directory
 */
async function moveItem(sourcePath, targetPath) {
    await fs.rename(sourcePath, targetPath);
}

/**
 * Copy file or directory recursively
 */
async function copyItem(sourcePath, targetPath) {
    const stat = await fs.stat(sourcePath);

    if (stat.isDirectory()) {
        await fs.mkdir(targetPath, { recursive: true });
        const entries = await fs.readdir(sourcePath, { withFileTypes: true });

        for (const entry of entries) {
            await copyItem(path.join(sourcePath, entry.name), path.join(targetPath, entry.name));
        }
    } else {
        await fs.copyFile(sourcePath, targetPath);
    }
}

module.exports = {
    getDirectoryStructure,
    readFile,
    writeFile,
    deleteItem,
    createDirectory,
    moveItem,
    copyItem,
};
