/**
 * LSPReferencesProvider.js
 * Provides Find References functionality with UI integration
 */

import { LSPValidator } from './LSPValidator.js';

export class LSPReferencesProvider {
    constructor(context) {
        this.context = context;
    }

    /**
     * Find all references to symbol at position
     */
    async findReferences(model, position, editorSide = 'left') {
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
            return null;
        }

        const content = model.getValue();

        try {
            // Get word at position for display
            const word = model.getWordAtPosition(position);
            const symbol = word ? word.word : 'symbol';

            // Request references from LSP (exclude declaration to show only usages)
            let references = await this.context.lspClientInstance.getReferences(
                activeFile,
                content,
                position,
                false // exclude declaration - show only actual usages
            );

            if (!references || references.length === 0) {
                // Fallback: Search for symbol usage across workspace files
                const fallbackRefs = await this.findReferencesWithFallback(symbol, activeFile);

                if (!fallbackRefs || fallbackRefs.length === 0) {
                    return null;
                }

                references = fallbackRefs;
            }

            // Filter references to only include current workspace
            const filteredRefs = this.filterCurrentWorkspaceReferences(references);

            if (filteredRefs.length === 0) {
                return null;
            }

            // Enrich references with preview text
            const enrichedRefs = await this.enrichReferences(filteredRefs);

            return {
                symbol,
                references: enrichedRefs,
            };
        } catch (error) {
            console.error('Failed to find references:', error);
            return null;
        }
    }

    /**
     * Filter references to only include current workspace
     * Removes references from other workspace folders that can't be accessed
     */
    filterCurrentWorkspaceReferences(references) {
        const workspaceFolder = this.context.workspaceFolder;

        if (!workspaceFolder) {
            return references;
        }

        const filtered = references.filter((ref) => {
            let uri = ref.uri;

            // Check if reference is from current workspace
            if (uri.startsWith('file:///app/workspace/')) {
                const pathAfterWorkspace = uri.replace('file:///app/workspace/', '');

                // Reference is in current workspace if:
                // 1. It starts with current workspace folder name
                // 2. It's a stdlib file (starts with /usr/)
                const isCurrentWorkspace = pathAfterWorkspace.startsWith(workspaceFolder + '/');
                const isStdlib = pathAfterWorkspace.startsWith('/usr/');

                return isCurrentWorkspace || isStdlib;
            }

            // For other URI formats, include them (likely already normalized)
            return true;
        });

        return filtered;
    }

    /**
     * Enrich references with preview text from source
     */
    async enrichReferences(references) {
        const enriched = [];

        for (const ref of references) {
            try {
                // Normalize file path
                let filePath = ref.uri;

                // Handle file:// URIs
                if (filePath.startsWith('file:///app/workspace/')) {
                    // Remove file:///app/workspace/ prefix
                    filePath = filePath.replace('file:///app/workspace/', '');

                    // Remove workspace folder prefix if present
                    // e.g., "a5555/sandboxes/file.py" -> "sandboxes/file.py"
                    const workspaceFolder = this.context.workspaceFolder;
                    if (workspaceFolder && filePath.startsWith(workspaceFolder + '/')) {
                        filePath = filePath.substring(workspaceFolder.length + 1);
                    }
                } else if (filePath.startsWith('file://')) {
                    filePath = filePath.replace('file://', '');
                }

                // Get preview text
                const preview = await this.getLinePreview(filePath, ref.range.start.line);

                enriched.push({
                    ...ref,
                    uri: filePath,
                    preview,
                });
            } catch (error) {
                console.warn(`Failed to enrich reference ${ref.uri}:`, error);
                // If we can't get preview, still include the reference with normalized path
                let filePath = ref.uri;
                if (filePath.startsWith('file:///app/workspace/')) {
                    filePath = filePath.replace('file:///app/workspace/', '');
                    const workspaceFolder = this.context.workspaceFolder;
                    if (workspaceFolder && filePath.startsWith(workspaceFolder + '/')) {
                        filePath = filePath.substring(workspaceFolder.length + 1);
                    }
                } else if (filePath.startsWith('file://')) {
                    filePath = filePath.replace('file://', '');
                }

                enriched.push({
                    ...ref,
                    uri: filePath,
                });
            }
        }

        return enriched;
    }

    /**
     * Get preview text for a specific line in a file
     */
    async getLinePreview(filePath, lineNumber) {
        try {
            // Check if file is already open in left or right editor
            let openTab = this.context.openTabs.get(filePath);
            if (!openTab && this.context.rightOpenTabs) {
                openTab = this.context.rightOpenTabs.get(filePath);
            }

            if (openTab && openTab.model) {
                const lineContent = openTab.model.getLineContent(lineNumber + 1);
                return lineContent.trim();
            }

            // For unopened files, fetch the file content to get the preview
            const workspaceFolder = this.context.workspaceFolder;
            const url = `/api/files/${filePath}${workspaceFolder ? `?folder=${workspaceFolder}` : ''}`;
            const fullUrl = this.context.buildUrl(url);

            const response = await fetch(fullUrl, {
                headers: this.context.getFetchHeaders(),
            });

            if (!response.ok) {
                // File not found or error - use placeholder
                // eslint-disable-next-line no-console
                console.warn(`[Preview] Failed to fetch ${filePath}: ${response.status}`);
                return `Line ${lineNumber + 1}`;
            }

            const data = await response.json();
            const content = data.content || '';
            const lines = content.split('\n');

            // lineNumber is 0-based, so use it directly as array index
            if (lineNumber >= 0 && lineNumber < lines.length) {
                const preview = lines[lineNumber].trim();
                // Return the preview if it has content, otherwise use placeholder
                return preview || `Line ${lineNumber + 1}`;
            }
            return `Line ${lineNumber + 1}`;
        } catch (error) {
            // Network error or other issue - use placeholder
            // eslint-disable-next-line no-console
            console.error(`[Preview] Error fetching ${filePath}:`, error);
            return `Line ${lineNumber + 1}`;
        }
    }

    /**
     * Fallback search for references by scanning open files
     */
    async findReferencesWithFallback(symbol, currentFile) {
        const references = [];

        // Search through all open tabs in both editors
        const filesToSearch = new Set([
            ...Array.from(this.context.openTabs.keys()),
            ...Array.from(this.context.rightOpenTabs?.keys() || []),
        ]);

        for (const filepath of filesToSearch) {
            // Skip current file (definition)
            if (filepath === currentFile) {
                continue;
            }

            const tabData =
                this.context.openTabs.get(filepath) || this.context.rightOpenTabs?.get(filepath);
            if (!tabData || !tabData.model) {
                continue;
            }

            const model = tabData.model;
            const lineCount = model.getLineCount();

            // Search for symbol in each line
            for (let lineNum = 1; lineNum <= lineCount; lineNum++) {
                const lineContent = model.getLineContent(lineNum);
                const regex = new RegExp(`\\b${symbol}\\b`, 'g');
                let match;

                while ((match = regex.exec(lineContent)) !== null) {
                    references.push({
                        uri: filepath,
                        range: {
                            start: {
                                line: lineNum - 1, // 0-based
                                character: match.index,
                            },
                            end: {
                                line: lineNum - 1,
                                character: match.index + symbol.length,
                            },
                        },
                        preview: lineContent.trim(),
                    });
                }
            }
        }

        return references.length > 0 ? references : null;
    }

    /**
     * Show references in UI panel
     */
    async showReferences(model, position, editorSide = 'left') {
        const result = await this.findReferences(model, position, editorSide);

        if (!result) {
            return;
        }

        // Show in references panel
        if (this.context.referencesPanel) {
            this.context.referencesPanel.show(result.references, result.symbol, editorSide);
        }
    }
}
