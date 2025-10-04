import * as monaco from 'monaco-editor';
import { LSPClient } from './src/lsp/LSPClient.js';
import { FileExplorer } from './src/explorer/FileExplorer.js';
import { UnifiedTabManager } from './src/tabs/UnifiedTabManager.js';
import { CompletionManager } from './src/editor/CompletionManager.js';
import { ValidationManager } from './src/editor/ValidationManager.js';
import { EditorInitializer } from './src/editor/EditorInitializer.js';
import { LSPProviderManager } from './src/editor/LSPProviderManager.js';
import { LinkDecorationManager } from './src/editor/LinkDecorationManager.js';
import { ContextMenu } from './src/explorer/ContextMenu.js';
import { FileOperations } from './src/explorer/FileOperations.js';
import { FileOperationsAdvanced } from './src/explorer/FileOperationsAdvanced.js';
import { FileLoader } from './src/explorer/FileLoader.js';
import { DialogManager } from './src/ui/DialogManager.js';
import { ResizeManager } from './src/ui/ResizeManager.js';
import { ThemeManager } from './src/ui/ThemeManager.js';
import { CodeExecutor } from './src/execution/CodeExecutor.js';
import { EventManager } from './src/events/EventManager.js';
import { SplitViewManager } from './src/split/SplitViewManager.js';
import { LSPManager } from './src/lsp/LSPManager.js';
import { LSPResponseHandlers } from './src/lsp/LSPResponseHandlers.js';
import { ImprovedLSPIntegration } from './src/lsp/ImprovedLSPIntegration.js';
import { FileUploadManager } from './src/upload/FileUploadManager.js';
import { TabContextMenuManager } from './src/tabs/TabContextMenuManager.js';
import { TabDragDropManager } from './src/tabs/TabDragDropManager.js';
import { ModelSyncManager } from './src/sync/ModelSyncManager.js';
import { WorkspaceManager } from './src/ui/WorkspaceManager.js';
import { getFileIcon } from './src/utils/fileIcons.js';
import {
    closeAllDialogs,
    updateFilePathDisplay,
    updateActiveFileHighlight,
    initializeSidebarResize,
} from './src/utils/uiHelpers.js';

// Import CSS styles
import './styles/base.css';
import './styles/header.css';
import './styles/sidebar.css';
import './styles/editor.css';
import './styles/tabs.css';
import './styles/output.css';
import './styles/api-panel.css';
import './styles/welcome.css';
import './styles/components/dialogs.css';
import './styles/components/context-menu.css';
import './styles/themes/light.css';
import './styles/references-panel.css';

// Monaco Editor environment is configured automatically by vite-plugin-monaco-editor

