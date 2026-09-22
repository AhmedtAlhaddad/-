import type { Metadata } from "next";

import {
  AthletesManager,
  type AthleteItem,
} from "@/components/admin/athletes-manager";
import { requireAdmin } from "@/lib/admin/require-admin";

export const metadata: Metadata = {
  title: "إدارة الرياضيين",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

export default async function Page() {
  const { supabase } = await requireAdmin("/admin/athletes");

  const { data, error } = await supabase
    .from("athletes")
    .select(
      "id, display_name, profile_image_path, phone, email, active, notes, created_at, updated_at",
    )
    .order("active", { ascending: false })
    .order("display_name", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (
    <AthletesManager
      items={(data ?? []) as AthleteItem[]}
    />
  );
}
