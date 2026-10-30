# TODO / revisit later

Decisions made for now that we may want to change, plus deferred work.
When an item is resolved, update `docs/SPEC.md` and remove it here.

## Revisit
- [ ] **Notes on recurring tasks.** New instances currently start with empty
  notes. Consider adding a `notes` field to `recurring_rules` that is copied
  into each new instance (e.g. a checklist for a weekly routine).
  (Decided 2026-10-26, step 1, question 5.)

## Deferred
- [ ] **Off-server backups.** Backups currently live with the hosting
  provider (server snapshots, plus PocketBase's built-in backups if enabled).
  Consider copying backups off the server.
- [ ] **History UI.** Completed tasks are kept in the database but there is
  no screen to browse them yet.
