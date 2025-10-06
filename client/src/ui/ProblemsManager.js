import * as monaco from 'monaco-editor';

/**
 * ProblemsManager - Manages the Problems panel (diagnostics viewer)
 * Shows type errors, syntax errors, and other diagnostics from LSP
 */
export class ProblemsManager {
    constructor(context) {
        this.context = context;
        this.problemsPanel = document.getElementById('problemsPanelContent');
        this.problemsCountBadge = document.getElementById('problemsCount');
        this.allDiagnostics = new Map(); // filepath -> diagnostics[]
        this.outputPanel = document.getElementById('outputPanel');
        this.isCollapsed = true; // Start collapsed

        this.initializeTabs();
        this.initializeToggle();
        this.initializeCollapsedState();
    }

    /**
     * Initialize collapsed state
     */
    initializeCollapsedState() {
        if (this.isCollapsed) {
            this.outputPanel.classList.add('collapsed');
        }
    }

    /**
     * Initialize panel toggle functionality (removed - only close button controls)
     */
    initializeToggle() {
        // No header click toggle - only close button works
    }

    /**
     * Collapse panel (called by close button)
     */
    collapsePanel() {
        this.isCollapsed = true;
        this.outputPanel.classList.add('collapsed');
        // Set minimum height
        this.outputPanel.style.flex = '0 0 30px';
    }

    /**
     * Expand panel
     */
    expandPanel() {
        this.isCollapsed = false;
        this.outputPanel.classList.remove('collapsed');
        // Restore default height
        this.outputPanel.style.flex = '0 0 200px';
    }

    /**
     * Show the panel (expand if collapsed)
     */
    showPanel() {
        if (this.isCollapsed) {
            this.expandPanel();
        }
    }

    /**
     * Switch to OUTPUT tab and show panel
     */
    showOutputTab() {
        // Store current flex before any changes
        const currentFlex = this.outputPanel.style.flex;

        // Expand panel if collapsed, otherwise keep current size
        if (this.isCollapsed) {
            this.expandPanel();
        }

        // Switch to OUTPUT tab
        const tabs = document.querySelectorAll('.output-panel-tab');
        const outputContent = document.getElementById('outputPanelContent');
        const problemsContent = document.getElementById('problemsPanelContent');

        tabs.forEach((tab) => {
            if (tab.dataset.tab === 'output') {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });

        outputContent.style.display = 'block';
        problemsContent.style.display = 'none';

        // Restore size if it was already expanded
        if (!this.isCollapsed && currentFlex && currentFlex !== '0 0 30px') {
            this.outputPanel.style.flex = currentFlex;
        }
    }

    /**
     * Initialize tab switching functionality
     */
    initializeTabs() {
        const tabs = document.querySelectorAll('.output-panel-tab');
        const outputContent = document.getElementById('outputPanelContent');
        const problemsContent = document.getElementById('problemsPanelContent');

        tabs.forEach((tab) => {
            tab.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent header click

                // Remove active class from all tabs
                tabs.forEach((t) => t.classList.remove('active'));

                // Add active class to clicked tab
                tab.classList.add('active');

                // Show corresponding panel
                const tabType = tab.dataset.tab;
                if (tabType === 'output') {
                    outputContent.style.display = 'block';
                    problemsContent.style.display = 'none';
                } else if (tabType === 'problems') {
                    outputContent.style.display = 'none';
                    problemsContent.style.display = 'block';
                }
            });
        });
    }

    /**
     * Update diagnostics for a file
     */
    updateDiagnostics(filepath, diagnostics) {
        if (diagnostics && diagnostics.length > 0) {
            this.allDiagnostics.set(filepath, diagnostics);
        } else {
            this.allDiagnostics.delete(filepath);
        }

        this.render();
    }

    /**
     * Render the problems panel
     */
    render() {
        // Calculate total problem count
        let totalProblems = 0;
        this.allDiagnostics.forEach((diags) => {
            totalProblems += diags.length;
        });

        // Update badge count
        this.problemsCountBadge.textContent = totalProblems;

        // Show/hide badge based on count
        if (totalProblems === 0) {
            this.problemsCountBadge.style.display = 'none';
        } else {
            this.problemsCountBadge.style.display = 'inline-block';
        }

        // Render problems list
        if (totalProblems === 0) {
            this.problemsPanel.innerHTML = '<div class="problems-empty">No problems detected</div>';
            return;
        }

        let html = '';
        this.allDiagnostics.forEach((diagnostics, filepath) => {
            diagnostics.forEach((diagnostic) => {
                const severityClass = this.getSeverityClass(diagnostic.severity);
                const severityIcon = this.getSeverityIcon(diagnostic.severity);
                const fileName = filepath.split('/').pop();

                html += `
                    <div class="problem-item" data-filepath="${filepath}" data-line="${diagnostic.startLineNumber}" data-column="${diagnostic.startColumn}">
                        <div class="problem-severity ${severityClass}">
                            <i class="codicon codicon-${severityIcon}"></i>
                        </div>
                        <div class="problem-details">
                            <div class="problem-message">${this.escapeHtml(diagnostic.message)}</div>
                            <div class="problem-location">
                                <span class="problem-file">${this.escapeHtml(fileName)}</span>
                                <span class="problem-position">[${diagnostic.startLineNumber}, ${diagnostic.startColumn}]</span>
                                <span class="problem-source">${diagnostic.source || 'pylsp'}</span>
                            </div>
                        </div>
                    </div>
                `;
            });
        });

        this.problemsPanel.innerHTML = html;

        // Add click handlers for navigation
        this.problemsPanel.querySelectorAll('.problem-item').forEach((item) => {
            item.addEventListener('click', () => {
                const filepath = item.dataset.filepath;
                const line = parseInt(item.dataset.line);
                const column = parseInt(item.dataset.column);
                this.navigateToProblem(filepath, line, column);
            });
        });
    }

    /**
     * Navigate to problem location in editor
     */
    navigateToProblem(filepath, line, column) {
        // Open file if not already open
        if (this.context.activeFile !== filepath) {
            this.context.openFile(filepath);
        }

        // Wait a bit for file to load, then navigate
        setTimeout(() => {
            const editor = this.context.editor;
            if (editor) {
                editor.setPosition({ lineNumber: line, column });
                editor.revealLineInCenter(line);
                editor.focus();
            }
        }, 100);
    }

    /**
     * Get severity class for styling
     */
    getSeverityClass(severity) {
        switch (severity) {
            case monaco.MarkerSeverity.Error:
                return 'error';
            case monaco.MarkerSeverity.Warning:
                return 'warning';
            case monaco.MarkerSeverity.Info:
                return 'info';
            case monaco.MarkerSeverity.Hint:
                return 'info';
            default:
                return 'error';
        }
    }

    /**
     * Get severity icon
     */
    getSeverityIcon(severity) {
        switch (severity) {
            case monaco.MarkerSeverity.Error:
                return 'error';
            case monaco.MarkerSeverity.Warning:
                return 'warning';
            case monaco.MarkerSeverity.Info:
                return 'info';
            case monaco.MarkerSeverity.Hint:
                return 'lightbulb';
            default:
                return 'error';
        }
    }

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Clear all problems
     */
    clear() {
        this.allDiagnostics.clear();
        this.render();
    }
}
