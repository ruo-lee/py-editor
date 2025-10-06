# API 요청 도구

## 개요

PyEditor에 내장된 HTTP 클라이언트로 Postman과 유사한 기능을 제공합니다.

## 주요 기능

- **HTTP 메소드**: GET, POST, PUT, PATCH, DELETE
- **요청 설정**: Query Parameters, Headers, Request Body
- **응답 처리**: JSON, SSE(Server-Sent Events) 스트리밍
- **도메인 관리**: 여러 API 서버 저장 및 전환
- **테마 지원**: 라이트/다크 테마 자동 적용
- **패널 리사이즈**: 450px ~ 1000px 크기 조절

## 사용 방법

### 1. 패널 열기

우상단 지구본 아이콘 클릭

### 2. 도메인 설정

1. 톱니바퀴 아이콘 클릭
2. "Add Domain" 버튼으로 도메인 추가
3. 드롭다운에서 사용할 도메인 선택

### 3. 요청 보내기

1. HTTP 메소드 선택 (GET, POST 등)
2. URL 경로 입력 (예: `/api/users`)
3. 필요시 추가 옵션 설정:
    - **Params**: Query Parameters
    - **Headers**: HTTP 헤더
    - **Body**: Request Body (JSON)
4. "Send" 버튼 클릭

## 기술 구조

### 아키텍처

```
클라이언트 입력 → API 패널 → 서버 프록시 → 외부 API
                    ↓
              localStorage (도메인 저장)
                    ↓
              응답 표시
```

### 파일 구조

```
client/
├── api-panel.js       # API 패널 컴포넌트
├── main.js            # 통합 지점
└── index.html         # 스타일

server/
├── index.js           # 프록시 엔드포인트
└── api-proxy.js       # HTTP 요청 핸들러
```

## 서버 프록시

### 엔드포인트

`POST /api/proxy-request`

### 요청 형식

```json
{
    "method": "GET|POST|PUT|PATCH|DELETE",
    "url": "https://api.example.com/endpoint",
    "params": [{ "key": "param1", "value": "value1" }],
    "headers": [{ "key": "Authorization", "value": "Bearer token" }],
    "body": { "key": "value" }
}
```

### CORS 우회

브라우저의 CORS 제한을 서버 측 프록시로 우회하여 외부 API 호출을 가능하게 합니다.

## 도메인 관리

### 저장 위치

브라우저 localStorage (클라이언트 전용)

### 저장 형식

```javascript
// api-domains
[
    { name: 'Local', url: 'http://localhost:3000' },
    { name: 'Production', url: 'https://api.example.com' },
];

// api-selected-domain
('Local');
```

## 응답 처리

### 일반 응답

JSON 형식으로 파싱하여 표시

### SSE 스트리밍

`Content-Type: text/event-stream` 응답은 실시간 스트리밍으로 처리

## 보안

### 입력 검증

서버에서 모든 프록시 요청 검증:

```javascript
if (!method || !url) {
    return res.status(400).json({ error: 'Method and URL are required' });
}
```

### 타임아웃

30초 요청 타임아웃으로 hanging 연결 방지

## 테스트

### 테스트용 Public API

- GET: `https://jsonplaceholder.typicode.com/posts/1`
- POST: `https://jsonplaceholder.typicode.com/posts`

### 체크리스트

- [ ] GET 요청
- [ ] POST 요청 (JSON body)
- [ ] Query Parameters
- [ ] Custom Headers
- [ ] SSE 스트리밍
- [ ] 도메인 추가/삭제/선택
- [ ] 패널 표시/숨김
- [ ] 패널 크기 조절
- [ ] 테마 전환
- [ ] 에러 처리

## 향후 개선 사항

- 요청 히스토리/즐겨찾기
- 환경 변수 지원
- 요청 컬렉션
- 코드 생성 (curl, fetch, axios)
- 인증 프리셋 (Bearer, Basic, OAuth)
- WebSocket 지원
- GraphQL 쿼리 빌더
