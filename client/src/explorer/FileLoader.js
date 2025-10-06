import * as monaco from 'monaco-editor';
import { getLanguageFromFile } from '../utils/fileIcons.js';
import { getModelRefCounter } from '../utils/modelRefCounter.js';

/**
 * FileLoader - Handles file loading and opening operations
 */
export class FileLoader {
    constructor(context) {
        this.context = context;
        // Track model-level change listeners to prevent duplicates
        this.modelChangeListeners = new Map();
        // Track debounce timers for LSP notifications
        this.lspNotifyTimers = new Map();
        // Get model reference counter
        this.modelRefCounter = getModelRefCounter();
    }

    /**
     * Setup model-level change tracking
     * This ensures LSP is notified exactly once per change,
     * regardless of which editor(s) display the model
     */
    setupModelChangeTracking(model, filepath) {
        const uri = model.uri.toString();

        // Skip if already tracking this model
        if (this.modelChangeListeners.has(uri)) {
            return;
        }

        // Skip stdlib files - they are read-only
        if (uri.startsWith('stdlib://')) {
            return;
        }

        const listener = model.onDidChangeContent((event) => {
            // Update saved state in both tabs if open (immediate)
            if (this.context.openTabs.has(filepath)) {
                this.context.openTabs.get(filepath).saved = false;
            }
            if (this.context.rightOpenTabs && this.context.rightOpenTabs.has(filepath)) {
                this.context.rightOpenTabs.get(filepath).saved = false;
            }

            // Debounce LSP notifications to prevent duplicates from rapid events
            // Clear existing timer
            if (this.lspNotifyTimers.has(filepath)) {
                clearTimeout(this.lspNotifyTimers.get(filepath));
            }

            // Set new timer - only notify after 50ms of no changes
            const timer = setTimeout(() => {
                const content = model.getValue();
                this.context.notifyDocumentChanged(filepath, content);
                this.context.debouncedSyntaxCheck();
                this.lspNotifyTimers.delete(filepath);
            }, 50);

            this.lspNotifyTimers.set(filepath, timer);
        });

        // Store listener for cleanup
        this.modelChangeListeners.set(model.uri.toString(), listener);
    }

    /**
     * Cleanup model change listener and timer
     */
    cleanupModelListener(modelUri) {
        const listener = this.modelChangeListeners.get(modelUri);
        if (listener) {
            listener.dispose();
            this.modelChangeListeners.delete(modelUri);
        }

        // Clear any pending LSP notification timers
        // Extract filepath from URI for timer cleanup
        const filepath = modelUri.replace('file:///', '').replace('stdlib://', '');
        if (this.lspNotifyTimers.has(filepath)) {
            clearTimeout(this.lspNotifyTimers.get(filepath));
            this.lspNotifyTimers.delete(filepath);
        }
    }

    async openFile(filepath, targetEditor = 'left') {
        try {
            // Hide welcome page if showing
            if (this.context.editorInitializer) {
                this.context.editorInitializer.hideWelcomePage();
            }

            // Check if file is already open in either editor
            const existingInLeft = this.context.openTabs.has(filepath);
            const existingInRight =
                this.context.rightOpenTabs && this.context.rightOpenTabs.has(filepath);

            // If split view is active and target is right editor
            if (this.context.splitViewActive && targetEditor === 'right') {
                // If already open in right, just switch to it
                if (existingInRight) {
                    if (this.context.rightTabManager) {
                        this.context.rightTabManager.switchTab(filepath);
                        this.context.focusedEditor = 'right';
                        if (this.context.updateEditorFocusVisual) {
                            this.context.updateEditorFocusVisual();
                        }
                    }
                    return;
                }
                // If exists in left only, share the model to right
                if (existingInLeft) {
                    const tabData = this.context.openTabs.get(filepath);
                    this.context.rightOpenTabs.set(filepath, tabData);
                    this.context.rightTabManager.openTab(filepath, tabData.isStdlib);

                    // Update placeholder visibility
                    if (
                        this.context.splitViewManager &&
                        this.context.splitViewManager.updatePlaceholderVisibility
                    ) {
                        this.context.splitViewManager.updatePlaceholderVisibility();
                    }

                    this.context.focusedEditor = 'right';
                    if (this.context.updateEditorFocusVisual) {
                        this.context.updateEditorFocusVisual();
                    }
                    return;
                }
                await this.context.openFileInSplit(filepath);
                return;
            } else {
                // Opening in left editor (default for file explorer clicks)
                if (existingInLeft) {
                    this.context.tabManager.switchTab(filepath);
                    this.context.focusedEditor = 'left';
                    if (this.context.updateEditorFocusVisual) {
                        this.context.updateEditorFocusVisual();
                    }
                    return;
                }
                // If exists in right only, share the model to left
                if (existingInRight) {
                    const tabData = this.context.rightOpenTabs.get(filepath);
                    this.context.openTabs.set(filepath, tabData);
                    this.context.tabManager.openTab(filepath, tabData.isStdlib);

                    this.context.focusedEditor = 'left';
                    if (this.context.updateEditorFocusVisual) {
                        this.context.updateEditorFocusVisual();
                    }
                    return;
                }
            }

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

            // Check if a model with this URI already exists (might have been created by split view)
            const modelUri = isStdlib
                ? monaco.Uri.parse(`stdlib://${filepath}`)
                : monaco.Uri.file(filepath);
            let model = monaco.editor.getModel(modelUri);
            let modelInfo;

            if (!model) {
                // Create new model only if it doesn't exist
                model = monaco.editor.createModel(
                    data.content,
                    getLanguageFromFile(filepath),
                    modelUri
                );

                // Setup model-level change tracking for non-stdlib files
                if (!isStdlib) {
                    this.setupModelChangeTracking(model, filepath);
                }

                // Add to reference counter
                modelInfo = this.modelRefCounter.addReference(model, filepath);
            } else {
                // Model exists - increment reference count
                modelInfo = this.modelRefCounter.addReference(model, filepath);

                // If model already exists but change tracking not set up, set it up now
                if (!isStdlib && !this.modelChangeListeners.has(modelUri.toString())) {
                    this.setupModelChangeTracking(model, filepath);
                }
            }

            this.context.openTabs.set(filepath, {
                model,
                saved: true,
                isStdlib: isStdlib,
            });

            // Notify language server for all Python files (except stdlib - they are read-only)
            if (!isStdlib) {
                this.context.notifyDocumentOpened(filepath, data.content);
            }

            // Use TabManager to create and switch to tab
            this.context.tabManager.openTab(filepath, isStdlib);
        } catch (error) {
            console.error('Failed to open file:', error);
            // Show user-friendly error message
            alert(`Could not open file: ${filepath.split('/').pop()}\nError: ${error.message}`);
        }
    }
}
