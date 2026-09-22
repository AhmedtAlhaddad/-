import { clearAdminSession } from "@/lib/admin/auth";

export async function POST() {
  return clearAdminSession();
}
