const GENERIC_TELEGRAM_FAILURE = "Telegram delivery failed.";
const TELEGRAM_ERROR_PREFIX = "TELEGRAM:";
const MAX_STORED_ERROR_LENGTH = 480;

export type TelegramDiagnostic = {
  status: number;
  error_code?: number;
  description?: string;
};

export type ParsedTelegramFailure =
  | { kind: "telegram"; diagnostic: TelegramDiagnostic }
  | { kind: "text"; message: string };

export class TelegramApiError extends Error {
  readonly diagnostic: TelegramDiagnostic;

  constructor(diagnostic: TelegramDiagnostic) {
    super("Telegram API rejected the message.");
    this.name = "TelegramApiError";
    this.diagnostic = diagnostic;
  }
}

export function readTelegramConfig(
  environment: Record<string, string | undefined> = process.env,
) {
  const token = environment.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = environment.TELEGRAM_CHAT_ID?.trim();

  if (!token) {
    throw new Error("Telegram configuration is missing: TELEGRAM_BOT_TOKEN");
  }

  if (!chatId) {
    throw new Error("Telegram configuration is missing: TELEGRAM_CHAT_ID");
  }

  return { token, chatId };
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function safeInteger(value: unknown) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : undefined;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function safeDescription(value: unknown, sensitiveValues: readonly string[]) {
  if (typeof value !== "string") {
    return undefined;
  }

  let sanitized = value
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\bBearer\s+[^\s,;"']+/gi, "[redacted]")
    .replace(
      /\b(?:authorization|access[_-]?token|bot[_-]?token)\s*[:=]\s*[^\s,;"']+/gi,
      "[redacted]",
    )
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted]")
    .replace(/\+?\d(?:[\s().-]*\d){7,}/g, "[redacted]");

  for (const sensitiveValue of sensitiveValues) {
    const candidate = sensitiveValue.trim();

    if (candidate.length >= 2) {
      sanitized = sanitized.replace(
        new RegExp(escapeRegExp(candidate), "gi"),
        "[redacted]",
      );
    }
  }

  sanitized = sanitized.replace(/\s+/g, " ").trim();

  if (!sanitized) {
    return undefined;
  }

  return sanitized.length > 300
    ? `${sanitized.slice(0, 299)}…`
    : sanitized;
}

function normalizeDiagnostic(value: unknown): TelegramDiagnostic | null {
  const source = record(value);
  const status = safeInteger(source?.status);

  if (!source || status === undefined || status < 100 || status > 599) {
    return null;
  }

  const diagnostic: TelegramDiagnostic = { status };
  const errorCode = safeInteger(source.error_code);
  const description = safeDescription(source.description, []);

  if (errorCode !== undefined) diagnostic.error_code = errorCode;
  if (description) diagnostic.description = description;

  return diagnostic;
}

function serializeDiagnostic(diagnostic: TelegramDiagnostic) {
  const serialized = `${TELEGRAM_ERROR_PREFIX}${JSON.stringify(diagnostic)}`;
  return serialized.length <= MAX_STORED_ERROR_LENGTH
    ? serialized
    : GENERIC_TELEGRAM_FAILURE;
}

function parseStoredDiagnostic(value: string) {
  if (!value.startsWith(TELEGRAM_ERROR_PREFIX)) {
    return null;
  }

  try {
    return normalizeDiagnostic(
      JSON.parse(value.slice(TELEGRAM_ERROR_PREFIX.length)),
    );
  } catch {
    return null;
  }
}

export function createTelegramApiError(
  status: number,
  responseBody: unknown,
  sensitiveValues: readonly string[] = [],
) {
  const body = record(responseBody);
  const diagnostic: TelegramDiagnostic = { status };
  const errorCode = safeInteger(body?.error_code);
  const description = safeDescription(body?.description, sensitiveValues);

  if (errorCode !== undefined) diagnostic.error_code = errorCode;
  if (description) diagnostic.description = description;

  return new TelegramApiError(diagnostic);
}

export function sanitizeTelegramFailure(value: unknown) {
  if (value instanceof TelegramApiError) {
    return serializeDiagnostic(value.diagnostic);
  }

  if (value instanceof Error) {
    if (value.name === "AbortError" || value.name === "TimeoutError") {
      return "Telegram request timed out.";
    }

    const message = value.message.trim();
    const storedDiagnostic = parseStoredDiagnostic(message);

    if (storedDiagnostic) {
      return serializeDiagnostic(storedDiagnostic);
    }

    if (
      message === "Telegram configuration is missing: TELEGRAM_BOT_TOKEN" ||
      message === "Telegram configuration is missing: TELEGRAM_CHAT_ID"
    ) {
      return message;
    }
  }

  if (typeof value === "string") {
    const storedDiagnostic = parseStoredDiagnostic(value.trim());
    if (storedDiagnostic) return serializeDiagnostic(storedDiagnostic);
  }

  return GENERIC_TELEGRAM_FAILURE;
}

export function parseTelegramFailure(value: unknown): ParsedTelegramFailure {
  const sanitized = sanitizeTelegramFailure(value);
  const diagnostic = parseStoredDiagnostic(sanitized);

  return diagnostic
    ? { kind: "telegram", diagnostic }
    : { kind: "text", message: sanitized };
}

export async function sendTelegramTextMessages({
  token,
  chatId,
  messages,
  sensitiveValues = [],
  fetcher = fetch,
}: {
  token: string;
  chatId: string;
  messages: string[];
  sensitiveValues?: readonly string[];
  fetcher?: typeof fetch;
}) {
  const messageIds: number[] = [];

  for (const message of messages) {
    let response: Response;

    try {
      response = await fetcher(
        `https://api.telegram.org/bot${encodeURIComponent(token)}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json; charset=utf-8" },
          body: JSON.stringify({ chat_id: chatId, text: message }),
          signal: AbortSignal.timeout(8_000),
        },
      );
    } catch (error) {
      if (
        error instanceof Error &&
        (error.name === "AbortError" || error.name === "TimeoutError")
      ) {
        throw error;
      }

      throw new Error(GENERIC_TELEGRAM_FAILURE);
    }

    let responseBody: unknown = null;

    try {
      responseBody = await response.json();
    } catch {
      // Malformed provider bodies are reduced to the HTTP status below.
    }

    const body = record(responseBody);

    if (!response.ok || body?.ok !== true) {
      throw createTelegramApiError(response.status, responseBody, [
        token,
        chatId,
        message,
        ...sensitiveValues,
      ]);
    }

    const result = record(body.result);
    const messageId = safeInteger(result?.message_id);
    if (messageId !== undefined) messageIds.push(messageId);
  }

  return { messageIds };
}
