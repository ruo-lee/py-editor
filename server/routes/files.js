/**
 * files.js - File operations routes
 */

const express = require('express');
const path = require('path');
const router = express.Router();
const fileService = require('../services/fileService');
const { getBasePath } = require('../utils/pathUtils');

// GET /api/files - List directory structure
router.get('/', async (req, res) => {
    try {
        const basePath = getBasePath(req);
        const files = await fileService.getDirectoryStructure(basePath, basePath);

        res.json({
            basePath: basePath.replace(require('../utils/pathUtils').WORKSPACE_ROOT, ''),
            files: files,
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/files/* - Read file content
router.get('/*', async (req, res) => {
    try {
        const basePath = getBasePath(req);
        const decodedPath = decodeURIComponent(req.params[0]);
        const filePath = path.join(basePath, decodedPath);
        const content = await fileService.readFile(filePath);
        res.json({ content });
    } catch (error) {
        if (error.code === 'ENOENT') {
            res.status(404).json({ error: 'File not found' });
        } else {
            res.status(500).json({ error: error.message });
        }
    }
});

// POST /api/files - Create/Write file with path in body
router.post('/', async (req, res) => {
    try {
        const basePath = getBasePath(req);
        const { path: filePath, content = '' } = req.body;

        if (!filePath) {
            return res.status(400).json({ error: 'File path is required' });
        }

        const fullPath = path.join(basePath, filePath);
        await fileService.writeFile(fullPath, content);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/files/* - Write file content (URL-based path)
router.post('/*', async (req, res) => {
    try {
        const basePath = getBasePath(req);
        const decodedPath = decodeURIComponent(req.params[0]);
        const filePath = path.join(basePath, decodedPath);
        const { content } = req.body;

        await fileService.writeFile(filePath, content);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/files/* - Delete file or directory
router.delete('/*', async (req, res) => {
    try {
        const basePath = getBasePath(req);
        const decodedPath = decodeURIComponent(req.params[0]);
        const filePath = path.join(basePath, decodedPath);

        await fileService.deleteItem(filePath);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/files/cleanup-test-files - Clean up test files (for testing)
router.post('/cleanup-test-files', async (req, res) => {
    try {
        const basePath = getBasePath(req);
        const fs = require('fs').promises;

        // Read all files in workspace
        const files = await fs.readdir(basePath);

        // Filter test files (files matching test patterns)
        const testFilePatterns = [
            /^test_.*\.py$/,
            /^.*_test_\d+\.py$/,
            /^delete_test.*\.py$/,
            /^rename_.*\.py$/,
            /^open_test.*\.py$/,
            /^save_test.*\.py$/,
            /^lsp_test.*\.py$/,
            /^file\d+_\d+\.py$/,
            /^closeable_\d+\.py$/,
            /^split_test_\d+\.py$/,
            /^path_test_\d+\.py$/,
            /^shortcut_test_\d+\.py$/,
        ];

        let filesRemoved = 0;

        for (const file of files) {
            const isTestFile = testFilePatterns.some((pattern) => pattern.test(file));
            if (isTestFile) {
                const filePath = path.join(basePath, file);
                try {
                    await fs.unlink(filePath);
                    filesRemoved++;
                    console.log(`Removed test file: ${file}`);
                } catch (err) {
                    console.error(`Failed to remove ${file}:`, err.message);
                }
            }
        }

        res.json({ success: true, filesRemoved });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
