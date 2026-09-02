import { env } from 'cloudflare:workers';
import { z } from 'zod';

import { FcsError } from '../../../../lib/server/errors';
import { errorResponse, jsonNoStore, methodNotAllowed } from '../../../../lib/server/http';
import { readStrictJsonMutation } from '../../../../lib/server/request-security';
import { runtimeSecurityConfig } from '../../../../lib/server/runtime-config';
import {
  workspaceAdmission,
} from '../../../../lib/server/admission';
import {
  cleanupExpiredWorkspaces,
  resetWorkspace,
  resolveWorkspaceSession,
} from '../../../../lib/server/workspaces';

const inputSchema = z
  .object({
    idempotencyKey: z.uuid(),
  })
  .strict();

export async function GET(): Promise<Response> {
  return methodNotAllowed();
}

export async function POST(request: Request): Promise<Response> {
  try {
    const configuration = runtimeSecurityConfig();
    const now = Math.floor(Date.now() / 1000);
    const current = await resolveWorkspaceSession({
      db: env.DB,
      cookieHeader: request.headers.get('cookie'),
      now,
      sessionSecret: configuration.sessionSecret,
      csrfSecret: configuration.csrfSecret,
      includePurged: true,
    });
    const body = await readStrictJsonMutation(request, {
      expectedOrigin: configuration.publicOrigin,
      csrfDigest: current.csrfDigest,
      maxBytes: 256,
    });
    const parsed = inputSchema.safeParse(body);
    if (!parsed.success) {
      throw new FcsError('INVALID_REQUEST', 'The request is invalid.', 400);
    }
    await cleanupExpiredWorkspaces(env.DB, now);
    const reset = await resetWorkspace({
      db: env.DB,
      cookieHeader: request.headers.get('cookie') ?? '',
      csrfToken: request.headers.get('x-fcs-csrf') ?? '',
      idempotencyKey: parsed.data.idempotencyKey,
      now,
      sessionSecret: configuration.sessionSecret,
      csrfSecret: configuration.csrfSecret,
      admitReset: workspaceAdmission({
        db: env.DB,
        operation: 'reset',
        now,
        secret: configuration.rateLimitSecret,
      }),
    });
    return jsonNoStore(
      {
        ok: true,
        data: {
          generation: reset.workspace.generation,
          csrfToken: reset.csrfToken,
          replayed: reset.replayed,
        },
      },
      200,
      { 'set-cookie': reset.setCookie },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
