/**
 * ResizeManager - Manages resizable UI elements
 * Handles split view divider and output panel resizing
 */
export class ResizeManager {
    constructor() {
        // No context needed for resize handlers
    }

    /**
     * Setup split view resize handler
     */
    setupSplitResize(divider, leftGroup, rightGroup) {
        let isDragging = false;

        const onMouseMove = (e) => {
            if (!isDragging) return;

            const editorArea = document.getElementById('editorArea');
            const containerRect = editorArea.getBoundingClientRect();
            const mouseX = e.clientX - containerRect.left;
            const totalWidth = containerRect.width;

            // Calculate percentage based on mouse position
            let leftPercent = (mouseX / totalWidth) * 100;

            // Enforce minimum widths (200px minimum for each side)
            const minWidthPercent = (200 / totalWidth) * 100;
            if (leftPercent < minWidthPercent) leftPercent = minWidthPercent;
            if (leftPercent > 100 - minWidthPercent) leftPercent = 100 - minWidthPercent;

            const rightPercent = 100 - leftPercent;

            leftGroup.style.flex = `0 0 ${leftPercent}%`;
            rightGroup.style.flex = `0 0 ${rightPercent}%`;

            e.preventDefault();
        };

        const onMouseUp = () => {
            isDragging = false;
            document.body.style.cursor = '';
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        const onMouseDown = (e) => {
            isDragging = true;
            document.body.style.cursor = 'col-resize';
            e.preventDefault();

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        };

        divider.addEventListener('mousedown', onMouseDown);
    }

    /**
     * Setup output panel resize handler
     */
    setupOutputPanelResize(resizer, outputPanel) {
        let isDragging = false;
        let startY = 0;
        let startHeight = 0;

        const onMouseMove = (e) => {
            if (!isDragging) return;

            const deltaY = startY - e.clientY;
            const newHeight = startHeight + deltaY;

            // Get workspace height for proper max calculation
            const workspace = outputPanel.parentElement;
            const workspaceHeight = workspace ? workspace.offsetHeight : window.innerHeight;

            // Enforce minimum and maximum heights
            const minHeight = 30; // Can collapse to header only
            const maxHeight = workspaceHeight * 0.8; // 80% of workspace

            const clampedHeight = Math.max(minHeight, Math.min(newHeight, maxHeight));

            // Update flex immediately (no transition delay)
            outputPanel.style.flex = `0 0 ${clampedHeight}px`;

            // Update collapsed state based on height
            if (clampedHeight <= 35) {
                // Small threshold for collapse
                outputPanel.classList.add('collapsed');
                outputPanel.style.flex = '0 0 30px';
            } else {
                outputPanel.classList.remove('collapsed');
            }

            e.preventDefault();
        };

        const onMouseUp = () => {
            isDragging = false;
            document.body.style.cursor = '';
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        const onMouseDown = (e) => {
            isDragging = true;
            startY = e.clientY;
            startHeight = outputPanel.offsetHeight;
            document.body.style.cursor = 'ns-resize';
            e.preventDefault();

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        };

        resizer.addEventListener('mousedown', onMouseDown);
    }
}
