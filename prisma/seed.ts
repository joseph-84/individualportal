import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
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
    },
  });

  const todoCount = await prisma.todo.count();
  if (todoCount === 0) {
    const today = new Date();
    const inDays = (n: number, h = 10) => new Date(today.getFullYear(), today.getMonth(), today.getDate() + n, h, 0);
    await prisma.todo.createMany({
      data: [
        { title: "주간 리포트 초안 검토", project: "Ops", repeat: "매주 월", tag: "업무", ownerId: admin.id, done: true, dueAt: inDays(-1) },
        { title: "자동화 화이트리스트 정리", project: "Platform", tag: "업무", ownerId: admin.id, dueAt: inDays(1) },
        { title: "백업 무결성 점검", project: "Infra", repeat: "매일", tag: "반복", ownerId: admin.id, dueAt: inDays(0) },
        { title: "위키 온보딩 문서 갱신", project: "Docs", tag: "개인", ownerId: admin.id, dueAt: inDays(3) },
        { title: "월간 비용 리포트 발송", project: "Ops", repeat: "매월 1일", tag: "반복", ownerId: admin.id, dueAt: inDays(10) },
        { title: "접근 권한 정기 감사", project: "Security", repeat: "분기", tag: "마감", ownerId: admin.id, dueAt: inDays(20) },
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
        { file: "report_daily.py", lang: "PY", description: "일간 지표 집계 후 xlsx 생성", cron: "0 9 * * *" },
        { file: "index_wiki.py", lang: "PY", description: "위키 전문 색인 재생성", cron: "0 * * * *" },
        { file: "sync_drive.sh", lang: "SH", description: "드라이브 → /srv/data 동기화", cron: "30 8 * * *" },
        { file: "cleanup_tmp.sh", lang: "SH", description: "임시 파일 정리", cron: "0 23 * * *" },
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
