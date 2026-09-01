import { env } from 'cloudflare:workers';
import { z } from 'zod';

import { undoRevision } from '../../../../../lib/server/package5-apply-history-undo.ts';
import { FcsError } from '../../../../../lib/server/errors.ts';
import { errorResponse, jsonNoStore, methodNotAllowed } from '../../../../../lib/server/http.ts';
import { readStrictJsonMutation } from '../../../../../lib/server/request-security.ts';
import { runtimeSecurityConfig } from '../../../../../lib/server/runtime-config.ts';
import { resolveWorkspaceEvidenceSession } from '../../../../../lib/server/workspaces.ts';

const inputSchema = z.object({
  expectedImplementedRevision: z.number().int().positive(),
  idempotencyKey: z.uuid(),
}).strict();

type RouteContext = { params: Promise<{ revision: string }> };

export async function GET(): Promise<Response> {
  return methodNotAllowed();
}

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  try {
    const restoreRevision = Number((await context.params).revision);
    if (!Number.isSafeInteger(restoreRevision) || restoreRevision < 1) {
      throw new FcsError('INVALID_INPUT', 'The undo input is invalid.', 400);
    }
    const configuration = runtimeSecurityConfig();
    const now = Math.floor(Date.now() / 1_000);
    const session = await resolveWorkspaceEvidenceSession({
      db: env.DB,
      cookieHeader: request.headers.get('cookie'),
      now,
      sessionSecret: configuration.sessionSecret,
    });
    const body = await readStrictJsonMutation(request, {
      expectedOrigin: configuration.publicOrigin,
      csrfDigest: session.csrfDigest,
      maxBytes: 256,
    });
    const parsed = inputSchema.safeParse(body);
    if (!parsed.success) throw new FcsError('INVALID_INPUT', 'The undo input is invalid.', 400);
    const result = await undoRevision({
      db: env.DB,
      cookieHeader: request.headers.get('cookie'),
      now,
      sessionSecret: configuration.sessionSecret,
      input: { restoreRevision, ...parsed.data },
    });
    return jsonNoStore(result, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
