# Individual Portal

개인 업무·지식·반복 작업을 한 곳에서 관리하는 **단일 사용자용** 내부 포털입니다. 할일/캘린더, 위키형 노트(마크다운/HTML), 서버 폴더 파일 브라우저, 화이트리스트 기반 자동화 스크립트(cron 스케줄 포함) 실행, 이메일 OTP 기반 파일 공유, 감사 로그, Google Calendar 등 외부 서비스 연동, MCP 연동을 제공합니다.

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
| 할일 · 일정 | 계층 구조(하위 할일), 설명, 수정, **드래그 앤 드롭으로 순서 변경**(같은 상위 할일 내에서 자유롭게 재배치), 리스트/캘린더 뷰, 필터, 연동된 Google Calendar 일정 표시(읽기 전용) |
| 지식베이스 | 폴더/태그 기반 위키, 마크다운(.md) 또는 HTML(.html)로 문서 생성, 실시간 검색, 뷰어·에디터 |
| 파일 브라우저 | `SYNC_FOLDER_PATH` 실제 서버 폴더를 **파일탐색기 스타일 트리**로 조회(하위 폴더 지연 로딩)/업로드/다운로드/폴더 생성/삭제/이름변경, 지식베이스 문서를 가상 폴더로 열람(읽기 전용), 파일 선택 시 목록이 좌측으로 축소되며 **대형 미리보기** 표시 + **새 창에서 보기**(.md/.html은 위키 뷰어와 동일하게 렌더링된 문서로 표시), **파일 공유 링크 생성** |
| 즐겨찾기 | 자주 쓰는 문서·URL을 폴더로 묶어 저장, 클릭 시 항상 **새 창**으로 열림 |
| 자동화 스크립트 | 화이트리스트 등록·수정·삭제 UI, cron 스케줄 자동 실행, 활성/비활성 토글, 실행 로그 |
| 코드 에디터 | 스크립트 파일 직접 편집/저장 |
| 감사 로그 | 계정·스크립트·파일·공유·연동·즐겨찾기 변경 이력 |
| 설정 | 외부 서비스 연동 관리 (Google Calendar 연결/해제, 향후 다른 플랫폼 추가 예정) |
| 내 계정 | 비밀번호 변경, 다른 기기 전체 로그아웃, MCP 연동용 API 토큰 발급/취소 |

### 로그인 보안

- 5회 연속 실패 시 10분간 계정 잠금
- 비밀번호는 bcrypt(cost 12) 해시로 저장
- 세션은 `tokenVersion`을 포함한 JWT — 비밀번호 변경이나 "다른 기기 모두 로그아웃" 시 기존 토큰이 즉시 무효화됨

## 파일 공유

파일 브라우저에서 파일을 선택하고 **공유** 버튼을 누르면 두 가지 방식으로 링크를 만들 수 있습니다:

- **특정 이메일 (OTP 인증)** — 공유 시 지정한 이메일 주소로만 열람이 제한됩니다. 방문자가 링크를 열면 그 이메일로 6자리 인증 코드가 발송되고, 코드를 입력해야 파일을 볼 수 있습니다. 인증은 30분간 유지되며, 그 이후 다시 방문하면 새 코드가 필요합니다.
- **전체 공개** — 링크를 아는 누구나 로그인 없이 접근 가능합니다.

링크는 `/share/<토큰>`이며 소유자가 취소하기 전까지 유효합니다. 생성/취소는 감사 로그에 기록됩니다. 지식베이스 문서(가상 파일)도 동일하게 공유할 수 있습니다.

**OTP 이메일 발송에는 Gmail SMTP 설정이 필요합니다** — `.env`의 `GMAIL_USER`/`GMAIL_APP_PASSWORD`를 설정하세요 (Google 계정 → 보안 → 2단계 인증 → 앱 비밀번호에서 발급). 설정하지 않으면 OTP 공유를 시도할 때 안내 오류가 표시됩니다(전체 공개 공유는 이 설정 없이도 동작).

## 즐겨찾기

자주 찾는 문서나 URL을 제목·주소·폴더로 저장해두는 북마크 목록입니다(`/favorites`). 폴더별로 묶여 표시되며, 검색으로 빠르게 찾을 수 있습니다. 항목을 클릭하면 항상 **새 창(탭)**으로 열립니다 — 포털 화면을 벗어나지 않고 참고 링크를 열어볼 수 있습니다. URL에 `http://`/`https://` 등 스킴을 생략하면(`example.com`처럼 입력) 자동으로 `https://`를 붙입니다. 외부 URL뿐 아니라 포털 내부 경로(예: `/wiki?id=...`, `/files/view?path=...`)도 그대로 등록할 수 있습니다.

## 설정 / 외부 연동

사이드바 하단의 ⚙ 아이콘(`/settings`)에서 외부 서비스 연동을 관리합니다. 첫 연동 대상은 **Google Calendar**(읽기 전용 가져오기)이며, 이후 다른 플랫폼도 같은 방식으로 이 페이지에 추가할 수 있는 구조입니다.

