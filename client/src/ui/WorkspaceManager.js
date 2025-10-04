import * as monaco from 'monaco-editor';
import { ApiPanel } from '../../api-panel.js';

/**
 * WorkspaceManager - Manages workspace and panel initialization
 */
export class WorkspaceManager {
    constructor(context) {
        this.context = context;
    }

    initializeWorkspaceSection() {
        const workspaceHeader = document.getElementById('workspaceHeader');
        const workspaceToggle = document.getElementById('workspaceToggle');
        const workspaceContent = document.getElementById('workspaceContent');
        const workspaceTitle = document.getElementById('workspaceTitle');

        // Set workspace title to directory name only
        const title = this.context.workspaceFolder || 'workspace';
        workspaceTitle.textContent = title.toUpperCase();

        // Load saved state or default to expanded
        const isExpanded = localStorage.getItem('workspace-expanded') !== 'false';
        if (isExpanded) {
            workspaceToggle.classList.add('expanded');
            workspaceContent.classList.add('expanded');
        }

        // Toggle workspace section
        workspaceHeader.addEventListener('click', () => {
            const expanded = workspaceToggle.classList.toggle('expanded');
            workspaceContent.classList.toggle('expanded');
            localStorage.setItem('workspace-expanded', expanded);
        });

        // Initialize hidden files icon
        const toggleBtn = document.getElementById('toggleHiddenBtn');
        const icon = toggleBtn.querySelector('i');
        if (this.context.showHiddenFiles) {
            icon.className = 'codicon codicon-eye';
        } else {
            icon.className = 'codicon codicon-eye-closed';
        }
    }

    initializeApiPanel() {
        // Create API panel instance
        this.context.apiPanel = new ApiPanel();

        // Create and append panel to DOM
        const panel = this.context.apiPanel.createPanel();
        document.body.appendChild(panel);

        // Initialize with Monaco
        this.context.apiPanel.initialize(monaco);

        // Setup toggle button
        const apiToggleBtn = document.getElementById('apiToggleBtn');
        if (apiToggleBtn) {
            apiToggleBtn.addEventListener('click', () => {
                this.context.apiPanel.toggle();
                // Update button active state
                const isVisible = document.getElementById('apiPanel').classList.contains('show');
                apiToggleBtn.classList.toggle('active', isVisible);
            });
        }

        // Apply current theme
        this.context.apiPanel.updateTheme(this.context.currentTheme);
    }

    collapseAllFolders() {
        // Find all expanded folders in file explorer (not workspace header)
        const expandedFolders = document.querySelectorAll(
            '.file-explorer .folder-content.expanded'
        );
        const expandedToggles = document.querySelectorAll('.file-explorer .folder-toggle.expanded');

        // Collapse all folders (workspace header remains open)
        expandedFolders.forEach((folder) => {
            folder.classList.remove('expanded');
        });

        expandedToggles.forEach((toggle) => {
            toggle.classList.remove('expanded');
        });
    }

    toggleHiddenFiles() {
        this.context.showHiddenFiles = !this.context.showHiddenFiles;

        // Update FileExplorer instance's showHiddenFiles
        if (this.context.fileExplorerInstance) {
            this.context.fileExplorerInstance.showHiddenFiles = this.context.showHiddenFiles;
        }

        // Update icon
        const toggleBtn = document.getElementById('toggleHiddenBtn');
        const icon = toggleBtn.querySelector('i');
        if (this.context.showHiddenFiles) {
            icon.className = 'codicon codicon-eye';
        } else {
            icon.className = 'codicon codicon-eye-closed';
        }

        // Reload file explorer
        this.context.loadFileExplorer();
    }
}
