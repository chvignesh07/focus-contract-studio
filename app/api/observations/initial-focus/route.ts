import { env } from 'cloudflare:workers';

import { FcsError } from '../../../../lib/server/errors';
import {
  errorResponse,
  jsonNoStore,
  methodNotAllowed,
} from '../../../../lib/server/http';
import {
  commitInitialFocusObservation,
  initialFocusObservationPayloadSchema,
} from '../../../../lib/server/initial-focus-observation';
import { readStrictJsonMutation } from '../../../../lib/server/request-security';
import { runtimeSecurityConfig } from '../../../../lib/server/runtime-config';
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
      maxBytes: 2 * 1024,
    });
    const parsed = initialFocusObservationPayloadSchema.safeParse(body);
    if (!parsed.success) {
      throw new FcsError(
        'INVALID_INPUT',
        'The observation input is invalid.',
        400,
      );
    }
    const observation = await commitInitialFocusObservation({
      db: env.DB,
      workspaceId: session.workspace.id,
      now,
      environment: 'browser',
      ...parsed.data,
    });
    return jsonNoStore({ ok: true, observation }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
