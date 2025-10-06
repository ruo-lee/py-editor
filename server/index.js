const express = require('express');
const cors = require('cors');
const path = require('path');
const WebSocket = require('ws');

// Import utilities
const logger = require('./utils/logger');
const { WORKSPACE_ROOT } = require('./utils/pathUtils');
const { getLSPProcessPool } = require('./services/lspProcessPool');

// Import routes
const filesRouter = require('./routes/files');
const workspaceRouter = require('./routes/workspace');
const executionRouter = require('./routes/execution');

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client/dist')));

// Serve workspace files
app.use('/workspace', express.static('/app/workspace'));

// Routes
app.use('/api/files', filesRouter);
app.use('/api', workspaceRouter);
app.use('/api', executionRouter);

// Version endpoint
app.get('/api/version', (req, res) => {
    res.json({ version: process.env.APP_VERSION || 'dev' });
});

// Python version endpoint
app.get('/api/python-version', (req, res) => {
    const { exec } = require('child_process');
    exec('python3 --version', (error, stdout, stderr) => {
        if (error) {
            return res.json({ version: 'Python 3.11' });
        }
        const version = stdout.trim() || stderr.trim() || 'Python 3.11';
        res.json({ version });
    });
});

// WebSocket server for language server
const server = require('http').createServer(app);
const wss = new WebSocket.Server({ server });

// Initialize LSP process pool
const lspPool = getLSPProcessPool({
    maxProcesses: 20,
    idleTimeout: 300000, // 5 minutes
});

