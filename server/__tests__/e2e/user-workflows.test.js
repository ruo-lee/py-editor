/**
 * E2E Tests - Complete User Workflows
 * Tests critical end-to-end user scenarios
 */

const request = require('supertest');
const express = require('express');
const cors = require('cors');
const path = require('path');

// Mock pathUtils before requiring routes
jest.mock('../../utils/pathUtils', () => require('../helpers/mockPathUtils'));

const filesRouter = require('../../routes/files');
const workspaceRouter = require('../../routes/workspace');
const executionRouter = require('../../routes/execution');
const { createTestStructure, sampleCode } = require('../helpers/testUtils');

describe('E2E: Critical User Workflows', () => {
    let app;

    beforeAll(() => {
        app = express();
        app.use(cors());
        app.use(express.json());
        app.use('/api/files', filesRouter);
        app.use('/api', workspaceRouter);
        app.use('/api', executionRouter);
    });

    describe('Workflow 1: Complete beginner journey', () => {
        it('should support first-time user creating and running code', async () => {
            // Step 1: User creates first file
            const createResponse = await request(app).post('/api/files/my_first_program.py').send({
                content: sampleCode.valid.hello,
            });

            expect(createResponse.status).toBe(200);

            // Step 2: User checks if code is valid
            const syntaxResponse = await request(app).post('/api/check-syntax').send({
                code: sampleCode.valid.hello,
                filename: 'my_first_program.py',
            });

            expect(syntaxResponse.body.status).toBe('ok');

            // Step 3: User runs the code
            const executeResponse = await request(app).post('/api/execute').send({
                code: sampleCode.valid.hello,
                filename: 'my_first_program.py',
            });

            expect(executeResponse.status).toBe(200);
            expect(executeResponse.body.output).toContain('Hello, World!');
            expect(executeResponse.body.exitCode).toBe(0);

            // Workflow complete - file created, syntax checked, and executed successfully
        });
    });

    describe('Workflow 2: Multi-file project development', () => {
        it('should support creating and importing modules', async () => {
            // Step 1: Create project structure
            await request(app).post('/api/mkdir').send({ path: 'myproject' });

            // Step 2: Create utility module
            await request(app)
                .post('/api/files/myproject/calculator.py')
                .send({
                    content: `
def add(a, b):
    return a + b

def multiply(a, b):
    return a * b
`,
                });

            // Step 3: Create main file that imports utility
            const mainCode = `
import sys
sys.path.insert(0, '${path.join(global.TEST_WORKSPACE, 'myproject')}')

from calculator import add, multiply

result1 = add(5, 3)
result2 = multiply(4, 2)

print(f"5 + 3 = {result1}")
print(f"4 * 2 = {result2}")
`;

            await request(app).post('/api/files/myproject/main.py').send({
                content: mainCode,
            });

            // Step 4: Execute main file
            const executeResponse = await request(app).post('/api/execute').send({
                code: mainCode,
                filename: 'main.py',
            });

            expect(executeResponse.status).toBe(200);
            expect(executeResponse.body.output).toContain('5 + 3 = 8');
            expect(executeResponse.body.output).toContain('4 * 2 = 8');
            expect(executeResponse.body.exitCode).toBe(0);

            // Step 5: Verify project structure
            const listResponse = await request(app).get('/api/files');
            const projectDir = listResponse.body.files.find((f) => f.name === 'myproject');

            expect(projectDir).toBeDefined();
            expect(projectDir.type).toBe('directory');
            expect(projectDir.children).toContainEqual(
                expect.objectContaining({ name: 'calculator.py' })
            );
            expect(projectDir.children).toContainEqual(
                expect.objectContaining({ name: 'main.py' })
            );
        });
    });

    describe('Workflow 3: Error detection and fixing', () => {
        it('should support debugging workflow', async () => {
            // Step 1: User writes code with syntax error
            const buggyCode = sampleCode.syntaxError.incomplete;

            const syntaxCheck1 = await request(app).post('/api/check-syntax').send({
                code: buggyCode,
                filename: 'buggy.py',
            });

            expect(syntaxCheck1.body.status).toBe('error');
            expect(syntaxCheck1.body.errors).toHaveLength(1);
            const errorLine = syntaxCheck1.body.errors[0].line;

            // Step 2: User fixes syntax error
            const fixedCode = 'def foo():\n    pass';

            const syntaxCheck2 = await request(app).post('/api/check-syntax').send({
                code: fixedCode,
                filename: 'buggy.py',
            });

            expect(syntaxCheck2.body.status).toBe('ok');

            // Step 3: User runs fixed code but gets runtime error
            const runtimeBuggyCode = `
def divide(a, b):
    return a / b

result = divide(10, 0)  # Runtime error
print(result)
`;

            const execute1 = await request(app).post('/api/execute').send({
                code: runtimeBuggyCode,
                filename: 'buggy.py',
            });

            expect(execute1.body.exitCode).toBe(1);
            expect(execute1.body.error).toContain('ZeroDivisionError');

            // Step 4: User fixes runtime error
            const finalCode = `
def divide(a, b):
    if b == 0:
        return "Cannot divide by zero"
    return a / b

result = divide(10, 0)
print(result)
`;

            const execute2 = await request(app).post('/api/execute').send({
                code: finalCode,
                filename: 'buggy.py',
            });

            expect(execute2.body.exitCode).toBe(0);
            expect(execute2.body.output).toContain('Cannot divide by zero');

            // Verification: Error line was helpful
            expect(errorLine).toBeGreaterThan(0);
        });
    });

    describe('Workflow 4: Interactive data processing', () => {
        it('should support input-driven programs', async () => {
            // Step 1: Create interactive program
            const interactiveCode = `
name = input("Enter your name: ")
age = input("Enter your age: ")

print(f"Hello {name}!")
print(f"You are {age} years old.")

# Simple calculation
birth_year = 2024 - int(age)
print(f"You were born in {birth_year}")
`;

            await request(app).post('/api/files/interactive.py').send({
                content: interactiveCode,
            });

            // Step 2: Execute with user input
            const executeResponse = await request(app).post('/api/execute').send({
                code: interactiveCode,
                filename: 'interactive.py',
                input: 'Alice\n25\n',
            });

            expect(executeResponse.status).toBe(200);
            expect(executeResponse.body.output).toContain('Hello Alice!');
            expect(executeResponse.body.output).toContain('You are 25 years old');
            expect(executeResponse.body.output).toContain('You were born in 1999');
            expect(executeResponse.body.exitCode).toBe(0);
        });
    });

    describe('Workflow 5: Project backup and restore', () => {
        it('should support project duplication workflow', async () => {
            // Step 1: Create initial project
            await createTestStructure({
                myapp: {
                    'main.py': 'print("version 1")',
                    'config.py': 'VERSION = "1.0.0"',
                },
            });

            // Step 2: Create backup
            const duplicateResponse = await request(app).post('/api/duplicate').send({
                sourcePath: 'myapp',
                targetPath: 'myapp_backup',
            });

            expect(duplicateResponse.status).toBe(200);

            // Step 3: Modify original
            await request(app).post('/api/files/myapp/main.py').send({
                content: 'print("version 2 - broken")\nimport nonexistent',
            });

            // Step 4: Verify backup is intact
            const backupContent = await request(app).get('/api/files/myapp_backup/main.py');

            expect(backupContent.status).toBe(200);
            expect(backupContent.body.content).toBe('print("version 1")');

            // Step 5: Restore from backup
            await request(app).delete('/api/files/myapp');

            await request(app).post('/api/duplicate').send({
                sourcePath: 'myapp_backup',
                targetPath: 'myapp',
            });

            // Step 6: Verify restoration
            const restoredContent = await request(app).get('/api/files/myapp/main.py');

            expect(restoredContent.body.content).toBe('print("version 1")');

            // Execute to confirm it works
            const executeResponse = await request(app).post('/api/execute').send({
                code: restoredContent.body.content,
                filename: 'main.py',
            });

            expect(executeResponse.body.output).toContain('version 1');
            expect(executeResponse.body.exitCode).toBe(0);
        });
    });

    describe('Workflow 6: File upload and execution', () => {
        it('should support uploading and running scripts', async () => {
            // Step 1: Upload Python script
            const scriptContent = `
import json

data = {
    "name": "Test Project",
    "version": "1.0.0",
    "status": "active"
}

print(json.dumps(data, indent=2))
`;

            const uploadResponse = await request(app)
                .post('/api/upload')
                .field('targetDir', '')
                .attach('files', Buffer.from(scriptContent), 'process_data.py');

            expect(uploadResponse.status).toBe(200);

            // Step 2: Read uploaded file
            const readResponse = await request(app).get('/api/files/process_data.py');

            expect(readResponse.status).toBe(200);
            expect(readResponse.body.content).toBe(scriptContent);

            // Step 3: Execute uploaded script
            const executeResponse = await request(app).post('/api/execute').send({
                code: scriptContent,
                filename: 'process_data.py',
            });

            expect(executeResponse.status).toBe(200);
            expect(executeResponse.body.output).toContain('"name": "Test Project"');
            expect(executeResponse.body.exitCode).toBe(0);

            // Workflow complete - file uploaded, read, and executed successfully
        });
    });

    describe('Workflow 7: Project reorganization', () => {
        it('should support refactoring project structure', async () => {
            // Step 1: Initial messy structure
            await createTestStructure({
                'script1.py': 'print("script 1")',
                'script2.py': 'print("script 2")',
                'utils.py': 'def helper(): pass',
                'config.py': 'DEBUG = True',
            });

            // Step 2: Create organized structure
            await request(app).post('/api/mkdir').send({ path: 'src' });
            await request(app).post('/api/mkdir').send({ path: 'scripts' });

            // Step 3: Move files to organized structure
            await request(app)
                .post('/api/move')
                .send({ sourcePath: 'utils.py', targetPath: 'src/utils.py' });

            await request(app)
                .post('/api/move')
                .send({ sourcePath: 'config.py', targetPath: 'src/config.py' });

            await request(app)
                .post('/api/move')
                .send({ sourcePath: 'script1.py', targetPath: 'scripts/script1.py' });

            await request(app)
                .post('/api/move')
                .send({ sourcePath: 'script2.py', targetPath: 'scripts/script2.py' });

            // Step 4: Verify new structure
            const listResponse = await request(app).get('/api/files');

            const srcDir = listResponse.body.files.find((f) => f.name === 'src');
            const scriptsDir = listResponse.body.files.find((f) => f.name === 'scripts');

            expect(srcDir).toBeDefined();
            expect(srcDir.children).toHaveLength(2);
            expect(scriptsDir).toBeDefined();
            expect(scriptsDir.children).toHaveLength(2);

            // Step 5: Verify files are still functional
            const utilsContent = await request(app).get('/api/files/src/utils.py');
            expect(utilsContent.status).toBe(200);
        });
    });

    describe('Workflow 8: Rapid prototyping cycle', () => {
        it('should support quick iteration on code', async () => {
            const versions = [
                {
                    code: 'print("v1")',
                    expected: 'v1',
                },
                {
                    code: 'x = 10\nprint(f"v2: {x}")',
                    expected: 'v2: 10',
                },
                {
                    code: 'x = 10\ny = 20\nprint(f"v3: {x + y}")',
                    expected: 'v3: 30',
                },
            ];

            for (const version of versions) {
                // Check syntax
                const syntaxResponse = await request(app).post('/api/check-syntax').send({
                    code: version.code,
                    filename: 'prototype.py',
                });

                expect(syntaxResponse.body.status).toBe('ok');

                // Save
                await request(app).post('/api/files/prototype.py').send({
                    content: version.code,
                });

                // Execute
                const executeResponse = await request(app).post('/api/execute').send({
                    code: version.code,
                    filename: 'prototype.py',
                });

                expect(executeResponse.body.output).toContain(version.expected);
                expect(executeResponse.body.exitCode).toBe(0);
            }

            // All versions successfully executed - rapid prototyping workflow complete
        });
    });
});
