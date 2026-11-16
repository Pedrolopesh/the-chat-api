import { sendNotification, setVapidDetails, type PushSubscription } from "web-push";
import { env, features } from "../config/env.js";

let configured = false;

export async function sendPush(subscription: PushSubscription, payload: string): Promise<boolean> {
  if (!features.push) return false;
  if (!configured) {
    setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY!, env.VAPID_PRIVATE_KEY!);
    configured = true;
  }
  await sendNotification(subscription, payload);
  return true;
}
