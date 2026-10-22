# CLAUDE.md — Shared Email App

Test app for the Bluecopa email engine: a React micro-frontend (single-spa +
Module Federation) with a shared inbox and email settings. `Agent.md` points here.

## Commands

```bash
pnpm dev          # Dev server on :8080
pnpm build        # tsc + vite build → dist/assets/remoteEntry.js
pnpm start        # Serve dist on :3001
pnpm typecheck    # tsc only
```

## Architecture

| File | Purpose |
|------|---------|
| `app/main.tsx` | Standalone entry (`BrowserRouter`) |
| `app/single-spa.tsx` | MFE entry exposed as `./App` (`mount` / `unmount` / `bootstrap`) |
| `app/app.tsx` | Merges env, `copaSetConfig`, QueryClient, `AppProvider`, routes |
| `app/contexts/app-context.tsx` | `user`, `users`, `envConfig`, `schemaMap`, host `permissions`, `emailAccount` |
| `app/routes/index.tsx` | `/inbox`, `/settings`; everything else redirects to `/inbox` |
| `vite.config.ts` | Federation `__copa_ext_app__react_route`, `remoteEntry.js`, `format: system` — the host loads it this way, don't change |

Host mount props (`MfeProps` in `app/types/index.ts`): `apiBaseUrl`, `workspaceId`,
`accessToken`, `userId`, `basename`, `envVars`, `schemaMap`, `permissions`.

- **`envVars`** — the host's Settings → Env Vars, merged over `import.meta.env`
  (host wins) and exposed as `useAppContext().envConfig`. The only way to
  configure a deployed app; type every key in `EnvConfig`.
- **Solution headers** — `copaSetConfig` sets `x-bluecopa-solution-*` from
  `VITE_BLUECOPA_SOLUTION_*`; required by Input Table V2 (drafts, templates,
  signature). Applied synchronously on mount and re-applied on prop changes.
- **`schemaMap`** — per-table `backend_column → camelCase` map; overrides the
  defaults in `app/utils/schema-mapper.ts`.
- **`permissions`** — `usePermissions().can(actionId, permission?)`; fail-closed
  (`{}` → `false`). Not used to gate the inbox today.

## Email feature

| Area | Files |
|------|-------|
| Inbox page | `app/pages/shared-inbox.tsx` |
| UI | `app/components/email/` — sidebar, list, detail (thread + attachments), compose modal (WYSIWYG iframe editor), advanced search popover |
| Settings | `app/pages/settings.tsx`, `app/components/settings/` — templates (Quill), shared account + signature |
| Data | `app/hooks/email/` (conversations, drafts, search, websocket), `app/hooks/settings/` (templates, signature), `app/hooks/input-table-v2.ts` |
| Template render | `app/utils/render-template.ts` (`/templates/render`), placeholders in `app/data/template-variables.ts` |

Folders: Inbox, Sent, Drafts. Compose / reply / reply-all / forward, attachments,
drafts, templates, signature, live updates over websocket.

## Env keys

See `.env.example`. Email-specific: `VITE_BLUECOPA_EMAIL_ACCOUNT_ID`,
`VITE_BLUECOPA_EMAIL_ADDRESS`, `VITE_TABLE_EMAIL_DRAFT`, `VITE_TABLE_EMAIL_TEMPLATE`,
`VITE_TABLE_SIGNATURE`, and the websocket keys (`VITE_WEBSOCKET`, `VITE_PUSHER_*`,
`VITE_EMAIL_WS_*`).

## Tailwind `copa:` prefix — CRITICAL

Every Tailwind class is prefixed for MFE isolation, and the prefix comes first:
`copa:hover:bg-accent`, `copa:md:flex` — never `hover:copa:bg-accent`
(silently generates nothing). Use `cn()` from `~/utils/utils` (prefix-aware
tailwind-merge). CSS variables live on `.mfe-root`, not `:root`; Radix portals
render into `.mfe-root` (`getPortalContainer()`) so they keep the theme.
