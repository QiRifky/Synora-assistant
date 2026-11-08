<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules
- Dashboard reads durable owner-only snapshots on entry and refreshes only on explicit banner action; a database lease/cooldown prevents duplicate calls across workers, and shortcut entry reads saved data to avoid Buffer requests.
- Dashboard navigation uses the configurable `src/components/ui/dashboard-sidebar.tsx` with existing shadcn sidebar state and real app destinations; omit template-only workspaces and mock features to preserve Synora behavior.
- Landing navigation uses the reusable Header with existing section anchors and the page's shared sign-in cooldown; the mobile dialog provides focus trapping and scroll locking without service calls.
- Reusable animated folder UI lives in `src/components/ui/icon-folder.tsx`, uses global semantic CSS materials and browser observers only after hydration; landing-page platform data supplies its marks without API calls.
- Sign-in rate-limit query values are already minutes; preserve sub-minute precision and a per-tab deadline so reloads do not restart the cooldown, while Buffer routes stay unchanged.
- Buffer OAuth lives in TanStack server routes `/api/public/buffer/{start,callback}` (not Supabase Edge Functions), because this stack runs server code on the app's own worker.
- Buffer tokens and PKCE state live only in service-role tables (`buffer_connections`, `oauth_states`) with RLS on and no client grants; never return or log them.
- Users are keyed by Buffer account id; the callback issues a one-time magic-link token_hash that `/auth/complete` exchanges for a session.
- Buffer reads go through `src/lib/buffer.functions.ts`: account+limits, channels and all post statuses are each one aliased GraphQL request, cached ~60s per user per kind with in-flight dedupe and last-good fallback on 429 (force=true bypasses), because Buffer rate-limits API requests.
- Media uploads use the owner-scoped `post-media` Cloud Storage bucket; shared browser validation and authenticated server verification protect Buffer attachment inputs, and successful saves retain source files because Buffer does not guarantee ingestion before returning.
- Hourly media cleanup uses a managed authenticated HTTP callback and service-only references; save reservations and cleanup claims share a database lock, protecting in-flight/ambiguous saves and legacy uploads from deletion.
- Landing feature cards render `src/components/ui/glass-folder-cards.tsx` (self-contained, client-painted canvas art, React only) with a neutral/blue recipe; no service calls.
