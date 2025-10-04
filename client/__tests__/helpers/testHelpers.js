/**
 * Test Helpers for Playwright E2E Tests
 * Provides reusable functions for common UI interactions
 */

/**
 * Wait for Monaco Editor to be fully loaded
 */
export async function waitForMonacoEditor(page) {
    // Wait for at least one Monaco editor to exist
    await page.waitForSelector('.monaco-editor', { timeout: 15000 });

    // Wait for window.app.editor to be available
    await page.waitForFunction(
        () => {
            return window.app && window.app.editor;
        },
        { timeout: 10000 }
    );

    // Additional small delay for editor to fully initialize
    await page.waitForTimeout(500);
}

/**
 * Type text into Monaco Editor
 */
export async function typeInMonaco(page, text) {
    await waitForMonacoEditor(page);
    await page.click('.monaco-editor');
    await page.keyboard.type(text);
}

/**
 * Get Monaco Editor content
 */
export async function getMonacoContent(page) {
    return await page.evaluate(() => {
        // Try to get content from the active editor first
        const app = window.app;
        if (app && app.editor) {
            const model = app.editor.getModel();
            if (model) {
                return model.getValue();
            }
        }
        // Fallback to first model
        const models = window.monaco?.editor?.getModels();
        return models && models.length > 0 ? models[0].getValue() : '';
    });
}

/**
 * Click file in explorer
 */
export async function clickFileInExplorer(page, filename) {
    await page.click(`[data-path="${filename}"], .file-item:has-text("${filename}")`);
}

/**
 * Wait for file to appear in explorer
 */
export async function waitForFileInExplorer(page, filename, timeout = 5000) {
    await page.waitForSelector(`[data-path*="${filename}"], .file-item:has-text("${filename}")`, {
        timeout,
    });
}

/**
 * Wait for output panel content
 */
export async function waitForOutput(page, expectedText, timeout = 10000) {
    await page.waitForFunction(
        (text) => {
            const outputElement =
                document.querySelector('.output-content') ||
                document.querySelector('#output') ||
                document.querySelector('[class*="output"]');
            return outputElement && outputElement.textContent.includes(text);
        },
        expectedText,
        { timeout }
    );
}

/**
 * Clear Monaco Editor content
 */
export async function clearMonaco(page) {
    await page.evaluate(() => {
        const models = window.monaco?.editor?.getModels();
        if (models && models.length > 0) {
            models[0].setValue('');
        }
    });
}

/**
 * Wait for element and click
 */
export async function waitAndClick(page, selector, timeout = 5000) {
    await page.waitForSelector(selector, { timeout });
    await page.click(selector);
}

/**
 * Fill input by setting value directly via JavaScript
 * This is needed because Playwright's fill() doesn't update the actual DOM input.value
 */
export async function fillInputValue(page, selector, value) {
    await page.evaluate(
        ({ sel, val }) => {
            const input = document.querySelector(sel);
            if (input) input.value = val;
        },
        { sel: selector, val: value }
    );
}

/**
 * Create a file using dialog
 */
export async function createFile(page, filename) {
    await page.click('#newFileBtn');
    await page.waitForSelector('#nameInput', { state: 'visible' });
    await fillInputValue(page, '#nameInput', filename);

    // Click the Create button
    await page.click('button#createBtn');

    // Wait for dialog to disappear
    await page.waitForSelector('.input-dialog', { state: 'hidden', timeout: 5000 });

    // Wait for file to appear in explorer
    await waitForFileInExplorer(page, filename, 10000);

    // Wait for file to be fully created on server
    await page.waitForTimeout(2000);

    // Click the file to open it
    await page.click(`[data-path="${filename}"]`);

    // Wait for editor and tab to load
    await page.waitForTimeout(2000);
}

/**
 * Sample Python code snippets for testing
 */
export const sampleCode = {
    helloWorld: 'print("Hello World")',
    variables: 'x = 10\ny = 20\nprint(x + y)',
    loop: 'for i in range(5):\n    print(i)',
    function: 'def greet(name):\n    return f"Hello, {name}"\n\nprint(greet("World"))',
    error: 'print(undefined_variable)',
    syntax: 'def func(\n    print("syntax error")',
    import: 'import math\nprint(math.pi)',
};
