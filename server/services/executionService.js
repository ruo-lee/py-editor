/**
 * executionService.js - Python code execution service
 */

const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

/**
 * Check Python syntax
 */
async function checkSyntax(code, filename = 'syntax_check.py') {
    const tempFile = path.join('/tmp', filename);
    await fs.writeFile(tempFile, code);

    return new Promise((resolve) => {
        const python = spawn('python3', [
            '-c',
            `
import sys, ast, json
try:
    with open('${tempFile}', 'r', encoding='utf-8') as f:
        source_code = f.read()
    ast.parse(source_code, filename='${tempFile}')
    print('{"status": "ok"}')
except SyntaxError as e:
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

        python.on('close', async (_code) => {
            try {
                await fs.unlink(tempFile).catch(() => {});
                await fs.unlink(tempFile + 'c').catch(() => {});
                const result = JSON.parse(output.trim());
                resolve(result);
            } catch (parseError) {
                resolve({
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
    });
}

/**
 * Execute Python code
 */
async function executeCode(code, options = {}) {
    const {
        filename = 'temp.py',
        basePath = '/app/workspace',
        timeout = 30000,
        input = '',
    } = options;

    const tempFile = path.join(basePath, filename);
    await fs.writeFile(tempFile, code);

    return new Promise((resolve) => {
        const python = spawn('python3', ['-u', tempFile], {
            cwd: basePath,
            timeout,
        });

        let stdout = '';
        let stderr = '';
        const startTime = Date.now();

        if (input) {
            python.stdin.write(input);
            python.stdin.end();
        }

        python.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        python.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        python.on('close', async (code) => {
            const executionTime = Date.now() - startTime;

            try {
                await fs.unlink(tempFile).catch(() => {});
                await fs.unlink(tempFile + 'c').catch(() => {});
            } catch (error) {
                logger.warn('Failed to cleanup temp files', { error: error.message });
            }

            resolve({
                output: stdout,
                error: stderr,
                exitCode: code,
                executionTime,
            });
        });

        python.on('error', async (error) => {
            try {
                await fs.unlink(tempFile).catch(() => {});
            } catch (_e) {
                // Ignore cleanup errors
            }

            resolve({
                output: '',
                error: error.message,
                exitCode: 1,
                executionTime: Date.now() - startTime,
            });
        });
    });
}

module.exports = {
    checkSyntax,
    executeCode,
};
