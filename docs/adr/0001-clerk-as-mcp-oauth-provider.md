# Clerk as the MCP OAuth provider

When introducing a remote MCP server, Leland needs an OAuth 2.1 authorization server that supports Dynamic Client Registration (DCR-Lite, RFC 7591) so MCP clients like claude.ai can register themselves. Clerk added first-class support for this in 2025, including a helper library (`@clerk/mcp-tools`) that bridges Clerk-issued tokens to the MCP TypeScript SDK. Implementing our own OAuth provider was the realistic alternative — a meaningful amount of code, and OAuth bugs are security bugs.

**Decision:** Use Clerk's OAuth-applications mode with DCR enabled. Leland's MCP server only validates Clerk-issued JWTs (the same primitive the app already uses for session tokens) and resolves them to a `userId`. We do not host `/oauth/authorize` or `/oauth/token` endpoints ourselves.

**Consequences worth flagging:**
- Auth provider lock-in deepens. Migrating away from Clerk would now require also building or buying an OAuth provider that supports MCP-style DCR.
- The Clerk Dashboard becomes load-bearing: DCR has to be left enabled, and the OAuth-applications feature has to remain on the plan tier Leland subscribes to.
