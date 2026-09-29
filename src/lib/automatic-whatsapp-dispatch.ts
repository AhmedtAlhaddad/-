import { createClient } from "@/lib/supabase/server";
import { parseOrderNotificationClaim } from "@/lib/order-notification-claim";
import { sendWhatsAppOrderNotification } from "@/lib/whatsapp-order-notification";
import { sanitizeWhatsAppFailure } from "@/lib/whatsapp-failure";
import { isUuid } from "@/lib/uuid";

export async function dispatchAutomaticWhatsAppOrder(
  orderId: string,
  checkoutIdempotencyKey: string,
) {
  if (!isUuid(orderId) || !isUuid(checkoutIdempotencyKey)) {
    return;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "claim_checkout_whatsapp_notification",
    {
      p_order_id: orderId,
      p_checkout_idempotency_key: checkoutIdempotencyKey,
    },
  );
  const claim = parseOrderNotificationClaim(data);

  if (error || !claim || claim.status === "sent" || !claim.payload) {
    return;
  }

  let success = false;
  let failureReason: string | null = null;

  try {
    await sendWhatsAppOrderNotification(claim.payload);
    success = true;
  } catch (error) {
    failureReason = sanitizeWhatsAppFailure(error);
    // The order is already committed. The durable outbox remains retryable.
  }

  await supabase.rpc("complete_checkout_whatsapp_notification", {
    p_outbox_id: claim.id,
    p_order_id: orderId,
    p_checkout_idempotency_key: checkoutIdempotencyKey,
    p_success: success,
    p_error: failureReason,
  });
}
