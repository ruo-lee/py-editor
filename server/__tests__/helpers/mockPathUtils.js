/**
 * Mock pathUtils for testing
 */

const path = require('path');

// Override WORKSPACE_ROOT for tests
const WORKSPACE_ROOT = global.TEST_WORKSPACE || '/tmp/test-workspace';

function validateAndResolvePath(requestedPath) {
    const normalizedPath = path.normalize(requestedPath).replace(/^(\.\.[\\/])+/, '');
    const fullPath = path.join(WORKSPACE_ROOT, normalizedPath);

    if (!fullPath.startsWith(WORKSPACE_ROOT)) {
        throw new Error('Access denied: Path outside workspace');
    }

    return fullPath;
}

function getBasePath(req) {
    const folderParam = req.query.folder || req.headers['x-workspace-folder'];

    if (!folderParam || folderParam.trim() === '' || folderParam === '/') {
        return WORKSPACE_ROOT;
    }

    try {
        return validateAndResolvePath(folderParam);
    } catch (error) {
        return WORKSPACE_ROOT;
    }
}

module.exports = {
    WORKSPACE_ROOT,
    validateAndResolvePath,
    getBasePath,
};
