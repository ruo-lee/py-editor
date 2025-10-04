import * as monaco from 'monaco-editor';

/**
 * ModelSyncManager - Manages model synchronization between split editors
 * Handles keeping left and right editor models in sync when editing same file
 */
export class ModelSyncManager {
    constructor(context) {
        this.context = context;
        this.modelChangeListeners = new Map();
        this.syncInProgress = false;
    }

    /**
     * Setup model synchronization for a file open in both editors
     */
    setupModelSync(filepath) {
        // Check if same file is open in both editors
        const leftTab = this.context.openTabs.get(filepath);
        const rightTab = this.context.rightOpenTabs.get(filepath);

        if (!leftTab || !rightTab || !this.context.splitViewActive) {
            return;
        }

        // Cleanup existing listeners for this file
        this.cleanupSyncListener(filepath);

        const leftModel = leftTab.model;
        const rightModel = rightTab.model;

        // Create listener for left editor changes
        const leftListener = leftModel.onDidChangeContent((e) => {
            if (this.syncInProgress) return;

            this.syncInProgress = true;

            // Apply changes to right model
            e.changes.forEach((change) => {
                const range = new monaco.Range(
                    change.range.startLineNumber,
                    change.range.startColumn,
                    change.range.endLineNumber,
                    change.range.endColumn
                );
                rightModel.pushEditOperations(
                    [],
                    [
                        {
                            range: range,
                            text: change.text,
                        },
                    ],
                    () => null
                );
            });

            this.syncInProgress = false;
        });

        // Create listener for right editor changes
        const rightListener = rightModel.onDidChangeContent((e) => {
            if (this.syncInProgress) return;

            this.syncInProgress = true;

            // Apply changes to left model
            e.changes.forEach((change) => {
                const range = new monaco.Range(
                    change.range.startLineNumber,
                    change.range.startColumn,
                    change.range.endLineNumber,
                    change.range.endColumn
                );
                leftModel.pushEditOperations(
                    [],
                    [
                        {
                            range: range,
                            text: change.text,
                        },
                    ],
                    () => null
                );
            });

            this.syncInProgress = false;
        });

        // Store listeners for cleanup
        this.modelChangeListeners.set(filepath, {
            leftListener,
            rightListener,
        });
    }

    /**
     * Clean up sync listeners for a specific file
     */
    cleanupSyncListener(filepath) {
        const listeners = this.modelChangeListeners.get(filepath);
        if (listeners) {
            listeners.leftListener.dispose();
            listeners.rightListener.dispose();
            this.modelChangeListeners.delete(filepath);
        }
    }

    /**
     * Clean up all sync listeners
     */
    cleanupAllSyncListeners() {
        this.modelChangeListeners.forEach((listeners) => {
            listeners.leftListener.dispose();
            listeners.rightListener.dispose();
        });
        this.modelChangeListeners.clear();
    }
}
