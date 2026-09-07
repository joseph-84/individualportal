import { pageAccess } from "@/lib/guard";
import { Denied } from "@/components/Denied";
import { prisma } from "@/lib/prisma";
import { UsersClient } from "@/components/UsersClient";

export default async function UsersPage() {
  const { user, level } = await pageAccess("users");
  if (level === 0) return <Denied roleName={user.role.name} />;

  const [users, roles] = await Promise.all([
    prisma.user.findMany({ orderBy: { createdAt: "asc" }, include: { role: true } }),
    prisma.role.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <UsersClient
      canWrite={level === 2}
      roles={roles.map((r) => ({ key: r.key, name: r.name }))}
      users={users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role.key,
        active: u.active,
        lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
        isSelf: u.id === user.id,
      }))}
    />
  );
}
