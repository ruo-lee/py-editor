import { EditorManager } from './EditorManager.js';
import { TabManager } from './TabManager.js';

/**
 * SplitViewManager - Manages split view functionality
 * Handles two editors side by side with independent tab management
 */
export class SplitViewManager {
    constructor(leftContainer, rightContainer, leftTabBar, rightTabBar, theme = 'vs-dark') {
        this.splitViewActive = false;
        this.focusedEditor = 'left';

        // Left editor (always exists)
        this.leftEditor = new EditorManager(leftContainer, theme);
        this.leftTabManager = new TabManager(
            leftTabBar,
            (file) => this.onLeftTabSwitch(file),
            (file) => this.onLeftTabClose(file)
        );

        // Right editor (created when split view activated)
        this.rightEditor = null;
        this.rightTabManager = new TabManager(
            rightTabBar,
            (file) => this.onRightTabSwitch(file),
            (file) => this.onRightTabClose(file)
        );
        this.rightContainer = rightContainer;
        this.rightTabBar = rightTabBar;

        // Callbacks
        this.onFileLoad = null;
        this.onFileClose = null;
        this.onEditorFocus = null;
    }

    /**
     * Initialize left editor
     */
    initializeLeftEditor(content = '', language = 'python') {
        return this.leftEditor.createEditor(content, language);
    }

    /**
     * Toggle split view
     */
    toggleSplit() {
        this.splitViewActive = !this.splitViewActive;

        if (this.splitViewActive) {
            this.activateSplitView();
        } else {
            this.deactivateSplitView();
        }

        return this.splitViewActive;
    }

    /**
     * Activate split view
     */
    activateSplitView() {
        this.splitViewActive = true;

        // Show right editor container
        this.rightContainer.style.display = 'flex';
        this.rightTabBar.style.display = 'flex';

        // Create right editor if doesn't exist
        if (!this.rightEditor) {
            this.rightEditor = new EditorManager(
                this.rightContainer.querySelector('.editor-container'),
                this.leftEditor.getTheme()
            );
            this.rightEditor.createEditor();
        }

        // Layout both editors
        this.leftEditor.layout();
        this.rightEditor.layout();
    }

    /**
     * Deactivate split view
     */
    deactivateSplitView() {
        this.splitViewActive = false;

        // Hide right editor
        this.rightContainer.style.display = 'none';
        this.rightTabBar.style.display = 'none';

        // Dispose right editor
        if (this.rightEditor) {
            this.rightEditor.dispose();
            this.rightEditor = null;
        }

        // Close all right tabs
        this.rightTabManager.closeAllTabs();

        // Focus left editor
        this.focusedEditor = 'left';
        this.leftEditor.focus();
    }

    /**
     * Get focused editor
     */
    getFocusedEditor() {
        if (this.focusedEditor === 'right' && this.rightEditor) {
            return this.rightEditor;
        }
        return this.leftEditor;
    }

    /**
     * Get focused tab manager
     */
    getFocusedTabManager() {
        return this.focusedEditor === 'right' ? this.rightTabManager : this.leftTabManager;
    }

    /**
     * Set focus to editor
     */
    setFocus(side) {
        this.focusedEditor = side;
        if (side === 'right' && this.rightEditor) {
            this.rightEditor.focus();
        } else {
            this.leftEditor.focus();
        }

        if (this.onEditorFocus) {
            this.onEditorFocus(side);
        }
    }

    /**
     * Open file in focused editor
     */
    async openFileInFocused(filePath, content, language = 'python', isStdlib = false) {
        const editor = this.getFocusedEditor();
        const tabManager = this.getFocusedTabManager();

        // Create or get model
        const model = editor.getOrCreateModel(filePath, content, language);

        // Set model to editor
        editor.setModel(model);

        // Open tab
        tabManager.openTab(filePath, isStdlib);

        return { editor, tabManager };
    }

    /**
     * Get active file for focused editor
     */
    getActiveFile() {
        const tabManager = this.getFocusedTabManager();
        return tabManager.getActiveFile();
    }

    /**
     * Set theme for both editors
     */
    setTheme(theme) {
        this.leftEditor.setTheme(theme);
        if (this.rightEditor) {
            this.rightEditor.setTheme(theme);
        }
    }

    /**
     * Layout both editors
     */
    layout() {
        this.leftEditor.layout();
        if (this.rightEditor) {
            this.rightEditor.layout();
        }
    }

    /**
     * Tab switch callback - left
     */
    onLeftTabSwitch(file) {
        this.focusedEditor = 'left';
        if (this.onFileLoad) {
            this.onFileLoad(file, 'left');
        }
    }

    /**
     * Tab switch callback - right
     */
    onRightTabSwitch(file) {
        this.focusedEditor = 'right';
        if (this.onFileLoad) {
            this.onFileLoad(file, 'right');
        }
    }

    /**
     * Tab close callback - left
     */
    onLeftTabClose(file) {
        if (this.onFileClose) {
            this.onFileClose(file, 'left');
        }
    }

    /**
     * Tab close callback - right
     */
    onRightTabClose(file) {
        if (this.onFileClose) {
            this.onFileClose(file, 'right');
        }
    }

    /**
     * Check if split view is active
     */
    isSplitViewActive() {
        return this.splitViewActive;
    }

    /**
     * Dispose all editors
     */
    dispose() {
        this.leftEditor.dispose();
        if (this.rightEditor) {
            this.rightEditor.dispose();
        }
        this.leftTabManager.closeAllTabs();
        this.rightTabManager.closeAllTabs();
    }
}
