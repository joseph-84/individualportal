# Individual Portal

개인 업무·지식·반복 작업을 한 곳에서 관리하는 내부 포털입니다. 할일/캘린더, 위키형 노트, 서버 폴더 파일 브라우저, 화이트리스트 기반 자동화 스크립트(cron 스케줄 포함) 실행, 계정/역할별 페이지 권한 관리, 감사 로그를 제공합니다.

## 기술 스택

- **Next.js 16** (App Router, React 19, TypeScript)
- **PostgreSQL + Prisma 6** (ORM)
- 자체 인증: JWT 세션 쿠키(`jose`) + `bcryptjs` 비밀번호 해시 (NextAuth 등 외부 인증 라이브러리 미사용)
- `instrumentation.ts`의 in-process cron 스케줄러 — 별도 워커/큐 없이 앱 프로세스 안에서 30초마다 등록된 스크립트의 cron을 확인해 실행
- `marked` + `sanitize-html` — 위키 마크다운 렌더링
- Docker / Docker Compose 배포

## 핵심 기능

| 페이지 | 설명 |
|---|---|
| 대시보드 | 미완료 할일, 최근 자동화 실행, 최근 노트, 최근 파일 변경 요약 |
| 할일 · 일정 | **계층 구조**(하위 할일), **설명**, **수정**, **우선순위**(높음/보통/낮음, 클릭으로 순환 변경), 리스트/캘린더 뷰, 필터(오늘/이번 주/반복만) |
| 지식베이스 | 폴더/태그 기반 위키, **마크다운(.md) 또는 HTML(.html) 형식으로 생성**, 문서 생성·삭제, 실시간 검색, 뷰어·에디터(형식별 툴바) |
| 파일 브라우저 | `SYNC_FOLDER_PATH` 실제 서버 폴더 조회/업로드/다운로드/폴더 생성/삭제/이름변경, **지식베이스 문서를 가상 폴더로 열람(읽기 전용, 편집은 위키에서)**, **파일 공유 링크 생성(회원 대상 / 전체 공개)** |
| 자동화 스크립트 | 화이트리스트 등록·수정·삭제 UI, cron 스케줄 자동 실행, 활성/비활성 토글, 실행 로그 |
| 코드 에디터 | admin 전용, 스크립트 파일 직접 편집/저장 |
| 계정 관리 | 사용자 추가·정보 수정·비밀번호 초기화·활성/비활성 (마지막 관리자·본인 비활성화는 서버에서 차단) |
| 역할 · 권한 | 역할 생성, 역할×페이지 read/write 권한 매트릭스 편집 |
| 감사 로그 | 권한·계정·스크립트·파일·공유 변경 이력 (admin 전용) |
| 내 계정 | 본인 비밀번호 변경, 다른 기기 전체 로그아웃, **MCP 연동용 API 토큰 발급/취소** |

권한은 페이지 단위로 3단계(없음 / 읽기 / 읽기·쓰기)이며, 모든 서버 액션과 API 라우트에서 서버 측으로 재검증합니다(클라이언트에서 버튼을 숨기는 것과 별개로 실제 권한 체크가 들어갑니다). 헤더의 전역 검색(⌘K, 할일/위키/파일 통합)과 알림 벨(마감 지난 할일 · 24시간 내 실행 실패)도 실동작합니다.

### 로그인 보안

- 5회 연속 실패 시 10분간 계정 잠금
- 비밀번호는 bcrypt(cost 12) 해시로 저장
- 세션은 `tokenVersion`을 포함한 JWT — 비밀번호 변경이나 "다른 기기 모두 로그아웃" 시 기존 토큰이 즉시 무효화됨
- 2단계 인증(TOTP)은 미구현 — 필요하면 인증 앱 종류를 정해서 별도로 요청하세요

## MCP 연동

외부 MCP 클라이언트(Claude Desktop 등)가 이 포털의 모든 기능(할일/위키/파일/자동화/계정/역할/감사로그)을 도구로 호출할 수 있습니다.

1. `/account` 페이지에서 API 토큰을 발급합니다 (토큰 값은 발급 시 한 번만 표시됨).
2. MCP 클라이언트에 엔드포인트 `https://<도메인>/mcp` (Streamable HTTP)와 헤더 `Authorization: Bearer <토큰>`을 설정합니다.
3. 도구 호출은 **그 토큰을 발급한 사용자의 실제 역할 권한**으로 그대로 검증됩니다 — 웹 UI에서 접근 못 하는 페이지는 MCP로도 접근할 수 없습니다. 예를 들어 `staff` 역할 토큰으로 `list_users`를 호출하면 거부됩니다.
4. 세션을 유지하지 않는 stateless 방식이라 토큰만 있으면 별도 로그인 절차 없이 바로 호출 가능합니다.

