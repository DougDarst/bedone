# CLAUDE.md

Guidance for Claude Code when working in this repo.

## Roles
- The user is the tech lead and makes all product and architecture decisions.
- Claude is the developer: propose, explain trade-offs, implement.
- When something is ambiguous, ask. Don't guess.

## Source of truth
- `docs/SPEC.md` is the spec. Its "Design decisions" section records approved
  decisions and wins over earlier sections where they conflict.
- Update the spec (with approval) whenever a decision changes.
- `docs/TODO.md` tracks things to revisit and deferred work. Add to it when a
  decision is provisional.

## Commit workflow (strict)
1. Run the full suite: `npm run test:all` (type check, unit tests, and
   integration tests against a real PocketBase), plus `npm run build`, and E2E
   tests once they exist. Integration tests need `npm run pb:setup` once.
2. Show the user: a summary of the changes, the test results, and the
   proposed commit message.
3. Wait for explicit approval. Never commit or push without asking.
- Work in small, testable increments; each ends with passing tests and a
  commit request.

## Deployment
- **On hold.** Do not deploy anything to PocketHost (pockethost.io) until the
  user says so. Run everything locally. Pushing to GitHub
  (https://github.com/DougDarst/bedone) is fine with approval.

## Conventions
- Stack: PocketBase backend; Svelte 5 + Vite + TypeScript SPA built into
  `pb_public` (`npm run build`); Tiptap, Lucide, svelte-dnd-action.
- The app's name and emoji live only in `APP` in `src/lib/config.ts`. Never
  hard-code them anywhere else (code, UI, page title, README).
- Dates are date-only `YYYY-MM-DD` strings. "Today" is America/Los_Angeles.
  Use the helpers in `src/lib/recurrence/dates.ts`; never do date math with
  timestamps.
- `src/lib/recurrence/` must stay dependency-free: it is bundled into the
  PocketBase hooks.
- All recurrence mutations run server-side in PocketBase hooks inside a
  transaction. Logic goes in `pb_hooks/lib/service.js`; each hook handler runs
  in its own JS context and must `require` it inside the handler.
- Writes in hooks take the transactional `txApp`, never the outer `$app`.
- When adding integration tests, make sure they fail if the logic is broken
  (pick cases where a wrong implementation gives a different answer).
- All schema changes are PocketBase migrations in the repo.
- No secrets in the repo; use env vars and keep `.env.example` current.
- Write tests alongside code (Vitest for logic, Playwright for E2E on WebKit
  iPhone + desktop Chromium).
- TypeScript is pinned to 6.x because svelte-check does not yet support
  TypeScript 7 on its own.
- The repo is public: keep code clean, documented, and safe to publish.
