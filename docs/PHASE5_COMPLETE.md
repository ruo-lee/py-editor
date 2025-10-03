# Phase 5: 서버 라우팅 분리 완료

## 개요

Phase 5에서는 server/index.js의 라우팅 코드를 독립적인 라우트와 서비스로 분리했습니다.

## 생성된 파일

### Utils

**[server/utils/logger.js](../server/utils/logger.js)** (35줄)

- 구조화된 로깅 유틸리티
- 메소드: `log()`, `info()`, `warn()`, `error()`, `debug()`

**[server/utils/pathUtils.js](../server/utils/pathUtils.js)** (66줄)

- 경로 검증 및 워크스페이스 유틸리티
- `WORKSPACE_ROOT`, `validateAndResolvePath()`, `getBasePath()`

### Services

**[server/services/fileService.js](../server/services/fileService.js)** (115줄)

- 파일 시스템 작업 서비스
- `getDirectoryStructure()`, `readFile()`, `writeFile()`, `deleteItem()`, `createDirectory()`, `moveItem()`, `copyItem()`

**[server/services/executionService.js](../server/services/executionService.js)** (175줄)

- Python 코드 실행 서비스
- `checkSyntax()`, `executeCode()`

### Routes

**[server/routes/files.js](../server/routes/files.js)** (75줄)

- 파일 작업 라우트
- `GET /api/files`, `GET /api/files/*`, `POST /api/files/*`, `DELETE /api/files/*`

**[server/routes/workspace.js](../server/routes/workspace.js)** (145줄)

- 워크스페이스 작업 라우트
- `POST /api/mkdir`, `POST /api/move`, `POST /api/upload`, `GET /api/download/*`, `GET /api/snippets`, `GET /api/stdlib/*`

**[server/routes/execution.js](../server/routes/execution.js)** (50줄)

- Python 실행 라우트
- `POST /api/check-syntax`, `POST /api/execute`, `POST /api/proxy-request`

## 새로운 server/index.js 구조

```javascript
const express = require('express');
const path = require('path');
const WebSocket = require('ws');

const logger = require('./utils/logger');
const { WORKSPACE_ROOT } = require('./utils/pathUtils');

const filesRouter = require('./routes/files');
const workspaceRouter = require('./routes/workspace');
const executionRouter = require('./routes/execution');

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client/dist')));
app.use('/workspace', express.static('/app/workspace'));

// Routes
app.use('/api/files', filesRouter);
app.use('/api', workspaceRouter);
app.use('/api', executionRouter);

// WebSocket for LSP (remains in index.js)
const wss = new WebSocket.Server({ noServer: true });
// ... LSP WebSocket logic

// Fallback route
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
    logger.info(`Server running on port ${PORT}`);
});

server.on('upgrade', (request, socket, head) => {
    if (request.url === '/lsp') {
        wss.handleUpgrade(request, socket, head, (ws) => {
            wss.emit('connection', ws, request);
        });
    }
});
```

## 파일 구조

```
server/
├── index.js (150줄 - Express 앱 설정 + LSP WebSocket만)
├── api-proxy.js (기존 유지)
├── utils/
│   ├── logger.js (35줄)
│   └── pathUtils.js (66줄)
├── services/
│   ├── fileService.js (115줄)
│   └── executionService.js (175줄)
└── routes/
    ├── files.js (75줄)
    ├── workspace.js (145줄)
    └── execution.js (50줄)
```

## 장점

1. **단일 책임 원칙**: 각 모듈이 명확한 책임
    - Utils: 공통 유틸리티
    - Services: 비즈니스 로직
    - Routes: HTTP 라우팅

2. **테스트 가능성**: 독립적인 단위 테스트 가능

3. **재사용성**: 서비스와 유틸리티를 다른 라우트에서 재사용

4. **유지보수성**: 버그 수정 및 기능 추가 용이

5. **코드 감소**: server/index.js에서 약 500줄 감소

## 참고 사항

**주의사항:**

- LSP WebSocket 로직은 index.js에 유지 (WebSocket 핸들러는 라우트 분리 어려움)
- 모든 라우트는 Express Router 사용
- 공통 유틸리티(logger, pathUtils)를 모든 모듈에서 임포트
- 에러 핸들링은 각 라우트에서 처리

**다음 단계:**

- 통합 테스트 실행
- API 엔드포인트 검증
- 성능 테스트
