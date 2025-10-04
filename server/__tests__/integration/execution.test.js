/**
 * Integration Tests - Code Execution Scenarios
 * Tests real user scenarios for Python code execution
 */

const request = require('supertest');
const express = require('express');
const cors = require('cors');
const executionRouter = require('../../routes/execution');
const { sampleCode } = require('../helpers/testUtils');

describe('User Scenario: Code Execution', () => {
    let app;

    beforeAll(() => {
        app = express();
        app.use(cors());
        app.use(express.json());
        app.use('/api', executionRouter);
    });

    describe('Scenario: First-time user writes Hello World', () => {
        it('should successfully execute simple print statement', async () => {
            const response = await request(app).post('/api/execute').send({
                code: sampleCode.valid.hello,
                filename: 'hello.py',
            });

            expect(response.status).toBe(200);
            expect(response.body).toMatchObject({
                output: 'Hello, World!\n',
                error: '',
                exitCode: 0,
            });
            expect(response.body.executionTime).toBeGreaterThan(0);
        });

        it('should check syntax before execution', async () => {
            const response = await request(app).post('/api/check-syntax').send({
                code: sampleCode.valid.hello,
                filename: 'hello.py',
            });

            expect(response.status).toBe(200);
            expect(response.body).toEqual({
                status: 'ok',
            });
        });
    });

    describe('Scenario: Student makes syntax error', () => {
        it('should detect incomplete function definition', async () => {
            const response = await request(app).post('/api/check-syntax').send({
                code: sampleCode.syntaxError.incomplete,
                filename: 'error.py',
            });

            expect(response.status).toBe(200);
            expect(response.body).toMatchObject({
                status: 'error',
                errors: expect.arrayContaining([
                    expect.objectContaining({
                        severity: 'error',
                        line: expect.any(Number),
                        column: expect.any(Number),
                        type: 'SyntaxError',
                    }),
                ]),
            });
        });

        it('should detect invalid indentation', async () => {
            const response = await request(app).post('/api/check-syntax').send({
                code: sampleCode.syntaxError.invalidIndent,
                filename: 'indent_error.py',
            });

            expect(response.status).toBe(200);
            expect(response.body.status).toBe('error');
            expect(response.body.errors[0].message).toMatch(/indent/i);
        });

        it('should detect unclosed string', async () => {
            const response = await request(app).post('/api/check-syntax').send({
                code: sampleCode.syntaxError.unclosed,
                filename: 'string_error.py',
            });

            expect(response.status).toBe(200);
            expect(response.body.status).toBe('error');
        });
    });

    describe('Scenario: Developer encounters runtime errors', () => {
        it('should catch division by zero error', async () => {
            const response = await request(app).post('/api/execute').send({
                code: sampleCode.runtimeError.divisionByZero,
                filename: 'division.py',
            });

            expect(response.status).toBe(200);
            expect(response.body.exitCode).toBe(1);
            expect(response.body.error).toContain('ZeroDivisionError');
        });

        it('should catch undefined variable error', async () => {
            const response = await request(app).post('/api/execute').send({
                code: sampleCode.runtimeError.nameError,
                filename: 'name_error.py',
            });

            expect(response.status).toBe(200);
            expect(response.body.exitCode).toBe(1);
            expect(response.body.error).toContain('NameError');
        });

        it('should catch import error', async () => {
            const response = await request(app).post('/api/execute').send({
                code: sampleCode.runtimeError.importError,
                filename: 'import_error.py',
            });

            expect(response.status).toBe(200);
            expect(response.body.exitCode).toBe(1);
            expect(response.body.error).toMatch(/ImportError|ModuleNotFoundError/);
        });

        it('should catch type error', async () => {
            const response = await request(app).post('/api/execute').send({
                code: sampleCode.runtimeError.typeError,
                filename: 'type_error.py',
            });

            expect(response.status).toBe(200);
            expect(response.body.exitCode).toBe(1);
            expect(response.body.error).toContain('TypeError');
        });
    });

    describe('Scenario: Interactive program with user input', () => {
        it('should handle stdin input correctly', async () => {
            const response = await request(app).post('/api/execute').send({
                code: sampleCode.valid.input,
                filename: 'input_test.py',
                input: 'Alice\n',
            });

            expect(response.status).toBe(200);
            expect(response.body.output).toContain('Hello, Alice!');
            expect(response.body.exitCode).toBe(0);
        });

        it('should handle multiple inputs', async () => {
            const code = `
name = input("Name: ")
age = input("Age: ")
print(f"{name} is {age} years old")
`;
            const response = await request(app).post('/api/execute').send({
                code,
                filename: 'multi_input.py',
                input: 'Bob\n25\n',
            });

            expect(response.status).toBe(200);
            expect(response.body.output).toContain('Bob is 25 years old');
        });
    });

    describe('Scenario: Running different types of programs', () => {
        it('should execute mathematical calculations', async () => {
            const response = await request(app).post('/api/execute').send({
                code: sampleCode.valid.math,
                filename: 'math.py',
            });

            expect(response.status).toBe(200);
            expect(response.body.output.trim()).toBe('4');
            expect(response.body.exitCode).toBe(0);
        });

        it('should execute loops', async () => {
            const response = await request(app).post('/api/execute').send({
                code: sampleCode.valid.loop,
                filename: 'loop.py',
            });

            expect(response.status).toBe(200);
            expect(response.body.output).toBe('0\n1\n2\n3\n4\n');
            expect(response.body.exitCode).toBe(0);
        });

        it('should execute functions', async () => {
            const response = await request(app).post('/api/execute').send({
                code: sampleCode.valid.function,
                filename: 'function.py',
            });

            expect(response.status).toBe(200);
            expect(response.body.output).toContain('Hello, Python!');
            expect(response.body.exitCode).toBe(0);
        });
    });

    describe('Scenario: Working with output formatting', () => {
        it('should preserve multi-line output', async () => {
            const code = `
print("Line 1")
print("Line 2")
print("Line 3")
`;
            const response = await request(app).post('/api/execute').send({
                code,
                filename: 'multiline.py',
            });

            expect(response.status).toBe(200);
            expect(response.body.output).toBe('Line 1\nLine 2\nLine 3\n');
        });

        it('should handle Unicode characters', async () => {
            const code = 'print("안녕하세요 🐍 Python!")';
            const response = await request(app).post('/api/execute').send({
                code,
                filename: 'unicode.py',
            });

            expect(response.status).toBe(200);
            expect(response.body.output).toContain('안녕하세요 🐍 Python!');
        });

        it('should handle stderr output', async () => {
            const code = `
import sys
print("stdout message", file=sys.stdout)
print("stderr message", file=sys.stderr)
`;
            const response = await request(app).post('/api/execute').send({
                code,
                filename: 'stderr.py',
            });

            expect(response.status).toBe(200);
            expect(response.body.output).toContain('stdout message');
            expect(response.body.error).toContain('stderr message');
        });
    });

    describe('Scenario: Performance and limits', () => {
        it('should measure execution time', async () => {
            const code = `
import time
time.sleep(0.1)
print("done")
`;
            const response = await request(app).post('/api/execute').send({
                code,
                filename: 'timing.py',
            });

            expect(response.status).toBe(200);
            expect(response.body.executionTime).toBeGreaterThan(100); // At least 100ms
        });

        it('should handle quick execution', async () => {
            const response = await request(app).post('/api/execute').send({
                code: 'print("fast")',
                filename: 'fast.py',
            });

            expect(response.status).toBe(200);
            expect(response.body.executionTime).toBeLessThan(5000); // Less than 5 seconds
        });
    });

    describe('Scenario: Error recovery workflow', () => {
        it('should allow re-execution after fixing syntax error', async () => {
            // First attempt with error
            const errorResponse = await request(app).post('/api/check-syntax').send({
                code: 'def foo(\n  pass',
                filename: 'fix_me.py',
            });

            expect(errorResponse.body.status).toBe('error');

            // Second attempt with fixed code
            const fixedResponse = await request(app).post('/api/check-syntax').send({
                code: 'def foo():\n    pass',
                filename: 'fix_me.py',
            });

            expect(fixedResponse.body.status).toBe('ok');

            // Execute the fixed code
            const executeResponse = await request(app).post('/api/execute').send({
                code: 'def foo():\n    pass\nfoo()\nprint("success")',
                filename: 'fix_me.py',
            });

            expect(executeResponse.body.output).toContain('success');
            expect(executeResponse.body.exitCode).toBe(0);
        });
    });
});
