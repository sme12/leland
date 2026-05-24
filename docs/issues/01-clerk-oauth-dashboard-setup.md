# Issue 1 — Clerk OAuth Applications + DCR dashboard setup

## What to build

Configure the Leland dev Clerk project (and document the matching production change) so that an MCP client can complete an OAuth Authorization Code flow against Clerk and receive an access token that resolves to a Leland **Stylist** `userId`. This is the click-ops prerequisite that gates the entire MCP server: without DCR enabled, claude.ai cannot register itself as an OAuth client, and without OAuth Applications enabled, Clerk cannot mint the access tokens that the `/mcp` endpoint will validate.

Per `docs/mcp-purchase-import-plan.md` §4 and Q5/Q20:

- Enable the **OAuth Applications** feature in the Clerk Dashboard.
- Toggle on **Dynamic Client Registration** so MCP clients (claude.ai et al.) can auto-register.
- Confirm the consent screen wording is acceptable (Clerk auto-enforces it when DCR is on).
- Do **not** create custom OAuth scopes (`materials:read`, `purchases:write`, etc.) — v1 treats MCP access as a single coarse-grained consent (Q20). Clerk's project-defined custom scopes are also not currently supported.
- No new environment variables are added; the existing `CLERK_PUBLISHABLE_KEY` / Clerk secret config covers MCP needs.

Verify the dashboard change by running the MCP Inspector (`npx @modelcontextprotocol/inspector`) pointed at a placeholder `/mcp` URL (the route itself ships in issue 2 — for this issue, hitting Clerk's discovery endpoints and completing the consent screen with a test user is sufficient evidence that DCR + OAuth Applications are live).

## Acceptance criteria

- [ ] OAuth Applications feature is **enabled** in the dev Clerk project.
- [ ] Dynamic Client Registration is **on** in the dev Clerk project.
- [ ] Consent screen has been previewed with a test Stylist account and the wording is approved.
- [ ] No custom OAuth scopes are defined for the project.
- [ ] A test MCP client (MCP Inspector or equivalent) can complete the Authorization Code flow against Clerk and receive an access token.
- [ ] The same configuration steps are documented for the production Clerk project (note in this issue's comments or in `docs/adr/0001-clerk-as-mcp-oauth-provider.md`) so production rollout is a checklist, not a discovery exercise.
- [ ] No code changes land in this issue — it is dashboard configuration only.

## Blocked by

None — can start immediately.
