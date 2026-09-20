import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

type AthleteInput = {
  displayName: string;
  profileImagePath: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  active: boolean;
};

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function optionalText(value: unknown) {
  return text(value) || null;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

async function getAdminClient() {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (claimsError || !userId) {
    return {
      error: NextResponse.json(
        { error: "يجب تسجيل الدخول أولًا." },
        { status: 401 },
      ),
      supabase: null,
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, active")
    .eq("user_id", userId)
    .maybeSingle();

  if (
    profileError ||
    !profile ||
    profile.role !== "admin" ||
    profile.active !== true
  ) {
    return {
      error: NextResponse.json(
        { error: "ليس لديك صلاحية الإدارة." },
        { status: 403 },
      ),
      supabase: null,
    };
  }

  return {
    error: null,
    supabase,
  };
}

async function readPayload(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return {
      error: "بيانات الطلب غير صالحة.",
      input: null,
      id: "",
    };
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return {
      error: "بيانات الطلب غير صالحة.",
      input: null,
      id: "",
    };
  }

  const payload = body as Record<string, unknown>;
  const displayName = text(payload.display_name);
  const profileImagePath = optionalText(payload.profile_image_path);
  const phone = optionalText(payload.phone);
  const email = optionalText(payload.email);
  const notes = optionalText(payload.notes);

  if (!displayName || displayName.length > 160) {
    return {
      error: "اسم الرياضي مطلوب ويجب ألا يتجاوز 160 حرفًا.",
      input: null,
      id: "",
    };
  }

  if (typeof payload.active !== "boolean") {
    return {
      error: "حالة الرياضي غير صالحة.",
      input: null,
      id: "",
    };
  }

  if (phone && phone.length > 64) {
    return {
      error: "رقم الهاتف طويل جدًا.",
      input: null,
      id: "",
    };
  }

  if (email && (email.length > 320 || !email.includes("@"))) {
    return {
      error: "البريد الإلكتروني غير صالح.",
      input: null,
      id: "",
    };
  }

  if (profileImagePath && profileImagePath.length > 1000) {
    return {
      error: "مسار صورة الملف طويل جدًا.",
      input: null,
      id: "",
    };
  }

  if (notes && notes.length > 5000) {
    return {
      error: "الملاحظات طويلة جدًا.",
      input: null,
      id: "",
    };
  }

  const input: AthleteInput = {
    displayName,
    profileImagePath,
    phone,
    email,
    notes,
    active: payload.active,
  };

  return {
    error: null,
    input,
    id: text(payload.id),
  };
}

function athleteValues(input: AthleteInput) {
  return {
    display_name: input.displayName,
    profile_image_path: input.profileImagePath,
    phone: input.phone,
    email: input.email,
    notes: input.notes,
    active: input.active,
  };
}

function writeError(code: string | undefined) {
  if (code === "42501") {
    return {
      status: 403,
      message: "ليس لديك صلاحية تعديل الرياضيين.",
    };
  }

  if (code === "23514") {
    return {
      status: 400,
      message: "بيانات الرياضي لا تطابق القيود المطلوبة.",
    };
  }

  return {
    status: 400,
    message: "تعذر حفظ بيانات الرياضي.",
  };
}

export async function POST(request: Request) {
  const admin = await getAdminClient();

  if (admin.error || !admin.supabase) {
    return admin.error;
  }

  const parsed = await readPayload(request);

  if (parsed.error || !parsed.input) {
    return NextResponse.json(
      { error: parsed.error },
      { status: 400 },
    );
  }

  const { error } = await admin.supabase
    .from("athletes")
    .insert(athleteValues(parsed.input));

  if (error) {
    const result = writeError(error.code);

    return NextResponse.json(
      { error: result.message },
      { status: result.status },
    );
  }

  return NextResponse.json({ success: true });
}

export async function PATCH(request: Request) {
  const admin = await getAdminClient();

  if (admin.error || !admin.supabase) {
    return admin.error;
  }

  const parsed = await readPayload(request);

  if (parsed.error || !parsed.input) {
    return NextResponse.json(
      { error: parsed.error },
      { status: 400 },
    );
  }

  if (!parsed.id || !isUuid(parsed.id)) {
    return NextResponse.json(
      { error: "معرّف الرياضي غير صالح." },
      { status: 400 },
    );
  }

  const { data, error } = await admin.supabase
    .from("athletes")
    .update(athleteValues(parsed.input))
    .eq("id", parsed.id)
    .select("id")
    .maybeSingle();

  if (error) {
    const result = writeError(error.code);

    return NextResponse.json(
      { error: result.message },
      { status: result.status },
    );
  }

  if (!data) {
    return NextResponse.json(
      { error: "لم يتم العثور على الرياضي." },
      { status: 404 },
    );
  }

  return NextResponse.json({ success: true });
}
