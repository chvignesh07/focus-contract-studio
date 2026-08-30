import { env } from 'cloudflare:workers';
import { z } from 'zod';

import { getActiveFocusReview } from '../../../lib/server/active-focus-review';
import { FcsError } from '../../../lib/server/errors';
import {
  errorResponse,
  jsonNoStore,
  methodNotAllowed,
} from '../../../lib/server/http';
import { readStrictJsonMutation } from '../../../lib/server/request-security';
import { runtimeSecurityConfig } from '../../../lib/server/runtime-config';

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
    if (!inputSchema.safeParse(body).success) {
      throw new FcsError('INVALID_INPUT', 'The review input is invalid.', 400);
    }
    const result = await getActiveFocusReview({
      db: env.DB,
      cookieHeader: request.headers.get('cookie'),
      now: Math.floor(Date.now() / 1000),
      sessionSecret: configuration.sessionSecret,
    });
    return jsonNoStore(result);
  } catch (error) {
    return errorResponse(error);
  }
}
