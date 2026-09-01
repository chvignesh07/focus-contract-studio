'use client';

import { useEffect, useState } from 'react';

import {
  FcsWebMcpV2Registry,
  type FcsWebMcpV2ModelContextLike,
} from '../lib/webmcp/register';

type ToolState = 'registered' | 'unsupported' | 'error';

type ToolDocument = Document & {
  modelContext?: FcsWebMcpV2ModelContextLike;
};

const copy: Record<ToolState, string> = {
  registered: 'Four bounded Site tools are registered for this page.',
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
    const registry = new FcsWebMcpV2Registry({
      csrfToken,
      fetcher: window.fetch.bind(window),
      pageKey: csrfToken,
      currentPageKey: () => csrfToken,
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
