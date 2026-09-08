import { pageAccess } from "@/lib/guard";
import { Denied } from "@/components/Denied";
import { prisma } from "@/lib/prisma";

const ACTION_LABEL: Record<string, string> = {
  "permission.save": "권한 변경",
  "role.create": "역할 생성",
  "user.create": "사용자 추가",
  "user.toggle": "사용자 활성/비활성",
  "user.update": "사용자 정보 수정",
  "user.reset_password": "비밀번호 초기화",
  "script.register": "스크립트 등록",
  "script.update": "스크립트 일정 변경",
  "script.enable": "스크립트 활성화",
  "script.disable": "스크립트 비활성화",
  "script.delete": "스크립트 삭제",
  "script.save": "스크립트 코드 저장",
  "note.create": "노트 생성",
  "note.delete": "노트 삭제",
  "file.delete": "파일 삭제",
  "file.rename": "파일 이름변경/이동",
};

export default async function AuditLogPage() {
  const { user, level } = await pageAccess("auditlog");
  if (level === 0) return <Denied roleName={user.role.name} />;

  const logs = await prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 200 });

  return (
    <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "140px 160px minmax(0,1fr) minmax(0,1.4fr)",
          gap: 10,
          padding: "9px 15px",
          minWidth: 720,
          background: "var(--panel2)",
          borderBottom: "1px solid var(--line)",
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: ".04em",
          color: "var(--ink3)",
        }}
      >
        <div>시각</div>
        <div>실행자</div>
        <div>동작</div>
        <div>대상</div>
      </div>
      {logs.length === 0 && <div style={{ padding: 24, fontSize: 12.5, color: "var(--ink3)" }}>기록된 감사 로그가 없습니다.</div>}
      {logs.map((l) => (
        <div
          key={l.id}
          style={{
            display: "grid",
            gridTemplateColumns: "140px 160px minmax(0,1fr) minmax(0,1.4fr)",
            gap: 10,
            alignItems: "center",
            padding: "8px 15px",
            minWidth: 720,
            borderBottom: "1px solid var(--line2)",
            fontSize: 12.5,
          }}
        >
          <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: 11.5, color: "var(--ink3)" }}>{new Date(l.createdAt).toLocaleString("ko-KR")}</div>
          <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.actorName}</div>
          <div>{ACTION_LABEL[l.action] || l.action}</div>
          <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: 11.5, color: "var(--ink2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {l.target}
            {l.meta && <span style={{ color: "var(--ink3)" }}> · {l.meta}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
