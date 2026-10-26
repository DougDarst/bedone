# Build BeDone ✅ — a personal to-do app

## Roles
I'm the tech lead and you (Claude Code) are the developer. I make the product
and architecture decisions. You propose, explain trade-offs, and implement.
When something is ambiguous, ask me. Don't guess.

Create a `CLAUDE.md` at the repo root that captures these roles, the
conventions below, and the commit workflow, so they persist across sessions.
Keep this spec in the repo at `docs/SPEC.md` as the source of truth, and
update it (with my approval) when decisions change.

## Goal
A single-user to-do app tailored to how I manage my personal tasks. I'll use
it all day, every day. The repo is public and open source, so code should be
clean, documented, and safe to publish.

## Naming
- The app is currently called "BeDone ✅", and I may rename it.
- Define the name and emoji in ONE config constant. Nothing else in the code,
  UI, page title, or README should hard-code it. Document how to rename it in
  the README.

## Stack and hosting
- Backend: PocketBase (my pocketbase.io account), hosted on PocketHost (my
  pockethost.io account).
- Frontend: a static single-page app built with Svelte 5 + Vite + TypeScript,
  served from PocketBase's `pb_public` directory on the same PocketHost
  instance (one deployment, no separate frontend host).
  - Why Svelte: small, readable components (good for an open-source
    project), built-in reactivity that pairs well with PocketBase's realtime
    subscriptions, tiny bundle for fast mobile loads, and no server framework
    needed since PocketBase is the backend.
- Rich text editor: Tiptap.
- Icons: Lucide.
- Drag and drop: a library that supports touch (e.g. svelte-dnd-action or
  SortableJS). Propose one and explain why.
- Store all schema changes as PocketBase migrations in the repo, so the
  database can be rebuilt from scratch.
- Store due dates as date-only values (YYYY-MM-DD), not timestamps, to avoid
  time zone bugs. "Today" is determined by my local time zone
  (America/Los_Angeles).

## Deployment
- **ON HOLD: do not deploy anything to PocketHost (pockethost.io) until I say
  so.** For now, run everything locally: a local PocketBase binary serving
  `pb_public`, with migrations applied locally. Pushing to GitHub is still
  fine (with my approval, per the Git workflow below).
- Manual only. No automated deployment.
- Provide an `npm run build` that outputs the frontend into `pb_public`.
- Document the exact manual steps in the README: building, uploading the
  frontend and migrations to PocketHost, and applying migrations.

## Authentication
- Single user only, using PocketBase's built-in email/password auth.
- Disable public sign-up. I'll create my account through the PocketBase admin.
- Collection API rules must require authentication and restrict every record to
  its owner.
- No secrets, credentials, or admin passwords in the repo. Use environment
  variables and commit a `.env.example`.

## Platform targets
- Primary: Chrome on iPhone. Secondary: desktop Chrome. Don't optimize for
  Safari specifically, but remember Chrome on iOS uses WebKit underneath, so
  test against WebKit.
- Responsive, mobile-first layout.
- Not installable (no PWA) and no offline support.
- Online-only: if there's no internet connection or the backend can't be
  reached, show a clear blocking error screen and prevent use until the
  connection returns. Never let me make edits that could be lost.

## Visual design
I'm in this app all day, so aesthetics matter. It should feel calm, focused,
and fast, not like a generic template.
- Light and dark themes that follow the system setting, plus a manual toggle
  in the menu.
- A restrained palette: warm neutral backgrounds, one accent color, and color
  used only where it carries meaning.
- Typography: the system font stack (SF Pro on iPhone) for crisp, native-
  feeling text. Clear hierarchy between date headers and tasks.
- Date headers are sticky while scrolling. Today's header is visually
  emphasized.
- Priority is shown as a small colored marker: High = orange, Medium = amber,
  Low = muted gray-blue. Don't use red for priority, since red means overdue.
