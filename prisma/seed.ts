import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const BASE_MATRIX: Record<string, Record<string, number>> = {
  dashboard: { admin: 2, staff: 2, guest: 1, audit: 1 },
  todos: { admin: 2, staff: 2, guest: 0, audit: 0 },
  wiki: { admin: 2, staff: 2, guest: 1, audit: 1 },
  files: { admin: 2, staff: 2, guest: 1, audit: 1 },
  automation: { admin: 2, staff: 1, guest: 0, audit: 1 },
  editor: { admin: 2, staff: 0, guest: 0, audit: 0 },
  users: { admin: 2, staff: 0, guest: 0, audit: 1 },
  roles: { admin: 2, staff: 0, guest: 0, audit: 0 },
};

const ROLE_DEFS = [
  { key: "admin", name: "관리자", description: "전체 페이지 read/write", isSystem: true },
  { key: "staff", name: "일반 사용자", description: "업무 페이지 write, 자동화 read", isSystem: false },
  { key: "audit", name: "감사", description: "감사 목적 읽기 전용", isSystem: false },
  { key: "guest", name: "게스트", description: "대시보드 · 위키 열람만", isSystem: false },
];

async function main() {
  const roles: Record<string, string> = {};
  for (const r of ROLE_DEFS) {
    const role = await prisma.role.upsert({
      where: { key: r.key },
      update: { name: r.name, description: r.description },
      create: r,
    });
    roles[r.key] = role.id;

    for (const [page, levels] of Object.entries(BASE_MATRIX)) {
      await prisma.pagePermission.upsert({
        where: { roleId_page: { roleId: role.id, page } },
        update: { level: levels[r.key] ?? 0 },
        create: { roleId: role.id, page, level: levels[r.key] ?? 0 },
      });
    }
  }

  const adminEmail = process.env.ADMIN_EMAIL || "admin@example.com";
  const adminPassword = process.env.ADMIN_PASSWORD || "ChangeMe123!";
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash,
      name: "관리자",
      roleId: roles.admin,
    },
  });

  const todoCount = await prisma.todo.count();
  if (todoCount === 0) {
    await prisma.todo.createMany({
      data: [
        { title: "주간 리포트 초안 검토", project: "Ops", repeat: "매주 월", tag: "업무", ownerId: admin.id, done: true },
        { title: "자동화 화이트리스트 정리", project: "Platform", tag: "업무", ownerId: admin.id },
        { title: "백업 무결성 점검", project: "Infra", repeat: "매일", tag: "반복", ownerId: admin.id },
        { title: "위키 온보딩 문서 갱신", project: "Docs", tag: "개인", ownerId: admin.id },
        { title: "월간 비용 리포트 발송", project: "Ops", repeat: "매월 1일", tag: "반복", ownerId: admin.id },
        { title: "접근 권한 정기 감사", project: "Security", repeat: "분기", tag: "마감", ownerId: admin.id },
      ],
    });
  }

  const noteCount = await prisma.note.count();
  if (noteCount === 0) {
    await prisma.note.create({
      data: {
        title: "주간 배포 체크리스트",
        folder: "Ops/배포",
        tags: ["배포", "온콜"],
        ownerId: admin.id,
        content: `# 주간 배포 체크리스트

배포 전 확인할 항목을 순서대로 정리했다.
자동화 스크립트가 대신 수행하는 단계는 \`auto\` 로 표시한다.

## 1. 사전 점검

- 스테이징 스모크 테스트 통과 확인
- DB 마이그레이션 dry-run 로그 검토 \`auto\`
- 롤백 스크립트 존재 확인

> 금요일 16시 이후 배포 금지. 예외는 온콜 승인 필요.
`,
      },
    });
  }

  const scriptCount = await prisma.scriptDef.count();
  if (scriptCount === 0) {
    await prisma.scriptDef.createMany({
      data: [
        { file: "report_daily.py", lang: "PY", description: "일간 지표 집계 후 xlsx 생성", cron: "매일 09:00" },
        { file: "index_wiki.py", lang: "PY", description: "위키 전문 색인 재생성", cron: "매시 정각" },
        { file: "sync_drive.sh", lang: "SH", description: "드라이브 → /srv/data 동기화", cron: "매일 08:30" },
        { file: "cleanup_tmp.sh", lang: "SH", description: "임시 파일 정리", cron: "매일 23:00" },
      ],
    });
  }

  console.log(`Seed complete. Admin login: ${adminEmail} / ${adminPassword}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
