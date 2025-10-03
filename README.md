# Python IDE

경량 웹 기반 Python IDE - Docker 컨테이너로 제공되는 VSCode 스타일 코드 에디터

![Python 3.11](https://img.shields.io/badge/python-3.11-blue.svg)
![Node.js](https://img.shields.io/badge/node-%3E%3D18-green.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)

## ✨ 주요 기능

- 🐍 **Python 3.11 완벽 지원** - 최신 Python 문법 및 타입 힌팅
- ⚡ **실시간 Syntax Checking** - 타이핑하는 동안 오류 표시 (VSCode 스타일)
- 🔍 **Python Language Server** - 자동완성, 린팅, 타입 체크
- 🎯 **Go-to-Definition** - Ctrl/Cmd + 클릭으로 모듈/함수 정의로 이동
- 📂 **파일 관리** - 파일 탐색기, 드래그&드롭, 업로드/다운로드
- 🖥️ **Split View** - 좌우 분할 에디터로 동시 작업
- ✂️ **스니펫 지원** - Python 코드 템플릿 (커스터마이징 가능)
- 🏃 **코드 실행** - 내장 Python 인터프리터로 즉시 실행
- 🌐 **API 요청 도구** - Postman 스타일 HTTP 클라이언트 내장
- 🎨 **Monaco Editor** - VS Code와 동일한 편집기 엔진
- 🔒 **폐쇄망 지원** - 외부 네트워크 연결 불필요

## 🚀 빠른 시작

### 필수 요구사항

- **Docker** (컨테이너 실행용)
- **Node.js 18+** (로컬 개발 시)
- **모던 웹 브라우저** (Chrome, Firefox, Safari, Edge)

### 방법 1: Docker로 실행 (권장)

```bash
# 1. 이미지 빌드
npm run docker:build

# 2. 컨테이너 실행 (현재 디렉토리의 workspace를 마운트)
npm run docker:run

# 3. 브라우저에서 접속
open http://localhost:8080
```

**커스텀 워크스페이스 마운트**:

```bash
docker run -p 8080:8080 \
  -v /your/custom/path:/app/workspace \
  py-editor
```

**다른 포트 사용**:

```bash
docker run -p 3000:8080 \
  -v $(pwd)/workspace:/app/workspace \
  py-editor
# 접속: http://localhost:3000
```

### 방법 2: 로컬 개발 모드

**로컬 개발 환경 요구사항:**

- Node.js 18+
- Python 3.11+
- Python Language Server (선택사항, 자동완성/go-to-definition 기능): `pip install python-lsp-server[all]`

```bash
# 1. 루트 의존성 설치 (개발 도구)
npm install

# 2. 서버/클라이언트 의존성 설치
cd server && npm install && cd ..
cd client && npm install && cd ..

# 또는 한 줄로:
npm install && (cd server && npm install) && (cd client && npm install)

# 3. 개발 서버 시작 (HMR 지원)
npm run dev

# 4. 브라우저 접속
# - Frontend: http://localhost:3000 (Vite dev server with proxy)
# - Backend API: http://localhost:8080 (Express server)
```

> **참고**: `pylsp`가 설치되지 않아도 기본 편집/실행 기능은 정상 작동합니다.

## 📖 사용 가이드

### 1️⃣ 파일 탐색 및 편집

**파일 열기**:

- 좌측 Explorer에서 파일 클릭
- 자동 저장 활성화 (타이핑 시 자동으로 저장)

**파일 생성**:

- Explorer에서 폴더 우클릭 → "New File"
- 또는 "New Folder" 선택

**파일 업로드**:

- 드래그 앤 드롭으로 파일/폴더 업로드
- 폴더 구조 유지됨

**파일 다운로드**:

- 파일/폴더 우클릭 → "Download"
- 폴더는 ZIP으로 압축되어 다운로드

### 2️⃣ 코드 작성

**실시간 Syntax Checking**:

- Python 파일 편집 시 500ms 후 자동 검사
- 오류가 있는 라인에 빨간 밑줄 표시
- 마우스 오버로 에러 메시지 확인

**자동 완성**:

- 타이핑 시 자동으로 제안 표시
- `Tab` 또는 `Enter`로 선택

**스니펫 사용**:

```python
# 'def' 입력 후 Tab → 함수 템플릿
def function_name(param):
    pass

# 'class' 입력 후 Tab → 클래스 템플릿
class ClassName:
    def __init__(self):
        pass

# 'if' 입력 후 Tab → if 블록
if condition:
    pass
```

### 3️⃣ 코드 실행

**방법 1**: 우상단 "▶ Run" 버튼 클릭
**방법 2**: `Ctrl/Cmd + R` 단축키

실행 결과는 하단 Output 패널에 표시됩니다.

### 4️⃣ Go-to-Definition

**사용법**:

1. `import` 문이나 함수 호출에 마우스 오버
2. `Ctrl` (Windows/Linux) 또는 `Cmd` (Mac) 키 누르기
3. 밑줄이 생기면 클릭 → 정의로 이동

**지원 범위**:

- 워크스페이스 내 Python 파일
- Python 표준 라이브러리 (읽기 전용)

### 5️⃣ Split View

**활성화**:

- 우상단 분할 아이콘 클릭
- 또는 탭 우클릭 → "Open to the Side"

**사용**:

- 좌우 에디터에서 서로 다른 파일 편집
- 독립적인 탭 관리
- 드래그로 리사이즈 가능

### 6️⃣ API 요청 도구

**기능**: Postman과 유사한 HTTP 클라이언트 내장

**실행**:

- 우상단 지구본 아이콘 클릭

**지원 기능**:

- HTTP 메소드: GET, POST, PUT, PATCH, DELETE
- Query Parameters, Headers, Request Body 설정
- JSON 및 SSE(Server-Sent Events) 응답 지원
- 도메인 관리 (여러 API 서버 저장)
- 라이트/다크 테마 자동 적용
- 패널 크기 조절 (450px ~ 1000px)

**사용법**:

1. 도메인 설정: 톱니바퀴 아이콘 → 도메인 추가
2. 요청 설정: 메소드 선택, URL 입력
3. 옵션 추가: Params/Headers/Body 탭에서 설정
4. Send 버튼으로 요청 실행

자세한 내용은 [API 요청 도구 가이드](docs/API_REQUEST_TOOL.md)를 참고하세요.

## 🛠️ 고급 설정

### 스니펫 커스터마이징

스니펫은 Docker 이미지에 포함되어 있습니다 (`/app/snippets/python.json`).

**커스터마이징 방법**:

1. `snippets/python.json` 파일 수정
2. Docker 이미지 재빌드

```json
{
    "dataclass_template": {
        "prefix": "dataclass",
        "body": [
            "from dataclasses import dataclass",
            "",
            "@dataclass",
            "class ${1:ClassName}:",
            "    ${2:field}: ${3:type}",
            "    ${4}"
        ],
        "description": "Python dataclass template"
    }
}
```

```bash
# 재빌드 후 실행
npm run docker:build
npm run docker:run
```

### 워크스페이스 폴더 선택

URL 파라미터로 하위 폴더 선택 가능:

```
http://localhost:8080/?folder=my_project
http://localhost:8080/?folder=backend/api
```

브라우저 UI에서도 폴더 선택 가능합니다.

### 환경 변수

```bash
docker run -p 8080:8080 \
  -e PORT=3000 \
  -e DEBUG=true \
  -v $(pwd)/workspace:/app/workspace \
  py-editor
```

## 🚢 프로덕션 배포

### Docker Registry에 푸시

```bash
# 1. 이미지 태깅 (버전 관리)
docker tag py-editor your-registry.com/py-editor:1.0.0
docker tag py-editor your-registry.com/py-editor:latest

# 2. Registry에 푸시
docker push your-registry.com/py-editor:1.0.0
docker push your-registry.com/py-editor:latest
```

### Kubernetes 배포

**deployment.yaml**:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
    name: py-editor
    labels:
        app: py-editor
spec:
    replicas: 3
    selector:
        matchLabels:
            app: py-editor
    template:
        metadata:
            labels:
                app: py-editor
        spec:
            containers:
                - name: py-editor
                  image: your-registry.com/py-editor:1.0.0
                  ports:
                      - containerPort: 8080
                        name: http
                  volumeMounts:
                      - name: workspace
                        mountPath: /app/workspace
                  resources:
                      requests:
                          memory: '256Mi'
                          cpu: '250m'
                      limits:
                          memory: '512Mi'
                          cpu: '500m'
                  livenessProbe:
                      httpGet:
                          path: /
                          port: 8080
                      initialDelaySeconds: 30
                      periodSeconds: 10
                  readinessProbe:
                      httpGet:
                          path: /
                          port: 8080
                      initialDelaySeconds: 5
                      periodSeconds: 5
            volumes:
                - name: workspace
                  persistentVolumeClaim:
                      claimName: py-editor-workspace-pvc
---
apiVersion: v1
kind: Service
metadata:
    name: py-editor-service
spec:
    type: LoadBalancer
    ports:
        - port: 80
          targetPort: 8080
          protocol: TCP
          name: http
    selector:
        app: py-editor
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
    name: py-editor-workspace-pvc
spec:
    accessModes:
        - ReadWriteMany
    resources:
        requests:
            storage: 10Gi
    storageClassName: standard
```

**배포 명령어**:

```bash
kubectl apply -f deployment.yaml

# 배포 확인
kubectl get pods -l app=py-editor
kubectl get svc py-editor-service

# 로그 확인
kubectl logs -f deployment/py-editor
```

### Docker Compose

**docker-compose.yml**:

```yaml
version: '3.8'

services:
    py-editor:
        image: py-editor:latest
        build:
            context: .
            dockerfile: Dockerfile
        ports:
            - '8080:8080'
        volumes:
            - ./workspace:/app/workspace
            - ./snippets:/app/snippets
        environment:
            - NODE_ENV=production
            - PORT=8080
        restart: unless-stopped
        healthcheck:
            test: ['CMD', 'curl', '-f', 'http://localhost:8080']
            interval: 30s
            timeout: 10s
            retries: 3
            start_period: 40s
```

**실행**:

```bash
docker-compose up -d
docker-compose logs -f
docker-compose down
```

### 인프라팀 전달 정보

**필수 사항**:

- **컨테이너 이미지**: `your-registry.com/py-editor:1.0.0`
- **노출 포트**: `8080` (HTTP)
- **필수 볼륨**: `/app/workspace` (사용자 파일 저장)

**리소스 권장사항**:

- **CPU**: 250m (요청) / 500m (제한)
- **메모리**: 256Mi (요청) / 512Mi (제한)
- **스토리지**: 10Gi (워크스페이스용)

**메모리 사용량 (실측)**:

| 동시 사용자 | 메모리 사용량 | 권장 메모리 제한 |
| ----------- | ------------- | ---------------- |
| 1명         | ~93 MB        | 256 MB           |
| 3명         | ~173 MB       | 256 MB           |
| 5명         | ~253 MB       | 512 MB           |
| 10명        | ~453 MB       | 512 MB           |
| 20명        | ~853 MB       | 1 GB             |
| 50명        | ~2 GB         | 3 GB             |

> 📝 **참고**: 각 사용자는 약 40MB의 메모리를 사용합니다 (pylsp 프로세스 포함).
> 대규모 사용자를 위해 HPA(Horizontal Pod Autoscaler) 설정을 권장합니다.

**환경 변수** (선택):

- `PORT`: 서버 포트 (기본값: 8080)
- `DEBUG`: 디버그 모드 (true/false)
- `NODE_ENV`: 환경 (production/development)

**Health Check**:

- **Endpoint**: `GET /`
- **성공 조건**: HTTP 200 OK
- **초기 지연**: 30초
- **체크 주기**: 10초

## 📂 프로젝트 구조

```
py-editor/
├── client/                 # Frontend (Vite + Monaco Editor)
│   ├── src/
│   │   └── utils/
│   │       └── dragAndDrop.js
│   ├── main.js            # 메인 앱 로직
│   ├── index.html
│   └── package.json
│
├── server/                 # Backend (Express.js)
│   ├── index.js           # 서버 메인
│   └── package.json
│
├── workspace/              # 사용자 작업 공간 (Docker 볼륨 마운트)
│   └── (your Python files)
│
├── snippets/               # Python 스니펫 템플릿
│   └── python.json
│
├── Dockerfile              # Python 3.11 Alpine 기반
├── .dockerignore           # Docker 빌드 최적화
├── package.json            # 루트 개발 스크립트
└── README.md
```

## 🔧 기술 스택

### Frontend

- **Monaco Editor** `^0.44.0` - VSCode 에디터 엔진
- **Vite** `^4.5.0` - 빠른 빌드 도구
- **Vanilla JavaScript** - 프레임워크 없는 경량 구현

### Backend

- **Express** `^4.18.2` - HTTP 서버
- **WebSocket (ws)** `^8.14.2` - 실시간 LSP 통신
- **Python Language Server** - pylsp, mypy, pyflakes
- **Multer** `^1.4.5` - 파일 업로드
- **Archiver** `^6.0.1` - ZIP 다운로드
- **Chokidar** `^3.5.3` - 파일 감지

### Container

- **Python 3.11 Alpine** - 베이스 이미지
- **Node.js** - 런타임
- **pip** - Python 패키지 관리

## 🐛 문제 해결

### Docker 빌드 실패

```bash
# 캐시 없이 재빌드
docker build --no-cache -t py-editor .

# 기존 이미지 삭제 후 재빌드
docker rmi py-editor
npm run docker:build
```

### 포트 충돌 (8080 already in use)

```bash
# 기존 컨테이너 중지
docker ps | grep py-editor
docker stop <container-id>

# 또는 다른 포트 사용
docker run -p 3000:8080 -v $(pwd)/workspace:/app/workspace py-editor
```

### Language Server 작동 안 함

```bash
# 컨테이너 재시작
docker restart <container-id>

# 로그 확인
docker logs <container-id>
```

### 파일 권한 문제 (Permission denied)

```bash
# 워크스페이스 폴더 권한 확인
chmod -R 755 workspace/

# Docker 볼륨 마운트 시 절대 경로 사용
docker run -p 8080:8080 -v /absolute/path/to/workspace:/app/workspace py-editor
```

## 🚧 개발 가이드

### 코드 수정 후 반영

**Frontend 수정**:

```bash
cd client
npm run build
cd ..
npm run docker:build  # Docker 이미지 재빌드
```

**Backend 수정**:

```bash
npm run docker:build  # Docker 이미지 재빌드
```

**개발 모드 (HMR)**:

```bash
npm run dev  # 파일 변경 시 자동 reload
```

### API 엔드포인트

| Method | Path                 | Description            |
| ------ | -------------------- | ---------------------- |
| GET    | `/api/files`         | 파일 목록 조회         |
| GET    | `/api/files/*`       | 파일 내용 읽기         |
| POST   | `/api/files/*`       | 파일 생성/수정         |
| DELETE | `/api/files/*`       | 파일/폴더 삭제         |
| POST   | `/api/mkdir`         | 디렉토리 생성          |
| POST   | `/api/move`          | 파일/폴더 이동         |
| POST   | `/api/upload`        | 파일 업로드            |
| GET    | `/api/download/*`    | 파일/폴더 다운로드     |
| POST   | `/api/execute`       | Python 코드 실행       |
| POST   | `/api/check-syntax`  | 실시간 syntax 검사     |
| GET    | `/api/snippets`      | 스니펫 목록            |
| GET    | `/api/stdlib/*`      | Python 표준 라이브러리 |
| POST   | `/api/proxy-request` | API 프록시 요청        |

### WebSocket (Language Server)

**연결**: `ws://localhost:8080`

**프로토콜**: Language Server Protocol (LSP)

**지원 기능**:

- `textDocument/completion` - 자동 완성
- `textDocument/definition` - 정의로 이동
- `textDocument/hover` - 타입 정보 표시

## 📝 로드맵

- [ ] 다중 Python 버전 지원 (3.8, 3.9, 3.10, 3.12)
- [ ] 터미널 통합 (xterm.js)
- [ ] Git 통합 (diff viewer, commit)
- [ ] 테마 커스터마이징
- [ ] 다국어 지원
- [ ] 플러그인 시스템
- [ ] Jupyter Notebook 지원
- [ ] 디버거 통합

## 🤝 기여하기

이슈 및 Pull Request 환영합니다!

### 기여 프로세스

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (커밋 메시지 형식 준수)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### 커밋 메시지 형식

이 프로젝트는 [Conventional Commits](https://www.conventionalcommits.org/) 형식을 따릅니다:

```
<type>(<scope>): <subject>
```

**타입 (Type)**:

- `feat`: 새로운 기능 추가
- `fix`: 버그 수정
- `docs`: 문서 변경
- `style`: 코드 포맷팅 (기능 변경 없음)
- `refactor`: 코드 리팩토링
- `perf`: 성능 개선
- `test`: 테스트 추가/수정
- `chore`: 빌드/설정 변경
- `build`: 빌드 시스템 변경
- `ci`: CI 설정 변경

**예시**:

```bash
feat(editor): add real-time syntax checking
fix(server): handle pylsp not installed error
docs(readme): add local dev requirements
chore(deps): update dependencies
```

**잘못된 형식**:

```bash
❌ Add syntax checking
❌ fixed bug
❌ Update README
```

**올바른 형식**:

```bash
✅ feat(editor): add syntax checking
✅ fix(server): resolve connection issue
✅ docs(readme): update installation guide
```

### Pre-commit Hooks

이 프로젝트는 코드 품질을 위해 pre-commit hooks를 사용합니다:

- **ESLint**: 코드 스타일 검사 및 자동 수정
- **Prettier**: 코드 포맷팅
- **Commit Message 검증**: Conventional Commits 형식 확인

커밋이 실패하면 형식을 수정하거나, 긴급한 경우 `--no-verify` 옵션을 사용할 수 있습니다:

```bash
git commit --no-verify -m "your message"
```

자세한 기여 가이드는 [CONTRIBUTING.md](CONTRIBUTING.md)를 참고하세요.

## 📄 라이선스

MIT License - 자유롭게 사용, 수정, 배포 가능합니다.

## 🙏 감사의 말

- [Monaco Editor](https://microsoft.github.io/monaco-editor/) - Microsoft
- [Python Language Server](https://github.com/python-lsp/python-lsp-server)
- [Express.js](https://expressjs.com/)
- [Vite](https://vitejs.dev/)
