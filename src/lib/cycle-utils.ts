/**
 * Utility functions to calculate credit card statement cycles
 * (17th of a month to 16th of the following month)
 */

export interface CycleBounds {
  startDate: Date;
  endDate: Date;
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

/**
 * Calculates the start and end dates of the billing cycle for a given transaction date and cycleStartDay.
 * Cycle boundary: cycleStartDay of a month to cycleStartDay-1 of the next month.
 */
export function getCycleBounds(date: Date, cycleStartDay: number = 17): CycleBounds {
  const d = new Date(date.getTime());
  const year = d.getFullYear();
  const month = d.getMonth(); // 0-indexed
  const day = d.getDate();

  let startYear = year;
  let startMonth = month;
  
  if (day < cycleStartDay) {
    // Current date is before the cycle start day, so the cycle started in the previous month
    startMonth = month - 1;
    if (startMonth < 0) {
      startMonth = 11;
      startYear = year - 1;
    }
  }

  // Start Date: cycleStartDay of startMonth at 00:00:00.000
  const startDate = new Date(startYear, startMonth, cycleStartDay, 0, 0, 0, 0);

  // End Date: one day before cycleStartDay of the next month at 23:59:59.999
  let endYear = startYear;
  let endMonth = startMonth + 1;
  if (endMonth > 11) {
    endMonth = 0;
    endYear = startYear + 1;
  }
  const endDate = new Date(endYear, endMonth, cycleStartDay - 1, 23, 59, 59, 999);

  return { startDate, endDate };
}

/**
 * Formats a Date object to YYYY-MM-DD
 */
export function formatDateKey(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Generates a unique cycle ID based on its start date
 */
export function getCycleId(startDate: Date): string {
  return formatDateKey(startDate);
}

/**
 * Generates the user-friendly title of the cycle, e.g., "17 May - 16 Jun"
 */
export function getCycleTitle(startDate: Date, endDate: Date): string {
  const startDay = startDate.getDate();
  const startMonthStr = MONTH_NAMES[startDate.getMonth()];
  const endDay = endDate.getDate();
  const endMonthStr = MONTH_NAMES[endDate.getMonth()];
  
  return `${startDay} ${startMonthStr} - ${endDay} ${endMonthStr}`;
}

/**
 * Returns list of years for selection, e.g., from 2024 to current year + 1
 */
export function getYearOptions(): number[] {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let y = currentYear + 1; y >= 2024; y--) {
    years.push(y);
  }
  return years;
}