- Overdue task titles are red.
- Comfortable density: tap targets at least 44px, generous but not wasteful
  spacing, so a full day's list fits on an iPhone screen without crowding.
- Small, satisfying motion: the checkbox animates on completion and the task
  fades to struck-through and slides to the bottom of its day. Respect
  "reduce motion" settings.
- Before building screens, propose a short style guide (colors for both
  themes, type scale, spacing, component examples) and a mockup of the task
  list for my approval.

## Task types
Every task has one of four types:
1. **Daily**: recurs every day.
2. **Weekly**: recurs on one or more chosen weekdays (e.g. every Tue and Thu).
3. **Monthly**: recurs on an Nth-weekday pattern, like "first Monday" or "last
   Friday" of each month.
4. **One-off**: no recurrence. Done when I check it off.
   - A one-off can be flagged as a **project**. A project behaves exactly like
     any other one-off; the flag only adds a visual icon in the list. Projects
     are typically large and long-running, so I'll frequently move their due
     date forward as I make incremental progress.

## Fields on each task
- Completed checkbox
- Title
- Due date
- Priority: High / Medium / Low dropdown
- Notes: rich text
- Type and, for recurring tasks, a link to its recurrence rule
- Is-project flag (one-offs only)
- Completed date

## Screens
1. **Task list** (main screen)
2. **Notes modal** (opens from the task list)
3. **Recurring tasks** configuration screen

Navigate between screens with a menu icon in the header.

## Task list (main screen)
- Grouped by due date, with a header per date. Each task is on its own line:
  checkbox, title (editable inline), due date, priority dropdown.
- Icons next to the title: projects show a project icon; recurring instances
  (daily, weekly, monthly) show a repeat icon.
- Always show today plus the next 7 days, even if a day has no tasks, so
  there's always a drop target for drag and drop.
- To set a date beyond that window, I click the task's due date, which opens a
  date picker.
- Past dates: show a past date's section only if it has open tasks (or tasks
  completed today, see below). Overdue tasks stay in their original date's
  section, with the title shown in red.
- Sorting within a date: open tasks first, sorted by priority (High, Medium,
  Low), then by manual drag order within each priority. Completed tasks go to
  the bottom of the day.
- Completed tasks stay visible, struck through, until midnight on the day I
  completed them, then they're hidden. Example: an overdue task from Oct 18
  that I complete today stays struck through in the Oct 18 section until
  tonight.
- Quick-add bar at the top: I type a title and press Enter. It creates a
  One-off task due today with Medium priority.
- Filters (combinable):
  - Priority (High / Medium / Low)
  - Today only (includes overdue)
  - This week only, Monday to Sunday (includes overdue)
- Changing a due date (drag and drop or date picker) moves the task to the
  matching date section.
- There's no delete in the task list. Tasks are only ever marked complete.

## Notes modal
- Clicking the task title opens a modal with a rich text editor (bold,
  italics, bullet and numbered lists, links, checklists).
- The title is also editable in the modal (as well as inline in the list).
- For one-offs, the modal has a toggle to mark or unmark the task as a project.
- Notes save automatically.

## Recurring tasks screen
A separate screen to manage master recurrence rules, with three sections:
Daily, Weekly, Monthly. In each section I can:
- Create a new recurring task (title, priority, schedule). Its first instance
  is created on the next date matching the schedule, on or after today.
  Example: a Tue/Thu task created on a Wednesday gets its first instance on
  Thursday.
- Change its title, priority, or schedule (weekdays for weekly; Nth weekday
  for monthly).
- Delete it. Deleting removes the open instance from the task list but keeps
  all previously completed instances in the database.

## History
Completed tasks are kept in the database. No UI to browse history is needed
for now.

