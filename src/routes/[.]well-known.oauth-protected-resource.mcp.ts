import {
  corsHeaders,
  generateClerkProtectedResourceMetadata,
} from '@clerk/mcp-tools/server';
import { createFileRoute } from '@tanstack/react-router';

import { getMcpResourceUrl } from '#/server/mcp/auth';

function getClerkPublishableKey() {
  const publishableKey = process.env.CLERK_PUBLISHABLE_KEY;

  if (!publishableKey) {
    throw new Error('CLERK_PUBLISHABLE_KEY is required');
  }

  return publishableKey;
}

function optionsResponse() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export const Route = createFileRoute(
  '/.well-known/oauth-protected-resource/mcp',
)({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const metadata = generateClerkProtectedResourceMetadata({
          publishableKey: getClerkPublishableKey(),
          resourceUrl: getMcpResourceUrl(request),
        });

        return Response.json(metadata, { headers: corsHeaders });
      },
      OPTIONS: async () => optionsResponse(),
    },
  },
});
