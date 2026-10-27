/**
 * Minimal hash router: "#/" is the task list, "#/recurring" the recurring
 * tasks screen. Hash URLs work with any static host and keep the browser's
 * back button and reloads working.
 */
export type Route = 'tasks' | 'recurring';

const PATHS: Record<Route, string> = { tasks: '#/', recurring: '#/recurring' };

export function routeFromHash(hash: string): Route {
  return hash === PATHS.recurring ? 'recurring' : 'tasks';
}

class Router {
  route = $state<Route>(routeFromHash(window.location.hash));

  constructor() {
    window.addEventListener('hashchange', () => {
      this.route = routeFromHash(window.location.hash);
    });
  }

  href(route: Route): string {
    return PATHS[route];
  }
}

export const router = new Router();
