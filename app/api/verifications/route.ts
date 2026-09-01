import { env } from 'cloudflare:workers';
import { z } from 'zod';

import { rehearsalSessionIdSchema } from '../../../lib/domain/focus-rehearsal';
import { workspaceAdmission } from '../../../lib/server/admission';
import { FcsError } from '../../../lib/server/errors';
import {
  errorResponse,
  jsonNoStore,
  methodNotAllowed,
} from '../../../lib/server/http';
import { readStrictJsonMutation } from '../../../lib/server/request-security';
import { runtimeSecurityConfig } from '../../../lib/server/runtime-config';
import { verifyFocusContract } from '../../../lib/server/verify-focus-contract';
import { resolveWorkspaceEvidenceSession } from '../../../lib/server/workspaces';

const inputSchema = z
  .object({
    rehearsalSessionId: rehearsalSessionIdSchema,
    implementedRevision: z.number().int().min(1),
  })
  .strict();

export async function GET(): Promise<Response> {
  return methodNotAllowed();
}

export async function POST(request: Request): Promise<Response> {
  try {
    const configuration = runtimeSecurityConfig();
    const now = Math.floor(Date.now() / 1000);
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
    if (!parsed.success) {
      throw new FcsError('INVALID_INPUT', 'The verification input is invalid.', 400);
    }
    const verification = await verifyFocusContract({
      db: env.DB,
      workspaceId: session.workspace.id,
      now,
      admitOperation: workspaceAdmission({
        db: env.DB,
        operation: 'verification',
        now,
        secret: configuration.rateLimitSecret,
      }),
      ...parsed.data,
    });
    return jsonNoStore({ ok: true, verification }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
