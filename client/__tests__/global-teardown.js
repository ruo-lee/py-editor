/**
 * Global Teardown for Playwright Tests
 * Runs once after all tests complete
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default async function globalTeardown() {
    console.log('🧹 Cleaning up test workspace after tests...');

    // Clean up playwright reports and test results
    try {
        const rootPath = path.join(__dirname, '../..');
        const reportPaths = [
            path.join(rootPath, 'client/playwright-report'),
            path.join(rootPath, 'client/test-results'),
            path.join(rootPath, 'server/test-results'),
            path.join(rootPath, 'test-results'),
        ];

        let dirsRemoved = 0;
        for (const reportPath of reportPaths) {
            if (fs.existsSync(reportPath)) {
                // Check if it's a directory or file
                const stat = fs.statSync(reportPath);
                if (stat.isDirectory()) {
                    fs.rmSync(reportPath, { recursive: true, force: true });
                } else {
                    fs.unlinkSync(reportPath);
                }
                dirsRemoved++;
            }
        }

        // Also remove .last-run.json files
        const lastRunFiles = [
            path.join(rootPath, 'test-results/.last-run.json'),
            path.join(rootPath, 'client/test-results/.last-run.json'),
        ];

        for (const lastRunFile of lastRunFiles) {
            if (fs.existsSync(lastRunFile)) {
                fs.unlinkSync(lastRunFile);
            }
        }

        if (dirsRemoved > 0) {
            console.log(`✅ Removed ${dirsRemoved} test report directories`);
        }
    } catch (error) {
        console.log('⚠️  Report cleanup error:', error.message);
    }

    // Clean up test files directly (server may already be stopped)
    try {
        const workspacePath = path.join(__dirname, '../../workspace');

        if (!fs.existsSync(workspacePath)) {
            console.log('⚠️  Workspace directory not found');
            return;
        }

        const files = fs.readdirSync(workspacePath);

        const testFilePatterns = [
            /^test_.*\.py$/,
            /^.*_test_\d+\.py$/,
            /^delete_test.*\.py$/,
            /^rename_.*\.py$/,
            /^open_test.*\.py$/,
            /^save_test.*\.py$/,
            /^file1_.*\.py$/,
            /^file2_.*\.py$/,
            /^lsp_test.*\.py$/,
            /^path_test.*\.py$/,
            /^split_test.*\.py$/,
            /^shortcut_test.*\.py$/,
            /^closeable_.*\.py$/,
            /^test_exec.*\.py$/,
            /^test_folder$/, // Test folders
            /^folder\d+$/, // Numbered folders
        ];

        let filesRemoved = 0;
        for (const file of files) {
            const isTestFile = testFilePatterns.some((pattern) => pattern.test(file));
            if (isTestFile) {
                const filePath = path.join(workspacePath, file);
                const stat = fs.statSync(filePath);

                if (stat.isDirectory()) {
                    fs.rmSync(filePath, { recursive: true, force: true });
                } else {
                    fs.unlinkSync(filePath);
                }
                filesRemoved++;
            }
        }

        console.log(`✅ Cleaned up ${filesRemoved} test files`);
    } catch (error) {
        console.log('⚠️  Workspace cleanup error:', error.message);
    }
}
