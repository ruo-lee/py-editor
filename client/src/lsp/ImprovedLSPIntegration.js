/**
 * ImprovedLSPIntegration.js
 * Enhanced LSP integration with validation, error handling, and Find References
 */

import * as monaco from 'monaco-editor';
import { LSPValidator } from './LSPValidator.js';
import { LSPReferencesProvider } from './LSPReferencesProvider.js';
import { ReferencesPanel } from '../ui/ReferencesPanel.js';

export class ImprovedLSPIntegration {
    constructor(context) {
        this.context = context;
        this.referencesProvider = new LSPReferencesProvider(context);
        this.referencesPanel = new ReferencesPanel(context);

        // Expose to context for access from other modules
        this.context.referencesPanel = this.referencesPanel;
        this.context.referencesProvider = this.referencesProvider;
    }

    /**
     * Setup improved LSP integration
     */
    setup() {
        this.setupKeyboardShortcuts();
        this.wrapLSPMethods();
    }

    /**
     * Setup keyboard shortcuts for LSP features
     */
    setupKeyboardShortcuts() {
        // Shift+F12 for Find References
        this.context.editor.addCommand(monaco.KeyMod.Shift | monaco.KeyCode.F12, async () => {
            const model = this.context.editor.getModel();
            const position = this.context.editor.getPosition();

            if (model && position) {
                await this.referencesProvider.showReferences(model, position, 'left');
            }
        });

        // F12 for Go to Definition (already handled by Monaco, but we can enhance it)
        this.context.editor.addCommand(monaco.KeyCode.F12, async () => {
            const model = this.context.editor.getModel();
            const position = this.context.editor.getPosition();

            if (model && position) {
                await this.enhancedGoToDefinition(model, position, 'left');
            }
        });

        // Right editor shortcuts if split view is active
        if (this.context.rightEditor) {
            this.setupRightEditorShortcuts();
        }
    }

    /**
     * Setup shortcuts for right editor
     */
    setupRightEditorShortcuts() {
        if (!this.context.rightEditor) return;

        this.context.rightEditor.addCommand(monaco.KeyMod.Shift | monaco.KeyCode.F12, async () => {
            const model = this.context.rightEditor.getModel();
            const position = this.context.rightEditor.getPosition();

            if (model && position) {
                await this.referencesProvider.showReferences(model, position, 'right');
            }
        });

        this.context.rightEditor.addCommand(monaco.KeyCode.F12, async () => {
            const model = this.context.rightEditor.getModel();
            const position = this.context.rightEditor.getPosition();

            if (model && position) {
                await this.enhancedGoToDefinition(model, position, 'right');
            }
        });
    }

    /**
     * Enhanced Go to Definition with validation
     */
    async enhancedGoToDefinition(model, position, editorSide = 'left') {
        const activeFile =
            editorSide === 'right' ? this.context.rightActiveFile : this.context.activeFile;

        // Validate request
        if (
            !LSPValidator.validateLSPRequest(
                model,
                position,
                activeFile,
                this.context.lspClientInstance
            )
        ) {
            console.warn('LSP request validation failed');
            return;
        }

        // Use existing LSP manager method but with better error handling
        try {
            await this.context.lspProviderManager.handleCtrlClick(model, position, editorSide);
        } catch (error) {
            console.error('Go to definition failed:', error);
            // Silent fallback - don't show error to user
        }
    }

    /**
     * Wrap existing LSP methods with validation
     */
    wrapLSPMethods() {
        // Wrap getDefinition
        const originalGetDefinition = this.context.lspManager.getDefinition.bind(
            this.context.lspManager
        );
        this.context.lspManager.getDefinition = async (model, position, editorSide) => {
            const activeFile =
                editorSide === 'right' ? this.context.rightActiveFile : this.context.activeFile;

            if (
                !LSPValidator.validateLSPRequest(
                    model,
                    position,
                    activeFile,
                    this.context.lspClientInstance
                )
            ) {
                return null;
            }

            try {
                return await originalGetDefinition(model, position, editorSide);
            } catch (error) {
                console.warn('LSP getDefinition error:', error.message);
                return null;
            }
        };

        // Wrap getHover
        const originalGetHover = this.context.lspManager.getHover.bind(this.context.lspManager);
        this.context.lspManager.getHover = async (model, position) => {
            const activeFile = this.context.activeFile;

            if (
                !LSPValidator.validateLSPRequest(
                    model,
                    position,
                    activeFile,
                    this.context.lspClientInstance
                )
            ) {
                return null;
            }

            try {
                return await originalGetHover(model, position);
            } catch (error) {
                console.warn('LSP getHover error:', error.message);
                return null;
            }
        };

        // Wrap getCompletionItems
        const originalGetCompletion = this.context.lspManager.getCompletionItems.bind(
            this.context.lspManager
        );
        this.context.lspManager.getCompletionItems = async (model, position) => {
            const _activeFile = this.context.activeFile;

            // For completion, be less strict - just validate model and position
            if (
                !LSPValidator.validateModel(model) ||
                !LSPValidator.validatePosition(model, position)
            ) {
                return this.context.getBasicCompletions();
            }

            try {
                return await originalGetCompletion(model, position);
            } catch (error) {
                console.warn('LSP completion error:', error.message);
                return this.context.getBasicCompletions();
            }
        };
    }

    /**
     * Refresh keyboard shortcuts (call when split view is created)
     */
    refreshShortcuts() {
        if (this.context.splitViewActive && this.context.rightEditor) {
            this.setupRightEditorShortcuts();
        }
    }
}