class PythonIDE {
    constructor() {
        this.editor = null;
        this.openTabs = new Map();
        this.activeFile = null;
        this.fileExplorer = document.getElementById('fileExplorer');
        this.tabBar = document.getElementById('tabBar');
        this.filePathBar = document.getElementById('filePathBar');
        this.executeButton = document.getElementById('executeButton');
        this.outputPanel = document.getElementById('outputPanel');
        this.lspClient = null;
        this.snippets = {};
        this.ctrlPressed = false;
        this.currentLinkDecorations = [];
        this.rightCurrentLinkDecorations = []; // For right editor
        this.selectedDirectory = ''; // Currently selected directory for context menu operations
        this.selectedItem = null; // Currently selected file/directory item {path, type}
        this.contextMenuTarget = null; // Target element for context menu
        this.showHiddenFiles = localStorage.getItem('show-hidden-files') === 'true'; // Hidden files visibility
        this.apiPanel = null; // API Request Panel

        // Parse workspace folder from URL
        const urlParams = new URLSearchParams(window.location.search);
        this.workspaceFolder = urlParams.get('folder') || '';

        // Split view state
        this.splitViewActive = false;
        this.rightEditor = null;
        this.rightOpenTabs = new Map();
        this.rightActiveFile = null;
        this.focusedEditor = 'left'; // 'left' or 'right' - tracks which editor has focus
        this.syncInProgress = false; // Prevents infinite sync loops
        this.modelChangeListeners = new Map(); // Stores change listeners for cleanup

        // Theme state
        this.currentTheme = localStorage.getItem('editor-theme') || 'vs-dark';

        // Initialize managers first (before using them)
        this.themeManager = new ThemeManager(this);
        this.resizeManager = new ResizeManager();
        this.dialogManager = new DialogManager();
        this.codeExecutor = new CodeExecutor(this);
        this.contextMenuInstance = new ContextMenu();

        // Apply theme after ThemeManager is initialized
        this.applyTheme(this.currentTheme);

        // Initialize UnifiedTabManager for left editor (merged/left mode)
        this.tabManager = new UnifiedTabManager(this, 'left');
        this.tabManager.setCallbacks(
            (filePath) => this.handleTabSwitch(filePath),
            (filePath) => this.handleTabClose(filePath)
        );

        // Initialize button visibility (show split button by default for left editor)
        setTimeout(() => {
            if (this.tabManager.updateActionButtonsVisibility) {
                this.tabManager.updateActionButtonsVisibility();
            }
        }, 0);

        // Initialize FileExplorer
        this.fileExplorerInstance = new FileExplorer(this.fileExplorer, {
            showHiddenFiles: this.showHiddenFiles,
            getFileIcon: getFileIcon, // Use imported utility function
            onFileClick: (filepath) => {
                // Update selectedItem when file is clicked
                this.selectedItem = { path: filepath, type: 'file' };
                // When split view is not active, set focus to left editor
                // When split view is active, keep current focusedEditor (respect user's editor focus)
                if (!this.splitViewActive) {
                    this.focusedEditor = 'left';
                }
                this.openFile(filepath);
            },
            onFolderClick: (path) => {
                this.selectedDirectory = path;
                this.selectedItem = { path, type: 'directory' };
            },
            onContextMenu: (e, item) => this.showContextMenu(e, item),
            onFileMove: (draggedItem, targetPath) => this.handleItemMove(draggedItem, targetPath),
            onExternalFileDrop: (files, targetPath, type) =>
                this.handleExternalFileDrop(files, targetPath, type),
        });

        // Initialize FileOperations
        this.fileOperationsInstance = new FileOperations(
            () => this.getFetchHeaders(),
            (path, params) => this.buildUrl(path, params),
            () => this.loadFileExplorer()
        );
        this.fileOpsAdvanced = new FileOperationsAdvanced(this);
        this.splitViewManager = new SplitViewManager(this);
        this.lspManager = new LSPManager(this);
        this.fileUploadManager = new FileUploadManager(this);
        this.tabContextMenuManager = new TabContextMenuManager(this);
        // rightTabManager will be initialized when split view is created
        this.rightTabManager = null;
        this.tabDragDropManager = new TabDragDropManager(this);
        this.modelSyncManager = new ModelSyncManager(this);
        this.workspaceManager = new WorkspaceManager(this);
        this.completionManager = new CompletionManager(this);
        this.validationManager = new ValidationManager(this);
        this.editorInitializer = new EditorInitializer(this);
        this.lspProviderManager = new LSPProviderManager(this);
        this.fileLoader = new FileLoader(this);
        this.linkDecorationManager = new LinkDecorationManager(this);
        this.lspResponseHandlers = new LSPResponseHandlers(this);

        this.initializeEditor();

        // Set initial focus on the editor group
        const initialEditorGroup = document.querySelector('.editor-group');
        if (initialEditorGroup) {
            initialEditorGroup.classList.add('focused');
        }

        // Initialize LSPClient (will be set up after snippets are loaded)
        this.lspClientInstance = null;
        this.loadSnippets();
        this.loadFileExplorer();
        this.setupEventListeners();
        this.initializeSidebarResize();
        this.initializeWorkspaceSection();
        this.initializeApiPanel();
    }

    // Helper method to add workspace folder to requests
    getFetchHeaders() {
        const headers = { 'Content-Type': 'application/json' };
        if (this.workspaceFolder && this.workspaceFolder.trim() !== '') {
            headers['x-workspace-folder'] = this.workspaceFolder;
        }
        return headers;
    }

    buildUrl(path, params = {}) {
        const url = new URL(path, window.location.origin);
        if (this.workspaceFolder && this.workspaceFolder.trim() !== '') {
            url.searchParams.set('folder', this.workspaceFolder);
        }
        Object.entries(params).forEach(([key, value]) => {
            url.searchParams.set(key, value);
        });
        return url.toString();
    }

