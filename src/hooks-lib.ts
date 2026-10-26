/**
 * Entry point for the code shared with the PocketBase hooks. `npm run
 * build:hooks` bundles it into pb_hooks/generated/shared.cjs, which the hooks
 * load with `require`. Keep everything reachable from here dependency-free.
 */
export * from './lib/recurrence';
export { TIME_ZONE } from './lib/config';
