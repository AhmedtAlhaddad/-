import {
  parseOrderNotificationPayload,
  type OrderNotificationPayload,
} from "@/lib/order-notification";
import { isUuid } from "@/lib/uuid";

export type OrderNotificationClaim = {
  id: string;
  order_id: string;
  status: "sending" | "sent";
  payload?: OrderNotificationPayload;
};

export function parseOrderNotificationClaim(
  value: unknown,
): OrderNotificationClaim | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const claim = value as Record<string, unknown>;
  const id = claim.id;
  const orderId = claim.order_id;
  const status = claim.status;

  if (
    !isUuid(id) ||
    !isUuid(orderId) ||
    (status !== "sending" && status !== "sent")
  ) {
    return null;
  }

  if (status === "sending") {
    const payload = parseOrderNotificationPayload(claim.payload);
    return payload ? { id, order_id: orderId, status, payload } : null;
  }

  return { id, order_id: orderId, status };
}