    async initializeEditor() {
        await this.editorInitializer.initializeEditor();
    }

    setupCodeCompletion() {
        this.completionManager.setupCodeCompletion();
    }

    async initializeLanguageServer() {
        // Initialize LSPClient with snippets and fallback validation
        this.lspClientInstance = new LSPClient(this.snippets, () => this.setupBasicValidation());

        // Set callback to register providers AFTER LSP is fully initialized
        this.lspClientInstance.onInitialized = () => {
            this.lspProviderManager.registerAllProviders();

            // Setup improved LSP integration with validation and Find References
            this.improvedLSP = new ImprovedLSPIntegration(this);
            this.improvedLSP.setup();
        };

        // Keep reference to languageClient for backward compatibility
        await this.lspClientInstance.connect();
        this.languageClient = this.lspClientInstance.languageClient;
        this.messageId = this.lspClientInstance.messageId;
        this.pendingRequests = this.lspClientInstance.pendingRequests;
    }

    // Note: initializeLSP, sendLSPRequest, and handleLSPResponse are now handled by LSPClient class

    sendLSPRequest(request) {
        // Wrapper for backward compatibility - delegates to LSPClient
        if (this.lspClientInstance) {
            this.lspClientInstance.sendRequest(request);
        }
    }

    handleLSPResponse(response) {
        // This is now handled internally by LSPClient
        if (response.id && this.pendingRequests.has(response.id)) {
            const request = this.pendingRequests.get(response.id);
            this.pendingRequests.delete(response.id);

            switch (request.method) {
                case 'initialize':
                    this.handleInitializeResponse(response);
                    break;
                case 'textDocument/completion':
                    this.handleCompletionResponse(response);
                    break;
                case 'textDocument/definition':
                    this.handleDefinitionResponse(response);
                    break;
                case 'textDocument/hover':
                    this.handleHoverResponse(response);
                    break;
            }
        }
    }

    handleInitializeResponse(_response) {
        // This method is no longer needed - handled by LSPClient
        // Kept for backward compatibility but does nothing
    }

    // setupAdvancedFeatures is now handled by LSPProviderManager
    // Called from LSPClient's onInitialized callback

    setupBasicValidation() {
        this.validationManager.setupBasicValidation();
    }

    // Syntax checking is handled by LSP automatically
    debouncedSyntaxCheck() {
        // LSP handles this automatically
    }

    // Syntax checking is handled by LSP automatically
    async performSyntaxCheck() {
        // LSP handles this automatically
    }

    async getCompletionItems(model, position) {
        return await this.lspManager.getCompletionItems(model, position);
    }

    getBasicCompletions() {
        return this.completionManager.getBasicCompletions();
    }

    handleCompletionResponse(response) {
        if (this.completionResolve) {
            const resolve = this.completionResolve;
            this.completionResolve = null;

            if (response.result && response.result.items) {
                const suggestions = response.result.items.map((item) => ({
                    label: item.label,
                    kind: this.convertCompletionItemKind(item.kind),
                    insertText: item.insertText || item.label,
                    detail: item.detail || '',
                    documentation: item.documentation || '',
                    sortText: item.sortText,
                }));

                resolve({ suggestions });
            } else {
                resolve(this.getBasicCompletions());
            }
        }
    }

    convertCompletionItemKind(lspKind) {
        const kindMap = {
            1: monaco.languages.CompletionItemKind.Text,
            2: monaco.languages.CompletionItemKind.Method,
            3: monaco.languages.CompletionItemKind.Function,
            4: monaco.languages.CompletionItemKind.Constructor,
            5: monaco.languages.CompletionItemKind.Field,
            6: monaco.languages.CompletionItemKind.Variable,
            7: monaco.languages.CompletionItemKind.Class,
            8: monaco.languages.CompletionItemKind.Interface,
            9: monaco.languages.CompletionItemKind.Module,
            10: monaco.languages.CompletionItemKind.Property,
            11: monaco.languages.CompletionItemKind.Unit,
            12: monaco.languages.CompletionItemKind.Value,
            13: monaco.languages.CompletionItemKind.Enum,
            14: monaco.languages.CompletionItemKind.Keyword,
            15: monaco.languages.CompletionItemKind.Snippet,
        };

        return kindMap[lspKind] || monaco.languages.CompletionItemKind.Text;
    }