## 파일 공유

파일 브라우저에서 파일을 선택하고 **공유** 버튼을 누르면:
- **회원 대상**: 포털에 로그인한 사용자만 링크로 접근 가능 (해당 파일에 대한 files 권한은 필요 없음 — 공유받은 링크만 있으면 됨)
- **전체 공개**: 링크를 아는 누구나 로그인 없이 접근 가능

링크는 `/share/<토큰>`이며 파일 소유자가 취소하기 전까지 유효합니다. 공유 생성/취소는 감사 로그에 기록됩니다. 지식베이스 문서(가상 파일)는 공유할 수 없습니다 — 위키 자체를 공유하려면 문서를 실제 폴더로 내보내는 기능이 필요한데, 아직 없습니다.

## 로컬 개발 환경 실행

```bash
# 1. 의존성 설치
npm install

# 2. 환경변수 설정
cp .env.example .env
# .env의 SESSION_SECRET을 openssl rand -base64 32 등으로 교체 권장

# 3. PostgreSQL 기동 (docker compose가 db 서비스만 띄움)
docker compose up -d db

# 4. 스키마 마이그레이션 + 초기 데이터 시드
npm run prisma:migrate
npm run prisma:seed

# 5. 개발 서버 실행
npm run dev
```

`http://localhost:3000`(또는 지정한 포트)에서 접속. 시드 시 생성되는 관리자 계정은 `.env`의 `ADMIN_EMAIL` / `ADMIN_PASSWORD`(기본값 `admin@example.com` / `ChangeMe123!`)입니다. **로그인 후 사이드바의 계정 영역 → 내 계정에서 반드시 비밀번호를 바꾸세요.**

## 환경변수

| 변수 | 설명 |
|---|---|
| `DATABASE_URL` | PostgreSQL 연결 문자열 |
| `SESSION_SECRET` | 세션 JWT 서명 키. 반드시 무작위 값으로 교체 |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | 시드 시 생성되는 최초 관리자 계정 (upsert이므로 재시드해도 안전) |
| `SYNC_FOLDER_PATH` | 파일 브라우저가 노출할 실제 폴더 경로 |
| `SCRIPTS_PATH` | 화이트리스트 자동화 스크립트가 위치한 폴더 경로 |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | `docker-compose.yml`의 db 서비스 계정 (docker 배포 시에만 사용) |

## Docker로 배포하기

```bash
cp .env.example .env   # 값 채운 뒤
docker compose up -d
```

- `app` 컨테이너는 시작할 때 `docker-entrypoint.sh`가 **자동으로** `prisma migrate deploy` → 시드(upsert라 여러 번 실행해도 안전) → 서버 기동 순으로 처리합니다. 별도 수동 작업이 필요 없습니다.
- 서버 프로세스 자체가 cron 스케줄러를 포함하므로, 컨테이너가 떠 있는 동안 등록된 스크립트가 설정한 일정대로 자동 실행됩니다. 컨테이너가 재시작되는 동안에는 스케줄이 돌지 않습니다(놓친 실행을 나중에 보정하지 않음).
- 호스트의 실제 폴더를 연결하려면 `HOST_SYNC_FOLDER`, `HOST_SCRIPTS_FOLDER` 환경변수로 경로를 지정하세요 (미지정 시 프로젝트 내 `./data-mount`, `./data-scripts` 사용).
  ```bash
  HOST_SYNC_FOLDER=/srv/data HOST_SCRIPTS_FOLDER=/opt/scripts docker compose up -d
  ```
- 앱은 `127.0.0.1:3411`에 바인딩됩니다. nginx proxy manager 등 리버스 프록시에서 이 포트로 연결하세요.
- 자동화 스크립트 실행을 위해 이미지에 `python3`, `bash`가 설치되어 있습니다. 다른 런타임(Node 스크립트 등)이 필요하면 `Dockerfile`의 `apk add` 라인에 추가하세요.
- 코드를 바꾼 뒤에는 `docker compose build app && docker compose up -d --force-recreate app`으로 재배포하세요.

## 자동화 스크립트 추가하기

`자동화 스크립트` 페이지의 **+ 스크립트 등록** 버튼에서 파일명 · 설명 · cron 표현식(분 시 일 월 요일, 예: `0 9 * * *`)을 입력하면 됩니다. "서버에 새 파일 생성"을 체크하면 `SCRIPTS_PATH`에 기본 템플릿 파일이 자동 생성되고, 곧바로 `코드 에디터`에서 내용을 채울 수 있습니다. cron을 비워두면 수동 실행 버튼으로만 실행됩니다. 스케줄 수정은 목록의 스케줄 칸을, 삭제/비활성화는 관리 칸의 버튼을 사용하세요.

