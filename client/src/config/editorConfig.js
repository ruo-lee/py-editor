/**
 * editorConfig.js
 * Monaco Editor configuration and constants
 */

/**
 * Welcome message displayed when editor first loads
 */
export const WELCOME_MESSAGE = `"""
╔═══════════════════════════════════════════════════════════════════════════╗
║                                                                           ║
║     ██████╗ ██╗   ██╗       ███████╗██████╗ ██╗████████╗ ██████╗ ██████╗
║     ██╔══██╗╚██╗ ██╔╝       ██╔════╝██╔══██╗██║╚══██╔══╝██╔═══██╗██╔══██╗
║     ██████╔╝ ╚████╔╝  ████╗ █████╗  ██║  ██║██║   ██║   ██║   ██║██████╔╝
║     ██╔═══╝   ╚██╔╝   ╚═══╝ ██╔══╝  ██║  ██║██║   ██║   ██║   ██║██╔══██╗
║     ██║        ██║          ███████╗██████╔╝██║   ██║   ╚██████╔╝██║  ██║
║     ╚═╝        ╚═╝          ╚══════╝╚═════╝ ╚═╝   ╚═╝    ╚═════╝ ╚═╝  ╚═╝
║                                                                           ║
║         Welcome to PY-EDITOR - Python Development Environment            ║
║                                                                           ║
╚═══════════════════════════════════════════════════════════════════════════╝

🚀 Quick Start:
   • Create a new file: Click the + icon in Explorer
   • Open existing file: Click any .py file in Explorer
   • Run your code: Click the Run button or press Ctrl+R (Cmd+R on Mac)
   • Save your work: Press Ctrl+S (Cmd+S on Mac)

💡 Tips:
   • Use split view: Click the split icon to edit multiple files
   • Delete files: Select a file and press Delete (Cmd+Backspace on Mac)
   • Switch themes: Click the theme toggle button in the top-right corner
   • Auto-completion: Start typing to see intelligent suggestions

📝 Start coding by opening a file from the Explorer!

Note: This is a read-only welcome screen. Open or create a file to start editing.
"""`;

/**
 * Default Monaco Editor options
 * @param {string} theme - Editor theme (vs-dark or vs-light)
 * @param {boolean} readOnly - Whether editor is read-only
 * @returns {object} Monaco editor options
 */
export function getDefaultEditorOptions(theme = 'vs-dark', readOnly = false) {
    return {
        value: readOnly ? WELCOME_MESSAGE : '',
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