    async getDefinition(model, position, editorSide = 'left') {
        return await this.lspManager.getDefinition(model, position, editorSide);
    }

    async ensureDocumentSynchronized(filePath, content) {
        await this.lspManager.ensureDocumentSynchronized(filePath, content);
    }

    handleDefinitionResponse(response) {
        return this.lspResponseHandlers.handleDefinitionResponse(response);
    }

    async getHover(model, position) {
        return await this.lspManager.getHover(model, position);
    }

    handleHoverResponse(response) {
        this.lspResponseHandlers.handleHoverResponse(response);
    }

    async handleCtrlClick(position, editorSide = 'left') {
        return await this.lspManager.handleCtrlClick(position, editorSide);
    }

    handleMouseMove(e, editorSide = 'left') {
        if (this.ctrlPressed && e.target) {
            // Monaco 에디터의 마우스 이벤트에서 position 추출
            const position = e.target.position;

            if (position) {
                this.showLinkAtPosition(position, editorSide);
            } else {
                this.clearLinkDecorations(editorSide);
            }
        } else {
            this.clearLinkDecorations(editorSide);
        }
    }

    updateCursorStyle() {
        const editor = document.querySelector('.monaco-editor');
        if (editor) {
            if (this.ctrlPressed) {
                editor.style.cursor = 'pointer';
            } else {
                editor.style.cursor = 'text';
            }
        }
    }

    showLinkAtPosition(position, editorSide = 'left') {
        this.linkDecorationManager.showLinkAtPosition(position, editorSide);
    }

    isLinkableElement(line, word, position) {
        return this.linkDecorationManager.isLinkableElement(line, word, position);
    }

    clearLinkDecorations(editorSide = 'left') {
        this.linkDecorationManager.clearLinkDecorations(editorSide);
    }

    notifyDocumentOpened(filepath, content) {
        // Delegate to LSPManager
        if (this.lspManager) {
            this.lspManager.notifyDocumentOpened(filepath, content);
        }
    }

    notifyDocumentChanged(filepath, content) {
        // Delegate to LSPManager
        if (this.lspManager) {
            this.lspManager.notifyDocumentChanged(filepath, content);
        }
    }

    notifyDocumentClosed(filepath) {
        // Delegate to LSPManager
        if (this.lspManager) {
            this.lspManager.notifyDocumentClosed(filepath);
        }
    }

    isStdlibFile(filepath) {
        if (!filepath) return false;

        // Handle file:// URIs
        const cleanPath = filepath.startsWith('file://')
            ? filepath.replace('file://', '')
            : filepath;

        return (
            cleanPath.startsWith('/usr/local/lib/python') ||
            cleanPath.startsWith('/usr/lib/python') ||
            cleanPath.includes('site-packages') ||
            cleanPath.includes('typeshed') ||
            cleanPath.includes('/lib/python')
        );
    }

    async loadSnippets() {
        try {
            const response = await fetch('/api/snippets');
            this.snippets = await response.json();

            // Initialize LSP after snippets are loaded
            await this.initializeLanguageServer();
        } catch (error) {
            console.error('Failed to load snippets:', error);
        }
    }

    async loadFileExplorer() {
        try {
            const url = this.workspaceFolder
                ? `/api/files?folder=${encodeURIComponent(this.workspaceFolder)}`
                : '/api/files';
            const response = await fetch(url);
            const data = await response.json();

            // Handle new response format
            const files = data.files || data;

            // Use FileExplorer instance to render
            this.fileExplorerInstance.render(files);

            // Restore selected directory highlight after refresh
            if (this.selectedDirectory) {
                this.fileExplorerInstance.restoreSelection(this.selectedDirectory);
                const selectedElement = document.querySelector(
                    `[data-path="${this.selectedDirectory}"][data-type="directory"]`
                );
                if (!selectedElement) {
                    // Directory no longer exists, clear selection
                    this.selectedDirectory = '';
                }
            }
        } catch (error) {
            this.fileExplorer.innerHTML = '<div class="error">Failed to load files</div>';
        }
    }

