/**
 * pathUtils.js
 *
 * Path validation and workspace utilities
 */

const path = require('path');
const fsSync = require('fs');
const logger = require('./logger');

// Support both Docker (/app/workspace) and local dev (../workspace)
const WORKSPACE_ROOT =
    process.env.WORKSPACE_ROOT ||
    (fsSync.existsSync('/app/workspace')
        ? '/app/workspace'
        : path.join(__dirname, '..', '..', 'workspace'));

/**
 * Validate and resolve a path within the workspace
 * @param {string} requestedPath - The path to validate
 * @returns {string} The resolved full path
 * @throws {Error} If path is outside workspace
 */
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

/**
 * Get base path from request query or header
 * @param {Object} req - Express request object
 * @returns {string} The base path
 */
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

module.exports = {
    WORKSPACE_ROOT,
    validateAndResolvePath,
    getBasePath,
};
