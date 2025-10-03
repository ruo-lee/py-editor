# LSPClient 통합 가이드

## 개요

LSPClient 클래스는 main.js에서 분리된 독립적인 Language Server Protocol 클라이언트입니다.
이 문서는 main.js에서 LSPClient를 사용하도록 통합하는 방법을 설명합니다.

## 현재 상태

✅ LSPClient 클래스 생성 완료 ([client/src/lsp/LSPClient.js](../client/src/lsp/LSPClient.js))
✅ Import 문 추가 완료
⏳ main.js LSP 메소드 교체 필요

## 통합 단계

### 1. Import 완료

```javascript
// client/main.js (이미 완료됨)
import { LSPClient } from './src/lsp/LSPClient.js';
```

### 2. Constructor 수정 (이미 완료됨)

```javascript
class PythonIDE {
    constructor() {
        // ...
        this.lspClient = null; // ✅ languageClient → lspClient로 변경됨
        this.snippets = {};
        // ...
    }
}
```

### 3. LSP 초기화 메소드 교체

**기존 코드 (294-918줄 제거 필요):**

- `initializeLanguageServer()` (294-330줄)
- `initializeLSP()` (332-378줄)
- `sendLSPRequest()` (380-388줄)
- `handleLSPResponse()` (390-410줄)
- `handleInitializeResponse()` (412-423줄)
- `setupAdvancedFeatures()` (425-447줄)
- `getCompletionItems()` (540-607줄)
- `getBasicCompletions()` (609-665줄)
- `handleCompletionResponse()` (667-687줄)
- `convertCompletionItemKind()` (689-709줄)
- `getDefinition()` (711-764줄)
- `ensureDocumentSynchronized()` (766-795줄)
- `handleDefinitionResponse()` (797-841줄)
- `getHover()` (843-888줄)
- `handleHoverResponse()` (890-918줄)

**새로운 코드 (약 30줄):**

```javascript
// client/main.js

async initializeLanguageServer() {
    // LSPClient 초기화
    this.lspClient = new LSPClient(
        this.snippets,
        () => this.setupBasicValidation()
    );

    // LSP 서버 연결
    await this.lspClient.connect();

    // Monaco 프로바이더 등록 (자동완성, 정의 이동, hover)
    this.lspClient.registerProviders();
}

// setupBasicValidation은 그대로 유지 (449-472줄)
```

### 4. LSP 관련 메소드 호출 수정

**handleCtrlClick 메소드 (920줄):**

```javascript
// 기존
const definition = await this.getDefinition(editor.getModel(), position, editorSide);

// 변경
const activeFile = editorSide === 'right' ? this.rightActiveFile : this.activeFile;
const definition = await this.lspClient.getDefinition(
    editor.getModel(),
    position,
    activeFile || 'temp.py'
);
```

**다른 LSP 호출 위치 찾기:**

```bash
# sendLSPRequest 호출 찾기
grep -n "sendLSPRequest" client/main.js

# 결과 예상:
# 1117: this.sendLSPRequest({...})  - didOpen 알림
# 1144: this.sendLSPRequest({...})  - didClose 알림
```

**didOpen 알림 (1117줄 근처):**

```javascript
// 기존
this.sendLSPRequest({
    jsonrpc: '2.0',
    method: 'textDocument/didOpen',
    params: {
        textDocument: {
            uri: fileUri,
            languageId: 'python',
            version: 1,
            text: content,
        },
    },
});

// 변경
if (this.lspClient) {
    this.lspClient.notifyDidOpen(filePath, content);
}
```

**didClose 알림 (1144줄 근처):**

```javascript
// 기존
this.sendLSPRequest({
    jsonrpc: '2.0',
    method: 'textDocument/didClose',
    params: {
        textDocument: { uri: fileUri },
    },
});

// 변경
if (this.lspClient) {
    this.lspClient.notifyDidClose(filePath);
}
```

## 자동 적용 스크립트

main.js가 너무 커서 수동 수정이 어려울 경우, 아래 스크립트를 사용하세요:

```bash
# backup 생성
cp client/main.js client/main.js.backup

# LSP 메소드 제거 및 교체 스크립트 실행
# (별도 스크립트 파일 필요)
```

## 통합 후 검증

### 1. 빌드 테스트

```bash
cd client
npm run build
```

### 2. 기능 테스트

- [ ] 자동완성 작동 확인 (`.` 입력 시)
- [ ] 정의 이동 작동 확인 (Ctrl+Click)
- [ ] Hover 정보 표시 확인 (마우스 오버)
- [ ] 파일 열기/닫기 LSP 알림 확인
- [ ] 에러 없이 빌드 완료

### 3. 예상 결과

- main.js: 3,726줄 → ~3,200줄 (약 526줄 감소)
- LSP 로직 완전 독립
- 테스트 가능성 향상

## LSPClient API 참조

### 연결 관리

```javascript
// LSP 서버 연결
await lspClient.connect();

// 연결 종료
lspClient.disconnect();
```

### Monaco 프로바이더 등록

```javascript
// 자동완성, 정의 이동, hover 프로바이더 등록
lspClient.registerProviders();
```

### LSP 기능

```javascript
// 자동완성
const completions = await lspClient.getCompletions(model, position, activeFile);

// 정의 이동
const definition = await lspClient.getDefinition(model, position, activeFile);

// Hover 정보
const hoverInfo = await lspClient.getHover(model, position, activeFile);
```

### 문서 동기화

```javascript
// 파일 열림
lspClient.notifyDidOpen(filePath, content);

// 파일 변경
lspClient.notifyDidChange(filePath, content);

// 파일 닫힘
lspClient.notifyDidClose(filePath);
```

## 주의사항

1. **activeFile 전달 필수**: LSPClient 메소드 호출 시 activeFile 인자 반드시 전달
2. **null 체크**: `this.lspClient`가 null일 수 있으므로 호출 전 체크
3. **에러 처리**: LSPClient 내부에서 에러 처리됨, 반환값 null 가능

## 문제 해결

### LSP 연결 실패

```javascript
// setupBasicValidation이 호출되어 fallback 제공
// 콘솔에 'Language server error' 표시
```

### 자동완성 안 됨

- LSPClient.registerProviders() 호출 확인
- WebSocket 연결 상태 확인 (개발자 도구 Network 탭)

### 정의 이동 안 됨

- activeFile 인자 제대로 전달되는지 확인
- LSP 서버 응답 시간 (5초 timeout)

## 다음 단계

Phase 2 완료 후:

- Phase 3: 에디터 관련 코드 분리 (EditorManager, TabManager)
- Phase 4: 파일 탐색기 분리 (FileExplorer)
- Phase 5: 서버 라우팅 분리
