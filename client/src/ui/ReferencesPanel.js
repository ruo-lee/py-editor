/**
 * ReferencesPanel.js
 * VSCode-style references panel for showing find references results
 */

export class ReferencesPanel {
    constructor(context) {
        this.context = context;
        this.leftPanel = null;
        this.rightPanel = null;
        this.currentReferences = [];
        this.currentEditorSide = 'left'; // Track which editor triggered the panel
    }

    /**
     * Show references panel with results
     */
    show(references, symbol, editorSide = 'left') {
        if (!references || references.length === 0) {
            return;
        }

        this.currentEditorSide = editorSide;

        // Create panel if doesn't exist
        const panel = this.getOrCreatePanel(editorSide);

        this.currentReferences = references;
        this.renderReferences(symbol, editorSide);
        panel.style.display = 'flex';
    }

    /**
     * Get or create panel for specific editor side
     */
    getOrCreatePanel(editorSide) {
        if (editorSide === 'right') {
            if (!this.rightPanel) {
                this.rightPanel = this.createPanel('right');
            }
            return this.rightPanel;
        } else {
            if (!this.leftPanel) {
                this.leftPanel = this.createPanel('left');
            }
            return this.leftPanel;
        }
    }

    /**
     * Create the references panel DOM
     */
    createPanel(editorSide) {
        const panel = document.createElement('div');
        panel.id = editorSide === 'right' ? 'referencesPanel2' : 'referencesPanel';
        panel.className = 'references-panel';
        panel.innerHTML = `
            <div class="references-header">
                <span class="references-title">References</span>
                <button class="references-close" title="Close">×</button>
            </div>
            <div class="references-content"></div>
        `;

        // Add to appropriate editor container
        let editorContainer;
        if (editorSide === 'right') {
            editorContainer = document.querySelector('#editor2')?.parentElement;
        } else {
            editorContainer = document.querySelector('#editor')?.parentElement;
        }

        if (editorContainer) {
            editorContainer.appendChild(panel);
        }

        // Close button
        const closeBtn = panel.querySelector('.references-close');
        closeBtn.addEventListener('click', () => this.hide(editorSide));

        // Make resizable
        this.makeResizable(panel);

        return panel;
    }

    /**
     * Render references list
     */
    renderReferences(symbol, editorSide = 'left') {
        const panel = this.getOrCreatePanel(editorSide);
        const content = panel.querySelector('.references-content');
        const title = panel.querySelector('.references-title');

        // Group references by file
        const groupedRefs = this.groupByFile(this.currentReferences);

        title.textContent = `${this.currentReferences.length} reference${this.currentReferences.length !== 1 ? 's' : ''} to '${symbol}'`;

        let html = '<div class="references-list">';

        for (const [filePath, refs] of Object.entries(groupedRefs)) {
            const fileName = filePath.split('/').pop();
            const fileDir = filePath.substring(0, filePath.lastIndexOf('/'));

            html += `
                <div class="reference-file">
                    <div class="reference-file-header">
                        <span class="reference-file-name">${fileName}</span>
                        <span class="reference-file-path">${fileDir}</span>
                        <span class="reference-count">${refs.length}</span>
                    </div>
            `;

            refs.forEach((ref, _idx) => {
                html += `
                    <div class="reference-item" data-file="${filePath}" data-line="${ref.range.start.line}" data-col="${ref.range.start.character}">
                        <span class="reference-line-num">${ref.range.start.line + 1}</span>
                        <span class="reference-line-preview">${ref.preview || ''}</span>
                    </div>
                `;
            });

            html += '</div>';
        }

        html += '</div>';
        content.innerHTML = html;

        // Add click handlers
        content.querySelectorAll('.reference-item').forEach((item) => {
            item.addEventListener('click', () => {
                const filePath = item.dataset.file;
                const line = parseInt(item.dataset.line);
                const col = parseInt(item.dataset.col);
                this.navigateToReference(filePath, line, col);
            });
        });
    }

