module.exports = {
    testEnvironment: 'node',
    coverageDirectory: 'coverage',
    collectCoverageFrom: [
        'routes/**/*.js',
        'services/**/*.js',
        'utils/**/*.js',
        'api-proxy.js',
        '!**/__tests__/**',
        '!**/node_modules/**',
    ],
    testMatch: ['**/__tests__/**/*.test.js'],
    testTimeout: 30000, // 30 seconds for integration tests
    verbose: true,
    setupFilesAfterEnv: ['<rootDir>/__tests__/helpers/setup.js'],

    // Prevent resource leaks
    forceExit: true,
    detectOpenHandles: false,
    maxWorkers: 1, // Run tests serially to avoid resource conflicts

    // Cleanup settings
    clearMocks: true,
    resetMocks: true,
    restoreMocks: true,
};
