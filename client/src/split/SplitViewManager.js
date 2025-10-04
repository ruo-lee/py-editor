/**
 * SplitViewManager.js
 * Manages split view functionality for the editor
 */

import * as monaco from 'monaco-editor';
import { getLanguageFromFile } from '../utils/fileIcons.js';
import { UnifiedTabManager } from '../tabs/UnifiedTabManager.js';

export class SplitViewManager {
    constructor(context) {
        this.context = context;
    }

    /**
     * Toggle split view on/off
     */
    toggleSplit() {
        if (this.context.splitViewActive) {
            this.closeSplitView();
        } else {
            this.createSplitView();
        }
    }

    /**
     * Create split view
     */
    createSplitView() {
        const editorArea = document.getElementById('editorArea');
        if (!editorArea) {
            console.error('editorArea element not found');
            return;
        }
        this.context.splitViewActive = true;

        // Create right editor group
        const rightEditorGroup = document.createElement('div');
        rightEditorGroup.id = 'rightEditorGroup';
        rightEditorGroup.className = 'editor-group';
        rightEditorGroup.innerHTML = `
            <div class="tab-bar" id="tabBar2">
                <div class="tab-bar-tabs"></div>
                <div class="tab-bar-actions">
                    <button class="execute-btn" id="executeButton2" title="Run Code (Ctrl+R)" style="display: none;">
                        <i class="codicon codicon-play"></i>
                    </button>
                    <button class="split-toggle-btn" id="splitToggleBtn2" title="Close Split Editor" style="display: none;">
                        <i class="codicon codicon-screen-normal"></i>
                    </button>
                </div>
            </div>
            <div class="file-path-bar" id="filePathBar2"></div>
            <div class="editor-container">
                <div class="editor-placeholder" id="editor2Placeholder">
                    <i class="codicon codicon-files"></i>
                    <p>파일을 선택하거나 탭을 드래그하여 여기에 열기</p>
                </div>
                <div id="editor2" style="display: none;"></div>
            </div>
        `;

        // Create divider
        const divider = document.createElement('div');
        divider.id = 'splitDivider';
        divider.className = 'split-divider';

        // Rename left editor group
        const leftEditorGroup = document.querySelector('.editor-group');
        if (leftEditorGroup) {
            leftEditorGroup.id = 'leftEditorGroup';
            leftEditorGroup.classList.add('focused'); // Set left as initially focused
        }

        // Add split elements
        editorArea.appendChild(divider);
        editorArea.appendChild(rightEditorGroup);
        editorArea.classList.add('split-view');

        // Set initial widths (50% each)
        leftEditorGroup.style.width = '50%';
        rightEditorGroup.style.width = '50%';

        // Set initial focus
        this.context.focusedEditor = 'left';

        // Create right editor
        this.context.rightEditor = monaco.editor.create(document.getElementById('editor2'), {
            value: '',
            language: 'python',
            theme: this.context.currentTheme,
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
            bracketPairColorization: { enabled: true },
            guides: { indentation: true },
            gotoLocation: { multiple: 'goto' },
        });

        // Setup right editor event listeners
        this.setupRightEditorListeners();

        // Setup split resize
        this.context.setupSplitResize(divider, leftEditorGroup, rightEditorGroup);

        // Setup right execute button
        const executeButton2 = document.getElementById('executeButton2');
        if (executeButton2) {
            executeButton2.addEventListener('click', () => {
                this.context.executeCode('right');
            });
        }

        // Setup right split toggle button
        const splitToggleBtn2 = document.getElementById('splitToggleBtn2');
        if (splitToggleBtn2) {
            splitToggleBtn2.addEventListener('click', () => {
                this.closeSplitView();
            });
        }

        // Setup tab bar drop zones
        this.context.setupTabBarDropZones();

        // Setup editor focus tracking
        this.context.setupEditorFocusTracking();

        // Initialize UnifiedTabManager for right editor
        this.context.rightTabManager = new UnifiedTabManager(this.context, 'right');

        // Initialize button visibility for right editor
        setTimeout(() => {
            if (this.context.rightTabManager.updateActionButtonsVisibility) {
                this.context.rightTabManager.updateActionButtonsVisibility();
            }
        }, 0);

        // Refresh LSP keyboard shortcuts for right editor
        if (this.context.improvedLSP) {
            this.context.improvedLSP.refreshShortcuts();
        }

        // Update button icon
        this.context.updateSplitButtonIcon();
    }

