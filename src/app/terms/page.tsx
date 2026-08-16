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
    <main className="min-h-screen bg-[#09090B] px-5 py-4 text-zinc-100 sm:px-6 sm:py-5">
      <div className="mx-auto w-full max-w-6xl">
        <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-[#111113]">
          <div className="border-b border-zinc-800/70 px-4 py-4">
            <h1 className="text-2xl font-extrabold tracking-tight text-white">Terms of Service</h1>
            <p className="mt-2 text-xs text-zinc-500">Last updated: June 27, 2026</p>
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
