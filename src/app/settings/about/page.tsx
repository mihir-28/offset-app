import Link from "next/link";
import { ArrowLeft, ChevronRight, ExternalLink, Globe, Mail, MapPin } from "lucide-react";
import { siteConfig } from "../../../lib/siteConfig";

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="currentColor">
      <path d="M12 .5A11.5 11.5 0 0 0 .5 12.28c0 5.2 3.3 9.6 7.9 11.17.58.11.79-.25.79-.56v-2.14c-3.22.72-3.9-1.42-3.9-1.42-.52-1.38-1.28-1.75-1.28-1.75-1.05-.74.08-.72.08-.72 1.16.08 1.78 1.23 1.78 1.23 1.03 1.82 2.7 1.3 3.36.99.1-.77.4-1.3.73-1.6-2.57-.3-5.27-1.32-5.27-5.89 0-1.3.45-2.36 1.19-3.2-.12-.3-.52-1.52.12-3.16 0 0 .98-.32 3.17 1.22a10.7 10.7 0 0 1 5.78 0c2.2-1.54 3.17-1.22 3.17-1.22.64 1.64.24 2.86.12 3.16.74.84 1.19 1.9 1.19 3.2 0 4.58-2.7 5.59-5.28 5.88.42.38.78 1.11.78 2.23v3.3c0 .31.2.68.8.56a11.78 11.78 0 0 0 7.87-11.17A11.5 11.5 0 0 0 12 .5Z" />
    </svg>
  );
}

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="currentColor">
      <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5.01 2.5 2.5 0 0 1 0-5.01ZM3 9.75h4v10.75H3V9.75Zm6.25 0h3.83v1.47h.06c.53-.95 1.84-1.95 3.78-1.95 4.04 0 4.78 2.56 4.78 5.9v5.33h-4v-4.72c0-1.13-.02-2.58-1.63-2.58-1.64 0-1.89 1.23-1.89 2.5v4.8h-3.93V9.75Z" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="currentColor">
      <path d="M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.66l-5.21-6.82-5.97 6.82H1.68l7.73-8.84L1.25 2.25h6.83l4.71 6.23 5.45-6.23Zm-1.16 17.52h1.83L7.08 4.13H5.12l11.96 15.64Z" />
    </svg>
  );
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="currentColor">
      <path d="M7.8 2.75h8.4A5.06 5.06 0 0 1 21.25 7.8v8.4a5.06 5.06 0 0 1-5.05 5.05H7.8a5.06 5.06 0 0 1-5.05-5.05V7.8A5.06 5.06 0 0 1 7.8 2.75Zm0 1.8A3.26 3.26 0 0 0 4.55 7.8v8.4a3.26 3.26 0 0 0 3.25 3.25h8.4a3.26 3.26 0 0 0 3.25-3.25V7.8a3.26 3.26 0 0 0-3.25-3.25H7.8Zm4.2 3.1a4.35 4.35 0 1 1 0 8.7 4.35 4.35 0 0 1 0-8.7Zm0 1.8a2.55 2.55 0 1 0 0 5.1 2.55 2.55 0 0 0 0-5.1Zm4.57-2.25a1.02 1.02 0 1 1 0 2.05 1.02 1.02 0 0 1 0-2.05Z" />
    </svg>
  );
}

const socialItems = [
  { label: "Website", href: siteConfig.socialLinks.website, icon: Globe },
  { label: "GitHub", href: siteConfig.socialLinks.github, icon: GitHubIcon },
  { label: "LinkedIn", href: siteConfig.socialLinks.linkedin, icon: LinkedInIcon },
  { label: "X", href: siteConfig.socialLinks.x, icon: XIcon },
  { label: "Instagram", href: siteConfig.socialLinks.instagram, icon: InstagramIcon },
].filter((item) => item.href);

export default function AboutSettingsPage() {
  return (
    <div className="w-full max-w-md space-y-4">
      <div className="space-y-4 border-b border-zinc-800 pb-4">
        <Link href="/settings" className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-400 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Settings
        </Link>
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">About</h2>
          <p className="mt-1 text-xs text-zinc-500">App and developer details.</p>
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-[#111113]">
        <div className="border-b border-zinc-800/70 px-4 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-blue-400">About</p>
          <h3 className="mt-1 text-2xl font-extrabold tracking-tight text-white">{siteConfig.name}</h3>
          <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-400">{siteConfig.description}</p>
        </div>

        <a
          href={`mailto:${siteConfig.email}`}
          className="flex min-h-13 items-center gap-3 border-b border-zinc-800/70 px-4 py-3 text-sm font-semibold text-zinc-200 hover:bg-zinc-900/80"
        >
          <Mail className="h-4 w-4 shrink-0 text-blue-400" />
          <span className="min-w-0 flex-1 truncate">{siteConfig.email}</span>
          <ChevronRight className="h-4 w-4 text-zinc-600" />
        </a>

        <div className="flex min-h-13 items-center gap-3 border-b border-zinc-800/70 px-4 py-3 text-sm font-semibold text-zinc-200">
          <MapPin className="h-4 w-4 shrink-0 text-blue-400" />
          <span className="min-w-0 flex-1 truncate">{siteConfig.location}</span>
        </div>

        <div>
          {socialItems.map((item) => {
            const Icon = item.icon;
            return (
              <a
                key={item.label}
                href={item.href}
                target="_blank"
                rel="noreferrer"
                className="flex min-h-13 items-center gap-3 border-b border-zinc-800/70 px-4 py-3 text-sm font-semibold text-zinc-200 last:border-b-0 hover:bg-zinc-900/80"
              >
                <Icon className="h-4 w-4 shrink-0 text-blue-400" />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                <ExternalLink className="h-3.5 w-3.5 text-zinc-600" />
              </a>
            );
          })}
        </div>
      </section>
    </div>
  );
}
