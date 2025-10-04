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

// POST /api/files/* - Write file content
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

module.exports = router;
