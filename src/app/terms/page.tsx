import Link from "next/link";
import { BrandMark } from "../../components/brand-mark";
import { siteConfig } from "../../lib/siteConfig";

const sections = [
  {
    title: "Using Offset",
    body: "Offset is a personal tracking tool for card liabilities, buckets, deposits, and statement balances. You are responsible for checking that the records you enter are correct.",
  },
  {
    title: "Your Account",
    body: "You need a Google account to use Offset. Keep your Google account secure. If you lose access to your Google account, you may also lose access to Offset records linked to it.",
  },
  {
    title: "Your Data",
    body: "You own the information you add to Offset. The app stores it so you can view, update, and manage your own records.",
  },
  {
    title: "App Availability",
    body: "We try to keep Offset available and working well, but the app may sometimes be unavailable because of maintenance, network issues, service outages, or changes outside our control.",
  },
  {
    title: "No Financial or Legal Advice",
    body: "Offset helps organize information. It does not provide financial, accounting, tax, or legal advice. Decisions based on your records are your responsibility.",
  },
  {
    title: "Acceptable Use",
    body: "Do not misuse Offset, try to access someone else's records, disrupt the service, or use the app for illegal activity.",
  },
  {
    title: "Changes and Contact",
    body: `We may update these terms when Offset changes. Questions can be sent to ${siteConfig.email}.`,
  },
];

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#09090B] px-6 py-5 text-zinc-100">
      <div className="w-full max-w-md space-y-4">
        <Link href="/login" className="inline-flex items-center gap-3 text-sm font-semibold text-zinc-300 hover:text-white">
          <BrandMark className="h-9 w-9 rounded-xl border-blue-400/20 shadow-none" />
          Offset
        </Link>

        <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-[#111113]">
          <div className="border-b border-zinc-800/70 px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-blue-400">Terms of Service</p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-white">Terms of Service</h1>
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
