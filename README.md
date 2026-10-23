
## Quick start
1. `npm ci`
2. Copy `.env.example` to `.env` and set `VITE_IBROADCAST_CLIENT_ID` (or paste it in the UI)
3. `npm run dev`

## Deploy
- Netlify: import this repo (uses `netlify.toml`). Set `VITE_IBROADCAST_CLIENT_ID` in site env vars if desired.
- Register an OAuth app at [media.ibroadcast.com](https://media.ibroadcast.com) → Apps → developer with Redirect URIs for local (`http://localhost:5173/callback`) and production.