    /**
     * Group references by file
     */
    groupByFile(references) {
        const grouped = {};

        references.forEach((ref) => {
            let filePath = ref.uri;

            // Normalize file path
            if (filePath.startsWith('file:///app/workspace/')) {
                // Remove file:///app/workspace/ prefix and decode URI components
                const encodedPath = filePath.replace('file:///app/workspace/', '');
                // Decode each path component to handle non-ASCII filenames (e.g., Korean)
                filePath = encodedPath
                    .split('/')
                    .map((component) => decodeURIComponent(component))
                    .join('/');
            } else if (filePath.startsWith('file://')) {
                filePath = filePath.replace('file://', '');
            }

            if (!grouped[filePath]) {
                grouped[filePath] = [];
            }

            grouped[filePath].push(ref);
        });

        return grouped;
    }

    /**
     * Navigate to a specific reference
     */
    async navigateToReference(filePath, line, character) {
        try {
            // Determine which editor to use
            const editorSide = this.currentEditorSide;
            const openTabs =
                editorSide === 'right' ? this.context.rightOpenTabs : this.context.openTabs;
            const editor = editorSide === 'right' ? this.context.rightEditor : this.context.editor;

            // Open file if not already open
            const fileWasOpen = openTabs.has(filePath);

            if (!fileWasOpen) {
                await this.context.fileLoader.openFile(filePath, editorSide);
            }

            // Always switch to the tab to ensure proper UI selection
            // This is critical for updating tab highlighting
            const tabManager =
                editorSide === 'right' ? this.context.rightTabManager : this.context.tabManager;
            if (tabManager) {
                tabManager.switchTab(filePath);
            }

            // Use requestAnimationFrame to ensure DOM updates complete before navigation
            // This is more reliable than setTimeout for UI synchronization
            await new Promise((resolve) => {
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        setTimeout(resolve, fileWasOpen ? 50 : 100);
                    });
                });
            });

            // Navigate to position
            const position = {
                lineNumber: line + 1, // LSP uses 0-based, Monaco uses 1-based
                column: character + 1,
            };

            editor.setPosition(position);
            editor.revealPositionInCenter(position);
            editor.focus();

            // Highlight the reference briefly
            this.highlightRange(line, character, editorSide);
        } catch (error) {
            console.error('Failed to navigate to reference:', error);
        }
    }

    /**
     * Highlight a range briefly
     */
    highlightRange(line, character, editorSide = 'left') {
        const editor = editorSide === 'right' ? this.context.rightEditor : this.context.editor;

        const decorations = editor.deltaDecorations(
            [],
            [
                {
                    range: {
                        startLineNumber: line + 1,
                        startColumn: character + 1,
                        endLineNumber: line + 1,
                        endColumn: character + 20, // Approximate word length
                    },
                    options: {
                        className: 'reference-highlight',
                        isWholeLine: false,
                    },
                },
            ]
        );

        // Remove highlight after 2 seconds
        setTimeout(() => {
            editor.deltaDecorations(decorations, []);
        }, 2000);
    }

    /**
     * Make panel resizable
     */
    makeResizable(panel) {
        const header = panel.querySelector('.references-header');
        let isDragging = false;
        let startY = 0;
        let startHeight = 0;

        header.style.cursor = 'ns-resize';

        header.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('references-close')) return;
            isDragging = true;
            startY = e.clientY;
            startHeight = panel.offsetHeight;
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;

            const deltaY = startY - e.clientY;
            const newHeight = Math.max(100, Math.min(600, startHeight + deltaY));
            panel.style.height = `${newHeight}px`;
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
        });
    }

    /**
     * Hide the references panel
     */
    hide(editorSide = 'left') {
        const panel = editorSide === 'right' ? this.rightPanel : this.leftPanel;
        if (panel) {
            panel.style.display = 'none';
        }
    }

    /**
     * Toggle panel visibility
     */
    toggle(editorSide = 'left') {
        const panel = editorSide === 'right' ? this.rightPanel : this.leftPanel;
        if (panel && panel.style.display === 'flex') {
            this.hide(editorSide);
        } else if (this.currentReferences.length > 0) {
            this.show(this.currentReferences, '', editorSide);
        }
    }
}