    // Wrapper method for FileExplorer (deprecated - use fileExplorerInstance.render directly)
    renderFileExplorer(files, container = this.fileExplorer, level = 0) {
        if (level === 0) {
            this.fileExplorerInstance.render(files, container, level);
        } else {
            // For nested calls, use the FileExplorer instance render method
            this.fileExplorerInstance.render(files, container, level);
        }
    }

    // Note: setupExplorerDropZone, setupDragEvents, and setupDropZone are now handled by FileExplorer class

    async handleItemMove(draggedItem, targetPath) {
        return await this.fileUploadManager.handleItemMove(draggedItem, targetPath);
    }

    async handleExternalFileDrop(filesOrItems, targetPath, type) {
        // Handle both old 2-param and new 3-param signatures
        if (type === 'items') {
            return await this.fileUploadManager.handleDroppedItems(filesOrItems, targetPath);
        } else {
            return await this.fileUploadManager.handleFileUpload(filesOrItems, targetPath);
        }
    }

    async handleDroppedItems(items, targetPath) {
        return await this.fileUploadManager.handleDroppedItems(items, targetPath);
    }

    async traverseFileTree(item, path, allFiles) {
        return await this.fileUploadManager.traverseFileTree(item, path, allFiles);
    }

    async handleFileUpload(filesOrArray, targetPath) {
        return await this.fileUploadManager.handleFileUpload(filesOrArray, targetPath);
    }

    async openFile(filepath) {
        // Open in focused editor when split view is active
        const targetEditor = this.splitViewActive ? this.focusedEditor : 'left';
        await this.fileLoader.openFile(filepath, targetEditor);
    }

    // createTab is now handled by TabManager

    // TabManager callback handlers
    handleTabSwitch(filepath) {
        // Called from TabManager after tab UI is already updated
        // Pass updateUI=false to prevent infinite loop
        this.switchToTab(filepath, false);
    }

    handleTabClose(filepath) {
        // Cleanup sync listener if exists
        this.cleanupSyncListener(filepath);

        const tabData = this.openTabs.get(filepath);
        if (tabData) {
            tabData.model.dispose();
            this.openTabs.delete(filepath);
        }

        // Switch to another tab if this was active
        if (this.activeFile === filepath) {
            const remainingFiles = this.tabManager.getOpenFiles();
            if (remainingFiles.length > 0) {
                this.switchToTab(remainingFiles[remainingFiles.length - 1]);
            } else {
                this.activeFile = null;
                this.editor.setModel(null);
                this.executeButton.style.display = 'none';
            }
        }
    }

    switchToTab(filepath, updateUI = true) {
        // Delegate to UnifiedTabManager, but handle legacy updateUI parameter
        if (this.tabManager) {
            // If updateUI is false, we're being called from TabManager callback
            // so just update editor state without triggering tab UI updates
            if (!updateUI) {
                const tabData = this.openTabs.get(filepath);
                if (tabData) {
                    this.editor.setModel(tabData.model);
                    this.activeFile = filepath;

                    // Make editor editable (remove readOnly from welcome screen)
                    this.editor.updateOptions({ readOnly: tabData.isStdlib });

                    // Update file path display
                    this.updateFilePathDisplay(filepath, tabData.isStdlib);

                    // Update active file highlighting in explorer
                    this.updateActiveFileHighlight();

                    // Show execute button for Python files (not for stdlib files)
                    const isPython = filepath.endsWith('.py');
                    this.executeButton.style.display =
                        isPython && !tabData.isStdlib ? 'block' : 'none';

                    // Hide references panel when switching tabs (UX improvement)
                    if (this.referencesPanel) {
                        this.referencesPanel.hide('left');
                    }

                    // Setup sync if same file is open in both editors
                    if (this.splitViewActive) {
                        this.setupModelSync(filepath);
                    }
                }
            } else {
                // Normal switch - let UnifiedTabManager handle it
                this.tabManager.switchTab(filepath);
            }
        }
    }

