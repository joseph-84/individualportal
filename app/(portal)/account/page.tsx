import { requireUser } from "@/lib/guard";
import { AccountClient } from "@/components/AccountClient";

export default async function AccountPage() {
  const user = await requireUser();
  return <AccountClient name={user.name} email={user.email} roleName={user.role.name} />;
}
