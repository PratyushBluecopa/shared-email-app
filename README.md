# Shared Email App

A small Bluecopa micro-frontend for testing the email engine: a shared inbox
(Inbox / Sent / Drafts, threads, attachments, search, compose / reply / forward,
live updates) and settings for email templates and the shared signature.

## Run

```bash
pnpm install
cp .env.example .env    # fill in API, workspace, solution, email and table values
pnpm dev                # http://localhost:8080
```

## Build

```bash
pnpm build              # dist/assets/remoteEntry.js (+ remoteEntry.css)
pnpm start              # serve dist on :3001 for the Bluecopa host
```

The host loads `remoteEntry.js` (SystemJS, federation name
`__copa_ext_app__react_route`, exposed module `./App`). In a deployed app the
env values come from the host's Settings → Env Vars panel instead of `.env`.

See [CLAUDE.md](./CLAUDE.md) for architecture and conventions.
