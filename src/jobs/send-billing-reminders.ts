import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import webpush from "web-push";
import { getBillingReminder, getCalendarDate, getReminderCopy } from "../lib/billing-reminders";

interface CardRecord {
  id: string;
  userId: string;
  archived?: boolean;
  notificationCycleStartDay?: number;
}

interface SubscriptionRecord {
  endpoint: string;
  keys: { auth: string; p256dh: string };
}

interface NativeTokenRecord {
  token: string;
}

const timeZone = process.env.REMINDER_TIME_ZONE || "Asia/Kolkata";
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT;

if (!vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
  throw new Error("Set NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and VAPID_SUBJECT before running reminders.");
}

if (!getApps().length) {
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  initializeApp(serviceAccount ? { credential: cert(JSON.parse(serviceAccount)) } : { credential: applicationDefault() });
}

webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

function dateKey(date: { year: number; month: number; day: number }): string {
  return `${date.year}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
}

async function sendReminder(card: CardRecord, subscriptionId: string, subscription: SubscriptionRecord, reminder: ReturnType<typeof getBillingReminder>, today: ReturnType<typeof getCalendarDate>) {
  if (!reminder) return;
  const db = getFirestore();
  const deliveryId = `web_${card.id}_${subscriptionId}_${reminder}_${dateKey(today)}`;
  const deliveryRef = db.collection("notificationDeliveries").doc(deliveryId);

  try {
    await deliveryRef.create({ userId: card.userId, cardId: card.id, subscriptionId, reminder, date: dateKey(today), status: "RESERVED", createdAt: FieldValue.serverTimestamp() });
  } catch (error) {
    if ((error as { code?: number }).code === 6) return;
    throw error;
  }

  try {
    const copy = getReminderCopy(reminder);
    await webpush.sendNotification(subscription, JSON.stringify({ ...copy, icon: "/icon.png", url: "/statements" }));
    await deliveryRef.update({ status: "SENT", sentAt: FieldValue.serverTimestamp() });
    console.log(`Sent ${reminder} for card ${card.id}.`);
  } catch (error) {
    const statusCode = (error as { statusCode?: number }).statusCode;
    if (statusCode === 404 || statusCode === 410) {
      await db.collection("users").doc(card.userId).collection("pushSubscriptions").doc(subscriptionId).delete();
    }
    await deliveryRef.delete();
    console.error(`Push failed for card ${card.id}:`, error);
  }
}

async function sendNativeReminder(card: CardRecord, tokenId: string, nativeToken: NativeTokenRecord, reminder: ReturnType<typeof getBillingReminder>, today: ReturnType<typeof getCalendarDate>) {
  if (!reminder) return;
  const db = getFirestore();
  const deliveryId = `android_${card.id}_${tokenId}_${reminder}_${dateKey(today)}`;
  const deliveryRef = db.collection("notificationDeliveries").doc(deliveryId);

  try {
    await deliveryRef.create({ userId: card.userId, cardId: card.id, tokenId, reminder, date: dateKey(today), status: "RESERVED", createdAt: FieldValue.serverTimestamp() });
  } catch (error) {
    if ((error as { code?: number }).code === 6) return;
    throw error;
  }

  try {
    const copy = getReminderCopy(reminder);
    await getMessaging().send({
      token: nativeToken.token,
      notification: copy,
      data: { reminder, url: "/statements" },
      android: { priority: "high", notification: { channelId: "billing-reminders" } },
    });
    await deliveryRef.update({ status: "SENT", sentAt: FieldValue.serverTimestamp() });
    console.log(`Sent Android ${reminder} for card ${card.id}.`);
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "messaging/registration-token-not-registered" || code === "messaging/invalid-registration-token") {
      await db.collection("users").doc(card.userId).collection("nativePushTokens").doc(tokenId).delete();
    }
    await deliveryRef.delete();
    console.error(`Android push failed for card ${card.id}:`, error);
  }
}

async function main() {
  const db = getFirestore();
  const today = getCalendarDate(timeZone);
  const cards = await db.collection("cards").where("archived", "==", false).get();

  for (const cardDoc of cards.docs) {
    const card = { id: cardDoc.id, ...cardDoc.data() } as CardRecord;
    const reminder = getBillingReminder(today, card.notificationCycleStartDay || 0);
    if (!reminder) continue;

    const userRef = db.collection("users").doc(card.userId);
    const [subscriptions, nativeTokens] = await Promise.all([
      userRef.collection("pushSubscriptions").get(),
      userRef.collection("nativePushTokens").get(),
    ]);
    await Promise.all([
      ...subscriptions.docs.map((subscriptionDoc) => sendReminder(card, subscriptionDoc.id, subscriptionDoc.data() as SubscriptionRecord, reminder, today)),
      ...nativeTokens.docs.map((tokenDoc) => sendNativeReminder(card, tokenDoc.id, tokenDoc.data() as NativeTokenRecord, reminder, today)),
    ]);
  }
}

main().catch((error) => {
  console.error("Billing reminder worker failed:", error);
  process.exitCode = 1;
});
