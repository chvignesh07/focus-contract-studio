import { env } from 'cloudflare:workers';
import { z } from 'zod';

import { errorResponse, jsonNoStore, methodNotAllowed } from '../../../../lib/server/http';
import { readStrictJsonMutation } from '../../../../lib/server/request-security';
import { runtimeSecurityConfig } from '../../../../lib/server/runtime-config';
import {
  bootstrapWorkspace,
  cleanupExpiredWorkspaces,
  getActiveSeedState,
} from '../../../../lib/server/workspaces';
import { FcsError } from '../../../../lib/server/errors';
import {
  admitGlobalOperation,
  trustedBootstrapClientDigest,
} from '../../../../lib/server/admission';

const inputSchema = z.object({}).strict();

export async function GET(): Promise<Response> {
  return methodNotAllowed();
}

export async function POST(request: Request): Promise<Response> {
  try {
    const configuration = runtimeSecurityConfig();
    const body = await readStrictJsonMutation(request, {
      expectedOrigin: configuration.publicOrigin,
      maxBytes: 128,
    });
    const parsed = inputSchema.safeParse(body);
    if (!parsed.success) {
      throw new FcsError('INVALID_REQUEST', 'The request is invalid.', 400);
    }
    const now = Math.floor(Date.now() / 1000);
    const session = await bootstrapWorkspace({
      db: env.DB,
      cookieHeader: request.headers.get('cookie'),
      now,
      sessionSecret: configuration.sessionSecret,
      csrfSecret: configuration.csrfSecret,
      admitCreate: async () => {
        const clientDigest = await trustedBootstrapClientDigest({
          request,
          now,
          secret: configuration.rateLimitSecret,
        });
        await admitGlobalOperation({
          db: env.DB,
          operation: 'workspace_bootstrap',
          now,
          clientDigest,
        });
      },
    });
    const activeVariant = await getActiveSeedState(env.DB, session.workspace.id);
    if (session.created) {
      try {
        await cleanupExpiredWorkspaces(env.DB, now);
      } catch {
        // Maintenance must not turn an already-created usable session into a failed response.
      }
    }
    return jsonNoStore(
      {
        ok: true,
        data: {
          generation: session.workspace.generation,
          csrfToken: session.csrfToken,
          activeVariant,
        },
      },
      session.created ? 201 : 200,
      session.setCookie ? { 'set-cookie': session.setCookie } : undefined,
    );
  } catch (error) {
    return errorResponse(error);
  }
}