    /**
     * Setup right editor event listeners
     */
    setupRightEditorListeners() {
        // Setup content change tracking for right editor (prevent stdlib didChange errors)
        this.context.rightEditor.onDidChangeModelContent((_event) => {
            const model = this.context.rightEditor.getModel();
            if (!model) return;

            const uri = model.uri.toString();

            // Skip stdlib files - they use stdlib:// URI scheme
            if (uri.startsWith('stdlib://')) {
                return;
            }

            let filePath = uri
                .replace('file://', '')
                .replace('inmemory://', '')
                .replace('_split', '');

            if (!filePath && this.context.rightActiveFile) {
                filePath = this.context.rightActiveFile;
            }

            if (filePath) {
                this.context.saveFile(filePath);
                const content = model.getValue();
                this.context.notifyDocumentChanged(filePath, content);
                this.context.debouncedSyntaxCheck();
            }
        });

        // Handle Ctrl+Click for go-to-definition manually
        this.context.rightEditor.onMouseDown(async (e) => {
            const isModifierPressed = this.context.isMac ? e.event.metaKey : e.event.ctrlKey;

            if (isModifierPressed && e.target.position) {
                e.event.preventDefault();
                e.event.stopPropagation();

                // Get definition at cursor position
                const model = this.context.rightEditor.getModel();
                const position = e.target.position;

                if (model && position) {
                    await this.context.lspProviderManager.handleCtrlClick(model, position, 'right');
                }
            }
        });

        // Ctrl+hover link styling
        this.context.rightEditor.onMouseMove((e) => {
            this.context.handleMouseMove(e, 'right');
        });

        // Clear link decorations when mouse leaves
        this.context.rightEditor.onMouseLeave(() => {
            this.context.clearLinkDecorations('right');
        });

        // Keyboard events
        this.context.rightEditor.onKeyDown((e) => {
            // Check if Ctrl (or Cmd on Mac) key is pressed
            if (this.context.isMac && (e.code === 'MetaLeft' || e.code === 'MetaRight')) {
                this.context.ctrlPressed = true;
                this.context.updateCursorStyle();
            } else if (
                !this.context.isMac &&
                (e.code === 'ControlLeft' || e.code === 'ControlRight')
            ) {
                this.context.ctrlPressed = true;
                this.context.updateCursorStyle();
            }
        });

        this.context.rightEditor.onKeyUp((e) => {
            // Check if Ctrl (or Cmd on Mac) key is released
            if (this.context.isMac && (e.code === 'MetaLeft' || e.code === 'MetaRight')) {
                this.context.ctrlPressed = false;
                this.context.updateCursorStyle();
                this.context.clearLinkDecorations('right');
            } else if (
                !this.context.isMac &&
                (e.code === 'ControlLeft' || e.code === 'ControlRight')
            ) {
                this.context.ctrlPressed = false;
                this.context.updateCursorStyle();
                this.context.clearLinkDecorations('right');
            }
        });
    }

    /**
     * Close split view
     */
    closeSplitView(mergeTabsToLeft = true) {
        if (!this.context.splitViewActive) return;

        // Merge right tabs to left by default
        if (mergeTabsToLeft && this.context.rightOpenTabs.size > 0) {
            this.context.rightOpenTabs.forEach((tabData, filepath) => {
                if (!this.context.openTabs.has(filepath)) {
                    this.context.openTabs.set(filepath, tabData);
                    this.context.tabManager.openTab(filepath, tabData.isStdlib);
                }
            });
        }

        // Dispose right editor
        if (this.context.rightEditor) {
            this.context.rightEditor.dispose();
            this.context.rightEditor = null;
        }

        // Remove split elements
        const rightGroup = document.getElementById('rightEditorGroup');
        const divider = document.getElementById('splitDivider');
        if (rightGroup) rightGroup.remove();
        if (divider) divider.remove();

        // Reset left editor group and restore focus
        const leftGroup = document.getElementById('leftEditorGroup');
        if (leftGroup) {
            leftGroup.id = '';
            leftGroup.classList.add('focused'); // Restore focus when closing split
        }

        // Remove split view class
        const editorArea = document.getElementById('editorArea');
        if (editorArea) {
            editorArea.classList.remove('split-view');
        }

        // Clear right tabs
        this.context.rightOpenTabs.clear();
        this.context.rightActiveFile = null;
        this.context.rightTabManager = null; // Clear right tab manager

        // Update state
        this.context.splitViewActive = false;
        this.context.focusedEditor = 'left';

        // Update button icon
        this.context.updateSplitButtonIcon();
    }

