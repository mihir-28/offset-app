import Link from "next/link";
import { BrandMark } from "../../components/brand-mark";
import { siteConfig } from "../../lib/siteConfig";

const sections = [
  {
    title: "What Offset Does",
    body: "Offset helps you record card spending, group transactions into buckets, track deposits, and view statement balances.",
  },
  {
    title: "Account Sign-In",
    body: "You sign in with Google so Offset can keep your records connected to your account. We use your name, email address, and profile photo only to show your account inside the app.",
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
    body: "We do not sell your data, rent your data, or share it with advertisers. Your data is used to run Offset and show your own records back to you.",
  },
  {
    title: "Contact",
    body: `Questions about privacy can be sent to ${siteConfig.email}.`,
  },
];

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#09090B] px-6 py-5 text-zinc-100">
      <div className="w-full max-w-md space-y-4">
        <Link href="/login" className="inline-flex items-center gap-3 text-sm font-semibold text-zinc-300 hover:text-white">
          <BrandMark className="h-9 w-9 rounded-xl border-blue-400/20 shadow-none" />
          Offset
        </Link>

        <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-[#111113]">
          <div className="border-b border-zinc-800/70 px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-blue-400">Privacy Policy</p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-white">Privacy Policy</h1>
            <p className="mt-2 text-xs text-zinc-500">Last updated: June 27, 2026</p>
          </div>
          <div>
            {sections.map((section) => (
              <div key={section.title} className="border-b border-zinc-800/70 px-4 py-4 last:border-b-0">
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
