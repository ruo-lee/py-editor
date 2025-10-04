/**
 * Integration Tests - File Operations Scenarios
 * Tests real user scenarios for file management
 */

const request = require('supertest');
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;

// Mock pathUtils before requiring routes
jest.mock('../../utils/pathUtils', () => require('../helpers/mockPathUtils'));

const filesRouter = require('../../routes/files');
const { createTestFile, createTestStructure } = require('../helpers/testUtils');

describe('User Scenario: File Management', () => {
    let app;

    beforeAll(() => {
        app = express();
        app.use(cors());
        app.use(express.json());
        app.use('/api/files', filesRouter);
    });

    describe('Scenario: Developer explores project structure', () => {
        beforeEach(async () => {
            await createTestStructure({
                'main.py': 'print("main")',
                src: {
                    'utils.py': 'def helper(): pass',
                    'config.py': 'DEBUG = True',
                },
                tests: {
                    'test_main.py': 'def test(): pass',
                },
                'README.md': '# My Project',
            });
        });

        it('should list entire directory structure', async () => {
            const response = await request(app).get('/api/files');

            expect(response.status).toBe(200);
            expect(response.body).toMatchObject({
                basePath: '',
                files: expect.arrayContaining([
                    expect.objectContaining({
                        name: 'main.py',
                        type: 'file',
                    }),
                    expect.objectContaining({
                        name: 'src',
                        type: 'directory',
                        children: expect.arrayContaining([
                            expect.objectContaining({ name: 'utils.py' }),
                            expect.objectContaining({ name: 'config.py' }),
                        ]),
                    }),
                    expect.objectContaining({
                        name: 'tests',
                        type: 'directory',
                    }),
                ]),
            });
        });

        it('should sort directories before files', async () => {
            const response = await request(app).get('/api/files');

            expect(response.status).toBe(200);
            const files = response.body.files;

            // Find first file and first directory
            const firstDirIndex = files.findIndex((f) => f.type === 'directory');
            const firstFileIndex = files.findIndex((f) => f.type === 'file');

            expect(firstDirIndex).toBeLessThan(firstFileIndex);
        });
    });

    describe('Scenario: Student creates first Python file', () => {
        it('should create new file with content', async () => {
            const response = await request(app).post('/api/files/hello.py').send({
                content: 'print("Hello, World!")',
            });

            expect(response.status).toBe(200);
            expect(response.body).toEqual({ success: true });

            // Verify file was created
            const filePath = path.join(global.TEST_WORKSPACE, 'hello.py');
            const content = await fs.readFile(filePath, 'utf8');
            expect(content).toBe('print("Hello, World!")');
        });

        it('should create file in nested directory', async () => {
            const response = await request(app).post('/api/files/src/modules/helper.py').send({
                content: 'def helper():\n    pass',
            });

            expect(response.status).toBe(200);

            // Verify nested directories were created
            const filePath = path.join(global.TEST_WORKSPACE, 'src/modules/helper.py');
            const exists = await fs
                .access(filePath)
                .then(() => true)
                .catch(() => false);
            expect(exists).toBe(true);
        });
    });

    describe('Scenario: Developer reads and edits files', () => {
        beforeEach(async () => {
            await createTestFile('example.py', 'x = 1\nprint(x)');
        });

        it('should read existing file content', async () => {
            const response = await request(app).get('/api/files/example.py');

            expect(response.status).toBe(200);
            expect(response.body).toEqual({
                content: 'x = 1\nprint(x)',
            });
        });

        it('should update file content', async () => {
            const response = await request(app).post('/api/files/example.py').send({
                content: 'x = 2\nprint(x * 2)',
            });

            expect(response.status).toBe(200);

            // Verify content was updated
            const filePath = path.join(global.TEST_WORKSPACE, 'example.py');
            const content = await fs.readFile(filePath, 'utf8');
            expect(content).toBe('x = 2\nprint(x * 2)');
        });

        it('should handle non-existent file read', async () => {
            const response = await request(app).get('/api/files/nonexistent.py');

            expect(response.status).toBe(404);
            expect(response.body).toEqual({
                error: 'File not found',
            });
        });
    });

    describe('Scenario: Cleaning up project files', () => {
        beforeEach(async () => {
            await createTestStructure({
                'old_file.py': 'old code',
                temp: {
                    'cache.py': 'temp',
                },
            });
        });

        it('should delete single file', async () => {
            const response = await request(app).delete('/api/files/old_file.py');

            expect(response.status).toBe(200);
            expect(response.body).toEqual({ success: true });

            // Verify file was deleted
            const filePath = path.join(global.TEST_WORKSPACE, 'old_file.py');
            const exists = await fs
                .access(filePath)
                .then(() => true)
                .catch(() => false);
            expect(exists).toBe(false);
        });

        it('should delete entire directory', async () => {
            const response = await request(app).delete('/api/files/temp');

            expect(response.status).toBe(200);

            // Verify directory was deleted
            const dirPath = path.join(global.TEST_WORKSPACE, 'temp');
            const exists = await fs
                .access(dirPath)
                .then(() => true)
                .catch(() => false);
            expect(exists).toBe(false);
        });
    });

    describe('Scenario: Working with special characters', () => {
        it('should handle Unicode filenames', async () => {
            const filename = encodeURIComponent('한글파일.py');
            const response = await request(app)
                .post('/api/files/' + filename)
                .send({
                    content: 'print("한글 내용")',
                });

            expect(response.status).toBe(200);

            const readResponse = await request(app).get('/api/files/' + filename);
            expect(readResponse.status).toBe(200);
            expect(readResponse.body.content).toBe('print("한글 내용")');
        });

        it('should handle spaces in filenames', async () => {
            const response = await request(app)
                .post('/api/files/' + encodeURIComponent('my script.py'))
                .send({
                    content: 'print("test")',
                });

            expect(response.status).toBe(200);

            const readResponse = await request(app).get(
                '/api/files/' + encodeURIComponent('my script.py')
            );
            expect(readResponse.status).toBe(200);
        });

        it('should handle Unicode content', async () => {
            const unicodeContent = `
# 한글 주석
emoji = "🐍 Python"
한글변수 = "테스트"
print(emoji)
print(한글변수)
`;
            const response = await request(app).post('/api/files/unicode.py').send({
                content: unicodeContent,
            });

            expect(response.status).toBe(200);

            const readResponse = await request(app).get('/api/files/unicode.py');
            expect(readResponse.body.content).toBe(unicodeContent);
        });
    });

    describe('Scenario: Concurrent file operations', () => {
        it('should handle multiple file creations', async () => {
            const files = ['file1.py', 'file2.py', 'file3.py'];

            const promises = files.map((filename) =>
                request(app)
                    .post(`/api/files/${filename}`)
                    .send({
                        content: `print("${filename}")`,
                    })
            );

            const responses = await Promise.all(promises);

            responses.forEach((response) => {
                expect(response.status).toBe(200);
            });

            // Verify all files were created
            const listResponse = await request(app).get('/api/files');
            const fileNames = listResponse.body.files.map((f) => f.name);

            files.forEach((filename) => {
                expect(fileNames).toContain(filename);
            });
        });

        it('should handle multiple updates to same file', async () => {
            await createTestFile('counter.py', 'count = 0');

            const updates = ['count = 1', 'count = 2', 'count = 3', 'count = 4', 'count = 5'];

            for (const content of updates) {
                await request(app).post('/api/files/counter.py').send({ content });
            }

            const response = await request(app).get('/api/files/counter.py');
            expect(response.body.content).toBe('count = 5');
        });
    });

    describe('Scenario: Large file handling', () => {
        it('should handle large file content', async () => {
            // Create reasonably large file (~50KB)
            const largeContent = '# Large file\n' + 'x = 1\n'.repeat(5000) + 'print("done")';

            const response = await request(app).post('/api/files/large.py').send({
                content: largeContent,
            });

            expect(response.status).toBe(200);

            const readResponse = await request(app).get('/api/files/large.py');
            expect(readResponse.status).toBe(200);
            expect(readResponse.body.content.length).toBeGreaterThan(10000);
        });
    });

    describe('Scenario: Empty and whitespace handling', () => {
        it('should create empty file', async () => {
            const response = await request(app).post('/api/files/empty.py').send({
                content: '',
            });

            expect(response.status).toBe(200);

            const readResponse = await request(app).get('/api/files/empty.py');
            expect(readResponse.body.content).toBe('');
        });

        it('should preserve whitespace', async () => {
            const content = '    \n\t\n  \n';
            const response = await request(app).post('/api/files/whitespace.py').send({
                content,
            });

            expect(response.status).toBe(200);

            const readResponse = await request(app).get('/api/files/whitespace.py');
            expect(readResponse.body.content).toBe(content);
        });
    });
});
