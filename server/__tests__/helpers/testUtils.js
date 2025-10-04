/**
 * Test utilities and helpers
 */

const path = require('path');
const fs = require('fs').promises;

/**
 * Create a test file in the test workspace
 */
async function createTestFile(filename, content) {
    const filePath = path.join(global.TEST_WORKSPACE, filename);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, 'utf8');
    return filePath;
}

/**
 * Create a test directory structure
 */
async function createTestStructure(structure, basePath = global.TEST_WORKSPACE) {
    for (const [name, value] of Object.entries(structure)) {
        const itemPath = path.join(basePath, name);

        if (typeof value === 'string') {
            // It's a file
            await fs.mkdir(path.dirname(itemPath), { recursive: true });
            await fs.writeFile(itemPath, value, 'utf8');
        } else if (typeof value === 'object') {
            // It's a directory
            await fs.mkdir(itemPath, { recursive: true });
            await createTestStructure(value, itemPath);
        }
    }
}

/**
 * Wait for condition to be true
 */
async function waitFor(condition, timeout = 5000, interval = 100) {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
        if (await condition()) {
            return true;
        }
        await new Promise((resolve) => setTimeout(resolve, interval));
    }

    throw new Error('Timeout waiting for condition');
}

/**
 * Sample Python code snippets for testing
 */
const sampleCode = {
    valid: {
        hello: 'print("Hello, World!")',
        input: 'name = input("Enter name: ")\nprint(f"Hello, {name}!")',
        math: 'result = 2 + 2\nprint(result)',
        loop: 'for i in range(5):\n    print(i)',
        function: 'def greet(name):\n    return f"Hello, {name}!"\n\nprint(greet("Python"))',
        multifile: {
            main: 'from utils import add\n\nresult = add(2, 3)\nprint(result)',
            utils: 'def add(a, b):\n    return a + b',
        },
    },
    syntaxError: {
        incomplete: 'def foo(\n    pass',
        invalidIndent: 'if True:\nprint("bad")',
        unclosed: 'print("hello',
    },
    runtimeError: {
        divisionByZero: 'result = 1 / 0',
        nameError: 'print(undefined_variable)',
        importError: 'import nonexistent_module',
        typeError: 'result = "string" + 123',
    },
};

module.exports = {
    createTestFile,
    createTestStructure,
    waitFor,
    sampleCode,
};