    closeTab(filepath, editorGroup = 'left') {
        // Use appropriate TabManager based on editor group
        if (editorGroup === 'right' && this.rightTabManager) {
            this.rightTabManager.closeTab(filepath);
        } else {
            this.tabManager.closeTab(filepath);
        }
    }

    async saveFile(filepath) {
        const tabData = this.openTabs.get(filepath);
        if (!tabData) return;

        try {
            const content = tabData.model.getValue();
            await fetch(this.buildUrl(`/api/files/${filepath}`), {
                method: 'POST',
                headers: this.getFetchHeaders(),
                body: JSON.stringify({ content }),
            });

            tabData.saved = true;
        } catch (error) {
            console.error('Failed to save file:', error);
        }
    }

    async executeCode(editorGroup = 'left') {
        // Use unified output panel for both left and right editors
        await this.codeExecutor.executeForEditorGroup(editorGroup, {
            leftActiveFile: this.activeFile,
            rightActiveFile: this.rightActiveFile,
            leftOpenTabs: this.openTabs,
            rightOpenTabs: this.rightOpenTabs,
            outputPanel: this.outputPanel,
            outputPanelContent: document.getElementById('outputPanelContent'),
        });
    }

    async handleGoToDefinition(position) {
        await this.lspManager.handleGoToDefinition(position);
    }

    setupEventListeners() {
        const eventManager = new EventManager(this);
        eventManager.setupAllListeners();
    }

    showCreateDialog(type) {
        this.dialogManager.showCreateDialog(
            type,
            this.selectedDirectory,
            async (fullPath, type) => {
                if (type === 'file') {
                    await this.createFile(fullPath);
                } else {
                    await this.createFolder(fullPath);
                }
            },
            (path) => this.checkIfFileExists(path),
            () => this.loadFileExplorer()
        );
    }

    async createFile(filename) {
        const content = filename.endsWith('.py')
            ? `#!/usr/bin/env python3\n"""\n${filename} - Description\n"""\n\n\ndef main():\n    pass\n\n\nif __name__ == "__main__":\n    main()\n`
            : '';

        const response = await fetch(this.buildUrl(`/api/files/${filename}`), {
            method: 'POST',
            headers: this.getFetchHeaders(),
            body: JSON.stringify({ content }),
        });

        if (!response.ok) {
            throw new Error('Failed to create file');
        }
    }

    async createFolder(foldername) {
        // Create folder using mkdir API
        const response = await fetch(this.buildUrl('/api/mkdir'), {
            method: 'POST',
            headers: this.getFetchHeaders(),
            body: JSON.stringify({ path: foldername }),
        });

        if (!response.ok) {
            throw new Error('Failed to create folder');
        }
    }

    async checkIfFileExists(filepath) {
        try {
            const response = await fetch(this.buildUrl(`/api/files/${filepath}`), {
                headers: this.getFetchHeaders(),
            });
            return response.ok;
        } catch (error) {
            return false;
        }
    }

    closeDialog() {
        closeAllDialogs();
        // Keep selected directory when dialog is closed (don't clear)
        // This allows users to create multiple files in the same directory
    }

    closeContextMenu() {
        // Delegate to ContextMenu instance
        if (this.contextMenuInstance) {
            this.contextMenuInstance.close();
        }
    }

    updateFilePathDisplay(filepath, isStdlib = false) {
        updateFilePathDisplay(this.filePathBar, filepath, isStdlib);
    }

    updateFilePathDisplayForElement(element, filepath, isStdlib = false) {
        updateFilePathDisplay(element, filepath, isStdlib);
    }

    updateActiveFileHighlight() {
        updateActiveFileHighlight(this.activeFile, this.rightActiveFile, this.focusedEditor);
    }

    initializeSidebarResize() {
        initializeSidebarResize('sidebar', 'sidebarResizer');
    }

    showTabContextMenu(event, filepath, editorGroup = 'left') {
        this.tabContextMenuManager.showTabContextMenu(event, filepath, editorGroup);
    }

    closeOtherTabs(keepFilepath) {
        const allFiles = this.tabManager.getOpenFiles();
        allFiles.forEach((filepath) => {
            if (filepath !== keepFilepath) {
                this.closeTab(filepath);
            }
        });
    }

    closeAllTabs() {
        this.tabManager.closeAllTabs();
    }

