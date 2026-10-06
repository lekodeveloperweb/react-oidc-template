# AGENTS.md

Project rules for AI-assisted development in this repository. These constraints
keep the codebase small-unit, typed, and grep-searchable so agents can reason
about it without truncation or inference errors.

## Agent Rules

- **Functions**: 4-20 lines. Split if longer.
- **Files**: Under 500 lines.
- **Validation**: Run `node scripts/check-limits.js src/` (or `yarn check-limits`) to verify these limits.
- **Types**: Always explicit. No `any`.
- **Naming**: Must be unique/searchable (>5 grep hits is a fail). Prefer `UserRegistrationValidator` over `Validator`.
- **Logic**: Early returns over nested if-statements (max 2 levels).
- **Comments**: Write WHY, not WHAT. Keep agent-authored comments.
- **Tests**: Every fix needs a regression test. Run via `yarn test` (vitest, headless, jsdom).

## Commands

| Command             | What it does                                                       |
| ------------------- | ------------------------------------------------------------------ |
| `yarn dev`          | Vite dev server (needs `.env.development` with OIDC variables)     |
| `yarn build`        | Type-check (`tsc -b`), then production build                       |
| `yarn lint`         | ESLint over the whole project                                      |
| `yarn test`         | Vitest headless test run (includes `scripts/check-limits.test.ts`) |
| `yarn check`        | Lint + format check + tests                                        |
| `yarn check-limits` | Agent-clean-code audit over `src/`                                 |

## check-limits.js

`scripts/check-limits.js` uses ESLint's flat config with the project's
`typescript-eslint` parser. It lints `.ts` files with `ecmaFeatures.jsx =
false` because generic arrows (`async <T>(url: string): Promise<T>`) are
invalid under the TSX grammar, and it skips generated directories
(`node_modules`, `dist`, `build`). The checker itself is audited with a
raised `--func-limit` (25) since its own functions may exceed 20 lines.
Regression tests: `scripts/check-limits.test.ts`.

## Testing & Environment

- Tests run headless via vitest + jsdom (`vitest.config.ts`, `src/test/setup.ts`). No manual DB seeding, no hidden environment secrets.
- Env config lives in `.env.development` (gitignored). `.env.example` documents required keys: `VITE_OIDC_AUTHORITY`, `VITE_OIDC_CLIENT_ID`, `VITE_OIDC_AUDIENCE`, `VITE_APP_PATH_PREFIX`, `VITE_API_URL`.
- Formatting is enforced by prettier + husky/lint-staged pre-commit hooks; re-read files after editing since auto-format may change what you wrote.

## Architecture Notes

- Auth: `src/settings/oidc-config.ts` (config, fails loudly on missing env), `src/main.tsx` (`AuthProvider`), `src/App.tsx` (auth gating + router).
- State: jotai atoms in `src/stores/` (e.g. `theme.store.ts`).
- UI: shadcn-style primitives in `src/components/ui/`; pages in `src/pages/`.
- API client: `src/lib/api-client.ts` with colocated tests.
