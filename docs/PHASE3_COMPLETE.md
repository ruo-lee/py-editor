# Phase 3: 에디터 관련 코드 분리 완료

## 개요

Phase 3에서는 main.js의 에디터 관련 코드를 독립적인 클래스들로 분리했습니다.

## 생성된 클래스

### 1. TabManager ([client/src/editor/TabManager.js](../client/src/editor/TabManager.js))

**책임:** 탭 생성, 전환, 닫기, 드래그앤드롭 재정렬

**주요 기능:**

- `openTab(filePath, isStdlib)`: 탭 생성 또는 전환
- `switchTab(filePath)`: 특정 탭으로 전환
- `closeTab(filePath)`: 탭 닫기
- `closeAllTabs()`: 모든 탭 닫기
- `markAsModified(filePath, isModified)`: 변경 표시 (● 아이콘)
- 드래그앤드롭으로 탭 순서 변경

**콜백:**

- `onTabSwitch(filePath)`: 탭 전환 시 호출
- `onTabClose(filePath)`: 탭 닫기 시 호출

**사용 예시:**

```javascript
const tabManager = new TabManager(
    document.getElementById('tabBar'),
    (file) => console.log('Switched to:', file),
    (file) => console.log('Closed:', file)
);

// 탭 열기
tabManager.openTab('src/main.py');

// 탭 닫기
tabManager.closeTab('src/main.py');

// 변경 표시
tabManager.markAsModified('src/main.py', true);
```

---

### 2. EditorManager ([client/src/editor/EditorManager.js](../client/src/editor/EditorManager.js))

**책임:** Monaco Editor 인스턴스 및 모델 관리

**주요 기능:**

- `createEditor(content, language)`: Monaco 에디터 생성
- `getOrCreateModel(filePath, content, language)`: 파일별 모델 생성/가져오기
- `setModel(model)`: 에디터에 모델 설정
- `setValue(content)` / `getValue()`: 내용 get/set
- `setTheme(theme)`: 테마 변경
- `setPosition(position)`: 커서 위치 설정
- `deltaDecorations(old, new)`: 하이라이트 등 데코레이션
- `onDidChangeModelContent(callback)`: 내용 변경 리스너
- `layout()`: 레이아웃 재조정
- `dispose()`: 에디터 정리

**Monaco API 래퍼:**

- `addAction()`, `addCommand()`: 액션/커맨드 추가
- `onMouseDown()`, `onMouseMove()`: 마우스 이벤트
- `onKeyDown()`, `onKeyUp()`: 키보드 이벤트
- `onDidFocusEditorText()`, `onDidBlurEditorText()`: 포커스 이벤트

**사용 예시:**

```javascript
const editorManager = new EditorManager(document.getElementById('editor'), 'vs-dark');

// 에디터 생성
editorManager.createEditor('print("Hello")', 'python');

// 모델 생성 및 설정
const model = editorManager.getOrCreateModel('main.py', 'print("Hello")', 'python');
editorManager.setModel(model);

// 내용 변경 감지
editorManager.onDidChangeModelContent(() => {
    console.log('Content changed');
});

// 테마 변경
editorManager.setTheme('vs');
```

---

### 3. SplitViewManager ([client/src/editor/SplitViewManager.js](../client/src/editor/SplitViewManager.js))

**책임:** Split View 기능 관리 (두 개의 에디터 + 탭)

**주요 기능:**

- `initializeLeftEditor(content, language)`: 왼쪽 에디터 초기화
- `toggleSplit()`: Split View 토글
- `activateSplitView()` / `deactivateSplitView()`: Split View 활성화/비활성화
- `getFocusedEditor()`: 포커스된 에디터 가져오기
- `getFocusedTabManager()`: 포커스된 탭 매니저 가져오기
- `setFocus(side)`: 'left' 또는 'right' 에디터로 포커스 전환
- `openFileInFocused(filePath, content, language, isStdlib)`: 포커스된 에디터에 파일 열기
- `setTheme(theme)`: 양쪽 에디터 테마 변경
- `layout()`: 양쪽 에디터 레이아웃 재조정
- `dispose()`: 모든 에디터 정리

**속성:**

- `leftEditor`: EditorManager 인스턴스
- `rightEditor`: EditorManager 인스턴스 (split view 활성화 시)
- `leftTabManager`: TabManager 인스턴스
- `rightTabManager`: TabManager 인스턴스
- `splitViewActive`: Split view 활성 여부
- `focusedEditor`: 'left' 또는 'right'

**콜백:**

- `onFileLoad(file, side)`: 파일 로드 시 호출
- `onFileClose(file, side)`: 파일 닫기 시 호출
- `onEditorFocus(side)`: 에디터 포커스 변경 시 호출

**사용 예시:**

