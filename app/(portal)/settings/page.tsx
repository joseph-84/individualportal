import { requireUser } from "@/lib/guard";
import { getGoogleIntegrationStatus } from "@/lib/google-calendar";
import { SettingsClient } from "@/components/SettingsClient";

export default async function SettingsPage() {
  await requireUser();
  const google = await getGoogleIntegrationStatus();

  return <SettingsClient google={google} />;
}
