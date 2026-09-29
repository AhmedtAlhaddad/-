const FORBIDDEN_TEMPLATE_PARAMETER_CHARACTERS = /[\r\n\t]/;
const EXCESSIVE_TEMPLATE_PARAMETER_SPACES = / {5,}/;

export function sanitizeWhatsAppTemplateParameter(value: string) {
  return value
    .replace(/[\r\n\t]+/g, " • ")
    .replace(/\s+/gu, " ")
    .trim();
}

export function isSafeWhatsAppTemplateParameter(value: string) {
  return (
    value.length > 0 &&
    !FORBIDDEN_TEMPLATE_PARAMETER_CHARACTERS.test(value) &&
    !EXCESSIVE_TEMPLATE_PARAMETER_SPACES.test(value)
  );
}
