# A personal to-do app

A single-user to-do app built for daily use on a phone: tasks grouped by due
date, recurring tasks (daily, weekly, monthly), drag-and-drop rescheduling,
and rich-text notes. The app's display name is configurable; see
[Renaming the app](#renaming-the-app).

> **Status:** early development. See [docs/SPEC.md](docs/SPEC.md) for the full
> specification and [docs/TODO.md](docs/TODO.md) for open items.

## Tech stack

- **Backend:** [PocketBase](https://pocketbase.io) (database, auth, realtime,
  server-side hooks)
- **Frontend:** Svelte 5 + Vite + TypeScript, built as a static app that
  PocketBase serves from `pb_public`
- **Tests:** Vitest (unit and integration), Playwright (end-to-end, coming
  soon)

## Prerequisites

- Node.js 24 or newer (the version used in CI is in `.nvmrc`)
- macOS or Linux (for the PocketBase download script)

## Setup

```sh
npm install
cp .env.example .env
npm run pb:setup  # downloads the pinned PocketBase binary into ./pocketbase
```

## Local development

Start PocketBase. It applies the migrations in `pb_migrations/` automatically
and loads the hooks in `pb_hooks/`:

```sh
npm run pb:serve  # http://127.0.0.1:8090 (admin dashboard at /_/)
```

The first time, create an admin (superuser) account, then your own user:

```sh
./pocketbase superuser upsert you@example.com 'a-strong-password'
```

Open http://127.0.0.1:8090/_/, sign in, and add a record to the **users**
collection with your email and password. Public sign-up is disabled, so
this is the only way to create an account.

Local data lives in `pb_data/` (git-ignored). Delete it to start over.

To work on the frontend with hot reload, run this alongside `pb:serve`:

```sh
npm run dev       # Vite dev server; talks to PocketBase at VITE_PB_URL
```

## How the backend is organized

- `pb_migrations/`: the database schema, as PocketBase migrations. The
  database can be rebuilt from scratch from these.
- `pb_hooks/tasks.pb.js`: hooks and custom API routes. Anything that
  touches more than one record (completing a recurring task, reopening it,
  deleting a recurring rule) runs in a single transaction:
  - `POST /api/tasks/{id}/complete`
  - `POST /api/tasks/{id}/uncomplete`
  - `POST /api/recurring-rules/{id}/delete`
- `pb_hooks/lib/service.js`: the logic those hooks and routes call.
- `src/lib/recurrence/`: the date and recurrence calculations, shared by the
  frontend and the hooks. `npm run build:hooks` bundles them into
  `pb_hooks/generated/shared.cjs` (git-ignored; `pb:serve`, `build` and the
  integration tests build it for you).

## Testing

```sh
npm test                  # unit tests (Vitest)
npm run test:integration  # API rules and recurrence, against a real PocketBase
npm run check             # type check (svelte-check)
npm run test:all          # all of the above
```

Integration tests start their own PocketBase on a temporary database, so
they never touch `pb_data/`.

## Building

```sh
npm run build     # frontend into pb_public/, hooks bundle into pb_hooks/generated/
```

## Deployment

Deployment is manual, to a PocketBase instance hosted on
[PocketHost](https://pockethost.io). Step-by-step instructions will be added
once hosted deployment begins; for now the app runs locally only.

## Renaming the app

The name and emoji are defined in one place, `APP` in
[`src/lib/config.ts`](src/lib/config.ts):

```ts
export const APP = {
  name: 'Your App Name',
  emoji: '📝',
} as const;
```

Change those two values and rebuild. The header, the page title, and
everything else read from this constant. Set `emoji` to `''` to drop it.

## License

[MIT](LICENSE)
