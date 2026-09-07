# Individual Portal

개인 업무·지식·반복 작업을 한 곳에서 관리하는 내부 포털입니다. 할일/캘린더, 위키형 노트, 서버 폴더 파일 브라우저, 화이트리스트 기반 자동화 스크립트 실행, 계정/역할별 페이지 권한 관리를 제공합니다.

## 기술 스택

- **Next.js 16** (App Router, React 19, TypeScript)
- **PostgreSQL + Prisma 6** (ORM)
- 자체 인증: JWT 세션 쿠키(`jose`) + `bcryptjs` 비밀번호 해시 (NextAuth 등 외부 인증 라이브러리 미사용)
- `marked` + `sanitize-html` — 위키 마크다운 렌더링
- Docker / Docker Compose 배포

## 핵심 기능

| 페이지 | 설명 |
|---|---|
| 대시보드 | 오늘의 할일, 최근 자동화 실행, 최근 노트, 최근 파일 변경 요약 |
| 할일 · 일정 | 리스트/캘린더 뷰, 생성·완료 토글 |
| 지식베이스 | 폴더/태그 기반 위키, 마크다운 뷰어·에디터 |
| 파일 브라우저 | `SYNC_FOLDER_PATH`로 지정한 실제 서버 폴더를 조회/업로드/다운로드/폴더 생성 |
| 자동화 스크립트 | `SCRIPTS_PATH`에 등록된 화이트리스트 스크립트만 실행, 실행 로그 DB 저장 |
| 코드 에디터 | admin 전용, 스크립트 파일 직접 편집/저장 |
| 계정 관리 | 사용자 추가, 활성/비활성 전환 |
| 역할 · 권한 | 역할 생성, 역할×페이지 read/write 권한 매트릭스 편집 |

권한은 페이지 단위로 3단계(없음 / 읽기 / 읽기·쓰기)이며, 모든 서버 액션과 API 라우트에서 서버 측으로 재검증합니다(클라이언트에서 버튼을 숨기는 것과 별개로 실제 권한 체크가 들어갑니다).

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

`http://localhost:3000`(또는 지정한 포트)에서 접속. 시드 시 생성되는 관리자 계정은 `.env`의 `ADMIN_EMAIL` / `ADMIN_PASSWORD`(기본값 `admin@example.com` / `ChangeMe123!`)입니다. **로그인 후 반드시 비밀번호를 바꾸세요** — 별도 비밀번호 변경 UI는 아직 없어 `npm run prisma:seed`를 `ADMIN_PASSWORD`를 바꿔 재실행하거나 DB를 직접 갱신해야 합니다.

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
- 호스트의 실제 폴더를 연결하려면 `HOST_SYNC_FOLDER`, `HOST_SCRIPTS_FOLDER` 환경변수로 경로를 지정하세요 (미지정 시 프로젝트 내 `./data-mount`, `./data-scripts` 사용).
  ```bash
  HOST_SYNC_FOLDER=/srv/data HOST_SCRIPTS_FOLDER=/opt/scripts docker compose up -d
  ```
- 앱은 `127.0.0.1:3411`에 바인딩됩니다. nginx proxy manager 등 리버스 프록시에서 이 포트로 연결하세요.
- 자동화 스크립트 실행을 위해 이미지에 `python3`, `bash`가 설치되어 있습니다. 다른 런타임(Node 스크립트 등)이 필요하면 `Dockerfile`의 `apk add` 라인에 추가하세요.

## 자동화 스크립트 추가하기

1. 스크립트 파일(`.py` 또는 `.sh`)을 `SCRIPTS_PATH` 폴더에 둡니다.
2. `역할 · 권한` 또는 DB에서 `ScriptDef` 레코드를 추가합니다(현재는 UI에 등록 폼이 없어 `prisma/seed.ts`를 참고해 직접 추가하거나 Prisma Studio(`npx prisma studio`)를 사용하세요).
3. `automation` 페이지에 화이트리스트 항목으로 노출되고, read/write 권한이 있는 사용자가 실행 버튼으로 실제 실행할 수 있습니다.

## 프로젝트 구조

```
app/
  actions/         서버 액션 (로그인, 할일, 위키, 스크립트, 사용자, 권한)
  api/files/       파일 브라우저용 REST 라우트 (list/read/upload)
  (portal)/        인증된 사용자만 접근하는 페이지들 (레이아웃에서 세션 확인)
components/        클라이언트 컴포넌트
lib/
  auth.ts          JWT 세션 발급/검증, 비밀번호 해시
  session.ts       현재 로그인 사용자 + 권한 조회
  guard.ts         페이지/서버액션/API에서 쓰는 권한 체크 헬퍼
  files.ts         SYNC_FOLDER_PATH 안전 경로 처리 (경로 탈출 방지)
  scripts-fs.ts    SCRIPTS_PATH 스크립트 파일 읽기/쓰기
prisma/
  schema.prisma    DB 스키마
  seed.ts          역할/권한/관리자 계정/데모 데이터 시드
proxy.ts           인증 안 된 요청을 로그인 페이지로 리다이렉트 (Next.js의 middleware 후속 명칭)
```

## 알려진 제한 사항 / 다음 단계

- 비밀번호 변경, 이메일 재설정 UI 없음 (계정 관리 화면에서 사용자 추가/비활성화만 가능)
- 스크립트 화이트리스트 등록은 아직 전용 UI 없이 DB 직접 조작 필요
- 캘린더 뷰는 할일의 `dueAt` 필드가 채워져 있어야 표시됨 (생성 폼에 마감일 입력란이 아직 없음)
- 스크립트 실행은 동기 방식(최대 30초 타임아웃)이라, 오래 걸리는 작업에는 적합하지 않음 — 장시간 배치가 필요하면 큐/워커 구조로 확장 필요
