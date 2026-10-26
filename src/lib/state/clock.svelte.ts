import { TIME_ZONE } from '../config';
import { todayIn, type IsoDate } from '../recurrence';

/** Today's date in the app's time zone, updated as midnight passes. */
class Clock {
  today = $state<IsoDate>(todayIn(TIME_ZONE));

  constructor() {
    setInterval(() => {
      const now = todayIn(TIME_ZONE);
      if (now !== this.today) this.today = now;
    }, 30_000);
  }
}

export const clock = new Clock();
