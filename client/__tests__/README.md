# Client E2E Tests

Playwright 기반 사용자 시나리오 테스트입니다.

## 테스트 구조

```
client/__tests__/
├── e2e/
│   ├── file-operations.spec.js      # 파일/폴더 관리 시나리오
│   ├── code-execution.spec.js       # 코드 실행 시나리오
│   ├── lsp-features.spec.js         # LSP 기능 시나리오
│   └── workspace-management.spec.js # 워크스페이스/UI 시나리오
└── helpers/
    └── testHelpers.js               # 재사용 가능한 테스트 헬퍼
```

## 실행 방법

### 로컬 실행

```bash
cd client

# 전체 테스트 실행 (headless)
npm test

# UI 모드로 실행 (브라우저 보면서)
npm run test:headed

# 인터랙티브 UI 모드
npm run test:ui

# 디버그 모드
npm run test:debug
```

### VSCode에서 실행

1. Testing 아이콘 클릭 (플라스크 모양)
2. Playwright Tests 섹션에서 테스트 확인
3. 개별 테스트 또는 전체 테스트 실행

**또는 디버거 사용:**

- F5 → "Playwright: All Tests" 선택
- 파일 열고 F5 → "Playwright: Current File" 선택

## 테스트 시나리오

### 1. File Operations (8 tests)

- ✅ 새 파일 생성 및 편집
- ✅ 새 폴더 생성
- ✅ 파일 열기
- ✅ 파일 삭제
- ✅ 파일 이름 변경
- ✅ 파일 저장 (Ctrl+S)
- ✅ 파일 탐색기 새로고침

### 2. Code Execution (10 tests)

- ✅ Python 코드 실행 및 결과 확인
- ✅ 변수 사용
- ✅ 반복문
- ✅ 함수 정의/실행
- ✅ 런타임 에러 확인
- ✅ 문법 에러 확인
- ✅ import 사용
- ✅ 출력 패널 닫기
- ✅ Ctrl+R 단축키
- ✅ 여러 번 실행

### 3. LSP Features (8 tests)

- ✅ 자동완성
- ✅ 정의로 이동 (F12)
- ✅ 참조 찾기 (Shift+F12)
- ✅ 심볼 이름 변경 (F2)
- ✅ 코드 포맷팅
- ✅ Hover 정보
- ✅ 에러 진단
- ✅ 코드 접기/펼치기

### 4. Workspace Management (12 tests)

- ✅ 여러 탭 열기/전환
- ✅ 탭 닫기
- ✅ 테마 변경
- ✅ 사이드바 리사이즈
- ✅ 워크스페이스 펼치기/접기
- ✅ Split View
- ✅ 숨김 파일 토글
- ✅ 파일 트리 모두 접기
- ✅ 파일 경로 바 확인
- ✅ 앱 타이틀 확인
- ✅ 키보드 단축키

**총 38개 테스트**

## CI/CD

GitHub Actions에서 자동 실행됩니다:

1. PR 생성/업데이트 시
2. main/develop 브랜치 푸시 시

테스트 실패 시 빌드가 중단됩니다.

## 주의사항

- 테스트는 실제 브라우저에서 실행됩니다
- 서버가 실행 중이어야 합니다 (Playwright config에서 자동 시작)
- CI에서는 Chromium만 사용합니다
- 로컬에서는 `--headed` 옵션으로 브라우저를 볼 수 있습니다
