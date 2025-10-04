const express = require('express');
const cors = require('cors');
const path = require('path');
const { spawn } = require('child_process');
const WebSocket = require('ws');

// Import utilities
const logger = require('./utils/logger');
const { WORKSPACE_ROOT } = require('./utils/pathUtils');

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

// WebSocket server for language server
const server = require('http').createServer(app);
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
    logger.info('Language server client connected');

    let pylsp = null;
    let messageBuffer = '';
    let pendingRequests = new Map();

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            logger.debug('Received LSP message', { method: data.method, id: data.id });

            // Store pending requests for debugging
            if (data.id && data.method) {
                pendingRequests.set(data.id, data.method);
            }

            if (data.method === 'initialize') {
                // Start Python Language Server with proper configuration
                try {
                    pylsp = spawn('pylsp', ['-v'], {
                        stdio: ['pipe', 'pipe', 'pipe'],
                        cwd: WORKSPACE_ROOT,
                        env: {
                            ...process.env,
                            PYTHONPATH:
                                WORKSPACE_ROOT +
                                ':/usr/local/lib/python3.11:/usr/local/lib/python3.11/site-packages',
                            PYTHONHOME: '/usr/local',
                        },
                    });

                    pylsp.on('error', (error) => {
                        logger.error('Failed to start pylsp', { error: error.message });
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
                } catch (error) {
                    logger.error('Failed to spawn pylsp', { error: error.message });
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
                }

                pylsp.stdout.on('data', (chunk) => {
                    try {
                        messageBuffer += chunk.toString();
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
                            const headerEndIndex = headerEndMatch.index + headerEndMatch[0].length;

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
                            messageBuffer = messageBuffer.slice(headerEndIndex + contentLength);
                            logger.debug('Processing complete LSP message', {
                                contentLength,
                                remainingBuffer: messageBuffer.length,
                            });

                            try {
                                const response = JSON.parse(content);

                                // Get the original request method
                                const originalMethod = response.id
                                    ? pendingRequests.get(response.id)
                                    : null;
                                if (response.id && originalMethod) {
                                    pendingRequests.delete(response.id);
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
                        logger.error('Error processing pylsp output', { error: error.message });
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
                    logger.info('pylsp exited', { exitCode: code });
                });
            }

            if (pylsp && pylsp.stdin.writable) {
                const content = JSON.stringify(data);
                const header = `Content-Length: ${Buffer.byteLength(content)}\r\n\r\n`;
                logger.debug('Sending to pylsp', { method: data.method, id: data.id });
                pylsp.stdin.write(header + content);
            } else {
                logger.error('pylsp not ready or stdin not writable');
            }
        } catch (error) {
            logger.error('WebSocket message error', { error: error.message });
        }
    });

    ws.on('close', () => {
        logger.info('Language server client disconnected');
        if (pylsp) {
            pylsp.kill();
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
