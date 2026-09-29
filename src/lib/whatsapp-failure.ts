const GENERIC_WHATSAPP_FAILURE = "WhatsApp provider delivery failed.";
const INVALID_SUCCESS_RESPONSE =
  "WhatsApp provider returned an invalid success response.";
const META_ERROR_PREFIX = "META:";
const MAX_STORED_ERROR_LENGTH = 480;

const SAFE_FIXED_FAILURES = new Set([
  GENERIC_WHATSAPP_FAILURE,
  INVALID_SUCCESS_RESPONSE,
  "WhatsApp provider request timed out.",
  "Authoritative order data could not be loaded.",
  "Authoritative order data is incomplete.",
]);

const SAFE_CONFIG_NAMES = [
  "WHATSAPP_ACCESS_TOKEN",
  "WHATSAPP_PHONE_NUMBER_ID",
  "WHATSAPP_ADMIN_PHONE",
  "WHATSAPP_ORDER_TEMPLATE_NAME",
  "WHATSAPP_ORDER_TEMPLATE_LANGUAGE",
  "WHATSAPP_API_VERSION",
] as const;

export type WhatsAppMetaDiagnostic = {
  status: number;
  code?: number;
  error_subcode?: number;
  type?: string;
  message?: string;
  details?: string;
  messaging_product?: string;
};

export type ParsedWhatsAppFailure =
  | { kind: "meta"; diagnostic: WhatsAppMetaDiagnostic }
  | { kind: "text"; message: string };

export class WhatsAppMetaApiError extends Error {
  readonly diagnostic: WhatsAppMetaDiagnostic;

