/**
 * LSPValidator.js
 * Validates LSP requests before sending to prevent errors
 */

export class LSPValidator {
    /**
     * Validate position is within document bounds
     */
    static validatePosition(model, position) {
        if (!model) {
            console.warn('LSPValidator: model is null');
            return false;
        }

        if (!position || !position.lineNumber || !position.column) {
            console.warn('LSPValidator: invalid position', position);
            return false;
        }

        const lineCount = model.getLineCount();
        const lineContent = model.getLineContent(position.lineNumber);

        // Check line number is in range
        if (position.lineNumber < 1 || position.lineNumber > lineCount) {
            console.warn(`LSPValidator: line ${position.lineNumber} out of range (1-${lineCount})`);
            return false;
        }

        // Check column is in range
        const maxColumn = lineContent.length + 1;
        if (position.column < 1 || position.column > maxColumn) {
            console.warn(`LSPValidator: column ${position.column} out of range (1-${maxColumn})`);
            return false;
        }

        return true;
    }

    /**
     * Validate model has content
     */
    static validateModel(model) {
        if (!model) {
            console.warn('LSPValidator: model is null');
            return false;
        }

        const content = model.getValue();
        if (!content || content.trim().length === 0) {
            console.warn('LSPValidator: model has no content');
            return false;
        }

        return true;
    }

    /**
     * Validate file path
     */
    static validateFilePath(filePath) {
        if (!filePath || typeof filePath !== 'string') {
            // Silently return false - this is expected when no file is open
            return false;
        }

        if (!filePath.endsWith('.py') && !filePath.endsWith('.pyi')) {
            // Silently return false - this is expected for non-Python files
            return false;
        }

        return true;
    }

    /**
     * Validate LSP client is connected
     */
    static validateConnection(lspClient) {
        if (!lspClient) {
            console.warn('LSPValidator: LSP client is null');
            return false;
        }

        if (!lspClient.isConnected()) {
            console.warn('LSPValidator: LSP client not connected');
            return false;
        }

        return true;
    }

    /**
     * Comprehensive validation for LSP requests
     */
    static validateLSPRequest(model, position, filePath, lspClient) {
        return (
            this.validateModel(model) &&
            this.validatePosition(model, position) &&
            this.validateFilePath(filePath) &&
            this.validateConnection(lspClient)
        );
    }
}
