/**
 * LSPResponseHandlers - Handles LSP server responses
 */
export class LSPResponseHandlers {
    constructor(context) {
        this.context = context;
    }

    handleDefinitionResponse(response) {
        if (this.context.definitionResolve) {
            const resolve = this.context.definitionResolve;
            this.context.definitionResolve = null;

            if (response.result) {
                // Handle both array and single object results
                const locations = Array.isArray(response.result)
                    ? response.result
                    : [response.result];

                if (locations.length > 0) {
                    const location = locations[0];

                    // Validate location object
                    if (!location || typeof location !== 'object') {
                        resolve(null);
                        return;
                    }

                    if (location.uri && location.range) {
                        // Handle both workspace and stdlib file URIs
                        let filePath;
                        if (location.uri.startsWith('file:///app/workspace/')) {
                            // Workspace file - remove the workspace prefix and decode URI components
                            const encodedPath = location.uri.replace('file:///app/workspace/', '');
                            // Decode each path component to handle non-ASCII filenames (e.g., Korean)
                            filePath = encodedPath
                                .split('/')
                                .map((component) => decodeURIComponent(component))
                                .join('/');
                        } else if (location.uri.startsWith('file://')) {
                            // Other file (like stdlib) - remove file:// protocol
                            filePath = location.uri.replace('file://', '');
                        } else {
                            // Already a relative path
                            filePath = location.uri;
                        }

                        resolve({
                            filePath: filePath,
                            range: {
                                startLineNumber: location.range.start.line + 1,
                                startColumn: location.range.start.character + 1,
                                endLineNumber: location.range.end.line + 1,
                                endColumn: location.range.end.character + 1,
                            },
                        });
                        return;
                    }
                }
            }

            resolve(null);
        }
    }

    handleHoverResponse(response) {
        if (this.context.hoverResolve) {
            const resolve = this.context.hoverResolve;
            this.context.hoverResolve = null;

            if (response.result && response.result.contents) {
                let content = '';
                if (Array.isArray(response.result.contents)) {
                    content = response.result.contents
                        .map((c) => (typeof c === 'string' ? c : c.value))
                        .join('\n\n');
                } else if (typeof response.result.contents === 'string') {
                    content = response.result.contents;
                } else if (response.result.contents.value) {
                    content = response.result.contents.value;
                }

                resolve({
                    contents: [
                        {
                            value: content,
                        },
                    ],
                });
            } else {
                resolve(null);
            }
        }
    }
}
