# Individual Portal

개인 업무·지식·반복 작업을 한 곳에서 관리하는 **단일 사용자용** 내부 포털입니다. 할일/캘린더, 위키형 노트(마크다운/HTML), 서버 폴더 파일 브라우저, 화이트리스트 기반 자동화 스크립트(cron 스케줄 포함) 실행, 이메일 OTP 기반 파일 공유, 감사 로그, MCP 연동을 제공합니다.

## 기술 스택

- **Next.js 16** (App Router, React 19, TypeScript)
- **PostgreSQL + Prisma 6** (ORM)
- 자체 인증: JWT 세션 쿠키(`jose`) + `bcryptjs` 비밀번호 해시 (NextAuth 등 외부 인증 라이브러리 미사용)
- `instrumentation.ts`의 in-process cron 스케줄러 — 별도 워커/큐 없이 앱 프로세스 안에서 30초마다 등록된 스크립트의 cron을 확인해 실행
- `nodemailer` (Gmail SMTP) — 파일 공유 OTP 이메일 발송
- `@modelcontextprotocol/sdk` — MCP 서버 (Streamable HTTP)
- `marked` + `sanitize-html` — 위키 마크다운/HTML 렌더링
- Docker / Docker Compose 배포

## 계정 모델

**단일 사용자 구조입니다.** 역할(role)·페이지별 권한·다중 계정 관리 개념이 없습니다 — 로그인에 성공하면 모든 기능에 전체 접근 권한을 갖습니다. 새 계정을 추가하는 UI도 없습니다(필요하면 `prisma/seed.ts` 또는 DB에서 직접 추가).

## 핵심 기능

| 페이지 | 설명 |
|---|---|
| 대시보드 | 미완료 할일, 최근 자동화 실행, 최근 노트, 최근 파일 변경 요약 |
| 할일 · 일정 | 계층 구조(하위 할일), 설명, 수정, 우선순위(높음/보통/낮음, 클릭으로 순환 변경), 리스트/캘린더 뷰, 필터 |
| 지식베이스 | 폴더/태그 기반 위키, 마크다운(.md) 또는 HTML(.html)로 문서 생성, 실시간 검색, 뷰어·에디터 |
| 파일 브라우저 | `SYNC_FOLDER_PATH` 실제 서버 폴더 조회/업로드/다운로드/폴더 생성/삭제/이름변경, 지식베이스 문서를 가상 폴더로 열람(읽기 전용), **파일 공유 링크 생성** |
| 자동화 스크립트 | 화이트리스트 등록·수정·삭제 UI, cron 스케줄 자동 실행, 활성/비활성 토글, 실행 로그 |
| 코드 에디터 | 스크립트 파일 직접 편집/저장 |
| 감사 로그 | 계정·스크립트·파일·공유 변경 이력 |
| 내 계정 | 비밀번호 변경, 다른 기기 전체 로그아웃, MCP 연동용 API 토큰 발급/취소 |

### 로그인 보안

- 5회 연속 실패 시 10분간 계정 잠금
- 비밀번호는 bcrypt(cost 12) 해시로 저장
- 세션은 `tokenVersion`을 포함한 JWT — 비밀번호 변경이나 "다른 기기 모두 로그아웃" 시 기존 토큰이 즉시 무효화됨

## 파일 공유

파일 브라우저에서 파일을 선택하고 **공유** 버튼을 누르면 두 가지 방식으로 링크를 만들 수 있습니다:

- **특정 이메일 (OTP 인증)** — 공유 시 지정한 이메일 주소로만 열람이 제한됩니다. 방문자가 링크를 열면 그 이메일로 6자리 인증 코드가 발송되고, 코드를 입력해야 파일을 볼 수 있습니다. 인증은 30분간 유지되며, 그 이후 다시 방문하면 새 코드가 필요합니다.
- **전체 공개** — 링크를 아는 누구나 로그인 없이 접근 가능합니다.

