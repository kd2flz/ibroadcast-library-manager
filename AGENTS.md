# AGENTS.md

## Project
- Build a secure browser app for iBroadcast users to browse uploads by folder, sort folders by size, bulk move tracks to trash, and permanently empty trash to reclaim storage. It must run on a free Netlify static-hosting tier.
- The main dashboard must prominently show current storage used vs. the account limit. This is a primary product feature, not a settings-page detail.
- This repo starts empty. No package, build, lint, or test commands exist yet. Confirm the stack before scaffolding, then add the real commands to this file; do not invent them.

## iBroadcast integration (verified against official docs + live CORS check, Oct 2026)
- Auth is OAuth 2.0 only. There is no username/password API. Do not collect, forward, or store iBroadcast passwords. Use Authorization Code + PKCE (public client) or the Device Code flow.
- Register the app at `media.ibroadcast.com` -> side menu -> Apps -> developer. Register the exact local and production callback URLs as Redirect URIs. Only the `client_id` is needed for PKCE; never ship `client_secret` in the browser bundle.
- OAuth: `https://oauth.ibroadcast.com/authorize`, `POST https://oauth.ibroadcast.com/token`, `POST https://oauth.ibroadcast.com/revoke`.
- API: `POST https://api.ibroadcast.com/<mode>` with a JSON body. Library: `POST https://library.ibroadcast.com` with `{client, version, device_name, mode: "library"}`.
- OAuth, API, and library hosts all return `Access-Control-Allow-Origin: *`, so a static SPA can call them directly; no proxy is needed for CORS.
- Scopes needed: `user.library:read`, `user.library:write`.
- Send `Authorization: Bearer <access_token>`. On expiry the API returns `{result: false, authenticated: false}`; refresh with `grant_type=refresh_token`, and re-authenticate if refresh fails.

## Auth UX
- Use Authorization Code + PKCE as the primary flow for this web app. The connect screen must explain that sign-in happens on iBroadcast's page, show one clear "Connect iBroadcast" action, handle the `/callback` result, and display OAuth errors verbatim.
- Keep the PKCE verifier and `state` in `sessionStorage` only for the auth round-trip; validate `state` before exchanging the code.
- Offer the Device Code flow as a fallback with copyable user code, a direct verification link, and visible polling status/cancel. Do not implement a custom password form.

## Library and trash specifics
- The library response wraps `{library: {tracks, albums, artists, playlists, tags, trash, ...}}`.
- `tracks`, `albums`, `artists`, and `playlists` are `id -> array` maps plus a sibling `map` of `fieldName -> arrayIndex`. Resolve fields via `map`, never hardcoded indexes. `tags` is the exception: `id -> object`.
- A track's `path` is its upload folder path, `size` is bytes, and `trashed` marks trash state. Folders are not a separate library key; derive the folder list and folder sizes from tracks.
- Two-stage removal, verified in the official web client (Oct 2026; not in the public API reference):
  - `POST https://api.ibroadcast.com` with `{mode: "trash", tracks: [ids]}` moves tracks to trash. This does not free storage.
  - `POST https://api.ibroadcast.com` with `{mode: "empty_trash", tracks: [ids]}` permanently deletes trashed tracks. Pass the IDs in `library.trash[0][library.trash.map.tracks]`; this frees storage and cannot be undone.
- Label the first action "Move to trash" and the second "Empty trash". Preview track count and total size, require explicit confirmation for each, and re-fetch the library after either operation.
- Surface per-request failures from `result: false`; do not optimistically update local storage numbers.

## Storage meter
- Fetch account status via `POST https://api.ibroadcast.com` with `mode: "status"`. Read quota data from `user.usage`: `tier`, `storage_used`, `storage_limit`, `hidden_files`, `enforced`, `enforced_from`, and bandwidth fields.
- Trust the API-reported `storage_limit`. Product limits are 5 GB for free and 25 GB for Basic Premium; higher tiers can be unlimited. Public marketing/docs currently still say "unlimited storage" (checked Oct 2026), so fall back to those tier limits only when `storage_limit` is absent, and show "Unlimited" when the API says so.
- Make the meter the most prominent dashboard element: used, limit, remaining, and percent, with a clear near-limit and over-limit state (text plus color, not color alone). Format with 1 GB = 10^9 bytes to match iBroadcast's own UI.
- Also show the reclaimable trash size (sum `size` for the IDs in `library.trash[0][library.trash.map.tracks]`) next to the meter, with the "Empty trash" action. `size` can be missing/null for unavailable files; treat that as unknown, not zero-heavy data loss.

## Security constraints
- Never add password fields. Keep the access token in memory; if persistence is required, use `sessionStorage` and call `/revoke` on logout. Never log tokens or full library payloads, and never place tokens in URLs.
- Add a strict CSP and standard security headers via `netlify.toml`. Avoid third-party scripts that could read library data.
- Destructive actions must be gated by the iBroadcast API's real authorization; hidden or disabled UI controls are not a security boundary.

## Deployment
- Target Netlify free tier: static SPA plus optional Netlify Functions. Avoid long-running servers and databases.
- Add an SPA fallback redirect for `/callback` if using client-side routing.
- The iBroadcast client ID is public; there is no secret environment variable to configure for the browser flow.

## References
- https://help.ibroadcast.com/en/developer/authentication
- https://help.ibroadcast.com/en/developer/components/library
- https://help.ibroadcast.com/en/developer/api
