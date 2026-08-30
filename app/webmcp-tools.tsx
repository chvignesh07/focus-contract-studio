'use client';

import { useEffect, useState } from 'react';

import {
  Package2ToolRegistry,
  type ModelContextLike,
} from '../lib/webmcp/register';

type ToolState = 'registered' | 'unsupported' | 'error';

type ToolDocument = Document & {
  modelContext?: ModelContextLike;
};

const copy: Record<ToolState, string> = {
  registered: 'Two bounded Site tools are registered for this page.',
  unsupported:
    'Site tools are unavailable here. The complete review still works on this page.',
  error:
    'Site tools could not be registered. The complete review still works on this page.',
};

export function WebMcpTools({ csrfToken }: { csrfToken: string }) {
  const [state, setState] = useState<ToolState>('unsupported');

  useEffect(() => {
    const modelContext = (document as ToolDocument).modelContext;
    if (typeof modelContext?.registerTool !== 'function') {
      return;
    }
    const registry = new Package2ToolRegistry({
      csrfToken,
      fetcher: window.fetch.bind(window),
    });
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
  }, [csrfToken]);

  return (
    <p aria-live="polite" className="tool-status" data-tool-state={state} role="status">
      {copy[state]}
    </p>
  );
}
