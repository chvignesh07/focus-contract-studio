import { env } from 'cloudflare:workers';

import { createReviewerProposal } from '../../../../lib/server/package5-review';
import { errorResponse, jsonNoStore, methodNotAllowed } from '../../../../lib/server/http';
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
      maxBytes: 16 * 1024,
    });
    return jsonNoStore(await createReviewerProposal({
      db: env.DB,
      cookieHeader: request.headers.get('cookie'),
      now,
      sessionSecret: configuration.sessionSecret,
      input: body,
    }), 201);
  } catch (error) {
    return errorResponse(error);
  }
}
