import { pageAccess } from "@/lib/guard";
import { Denied } from "@/components/Denied";
import { prisma } from "@/lib/prisma";
import { RolesClient } from "@/components/RolesClient";

export default async function RolesPage() {
  const { user, level } = await pageAccess("roles");
  if (level === 0) return <Denied roleName={user.role.name} />;

  const roles = await prisma.role.findMany({
    orderBy: { createdAt: "asc" },
    include: { permissions: true, _count: { select: { users: true } } },
  });

  return (
    <RolesClient
      canWrite={level === 2}
      roles={roles.map((r) => ({
        id: r.id,
        key: r.key,
        name: r.name,
        description: r.description,
        isSystem: r.isSystem,
        userCount: r._count.users,
        permissions: Object.fromEntries(r.permissions.map((p) => [p.page, p.level])),
      }))}
    />
  );
}
