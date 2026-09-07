import { requireUser } from "@/lib/guard";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { ThemedShell } from "@/components/ThemedShell";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <ThemedShell>
      <Sidebar roleKey={user.role.key} roleName={user.role.name} userName={user.name} permissions={user.permissions} />
      <div style={{ minWidth: 0, display: "flex", flexDirection: "column" }}>
        <Header roleName={user.role.name} />
        <main style={{ flex: 1, minWidth: 0, padding: 18 }}>{children}</main>
      </div>
    </ThemedShell>
  );
}
