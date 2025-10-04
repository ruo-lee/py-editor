/**
 * Global test setup
 */

const path = require('path');
const fs = require('fs').promises;

// Extend Jest timeout for integration tests
jest.setTimeout(30000);

// Setup test workspace
const TEST_WORKSPACE = path.join(__dirname, '../fixtures/test-workspace');

global.TEST_WORKSPACE = TEST_WORKSPACE;

// Cleanup before all tests
beforeAll(async () => {
    // Create test workspace directory
    await fs.mkdir(TEST_WORKSPACE, { recursive: true });
});

// Cleanup after all tests
afterAll(async () => {
    // Clean up test workspace
    try {
        await fs.rm(TEST_WORKSPACE, { recursive: true, force: true });
    } catch (error) {
        // Ignore cleanup errors
    }

    // Force garbage collection if available
    if (global.gc) {
        global.gc();
    }
});

// Clear test workspace before each test
beforeEach(async () => {
    try {
        // Ensure directory exists
        await fs.mkdir(TEST_WORKSPACE, { recursive: true });

        const entries = await fs.readdir(TEST_WORKSPACE);
        for (const entry of entries) {
            await fs.rm(path.join(TEST_WORKSPACE, entry), { recursive: true, force: true });
        }
    } catch (error) {
        // Ignore if directory doesn't exist
        if (error.code !== 'ENOENT') {
            // Only log unexpected errors
        }
    }
});
