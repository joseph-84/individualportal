<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# 프로젝트 고유 규칙

(위 블록은 `next dev`가 자동으로 관리하는 Next.js 공용 안내이고, 이 아래는 이 프로젝트에서
직접 유지하는 규칙입니다 — `next dev`가 재생성해도 이 블록 밖의 내용은 건드리지 않습니다.)

## 새 기능 추가 시 MCP 도구도 함께 추가

할일/위키/파일/공유/자동화/코드 에디터/즐겨찾기/감사 로그 등 기존 기능은 모두
`lib/mcp/build-server.ts`에 대응하는 MCP 도구가 등록되어 있습니다(목록은
README "MCP 연동 → 제공 도구" 참고). **새로운 기능이나 데이터 모델을 추가할 때는 그에 맞는
MCP 도구(list/get/create/update/delete 등 해당하는 것만)도 같은 파일에 함께 추가하고,
README의 도구 목록·개수도 갱신한다.** 기존 도구와 패턴이 거의 동일하므로(예: 위키의
`list_notes`/`get_note`/`create_note`/`update_note`/`delete_note`) 새로 설계하지 않고
그대로 따라 하면 된다. 기능만 추가하고 MCP 도구를 빠뜨리는 일이 없도록 할 것.

## MCP 관련 작업은 항상 먼저 계획을 세워 승인받고 진행

`lib/mcp/build-server.ts`, `lib/oauth.ts`, `lib/api-auth.ts`, `app/mcp/*`, `app/oauth/*`
등 MCP 서버/인증과 관련된 코드를 추가하거나 수정하는 작업은, 단순히 기존 도구와 동일한
패턴을 반복하는 것(위 항목처럼 새 기능에 맞춰 도구를 추가하는 경우 포함)이라도 **항상 먼저
계획(plan)을 작성해 사용자 승인을 받은 뒤에 구현을 시작한다.** 인증·외부 클라이언트(Claude
Code/Desktop/모바일 등)와 맞닿아 있어 잘못 건드리면 기존 연결이 깨지기 쉽고, 실제 동작 확인도
배포 후 사용자가 직접 해야 하는 경우가 많기 때문이다.
