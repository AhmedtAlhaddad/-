// Canonical RFC 9562 UUID text: 8-4-4-4-12 hexadecimal characters,
// a defined version (1-8), and the RFC variant (8, 9, a, or b).
const CANONICAL_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && CANONICAL_UUID.test(value);
}
