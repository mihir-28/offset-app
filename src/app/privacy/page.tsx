import { siteConfig } from "../../lib/siteConfig";

const sections = [
  {
    title: "What Offset Does",
    body: "Offset helps you record card spending, group transactions into buckets, track deposits, and view statement balances.",
  },
  {
    title: "Account Sign-In",
    body: "You sign in with Google on the web or Android app so Offset can keep your records connected to your account. We receive your name, email address, profile photo, and account identifier from the sign-in provider to identify your account and show it inside the app.",
  },
  {
    title: "What Data Is Saved",
    body: "Offset saves the transactions, deposits, bucket names, billing cycle settings, and statement information you add or change in the app.",
  },
  {
    title: "How Your Data Is Protected",
    body: "Your transaction and statement details are protected before they are saved. Access to your records is tied to your signed-in account.",
  },
  {
    title: "Offline Data",
    body: "Offset may keep a local copy on your device so the app can load faster and continue working when your connection is poor. You can clear browser or app storage from your device settings.",
  },
  {
    title: "Data Sharing",
    body: "We do not sell your data, rent your data, or share it with advertisers. Offset uses Google services for sign-in and Firebase services for authentication and database synchronization. These providers process data as needed to provide those services.",
  },
  {
    title: "Android App",
    body: "The Android app requests internet access to sign in and synchronize your records. It does not request access to your contacts, location, camera, microphone, or files as part of the app’s current functionality.",
  },
  {
    title: "Account Deletion",
    body: "You can permanently delete your account from Settings > Account > Delete Account. This removes your profile, cards, transactions, and statements from Offset. Local cached copies may remain on a device until its app or browser storage is cleared.",
  },
  {
    title: "Contact",
    body: `Questions about privacy can be sent to ${siteConfig.email}.`,
  },
];

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#09090B] px-5 py-4 text-zinc-100 sm:px-6 sm:py-5">
      <div className="mx-auto w-full max-w-6xl">
        <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-[#111113]">
          <div className="border-b border-zinc-800/70 px-4 py-4">
            <h1 className="text-2xl font-extrabold tracking-tight text-white">Privacy Policy</h1>
            <p className="mt-2 text-xs text-zinc-500">Last updated: August 16, 2026</p>
          </div>
          <div className="grid lg:grid-cols-2">
            {sections.map((section, index) => (
              <div
                key={section.title}
                className={`border-b border-zinc-800/70 px-4 py-4 last:border-b-0 lg:border-r ${
                  index % 2 === 1 ? "lg:border-r-0" : ""
                } ${index >= sections.length - 2 ? "lg:border-b-0" : ""}`}
              >
                <h2 className="text-sm font-bold text-white">{section.title}</h2>
                <p className="mt-2 text-sm leading-6 text-zinc-400">{section.body}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
