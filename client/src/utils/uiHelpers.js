/**
 * uiHelpers.js
 * UI utility functions for the editor
 */

/**
 * Close all input dialogs
 */
export function closeAllDialogs() {
    const dialogs = document.querySelectorAll('.input-dialog');
    dialogs.forEach((dialog) => dialog.remove());
}

/**
 * Update file path display bar
 * @param {HTMLElement} filePathBar - File path bar element
 * @param {string} filepath - File path to display
 * @param {boolean} isStdlib - Whether file is from standard library
 */
export function updateFilePathDisplay(filePathBar, filepath, isStdlib = false) {
    if (!filePathBar) return;

    if (filepath) {
        // Format the file path for display
        let displayPath = filepath;
        if (isStdlib) {
            displayPath = `Python Standard Library: ${filepath}`;
            filePathBar.className = 'file-path-bar stdlib';
        } else {
            displayPath = `Workspace: ${filepath}`;
            filePathBar.className = 'file-path-bar';
        }
        filePathBar.textContent = displayPath;
        filePathBar.title = filepath; // Show full path on hover
    } else {
        filePathBar.textContent = '';
        filePathBar.className = 'file-path-bar';
    }
}

/**
 * Update active file highlight in file explorer
 * @param {string} activeFilePath - Currently active file path (left editor)
 * @param {string} rightActiveFilePath - Currently active file path in right editor (optional)
 * @param {string} focusedEditor - Which editor has focus ('left' or 'right')
 */
export function updateActiveFileHighlight(
    activeFilePath,
    rightActiveFilePath = null,
    focusedEditor = 'left'
) {
    // Clear all active highlights
    document.querySelectorAll('.file-item.active').forEach((el) => {
        el.classList.remove('active');
    });

    // Only highlight the file in the FOCUSED editor
    const fileToHighlight = focusedEditor === 'right' ? rightActiveFilePath : activeFilePath;

    if (fileToHighlight) {
        // Expand all parent directories to reveal the file
        expandParentDirectories(fileToHighlight);

        const activeElement = document.querySelector(
            `[data-path="${fileToHighlight}"][data-type="file"]`
        );
        if (activeElement) {
            activeElement.classList.add('active');
            // Scroll the file into view smoothly
            activeElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }
}

/**
 * Expand all parent directories of a file path
 * @param {string} filepath - Full file path
 */
function expandParentDirectories(filepath) {
    if (!filepath) return;

    // Split path into parts and build all parent directory paths
    const parts = filepath.split('/');
    const parentPaths = [];

    // Build cumulative paths for each parent directory
    for (let i = 1; i < parts.length; i++) {
        const parentPath = parts.slice(0, i).join('/');
        if (parentPath) {
            parentPaths.push(parentPath);
        }
    }

    // Expand each parent directory from root to leaf
    parentPaths.forEach((parentPath) => {
        const dirElement = document.querySelector(
            `[data-path="${parentPath}"][data-type="directory"]`
        );
        if (dirElement) {
            const toggle = dirElement.querySelector('.folder-toggle');
            const content = dirElement.nextElementSibling;

            // Only expand if not already expanded
            if (toggle && content && !content.classList.contains('expanded')) {
                toggle.click();
            }
        }
    });
}

/**
 * Initialize sidebar resize functionality
 * @param {string} sidebarId - ID of sidebar element
 * @param {string} resizerId - ID of resizer element
 */
export function initializeSidebarResize(sidebarId = 'sidebar', resizerId = 'sidebarResizer') {
    const sidebar = document.getElementById(sidebarId);
    const resizer = document.getElementById(resizerId);

    if (!sidebar || !resizer) {
        console.warn('Sidebar or resizer element not found');
        return;
    }

    let isResizing = false;

    resizer.addEventListener('mousedown', (e) => {
        isResizing = true;
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;

        const newWidth = e.clientX;
        if (newWidth > 150 && newWidth < 600) {
            // Min 150px, max 600px
            sidebar.style.width = newWidth + 'px';
        }
    });

    document.addEventListener('mouseup', () => {
        isResizing = false;
    });
}

/**
 * Clear link decorations in Monaco editor
 * @param {monaco.editor.IStandaloneCodeEditor} editor - Monaco editor instance
 * @param {Array} currentDecorations - Current decoration IDs
 * @returns {Array} Empty decoration array
 */
export function clearEditorLinkDecorations(editor, currentDecorations = []) {
    if (editor) {
        editor.deltaDecorations(currentDecorations, []);
    }
    return [];
}

/**
 * Update cursor style based on Ctrl key state
 * @param {monaco.editor.IStandaloneCodeEditor} editor - Monaco editor instance
 * @param {boolean} ctrlPressed - Whether Ctrl key is pressed
 */
export function updateEditorCursorStyle(editor, ctrlPressed) {
    if (!editor) return;

    const editorDom = editor.getDomNode();
    if (!editorDom) return;

    if (ctrlPressed) {
        editorDom.style.cursor = 'pointer';
    } else {
        editorDom.style.cursor = 'text';
    }
}
