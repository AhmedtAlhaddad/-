import {
  buildOrderNotificationSummary,
  type OrderNotificationPayload,
} from "@/lib/order-notification";
import {
  readTelegramConfig,
  sendTelegramTextMessages,
} from "@/lib/telegram-failure";
import {
  splitTelegramOrderMessage,
  TELEGRAM_ORDER_HEADING,
} from "@/lib/telegram-message";

export async function sendTelegramOrderNotification(
  order: OrderNotificationPayload,
) {
  const { token, chatId } = readTelegramConfig();
  const summary = buildOrderNotificationSummary(order, TELEGRAM_ORDER_HEADING);
  const messages = splitTelegramOrderMessage(summary);

  return sendTelegramTextMessages({
    token,
    chatId,
    messages,
    sensitiveValues: [
      summary,
      order.customer_full_name,
      order.customer_phone,
      order.customer_city,
      order.customer_address,
      order.customer_notes ?? "",
    ],
  });
}
