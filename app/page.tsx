import { Package0HostedProbePanel } from './package0-hosted-probe-panel';
import { Package0SiteToolProbe } from './package0-site-tool-probe';

const sidebarWidths = [74, 58, 82, 66, 71, 54];
const articleWidths = [100, 97, 94, 98, 86];

export default function Home() {
  return (
    <main className="relative min-h-[max(100vh,720px)] overflow-x-hidden bg-[#fbfaf8] text-zinc-900">
      <header
        aria-hidden="true"
        className="grid h-[76px] grid-cols-[1fr_auto_1fr] items-center border-b border-stone-200 bg-white/95 px-6 sm:px-14"
      >
        <div className="flex items-center gap-3">
          <span className="h-9 w-9 rounded-full bg-stone-100" />
          <span className="h-3.5 w-28 rounded-full bg-stone-100" />
        </div>
        <span className="hidden h-9 w-[min(30vw,420px)] rounded-xl bg-stone-100 sm:block" />
        <div className="flex items-center justify-end gap-3">
          <span className="hidden h-9 w-9 rounded-full bg-stone-100 sm:block" />
          <span className="h-9 w-24 rounded-xl bg-stone-100" />
        </div>
      </header>

      <div
        aria-hidden="true"
        className="grid h-[calc(100vh-76px)] min-h-[644px] grid-cols-[180px_minmax(0,1fr)_260px] gap-10 px-6 pb-24 pt-10 opacity-55 max-lg:grid-cols-[150px_minmax(0,1fr)] max-sm:h-[calc(100vh-76px)] max-sm:min-h-0 max-sm:grid-cols-1 sm:px-14"
      >
        <aside className="hidden border-r border-stone-200 pr-7 sm:block">
          <div className="mb-6 h-2.5 w-16 rounded-full bg-stone-200" />
          <div className="space-y-4">
            {sidebarWidths.map((width) => (
              <div key={width} className="flex items-center gap-3">
                <span className="h-4 w-4 rounded bg-stone-200" />
                <span
                  className="h-2.5 rounded-full bg-stone-200"
                  style={{ width: `${width}%` }}
                />
              </div>
            ))}
          </div>
          <div className="mb-6 mt-9 h-2.5 w-24 rounded-full bg-stone-200" />
          <div className="space-y-4">
            {sidebarWidths.slice(0, 3).map((width) => (
              <span
                key={width}
                className="block h-2.5 rounded-full bg-stone-200"
                style={{ width: `${width}%` }}
              />
            ))}
          </div>
        </aside>

        <article className="mx-auto flex w-full max-w-3xl flex-col gap-6">
          <div className="space-y-3">
            <div className="h-2.5 w-28 rounded-full bg-stone-200" />
            <div className="h-7 w-4/5 rounded-lg bg-stone-200" />
            <div className="h-7 w-3/5 rounded-lg bg-stone-200" />
          </div>
          <div className="min-h-[240px] flex-1 rounded-2xl bg-stone-200" />
          <div className="flex items-center gap-3">
            <span className="h-9 w-9 rounded-full bg-stone-200" />
            <span className="h-2.5 w-28 rounded-full bg-stone-200" />
          </div>
          <div className="space-y-2">
            {articleWidths.map((width) => (
              <span
                key={width}
                className="block h-2.5 rounded-full bg-stone-200"
                style={{ width: `${width}%` }}
              />
            ))}
          </div>
        </article>

        <aside className="space-y-5 max-lg:hidden">
          {[0, 1].map((card) => (
            <div
              key={card}
              className="space-y-4 rounded-2xl border border-stone-200 bg-white/70 p-6"
            >
              <span className="block h-10 w-10 rounded-full bg-stone-200" />
              <span className="block h-3 w-3/5 rounded-full bg-stone-200" />
              <span className="block h-2.5 w-full rounded-full bg-stone-200" />
              <span className="block h-2.5 w-4/5 rounded-full bg-stone-200" />
              <span className="block h-8 w-24 rounded-lg bg-stone-200" />
            </div>
          ))}
        </aside>
      </div>

      <section
        aria-labelledby="package0-heading"
        className="absolute left-1/2 top-[clamp(96px,13vh,122px)] w-[min(620px,calc(100%-40px))] -translate-x-1/2 rounded-[18px] border border-stone-200 bg-white/95 px-5 py-5 shadow-[0_18px_50px_rgb(24_24_27/9%)] backdrop-blur-sm max-sm:relative max-sm:left-auto max-sm:top-auto max-sm:mx-5 max-sm:mb-10 max-sm:mt-[calc(96px-100vh)] max-sm:w-auto max-sm:translate-x-0"
      >
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.09em] text-stone-500">
          Building your site
        </p>
        <h1
          id="package0-heading"
          className="text-xl font-semibold tracking-tight"
        >
          Focus Contract Studio — Package 0
        </h1>
        <p className="mt-1 text-sm text-stone-500">
          Bootstrap verification only. Product work begins in Package 1.
        </p>
        <Package0SiteToolProbe />
        <Package0HostedProbePanel />
      </section>
    </main>
  );
}