링크는 `/share/<토큰>`이며 소유자가 취소하기 전까지 유효합니다. 생성/취소는 감사 로그에 기록됩니다. 지식베이스 문서(가상 파일)는 공유할 수 없습니다.

**OTP 이메일 발송에는 Gmail SMTP 설정이 필요합니다** — `.env`의 `GMAIL_USER`/`GMAIL_APP_PASSWORD`를 설정하세요 (Google 계정 → 보안 → 2단계 인증 → 앱 비밀번호에서 발급). 설정하지 않으면 OTP 공유를 시도할 때 안내 오류가 표시됩니다(전체 공개 공유는 이 설정 없이도 동작).

## MCP 연동

외부 MCP 클라이언트(Claude Desktop 등)가 이 포털의 기능(할일/위키/파일/자동화/공유/감사로그)을 도구로 호출할 수 있습니다.

1. `/account` 페이지에서 API 토큰을 발급합니다 (토큰 값은 발급 시 한 번만 표시됨).
2. MCP 클라이언트에 엔드포인트 `https://<도메인>/mcp` (Streamable HTTP)와 헤더 `Authorization: Bearer <토큰>`을 설정합니다.
3. 단일 사용자 구조이므로 유효한 토큰이면 모든 도구에 전체 접근 권한을 갖습니다 (세션을 유지하지 않는 stateless 방식).

## 로컬 개발 환경 실행

```bash
# 1. 의존성 설치
npm install

# 2. 환경변수 설정
cp .env.example .env
# .env의 SESSION_SECRET을 openssl rand -base64 32 등으로 교체 권장
# 파일 공유 OTP를 쓰려면 GMAIL_USER/GMAIL_APP_PASSWORD도 설정

# 3. PostgreSQL 기동 (docker compose가 db 서비스만 띄움)
docker compose up -d db

# 4. 스키마 마이그레이션 + 초기 데이터 시드
npm run prisma:migrate
npm run prisma:seed

# 5. 개발 서버 실행
npm run dev
```

`http://localhost:3000`(또는 지정한 포트)에서 접속. 시드 시 생성되는 계정은 `.env`의 `ADMIN_EMAIL` / `ADMIN_PASSWORD`(기본값 `admin@example.com` / `ChangeMe123!`)입니다. **로그인 후 사이드바의 계정 영역 → 내 계정에서 반드시 비밀번호를 바꾸세요.**

## 환경변수

| 변수 | 설명 |
|---|---|
| `DATABASE_URL` | PostgreSQL 연결 문자열 |
| `SESSION_SECRET` | 세션 JWT 서명 키. 반드시 무작위 값으로 교체 |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | 시드 시 생성되는 계정 (upsert이므로 재시드해도 안전) |
| `SYNC_FOLDER_PATH` | 파일 브라우저가 노출할 실제 폴더 경로 |
| `SCRIPTS_PATH` | 화이트리스트 자동화 스크립트가 위치한 폴더 경로 |
| `GMAIL_USER` / `GMAIL_APP_PASSWORD` | 파일 공유 OTP 이메일 발송용 Gmail SMTP 계정 |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | `docker-compose.yml`의 db 서비스 계정 (docker 배포 시에만 사용) |

## Docker로 배포하기

```bash
cp .env.example .env   # 값 채운 뒤
docker compose up -d
```

- `app` 컨테이너는 시작할 때 `docker-entrypoint.sh`가 **자동으로** `prisma migrate deploy` → 시드(upsert라 여러 번 실행해도 안전) → 서버 기동 순으로 처리합니다.
- 서버 프로세스 자체가 cron 스케줄러를 포함하므로, 컨테이너가 떠 있는 동안 등록된 스크립트가 설정한 일정대로 자동 실행됩니다.
- 호스트의 실제 폴더를 연결하려면 `HOST_SYNC_FOLDER`, `HOST_SCRIPTS_FOLDER` 환경변수로 경로를 지정하세요.
- 컨테이너 이름은 `individualportal`로 고정되어 있고, nginx proxy manager가 있는 `docker_default` 네트워크에도 자동으로 연결됩니다(리버스 프록시가 컨테이너 이름으로 접근하는 구성이라면 그대로 맞습니다 — 다른 구성이면 `docker-compose.yml`의 `networks`/`container_name`을 환경에 맞게 조정하세요).
- 코드를 바꾼 뒤에는 `docker compose build app && docker compose up -d`로 재배포하세요.