## Recurrence rules (critical; get these right)
- A recurring task has a master schedule (the rule) and individual instances.
- Only one open instance exists per recurring task at a time.
- When I complete an instance, close it and immediately create the next
  instance. The next date is calculated from the instance's ORIGINAL scheduled
  date using the master rule, never from its current (possibly moved) due date
  and never from the completion date.
  - Example: a task recurs every Monday. I drag this week's instance to Tuesday
    and complete it. The next instance is created for next Monday.
  - Example: a weekly Tue/Thu task. Completing Tuesday's instance creates
    Thursday's.
  - Catch-up is intentional: a daily task due Oct 1 completed late on Oct 4
    creates the Oct 2 instance, which is also overdue. I'll complete each
    missed instance one at a time to catch up. This applies to all recurring
    types.
- Moving an instance affects only that instance.
- Editing a master schedule updates the open instance's date, unless I've
  manually moved it.
- One-offs (including projects) never generate new instances.

## Design decisions (approved 2026-10-26)
Resolved during step 1. These refine the sections above; where they conflict,
these win. Open items to revisit live in `docs/TODO.md`.

### Data model
- `users`: PocketBase's built-in auth collection. Public sign-up disabled
  (create rule is admin-only).
- `recurring_rules`:
  - `owner` (relation → users, required)
  - `title` (text, required)
  - `priority` (select: high / medium / low, required)
  - `frequency` (select: daily / weekly / monthly). Fixed after creation; to
    change type, delete and recreate the rule.
  - `weekdays` (multi-select mon–sun; weekly only, at least one)
  - `month_week` (select: 1 / 2 / 3 / 4 / last; monthly only. No "5th".)
  - `month_weekday` (select mon–sun; monthly only)
  - `deleted_at` (datetime; empty = active). Rules are soft-deleted so
    completed instances keep their link.
- `tasks`:
  - `owner` (relation → users, required)
  - `title` (text, required)
  - `due_date` (text `YYYY-MM-DD`): where the task appears; changes when moved
  - `scheduled_date` (text `YYYY-MM-DD`): recurring only; the date the rule
    produced. Never changes when the instance is moved.
  - `priority` (select: high / medium / low, required)
  - `notes` (editor, HTML from Tiptap)
  - `type` (select: daily / weekly / monthly / one_off)
  - `rule` (relation → recurring_rules; empty for one-offs)
  - `is_project` (bool; only allowed on one-offs)
  - `completed_at` (datetime; empty = open). This single field replaces the
    separate "completed checkbox" and "completed date".
  - `sort_order` (number): manual order within a date and priority
- An instance is "manually moved" when `due_date ≠ scheduled_date`.
- API rules on every collection: `owner = @request.auth.id`; creates must set
  `owner` to the authenticated user.
- Indexes: `tasks(owner, due_date)`, and a unique partial index on
  `tasks(rule) WHERE completed_at = ''` so a rule can never have two open
  instances.

### Recurrence algorithm
- All recurrence mutations (rule create / edit / delete, instance complete /
  uncomplete) run server-side in PocketBase hooks inside a transaction. The
  date math is a dependency-free TypeScript module, unit tested with Vitest
  and bundled into `pb_hooks`.
- Matching: daily matches every date; weekly matches the chosen weekdays;
  monthly matches the chosen weekday when it is the Nth in the month (days
  7N−6 to 7N) or, for "last", within the month's final 7 days.
- First instance: earliest matching date on or after today
  (America/Los_Angeles).
- Next instance: earliest matching date strictly after the completed
  instance's `scheduled_date`.
- Date math uses plain calendar dates, so DST cannot shift results.
- Unchecking a completed recurring instance reopens it and deletes the
  successor it created, if the successor is still open. If the successor is
  already completed, unchecking is blocked.
- Editing a rule's schedule moves its open instance to the first matching
  date on or after today (even if the instance was overdue), unless the
  instance was manually moved, in which case its `due_date` and
  `scheduled_date` are left alone.
- Editing a rule's title or priority updates its open instance. Completed
  instances keep their values.
