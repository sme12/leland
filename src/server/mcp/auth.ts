import { verifyClerkToken } from '@clerk/mcp-tools/server';
import { auth } from '@clerk/tanstack-react-start/server';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';

import { ensureUserBootstrappedForUser } from '#/server/bootstrap-core';

export type McpAuthContext = {
  authInfo: AuthInfo;
  userId: string;
};

export function getMcpResourceUrl(request: Request) {
  return new URL('/mcp', request.url).toString();
}

export function getProtectedResourceMetadataUrl(request: Request) {
  return new URL(
    '/.well-known/oauth-protected-resource/mcp',
    request.url,
  ).toString();
}

export function unauthorizedMcpResponse(request: Request) {
  return Response.json(
    { error: 'Unauthorized' },
    {
      status: 401,
      headers: {
        'WWW-Authenticate': `Bearer resource_metadata="${getProtectedResourceMetadataUrl(request)}"`,
      },
    },
  );
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get('authorization');

  if (!authorization) {
    return null;
  }

  const [scheme, token] = authorization.split(/\s+/, 2);

  if (scheme.toLowerCase() !== 'bearer' || !token) {
    return null;
  }

  return token;
}

export async function authenticateMcpRequest(
  request: Request,
): Promise<McpAuthContext | null> {
  const token = getBearerToken(request);

  if (!token) {
    return null;
  }

  const clerkAuth = await auth({ acceptsToken: 'oauth_token' });
  const authInfo = verifyClerkToken(clerkAuth, token);
  const userId = authInfo?.extra?.userId;

  if (!authInfo || typeof userId !== 'string') {
    return null;
  }

  await ensureUserBootstrappedForUser(userId);

  return { authInfo, userId };
}
