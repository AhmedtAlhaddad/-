const GENERIC_WHATSAPP_FAILURE = "WhatsApp provider delivery failed.";

const SAFE_FIXED_FAILURES = new Set([
  GENERIC_WHATSAPP_FAILURE,
  "WhatsApp provider request timed out.",
  "Authoritative order data could not be loaded.",
  "Authoritative order data is incomplete.",
]);

const SAFE_CONFIG_NAMES = [
  "WHATSAPP_ACCESS_TOKEN",
  "WHATSAPP_PHONE_NUMBER_ID",
  "WHATSAPP_ADMIN_PHONE",
  "WHATSAPP_ORDER_TEMPLATE_NAME",
  "WHATSAPP_API_VERSION",
] as const;

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
  const message = failureMessage(value);

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
