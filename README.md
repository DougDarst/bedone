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
- **Tests:** Vitest (unit), Playwright (end-to-end, coming soon)

## Prerequisites

- Node.js 24 or newer (the version used in CI is in `.nvmrc`)
- PocketBase (setup instructions will be added with the backend increment)

## Setup

```sh
npm install
cp .env.example .env
```

## Local development

```sh
npm run dev       # start the Vite dev server
```

## Testing

```sh
npm test          # unit tests (Vitest)
npm run check     # type check (svelte-check)
npm run test:all  # both
```

## Building

```sh
npm run build     # outputs the frontend into pb_public/
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
