# React OIDC Template

A React 19 + TypeScript + Vite starter with OIDC authentication wired in from
the first run. Sign-in goes through `react-oidc-context` and `oidc-client-ts`
(authorization-code flow against a Keycloak-style provider), so the app you
clone this into is already behind login before you write a single component.

On top of the auth layer the template ships the UI and state plumbing we use in
most LDW apps: Tailwind CSS v4 with shadcn/ui (base-nova style, Base UI
primitives), jotai for client state, react-router v7 for routing, and sonner for
toast notifications. Light and dark themes are handled by a jotai atom that
reads the stored preference, falls back to `prefers-color-scheme`, and toggles
the `dark` class.

Copy the template into a new project with [tiged](https://github.com/tiged/tiged)
— see [Getting this template with tiged](#getting-this-template-with-tiged).

## Requirements

- Node.js 20 or newer (this repo was developed on Node 24)
- Yarn 1.x (`yarn.lock` is committed; `npm install` works too)
- An OIDC provider you can point at: an authority URL, a client id, and (for
  Keycloak) an audience/client id

## Getting this template with tiged

Use [tiged](https://github.com/tiged/tiged) to copy the template without its git
history — faster than `git clone --depth 1`, and you won't accidentally keep the
template's `.git` folder in your new project.

```bash
npm install -g tiged

# into a new folder named after the repo
tiged lekodeveloperweb/react-oidc-template

# into the current directory
tiged lekodeveloperweb/react-oidc-template .

# pin a branch or tag
tiged lekodeveloperweb/react-oidc-template#dev
```

`tiged` resolves the repo to the latest commit on the default branch and
downloads only the tarball, so the copy you get has no remote pointing at the
template. After copying, re-init git and set your own remote:

```bash
cd react-oidc-template
git init
git add -A
git commit -m "Initial commit from react-oidc-template"
```

To copy a subdirectory instead of the whole repo, use `tiged user/repo/subdirectory`.
For private repos or when you want full git behavior, pass `--mode=git`; to skip
the local cache (useful if a download is corrupted), pass `--disable-cache`. Run
`tiged --help` for the rest of the options.

## Quick start

```bash
yarn install
cp .env.example .env.development   # then fill in the real values
yarn dev
```

Vite loads `.env.development` in dev mode, so you can keep per-machine values
out of git. `.env.example` is the only env file committed (`.gitignore` ignores
`.env*` except `.env.example`).

## Scripts

| Command        | What it does                                 |
| -------------- | -------------------------------------------- |
| `yarn dev`     | Vite dev server with HMR                     |
| `yarn build`   | Type-check (`tsc -b`), then production build |
| `yarn lint`    | ESLint over the whole project                |
| `yarn preview` | Serve the built app locally                  |

## Environment variables

| Variable               | Purpose                                                                           |
| ---------------------- | --------------------------------------------------------------------------------- |
| `VITE_OIDC_AUTHORITY`  | OIDC provider base URL, e.g. `https://auth.example.com/realms/myrealm`            |
| `VITE_OIDC_CLIENT_ID`  | Client id registered at the provider                                              |
| `VITE_OIDC_AUDIENCE`   | Audience claim (Keycloak client id); sent with the token request                  |
| `VITE_APP_PATH_PREFIX` | Router basename; use `/` unless the app is served under a subpath                 |
| `VITE_API_URL`         | Backend API base URL. Reserved for app code; nothing in the template reads it yet |

`src/settings/oidc-config.ts` throws at startup if `VITE_OIDC_AUTHORITY`,
`VITE_OIDC_CLIENT_ID`, or `VITE_OIDC_AUDIENCE` is missing, so a misconfigured
environment fails loudly instead of dead-ending at the login screen.

## How authentication is wired

- `src/main.tsx` wraps the app in `AuthProvider` with `OIDC_CONFIG`.
- `src/settings/oidc-config.ts` holds the config: authorization-code flow
  (`response_type: "code"`), PKCE, automatic silent renew, user info loading,
  and `WebStorageStateStore` on `localStorage` for session persistence.
  `onSigninCallback` strips the provider's query params from the URL after
  redirect.
- `src/App.tsx` gates the whole app behind authentication, renders loading and
  error states, and mounts the router once the user is signed in.

Use the hooks from `react-oidc-context` in your own components:

```tsx
import { useAuth } from "react-oidc-context";

function Profile() {
  const auth = useAuth();
  const name = auth.user?.profile.name ?? "unknown";

  return (
    <div>
      <p>Signed in as {name}</p>
      <button onClick={() => auth.signoutRedirect()}>Log out</button>
    </div>
  );
}
```

For a single API call, attach the access token:

```ts
const auth = useAuth();
const res = await fetch(`${import.meta.env.VITE_API_URL}/finance`, {
  headers: { Authorization: `Bearer ${auth.user?.access_token}` },
});
```

When the token expires, silent renew refreshes it in the background; you do not
need to re-read it manually before each request.

## Project structure

```
src/
  main.tsx                 entry point, AuthProvider + StrictMode
  App.tsx                  auth gate, router, layout, theme application
  settings/oidc-config.ts  OIDC config built from env vars
  stores/theme.store.ts    jotai theme atom (light/dark, localStorage)
  pages/                   route-level components (Home is a placeholder)
  components/ui/           shadcn/ui primitives (Button is preinstalled)
  lib/utils.ts             re-export of the cn() helper
```

## Adding shadcn/ui components

`components.json` is already configured (base-nova style, neutral base color,
CSS variables, `@/` aliases). Add registry components with:

```bash
yarn shadcn add card
```

The `@` alias resolves to `src/` in `vite.config.ts` and `tsconfig.app.json`, so
imports like `@/components/ui/card` work in the editor and at build time.

## Notes and known issues

- **`yarn build` currently fails on TypeScript 6.** `tsc -b` reports
  `TS5101: Option 'baseUrl' is deprecated` for `tsconfig.app.json`, which uses
  `baseUrl` + `paths` for the shadcn `@/` alias. Until this is fixed, either add
  `"ignoreDeprecations": "6.0"` to `tsconfig.app.json` or drop `baseUrl` and
  rewrite the alias paths relative to the file. `yarn dev` is unaffected.
- **`yarn lint` reports `react-refresh/only-export-components`** in `src/App.tsx`
  and `src/components/ui/button.tsx`. Fast refresh is degraded for those files;
  the usual fix is moving non-component exports out of them.
- **PKCE is disabled in development.** `oidc-config.ts` sets
  `disablePKCE: !import.meta.env.PROD` with a comment saying it is "for
  production compatibility", but the flag is actually `true` in development and
  `false` in production. If your provider requires PKCE in dev, change this line
  before deploying anything.
- **Auth state lives in `localStorage`.** Fine for internal tools, worth
  reconsidering if the app handles sensitive data (a `sessionStorage` store is a
  one-line change in `oidc-config.ts`).
- `src/App.css` still contains leftover Vite-template styles (`.hero`,
  `#next-steps`, etc.) that nothing references. Safe to delete when you start
  building real pages.

## Upstream references

- [react-oidc-context](https://github.com/butsippadnand/react-oidc-context)
- [oidc-client-ts](https://github.com/autark-inc/oidc-client-ts)
- [tiged](https://github.com/tiged/tiged) — scaffolding tool used above
- [shadcn/ui](https://ui.shadcn.com/)
- [Vite](https://vite.dev/) · [Tailwind CSS v4](https://tailwindcss.com/docs)
- [jotai](https://jotai.org/)
- [react-router](https://reactrouter.com/)
- [sonner](https://sonner.emilkasal.com/)