wss.on('connection', (ws) => {
    logger.info('Language server client connected');

    // Generate unique user ID for this connection
    const userId = `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Send userId to client
    ws.send(JSON.stringify({ type: 'userId', userId }));

    let pylsp = null;
    let messageBuffer = '';
    let pendingRequests = new Map();
    const MAX_BUFFER_SIZE = 1024 * 1024; // 1MB buffer limit for memory optimization
    const REQUEST_TIMEOUT = 30000; // 30 seconds timeout for pending requests

    // Periodic cleanup of stale pending requests for memory optimization
    const cleanupInterval = setInterval(() => {
        const now = Date.now();
        for (const [id, reqData] of pendingRequests.entries()) {
            if (typeof reqData === 'object' && now - reqData.timestamp > REQUEST_TIMEOUT) {
                logger.debug('Removing stale request', { id, method: reqData.method, userId });
                pendingRequests.delete(id);
            }
        }
    }, 60000); // Run every minute

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            logger.debug('Received LSP message', { method: data.method, id: data.id });

            // Store pending requests with timestamp for cleanup
            if (data.id && data.method) {
                pendingRequests.set(data.id, {
                    method: data.method,
                    timestamp: Date.now(),
                });
            }

            if (data.method === 'initialize') {
                // Get pylsp process from pool (reuse if available)
                lspPool
                    .getProcess(userId)
                    .then((process) => {
                        pylsp = process;

                        pylsp.on('error', (error) => {
                            logger.error('Failed to start pylsp from pool', {
                                userId,
                                error: error.message,
                            });
                            // Send error response to client
                            ws.send(
                                JSON.stringify({
                                    jsonrpc: '2.0',
                                    id: data.id,
                                    error: {
                                        code: -32099,
                                        message:
                                            'Python Language Server not available. Install pylsp with: pip install python-lsp-server',
                                    },
                                })
                            );
                        });

                        // Setup stdout handler inside Promise
                        pylsp.stdout.on('data', (chunk) => {
                            try {
                                messageBuffer += chunk.toString();

                                // Memory optimization: limit buffer size to prevent memory bloat
                                if (messageBuffer.length > MAX_BUFFER_SIZE) {
                                    logger.warn(
                                        'Message buffer exceeded limit, clearing old data',
                                        {
                                            bufferLength: messageBuffer.length,
                                        }
                                    );
                                    // Keep only the last 100KB to avoid losing incomplete messages
                                    messageBuffer = messageBuffer.slice(-100 * 1024);
                                }

                                logger.debug('Received chunk from pylsp', {
                                    bufferLength: messageBuffer.length,
                                });

                                // Process complete LSP messages
                                // eslint-disable-next-line no-constant-condition
                                while (true) {
                                    // Look for Content-Length header anywhere in the header section
                                    const contentLengthMatch =
                                        messageBuffer.match(/Content-Length:\s*(\d+)/);
                                    if (!contentLengthMatch) {
                                        logger.debug('No Content-Length header found yet');
                                        break;
                                    }

                                    // Find the end of all headers (double newline)
                                    const headerEndMatch = messageBuffer.match(/\r?\n\r?\n/);
                                    if (!headerEndMatch) {
                                        logger.debug('No complete header section found yet');
                                        break;
                                    }

                                    const contentLength = parseInt(contentLengthMatch[1]);
                                    const headerEndIndex =
                                        headerEndMatch.index + headerEndMatch[0].length;

                                    const totalNeeded = headerEndIndex + contentLength;
                                    if (messageBuffer.length < totalNeeded) {
                                        logger.debug('Waiting for more data', {
                                            have: messageBuffer.length,
                                            need: totalNeeded,
                                        });
                                        break;
                                    }

                                    const content = messageBuffer.slice(
                                        headerEndIndex,
                                        headerEndIndex + contentLength
                                    );
                                    messageBuffer = messageBuffer.slice(
                                        headerEndIndex + contentLength
                                    );
                                    logger.debug('Processing complete LSP message', {
                                        contentLength,
                                        remainingBuffer: messageBuffer.length,
                                    });

                                    try {
                                        const response = JSON.parse(content);

                                        // Get the original request method and clean up
                                        let originalMethod = null;
                                        if (response.id) {
                                            const reqData = pendingRequests.get(response.id);
                                            originalMethod =
                                                typeof reqData === 'object'
                                                    ? reqData.method
                                                    : reqData;
                                            if (reqData) {
                                                pendingRequests.delete(response.id);
                                            }
                                        }

                                        logger.debug('Sending LSP response', {
                                            id: response.id,
                                            method: response.method,
                                            originalMethod: originalMethod,
                                            hasResult: !!response.result,
                                            hasError: !!response.error,
                                        });

                                        ws.send(JSON.stringify(response));
                                    } catch (parseError) {
                                        logger.error('Failed to parse LSP response', {
                                            error: parseError.message,
                                        });
                                    }
                                }
                            } catch (error) {
                                logger.error('Error processing pylsp output', {
                                    error: error.message,
                                });
                            }
                        });

                        pylsp.stderr.on('data', (data) => {
                            const output = data.toString().trim();
                            if (output) {
                                // Parse common pylsp stderr messages
                                if (output.includes('reformatted')) {
                                    logger.debug(output, { source: 'pylsp.formatter' });
                                } else if (output.includes('mypy')) {
                                    logger.debug(output, { source: 'pylsp.mypy' });
                                } else if (output.includes('ERROR') || output.includes('Error')) {
                                    logger.error(output, { source: 'pylsp' });
                                } else {
                                    logger.debug(output, { source: 'pylsp' });
                                }
                            }
                        });

                        pylsp.on('exit', (code) => {
                            logger.info('pylsp exited from pool', { userId, exitCode: code });
                            // Remove from pool on exit
                            lspPool.terminateProcess(userId);
                        });

                        // Send initialize request after pylsp is ready
                        if (pylsp && pylsp.stdin.writable) {
                            const content = JSON.stringify(data);
                            const header = `Content-Length: ${Buffer.byteLength(content)}\r\n\r\n`;
                            logger.debug('Sending initialize to pylsp', {
                                method: data.method,
                                id: data.id,
                            });
                            pylsp.stdin.write(header + content);
                        } else {
                            logger.error('pylsp stdin not writable after creation');
                        }
                    })
                    .catch((error) => {
                        logger.error('Failed to get pylsp from pool', {
                            userId,
                            error: error.message,
                        });
                        ws.send(
                            JSON.stringify({
                                jsonrpc: '2.0',
                                id: data.id,
                                error: {
                                    code: -32099,
                                    message: 'Python Language Server not available',
                                },
                            })
                        );
                        return;
                    });
            } else if (pylsp && pylsp.stdin.writable) {
                // Send other requests (non-initialize) to already initialized pylsp
                const content = JSON.stringify(data);
                const header = `Content-Length: ${Buffer.byteLength(content)}\r\n\r\n`;
                logger.debug('Sending to pylsp', { method: data.method, id: data.id });
                pylsp.stdin.write(header + content);
            } else if (data.method !== 'initialize') {
                logger.error('pylsp not ready or stdin not writable', { method: data.method });
            }
        } catch (error) {
            logger.error('WebSocket message error', { error: error.message });
        }
    });

    ws.on('close', () => {
        logger.info('Language server client disconnected', { userId });

        // Cleanup interval to prevent memory leak
        clearInterval(cleanupInterval);

        // Clear all pending requests to prevent memory leak
        pendingRequests.clear();

        // Clear message buffer to free memory
        messageBuffer = '';

        // Release process back to pool (don't kill it)
        if (pylsp) {
            lspPool.releaseProcess(userId);
        }
    });

    ws.on('error', (error) => {
        logger.error('WebSocket error', { userId, error: error.message });

        // Cleanup on error
        clearInterval(cleanupInterval);
        pendingRequests.clear();
        messageBuffer = '';

        if (pylsp) {
            lspPool.releaseProcess(userId);
        }
    });
});

// Serve SPA for HTML routes only (not static assets)
app.get('*', (req, res) => {
    // Only serve index.html for non-file requests
    if (req.path.includes('.')) {
        // If file extension exists and wasn't found by static middleware, return 404
        res.status(404).send('Not found');
    } else {
        // Serve index.html for SPA routes
        res.sendFile(path.join(__dirname, '../client/dist/index.html'));
    }
});

server.listen(PORT, '0.0.0.0', () => {
    logger.info('Python IDE server running', { port: PORT });
});
