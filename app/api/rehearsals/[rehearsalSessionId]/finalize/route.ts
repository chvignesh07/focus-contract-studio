import { env } from 'cloudflare:workers';

import {
  finalizeRehearsalInputSchema,
  rehearsalSessionIdSchema,
} from '../../../../../lib/domain/focus-rehearsal';
import { workspaceAdmission } from '../../../../../lib/server/admission';
import { FcsError } from '../../../../../lib/server/errors';
import {
  errorResponse,
  jsonNoStore,
  methodNotAllowed,
} from '../../../../../lib/server/http';
import { readStrictJsonMutation } from '../../../../../lib/server/request-security';
import { runtimeSecurityConfig } from '../../../../../lib/server/runtime-config';
import { finalizeFocusRehearsal } from '../../../../../lib/server/focus-rehearsal';
import { resolveWorkspaceEvidenceSession } from '../../../../../lib/server/workspaces';

type RouteContext = {
  params: Promise<{ rehearsalSessionId: string }>;
};

export async function GET(): Promise<Response> {
  return methodNotAllowed();
}

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  try {
    const { rehearsalSessionId } = await context.params;
    if (!rehearsalSessionIdSchema.safeParse(rehearsalSessionId).success) {
      throw new FcsError('INVALID_INPUT', 'The rehearsal input is invalid.', 400);
    }
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
      maxBytes: 32 * 1024,
    });
    const parsed = finalizeRehearsalInputSchema.safeParse(body);
    if (!parsed.success) {
      throw new FcsError('INVALID_INPUT', 'The rehearsal input is invalid.', 400);
    }
    const rehearsal = await finalizeFocusRehearsal({
      db: env.DB,
      workspaceId: session.workspace.id,
      rehearsalSessionId,
      now,
      admitOperation: workspaceAdmission({
        db: env.DB,
        operation: 'rehearsal',
        now,
        secret: configuration.rateLimitSecret,
      }),
      input: parsed.data,
    });
    return jsonNoStore({ ok: true, rehearsal }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
