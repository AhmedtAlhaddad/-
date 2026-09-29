import {
  createWhatsAppMetaApiError,
  INVALID_SUCCESS_RESPONSE,
  parseWhatsAppSuccessMessageId,
} from "@/lib/whatsapp-failure";
import {
  isSafeWhatsAppTemplateParameter,
  sanitizeWhatsAppTemplateParameter,
} from "@/lib/whatsapp-template-parameter";
import {
  buildOrderNotificationSummary,
  type OrderNotificationPayload,
} from "@/lib/order-notification";

export {
  buildOrderNotificationSummary,
  type OrderNotificationItem,
  type OrderNotificationPayload,
} from "@/lib/order-notification";

function requiredConfig(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`WhatsApp configuration is missing: ${name}`);
  }

  return value;
}

export async function sendWhatsAppOrderNotification(
  order: OrderNotificationPayload,
) {
  const accessToken = requiredConfig("WHATSAPP_ACCESS_TOKEN");
  const phoneNumberId = requiredConfig("WHATSAPP_PHONE_NUMBER_ID");
  const adminPhone = requiredConfig("WHATSAPP_ADMIN_PHONE");
  const templateName = requiredConfig("WHATSAPP_ORDER_TEMPLATE_NAME");
  const apiVersion = requiredConfig("WHATSAPP_API_VERSION");
  const languageCode = requiredConfig("WHATSAPP_ORDER_TEMPLATE_LANGUAGE");
  const summary = buildOrderNotificationSummary(order);
  const templateParameter = sanitizeWhatsAppTemplateParameter(summary);
  const timeout = AbortSignal.timeout(8_000);

  if (!isSafeWhatsAppTemplateParameter(templateParameter)) {
    throw new Error("WhatsApp template parameter is invalid.");
  }

  const response = await fetch(
    `https://graph.facebook.com/${encodeURIComponent(apiVersion)}/${encodeURIComponent(phoneNumberId)}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: adminPhone,
        type: "template",
        template: {
          name: templateName,
          language: { code: languageCode },
          components: [
            {
              type: "body",
              parameters: [{ type: "text", text: templateParameter }],
            },
          ],
        },
      }),
      signal: timeout,
    },
  );

  let responseBody: unknown = null;

  try {
    responseBody = await response.json();
  } catch {
    // A malformed provider body is handled below without retaining raw text.
  }

  if (!response.ok) {
    const providerError = createWhatsAppMetaApiError(
      response.status,
      responseBody,
      [
        accessToken,
        adminPhone,
        summary,
        templateParameter,
        order.customer_full_name,
        order.customer_phone,
        order.customer_city,
        order.customer_address,
        order.customer_notes ?? "",
      ],
    );

    if (process.env.NODE_ENV === "development") {
      const { status, code, error_subcode, type, message, details } =
        providerError.diagnostic;

      console.error("WhatsApp Meta error:", {
        status,
        code,
        subcode: error_subcode,
        type,
        message,
        details,
      });
    }

    throw providerError;
  }

  const messageId = parseWhatsAppSuccessMessageId(responseBody);

  if (!messageId) {
    throw new Error(INVALID_SUCCESS_RESPONSE);
  }

  return { messageId };
}
