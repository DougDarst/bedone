import PocketBase from 'pocketbase';

/**
 * The PocketBase client. In production the app is served by PocketBase, so
 * it uses the same origin; during `npm run dev` it uses VITE_PB_URL.
 */
export const pb = new PocketBase(import.meta.env.VITE_PB_URL || window.location.origin);

// The SDK cancels duplicate in-flight requests by default; we never want that.
pb.autoCancellation(false);
