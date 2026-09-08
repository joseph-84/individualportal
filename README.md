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
| 할일 · 일정 | 리스트/캘린더 뷰, 생성·완료·삭제, 마감일·반복 입력, 필터(오늘/이번 주/반복만) |
| 지식베이스 | 폴더/태그 기반 위키, 문서 생성·삭제, 실시간 검색, 마크다운 뷰어·에디터(툴바 포함) |
| 파일 브라우저 | `SYNC_FOLDER_PATH` 실제 서버 폴더 조회/업로드/다운로드/폴더 생성/**삭제/이름변경** |
| 자동화 스크립트 | 화이트리스트 등록·수정·삭제 UI, **cron 스케줄 자동 실행**, 활성/비활성 토글, 실행 로그 |
| 코드 에디터 | admin 전용, 스크립트 파일 직접 편집/저장 |
| 계정 관리 | 사용자 추가·**정보 수정**·**비밀번호 초기화**·활성/비활성 (마지막 관리자·본인 비활성화는 서버에서 차단) |
| 역할 · 권한 | 역할 생성, 역할×페이지 read/write 권한 매트릭스 편집 |
| 감사 로그 | 권한·계정·스크립트·파일 변경 이력 (admin 전용) |
| 내 계정 | 본인 비밀번호 변경, 다른 기기 전체 로그아웃 |

권한은 페이지 단위로 3단계(없음 / 읽기 / 읽기·쓰기)이며, 모든 서버 액션과 API 라우트에서 서버 측으로 재검증합니다(클라이언트에서 버튼을 숨기는 것과 별개로 실제 권한 체크가 들어갑니다). 헤더의 전역 검색(⌘K, 할일/위키/파일 통합)과 알림 벨(마감 지난 할일 · 24시간 내 실행 실패)도 실동작합니다.

### 로그인 보안

- 5회 연속 실패 시 10분간 계정 잠금
- 비밀번호는 bcrypt(cost 12) 해시로 저장
- 세션은 `tokenVersion`을 포함한 JWT — 비밀번호 변경이나 "다른 기기 모두 로그아웃" 시 기존 토큰이 즉시 무효화됨
- 2단계 인증(TOTP)은 미구현 — 필요하면 인증 앱 종류를 정해서 별도로 요청하세요

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
  actions/         서버 액션 (로그인, 계정, 할일, 위키, 스크립트, 사용자, 권한, 검색, 알림)
  api/files/       파일 브라우저용 REST 라우트 (list/read/upload/delete/rename)
  (portal)/        인증된 사용자만 접근하는 페이지들 (레이아웃에서 세션 확인)
components/        클라이언트 컴포넌트
lib/
  auth.ts          JWT 세션 발급/검증, 비밀번호 해시
  session.ts       현재 로그인 사용자 + 권한 조회 (tokenVersion 검증 포함)
  guard.ts         페이지/서버액션/API에서 쓰는 권한 체크 헬퍼
  files.ts         SYNC_FOLDER_PATH 안전 경로 처리 (list/read/write/delete/rename, 경로 탈출 방지)
  scripts-fs.ts    SCRIPTS_PATH 스크립트 파일 읽기/쓰기/생성/삭제
  run-script.ts    화이트리스트 스크립트 실행 공통 로직 (수동 실행·스케줄러 공용)
  cron.ts          5필드 cron 파서/매처, 한글 라벨 변환
  audit.ts         감사 로그 기록 헬퍼
prisma/
  schema.prisma    DB 스키마
  seed.ts          역할/권한/관리자 계정/데모 데이터 시드
instrumentation.ts 서버 시작 시 cron 스케줄러 기동 (30초 tick)
proxy.ts           인증 안 된 요청을 로그인 페이지로 리다이렉트 (Next.js의 middleware 후속 명칭)
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
