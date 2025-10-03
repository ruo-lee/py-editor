# Phase 4: 파일 탐색기 분리 완료

## 개요

Phase 4에서는 main.js의 파일 탐색기 관련 코드를 독립적인 클래스들로 분리했습니다.

## 생성된 클래스

### 1. FileExplorer ([client/src/explorer/FileExplorer.js](../client/src/explorer/FileExplorer.js))

**책임:** 파일 트리 렌더링, 폴더 확장/축소, 파일 선택, 드래그앤드롭

**주요 기능:**

- `render(files, container, level)`: 파일 트리 렌더링
- `renderDirectory(element, item, container, level)`: 디렉토리 아이템 렌더링
- `renderFile(element, item, container)`: 파일 아이템 렌더링
- `clearSelection()`: 모든 선택 해제
- `getSelectedDirectory()`: 선택된 디렉토리 경로 반환
- `getSelectedItem()`: 선택된 아이템 반환
- `toggleHiddenFiles()`: 숨김 파일 표시 토글
- `expandFolder(path)`: 특정 폴더 확장
- `collapseFolder(path)`: 특정 폴더 축소
- `clear()`: 파일 탐색기 전체 초기화

**콜백:**

- `onFileClick(filePath)`: 파일 클릭 시 호출
- `onFolderClick(folderPath)`: 폴더 클릭 시 호출
- `onContextMenu(event, filePath, type)`: 우클릭 메뉴 시 호출
- `onFileMove(draggedItem, targetDirectory)`: 파일/폴더 이동 시 호출
- `onExternalFileDrop(items, targetDirectory, type)`: 외부 파일 드롭 시 호출

**사용 예시:**

```javascript
import { FileExplorer } from './src/explorer/FileExplorer.js';

const fileExplorer = new FileExplorer(
    document.getElementById('fileExplorer'),
    {
        showHiddenFiles: false,
        getFileIcon: (fileName) => {
            // Custom icon logic
            return '📄';
        },
        onFileClick: (filePath) => {
            console.log('File clicked:', filePath);
        },
        onFolderClick: (folderPath) => {
            console.log('Folder clicked:', folderPath);
        },
        onContextMenu: (event, filePath, type) => {
            console.log('Context menu:', filePath, type);
        },
        onFileMove: (draggedItem, targetDirectory) => {
            console.log('File moved:', draggedItem, 'to', targetDirectory);
        },
        onExternalFileDrop: (items, targetDirectory, type) => {
            console.log('External files dropped:', items, targetDirectory);
        }
    }
);

// 파일 트리 렌더링
const files = [
    { name: 'src', type: 'directory', path: 'src', children: [...] },
    { name: 'main.py', type: 'file', path: 'main.py' }
];
fileExplorer.render(files);

// 특정 폴더 확장
fileExplorer.expandFolder('src');

// 숨김 파일 토글
fileExplorer.toggleHiddenFiles();
```

---

### 2. ContextMenu ([client/src/explorer/ContextMenu.js](../client/src/explorer/ContextMenu.js))

**책임:** 우클릭 컨텍스트 메뉴 생성 및 관리

**주요 기능:**

- `show(event, filePath, type, actions)`: 파일/디렉토리 컨텍스트 메뉴 표시
- `showEmptySpaceMenu(event, actions)`: 빈 공간 컨텍스트 메뉴 표시
- `renderMenuItems(menu, menuItems)`: 메뉴 아이템 렌더링
- `close()`: 컨텍스트 메뉴 닫기
- `isOpen()`: 메뉴 열림 여부 확인

**actions 객체 구조:**

```javascript
{
    open: () => {},          // 파일 열기
    createFile: () => {},    // 새 파일 생성
    createFolder: () => {},  // 새 폴더 생성
    rename: () => {},        // 이름 변경
    duplicate: () => {},     // 복제
    download: () => {},      // 다운로드
    copyPath: () => {},      // 경로 복사
    copyRelativePath: () => {}, // 상대 경로 복사
    delete: () => {},        // 삭제
    refresh: () => {}        // 새로고침 (빈 공간 메뉴)
}
```

**사용 예시:**

