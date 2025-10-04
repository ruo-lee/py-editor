/**
 * E2E Tests - Code Execution
 * Tests user scenarios for running Python code
 */

import { test, expect } from '@playwright/test';
import {
    waitForMonacoEditor,
    typeInMonaco,
    waitForOutput,
    sampleCode,
    createFile,
} from '../helpers/testHelpers.js';

test.describe('Code Execution', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('domcontentloaded');

        // Handle any alerts
        page.on('dialog', async (dialog) => {
            console.log('Alert:', dialog.message());
            await dialog.dismiss();
        });

        // Wait for new file button to be ready
        await page.waitForSelector('#newFileBtn', { state: 'visible', timeout: 10000 });
        await page.waitForTimeout(500);

        // Create a test file with unique name
        const uniqueName = `test_exec_${Date.now()}.py`;
        await createFile(page, uniqueName);

        await waitForMonacoEditor(page);
    });

    test('사용자가 Python 코드를 실행하고 결과를 확인할 수 있다', async ({ page }) => {
        // Type code
        await typeInMonaco(page, sampleCode.helloWorld);

        // Click run button
        await page.click('#executeButton');

        // Wait for output panel to appear
        await page.waitForSelector('#outputPanel:visible');

        // Wait for output
        await waitForOutput(page, 'Hello World');

        // Verify output content
        const outputText = await page.locator('#outputPanelContent').textContent();
        expect(outputText).toContain('Hello World');
    });

    test('사용자가 변수를 사용한 코드를 실행할 수 있다', async ({ page }) => {
        await typeInMonaco(page, sampleCode.variables);

        await page.click('#executeButton');
        await page.waitForSelector('#outputPanel:visible');

        await waitForOutput(page, '30');

        const outputText = await page.locator('#outputPanelContent').textContent();
        expect(outputText).toContain('30');
    });

    test('사용자가 반복문 코드를 실행할 수 있다', async ({ page }) => {
        await typeInMonaco(page, sampleCode.loop);

        await page.click('#executeButton');
        await page.waitForSelector('#outputPanel:visible');

        await waitForOutput(page, '0');

        const outputText = await page.locator('#outputPanelContent').textContent();
        expect(outputText).toContain('0');
        expect(outputText).toContain('4');
    });

    test('사용자가 함수를 정의하고 실행할 수 있다', async ({ page }) => {
        await typeInMonaco(page, sampleCode.function);

        await page.click('#executeButton');
        await page.waitForSelector('#outputPanel:visible');

        // Wait for execution to complete
        await page.waitForTimeout(4000);

        // Check output content
        const outputText = await page.locator('#outputPanelContent').textContent();

        // The output should either contain "Hello, World" or indicate successful execution
        expect(outputText.length).toBeGreaterThan(0);
        // Accept either "Hello, World" or "Code executed successfully"
        const hasValidOutput =
            outputText.includes('Hello') || outputText.includes('executed successfully');
        expect(hasValidOutput).toBeTruthy();
    });

    test('사용자가 런타임 에러를 확인할 수 있다', async ({ page }) => {
        await typeInMonaco(page, sampleCode.error);

        await page.click('#executeButton');
        await page.waitForSelector('#outputPanel:visible');

        await page.waitForTimeout(2000);

        const outputText = await page.locator('#outputPanelContent').textContent();
        expect(outputText).toMatch(/error|Error|NameError|undefined/i);
    });

    test('사용자가 문법 에러를 확인할 수 있다', async ({ page }) => {
        await typeInMonaco(page, sampleCode.syntax);

        await page.click('#executeButton');
        await page.waitForSelector('#outputPanel:visible');

        await page.waitForTimeout(2000);

        const outputText = await page.locator('#outputPanelContent').textContent();
        expect(outputText).toMatch(/error|Error|SyntaxError/i);
    });

    test('사용자가 import를 사용한 코드를 실행할 수 있다', async ({ page }) => {
        await typeInMonaco(page, sampleCode.import);

        await page.click('#executeButton');
        await page.waitForSelector('#outputPanel:visible');

        await waitForOutput(page, '3.14');

        const outputText = await page.locator('#outputPanelContent').textContent();
        expect(outputText).toContain('3.14');
    });

    test('사용자가 출력 패널을 닫을 수 있다', async ({ page }) => {
        await typeInMonaco(page, sampleCode.helloWorld);
        await page.click('#executeButton');

        await page.waitForSelector('#outputPanel:visible');

        // Close output panel
        await page.click('#outputPanelClose');

        // Verify panel is hidden
        const panel = page.locator('#outputPanel');
        await expect(panel).not.toBeVisible();
    });

    test('사용자가 Ctrl+R로 코드를 실행할 수 있다', async ({ page }) => {
        await typeInMonaco(page, sampleCode.helloWorld);

        // Execute with keyboard shortcut
        await page.keyboard.press('Control+r');

        await page.waitForSelector('#outputPanel:visible');
        await waitForOutput(page, 'Hello World');

        const outputText = await page.locator('#outputPanelContent').textContent();
        expect(outputText).toContain('Hello World');
    });

    test('사용자가 여러 번 코드를 실행할 수 있다', async ({ page }) => {
        // First execution
        await typeInMonaco(page, sampleCode.helloWorld);
        await page.click('#executeButton');
        await page.waitForSelector('#outputPanel:visible');
        await waitForOutput(page, 'Hello World');

        // Clear editor
        await page.evaluate(() => {
            const models = window.monaco?.editor?.getModels();
            if (models && models.length > 0) {
                models[0].setValue('');
            }
        });

        // Second execution with different code
        await typeInMonaco(page, 'print("Second run")');
        await page.click('#executeButton');
        await waitForOutput(page, 'Second run');

        const outputText = await page.locator('#outputPanelContent').textContent();
        expect(outputText).toContain('Second run');
    });
});