    /**
     * Show/hide placeholder based on whether files are open
     */
    updatePlaceholderVisibility() {
        const placeholder = document.getElementById('editor2Placeholder');
        const editor2 = document.getElementById('editor2');

        if (!placeholder || !editor2) {
            return;
        }

        const hasOpenFiles = this.context.rightOpenTabs && this.context.rightOpenTabs.size > 0;

        if (hasOpenFiles) {
            placeholder.style.display = 'none';
            editor2.style.display = 'block';
        } else {
            placeholder.style.display = 'flex';
            editor2.style.display = 'none';
        }
    }

    /**
     * Open file in split view
     */
    async openFileInSplit(filepath) {
        if (this.context.rightOpenTabs.has(filepath)) {
            if (this.context.rightTabManager) {
                this.context.rightTabManager.switchTab(filepath);
            }
            this.updatePlaceholderVisibility();
            return;
        }

        // Check if file is already open in left editor - if so, share the model
        if (this.context.openTabs.has(filepath)) {
            const tabData = this.context.openTabs.get(filepath);
            this.context.rightOpenTabs.set(filepath, tabData); // Share the same model

            if (this.context.rightTabManager) {
                this.context.rightTabManager.openTab(filepath, tabData.isStdlib);

                // Explicitly set the model on the right editor
                if (this.context.rightEditor && tabData.model) {
                    this.context.rightEditor.setModel(tabData.model);
                }
            }

            // Update placeholder visibility
            this.updatePlaceholderVisibility();
            return;
        }

        try {
            let response, data;

            // Check if this is a Python standard library file
            if (filepath.startsWith('/usr/local/lib/python3.11/')) {
                // Extract the relative path from the stdlib base path
                const stdlibPath = filepath.replace('/usr/local/lib/python3.11/', '');
                response = await fetch(this.context.buildUrl(`/api/stdlib/${stdlibPath}`), {
                    headers: this.context.getFetchHeaders(),
                });

                if (!response.ok) {
                    throw new Error(`Failed to load stdlib file: ${filepath}`);
                }

                data = await response.json();
            } else {
                // Regular workspace file
                response = await fetch(this.context.buildUrl(`/api/files/${filepath}`), {
                    headers: this.context.getFetchHeaders(),
                });

                if (!response.ok) {
                    throw new Error(`Failed to load file: ${filepath}`);
                }

                data = await response.json();
            }

            // Check if this is a stdlib file
            const isStdlib = this.context.isStdlibFile(filepath);

            // Check if a model with this URI already exists
            const modelUri = isStdlib
                ? monaco.Uri.parse(`stdlib://${filepath}`)
                : monaco.Uri.file(filepath);
            let model = monaco.editor.getModel(modelUri);

            if (!model) {
                // Create new model only if it doesn't exist
                model = monaco.editor.createModel(
                    data.content,
                    getLanguageFromFile(filepath),
                    modelUri
                );
            }

            this.context.rightOpenTabs.set(filepath, {
                model,
                saved: true,
                isStdlib: isStdlib,
            });

            // Notify LSP (except stdlib - they are read-only)
            if (filepath.endsWith('.py') && !isStdlib) {
                this.context.notifyDocumentOpened(filepath, data.content);
            }

            // Create and switch to tab using UnifiedTabManager
            if (this.context.rightTabManager) {
                this.context.rightTabManager.openTab(filepath, isStdlib);
            }

            // Setup model sync
            this.context.setupModelSync(filepath);

            // Update placeholder visibility
            this.updatePlaceholderVisibility();
        } catch (error) {
            console.error('Failed to open file in split:', error);
            alert(`Could not open file: ${filepath.split('/').pop()}\nError: ${error.message}`);
            // Reset Ctrl state on error
            this.context.ctrlPressed = false;
            this.context.updateCursorStyle();
            this.context.clearLinkDecorations('right');
        }
    }
}
