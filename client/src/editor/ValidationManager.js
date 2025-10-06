import * as monaco from 'monaco-editor';

/**
 * ValidationManager - Manages syntax validation and checking
 */
export class ValidationManager {
    constructor(context) {
        this.context = context;
    }

    setupBasicValidation() {
        // NOTE: Content change tracking is now handled at MODEL level (in FileLoader)
        // to prevent duplicate notifications when the same model is used in split editors.
        // Saved state updates are also handled at model level.
        // No editor-level listeners needed here anymore
        // Note: Document formatting is now handled by LSPProviderManager
        // which registers a provider that uses the Black formatter via LSP
    }
}
