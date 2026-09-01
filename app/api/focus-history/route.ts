import { env } from 'cloudflare:workers';

import { getPackage5History } from '../../../lib/server/package5-apply-history-undo.ts';
import { errorResponse, jsonNoStore, methodNotAllowed } from '../../../lib/server/http.ts';
import { runtimeSecurityConfig } from '../../../lib/server/runtime-config.ts';

export async function GET(request: Request): Promise<Response> {
  try {
    const configuration = runtimeSecurityConfig();
    const history = await getPackage5History({
      db: env.DB,
      cookieHeader: request.headers.get('cookie'),
      now: Math.floor(Date.now() / 1_000),
      sessionSecret: configuration.sessionSecret,
    });
    return jsonNoStore(history);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(): Promise<Response> {
  return methodNotAllowed();
}
