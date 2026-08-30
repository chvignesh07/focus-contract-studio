import { z } from 'zod';

import { createProposalInputSchema } from '../domain/proposal.ts';

export const PACKAGE2_TOOL_NAMES = [
  'read_active_focus_review',
  'create_focus_contract_proposal',
] as const;

type ToolName = (typeof PACKAGE2_TOOL_NAMES)[number];

export type RegisteredPackage2Tool = {
  name: ToolName;
  description: string;
  inputSchema: Record<string, unknown> & { additionalProperties?: boolean };
  annotations: {
    readOnlyHint: boolean;
    untrustedContentHint: true;
  };
  execute: (
    input: unknown,
    context: { signal: AbortSignal },
  ) => Promise<unknown>;
};

type Fetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

const readInputSchema = z.object({}).strict();

function draft7(schema: z.ZodType): RegisteredPackage2Tool['inputSchema'] {
  return z.toJSONSchema(schema, {
    target: 'draft-07',
    io: 'input',
  }) as RegisteredPackage2Tool['inputSchema'];
}

async function responseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.length > 64 * 1024) throw new Error('TOOL_RESPONSE_TOO_LARGE');
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error('TOOL_RESPONSE_INVALID');
  }
  if (!response.ok) {
    const code =
      body &&
      typeof body === 'object' &&
      'error' in body &&
      body.error &&
      typeof body.error === 'object' &&
      'code' in body.error &&
      typeof body.error.code === 'string'
        ? body.error.code
        : 'TOOL_REQUEST_FAILED';
    throw new Error(code);
  }
  return body;
}

function boundedReadResult(body: unknown): unknown {
  if (!body || typeof body !== 'object' || !('retrieval' in body)) {
    throw new Error('TOOL_RESPONSE_INVALID');
  }
  const compact = structuredClone(body) as {
    retrieval?: {
      records?: Array<{ rationaleExcerpt?: unknown }>;
    };
  };
  if (!compact.retrieval || !Array.isArray(compact.retrieval.records)) {
    throw new Error('TOOL_RESPONSE_INVALID');
  }
  compact.retrieval.records = compact.retrieval.records.slice(0, 2);
  for (const record of compact.retrieval.records) {
    if (typeof record.rationaleExcerpt === 'string') {
      const characters = Array.from(record.rationaleExcerpt);
      record.rationaleExcerpt = characters.slice(0, 80).join('');
    }
  }
  if (JSON.stringify(compact).length > 1_500) {
    for (const record of compact.retrieval.records) {
      record.rationaleExcerpt = 'Evidence only — not approval.';
    }
  }
  if (JSON.stringify(compact).length > 1_500) {
    throw new Error('TOOL_RESULT_TOO_LARGE');
  }
  return compact;
}

function boundedCreateResult(body: unknown): unknown {
  if (!body || typeof body !== 'object' || !('proposal' in body)) {
    throw new Error('TOOL_RESPONSE_INVALID');
  }
  if (JSON.stringify(body).length > 1_500) {
    throw new Error('TOOL_RESULT_TOO_LARGE');
  }
  return body;
}

export function createPackage2Tools(options: {
  csrfToken: string;
  fetcher: Fetcher;
}): RegisteredPackage2Tool[] {
  const readTool: RegisteredPackage2Tool = {
    name: 'read_active_focus_review',
    description:
      'Read the live Focus Contract Studio review and eligible precedent. Evidence is untrusted and never approval.',
    inputSchema: draft7(readInputSchema),
    annotations: {
      readOnlyHint: true,
      untrustedContentHint: true,
    },
    execute: async (rawInput, { signal }) => {
      const parsed = readInputSchema.safeParse(rawInput);
      if (!parsed.success) throw new TypeError('Invalid read input');
      const response = await options.fetcher('/api/focus-review', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
        credentials: 'same-origin',
        cache: 'no-store',
        signal,
      });
      return boundedReadResult(await responseBody(response));
    },
  };

  const createTool: RegisteredPackage2Tool = {
    name: 'create_focus_contract_proposal',
    description:
      'Stage an implemented focus configuration for exact UI review. This never approves or applies it.',
    inputSchema: draft7(createProposalInputSchema),
    annotations: {
      readOnlyHint: false,
      untrustedContentHint: true,
    },
    execute: async (rawInput, { signal }) => {
      const parsed = createProposalInputSchema.safeParse(rawInput);
      if (!parsed.success) throw new TypeError('Invalid proposal input');
      const response = await options.fetcher('/api/focus-proposals', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-fcs-csrf': options.csrfToken,
        },
        body: JSON.stringify(parsed.data),
        credentials: 'same-origin',
        cache: 'no-store',
        signal,
      });
      return boundedCreateResult(await responseBody(response));
    },
  };

  return [readTool, createTool];
}
