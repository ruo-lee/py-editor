import * as monaco from 'monaco-editor';

/**
 * ThemeManager - Manages editor themes
 */
export class ThemeManager {
    constructor(context) {
        this.context = context;
    }

    toggleTheme() {
        this.context.currentTheme = this.context.currentTheme === 'vs-dark' ? 'vs' : 'vs-dark';
        this.applyTheme(this.context.currentTheme);
        localStorage.setItem('editor-theme', this.context.currentTheme);

        // Update API panel theme
        if (this.context.apiPanel) {
            this.context.apiPanel.updateTheme(this.context.currentTheme);
        }
    }

    applyTheme(theme) {
        // Update body class
        if (theme === 'vs') {
            document.body.classList.add('light-theme');
        } else {
            document.body.classList.remove('light-theme');
        }

        // Update main editor
        if (this.context.editor) {
            monaco.editor.setTheme(theme);
        }

        // Update right editor if exists
        if (this.context.rightEditor) {
            monaco.editor.setTheme(theme);
        }
    }
}
