export type BillingReminder = "CYCLE_APPROACHING" | "PAYMENT_DAY_1" | "PAYMENT_DAY_10";

export interface CalendarDate {
  year: number;
  month: number;
  day: number;
}

function toUtcDay({ year, month, day }: CalendarDate): number {
  return Date.UTC(year, month - 1, day) / 86_400_000;
}

function fromUtcDay(day: number): CalendarDate {
  const date = new Date(day * 86_400_000);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

export function addCalendarDays(date: CalendarDate, days: number): CalendarDate {
  return fromUtcDay(toUtcDay(date) + days);
}

export function calendarDaysBetween(from: CalendarDate, to: CalendarDate): number {
  return toUtcDay(to) - toUtcDay(from);
}

export function getCalendarDate(timeZone: string, now = new Date()): CalendarDate {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]));
  return { year: values.year, month: values.month, day: values.day };
}

export function getBillingReminder(today: CalendarDate, cycleStartDay: number): BillingReminder | null {
  if (!Number.isInteger(cycleStartDay) || cycleStartDay < 1 || cycleStartDay > 28) return null;

  const generatedThisMonth = { year: today.year, month: today.month, day: cycleStartDay };
  const latestGeneration = toUtcDay(generatedThisMonth) <= toUtcDay(today)
    ? generatedThisMonth
    : fromUtcDay(Date.UTC(today.year, today.month - 2, cycleStartDay) / 86_400_000);
  const daysSinceGeneration = calendarDaysBetween(latestGeneration, today);

  if (daysSinceGeneration === 1) return "PAYMENT_DAY_1";
  if (daysSinceGeneration === 10) return "PAYMENT_DAY_10";
  if (addCalendarDays(today, 3).day === cycleStartDay) return "CYCLE_APPROACHING";
  return null;
}

export function getReminderCopy(reminder: BillingReminder): { title: string; body: string } {
  switch (reminder) {
    case "CYCLE_APPROACHING":
      return { title: "Billing cycle coming up", body: "Your next card statement cycle begins in 3 days." };
    case "PAYMENT_DAY_1":
      return { title: "Bill payment reminder", body: "Your card bill was generated yesterday. Review and pay it when ready." };
    case "PAYMENT_DAY_10":
      return { title: "Bill payment reminder", body: "Your card bill was generated 10 days ago. Do not forget to pay it." };
  }
}