```javascript
import { ContextMenu } from './src/explorer/ContextMenu.js';

const contextMenu = new ContextMenu();

// 파일 우클릭 메뉴
fileExplorer.onContextMenu = (event, filePath, type) => {
    contextMenu.show(event, filePath, type, {
        open: () => openFile(filePath),
        createFile: () => createFile(filePath),
        createFolder: () => createFolder(filePath),
        rename: () => renameItem(filePath, type),
        duplicate: () => duplicateItem(filePath, type),
        download: () => downloadItem(filePath),
        copyPath: () => copyToClipboard(filePath),
        copyRelativePath: () => copyToClipboard(`./${filePath}`),
        delete: () => deleteItem(filePath, type),
    });
};

// 빈 공간 우클릭 메뉴
explorerContainer.addEventListener('contextmenu', (e) => {
    if (e.target === explorerContainer) {
        e.preventDefault();
        contextMenu.showEmptySpaceMenu(e, {
            createFile: () => createFile(''),
            createFolder: () => createFolder(''),
            refresh: () => loadFileExplorer(),
        });
    }
});

// 메뉴 닫기
contextMenu.close();
```

---

### 3. FileOperations ([client/src/explorer/FileOperations.js](../client/src/explorer/FileOperations.js))

**책임:** 파일/디렉토리 CRUD 작업 API 호출 관리

**주요 기능:**

- `loadFileExplorer()`: 파일 탐색기 구조 로드
- `createFile(fileName, directory)`: 파일 생성
- `createDirectory(folderName, directory)`: 디렉토리 생성
- `readFile(filePath)`: 파일 내용 읽기
- `saveFile(filePath, content)`: 파일 저장
- `deleteItem(path, type)`: 파일/디렉토리 삭제
- `renameItem(oldPath, newName)`: 이름 변경
- `duplicateItem(sourcePath, type)`: 복제
- `moveItem(sourcePath, targetDirectory)`: 이동
- `downloadItem(path)`: 다운로드
- `uploadFiles(files, targetDirectory)`: 파일 업로드
- `uploadDirectory(items, targetDirectory)`: 디렉토리 업로드
- `copyToClipboard(text)`: 클립보드 복사

**사용 예시:**

```javascript
import { FileOperations } from './src/explorer/FileOperations.js';

const fileOps = new FileOperations(''); // API base URL

// 파일 탐색기 로드
const files = await fileOps.loadFileExplorer();
fileExplorer.render(files);

// 파일 생성
await fileOps.createFile('new_file.py', 'src');

// 디렉토리 생성
await fileOps.createDirectory('new_folder', 'src');

// 파일 읽기
const content = await fileOps.readFile('main.py');

// 파일 저장
await fileOps.saveFile('main.py', 'print("Hello")');

// 파일 삭제
await fileOps.deleteItem('old_file.py', 'file');

// 디렉토리 삭제
await fileOps.deleteItem('old_folder', 'directory');

// 이름 변경
await fileOps.renameItem('old_name.py', 'new_name.py');

// 복제
await fileOps.duplicateItem('file.py', 'file');

// 이동
await fileOps.moveItem('file.py', 'target_folder');

// 다운로드
await fileOps.downloadItem('file.py');

// 파일 업로드
const files = document.getElementById('fileInput').files;
await fileOps.uploadFiles(files, 'uploads');

// 클립보드 복사
await fileOps.copyToClipboard('path/to/file.py');
```

---

## main.js 통합 방법

### 1. Import 추가

```javascript
// client/main.js
import { FileExplorer } from './src/explorer/FileExplorer.js';
import { ContextMenu } from './src/explorer/ContextMenu.js';
import { FileOperations } from './src/explorer/FileOperations.js';
```

### 2. Constructor 수정

