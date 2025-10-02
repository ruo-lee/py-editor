const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const { spawn } = require('child_process');
const WebSocket = require('ws');
// const chokidar = require('chokidar'); // Reserved for future file watching
const multer = require('multer');
const archiver = require('archiver');

const app = express();
const PORT = process.env.PORT || 8080;

// Structured logging utility
const logger = {
    log(level, message, extra = {}) {
        const logEntry = {
            level: level.toUpperCase(),
            iso_datetime: new Date().toISOString(),
            module: 'py-editor',
            ...extra,
            message,
        };
        console.log(JSON.stringify(logEntry));
    },
    info(message, extra) {
        this.log('INFO', message, extra);
    },
    warn(message, extra) {
        this.log('WARN', message, extra);
    },
    error(message, extra) {
        this.log('ERROR', message, extra);
    },
    debug(message, extra) {
        if (process.env.DEBUG) {
            this.log('DEBUG', message, extra);
        }
    },
};

// Multer 설정 (파일 업로드)
const upload = multer({ dest: '/tmp/uploads/' });

// Path validation and base path utilities
// Support both Docker (/app/workspace) and local dev (../workspace)
const WORKSPACE_ROOT =
    process.env.WORKSPACE_ROOT ||
    (fsSync.existsSync('/app/workspace')
        ? '/app/workspace'
        : path.join(__dirname, '..', 'workspace'));

function validateAndResolvePath(requestedPath) {
    // Normalize the path and resolve it
    const normalizedPath = path.normalize(requestedPath).replace(/^(\.\.[\\/])+/, '');
    const fullPath = path.join(WORKSPACE_ROOT, normalizedPath);

    // Security: Ensure the path is within workspace
    if (!fullPath.startsWith(WORKSPACE_ROOT)) {
        throw new Error('Access denied: Path outside workspace');
    }

    return fullPath;
}

