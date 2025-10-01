const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const { spawn } = require('child_process');
const WebSocket = require('ws');
const chokidar = require('chokidar');
const multer = require('multer');
const archiver = require('archiver');

const app = express();
const PORT = process.env.PORT || 8080;

// Multer 설정 (파일 업로드)
const upload = multer({ dest: '/tmp/uploads/' });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client/dist')));

// Serve workspace files
app.use('/workspace', express.static('/app/workspace'));

// File system operations
app.get('/api/files', async (req, res) => {
  try {
    const workspacePath = '/app/workspace';
    const files = await getDirectoryStructure(workspacePath);
    res.json(files);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/files/*', async (req, res) => {
  try {
    const filePath = path.join('/app/workspace', req.params[0]);
    const content = await fs.readFile(filePath, 'utf8');
    res.json({ content });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/files/*', async (req, res) => {
  try {
    const filePath = path.join('/app/workspace', req.params[0]);
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
    const filePath = path.join('/app/workspace', req.params[0]);
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

// 파일/폴더 이동
app.post('/api/move', async (req, res) => {
  try {
    const { source, destination } = req.body;
    const sourcePath = path.join('/app/workspace', source);
    const destPath = path.join('/app/workspace', destination);

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
    const { targetPath } = req.body;
    const uploadedFiles = [];

    for (const file of req.files) {
      const destPath = path.join('/app/workspace', targetPath, file.originalname);

      // 대상 디렉토리가 존재하는지 확인
      await fs.mkdir(path.dirname(destPath), { recursive: true });

      // 파일 이동
      await fs.rename(file.path, destPath);

      uploadedFiles.push({
        name: file.originalname,
        path: path.join(targetPath, file.originalname)
      });
    }

    res.json({ success: true, files: uploadedFiles });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 파일/폴더 다운로드
app.get('/api/download/*', async (req, res) => {
  try {
    const filePath = path.join('/app/workspace', req.params[0]);
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
      '/usr/local/lib/python3.11/site-packages'
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
        exitCode: code
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
        children
      });
    } else {
      items.push({
        name: entry.name,
        type: 'file',
        path: relativePath
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
  console.log('Language server client connected');

  let pylsp = null;
  let messageBuffer = '';
  let pendingRequests = new Map();

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      console.log('Received LSP message:', data.method);

      // Store pending requests for debugging
      if (data.id && data.method) {
        pendingRequests.set(data.id, data.method);
      }

      if (data.method === 'initialize') {
        // Start Python Language Server with proper configuration
        pylsp = spawn('pylsp', ['-v'], {
          stdio: ['pipe', 'pipe', 'pipe'],
          cwd: '/app/workspace',
          env: {
            ...process.env,
            PYTHONPATH: `/app/workspace:/usr/local/lib/python3.11:/usr/local/lib/python3.11/site-packages`,
            PYTHONHOME: '/usr/local'
          }
        });

        pylsp.stdout.on('data', (chunk) => {
          try {
            messageBuffer += chunk.toString();
            console.log('Received chunk from pylsp, buffer length:', messageBuffer.length);

            // Process complete LSP messages
            while (true) {
              // Look for Content-Length header anywhere in the header section
              const contentLengthMatch = messageBuffer.match(/Content-Length:\s*(\d+)/);
              if (!contentLengthMatch) {
                console.log('No Content-Length header found yet, buffer start:', JSON.stringify(messageBuffer.substring(0, 200)));
                break;
              }

              // Find the end of all headers (double newline)
              const headerEndMatch = messageBuffer.match(/\r?\n\r?\n/);
              if (!headerEndMatch) {
                console.log('No complete header section found yet');
                break;
              }

              const contentLength = parseInt(contentLengthMatch[1]);
              const headerEndIndex = headerEndMatch.index + headerEndMatch[0].length;

              const totalNeeded = headerEndIndex + contentLength;
              if (messageBuffer.length < totalNeeded) {
                console.log(`Waiting for more data: have ${messageBuffer.length}, need ${totalNeeded}`);
                break;
              }

              const content = messageBuffer.slice(headerEndIndex, headerEndIndex + contentLength);
              messageBuffer = messageBuffer.slice(headerEndIndex + contentLength);
              console.log('Processing complete LSP message, content length:', contentLength, 'remaining buffer:', messageBuffer.length);

              try {
                const response = JSON.parse(content);

                // Get the original request method
                const originalMethod = response.id ? pendingRequests.get(response.id) : null;
                if (response.id && originalMethod) {
                  pendingRequests.delete(response.id);
                }

                console.log('Sending LSP response:', {
                  id: response.id,
                  method: response.method,
                  originalMethod: originalMethod,
                  hasResult: !!response.result,
                  hasError: !!response.error,
                  resultType: response.result ? typeof response.result : 'none'
                });

                if (originalMethod === 'textDocument/definition') {
                  console.log('Definition response details:', JSON.stringify(response, null, 2));
                }

                ws.send(JSON.stringify(response));
              } catch (parseError) {
                console.error('Failed to parse LSP response:', parseError);
              }
            }
          } catch (error) {
            console.error('Error processing pylsp output:', error);
          }
        });

        pylsp.stderr.on('data', (data) => {
          console.error('pylsp stderr:', data.toString());
        });

        pylsp.on('exit', (code) => {
          console.log('pylsp exited with code:', code);
        });
      }

      if (pylsp && pylsp.stdin.writable) {
        const content = JSON.stringify(data);
        const header = `Content-Length: ${Buffer.byteLength(content)}\r\n\r\n`;
        console.log('Sending to pylsp:', { method: data.method, id: data.id });
        pylsp.stdin.write(header + content);
      } else {
        console.error('pylsp not ready or stdin not writable');
      }
    } catch (error) {
      console.error('WebSocket message error:', error);
    }
  });

  ws.on('close', () => {
    console.log('Language server client disconnected');
    if (pylsp) {
      pylsp.kill();
    }
  });
});

// Serve React app for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Python IDE server running on port ${PORT}`);
});