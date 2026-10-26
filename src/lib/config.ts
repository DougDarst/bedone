/**
 * The app's name and emoji. This is the ONLY place they are defined: the
 * page title, header, and everything else read from here. To rename the app,
 * change these two values (see "Renaming the app" in the README).
 */
export const APP = {
  name: 'BeDone',
  emoji: '✅',
} as const;

/** Name plus emoji, as shown in the header and page title. */
export function appDisplayName(app: { name: string; emoji: string } = APP): string {
  return app.emoji ? `${app.name} ${app.emoji}` : app.name;
}
