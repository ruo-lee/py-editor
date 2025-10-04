# Server Test Suite

## 📋 Overview

This test suite focuses on **user scenarios** and **real-world workflows** using Integration and E2E testing strategies.

## 🏗️ Test Structure

```
__tests__/
├── integration/          # Integration Tests (API + Real Python execution)
│   ├── execution.test.js    # Code execution scenarios
│   ├── files.test.js        # File management scenarios
│   └── workspace.test.js    # Workspace operations scenarios
├── e2e/                 # End-to-End Tests (Complete workflows)
│   └── user-workflows.test.js
├── helpers/             # Test utilities
│   ├── setup.js            # Global test setup
│   └── testUtils.js        # Helper functions
└── fixtures/            # Test data
    ├── sample-code.py
    └── syntax-error.py
```

## 🎯 Test Coverage

### Integration Tests (60+ scenarios)

**Execution Tests** (`execution.test.js`)

- ✅ First-time user writes Hello World
- ✅ Student makes syntax errors
- ✅ Developer encounters runtime errors
- ✅ Interactive programs with user input
- ✅ Different types of programs (math, loops, functions)
- ✅ Output formatting and Unicode
- ✅ Performance and limits
- ✅ Error recovery workflow

**File Tests** (`files.test.js`)

- ✅ Exploring project structure
- ✅ Creating first Python file
- ✅ Reading and editing files
- ✅ Cleaning up project files
- ✅ Working with special characters
- ✅ Concurrent file operations
- ✅ Large file handling
- ✅ Empty and whitespace handling

**Workspace Tests** (`workspace.test.js`)

- ✅ Organizing with directories
- ✅ Renaming and moving files
- ✅ Duplicating files for backup
- ✅ Uploading files to project
- ✅ Downloading project files
- ✅ Loading Python snippets
- ✅ Accessing Python standard library
- ✅ Complex workspace reorganization

### E2E Tests (8+ complete workflows)

**User Workflows** (`user-workflows.test.js`)

1. ✅ Complete beginner journey (create → check → run)
2. ✅ Multi-file project development (modules + imports)
3. ✅ Error detection and fixing (syntax → runtime → fixed)
4. ✅ Interactive data processing (user input)
5. ✅ Project backup and restore
6. ✅ File upload and execution
7. ✅ Project reorganization (refactoring structure)
8. ✅ Rapid prototyping cycle (quick iterations)

## 🚀 Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific test file
npm test execution.test.js

# Run integration tests only
npm run test:integration

# Run E2E tests only
npm run test:e2e

# Watch mode for development
npm run test:watch
```

## 📊 Expected Coverage

- **Integration Tests**: ~80% coverage
- **E2E Tests**: Critical user paths
- **Total**: ~70-80% code coverage

## 🛠️ Test Environment

- **Framework**: Jest
- **HTTP Testing**: Supertest
- **Test Workspace**: Isolated temp directory (auto-cleanup)
- **Timeout**: 30 seconds per test (for Python execution)

## ✅ Best Practices

1. **Isolation**: Each test uses clean workspace
2. **Real Execution**: Tests run actual Python code (no mocking)
3. **User Focus**: Tests mirror real user scenarios
4. **Fast Feedback**: Integration tests run in seconds
5. **Comprehensive**: Covers happy paths + edge cases

## 🔍 Test Philosophy

> "Test the user journey, not the implementation details"

- Focus on **what users do**, not **how code works internally**
- Test **real Python execution**, not mocked processes
- Verify **complete workflows**, not isolated functions
- Ensure **backwards compatibility** through contract testing

## 📝 Adding New Tests

1. Identify user scenario
2. Write test in appropriate file:
    - Simple API test → `integration/`
    - Complete workflow → `e2e/`
3. Use `testUtils` helpers for setup
4. Follow existing naming conventions
5. Run tests to verify

## 🐛 Debugging Failed Tests

```bash
# Run single test in watch mode
npm test -- execution.test.js --watch

# Show detailed output
npm test -- --verbose

# Run with debugging
node --inspect-brk node_modules/.bin/jest execution.test.js
```

## 📖 Example Test Structure

```javascript
describe('User Scenario: [What user wants to do]', () => {
    it('should [expected behavior]', async () => {
        // Step 1: Setup
        await createTestFile('example.py', 'print("test")');

        // Step 2: Execute user action
        const response = await request(app)
            .post('/api/execute')
            .send({ code: 'print("test")', filename: 'example.py' });

        // Step 3: Verify result
        expect(response.body.output).toContain('test');
        expect(response.body.exitCode).toBe(0);
    });
});
```

## 🎓 Learning Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Supertest Guide](https://github.com/visionmedia/supertest)
- [Testing Best Practices](https://testingjavascript.com/)

## 📈 Future Enhancements

- [ ] Add performance benchmarking tests
- [ ] Add WebSocket LSP integration tests
- [ ] Add concurrent user simulation tests
- [ ] Add load testing scenarios
- [ ] Add security penetration tests
