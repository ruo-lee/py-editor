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
            find: {
                addExtraSpaceOnTop: false,
                autoFindInSelection: 'never',
                seedSearchStringFromSelection: 'always',
            },
        });

        // Setup right editor event listeners
        this.setupRightEditorListeners();

        // Fix Find widget for right editor
        this.setupRightFindWidgetFix();

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

        // Initialize FormatManager for right editor
        if (this.context.formatManager && this.context.formatManager.initializeRightEditor) {
            this.context.formatManager.initializeRightEditor();
        }

        // Update button icon
        this.context.updateSplitButtonIcon();
    }

    /**
     * Setup right editor event listeners
     */
    setupRightEditorListeners() {
        // NOTE: Content change tracking is now handled at MODEL level (in FileLoader)
        // to prevent duplicate notifications when the same model is used in split editors.
        // Saved state updates are also handled at model level.

        // No editor-level listeners needed here anymore

        // Handle Ctrl+Click for go-to-definition manually
        this.context.rightEditor.onMouseDown(async (e) => {
            // Ignore if clicking on Monaco widgets (Find, Replace, etc.)
            if (this.isMonacoWidgetTarget(e.event.target)) {
                return;
            }

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

    isMonacoWidgetTarget(target) {
        // Check if the clicked target is part of a Monaco widget
        if (!target) return false;

        let element = target;
        while (element && element !== document.body) {
            const classList = element.classList;
            if (
                classList &&
                (classList.contains('find-widget') ||
                    classList.contains('editor-widget') ||
                    classList.contains('monaco-inputbox') ||
                    classList.contains('monaco-findInput') ||
                    classList.contains('button') ||
                    classList.contains('monaco-action-bar'))
            ) {
                return true;
            }
            element = element.parentElement;
        }
        return false;
    }

    setupRightFindWidgetFix() {
        // Use MutationObserver to detect Find widget visibility for right editor
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                const target = mutation.target;

                // Detect when Find widget becomes visible
                if (target.classList && target.classList.contains('find-widget')) {
                    const isVisible = target.classList.contains('visible');

                    if (isVisible) {
                        // Force release Ctrl key state when Find opens
                        this.context.ctrlPressed = false;
                        this.context.updateCursorStyle();
                        this.context.clearLinkDecorations('right');

                        // Prevent editor from stealing focus
                        setTimeout(() => {
                            const findInput = target.querySelector('.input, textarea');
                            if (findInput) {
                                findInput.focus();
                            }
                        }, 50);
                    }

                    // Remove aria-hidden to prevent accessibility issues
                    if (target.getAttribute('aria-hidden') === 'true') {
                        target.removeAttribute('aria-hidden');
                    }
                }
            });
        });

        // Observe the right editor container for Find widget
        const rightEditorContainer = document.getElementById('editor2');
        if (rightEditorContainer) {
            observer.observe(rightEditorContainer.parentElement, {
                attributes: true,
                attributeFilter: ['class', 'aria-hidden'],
                subtree: true,
            });
        }

        // Also listen for Ctrl+F keydown to immediately release Ctrl state
        this.context.rightEditor.onKeyDown((e) => {
            // Detect Ctrl+F or Cmd+F
            const isFind = (this.context.isMac ? e.metaKey : e.ctrlKey) && e.code === 'KeyF';
            if (isFind) {
                // Immediately release Ctrl state
                setTimeout(() => {
                    this.context.ctrlPressed = false;
                    this.context.updateCursorStyle();
                    this.context.clearLinkDecorations('right');
                }, 10);
            }
        });
    }

    /**
     * Close split view
     */
    closeSplitView(mergeTabsToLeft = true) {
        if (!this.context.splitViewActive) return;

        // No need to cleanup sync listeners - models are shared, no sync needed

        // Clear right editor model first to prevent disposed model access
        if (this.context.rightEditor) {
            this.context.rightEditor.setModel(null);
        }

        // Merge right tabs to left by default
        if (mergeTabsToLeft && this.context.rightOpenTabs.size > 0) {
            const rightFiles = Array.from(this.context.rightOpenTabs.entries());

            rightFiles.forEach(([filepath, rightTabData]) => {
                if (!this.context.openTabs.has(filepath)) {
                    // File only exists in right - move to left with undo/redo history intact
                    this.context.openTabs.set(filepath, {
                        ...rightTabData,
                        model: rightTabData.model, // Keep the same model with its history
                    });

                    // Open tab in left editor
                    this.context.tabManager.openTab(filepath, rightTabData.isStdlib);
                } else {
                    // File exists in both
                    const leftTabData = this.context.openTabs.get(filepath);
                    const sharedModel = leftTabData.model === rightTabData.model;

                    if (sharedModel) {
                        // Same model instance - already in sync, nothing to do
                        // Don't dispose - left is still using it
                    } else {
                        // Different model instances (shouldn't happen with new design, but handle it)
                        // Sync content from right to left
                        if (leftTabData && leftTabData.model && rightTabData.model) {
                            const rightContent = rightTabData.model.getValue();
                            if (leftTabData.model.getValue() !== rightContent) {
                                leftTabData.model.setValue(rightContent);
                            }
                        }
                        // Dispose the right model to avoid memory leak
                        if (rightTabData.model) {
                            // Cleanup model listener before disposing
                            if (this.context.fileLoader) {
                                this.context.fileLoader.cleanupModelListener(
                                    rightTabData.model.uri.toString()
                                );
                            }
                            rightTabData.model.dispose();
                        }
                    }
                }
            });

            // Switch to the last active file from right if no left file was active
            if (!this.context.activeFile && this.context.rightActiveFile) {
                const lastRightFile = this.context.rightActiveFile;
                if (this.context.openTabs.has(lastRightFile)) {
                    this.context.tabManager.switchTab(lastRightFile);
                }
            }
        } else {
            // Not merging - check if models are shared before disposing
            this.context.rightOpenTabs.forEach((rightTabData, filepath) => {
                const leftTabData = this.context.openTabs.get(filepath);
                const sharedModel = leftTabData && leftTabData.model === rightTabData.model;

                // Only dispose if not shared with left editor
                if (!sharedModel && rightTabData.model) {
                    // Cleanup model listener before disposing
                    if (this.context.fileLoader) {
                        this.context.fileLoader.cleanupModelListener(
                            rightTabData.model.uri.toString()
                        );
                    }
                    rightTabData.model.dispose();
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
            leftGroup.style.width = ''; // Reset width to default
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

        // Check if file is already open in left editor
        if (this.context.openTabs.has(filepath)) {
            const leftTabData = this.context.openTabs.get(filepath);

            // Share the same model between left and right editors
            // This eliminates the need for sync and preserves undo/redo history
            const sharedModel = leftTabData.model;
            const isStdlib = leftTabData.isStdlib;

            // Store in right tabs with SHARED model
            this.context.rightOpenTabs.set(filepath, {
                model: sharedModel,
                saved: leftTabData.saved,
                isStdlib: isStdlib,
            });

            if (this.context.rightTabManager) {
                this.context.rightTabManager.openTab(filepath, isStdlib);

                // Set the SHARED model on the right editor
                if (this.context.rightEditor && sharedModel) {
                    this.context.rightEditor.setModel(sharedModel);
                }
            }

            // No need for model sync when sharing the same model
            // Both editors automatically stay in sync

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

                // Setup model-level change tracking for non-stdlib files
                if (!isStdlib && this.context.fileLoader) {
                    this.context.fileLoader.setupModelChangeTracking(model, filepath);
                }
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

            // No model sync needed - file only exists in right editor

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