### Google Calendar 연동 (읽기 전용)

포털이 각 사용자 대신 Google Calendar를 읽을 수 있도록 **OAuth 2.0 클라이언트 ID**를 직접 발급받아야 합니다. Google 계정은 여러 개 만들 수 있는 무료 개인 프로젝트 기준 설정입니다.

1. [Google Cloud Console](https://console.cloud.google.com/)에서 새 프로젝트를 만듭니다 (또는 기존 프로젝트 사용).
2. **APIs & Services → Library**에서 `Google Calendar API`를 검색해 사용 설정(Enable)합니다.
3. **APIs & Services → OAuth consent screen**에서 동의 화면을 구성합니다.
   - User Type: **External** 선택 (개인 Gmail 계정이라면 Internal 옵션이 없습니다) → 앱 이름/이메일 등 필수 항목만 입력하고 저장.
   - Scopes 단계는 건너뛰어도 됩니다 (실제 요청 scope는 코드에서 지정).
   - Test users 단계에서 **본인의 Gmail 주소를 추가**하세요 — 앱을 "게시(Publish)"하지 않고 테스트 모드로 두면, 등록된 테스트 사용자만 로그인할 수 있습니다. 개인 용도라면 게시하지 않고 이 상태로 계속 사용해도 됩니다.
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID**를 선택합니다.
   - Application type: **Web application**
   - Authorized redirect URIs에 다음을 정확히 추가합니다:
     - `https://<실제 배포 도메인>/api/integrations/google/callback` (예: `https://portal.joseph84.freeddns.org/api/integrations/google/callback`)
     - 로컬 개발도 함께 쓰려면 `http://localhost:3000/api/integrations/google/callback`도 추가
   - 생성 후 발급되는 **클라이언트 ID**와 **클라이언트 보안 비밀(Client secret)**을 복사합니다.
5. `.env`에 다음을 채웁니다:
   ```
   GOOGLE_CLIENT_ID="<클라이언트 ID>"
   GOOGLE_CLIENT_SECRET="<클라이언트 보안 비밀>"
   ```
6. 서버를 재시작(또는 재배포)한 뒤 `/settings` 페이지에서 **Google 계정 연결**을 누르면 동의 화면으로 이동하고, 승인하면 연동이 완료됩니다.

연동되면 `할일 · 일정` 페이지의 캘린더 뷰에 해당 월의 Google Calendar 기본(primary) 캘린더 일정이 함께 표시됩니다(📅 아이콘, 클릭 시 Google Calendar에서 새 창으로 열림). 포털에서 이 일정을 만들거나 수정·삭제할 수는 없습니다 — 읽기 전용 가져오기입니다. 액세스 토큰은 만료 시 저장된 refresh token으로 자동 갱신되며, `/settings`에서 언제든 연동을 해제할 수 있습니다(해제 시 저장된 토큰은 즉시 삭제됩니다).

`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`을 설정하지 않으면 연동 버튼을 눌러도 안내 오류만 표시되고, 다른 기능에는 영향이 없습니다.

## MCP 연동

외부 MCP 클라이언트(Claude Desktop, Claude Code 등)가 이 포털의 기능을 도구로 직접 호출할 수 있습니다. 새 도구를 추가해도 별도 배포 설정 변경은 필요 없습니다 — `lib/mcp/build-server.ts`에 `server.registerTool(...)`만 추가하면 됩니다.

### 연결 방법

1. `/account` 페이지의 **API 토큰** 섹션에서 토큰을 발급합니다 (이름만 붙이면 되고, 토큰 값은 발급 시 한 번만 표시되니 바로 복사해두세요).
2. MCP 클라이언트에 다음을 설정합니다:
   - **엔드포인트**: `https://<도메인>/mcp` (Streamable HTTP 전송)
   - **헤더**: `Authorization: Bearer <발급받은 토큰>`
3. 세션을 유지하지 않는 stateless 방식이라, 요청마다 토큰을 새로 검증합니다 — 별도 로그인 절차 없이 토큰만 유효하면 바로 호출됩니다. 단일 사용자 구조이므로 토큰이 유효하면 아래 도구 전부에 접근할 수 있습니다.
4. 토큰을 더 이상 쓰지 않으면 `/account`에서 **취소**하세요 (사용 이력은 감사 로그에 `via: "mcp"`로 남는 액션들로 확인 가능).

### 제공 도구 (30개)

| 분류 | 도구 | 설명 |
|---|---|---|
| 할일 | `list_todos` | 할일 목록 조회 (완료 여부/상위 할일 ID로 필터) |
| | `create_todo` | 할일 생성 (하위 할일은 `parentId` 지정) |
| | `update_todo` | 제목·설명·프로젝트·태그·반복·마감일·완료 여부 수정 |
| | `reorder_todo` | 표시 순서 변경 (같은 상위 할일 그룹 내에서 `beforeId`/`afterId` 사이로 이동) |
| | `delete_todo` | 삭제 (하위 할일도 함께 삭제) |
| 위키 | `list_notes` | 문서 목록 조회 (폴더로 필터) |
| | `get_note` | 문서 전체 내용 조회 |
| | `create_note` | 문서 생성 (`format`: `md` 또는 `html`) |
| | `update_note` | 문서 내용 수정 |
| | `delete_note` | 문서 삭제 |
| 파일 | `list_files` | `SYNC_FOLDER_PATH` 폴더 내용 나열 |
| | `read_file` | 텍스트 파일 읽기 (최대 200KB, 바이너리 미지원) |
| | `write_file` | 텍스트 파일 생성/덮어쓰기 |
| | `delete_file` | 파일/폴더 삭제 |
| | `rename_file` | 이름 변경/이동 |
| | `mkdir` | 폴더 생성 |
| 공유 | `create_share_link` | 공유 링크 생성 (`scope`: `public` 또는 `email_otp` + `email`) |
| | `list_share_links` | 특정 파일의 활성 공유 링크 조회 |
| | `revoke_share_link` | 공유 링크 취소 |
| 자동화 | `list_scripts` | 등록된 화이트리스트 스크립트 + 최근 실행 상태 |
| | `run_script` | 스크립트 실행 |
| | `get_run_logs` | 실행 로그 조회 (스크립트/개수로 필터) |
| 코드 에디터 | `read_script_file` | 스크립트 소스 읽기 |
| | `write_script_file` | 스크립트 소스 저장 |
| | `list_script_files` | `SCRIPTS_PATH`의 파일 목록 |
| 즐겨찾기 | `list_favorites` | 즐겨찾기 목록 조회 (폴더로 필터) |
| | `create_favorite` | 즐겨찾기 추가 |
| | `update_favorite` | 제목·URL·폴더 수정 |
| | `delete_favorite` | 즐겨찾기 삭제 |
| 감사 로그 | `list_audit_log` | 계정·스크립트·파일·공유 변경 이력 조회 |

각 도구는 웹 UI가 호출하는 것과 동일한 `lib/` 함수(파일 경로 안전 검사, 화이트리스트 스크립트 검증, 감사 로그 기록 등)를 그대로 거치므로 동작·안전장치가 웹과 동일합니다. 지식베이스 문서는 파일 도구가 아니라 `list_notes`/`get_note`/`create_note`/`update_note`/`delete_note`로 다루세요 (파일 브라우저의 가상 폴더는 읽기 전용 뷰일 뿐입니다). 계정 추가나 접근 권한을 다루는 도구는 없습니다 — 단일 사용자 구조라 그런 개념 자체가 없습니다.

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
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google Calendar 읽기 전용 연동용 OAuth 2.0 클라이언트 (설정 방법은 [설정 / 외부 연동](#설정--외부-연동) 참고) |
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
  api/files/       파일 브라우저용 REST 라우트 (list/read/upload/delete/rename, 지식베이스 가상 폴더 포함, 미리보기는 항상 원본 바이트로 응답)
  api/integrations/google/  Google Calendar OAuth 시작/콜백/연동 해제 라우트
  mcp/route.ts     MCP 서버 엔드포인트 (Streamable HTTP, API 토큰 인증)
  share/[token]/   공개/OTP 파일 공유 페이지 + raw 서빙 라우트
  (portal)/        인증된 사용자만 접근하는 페이지들 (settings 포함)
components/        클라이언트 컴포넌트
lib/
  auth.ts          JWT 세션 발급/검증, 비밀번호 해시
  api-auth.ts      MCP용 API 토큰 발급/검증
  session.ts       현재 로그인 사용자 조회 (tokenVersion 검증 포함)
  guard.ts         로그인 여부 확인 헬퍼 (단일 사용자라 페이지별 권한 체크는 없음)
  files.ts         SYNC_FOLDER_PATH 안전 경로 처리, 경로 탈출 방지
  kb-files.ts      지식베이스 문서를 파일 브라우저 가상 폴더(`__kb__/...`)로 노출
  share.ts / share-otp-auth.ts / mailer.ts   공유 링크 토큰, OTP 인증 쿠키, Gmail 발송
  google-calendar.ts  Google OAuth 토큰 교환/갱신, 캘린더 이벤트 조회 (읽기 전용)
  scripts-fs.ts    SCRIPTS_PATH 스크립트 파일 읽기/쓰기/생성/삭제
  run-script.ts    화이트리스트 스크립트 실행 공통 로직
  cron.ts          5필드 cron 파서/매처, 한글 라벨 변환
  audit.ts         감사 로그 기록 헬퍼
  markdown.ts      마크다운/HTML 노트 렌더링 + sanitize
  mcp/build-server.ts  MCP 툴 30개 등록
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
- Google Calendar 연동은 기본(primary) 캘린더 하나만 읽어오며, 포털에서 만든 할일을 Google Calendar 쪽으로 내보내는 기능(양방향 동기화)은 없습니다.
