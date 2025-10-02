# Contributing Guide

py-editor 프로젝트에 기여해주셔서 감사합니다!

## 개발 환경 설정

### 1. 저장소 클론

```bash
git clone <repository-url>
cd py-editor
```

### 2. 의존성 설치

```bash
# 루트 의존성 (개발 도구)
npm install

# 서버 의존성
cd server && npm install && cd ..

# 클라이언트 의존성
cd client && npm install && cd ..

# 또는 한 줄로
npm install && (cd server && npm install) && (cd client && npm install)
```

### 3. Git Hooks 설정

```bash
# Husky 훅 자동 설치됨 (npm install 시)
# 수동 설치:
npx husky install
```

## 코드 스타일 & 린팅

### JavaScript/Node.js

**ESLint** - 코드 품질 검사:

```bash
# 전체 검사
npm run lint

# 자동 수정
npm run lint:fix
```

**Prettier** - 코드 포맷팅:

```bash
# 포맷 체크
npm run format:check

# 자동 포맷팅
npm run format
```

**설정 파일**:

- `.eslintrc.json` - ESLint 규칙
- `.prettierrc.json` - Prettier 설정
- `.prettierignore` - 포맷팅 제외 파일

### Python

**추천 도구** (선택):

```bash
# pip 설치 (Docker 외부에서 개발 시)
pip install black flake8 isort pre-commit

# pre-commit 설치
pre-commit install

# 수동 실행
black .
flake8 .
isort .
```

**설정 파일**:

- `pyproject.toml` - Black, isort 설정
- `.pre-commit-config.yaml` - pre-commit 훅

## Git Commit 규칙

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types**:

- `feat`: 새로운 기능
- `fix`: 버그 수정
- `docs`: 문서 변경
- `style`: 코드 포맷팅 (로직 변경 없음)
- `refactor`: 리팩토링
- `perf`: 성능 개선
- `test`: 테스트 추가/수정
- `chore`: 빌드/설정 변경
- `build`: 빌드 시스템 변경
- `ci`: CI 설정 변경

**Examples**:

```bash
feat(editor): add real-time syntax checking
fix(server): resolve file upload permission issue
docs(readme): update installation instructions
refactor(client): simplify tab management logic
```

### Pre-commit Hooks

커밋 전 자동 실행:

1. **lint-staged** - staged 파일만 린팅/포맷팅
2. **commit-msg** - 커밋 메시지 형식 검증

**자동으로 실행되는 것**:

- ESLint 자동 수정
- Prettier 자동 포맷팅
- 커밋 메시지 형식 검증

**훅 우회** (권장하지 않음):

```bash
git commit --no-verify -m "message"
```

## Pull Request 절차

### 1. 브랜치 생성

```bash
# Feature
git checkout -b feat/your-feature-name

# Bugfix
git checkout -b fix/bug-description

# Docs
git checkout -b docs/what-you-are-documenting
```

### 2. 코드 작성 & 테스트

```bash
# 개발 모드로 실행
npm run dev

# 빌드 테스트
npm run build
npm run docker:build

# 린팅 체크
npm run lint
npm run format:check
```

### 3. 커밋

```bash
git add .
git commit -m "feat(scope): description"
```

### 4. Push & PR 생성

```bash
git push origin feat/your-feature-name
```

GitHub에서 Pull Request 생성:

- 제목: 명확하고 간결하게
- 설명: 변경 사항, 이유, 테스트 방법 작성
- 스크린샷: UI 변경 시 첨부

## 테스트 가이드

### 로컬 테스트

```bash
# 개발 모드
npm run dev
# http://localhost:5173 (Frontend)
# http://localhost:8080 (Backend)

# Docker 테스트
npm run docker:build
npm run docker:run
# http://localhost:8080
```

### 테스트 체크리스트

- [ ] 로컬 개발 모드 정상 작동
- [ ] Docker 빌드 성공
- [ ] Docker 실행 및 접속 확인
- [ ] 기존 기능 정상 작동 (regression)
- [ ] 새로운 기능 정상 작동
- [ ] 브라우저 콘솔 에러 없음
- [ ] 서버 로그 에러 없음

## 코드 리뷰

### 리뷰어 체크리스트

- [ ] 코드 스타일 준수 (ESLint, Prettier)
- [ ] 커밋 메시지 형식 준수
- [ ] 적절한 에러 핸들링
- [ ] 보안 취약점 없음
- [ ] 성능 이슈 없음
- [ ] 문서 업데이트 (필요 시)
- [ ] 테스트 통과

### 리뷰 가이드라인

- 건설적이고 친절한 피드백
- 구체적인 개선 제안
- 코드 예시 제공
- 긍정적인 피드백도 함께

## 프로젝트 구조

```
py-editor/
├── .github/
│   └── workflows/
│       └── ci.yml          # GitHub Actions CI
├── .husky/
│   ├── pre-commit          # Pre-commit hook
│   └── commit-msg          # Commit message validation
├── client/                 # Frontend
│   ├── src/
│   ├── main.js
│   └── package.json
├── server/                 # Backend
│   ├── index.js
│   └── package.json
├── snippets/               # Python snippets
├── workspace/              # User workspace
├── .eslintrc.json          # ESLint config
├── .prettierrc.json        # Prettier config
├── .pre-commit-config.yaml # Python pre-commit
├── pyproject.toml          # Python tools config
├── Dockerfile              # Container config
├── docker-compose.yml      # Docker Compose
├── k8s-deployment.yaml     # Kubernetes config
└── package.json            # Root package
```

## 문의 & 도움

- 이슈: GitHub Issues
- 토론: GitHub Discussions
- 버그 리포트: Issue 템플릿 사용
- 기능 요청: Feature Request 템플릿 사용

## 라이선스

MIT License - 자유롭게 사용, 수정, 배포 가능합니다.