## 프로젝트 구조

```
app/
  actions/         서버 액션 (로그인, 계정, 할일, 위키, 스크립트, 사용자, 권한, 검색, 알림, 공유, 토큰)
  api/files/       파일 브라우저용 REST 라우트 (list/read/upload/delete/rename, 지식베이스 가상 폴더 포함)
  mcp/route.ts     MCP 서버 엔드포인트 (Streamable HTTP, API 토큰 인증)
  share/[token]/   공개/회원 대상 파일 공유 링크 서빙 라우트
  (portal)/        인증된 사용자만 접근하는 페이지들 (레이아웃에서 세션 확인)
components/        클라이언트 컴포넌트
lib/
  auth.ts          JWT 세션 발급/검증, 비밀번호 해시
  api-auth.ts      MCP용 API 토큰 발급/검증 (Bearer 토큰 → CurrentUser, 쿠키 세션과 동일한 권한 모델)
  session.ts       현재 로그인 사용자 + 권한 조회 (tokenVersion 검증 포함)
  guard.ts         페이지/서버액션/API에서 쓰는 권한 체크 헬퍼
  files.ts         SYNC_FOLDER_PATH 안전 경로 처리 (list/read/write/delete/rename, 경로 탈출 방지)
  kb-files.ts      지식베이스 문서를 파일 브라우저 가상 폴더(`__kb__/...`)로 노출
  share.ts         공유 링크 토큰 생성
  scripts-fs.ts    SCRIPTS_PATH 스크립트 파일 읽기/쓰기/생성/삭제
  run-script.ts    화이트리스트 스크립트 실행 공통 로직 (수동 실행·스케줄러·MCP 공용)
  cron.ts          5필드 cron 파서/매처, 한글 라벨 변환
  audit.ts         감사 로그 기록 헬퍼
  markdown.ts      마크다운/HTML 노트 렌더링 + sanitize
  mcp/build-server.ts  MCP 툴 33개 등록 (요청마다 호출자 권한으로 새로 빌드되는 stateless 서버)
prisma/
  schema.prisma    DB 스키마
  seed.ts          역할/권한/관리자 계정/데모 데이터 시드
instrumentation.ts 서버 시작 시 cron 스케줄러 기동 (30초 tick)
proxy.ts           인증 안 된 요청을 로그인 페이지로 리다이렉트 (Next.js의 middleware 후속 명칭). /api, /mcp, /share는 자체 인증을 쓰므로 통과시킴
```

## 알려진 제한 사항 / 다음 단계

외부 서비스 자격 정보가 없어 이번 범위에서 제외한 것들입니다:

- **이메일/Slack 알림**: 자동화 실패, 마감 임박 등을 외부로 알리려면 SMTP 또는 Slack Webhook 정보가 필요합니다. 현재는 포털 안 알림 벨로만 확인 가능합니다.
- **2단계 인증(TOTP)**: 인증 앱 종류를 정하면 별도로 구현 가능합니다.
- **에러 모니터링(Sentry 등)**: DSN 발급 후 연동 가능합니다.
- **자동 DB 백업**: 백업 저장 위치(S3, NAS 등)를 정하면 cron 스크립트로 추가할 수 있습니다.
- **모바일 실기기 테스트**: 반응형 레이아웃은 되어 있으나 실기기 검증은 못 했습니다.
- **자동화 테스트(단위/E2E)**: 아직 없습니다.

그 외 알아두면 좋은 점:

- 스크립트 실행은 동기 방식(최대 30초 타임아웃)이라 오래 걸리는 작업에는 적합하지 않습니다 — 장시간 배치가 필요하면 큐/워커 구조로 확장이 필요합니다.
- 세션은 무상태 JWT라 "현재 로그인된 기기 목록"처럼 세션별 개별 조회/해제는 지원하지 않고, "모든 기기 로그아웃"(tokenVersion 증가)만 가능합니다.
- 리버스 프록시(nginx proxy manager 등) 뒤에서 리다이렉트를 만들 때 `X-Forwarded-Proto`/`X-Forwarded-Host` 헤더를 신뢰합니다. 다른 프록시를 쓴다면 이 헤더들을 반드시 전달하도록 설정하세요 — 안 그러면 로그인 리다이렉트 루프가 발생할 수 있습니다.
- 지식베이스 문서는 파일 브라우저에서 읽기 전용으로만 보이고, 실제 폴더로 내보내기(export)는 지원하지 않습니다.
- MCP 도구는 파일 첨부/바이너리 업로드를 지원하지 않습니다 (텍스트 파일 읽기/쓰기만 가능) — 이미지 등 바이너리 업로드는 웹 UI를 사용하세요.
