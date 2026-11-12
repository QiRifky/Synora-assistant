# Synora Assistant

Build ONLY this step, nothing else. Connect to a NEW Supabase project.

Pages:

- "/" : name "Synora", one sentence description, ONE button "Sign in with Buffer". No email/password/Google login.

- "/app" (protected): show the signed-in user's name/email (or "no email provided") and a Sign out button. Visitors without a session go to "/".

- Show a friendly message with "Try again" for any ?error= in the URL.

- Public /privacy and /terms pages.

Backend (Supabase Edge Functions):

1. buffer-start: generate PKCE code_verifier/challenge and a random state, store them server-side (short-lived table, expires in 10 minutes), redirect to https://auth.buffer.com/auth with response_type=code, scope "account:read offline_access", code_challenge (S256) and state.

2. buffer-callback: verify state, exchange the code at https://auth.buffer.com/token using the code_verifier and the client secret from Supabase secrets (BUFFER_CLIENT_ID, BUFFER_CLIENT_SECRET), then call https://api.buffer.com with the access token and query { account { id email } }. Find or create a Supabase user keyed by the Buffer account id, store the Buffer tokens ONLY in a server-side table (never in the browser), and sign the user in, then redirect to /app.

Never display or log tokens.

When done, tell me the exact callback URL to register in Buffer.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://synora-assistant.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/57cc379f-3f20-4071-95d5-caf384d682e8).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
