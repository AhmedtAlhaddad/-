import { parseOrderNotificationClaim } from "@/lib/order-notification-claim";
import { createClient } from "@/lib/supabase/server";
import { sanitizeTelegramFailure } from "@/lib/telegram-failure";
import { sendTelegramOrderNotification } from "@/lib/telegram-order-notification";
import { isUuid } from "@/lib/uuid";

export async function dispatchAutomaticTelegramOrder(
  orderId: string,
  checkoutIdempotencyKey: string,
) {
  if (!isUuid(orderId) || !isUuid(checkoutIdempotencyKey)) {
    return;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "claim_checkout_telegram_notification",
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
    await sendTelegramOrderNotification(claim.payload);
    success = true;
  } catch (providerError) {
    failureReason = sanitizeTelegramFailure(providerError);
    // Checkout already committed; the Telegram outbox row remains retryable.
  }

  await supabase.rpc("complete_checkout_telegram_notification", {
    p_outbox_id: claim.id,
    p_order_id: orderId,
    p_checkout_idempotency_key: checkoutIdempotencyKey,
    p_success: success,
    p_error: failureReason,
  });
}
