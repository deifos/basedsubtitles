import Link from "next/link";
import { changelog, APP_VERSION, type ChangelogEntry } from "@/lib/changelog";
import { SiteFooter } from "@/components/site-footer";
import { BuyMeCoffee } from "@/components/buy-me-coffee";

export const metadata = {
  title: "Changelog | Based Subtitles",
  description: "See what's new in Based Subtitles - version history and release notes",
};

function ChangeTypeBadge({ type }: { type: ChangelogEntry["changes"][0]["type"] }) {
  const styles = {
    added: "bg-black text-white",
    changed: "bg-black/80 text-white",
    fixed: "bg-black/60 text-white",
    removed: "bg-black/40 text-white",
  };

  return (
    <span
      className={`inline-block px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${styles[type]}`}
    >
      {type}
    </span>
  );
}

function VersionBlock({ entry, isLatest }: { entry: ChangelogEntry; isLatest: boolean }) {
  return (
    <article className="relative">
      {/* Timeline connector */}
      <div className="absolute left-[11px] top-12 bottom-0 w-0.5 bg-black/10" />

      {/* Version header */}
      <div className="flex items-start gap-4 mb-6">
        {/* Timeline dot */}
        <div className="relative z-10 flex-shrink-0">
          <div
            className={`w-6 h-6 border-2 border-black flex items-center justify-center ${
              isLatest ? "bg-black" : "bg-white"
            }`}
          >
            {isLatest && (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
              </span>
            )}
          </div>
        </div>

        {/* Version info */}
        <div className="flex-1 -mt-0.5">
          <div className="flex flex-wrap items-center gap-3 mb-1">
            <h2 className="text-2xl md:text-3xl font-black tracking-tight">
              v{entry.version}
            </h2>
            {isLatest && (
              <span className="px-2 py-0.5 bg-black text-white text-[10px] font-bold uppercase tracking-wider">
                Latest
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-black/50">
            <time className="font-bold uppercase tracking-wider">
              {formatDate(entry.date)}
            </time>
            <span className="hidden sm:inline">&bull;</span>
            <span className="font-medium">{entry.title}</span>
          </div>
        </div>
      </div>

      {/* Changes list */}
      <div className="ml-10 mb-12">
        <div className="border-2 border-black bg-white">
          <div className="divide-y-2 divide-black/10">
            {entry.changes.map((change, index) => (
              <div
                key={index}
                className="flex items-start gap-3 p-4 hover:bg-black/[0.02] transition-colors"
              >
                <ChangeTypeBadge type={change.type} />
                <p className="text-sm text-black/80 leading-relaxed flex-1">
                  {change.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function ChangelogPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Grain overlay */}
      <div
        className="fixed inset-0 opacity-[0.03] pointer-events-none z-0"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Header */}
      <header className="relative z-10 border-b-2 border-black">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="w-8 h-8 bg-black flex items-center justify-center group-hover:bg-black/80 transition-colors rounded-lg">
                <span className="text-xs font-bold text-white tracking-tight">BS</span>
              </div>
              <span className="text-sm font-black uppercase tracking-tight">
                basedsubtitles
              </span>
            </Link>
            <Link
              href="/"
              className="font-bold text-xs uppercase tracking-wider px-4 py-2 border-2 border-black hover:bg-black hover:text-white transition-colors"
            >
              Back to App
            </Link>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10 flex-1">
        <div className="container mx-auto px-6 py-12 md:py-16">
          {/* Page header */}
          <div className="max-w-3xl mb-12 md:mb-16">
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight uppercase">
                Changelog
              </h1>
              <span className="px-3 py-1 border-2 border-black text-sm font-bold tracking-wider">
                v{APP_VERSION}
              </span>
            </div>
            <p className="text-lg text-black/60 leading-relaxed">
              Track all updates, improvements, and fixes to Based Subtitles.
              <span className="block mt-2 text-black font-semibold">
                Building in public, one release at a time.
              </span>
            </p>
          </div>

          {/* Changelog entries */}
          <div className="max-w-3xl">
            {changelog.map((entry, index) => (
              <VersionBlock
                key={entry.version}
                entry={entry}
                isLatest={index === 0}
              />
            ))}

            {/* End of changelog marker */}
            <div className="flex items-center gap-4 ml-[3px]">
              <div className="w-4 h-4 border-2 border-black/30 bg-black/10" />
              <span className="text-sm font-bold uppercase tracking-wider text-black/30">
                The beginning
              </span>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <SiteFooter />
      <BuyMeCoffee />
    </div>
  );
}
