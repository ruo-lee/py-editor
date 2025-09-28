# Python IDE

경량 웹 기반 Python IDE - 도커 컨테이너로 제공되는 현대적인 코드 에디터

## 주요 기능

- 🐍 **Python 3.11 지원** - 타입 힌팅, 린팅, 문법 검사
- 📁 **워크스페이스 관리** - 볼륨 마운트를 통한 파일 시스템 접근
- 🎯 **Go-to-Definition** - Ctrl/Cmd + 클릭으로 모듈 탐색
- ✂️ **스니펫 지원** - 사용자 정의 Python 코드 템플릿
- 🏃 **코드 실행** - 내장 Python 인터프리터
- 🎨 **현대적 UI** - VS Code 스타일의 직관적 인터페이스
- 🔒 **폐쇄망 지원** - 외부 네트워크 연결 불필요

## 빠른 시작

### Docker로 실행

```bash
# 이미지 빌드
npm run docker:build

# 컨테이너 실행 (워크스페이스 마운트)
npm run docker:run

# 또는 직접 Docker 명령어
docker run -p 8080:8080 -v /your/workspace:/app/workspace py-editor
```

브라우저에서 `http://localhost:8080` 접속

### 개발 모드

```bash
# 의존성 설치
npm install
cd server && npm install
cd ../client && npm install

# 개발 서버 시작
npm run dev
```

## 사용법

### 파일 관리
- 좌측 Explorer에서 파일/폴더 탐색
- 파일 클릭으로 에디터에서 열기
- 자동 저장 (Ctrl/Cmd + S)

### 코드 작성
- Monaco Editor 기반 고급 편집 기능
- Python 문법 강조 및 자동 완성
- 스니펫: `def`, `class`, `if`, `for` 등 입력 후 Tab

### 코드 실행
- Python 파일 열기 후 우상단 "Run" 버튼 클릭
- 또는 Ctrl/Cmd + R 단축키
- 하단 패널에서 실행 결과 확인

### Go-to-Definition
- Ctrl/Cmd + 클릭으로 import된 모듈 파일로 이동
- 워크스페이스 내 Python 파일 간 탐색 지원

## 스니펫 커스터마이징

`/app/snippets/python.json` 파일을 수정하여 사용자 정의 스니펫 추가:

```json
{
  "my_snippet": {
    "prefix": "mysnip",
    "body": [
      "def my_function(${1:param}) -> ${2:return_type}:",
      "    \"\"\"${3:Description}\"\"\"",
      "    ${4:pass}"
    ],
    "description": "My custom snippet"
  }
}
```

## 폴더 구조

```
py-editor/
├── client/              # 프론트엔드 (Vite + Monaco Editor)
├── server/              # 백엔드 (Express.js)
├── workspace/           # 사용자 워크스페이스 (마운트 가능)
├── snippets/            # Python 스니펫 템플릿
├── Dockerfile          # 컨테이너 설정
└── package.json        # 프로젝트 설정
```

## 기술 스택

### Frontend
- **Monaco Editor** - VS Code의 에디터 엔진
- **Vite** - 빠른 빌드 도구
- **Vanilla JavaScript** - 경량화를 위한 프레임워크 없는 구현

### Backend
- **Node.js + Express** - 웹 서버
- **Python Language Server** - 코드 분석 및 린팅
- **WebSocket** - 실시간 언어 서버 통신

### Container
- **Node.js 18 Alpine** - 경량 베이스 이미지
- **Python 3.11** - 최신 Python 런타임

## 확장 가능성

현재 구조는 향후 확장을 고려하여 설계되었습니다:

- **다중 Python 버전 지원** - Docker 이미지 변형으로 구현 가능
- **추가 언어 지원** - 언어별 서버 및 스니펫 추가
- **플러그인 시스템** - 모듈식 기능 확장
- **Git 통합** - 버전 관리 기능
- **터미널 통합** - 내장 터미널 지원

## 요구사항

- Docker (컨테이너 실행 시)
- Node.js 18+ (개발 모드)
- 모던 웹 브라우저 (Chrome, Firefox, Safari, Edge)

## 라이선스

MIT License