    closeTabsToRight(fromFilepath) {
        const allTabs = Array.from(document.querySelectorAll('.tab'));
        const fromIndex = allTabs.findIndex((tab) => tab.dataset.filepath === fromFilepath);

        if (fromIndex !== -1) {
            for (let i = fromIndex + 1; i < allTabs.length; i++) {
                this.closeTab(allTabs[i].dataset.filepath);
            }
        }
    }

    setupSplitResize(divider, leftGroup, rightGroup) {
        this.resizeManager.setupSplitResize(divider, leftGroup, rightGroup);
    }

    setupOutputPanelResize(resizer, outputPanel) {
        this.resizeManager.setupOutputPanelResize(resizer, outputPanel);
    }

    async openFileInSplit(filepath) {
        return await this.splitViewManager.openFileInSplit(filepath);
    }

    createTabInSplit(filepath) {
        this.rightTabManager.createTabInSplit(filepath);
    }

    switchToTabInSplit(filepath) {
        this.rightTabManager.switchToTabInSplit(filepath);
        this.setupModelSync(filepath);
    }

    closeTabInSplit(filepath) {
        this.cleanupSyncListener(filepath);
        this.rightTabManager.closeTabInSplit(filepath);
        if (this.rightOpenTabs.size === 0) {
            this.closeSplitView();
        }
    }

    closeOtherTabsInSplit(keepFilepath) {
        this.rightTabManager.closeOtherTabsInSplit(keepFilepath);
    }

    closeAllTabsInSplit() {
        this.rightTabManager.closeAllTabsInSplit();
    }

    closeTabsToRightInSplit(fromFilepath) {
        this.rightTabManager.closeTabsToRightInSplit(fromFilepath);
    }

    closeSplitView(mergeTabsToLeft = false) {
        this.splitViewManager.closeSplitView(mergeTabsToLeft);
    }

    setupModelSync(filepath) {
        this.modelSyncManager.setupModelSync(filepath);
    }

    cleanupSyncListener(filepath) {
        this.modelSyncManager.cleanupSyncListener(filepath);
    }

    cleanupAllSyncListeners() {
        this.modelSyncManager.cleanupAllSyncListeners();
    }

    toggleSplit() {
        this.splitViewManager.toggleSplit();
    }

    createSplitView() {
        this.splitViewManager.createSplitView();
    }

    setupTabBarDropZones() {
        this.tabDragDropManager.setupTabBarDropZones();
    }

    setupTabBarDrop(tabBar, targetEditor) {
        this.tabDragDropManager.setupTabBarDrop(tabBar, targetEditor);
    }

    async moveTabBetweenEditors(filepath, fromEditor, toEditor) {
        await this.tabDragDropManager.moveTabBetweenEditors(filepath, fromEditor, toEditor);
    }

    updateSplitButtonIcon() {
        const splitToggleBtn = document.getElementById('splitToggleBtn');
        if (splitToggleBtn) {
            const icon = splitToggleBtn.querySelector('i');
            if (icon) {
                if (this.splitViewActive) {
                    icon.className = 'codicon codicon-screen-normal';
                    splitToggleBtn.title = 'Close Split Editor';
                } else {
                    icon.className = 'codicon codicon-split-horizontal';
                    splitToggleBtn.title = 'Split Editor';
                }
            }
        }
    }

    setupEditorFocusTracking() {
        this.tabDragDropManager.setupEditorFocusTracking();
    }

    updateEditorFocusVisual() {
        this.tabDragDropManager.updateEditorFocusVisual();
    }

    showContextMenu(event, filePath, type) {
        // Delegate to ContextMenu instance with action callbacks
        const actions = {
            createFile: () => this.createFileInDirectory(filePath),
            createFolder: () => this.createFolderInDirectory(filePath),
            open: () => this.openFile(filePath),
            rename: () => this.renameItem(filePath, type),
            duplicate: () => this.duplicateItem(filePath, type),
            download: () => this.downloadItem(filePath),
            copyPath: () => this.copyToClipboard(filePath),
            copyRelativePath: () => this.copyToClipboard(`./${filePath}`),
            delete: () => this.deleteItem(filePath, type),
        };

        this.contextMenuInstance.show(event, filePath, type, actions);
    }

