/**
 * workspace.js - Workspace operations routes
 */

const express = require('express');
const path = require('path');
const multer = require('multer');
const archiver = require('archiver');
const fs = require('fs').promises;
const router = express.Router();
const fileService = require('../services/fileService');
const { getBasePath } = require('../utils/pathUtils');
const logger = require('../utils/logger');

const upload = multer({ dest: '/tmp/uploads/' });

// POST /api/mkdir - Create directory
router.post('/mkdir', async (req, res) => {
    try {
        const basePath = getBasePath(req);
        const { path: dirPath } = req.body;
        const fullPath = path.join(basePath, dirPath);

        await fileService.createDirectory(fullPath);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/move - Move/rename file or directory
router.post('/move', async (req, res) => {
    try {
        const basePath = getBasePath(req);
        const { sourcePath, targetPath } = req.body;
        const fullSourcePath = path.join(basePath, sourcePath);
        const fullTargetPath = path.join(basePath, targetPath);

        await fileService.moveItem(fullSourcePath, fullTargetPath);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/upload - Upload files
router.post('/upload', upload.array('files'), async (req, res) => {
    try {
        const basePath = getBasePath(req);
        const targetDir = req.body.targetDir || '';
        const uploadedFiles = [];

        for (const file of req.files) {
            const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
            const targetPath = path.join(basePath, targetDir, originalName);

            await fs.mkdir(path.dirname(targetPath), { recursive: true });
            await fs.rename(file.path, targetPath);

            uploadedFiles.push({
                name: originalName,
                path: path.relative(basePath, targetPath),
            });
        }

        res.json({
            success: true,
            files: uploadedFiles,
        });
    } catch (error) {
        logger.error('Upload failed', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

// GET /api/download/* - Download file or directory
router.get('/download/*', async (req, res) => {
    try {
        const basePath = getBasePath(req);
        const decodedPath = decodeURIComponent(req.params[0]);
        const itemPath = path.join(basePath, decodedPath);
        const stat = await fs.stat(itemPath);

        if (stat.isDirectory()) {
            // Create ZIP archive
            const archive = archiver('zip', { zlib: { level: 9 } });
            const fileName = path.basename(itemPath) + '.zip';

            res.attachment(fileName);
            archive.pipe(res);

            archive.directory(itemPath, false);
            await archive.finalize();
        } else {
            // Send file directly
            res.download(itemPath);
        }
    } catch (error) {
        logger.error('Download failed', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

// GET /api/snippets - Get Python snippets
router.get('/snippets', async (req, res) => {
    try {
        const snippetsPath = path.join(__dirname, '../snippets.json');
        const snippets = JSON.parse(await fs.readFile(snippetsPath, 'utf8'));
        res.json(snippets);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/stdlib/* - Get Python standard library file
router.get('/stdlib/*', async (req, res) => {
    try {
        const stdlibPath = req.params[0];
        const fullPath = path.join('/usr/lib/python3.11', stdlibPath);

        if (!fullPath.startsWith('/usr/lib/python3.11')) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const content = await fs.readFile(fullPath, 'utf8');
        res.json({ content });
    } catch (error) {
        if (error.code === 'ENOENT') {
            res.status(404).json({ error: 'File not found' });
        } else {
            res.status(500).json({ error: error.message });
        }
    }
});

module.exports = router;
