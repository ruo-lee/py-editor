// 드래그 앤 드롭 유틸리티 함수

/**
 * 드래그 가능한 요소에 이벤트 리스너 추가
 */
export function makeDraggable(element, data) {
    element.draggable = true;

    element.addEventListener('dragstart', (e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('application/json', JSON.stringify(data));
        element.classList.add('dragging');
    });

    element.addEventListener('dragend', (_e) => {
        element.classList.remove('dragging');
    });
}

/**
 * 드롭 영역에 이벤트 리스너 추가
 */
export function makeDroppable(element, onDrop) {
    element.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        element.classList.add('drag-over');
    });

    element.addEventListener('dragleave', (_e) => {
        element.classList.remove('drag-over');
    });

    element.addEventListener('drop', (e) => {
        e.preventDefault();
        element.classList.remove('drag-over');

        // 내부 파일 이동
        const jsonData = e.dataTransfer.getData('application/json');
        if (jsonData) {
            const data = JSON.parse(jsonData);
            onDrop(data, 'move');
            return;
        }

        // 외부 파일 업로드
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            onDrop(files, 'upload');
        }
    });
}

/**
 * 파일 경로 정규화
 */
export function normalizePath(path) {
    return path.replace(/\/+/g, '/').replace(/\/$/, '');
}

/**
 * 파일/폴더 이름 추출
 */
export function getFileName(path) {
    return path.split('/').pop();
}

/**
 * 부모 경로 추출
 */
export function getParentPath(path) {
    const parts = path.split('/').filter((p) => p);
    parts.pop();
    return '/' + parts.join('/');
}