```javascript
const splitViewManager = new SplitViewManager(
    document.getElementById('leftEditorContainer'),
    document.getElementById('rightEditorContainer'),
    document.getElementById('leftTabBar'),
    document.getElementById('rightTabBar'),
    'vs-dark'
);

// 왼쪽 에디터 초기화
splitViewManager.initializeLeftEditor();

// Split view 활성화
splitViewManager.toggleSplit();

// 포커스된 에디터에 파일 열기
await splitViewManager.openFileInFocused('main.py', 'print("Hello")', 'python');

// 오른쪽 에디터로 포커스 전환
splitViewManager.setFocus('right');

// 콜백 설정
splitViewManager.onFileLoad = (file, side) => {
    console.log(`File ${file} loaded in ${side} editor`);
};
```

---

## main.js 통합 방법

### 1. Import 추가

```javascript
// client/main.js
import { EditorManager } from './src/editor/EditorManager.js';
import { TabManager } from './src/editor/TabManager.js';
import { SplitViewManager } from './src/editor/SplitViewManager.js';
```

### 2. Constructor 수정

```javascript
class PythonIDE {
    constructor() {
        // 기존 에디터 관련 속성 제거
        // this.editor = null;
        // this.openTabs = new Map();
        // this.activeFile = null;
        // this.splitViewActive = false;
        // this.rightEditor = null;
        // this.rightOpenTabs = new Map();
        // this.rightActiveFile = null;
        // this.focusedEditor = 'left';

        // 새로운 매니저로 교체
        this.splitViewManager = new SplitViewManager(
            document.getElementById('leftEditorContainer'),
            document.getElementById('rightEditorContainer'),
            document.getElementById('leftTabBar'),
            document.getElementById('rightTabBar'),
            this.currentTheme
        );

        // 콜백 설정
        this.splitViewManager.onFileLoad = (file, side) => {
            this.onFileLoadCallback(file, side);
        };

        this.splitViewManager.onFileClose = (file, side) => {
            this.onFileCloseCallback(file, side);
        };

        // 초기화는 그대로
        this.initializeEditor();
        // ...
    }

    initializeEditor() {
        // 기존 Monaco.create 코드 제거
        // 새로운 방식으로 교체
        this.splitViewManager.initializeLeftEditor(welcomeMessage, 'python');
    }
}
```

### 3. 메소드 교체

**탭 관련:**

```javascript
// 기존
this.openTabs.set(filePath, tab);
this.activeFile = filePath;

// 새로운 방식
const tabManager = this.splitViewManager.getFocusedTabManager();
tabManager.openTab(filePath);
```

**에디터 접근:**

```javascript
// 기존
this.editor.getValue();
this.editor.setModel(model);

// 새로운 방식
const editor = this.splitViewManager.getFocusedEditor();
editor.getValue();
editor.setModel(model);
```

**Split View:**

```javascript
// 기존
toggleSplit() {
    this.splitViewActive = !this.splitViewActive;
    // ... 많은 코드
}

// 새로운 방식
toggleSplit() {
    this.splitViewManager.toggleSplit();
}
```

---

## 예상 효과

### 코드 감소

- main.js: 3,726줄 → 예상 ~2,800줄 (약 900줄 감소)
- 에디터 관련 로직 완전 분리

### 파일 구조

```
client/src/editor/
├── EditorManager.js (280줄)
├── TabManager.js (230줄)
└── SplitViewManager.js (220줄)
```

### 장점

1. **단일 책임 원칙**: 각 클래스가 명확한 책임
2. **테스트 가능성**: 독립적인 단위 테스트 가능
3. **재사용성**: 다른 프로젝트에서도 사용 가능
4. **유지보수성**: 버그 수정 및 기능 추가 용이

---

## 다음 단계

Phase 3 완료 후:

- **main.js 통합 작업**: 기존 에디터 코드를 새 매니저로 교체
- **테스트**: 빌드 및 기능 테스트
- **Phase 4**: 파일 탐색기 분리 (FileExplorer, ContextMenu)
- **Phase 5**: 서버 라우팅 분리

---

## 참고 사항

### 마이그레이션 팁

1. **점진적 교체**: 한 번에 모든 코드를 교체하지 말고, 기능별로 점진적 교체
2. **콜백 활용**: 기존 로직을 콜백으로 연결해서 단계적 전환
3. **타입 체크**: TypeScript 사용 시 타입 정의 추가

### 주의사항

- **모델 생명주기**: EditorManager가 모델을 관리하므로, 직접 모델 dispose 하지 말것
- **Split View**: SplitViewManager가 두 에디터를 모두 관리하므로, 직접 접근하지 말고 API 사용
- **탭 상태**: TabManager가 탭 상태를 관리하므로, DOM 직접 조작 금지
