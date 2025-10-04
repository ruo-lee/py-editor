/**
 * execution.js - Python code execution routes
 */

const express = require('express');
const router = express.Router();
const executionService = require('../services/executionService');
const { getBasePath } = require('../utils/pathUtils');
const { proxyRequest } = require('../api-proxy');

// POST /api/check-syntax - Check Python syntax
router.post('/check-syntax', async (req, res) => {
    try {
        const { code, filename } = req.body;
        const result = await executionService.checkSyntax(code, filename);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/execute - Execute Python code
router.post('/execute', async (req, res) => {
    try {
        const { code, filename, input } = req.body;
        const basePath = getBasePath(req);

        const result = await executionService.executeCode(code, {
            filename,
            basePath,
            input,
        });

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/proxy-request - Proxy API requests
router.post('/proxy-request', async (req, res) => {
    try {
        const result = await proxyRequest(req.body);

        // Handle SSE responses
        if (result.isSSE) {
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');

            // Pipe the stream to client
            result.stream.pipe(res);

            result.stream.on('end', () => {
                res.end();
            });

            result.stream.on('error', (_error) => {
                res.end();
            });
        } else {
            // Regular JSON response
            res.json(result);
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
