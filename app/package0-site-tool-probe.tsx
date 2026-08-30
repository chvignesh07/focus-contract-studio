'use client';

import { useEffect, useState } from 'react';

import {
  PACKAGE0_TOOL_NAME,
  Package0ProbeRegistry,
  type ModelContextLike,
} from '@/probes/webmcp/package0-tool';

type ProbeState = 'registered' | 'unsupported' | 'error';

type SiteToolDocument = Document & {
  modelContext?: ModelContextLike;
};

const probeCopy: Record<ProbeState, string> = {
  registered: `Read-only tool ${PACKAGE0_TOOL_NAME} is registered.`,
  unsupported:
    'This browser does not expose the imperative Site-tools API. The page remains usable.',
  error: 'The Site-tools API was present, but registration failed.',
};

export function Package0SiteToolProbe() {
  const [state, setState] = useState<ProbeState>('unsupported');

  useEffect(() => {
    const modelContext = (document as SiteToolDocument).modelContext;

    if (typeof modelContext?.registerTool !== 'function') {
      return;
    }

    const registry = new Package0ProbeRegistry();
    let mounted = true;

    void registry
      .install(modelContext)
      .then(() => {
        if (mounted) setState('registered');
      })
      .catch(() => {
        if (mounted) setState('error');
      });

    return () => {
      mounted = false;
      registry.dispose();
    };
  }, []);

  return (
    <section
      aria-live="polite"
      className="mt-5 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3"
      data-site-tool-state={state}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-stone-500">
        Package 0 Site-tool probe
      </p>
      <p className="mt-1 text-sm text-stone-700">{probeCopy[state]}</p>
    </section>
  );
}
