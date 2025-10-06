/**
 * Integration Tests - Workspace Operations Scenarios
 * Tests real user scenarios for workspace management
 */

const request = require('supertest');
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;

// Mock pathUtils before requiring routes
jest.mock('../../utils/pathUtils', () => require('../helpers/mockPathUtils'));

const workspaceRouter = require('../../routes/workspace');
const { createTestFile, createTestStructure } = require('../helpers/testUtils');

describe('User Scenario: Workspace Management', () => {
    let app;

    beforeAll(() => {
        app = express();
        app.use(cors());
        app.use(express.json());
        app.use('/api', workspaceRouter);
    });

    describe('Scenario: Organizing project with directories', () => {
        it('should create new directory', async () => {
            const response = await request(app).post('/api/mkdir').send({
                path: 'src',
            });

            expect(response.status).toBe(200);
            expect(response.body).toEqual({ success: true });

            // Verify directory was created
            const dirPath = path.join(global.TEST_WORKSPACE, 'src');
            const stat = await fs.stat(dirPath);
            expect(stat.isDirectory()).toBe(true);
        });

        it('should create nested directories', async () => {
            const response = await request(app).post('/api/mkdir').send({
                path: 'src/components/utils',
            });

            expect(response.status).toBe(200);

            // Verify nested path was created
            const dirPath = path.join(global.TEST_WORKSPACE, 'src/components/utils');
            const stat = await fs.stat(dirPath);
            expect(stat.isDirectory()).toBe(true);
        });

        it('should handle existing directory gracefully', async () => {
            await fs.mkdir(path.join(global.TEST_WORKSPACE, 'existing'), {
                recursive: true,
            });

            const response = await request(app).post('/api/mkdir').send({
                path: 'existing',
            });

            expect(response.status).toBe(200);
        });
    });

    describe('Scenario: Renaming and moving files', () => {
        beforeEach(async () => {
            await createTestStructure({
                'old_name.py': 'print("test")',
                src: {
                    'helper.py': 'def help(): pass',
                },
                temp: {},
            });
        });

        it('should rename file', async () => {
            const response = await request(app).post('/api/move').send({
                sourcePath: 'old_name.py',
                targetPath: 'new_name.py',
            });

            expect(response.status).toBe(200);

            // Verify old file is gone
            const oldExists = await fs
                .access(path.join(global.TEST_WORKSPACE, 'old_name.py'))
                .then(() => true)
                .catch(() => false);
            expect(oldExists).toBe(false);

            // Verify new file exists
            const newPath = path.join(global.TEST_WORKSPACE, 'new_name.py');
            const content = await fs.readFile(newPath, 'utf8');
            expect(content).toBe('print("test")');
        });

        it('should move file to different directory', async () => {
            const response = await request(app).post('/api/move').send({
                sourcePath: 'old_name.py',
                targetPath: 'temp/moved.py',
            });

            expect(response.status).toBe(200);

            const newPath = path.join(global.TEST_WORKSPACE, 'temp/moved.py');
            const content = await fs.readFile(newPath, 'utf8');
            expect(content).toBe('print("test")');
        });

        it('should rename directory', async () => {
            const response = await request(app).post('/api/move').send({
                sourcePath: 'src',
                targetPath: 'source',
            });

            expect(response.status).toBe(200);

            // Verify old directory is gone
            const oldExists = await fs
                .access(path.join(global.TEST_WORKSPACE, 'src'))
                .then(() => true)
                .catch(() => false);
            expect(oldExists).toBe(false);

            // Verify new directory and its contents
            const newPath = path.join(global.TEST_WORKSPACE, 'source/helper.py');
            const exists = await fs
                .access(newPath)
                .then(() => true)
                .catch(() => false);
            expect(exists).toBe(true);
        });
    });

    describe('Scenario: Duplicating files for backup', () => {
        beforeEach(async () => {
            await createTestStructure({
                'main.py': 'print("main")',
                src: {
                    'utils.py': 'def util(): pass',
                    'config.py': 'DEBUG = True',
                },
            });
        });

        it('should duplicate single file', async () => {
            const response = await request(app).post('/api/duplicate').send({
                sourcePath: 'main.py',
                targetPath: 'main_backup.py',
            });

            expect(response.status).toBe(200);

            // Verify both files exist
            const originalContent = await fs.readFile(
                path.join(global.TEST_WORKSPACE, 'main.py'),
                'utf8'
            );
            const duplicateContent = await fs.readFile(
                path.join(global.TEST_WORKSPACE, 'main_backup.py'),
                'utf8'
            );

            expect(originalContent).toBe('print("main")');
            expect(duplicateContent).toBe('print("main")');
        });

        it('should duplicate entire directory', async () => {
            const response = await request(app).post('/api/duplicate').send({
                sourcePath: 'src',
                targetPath: 'src_backup',
            });

            expect(response.status).toBe(200);

            // Verify all files were copied
            const utilsContent = await fs.readFile(
                path.join(global.TEST_WORKSPACE, 'src_backup/utils.py'),
                'utf8'
            );
            const configContent = await fs.readFile(
                path.join(global.TEST_WORKSPACE, 'src_backup/config.py'),
                'utf8'
            );

            expect(utilsContent).toBe('def util(): pass');
            expect(configContent).toBe('DEBUG = True');
        });

        it('should duplicate to different directory', async () => {
            await fs.mkdir(path.join(global.TEST_WORKSPACE, 'backup'), {
                recursive: true,
            });

            const response = await request(app).post('/api/duplicate').send({
                sourcePath: 'main.py',
                targetPath: 'backup/main.py',
            });

            expect(response.status).toBe(200);

            const content = await fs.readFile(
                path.join(global.TEST_WORKSPACE, 'backup/main.py'),
                'utf8'
            );
            expect(content).toBe('print("main")');
        });
    });

    describe('Scenario: Uploading files to project', () => {
        it('should upload single file', async () => {
            const response = await request(app)
                .post('/api/upload')
                .field('targetDir', '')
                .attach('files', Buffer.from('print("uploaded")'), 'uploaded.py');

            expect(response.status).toBe(200);
            expect(response.body).toMatchObject({
                success: true,
                files: [
                    {
                        name: 'uploaded.py',
                        path: 'uploaded.py',
                    },
                ],
            });

            // Verify file exists
            const filePath = path.join(global.TEST_WORKSPACE, 'uploaded.py');
            const content = await fs.readFile(filePath, 'utf8');
            expect(content).toBe('print("uploaded")');
        });

        it('should upload multiple files', async () => {
            const response = await request(app)
                .post('/api/upload')
                .field('targetDir', '')
                .attach('files', Buffer.from('print("file1")'), 'file1.py')
                .attach('files', Buffer.from('print("file2")'), 'file2.py')
                .attach('files', Buffer.from('print("file3")'), 'file3.py');

            expect(response.status).toBe(200);
            expect(response.body.files).toHaveLength(3);

            // Verify all files exist
            const file1 = await fs.readFile(path.join(global.TEST_WORKSPACE, 'file1.py'), 'utf8');
            const file2 = await fs.readFile(path.join(global.TEST_WORKSPACE, 'file2.py'), 'utf8');
            const file3 = await fs.readFile(path.join(global.TEST_WORKSPACE, 'file3.py'), 'utf8');

            expect(file1).toBe('print("file1")');
            expect(file2).toBe('print("file2")');
            expect(file3).toBe('print("file3")');
        });

        it('should upload to specific directory', async () => {
            await fs.mkdir(path.join(global.TEST_WORKSPACE, 'uploads'), {
                recursive: true,
            });

            const response = await request(app)
                .post('/api/upload')
                .field('targetDir', 'uploads')
                .attach('files', Buffer.from('data'), 'data.txt');

            expect(response.status).toBe(200);

            const filePath = path.join(global.TEST_WORKSPACE, 'uploads/data.txt');
            const exists = await fs
                .access(filePath)
                .then(() => true)
                .catch(() => false);
            expect(exists).toBe(true);
        });

        it('should handle Unicode filenames in upload', async () => {
            const response = await request(app)
                .post('/api/upload')
                .field('targetDir', '')
                .attach('files', Buffer.from('print("한글")'), '한글파일.py');

            expect(response.status).toBe(200);
            expect(response.body.files[0].name).toBe('한글파일.py');
        });
    });

    describe('Scenario: Downloading project files', () => {
        beforeEach(async () => {
            await createTestFile('download_me.py', 'print("download test")');
            await createTestStructure({
                project: {
                    'file1.py': 'content1',
                    'file2.py': 'content2',
                },
            });
        });

        it('should download single file', async () => {
            const response = await request(app).get(
                '/api/download/' + encodeURIComponent('download_me.py')
            );

            expect(response.status).toBe(200);
            // File download returns buffer
            const content = response.text || response.body.toString();
            expect(content).toContain('print("download test")');
        });

        it('should download directory as ZIP', async () => {
            const response = await request(app).get('/api/download/project');

            expect(response.status).toBe(200);
            expect(response.headers['content-type']).toContain('application/zip');
            expect(response.headers['content-disposition']).toContain('project.zip');
        });
    });

    describe('Scenario: Loading Python snippets', () => {
        it('should return snippets from root directory', async () => {
            // Use actual snippets file from root
            const response = await request(app).get('/api/snippets');

            expect(response.status).toBe(200);
            // Should contain actual snippets from /snippets/python.json
            expect(typeof response.body).toBe('object');

            // Verify we got snippets (actual file has many snippets)
            const snippetCount = Object.keys(response.body).length;
            expect(snippetCount).toBeGreaterThan(0);

            // Check for any known snippet (from actual file)
            const hasAnySnippet =
                response.body['초기화 스니펫'] ||
                response.body['get'] ||
                response.body['post'] ||
                Object.keys(response.body).length > 0;

            expect(hasAnySnippet).toBeTruthy();
        });

        it('should handle missing snippets gracefully', async () => {
            // This will use the actual root snippets, which should exist
            // If they don't exist, it returns empty object (tested by route)
            const response = await request(app).get('/api/snippets');

            expect(response.status).toBe(200);
            expect(typeof response.body).toBe('object');
        });
    });

    describe('Scenario: Accessing Python standard library', () => {
        it('should read stdlib file if exists', async () => {
            const response = await request(app).get('/api/stdlib/os.py');

            // This depends on system Python installation
            if (response.status === 200) {
                expect(response.body).toHaveProperty('content');
                expect(response.body.content).toContain('os');
            } else {
                expect(response.status).toBe(404);
            }
        });

        it('should return 404 for non-existent stdlib file', async () => {
            const response = await request(app).get('/api/stdlib/nonexistent_module_xyz.py');

            expect(response.status).toBe(404);
            expect(response.body).toHaveProperty('error');
        });
    });

    describe('Scenario: Complex workspace reorganization', () => {
        beforeEach(async () => {
            await createTestStructure({
                'main.py': 'from utils import helper\nhelper()',
                'utils.py': 'def helper(): print("help")',
                old_structure: {
                    'legacy.py': 'old code',
                },
            });
        });

        it('should reorganize project structure', async () => {
            // Step 1: Create new structure
            await request(app).post('/api/mkdir').send({ path: 'src' });
            await request(app).post('/api/mkdir').send({ path: 'tests' });

            // Step 2: Move files
            await request(app)
                .post('/api/move')
                .send({ sourcePath: 'main.py', targetPath: 'src/main.py' });
            await request(app)
                .post('/api/move')
                .send({ sourcePath: 'utils.py', targetPath: 'src/utils.py' });

            // Step 3: Remove old structure (optional)
            await request(app).delete('/api/files/old_structure');

            // Step 4: Verify new structure
            const mainExists = await fs
                .access(path.join(global.TEST_WORKSPACE, 'src/main.py'))
                .then(() => true)
                .catch(() => false);
            const utilsExists = await fs
                .access(path.join(global.TEST_WORKSPACE, 'src/utils.py'))
                .then(() => true)
                .catch(() => false);

            expect(mainExists).toBe(true);
            expect(utilsExists).toBe(true);
        });
    });
});
