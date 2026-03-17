type TravelPressureSummary = {
  signals: string[];
  waitAdjustment: number;
  delayAdjustment: number;
  cancelAdjustment: number;
  noteFragments: string[];
  driverFragments: string[];
};

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return startOfDay(result);
}

function isWithinWindow(date: Date, start: Date, end: Date): boolean {
  const target = startOfDay(date).getTime();
  return target >= start.getTime() && target <= end.getTime();
}

function nthWeekdayOfMonth(year: number, monthIndex: number, weekday: number, occurrence: number): Date {
  const firstDay = new Date(year, monthIndex, 1);
  const offset = (weekday - firstDay.getDay() + 7) % 7;
  return startOfDay(new Date(year, monthIndex, 1 + offset + (occurrence - 1) * 7));
}

function lastWeekdayOfMonth(year: number, monthIndex: number, weekday: number): Date {
  const lastDay = new Date(year, monthIndex + 1, 0);
  const offset = (lastDay.getDay() - weekday + 7) % 7;
  return startOfDay(new Date(year, monthIndex, lastDay.getDate() - offset));
}

function createSummary(): TravelPressureSummary {
  return {
    signals: [],
    waitAdjustment: 0,
    delayAdjustment: 0,
    cancelAdjustment: 0,
    noteFragments: [],
    driverFragments: [],
  };
}

function pushSignal(
  summary: TravelPressureSummary,
  signal: string,
  adjustments: { wait: number; delay: number; cancel: number },
  note: string,
  driver: string,
): void {
  summary.signals.push(signal);
  summary.waitAdjustment += adjustments.wait;
  summary.delayAdjustment += adjustments.delay;
  summary.cancelAdjustment += adjustments.cancel;
  summary.noteFragments.push(note);
  summary.driverFragments.push(driver);
}

export function getTravelPressure(date: Date): TravelPressureSummary {
  const summary = createSummary();
  const year = date.getFullYear();

  const springBreakStart = new Date(year, 2, 7);
  const springBreakEnd = new Date(year, 3, 12);
  if (isWithinWindow(date, springBreakStart, springBreakEnd)) {
    pushSignal(
      summary,
      'Seasonal travel',
      { wait: 6, delay: 5, cancel: 1 },
      'Seasonal leisure travel can push morning and afternoon queues higher.',
      'The current date falls in a broad seasonal leisure travel period, so passenger volume may run above a typical school-week baseline.',
    );
  }

  const summerStart = new Date(year, 5, 1);
  const summerEnd = new Date(year, 7, 15);
  if (isWithinWindow(date, summerStart, summerEnd)) {
    pushSignal(
      summary,
      'Summer vacation pattern',
      { wait: 4, delay: 3, cancel: 1 },
      'Summer vacation travel usually raises family and leisure volume across domestic checkpoints.',
      'The trip falls in the core summer vacation period, which keeps general passenger volume elevated.',
    );
  }

  const thanksgiving = nthWeekdayOfMonth(year, 10, 4, 4);
  if (isWithinWindow(date, addDays(thanksgiving, -4), addDays(thanksgiving, 4))) {
    pushSignal(
      summary,
      'Thanksgiving travel surge',
      { wait: 8, delay: 9, cancel: 2 },
      'Thanksgiving week is one of the most compressed domestic travel windows of the year.',
      'The trip falls in the Thanksgiving travel surge, when airports absorb a large spike in family and leisure departures.',
    );
  }

  const memorialDay = lastWeekdayOfMonth(year, 4, 1);
  if (isWithinWindow(date, addDays(memorialDay, -3), addDays(memorialDay, 2))) {
    pushSignal(
      summary,
      'Memorial Day weekend',
      { wait: 5, delay: 4, cancel: 1 },
      'Memorial Day weekend often creates a concentrated long-weekend departure wave.',
      'A U.S. holiday weekend is active, which usually compresses airport demand into fewer departure banks.',
    );
  }

  const laborDay = nthWeekdayOfMonth(year, 8, 1, 1);
  if (isWithinWindow(date, addDays(laborDay, -3), addDays(laborDay, 2))) {
    pushSignal(
      summary,
      'Labor Day weekend',
      { wait: 5, delay: 4, cancel: 1 },
      'Labor Day weekend can create a sharp leisure travel pulse with heavier return-bank pressure.',
      'A U.S. holiday weekend is active, which usually compresses airport demand into fewer departure banks.',
    );
  }

  const julyFourth = new Date(year, 6, 4);
  if (isWithinWindow(date, addDays(julyFourth, -3), addDays(julyFourth, 3))) {
    pushSignal(
      summary,
      'July 4th travel window',
      { wait: 4, delay: 3, cancel: 1 },
      'The Independence Day travel window tends to lift leisure volume and create uneven return waves.',
      'The trip falls near the July 4th holiday period, which often produces heavier domestic leisure traffic.',
    );
  }

  const winterStart = new Date(year, 11, 20);
  const winterEnd = new Date(year + 1, 0, 3);
  if (isWithinWindow(date, winterStart, winterEnd) || isWithinWindow(date, new Date(year - 1, 11, 20), new Date(year, 0, 3))) {
    pushSignal(
      summary,
      'Christmas and New Year travel',
      { wait: 7, delay: 7, cancel: 2 },
      'The Christmas and New Year period combines high demand with weather-sensitive winter operations.',
      'The trip falls in the late-December and New Year travel surge, which usually raises both volume and disruption risk.',
    );
  }

  return summary;
}

export function parseTravelPressureDate(value?: string): Date {
  const parsed = value ? new Date(value) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}