    showEmptySpaceContextMenu(event) {
        // Delegate to ContextMenu instance
        const actions = {
            createFile: () => {
                this.selectedDirectory = '';
                this.showCreateDialog('file');
            },
            createFolder: () => {
                this.selectedDirectory = '';
                this.showCreateDialog('folder');
            },
            refresh: () => this.loadFileExplorer(),
        };

        this.contextMenuInstance.showEmptySpaceMenu(event, actions);
    }

    async createFileInDirectory(dirPath) {
        this.selectedDirectory = dirPath;
        this.showCreateDialog('file');
    }

    async createFolderInDirectory(dirPath) {
        this.selectedDirectory = dirPath;
        this.showCreateDialog('folder');
    }

    async renameItem(filePath, type) {
        await this.fileOpsAdvanced.renameItem(filePath, type);
    }

    async duplicateItem(filePath, type) {
        await this.fileOpsAdvanced.duplicateItem(filePath, type);
    }

    async deleteItem(filePath, type) {
        // Check if multiple items are selected
        if (this.fileExplorerInstance.selectedItems.length > 1) {
            // Delete multiple items
            const itemNames = this.fileExplorerInstance.selectedItems
                .map((item) => item.path.split('/').pop())
                .join(', ');

            if (
                !confirm(
                    `Delete ${this.fileExplorerInstance.selectedItems.length} items (${itemNames})?`
                )
            ) {
                return;
            }

            // Save expanded folder states
            const expandedFolders = this.fileExplorerInstance.getExpandedFolders();

            for (const item of this.fileExplorerInstance.selectedItems) {
                await this.fileOpsAdvanced.deleteItem(item.path, item.type);
            }

            // Reload and restore
            await this.loadFileExplorer();
            setTimeout(() => {
                this.fileExplorerInstance.restoreExpandedFolders(expandedFolders);
            }, 100);
        } else {
            // Delete single item
            await this.fileOpsAdvanced.deleteItem(filePath, type);
        }
    }

    async moveItem(oldPath, newPath) {
        await this.fileOpsAdvanced.moveItem(oldPath, newPath);
    }

    async copyItem(sourcePath, targetPath, type) {
        await this.fileOpsAdvanced.copyItem(sourcePath, targetPath, type);
    }

    async fileExists(filePath) {
        return await this.fileOpsAdvanced.fileExists(filePath);
    }

    copyToClipboard(text) {
        navigator.clipboard
            .writeText(text)
            .then(() => {
                // Show brief success message
                const msg = document.createElement('div');
                msg.style.cssText = `
                position: fixed; top: 20px; right: 20px; background: #4CAF50;
                color: white; padding: 8px 16px; border-radius: 4px; z-index: 9999;
                font-size: 14px; pointer-events: none;
            `;
                msg.textContent = 'Path copied to clipboard';
                document.body.appendChild(msg);
                setTimeout(() => msg.remove(), 2000);
            })
            .catch(() => {
                alert('Failed to copy to clipboard');
            });
    }

    downloadItem(filePath) {
        // 다운로드 링크 생성
        const downloadUrl = `/api/download/${filePath}`;
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = ''; // 서버에서 파일명 결정
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // 성공 메시지 표시
        const msg = document.createElement('div');
        msg.style.cssText = `
            position: fixed; top: 20px; right: 20px; background: #4CAF50;
            color: white; padding: 8px 16px; border-radius: 4px; z-index: 9999;
            font-size: 14px; pointer-events: none;
        `;
        msg.textContent = 'Download started';
        document.body.appendChild(msg);
        setTimeout(() => msg.remove(), 2000);
    }

    toggleTheme() {
        this.themeManager.toggleTheme();
    }

    applyTheme(theme) {
        this.themeManager.applyTheme(theme);
    }

    collapseAllFolders() {
        this.workspaceManager.collapseAllFolders();
    }

    toggleHiddenFiles() {
        this.workspaceManager.toggleHiddenFiles();
    }

    initializeWorkspaceSection() {
        this.workspaceManager.initializeWorkspaceSection();
    }

    initializeApiPanel() {
        this.workspaceManager.initializeApiPanel();
    }
}

// Initialize the IDE when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new PythonIDE();
});
