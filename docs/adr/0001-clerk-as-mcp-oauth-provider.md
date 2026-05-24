# Clerk as the MCP OAuth provider

When introducing a remote MCP server, Leland needs an OAuth 2.1 authorization server that supports Dynamic Client Registration (DCR-Lite, RFC 7591) so MCP clients like claude.ai can register themselves. Clerk added first-class support for this in 2025, including a helper library (`@clerk/mcp-tools`) that bridges Clerk-issued tokens to the MCP TypeScript SDK. Implementing our own OAuth provider was the realistic alternative — a meaningful amount of code, and OAuth bugs are security bugs.

**Decision:** Use Clerk's OAuth-applications mode with DCR enabled. Leland's MCP server only validates Clerk-issued JWTs (the same primitive the app already uses for session tokens) and resolves them to a `userId`. We do not host `/oauth/authorize` or `/oauth/token` endpoints ourselves.

**Consequences worth flagging:**
- Auth provider lock-in deepens. Migrating away from Clerk would now require also building or buying an OAuth provider that supports MCP-style DCR.
- The Clerk Dashboard becomes load-bearing: DCR has to be left enabled, and the OAuth-applications feature has to remain on the plan tier Leland subscribes to.

## Production rollout checklist

Apply the same Clerk settings to the production Clerk project before exposing the production `/mcp` endpoint:

1. Open the production project in the Clerk Dashboard and navigate to **OAuth Applications**.
2. Enable the OAuth Applications feature if it is not already enabled.
3. Enable **Dynamic client registration** so MCP clients can register themselves during OAuth.
4. Preview the OAuth consent screen with a production test Stylist account and approve the wording. Clerk enforces the consent screen while Dynamic Client Registration is enabled.
5. Do not add custom OAuth scopes for v1. Leland treats MCP access as one coarse-grained consent to the MCP server.
6. After the MCP routes are deployed, confirm the public metadata endpoints are reachable:
   - `https://<production-app-domain>/.well-known/oauth-protected-resource/mcp`
   - `https://clerk.<production-app-domain>/.well-known/oauth-authorization-server`
7. Connect an MCP client to `https://<production-app-domain>/mcp`, complete OAuth as the test Stylist, and verify the issued token resolves to that Stylist's Clerk `userId`.
8. Periodically review auto-registered OAuth clients in Clerk, because Dynamic Client Registration exposes a public client-registration path.
