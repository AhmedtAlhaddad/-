import {
  NextResponse,
} from "next/server";

import { authorizeAdminApi } from "@/lib/admin/auth";
import {
  revalidatePublicCatalog,
} from "@/lib/supabase/revalidate-catalog";

type Kind =
  | "brands"
  | "categories";

function text(
  value: unknown,
) {
  return typeof value ===
    "string"
    ? value.trim()
    : "";
}

function nullableText(
  value: unknown,
) {
  const result =
    text(value);

  return result
    ? result
    : null;
}

function errorResponse(
  error: string,
  status = 400,
) {
  return NextResponse.json(
    {
      error,
    },
    {
      status,
    },
  );
}

function isUuid(
  value: string,
) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function parseKind(
  value: string,
): Kind | null {
  if (
    value === "brands" ||
    value ===
      "categories"
  ) {
    return value;
  }

  return null;
}

function postgresMessage(
  code:
    | string
    | undefined,
  fallback: string,
) {
  if (
    code === "23505"
  ) {
    return "هذا الـSlug مستخدم مسبقًا.";
  }

  if (
    code === "23514"
  ) {
    return "إحدى القيم لا تطابق شروط قاعدة البيانات.";
  }

  if (
    code === "42501"
  ) {
    return "ليس لديك صلاحية تنفيذ هذه العملية.";
  }

  return fallback;
}

async function getAdminClient() {
  const gate = await authorizeAdminApi();

  if (gate.response) {
    return {
      supabase: null,
      response: gate.response,
    };
  }

  const supabase = gate.supabase;

  const {
    data: claimsData,
    error: claimsError,
  } =
    await supabase.auth.getClaims();

  const userId =
    claimsData?.claims?.sub;

  if (
    claimsError ||
    !userId
  ) {
    return {
      supabase: null,
      response:
        errorResponse(
          "يجب تسجيل الدخول أولًا.",
          401,
        ),
    };
  }

  const {
    data: profile,
    error: profileError,
  } =
    await supabase
      .from("profiles")
      .select(
        "role, active",
      )
      .eq(
        "user_id",
        userId,
      )
      .maybeSingle();

  if (
    profileError ||
    !profile ||
    profile.role !==
      "admin" ||
    profile.active !==
      true
  ) {
    return {
      supabase: null,
      response:
        errorResponse(
          "ليس لديك صلاحية الإدارة.",
          403,
        ),
    };
  }

  return {
    supabase,
    response: null,
  };
}

async function readPayload(
  request: Request,
) {
  let body: unknown;

  try {
    body =
      await request.json();
  } catch {
    return {
      payload: null,
      response:
        errorResponse(
          "بيانات الطلب غير صالحة.",
        ),
    };
  }

  if (
    !body ||
    typeof body !==
      "object" ||
    Array.isArray(body)
  ) {
    return {
      payload: null,
      response:
        errorResponse(
          "بيانات الطلب غير صالحة.",
        ),
    };
  }

  const payload =
    body as Record<
      string,
      unknown
    >;

  const slug =
    text(
      payload.slug,
    ).toLowerCase();

  const nameAr =
    text(
      payload.name_ar,
    );

  const nameEn =
    nullableText(
      payload.name_en,
    );

  const sortOrder =
    Number(
      payload.sort_order ??
        0,
    );

  const active =
    payload.active === true;

  if (
    !slug ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(
      slug,
    ) ||
    slug.length >
      160
  ) {
    return {
      payload: null,
      response:
        errorResponse(
          "الرابط المختصر (Slug) يجب أن يكون أحرفًا إنجليزية صغيرة وأرقامًا وشرطات فقط، مثل brand-name.",
        ),
    };
  }

  if (
    !nameAr ||
    nameAr.length >
      160
  ) {
    return {
      payload: null,
      response:
        errorResponse(
          "الاسم العربي مطلوب ويجب ألا يتجاوز 160 حرفًا.",
        ),
    };
  }

  if (
    nameEn &&
    nameEn.length >
      160
  ) {
    return {
      payload: null,
      response:
        errorResponse(
          "الاسم الإنجليزي طويل جدًا.",
        ),
    };
  }

  if (
    !Number.isInteger(
      sortOrder,
    ) ||
    sortOrder < 0 ||
    sortOrder > 1000000
  ) {
    return {
      payload: null,
      response:
        errorResponse(
          "ترتيب العرض يجب أن يكون عددًا صحيحًا غير سالب.",
        ),
    };
  }

  return {
    payload: {
      slug,
      nameAr,
      nameEn,
      sortOrder,
      active,

      logoPath:
        nullableText(
          payload.logo_path,
        ),

      descriptionAr:
        nullableText(
          payload.description_ar,
        ),

      imagePath:
        nullableText(
          payload.image_path,
        ),

      id:
        text(
          payload.id,
        ),
    },

    response: null,
  };
}

async function finishSuccess() {
  let warning:
    | string
    | null =
    null;

  try {
    revalidatePublicCatalog();
  } catch (error) {
    console.error(
      "Taxonomy saved but catalog revalidation failed:",
      error,
    );

    warning =
      "تم الحفظ، لكن تعذر تحديث كاش المتجر فورًا.";
  }

  return NextResponse.json({
    success: true,
    warning,
  });
}

