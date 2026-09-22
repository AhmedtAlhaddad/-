import { NextResponse } from "next/server";

import {
  isTrackableSearchTerm,
  normalizeAnalyticsTerm,
} from "@/lib/search-analytics";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "بيانات البحث غير صالحة." }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "بيانات البحث غير صالحة." }, { status: 400 });
  }

  const term = (body as Record<string, unknown>).term;

  if (typeof term !== "string" || !isTrackableSearchTerm(term)) {
    return NextResponse.json(
      { error: "عبارة البحث غير مؤهلة للإحصاءات." },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("record_storefront_search", {
    p_term: normalizeAnalyticsTerm(term),
  });

  if (error) {
    console.error("Failed to record aggregate storefront search:", error);
    return NextResponse.json(
      { error: "تعذر تسجيل إحصاء البحث." },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
