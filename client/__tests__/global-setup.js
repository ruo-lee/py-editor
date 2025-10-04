/**
 * Global Setup for Playwright Tests
 * Runs once before all tests (after webServer is ready)
 */

export default async function globalSetup(config) {
    console.log('🧹 Cleaning up test workspace before tests...');

    // Wait for server to be ready
    const baseURL = config.use?.baseURL || 'http://localhost:8080';
    const maxRetries = 10;
    let retries = 0;

    while (retries < maxRetries) {
        try {
            const response = await fetch(`${baseURL}/api/files/cleanup-test-files`, {
                method: 'POST',
            });

            if (response.ok) {
                const result = await response.json();
                console.log(`✅ Cleaned up ${result.filesRemoved || 0} test files before tests`);
                return;
            }
        } catch (error) {
            retries++;
            if (retries < maxRetries) {
                await new Promise((resolve) => setTimeout(resolve, 1000));
            }
        }
    }

    console.log('⚠️  Workspace cleanup skipped (server not ready)');
}
