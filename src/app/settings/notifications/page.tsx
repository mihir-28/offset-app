"use client";

import Link from "next/link";
import { ArrowLeft, Bell, BellOff, CheckCircle2, Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Capacitor, type PluginListenerHandle } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { collection, deleteDoc, doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { useAuth } from "../../../context/auth-context";
import { db } from "../../../lib/firebase";
import { Button } from "../../../components/ui/button";

function urlBase64ToUint8Array(value: string): Uint8Array<ArrayBuffer> {
  const base64 = `${value}${"=".repeat((4 - (value.length % 4)) % 4)}`.replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

async function deviceId(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function nativeTokenStorageKey(userId: string): string {
  return `offset-native-push-token-${userId}`;
}

export default function NotificationSettingsPage() {
  const { user } = useAuth();
  const isNativeAndroid = Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [permission, setPermission] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  const saveWebSubscription = useCallback(async (subscription: PushSubscription) => {
    if (!user) throw new Error("Sign in before enabling reminders.");
    const id = await deviceId(subscription.endpoint);
    const keys = subscription.toJSON().keys;
    await setDoc(doc(collection(db, "users", user.uid, "pushSubscriptions"), id), {
      userId: user.uid,
      endpoint: subscription.endpoint,
      keys: { auth: keys?.auth, p256dh: keys?.p256dh },
      userAgent: navigator.userAgent,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  }, [user]);

  const saveNativeToken = useCallback(async (token: string) => {
    if (!user) throw new Error("Sign in before enabling reminders.");
    const id = await deviceId(token);
    await setDoc(doc(collection(db, "users", user.uid, "nativePushTokens"), id), {
      userId: user.uid,
      token,
      platform: "android",
      updatedAt: serverTimestamp(),
    }, { merge: true });
    window.localStorage.setItem(nativeTokenStorageKey(user.uid), id);
    return id;
  }, [user]);

  useEffect(() => {
    let alive = true;

    const checkSubscription = async () => {
      if (isNativeAndroid) {
        try {
          const status = await PushNotifications.checkPermissions();
          const tokenId = user ? window.localStorage.getItem(nativeTokenStorageKey(user.uid)) : null;
          const tokenDoc = tokenId && user ? await getDoc(doc(db, "users", user.uid, "nativePushTokens", tokenId)) : null;
          if (alive) {
            setSupported(true);
            setEnabled(Boolean(tokenDoc?.exists()));
            setPermission(status.receive);
          }
        } catch (cause) {
          console.error("Native notification support check failed:", cause);
          if (alive) setError("Could not prepare Android notifications. Check Firebase setup and try again.");
        } finally {
          if (alive) setLoading(false);
        }
        return;
      }

      const isSupported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      if (!isSupported) {
        if (alive) { setSupported(false); setLoading(false); }
        return;
      }

      try {
        const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
        const subscription = await registration.pushManager.getSubscription();
        if (subscription && user) await saveWebSubscription(subscription);
        if (alive) {
          setSupported(true);
          setEnabled(Boolean(subscription));
          setPermission(Notification.permission);
        }
      } catch (cause) {
        console.error("Notification support check failed:", cause);
        if (alive) setError("Could not prepare notifications. Check your browser settings and try again.");
      } finally {
        if (alive) setLoading(false);
      }
    };

    void checkSubscription();
    return () => { alive = false; };
  }, [isNativeAndroid, saveWebSubscription, user]);

  const enableNative = async () => {
    let permissionStatus = await PushNotifications.checkPermissions();
    if (permissionStatus.receive === "prompt" || permissionStatus.receive === "prompt-with-rationale") {
      permissionStatus = await PushNotifications.requestPermissions();
    }
    setPermission(permissionStatus.receive);
    if (permissionStatus.receive !== "granted") throw new Error("Android notification permission was not granted.");

    await PushNotifications.createChannel({ id: "billing-reminders", name: "Billing reminders", description: "Billing-cycle and payment reminders", importance: 4, vibration: true });

    const token = await new Promise<string>(async (resolve, reject) => {
      let registrationListener: PluginListenerHandle | undefined;
      let errorListener: PluginListenerHandle | undefined;
      // ponytail: FCM can go silent (Cloud Messaging API disabled) and never fire either event.
      let timer: ReturnType<typeof setTimeout> | undefined;
      const cleanUp = async () => {
        clearTimeout(timer);
        return Promise.all([registrationListener?.remove(), errorListener?.remove()]);
      };

      try {
        registrationListener = await PushNotifications.addListener("registration", ({ value }) => {
          void cleanUp().then(() => resolve(value));
        });
        errorListener = await PushNotifications.addListener("registrationError", (event) => {
          const detail = typeof event?.error === "string" ? event.error : JSON.stringify(event);
          void cleanUp().then(() => reject(new Error(`FCM registration failed: ${detail}`)));
        });
        timer = setTimeout(() => {
          void cleanUp().then(() => reject(new Error("FCM registration timed out. Check that Firebase Cloud Messaging API (V1) is enabled.")));
        }, 20000);
        await PushNotifications.register();
      } catch (cause) {
        await cleanUp();
        reject(cause);
      }
    });

    try {
      await saveNativeToken(token);
    } catch (cause) {
      throw new Error(`Got FCM token but saving it failed: ${cause instanceof Error ? cause.message : String(cause)}`);
    }
    setEnabled(true);
  };

  const enable = async () => {
    if (!isNativeAndroid && !vapidPublicKey) {
      setError("Notifications are not configured yet.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (isNativeAndroid) {
        await enableNative();
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey!),
      });
      await saveWebSubscription(subscription);
      setEnabled(true);
      setPermission(Notification.permission);
    } catch (cause) {
      console.error("Notification subscription failed:", cause);
      const denied = isNativeAndroid ? permission === "denied" : Notification.permission === "denied";
      if (!isNativeAndroid) setPermission(Notification.permission);
      setError(denied
        ? "Notifications are blocked in device settings."
        : `Could not enable notifications: ${cause instanceof Error ? cause.message : String(cause)}`);
    } finally {
      setLoading(false);
    }
  };

  const disable = async () => {
    setLoading(true);
    setError(null);
    try {
      if (isNativeAndroid) {
        const tokenId = user ? window.localStorage.getItem(nativeTokenStorageKey(user.uid)) : null;
        if (tokenId && user) await deleteDoc(doc(db, "users", user.uid, "nativePushTokens", tokenId));
        await PushNotifications.unregister();
        if (user) window.localStorage.removeItem(nativeTokenStorageKey(user.uid));
      } else {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (subscription && user) {
          await deleteDoc(doc(db, "users", user.uid, "pushSubscriptions", await deviceId(subscription.endpoint)));
          await subscription.unsubscribe();
        }
      }
      setEnabled(false);
    } catch (cause) {
      console.error("Notification unsubscription failed:", cause);
      setError("Could not disable notifications. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const configured = isNativeAndroid || Boolean(vapidPublicKey);

  return (
    <div className="mx-auto w-full max-w-md space-y-5">
      <Link href="/settings" className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-400 hover:text-white"><ArrowLeft className="h-4 w-4" /> Settings</Link>
      <div><h2 className="text-2xl font-bold text-white">Notifications</h2><p className="mt-1 text-xs text-zinc-500">Receive billing-cycle and bill-payment reminders on this device.</p></div>
      <section className="rounded-2xl border border-zinc-800 bg-[#111113] p-4">
        <div className="flex gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">{enabled ? <CheckCircle2 className="h-5 w-5" /> : <Bell className="h-5 w-5" />}</div><div><h3 className="text-sm font-bold text-zinc-100">Billing reminders</h3><p className="mt-1 text-xs leading-relaxed text-zinc-500">3 days before each cycle, then 1 and 10 days after bill generation.</p></div></div>
        {error && <p role="alert" className="mt-4 select-text rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs wrap-break-word whitespace-pre-wrap text-red-300">{error}</p>}
        {!loading && !supported && <p className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-200">This device does not support push notifications.</p>}
        {!loading && supported && !configured && <p className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-200">Notifications are not configured yet.</p>}
        <Button onClick={() => void (enabled ? disable() : enable())} disabled={loading || !supported || !configured || permission === "denied"} className="mt-4 h-10 w-full rounded-xl bg-blue-500 text-xs font-bold text-black hover:bg-blue-400 disabled:bg-zinc-800 disabled:text-zinc-500">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : enabled ? <><BellOff className="mr-1.5 h-4 w-4" /> Disable reminders</> : <><Bell className="mr-1.5 h-4 w-4" /> Enable reminders</>}
        </Button>
      </section>
    </div>
  );
}