export async function POST(
  request: Request,
  context: {
    params: Promise<{
      kind: string;
    }>;
  },
) {
  const {
    kind: rawKind,
  } =
    await context.params;

  const kind =
    parseKind(
      rawKind,
    );

  if (!kind) {
    return errorResponse(
      "نوع الكيان غير صالح.",
      404,
    );
  }

  const auth =
    await getAdminClient();

  if (
    auth.response ||
    !auth.supabase
  ) {
    return auth.response;
  }

  const parsed =
    await readPayload(
      request,
    );

  if (
    parsed.response ||
    !parsed.payload
  ) {
    return parsed.response;
  }

  const {
    slug,
    nameAr,
    nameEn,
    sortOrder,
    active,
    logoPath,
    descriptionAr,
    imagePath,
  } =
    parsed.payload;

  if (
    logoPath &&
    logoPath.length >
      1000
  ) {
    return errorResponse(
      "مسار الشعار طويل جدًا.",
    );
  }

  if (
    imagePath &&
    imagePath.length >
      1000
  ) {
    return errorResponse(
      "مسار الصورة طويل جدًا.",
    );
  }

  if (
    descriptionAr &&
    descriptionAr.length >
      5000
  ) {
    return errorResponse(
      "وصف التصنيف طويل جدًا.",
    );
  }

  if (
    kind === "brands"
  ) {
    const {
      error,
    } =
      await auth.supabase
        .from("brands")
        .insert({
          slug,
          name_ar:
            nameAr,
          name_en:
            nameEn,
          logo_path:
            logoPath,
          active,
          sort_order:
            sortOrder,
        });

    if (error) {
      return errorResponse(
        postgresMessage(
          error.code,
          error.message ||
            "تعذر إضافة العلامة التجارية.",
        ),
      );
    }
  } else {
    const {
      error,
    } =
      await auth.supabase
        .from(
          "categories",
        )
        .insert({
          slug,
          name_ar:
            nameAr,
          name_en:
            nameEn,
          description_ar:
            descriptionAr,
          image_path:
            imagePath,
          active,
          sort_order:
            sortOrder,
        });

    if (error) {
      return errorResponse(
        postgresMessage(
          error.code,
          error.message ||
            "تعذر إضافة التصنيف.",
        ),
      );
    }
  }

  return finishSuccess();
}

export async function PATCH(
  request: Request,
  context: {
    params: Promise<{
      kind: string;
    }>;
  },
) {
  const {
    kind: rawKind,
  } =
    await context.params;

  const kind =
    parseKind(
      rawKind,
    );

  if (!kind) {
    return errorResponse(
      "نوع الكيان غير صالح.",
      404,
    );
  }

  const auth =
    await getAdminClient();

  if (
    auth.response ||
    !auth.supabase
  ) {
    return auth.response;
  }

  const parsed =
    await readPayload(
      request,
    );

  if (
    parsed.response ||
    !parsed.payload
  ) {
    return parsed.response;
  }

  const {
    id,
    slug,
    nameAr,
    nameEn,
    sortOrder,
    active,
    logoPath,
    descriptionAr,
    imagePath,
  } =
    parsed.payload;

  if (
    !id ||
    !isUuid(id)
  ) {
    return errorResponse(
      "معرّف العنصر غير صالح.",
    );
  }

  if (
    logoPath &&
    logoPath.length >
      1000
  ) {
    return errorResponse(
      "مسار الشعار طويل جدًا.",
    );
  }

  if (
    imagePath &&
    imagePath.length >
      1000
  ) {
    return errorResponse(
      "مسار الصورة طويل جدًا.",
    );
  }

  if (
    descriptionAr &&
    descriptionAr.length >
      5000
  ) {
    return errorResponse(
      "وصف التصنيف طويل جدًا.",
    );
  }

  if (
    kind === "brands"
  ) {
    const {
      data,
      error,
    } =
      await auth.supabase
        .from("brands")
        .update({
          slug,
          name_ar:
            nameAr,
          name_en:
            nameEn,
          logo_path:
            logoPath,
          active,
          sort_order:
            sortOrder,
        })
        .eq(
          "id",
          id,
        )
        .select("id")
        .maybeSingle();

    if (error) {
      return errorResponse(
        postgresMessage(
          error.code,
          error.message ||
            "تعذر تحديث العلامة التجارية.",
        ),
      );
    }

    if (!data) {
      return errorResponse(
        "العلامة التجارية غير موجودة.",
        404,
      );
    }
  } else {
    const {
      data,
      error,
    } =
      await auth.supabase
        .from(
          "categories",
        )
        .update({
          slug,
          name_ar:
            nameAr,
          name_en:
            nameEn,
          description_ar:
            descriptionAr,
          image_path:
            imagePath,
          active,
          sort_order:
            sortOrder,
        })
        .eq(
          "id",
          id,
        )
        .select("id")
        .maybeSingle();

    if (error) {
      return errorResponse(
        postgresMessage(
          error.code,
          error.message ||
            "تعذر تحديث التصنيف.",
        ),
      );
    }

    if (!data) {
      return errorResponse(
        "التصنيف غير موجود.",
        404,
      );
    }
  }

  return finishSuccess();
}
