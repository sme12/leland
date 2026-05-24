import {
  corsHeaders,
  fetchClerkAuthorizationServerMetadata,
} from '@clerk/mcp-tools/server';
import { createFileRoute } from '@tanstack/react-router';

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

export const Route = createFileRoute('/.well-known/oauth-authorization-server')(
  {
    server: {
      handlers: {
        GET: async () => {
          const metadata = await fetchClerkAuthorizationServerMetadata({
            publishableKey: getClerkPublishableKey(),
          });

          return Response.json(metadata, { headers: corsHeaders });
        },
        OPTIONS: async () => optionsResponse(),
      },
    },
  },
);
