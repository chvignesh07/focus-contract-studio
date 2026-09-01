import { env } from 'cloudflare:workers';

import { reviewProposal } from '../../../../../lib/server/package5-review.ts';
import { errorResponse, jsonNoStore, methodNotAllowed } from '../../../../../lib/server/http.ts';
import { readStrictJsonMutation } from '../../../../../lib/server/request-security.ts';
import { runtimeSecurityConfig } from '../../../../../lib/server/runtime-config.ts';
import { resolveWorkspaceEvidenceSession } from '../../../../../lib/server/workspaces.ts';

type RouteContext = { params: Promise<{ proposalId: string }> };

export async function GET(): Promise<Response> {
  return methodNotAllowed();
}

export async function POST(request: Request, context: RouteContext): Promise<Response> {
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
      maxBytes: 4 * 1024,
    });
    const result = await reviewProposal({
      db: env.DB,
      cookieHeader: request.headers.get('cookie'),
      proposalId: (await context.params).proposalId,
      now,
      sessionSecret: configuration.sessionSecret,
      input: body,
    });
    return jsonNoStore(result, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