## 자동화 스크립트 추가하기

`자동화 스크립트` 페이지의 **+ 스크립트 등록** 버튼에서 파일명 · 설명 · cron 표현식(분 시 일 월 요일, 예: `0 9 * * *`)을 입력하면 됩니다. "서버에 새 파일 생성"을 체크하면 `SCRIPTS_PATH`에 기본 템플릿 파일이 자동 생성되고, 곧바로 `코드 에디터`에서 내용을 채울 수 있습니다.

## 프로젝트 구조

```
app/
  actions/         서버 액션 (로그인, 계정, 할일, 위키, 스크립트, 검색, 알림, 공유, 토큰)
  api/files/       파일 브라우저용 REST 라우트 (list/read/upload/delete/rename, 지식베이스 가상 폴더 포함)
  mcp/route.ts     MCP 서버 엔드포인트 (Streamable HTTP, API 토큰 인증)
  share/[token]/   공개/OTP 파일 공유 페이지 + raw 서빙 라우트
  (portal)/        인증된 사용자만 접근하는 페이지들
components/        클라이언트 컴포넌트
lib/
  auth.ts          JWT 세션 발급/검증, 비밀번호 해시
  api-auth.ts      MCP용 API 토큰 발급/검증
  session.ts       현재 로그인 사용자 조회 (tokenVersion 검증 포함)
  guard.ts         로그인 여부 확인 헬퍼 (단일 사용자라 페이지별 권한 체크는 없음)
  files.ts         SYNC_FOLDER_PATH 안전 경로 처리, 경로 탈출 방지
  kb-files.ts      지식베이스 문서를 파일 브라우저 가상 폴더(`__kb__/...`)로 노출
  share.ts / share-otp-auth.ts / mailer.ts   공유 링크 토큰, OTP 인증 쿠키, Gmail 발송
  scripts-fs.ts    SCRIPTS_PATH 스크립트 파일 읽기/쓰기/생성/삭제
  run-script.ts    화이트리스트 스크립트 실행 공통 로직
  cron.ts          5필드 cron 파서/매처, 한글 라벨 변환
  audit.ts         감사 로그 기록 헬퍼
  markdown.ts      마크다운/HTML 노트 렌더링 + sanitize
  mcp/build-server.ts  MCP 툴 25개 등록
prisma/
  schema.prisma    DB 스키마
  seed.ts          계정/데모 데이터 시드
instrumentation.ts 서버 시작 시 cron 스케줄러 기동 (30초 tick)
proxy.ts           인증 안 된 요청을 로그인 페이지로 리다이렉트. /api, /mcp, /share는 자체 인증을 쓰므로 통과시킴. 리버스 프록시 뒤에서 X-Forwarded-Proto/Host를 신뢰해 리다이렉트 URL을 만듦
```

## 알려진 제한 사항 / 다음 단계

- **2단계 인증(TOTP)**, **에러 모니터링(Sentry 등)**, **자동 DB 백업**은 미구현입니다. 필요하면 관련 정보(인증 앱 종류, Sentry DSN, 백업 저장 위치 등)를 알려주면 추가할 수 있습니다.
- 모바일 실기기 테스트, 자동화 테스트(단위/E2E)는 아직 없습니다.
- 스크립트 실행은 동기 방식(최대 30초 타임아웃)이라 오래 걸리는 작업에는 적합하지 않습니다.
- 세션은 무상태 JWT라 "모든 기기 로그아웃"(tokenVersion 증가)만 가능하고, 기기별 개별 로그아웃은 지원하지 않습니다.
- 공유 OTP는 시간당 5회로 재발송을 제한합니다. 코드는 10분간 유효하며, 인증 성공 시 30분간 재인증 없이 열람 가능합니다.