  constructor(diagnostic: WhatsAppMetaDiagnostic) {
    super("WhatsApp Meta API rejected the message.");
    this.name = "WhatsAppMetaApiError";
    this.diagnostic = diagnostic;
  }
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function safeInteger(value: unknown) {
  const number =
    typeof value === "number"
      ? value
      : typeof value === "string" && /^\d+$/.test(value)
        ? Number(value)
        : Number.NaN;

  return Number.isSafeInteger(number) && number >= 0 ? number : undefined;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function safeMetaText(
  value: unknown,
  sensitiveValues: readonly string[],
  maxLength: number,
) {
  if (typeof value !== "string") {
    return undefined;
  }

  let sanitized = value
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\bBearer\s+[^\s,;"']+/gi, "[redacted]")
    .replace(
      /\b(?:authorization|access[_-]?token)\s*[:=]\s*[^\s,;"']+/gi,
      "[redacted]",
    )
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted]")
    .replace(/\+?\d(?:[\s().-]*\d){7,}/g, "[redacted]");

  for (const sensitiveValue of sensitiveValues) {
    const candidate = sensitiveValue.trim();

    if (candidate.length >= 2) {
      sanitized = sanitized.replace(
        new RegExp(
          `(?<![\\p{L}\\p{N}])${escapeRegExp(candidate)}(?![\\p{L}\\p{N}])`,
          "giu",
        ),
        "[redacted]",
      );
    }
  }

  sanitized = sanitized.replace(/\s+/g, " ").trim();

  if (!sanitized) {
    return undefined;
  }

  return sanitized.length > maxLength
    ? `${sanitized.slice(0, maxLength - 1)}…`
    : sanitized;
}

function normalizeStoredMetaDiagnostic(
  value: unknown,
): WhatsAppMetaDiagnostic | null {
  const source = record(value);
  const status = safeInteger(source?.status);

  if (!source || status === undefined || status < 100 || status > 599) {
    return null;
  }

  const diagnostic: WhatsAppMetaDiagnostic = { status };
  const code = safeInteger(source.code);
  const subcode = safeInteger(source.error_subcode);
  const type = safeMetaText(source.type, [], 80);
  const message = safeMetaText(source.message, [], 240);
  const details = safeMetaText(source.details, [], 240);
  const messagingProduct = safeMetaText(source.messaging_product, [], 40);

  if (code !== undefined) diagnostic.code = code;
  if (subcode !== undefined) diagnostic.error_subcode = subcode;
  if (type) diagnostic.type = type;
  if (message) diagnostic.message = message;
  if (details) diagnostic.details = details;
  if (messagingProduct) diagnostic.messaging_product = messagingProduct;

  return diagnostic;
}

export function createWhatsAppMetaApiError(
  status: number,
  responseBody: unknown,
  sensitiveValues: readonly string[] = [],
) {
  const body = record(responseBody);
  const providerError = record(body?.error);
  const errorData = record(providerError?.error_data);
  const diagnostic: WhatsAppMetaDiagnostic = { status };
  const code = safeInteger(providerError?.code);
  const subcode = safeInteger(providerError?.error_subcode);
  const type = safeMetaText(providerError?.type, sensitiveValues, 80);
  const message = safeMetaText(providerError?.message, sensitiveValues, 240);
  const details = safeMetaText(errorData?.details, sensitiveValues, 240);
  const messagingProduct = safeMetaText(
    errorData?.messaging_product,
    sensitiveValues,
    40,
  );

  if (code !== undefined) diagnostic.code = code;
  if (subcode !== undefined) diagnostic.error_subcode = subcode;
  if (type) diagnostic.type = type;
  if (message) diagnostic.message = message;
  if (details) diagnostic.details = details;
  if (messagingProduct) diagnostic.messaging_product = messagingProduct;

  return new WhatsAppMetaApiError(diagnostic);
}

function serializeMetaDiagnostic(value: WhatsAppMetaDiagnostic) {
  const diagnostic = { ...value };
  let serialized = `${META_ERROR_PREFIX}${JSON.stringify(diagnostic)}`;

  for (const field of ["details", "message", "type"] as const) {
    while (
      serialized.length > MAX_STORED_ERROR_LENGTH &&
      diagnostic[field] &&
      diagnostic[field].length > 24
    ) {
      const overflow = serialized.length - MAX_STORED_ERROR_LENGTH;
      diagnostic[field] = `${diagnostic[field].slice(
        0,
        Math.max(23, diagnostic[field].length - overflow - 1),
      )}…`;
      serialized = `${META_ERROR_PREFIX}${JSON.stringify(diagnostic)}`;
    }
  }

  return serialized.length <= MAX_STORED_ERROR_LENGTH
    ? serialized
    : GENERIC_WHATSAPP_FAILURE;
}

function parseMetaFailure(value: string) {
  if (!value.startsWith(META_ERROR_PREFIX)) {
    return null;
  }

  try {
    return normalizeStoredMetaDiagnostic(
      JSON.parse(value.slice(META_ERROR_PREFIX.length)),
    );
  } catch {
    return null;
  }
}

function failureMessage(value: unknown) {
  if (value instanceof Error) {
    if (value.name === "AbortError" || value.name === "TimeoutError") {
      return "WhatsApp provider request timed out.";
    }

    return value.message.trim();
  }

  return typeof value === "string" ? value.trim() : "";
}

export function sanitizeWhatsAppFailure(value: unknown) {
  if (value instanceof WhatsAppMetaApiError) {
    return serializeMetaDiagnostic(value.diagnostic);
  }

  const message = failureMessage(value);
  const storedMeta = parseMetaFailure(message);

  if (storedMeta) {
    return serializeMetaDiagnostic(storedMeta);
  }

  if (SAFE_FIXED_FAILURES.has(message)) {
    return message;
  }

  const providerStatus = /^WhatsApp provider returned HTTP ([45]\d{2})\.$/.exec(
    message,
  );

  if (providerStatus) {
    return `WhatsApp provider returned HTTP ${providerStatus[1]}.`;
  }

  const missingConfig = /^WhatsApp configuration is missing: ([A-Z0-9_]+)$/.exec(
    message,
  );

  if (
    missingConfig &&
    SAFE_CONFIG_NAMES.includes(
      missingConfig[1] as (typeof SAFE_CONFIG_NAMES)[number],
    )
  ) {
    return `WhatsApp configuration is missing: ${missingConfig[1]}`;
  }

  return GENERIC_WHATSAPP_FAILURE;
}

export function parseWhatsAppFailure(value: unknown): ParsedWhatsAppFailure {
  const sanitized = sanitizeWhatsAppFailure(value);
  const diagnostic = parseMetaFailure(sanitized);

  return diagnostic
    ? { kind: "meta", diagnostic }
    : { kind: "text", message: sanitized };
}

export function parseWhatsAppSuccessMessageId(value: unknown) {
  const response = record(value);
  const messages = response?.messages;

  if (!Array.isArray(messages) || messages.length < 1) {
    return null;
  }

  const firstMessage = record(messages[0]);
  const messageId = firstMessage?.id;

  return typeof messageId === "string" &&
    /^wamid\.[^\s]{1,500}$/.test(messageId)
    ? messageId
    : null;
}

export { INVALID_SUCCESS_RESPONSE };
