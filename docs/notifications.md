# Billing reminders

Offset sends reminders per enabled device: browser Web Push for the PWA and Firebase Cloud Messaging (FCM) for Android.

- 3 days before a card's billing cycle starts.
- 1 day after bill generation.
- 10 days after bill generation.

## Setup

Generate VAPID keys once:

```powershell
npx web-push generate-vapid-keys
```

Set the VAPID values plus Firebase Admin credentials from `.env.example`. `NEXT_PUBLIC_VAPID_PUBLIC_KEY` is safe for the browser; never expose `VAPID_PRIVATE_KEY` or service-account credentials.

For Android, add the Firebase project's `google-services.json` to `android/app/google-services.json`. The Android app ID must be `com.afterthought.offset`. This file is intentionally ignored by Git. When preparing an APK, run one web build and then sync native assets:

```powershell
npm run build
npx cap sync android
```

Deploy the updated Firestore rules. Then schedule this command once daily, after 09:00 in `REMINDER_TIME_ZONE`:

```powershell
npm run send-billing-reminders
```

Use any reliable scheduler with Node.js and access to Firestore, such as Cloud Scheduler with Cloud Run, GitHub Actions with protected secrets, or a server cron job. Static Firebase Hosting cannot run this worker itself.

Existing cards receive required non-sensitive billing-day metadata when their owner next signs in. Each reminder is deduplicated per card, device, reminder type, and date.