```javascript
class PythonIDE {
    constructor() {
        // 기존 파일 탐색기 관련 속성 제거
        // this.fileExplorer = document.getElementById('fileExplorer');
        // this.selectedDirectory = '';
        // this.selectedItem = null;
        // this.showHiddenFiles = false;

        // 새로운 매니저로 교체
        this.fileOps = new FileOperations('');
        this.contextMenu = new ContextMenu();
        this.fileExplorer = new FileExplorer(document.getElementById('fileExplorer'), {
            showHiddenFiles: false,
            getFileIcon: this.getFileIcon.bind(this),
            onFileClick: (filePath) => this.openFile(filePath),
            onFolderClick: (folderPath) => {
                this.fileExplorer.setSelectedDirectory(folderPath);
            },
            onContextMenu: (event, filePath, type) => {
                this.showContextMenu(event, filePath, type);
            },
            onFileMove: async (draggedItem, targetDirectory) => {
                await this.handleFileMove(draggedItem, targetDirectory);
            },
            onExternalFileDrop: async (items, targetDirectory, type) => {
                await this.handleExternalFileDrop(items, targetDirectory, type);
            },
        });

        // 초기화
        this.loadFileExplorer();
    }

    async loadFileExplorer() {
        try {
            const files = await this.fileOps.loadFileExplorer();
            this.fileExplorer.render(files);
        } catch (error) {
            console.error('Failed to load file explorer:', error);
        }
    }

    showContextMenu(event, filePath, type) {
        this.contextMenu.show(event, filePath, type, {
            open: () => this.openFile(filePath),
            createFile: () => this.createFileInDirectory(filePath),
            createFolder: () => this.createFolderInDirectory(filePath),
            rename: () => this.renameItem(filePath, type),
            duplicate: () => this.duplicateItem(filePath, type),
            download: () => this.fileOps.downloadItem(filePath),
            copyPath: () => this.fileOps.copyToClipboard(filePath),
            copyRelativePath: () => this.fileOps.copyToClipboard(`./${filePath}`),
            delete: () => this.deleteItem(filePath, type),
        });
    }

    async handleFileMove(draggedItem, targetDirectory) {
        try {
            await this.fileOps.moveItem(draggedItem.path, targetDirectory);
            await this.loadFileExplorer();
        } catch (error) {
            console.error('Failed to move file:', error);
        }
    }

    async handleExternalFileDrop(items, targetDirectory, type) {
        try {
            if (type === 'items') {
                await this.fileOps.uploadDirectory(items, targetDirectory);
            } else {
                await this.fileOps.uploadFiles(items, targetDirectory);
            }
            await this.loadFileExplorer();
        } catch (error) {
            console.error('Failed to upload files:', error);
        }
    }
}
```

### 3. 메소드 간소화

**파일 탐색기 렌더링:**

```javascript
// 기존
renderFileExplorer(files, container = this.fileExplorer, level = 0) {
    // ... 200줄 이상의 코드
}

// 새로운 방식
async loadFileExplorer() {
    const files = await this.fileOps.loadFileExplorer();
    this.fileExplorer.render(files);
}
```

**파일 생성:**

```javascript
// 기존
async createFile(fileName) {
    const response = await fetch('/api/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath, content: '' })
    });
    // ... error handling
}

// 새로운 방식
async createFile(fileName) {
    const directory = this.fileExplorer.getSelectedDirectory();
    await this.fileOps.createFile(fileName, directory);
    await this.loadFileExplorer();
}
```

**컨텍스트 메뉴:**

```javascript
// 기존
showContextMenu(event, filePath, type) {
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    // ... 70줄의 DOM 조작 코드
}

// 새로운 방식
showContextMenu(event, filePath, type) {
    this.contextMenu.show(event, filePath, type, {
        // actions 객체만 전달
    });
}
```

---

## 예상 효과

### 코드 감소

- main.js: 약 600줄 감소 예상
- 파일 탐색기 관련 로직 완전 분리

### 파일 구조

```
client/src/explorer/
├── FileExplorer.js (380줄)
├── ContextMenu.js (160줄)
└── FileOperations.js (330줄)
```

### 장점

1. **단일 책임 원칙**: 각 클래스가 명확한 책임
    - FileExplorer: UI 렌더링 및 상호작용
    - ContextMenu: 메뉴 관리
    - FileOperations: API 통신

2. **테스트 가능성**: 독립적인 단위 테스트 가능

3. **재사용성**: 다른 프로젝트에서도 사용 가능

4. **유지보수성**: 버그 수정 및 기능 추가 용이

5. **확장성**: 새로운 파일 작업 추가 용이

---

## 다음 단계

Phase 4 완료 후:

- **main.js 통합 작업**: 기존 파일 탐색기 코드를 새 클래스로 교체 (선택 사항)
- **테스트**: 빌드 및 기능 테스트
- **Phase 5**: 서버 라우팅 분리

---

## 참고 사항

### 마이그레이션 팁

1. **점진적 교체**: 한 번에 모든 코드를 교체하지 말고, 기능별로 점진적 교체
2. **콜백 활용**: 기존 로직을 콜백으로 연결해서 단계적 전환
3. **에러 처리**: FileOperations의 모든 메소드는 Promise를 반환하므로 try-catch 사용

### 주의사항

- **API 엔드포인트**: FileOperations가 사용하는 API 엔드포인트가 서버와 일치하는지 확인
- **드래그앤드롭**: FileExplorer가 드래그앤드롭 이벤트를 관리하므로, 직접 이벤트 리스너 추가하지 말것
- **컨텍스트 메뉴**: ContextMenu.show() 호출 시 actions 객체의 모든 필수 메소드 제공 필요
- **파일 업로드**: 서버에 `/api/upload` 및 `/api/upload-directory` 엔드포인트 구현 필요
