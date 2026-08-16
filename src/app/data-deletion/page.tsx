import Link from "next/link";
import { siteConfig } from "../../lib/siteConfig";

export const metadata = {
  title: "Account and Data Deletion",
  description: "How to delete your Offset account and associated data.",
};

export default function DataDeletionPage() {
  return (
    <main className="min-h-screen bg-[#09090B] px-5 py-4 text-zinc-100 sm:px-6 sm:py-5">
      <div className="mx-auto w-full max-w-3xl">
        <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-[#111113]">
          <div className="border-b border-zinc-800/70 px-5 py-5 sm:px-6">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-blue-400">Offset</p>
            <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-white">Account and data deletion</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
              You can permanently delete your Offset account and all data associated with it at any time.
            </p>
          </div>

          <div className="space-y-6 px-5 py-5 sm:px-6">
            <section>
              <h2 className="text-base font-bold text-white">Delete your account in the app</h2>
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-zinc-400">
                <li>Sign in to Offset.</li>
                <li>Open <strong className="font-semibold text-zinc-200">Settings</strong> and select <strong className="font-semibold text-zinc-200">Account</strong>.</li>
                <li>Select <strong className="font-semibold text-zinc-200">Delete Account</strong> and confirm the request.</li>
              </ol>
              <Link
                href="/settings/account"
                className="mt-4 inline-flex rounded-xl bg-red-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-600"
              >
                Go to account deletion
              </Link>
            </section>

            <section className="border-t border-zinc-800/70 pt-5">
              <h2 className="text-base font-bold text-white">If you cannot sign in</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                Email <a className="text-blue-400 underline underline-offset-4 hover:text-blue-300" href={`mailto:${siteConfig.email}?subject=Offset%20account%20deletion%20request`}>{siteConfig.email}</a> from the email address linked to your Offset account with the subject “Offset account deletion request.” We may ask for information needed to verify that the account belongs to you.
              </p>
            </section>

            <section className="border-t border-zinc-800/70 pt-5">
              <h2 className="text-base font-bold text-white">What is deleted</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                Deleting an account removes its profile, cards, transactions, statement cycles, and statement information from Offset. The account can no longer be used to access these records.
              </p>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                A local cached copy may remain on your device until you clear the app or browser storage. Offset does not offer deletion of individual records while keeping the account; deleting the account deletes the associated stored data.
              </p>
            </section>

            <p className="border-t border-zinc-800/70 pt-5 text-xs leading-5 text-zinc-500">
              For more information about how Offset handles data, see the <Link href="/privacy" className="text-zinc-300 underline underline-offset-4 hover:text-white">Privacy Policy</Link>.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