function getBasePath(req) {
    const folderParam = req.query.folder || req.headers['x-workspace-folder'];

    // Empty or root folder should use WORKSPACE_ROOT
    if (!folderParam || folderParam.trim() === '' || folderParam === '/') {
        return WORKSPACE_ROOT;
    }

    try {
        return validateAndResolvePath(folderParam);
    } catch (error) {
        logger.warn('Invalid folder parameter', { folder: folderParam, error: error.message });
        return WORKSPACE_ROOT;
    }
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client/dist')));

// Serve workspace files
app.use('/workspace', express.static('/app/workspace'));

// File system operations
app.get('/api/files', async (req, res) => {
    try {
        const basePath = getBasePath(req);
        const files = await getDirectoryStructure(basePath, basePath);

        // Return base path info for client
        res.json({
            basePath: basePath.replace(WORKSPACE_ROOT, ''),
            files: files,
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/files/*', async (req, res) => {
    try {
        const basePath = getBasePath(req);
        const filePath = path.join(basePath, req.params[0]);
        const content = await fs.readFile(filePath, 'utf8');
        res.json({ content });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/files/*', async (req, res) => {
    try {
        const basePath = getBasePath(req);
        const filePath = path.join(basePath, req.params[0]);
        const { content } = req.body;

        // Ensure directory exists
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, content, 'utf8');

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/files/*', async (req, res) => {
    try {
        const basePath = getBasePath(req);
        const filePath = path.join(basePath, req.params[0]);
        const stat = await fs.stat(filePath);

        if (stat.isDirectory()) {
            await fs.rm(filePath, { recursive: true });
        } else {
            await fs.unlink(filePath);
        }

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 디렉토리 생성
app.post('/api/mkdir', async (req, res) => {
    try {
        const basePath = getBasePath(req);
        const { path: dirPath } = req.body;
        const fullPath = path.join(basePath, dirPath);

        await fs.mkdir(fullPath, { recursive: true });

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 파일/폴더 이동
app.post('/api/move', async (req, res) => {
    try {
        const basePath = getBasePath(req);
        const { source, destination } = req.body;
        const sourcePath = path.join(basePath, source);
        const destPath = path.join(basePath, destination);

        // 대상 디렉토리가 존재하는지 확인
        await fs.mkdir(path.dirname(destPath), { recursive: true });

        // 파일/폴더 이동
        await fs.rename(sourcePath, destPath);

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 외부 파일 업로드
app.post('/api/upload', upload.array('files'), async (req, res) => {
    try {
        const basePath = getBasePath(req);
        const { targetPath } = req.body;
        const relativePaths = req.body.relativePaths;

        logger.info('File upload request', {
            basePath,
            targetPath,
            fileCount: req.files?.length || 0,
            hasRelativePaths: !!relativePaths,
        });

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No files provided' });
        }

        const uploadedFiles = [];

        // Convert relativePaths to array if it's a single string
        const relativePathsArray = Array.isArray(relativePaths)
            ? relativePaths
            : relativePaths
              ? [relativePaths]
              : [];

        for (let i = 0; i < req.files.length; i++) {
            const file = req.files[i];

            // Use relative path if provided (directory upload), otherwise use original filename
            const relativePath = relativePathsArray[i] || file.originalname;
            const destPath = path.join(basePath, targetPath || '', relativePath);

            // 대상 디렉토리가 존재하는지 확인
            await fs.mkdir(path.dirname(destPath), { recursive: true });

            // 파일 복사 후 삭제 (cross-device 지원)
            await fs.copyFile(file.path, destPath);
            await fs.unlink(file.path);

            uploadedFiles.push({
                name: file.originalname,
                path: path.join(targetPath || '', relativePath),
            });

            logger.debug('File uploaded', {
                originalName: file.originalname,
                relativePath,
                destPath,
            });
        }

        logger.info('Upload completed', { fileCount: uploadedFiles.length });
        res.json({ success: true, files: uploadedFiles });
    } catch (error) {
        logger.error('Upload failed', { error: error.message, stack: error.stack });
        res.status(500).json({ error: error.message });
    }
});

// 파일/폴더 다운로드
app.get('/api/download/*', async (req, res) => {
    try {
        const basePath = getBasePath(req);
        const filePath = path.join(basePath, req.params[0]);
        const stat = await fs.stat(filePath);

        if (stat.isDirectory()) {
            // 폴더를 ZIP으로 압축해서 다운로드
            const folderName = path.basename(filePath);
            res.setHeader('Content-Type', 'application/zip');
            res.setHeader('Content-Disposition', `attachment; filename="${folderName}.zip"`);

            const archive = archiver('zip', { zlib: { level: 9 } });

            archive.on('error', (err) => {
                throw err;
            });

            archive.pipe(res);
            archive.directory(filePath, false);
            archive.finalize();
        } else {
            // 단일 파일 다운로드
            const fileName = path.basename(filePath);
            res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

            const fileStream = fsSync.createReadStream(filePath);
            fileStream.pipe(res);
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Snippets API
app.get('/api/snippets', async (req, res) => {
    try {
        const snippetsPath = '/app/snippets/python.json';
        const snippets = await fs.readFile(snippetsPath, 'utf8');
        res.json(JSON.parse(snippets));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Python standard library file access
app.get('/api/stdlib/*', async (req, res) => {
    try {
        const requestedPath = req.params[0];

        // Security: Only allow access to Python standard library paths
        const allowedPaths = [
            '/usr/local/lib/python3.11',
            '/usr/local/lib/python3.11/site-packages',
        ];

        let resolvedPath = null;
        for (const allowedPath of allowedPaths) {
            const candidatePath = path.join(allowedPath, requestedPath);
            if (candidatePath.startsWith(allowedPath)) {
                try {
                    await fs.access(candidatePath);
                    resolvedPath = candidatePath;
                    break;
                } catch {
                    // File doesn't exist, try next path
                }
            }
        }

        if (!resolvedPath) {
            return res.status(404).json({ error: 'File not found in Python standard library' });
        }

        const content = await fs.readFile(resolvedPath, 'utf8');
        res.json({ content, path: resolvedPath });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Python syntax checking (real-time)
app.post('/api/check-syntax', async (req, res) => {
    try {
        const { code, filename } = req.body;
        const tempFile = path.join('/tmp', filename || 'syntax_check.py');

        await fs.writeFile(tempFile, code);

        // Use Python's ast module for accurate syntax checking
        const python = spawn('python3', [
            '-c',
            `
import sys
import ast
import json

try:
    with open('${tempFile}', 'r', encoding='utf-8') as f:
        source_code = f.read()

    # Try to parse with ast for better error reporting
    ast.parse(source_code, filename='${tempFile}')
    print('{"status": "ok"}')

except SyntaxError as e:
    # Get accurate line and column information
    line = e.lineno if e.lineno else 1
    column = e.offset if e.offset else 1

    error_data = {
        "status": "error",
        "errors": [{
            "severity": "error",
            "line": line,
            "column": column,
            "endLine": line,
            "endColumn": column + 10,
            "message": str(e.msg),
            "type": "SyntaxError"
        }]
    }
    print(json.dumps(error_data))

except Exception as e:
    error_data = {
        "status": "error",
        "errors": [{
            "severity": "error",
            "line": 1,
            "column": 1,
            "endLine": 1,
            "endColumn": 10,
            "message": str(e),
            "type": type(e).__name__
        }]
    }
    print(json.dumps(error_data))
`,
        ]);

        let output = '';
        let error = '';

        python.stdout.on('data', (data) => {
            output += data.toString();
        });

        python.stderr.on('data', (data) => {
            error += data.toString();
        });

        python.on('close', async (code) => {
            try {
                // Clean up temp file
                await fs.unlink(tempFile).catch(() => {});
                await fs.unlink(tempFile + 'c').catch(() => {}); // .pyc file

                // Parse output
                const result = JSON.parse(output.trim());
                res.json(result);
            } catch (parseError) {
                res.json({
                    status: 'error',
                    errors: [
                        {
                            severity: 'error',
                            line: 1,
                            column: 1,
                            message: error || 'Unknown syntax error',
                            type: 'ParseError',
                        },
                    ],
                });
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Python execution
app.post('/api/execute', async (req, res) => {
    try {
        const { code, filename } = req.body;
        const tempFile = path.join('/tmp', filename || 'temp.py');

        await fs.writeFile(tempFile, code);

        const python = spawn('python3', [tempFile]);
        let output = '';
        let error = '';

        python.stdout.on('data', (data) => {
            output += data.toString();
        });

        python.stderr.on('data', (data) => {
            error += data.toString();
        });

        python.on('close', (code) => {
            res.json({
                success: code === 0,
                output: output,
                error: error,
                exitCode: code,
            });
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

async function getDirectoryStructure(dirPath, basePath = '/app/workspace') {
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
