/**
 * editorConfig.js
 * Monaco Editor configuration and constants
 */

/**
 * Welcome page HTML content
 */
export const WELCOME_HTML = `
<div class="welcome-page">
    <div class="welcome-container">
        <div class="welcome-header">
            <div class="welcome-logo">
                <i class="codicon codicon-code welcome-logo-icon"></i>
                <div class="welcome-logo-text">PyEditor</div>
            </div>
            <div class="welcome-subtitle">Python Development Environment</div>
        </div>

        <div class="welcome-section">
            <div class="welcome-section-title">
                <i class="codicon codicon-rocket welcome-section-icon"></i>
                Start
            </div>
            <div class="welcome-actions">
                <button class="welcome-action-btn" id="welcomeNewFile">
                    <i class="codicon codicon-new-file welcome-action-icon"></i>
                    <div class="welcome-action-content">
                        <div class="welcome-action-title">New File</div>
                        <div class="welcome-action-desc">Create a new Python file</div>
                    </div>
                </button>
                <button class="welcome-action-btn" id="welcomeApiRequest">
                    <i class="codicon codicon-globe welcome-action-icon"></i>
                    <div class="welcome-action-content">
                        <div class="welcome-action-title">API Request</div>
                        <div class="welcome-action-desc">Test APIs with built-in client</div>
                    </div>
                </button>
            </div>
        </div>

        <div class="welcome-section">
            <div class="welcome-section-title">
                <i class="codicon codicon-lightbulb welcome-section-icon"></i>
                Tips
            </div>
            <div class="welcome-tips">
                <div class="welcome-tip">
                    <i class="codicon codicon-play welcome-tip-icon"></i>
                    <div class="welcome-tip-content">
                        <div class="welcome-tip-title">Run Code</div>
                        <div class="welcome-tip-desc">Press <span class="welcome-keyboard">Ctrl+R</span> or click the Run button to execute your Python code</div>
                    </div>
                </div>
                <div class="welcome-tip">
                    <i class="codicon codicon-globe welcome-tip-icon"></i>
                    <div class="welcome-tip-content">
                        <div class="welcome-tip-title">API Testing</div>
                        <div class="welcome-tip-desc">Test HTTP APIs directly from the editor with the built-in API request panel</div>
                    </div>
                </div>
                <div class="welcome-tip">
                    <i class="codicon codicon-split-horizontal welcome-tip-icon"></i>
                    <div class="welcome-tip-content">
                        <div class="welcome-tip-title">Split View</div>
                        <div class="welcome-tip-desc">Edit multiple files side by side with the split editor feature</div>
                    </div>
                </div>
                <div class="welcome-tip">
                    <i class="codicon codicon-symbol-method welcome-tip-icon"></i>
                    <div class="welcome-tip-content">
                        <div class="welcome-tip-title">Code Intelligence</div>
                        <div class="welcome-tip-desc">Enjoy auto-completion, hover info, and go-to-definition with LSP support</div>
                    </div>
                </div>
                <div class="welcome-tip">
                    <i class="codicon codicon-symbol-keyword welcome-tip-icon"></i>
                    <div class="welcome-tip-content">
                        <div class="welcome-tip-title">Code Formatting</div>
                        <div class="welcome-tip-desc">Format your code with <span class="welcome-keyboard">Shift+Alt+F</span> or use the format button in the header</div>
                    </div>
                </div>
                <div class="welcome-tip">
                    <i class="codicon codicon-type-hierarchy welcome-tip-icon"></i>
                    <div class="welcome-tip-content">
                        <div class="welcome-tip-title">Type Checking</div>
                        <div class="welcome-tip-desc">Enable real-time type checking with mypy using the toggle button in the header</div>
                    </div>
                </div>
                <div class="welcome-tip">
                    <i class="codicon codicon-color-mode welcome-tip-icon"></i>
                    <div class="welcome-tip-content">
                        <div class="welcome-tip-title">Switch Theme</div>
                        <div class="welcome-tip-desc">Toggle between dark and light themes using the button in the top-right corner</div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>
`;

/**
 * Default Monaco Editor options
 * @param {string} theme - Editor theme (vs-dark or vs-light)
 * @param {boolean} readOnly - Whether editor is read-only
 * @returns {object} Monaco editor options
 */
export function getDefaultEditorOptions(theme = 'vs-dark', readOnly = false) {
    return {
        value: '',
        language: 'python',
        theme: theme,
        fontSize: 14,
        lineNumbers: 'on',
        minimap: { enabled: false },
        automaticLayout: true,
        scrollBeyondLastLine: false,
        wordWrap: 'on',
        folding: true,
        foldingStrategy: 'indentation',
        showFoldingControls: 'always',
        tabSize: 4,
        insertSpaces: true,
        autoIndent: 'full',
        formatOnPaste: true,
        formatOnType: true,
        readOnly: readOnly,
        bracketPairColorization: {
            enabled: true,
        },
        guides: {
            indentation: true,
        },
        gotoLocation: {
            multiple: 'goto',
        },
        links: true, // Enable Ctrl+Click to follow links (go to definition)
    };
}

/**
 * Python language configuration for Monaco Editor
 */
export const PYTHON_LANGUAGE_CONFIG = {
    id: 'python',
    extensions: ['.py', '.pyi'], // Include .pyi stub files
};

/**
 * TypeScript/JavaScript eager model sync configuration
 */
export function configureTypeScriptDefaults(monaco) {
    monaco.languages.typescript.javascriptDefaults.setEagerModelSync(true);
}

/**
 * Register Python language with Monaco
 */
export function registerPythonLanguage(monaco) {
    monaco.languages.register(PYTHON_LANGUAGE_CONFIG);
}
