/**
 * CodeExecutor.js
 * Handles code execution and output display
 */

export class CodeExecutor {
    constructor(context = null) {
        this.context = context;
    }

    /**
     * Execute Python code
     * @param {string} activeFile - Currently active file path
     * @param {Map} openTabs - Map of open tabs
     * @param {HTMLElement} outputPanel - Output panel element
     * @param {HTMLElement} outputPanelContent - Output content element
     */
    async execute(activeFile, openTabs, outputPanel, outputPanelContent) {
        if (!activeFile || !activeFile.endsWith('.py')) {
            return;
        }

        const tabData = openTabs.get(activeFile);

        if (!tabData) {
            return;
        }

        const code = tabData.model.getValue();
        const filename = activeFile.split('/').pop();

        try {
            if (outputPanel && outputPanelContent) {
                outputPanel.style.display = 'block';
                outputPanelContent.className = 'output-panel-content';
                outputPanelContent.textContent = 'Executing...';
            }

            const url = this.context ? this.context.buildUrl('/api/execute') : '/api/execute';
            const headers = this.context
                ? this.context.getFetchHeaders()
                : { 'Content-Type': 'application/json' };

            const response = await fetch(url, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({ code, filename }),
            });

            const result = await response.json();

            if (outputPanelContent) {
                if (result.success) {
                    outputPanelContent.textContent =
                        result.output || 'Code executed successfully (no output)';
                } else {
                    outputPanelContent.className = 'output-panel-content error';
                    outputPanelContent.textContent = result.error || 'Execution failed';
                }
            }
        } catch (error) {
            if (outputPanelContent) {
                outputPanelContent.className = 'output-panel-content error';
                outputPanelContent.textContent = 'Failed to execute code: ' + error.message;
            }
        }
    }

    /**
     * Execute code for specific editor group (left or right)
     * Uses unified output panel for both editors
     * @param {string} editorGroup - 'left' or 'right'
     * @param {object} context - Context object with activeFile, openTabs, outputPanel, outputPanelContent
     */
    async executeForEditorGroup(editorGroup, context) {
        const {
            leftActiveFile,
            rightActiveFile,
            leftOpenTabs,
            rightOpenTabs,
            outputPanel,
            outputPanelContent,
        } = context;

        const activeFile = editorGroup === 'left' ? leftActiveFile : rightActiveFile;
        const openTabs = editorGroup === 'left' ? leftOpenTabs : rightOpenTabs;

        await this.execute(activeFile, openTabs, outputPanel, outputPanelContent);
    }
}
