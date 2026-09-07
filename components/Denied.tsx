export function Denied({ roleName }: { roleName: string }) {
  return (
    <div style={{ display: "grid", placeItems: "center", padding: "100px 20px" }}>
      <div style={{ textAlign: "center", maxWidth: 320 }}>
        <div
          style={{
            width: 34,
            height: 34,
            margin: "0 auto 14px",
            borderRadius: 9,
            background: "var(--err-soft)",
            color: "var(--err)",
            display: "grid",
            placeItems: "center",
            fontSize: 15,
          }}
        >
          ✕
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>접근 권한이 없습니다</div>
        <div style={{ fontSize: 13, color: "var(--ink3)" }}>{roleName} 역할에는 이 페이지 권한이 부여되지 않았습니다.</div>
      </div>
    </div>
  );
}
