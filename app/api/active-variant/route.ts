import { env } from 'cloudflare:workers';

import { activeVariantRequestSchema } from '../../../lib/domain/package6';
import { FcsError } from '../../../lib/server/errors';
import {
  errorResponse,
  jsonNoStore,
  methodNotAllowed,
} from '../../../lib/server/http';
import { readStrictJsonMutation } from '../../../lib/server/request-security';
import { runtimeSecurityConfig } from '../../../lib/server/runtime-config';
import {
  resolveWorkspaceEvidenceSession,
  setActiveVariantBySlug,
} from '../../../lib/server/workspaces';

export async function GET(): Promise<Response> {
  return methodNotAllowed();
}

export async function POST(request: Request): Promise<Response> {
  try {
    const configuration = runtimeSecurityConfig();
    const session = await resolveWorkspaceEvidenceSession({
      db: env.DB,
      cookieHeader: request.headers.get('cookie'),
      now: Math.floor(Date.now() / 1_000),
      sessionSecret: configuration.sessionSecret,
    });
    const body = await readStrictJsonMutation(request, {
      expectedOrigin: configuration.publicOrigin,
      csrfDigest: session.csrfDigest,
      maxBytes: 256,
    });
    const parsed = activeVariantRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new FcsError('INVALID_REQUEST', 'The request is invalid.', 400);
    }
    const result = await setActiveVariantBySlug(
      env.DB,
      session.workspace.id,
      parsed.data.variant,
      parsed.data.expectedViewRevision,
    );
    return jsonNoStore({
      ok: true,
      data: {
        variant: result.variant,
        viewRevision: result.viewRevision,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