- Editing an instance's title or priority affects only that instance, never
  the rule.
- New recurring instances start with empty notes.
- Deleting a rule soft-deletes it and deletes its open instance; completed
  instances are kept.

### Task list
- Any future date that has tasks gets its own section, even beyond the
  today + 7 days window.
- Dragging cannot change priority: a task dropped across a priority boundary
  snaps back into its own priority group.
- A task moved to another date lands at the bottom of its priority group.
- Filters: one date scope (All / Today / This week) combined with
  multi-select priority chips. Filter choices are remembered per device.
- Completed tasks cannot be dragged or re-dated, and are ordered by
  completion time at the bottom of their day.
- Tapping a task title edits it inline. A notes button on each row opens the
  notes modal; its icon uses the accent color when the task has notes.
- Desktop uses the same single list, max 680px wide and centered, with the
  priority label shown next to its dot.

### Visual design and libraries (approved 2026-10-26, step 2)
- Style guide and task list mockup:
  https://claude.ai/artifact/9HwiiQyS7BvdZjEneaYhNY
- Light: background #F7F5F0, surface #FFFDF9, border #E7E2D8, text #1F1D1A,
  muted #6B665E, control #8F897F, accent #2E7D5B, accent strong #24654A,
  accent soft #E3EFE8, overdue #C2352B, High #D9620F, Medium #E3A512,
  Low #7D8FA6.
- Dark: background #1A1917, surface #22201D, border #36332E, text #EDEAE4,
  muted #A8A29A, control #6E6962, accent #5FBF8F, accent strong #7FD3A8,
  accent soft #1F3A2D, overdue #F07167, High #F08A3C, Medium #E8B83A,
  Low #8FA1B8.
- Type: system font stack; app title 20/650, date header 15/650, task title
  16/400 (prevents iOS zoom on focus), meta 13/500.
- 4px spacing grid; 44px minimum tap targets; 48px minimum task row.
- Drag and drop: svelte-dnd-action (Svelte-native, data-driven, touch with a
  long-press delay so swipes still scroll, cross-list drops between date
  sections, built-in keyboard and screen-reader dragging).

## Testing
Write automated tests as you build, not afterward:
- Unit tests (Vitest) for all recurrence logic. This is the riskiest code, so
  cover edge cases: "first/last Nth weekday" across months, multi-day weekly
  rules, first-instance dates, moved instances, late completion and catch-up
  chains, year boundaries, and DST changes.
- Unit tests for list logic: sorting, past-date visibility, end-of-day hiding
  of completed tasks, and the filters (including overdue and Mon–Sun weeks).
- Tests for recurring rule deletion: the open instance is removed and
  completed instances are kept.
- Tests for API rules: unauthenticated requests are rejected, and a user can
  only access their own records.
- End-to-end tests (Playwright) for the main flows, run against WebKit with an
  iPhone viewport plus desktop Chromium. Cover: login, quick-add, complete a
  recurring task, drag to a new date, date picker, inline title edit, notes
  modal, project toggle, project and repeat icons, filters, theme toggle, the
  recurring tasks screen, menu navigation, and the offline error screen.
- A GitHub Actions workflow runs the full test suite on every push and pull
  request.

## Git workflow
- Public repo at https://github.com/DougDarst/bedone, MIT license, with a
  README covering setup, local development, manual deployment to PocketHost,
  and how to rename the app.
- Before every commit: run the full test suite, then show me a summary of the
  changes, the test results, and the proposed commit message. Wait for my
  explicit approval. Never commit or push without asking.

## How to work
1. Start by restating the requirements, flagging anything ambiguous, and
   proposing the data model (collections, fields, relations) and the
   recurrence algorithm in plain language with examples. Wait for my approval
   before writing code.
2. Propose the style guide and task list mockup. Wait for my approval.
3. Build in small, testable increments. Each increment ends with passing
   tests and a commit request.
