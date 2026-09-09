import { requireUser } from "@/lib/guard";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { ThemedShell } from "@/components/ThemedShell";
import { MobileNavProvider } from "@/lib/mobile-nav-context";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <MobileNavProvider>
      <ThemedShell>
        <Sidebar userName={user.name} />
        <div style={{ minWidth: 0, display: "flex", flexDirection: "column" }}>
          <Header />
          <main style={{ flex: 1, minWidth: 0, padding: 18 }}>{children}</main>
        </div>
      </ThemedShell>
    </MobileNavProvider>
  );
}
