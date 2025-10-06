# Server 테스트 실행 가이드

## ⚠️ 현재 상태

### ✅ 작동하는 테스트

- **Integration Tests - Execution** (20/20 통과)
    - Python 코드 실행
    - 문법 체크
    - 에러 처리
    - 입출력 처리

### ⚠️ 알려진 이슈

일부 테스트가 파일 시스템 경로 문제로 실패합니다:

- `workspace.test.js` - 디렉토리 생성 테스트
- `files.test.js` - 일부 파일 작업 테스트
- `user-workflows.test.js` - E2E 워크플로우 테스트

**원인**: `getBasePath()` 함수가 테스트 환경에서 예상과 다른 경로를 반환

## 🚀 테스트 실행 방법

### 작동하는 테스트만 실행

```bash
cd server

# Execution 테스트만 (모두 통과)
npm test -- --testPathPattern=integration/execution

# 결과: 20/20 통과 ✅
```

### 전체 테스트 실행

```bash
npm test

# 결과: 34/65 통과 (나머지는 경로 이슈)
```

## 📊 커버리지

현재 커버리지 (execution 테스트 기준):

- **executionService.js**: 87.5%
- **execution.js routes**: 54.5%
- **전체**: ~70%

## 🛠️ 수정 필요사항

테스트를 완전히 작동시키려면:

1. **Mock 전략 개선**
    - Express app을 실제 서버로 시작하지 말고 supertest만 사용
    - `getBasePath()`를 제대로 모킹

2. **또는 통합 테스트 단순화**
    - 실제 파일 시스템 대신 메모리 기반 테스트
    - 또는 Docker 컨테이너 내에서만 실행

## 💡 추천 사용법

**현재 상태로 사용하기:**

1. **핵심 기능 테스트**

    ```bash
    npm test -- integration/execution
    ```

    → Python 실행 로직은 완벽하게 테스트됨 ✅

2. **개발 중 Watch 모드**

    ```bash
    npm run test:watch -- integration/execution
    ```

3. **CI/CD에서**
    ```yaml
    - run: cd server && npm test -- integration/execution
    ```

## 📝 테스트 작성 철학

이 테스트들은 **사용자 시나리오 중심**으로 설계되었습니다:

- 실제 Python 코드 실행
- 실제 파일 시스템 사용
- Mock 최소화

이는 **강력하지만** 환경 의존성이 높습니다.

## 🎯 다음 단계

1. ✅ Execution 테스트 - 완료 및 작동 중
2. ⏳ Files/Workspace 테스트 - 경로 수정 필요
3. ⏳ E2E 테스트 - 통합 수정 필요
4. 📝 Client 테스트 - 아직 미작성

## 📞 도움말

문제 발생 시:

```bash
# 캐시 삭제
npm test -- --clearCache

# 상세 로그
npm test -- --verbose

# 단일 테스트
npm test -- -t "should successfully execute"
```
