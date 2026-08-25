# Billing reminders

Offset uses browser Web Push. Reminders are sent per enabled device:

- 3 days before a card's billing cycle starts.
- 1 day after bill generation.
- 10 days after bill generation.

## Setup

Generate VAPID keys once:

```powershell
npx web-push generate-vapid-keys
```

Set the VAPID values plus Firebase Admin credentials from `.env.example`. `NEXT_PUBLIC_VAPID_PUBLIC_KEY` is safe for the browser; never expose `VAPID_PRIVATE_KEY` or service-account credentials.

Deploy the updated Firestore rules. Then schedule this command once daily, after 09:00 in `REMINDER_TIME_ZONE`:

```powershell
npm run send-billing-reminders
```

Use any reliable scheduler with Node.js and access to Firestore, such as Cloud Scheduler with Cloud Run, GitHub Actions with protected secrets, or a server cron job. Static Firebase Hosting cannot run this worker itself.

Existing cards receive required non-sensitive billing-day metadata when their owner next signs in. Each reminder is deduplicated per card, device, reminder type, and date.
