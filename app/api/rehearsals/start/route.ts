import { env } from 'cloudflare:workers';

import { startRehearsalInputSchema } from '../../../../lib/domain/focus-rehearsal';
import { FcsError } from '../../../../lib/server/errors';
import {
  errorResponse,
  jsonNoStore,
  methodNotAllowed,
} from '../../../../lib/server/http';
import { readStrictJsonMutation } from '../../../../lib/server/request-security';
import { runtimeSecurityConfig } from '../../../../lib/server/runtime-config';
import { startFocusRehearsal } from '../../../../lib/server/focus-rehearsal';
import { resolveWorkspaceEvidenceSession } from '../../../../lib/server/workspaces';

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
      maxBytes: 128,
    });
    const parsed = startRehearsalInputSchema.safeParse(body);
    if (!parsed.success) {
      throw new FcsError('INVALID_INPUT', 'The rehearsal input is invalid.', 400);
    }
    const rehearsal = await startFocusRehearsal({
      db: env.DB,
      workspaceId: session.workspace.id,
      now,
      environment: parsed.data.environment,
    });
    return jsonNoStore({ ok: true, rehearsal }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
