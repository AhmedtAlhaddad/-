export const TELEGRAM_ORDER_HEADING = "طلب جديد من عالم اللياقة";
const TELEGRAM_MESSAGE_LIMIT = 3_500;
const TELEGRAM_CHUNK_CONTENT_LIMIT = 3_200;

function splitLongLine(line: string, maxLength: number) {
  const parts: string[] = [];
  let current = "";

  for (const character of line) {
    if (current.length + character.length > maxLength) {
      parts.push(current);
      current = "";
    }

    current += character;
  }

  if (current) parts.push(current);
  return parts.length ? parts : [""];
}

function splitContent(content: string, maxLength: number) {
  const chunks: string[] = [];
  let current = "";

  for (const line of content.split("\n")) {
    const parts = splitLongLine(line, maxLength);

    for (const part of parts) {
      const candidate = current ? `${current}\n${part}` : part;

      if (candidate.length <= maxLength) {
        current = candidate;
      } else {
        if (current) chunks.push(current);
        current = part;
      }
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

export function splitTelegramOrderMessage(
  summary: string,
  heading = TELEGRAM_ORDER_HEADING,
  contentLimit = TELEGRAM_CHUNK_CONTENT_LIMIT,
) {
  if (summary.length <= TELEGRAM_MESSAGE_LIMIT) {
    return [summary];
  }

  const content = summary.startsWith(`${heading}\n`)
    ? summary.slice(heading.length + 1)
    : summary;
  const chunks = splitContent(content, contentLimit);
  const total = chunks.length;

  return chunks.map((chunk, index) => {
    const message = `${heading} (${index + 1}/${total})\n${chunk}`;

    if (message.length > TELEGRAM_MESSAGE_LIMIT) {
      throw new Error("Telegram message chunk exceeds the safe limit.");
    }

    return message;
  });
}
