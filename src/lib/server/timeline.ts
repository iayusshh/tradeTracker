import { format, getISOWeek, startOfWeek } from "date-fns";

export function monthKeyFromDate(date: Date) {
  return format(date, "yyyy-MM");
}

export function monthLabelFromDate(date: Date) {
  return format(date, "MMMM yyyy");
}

export function weekKeyFromDate(date: Date) {
  const weekStart = startOfWeek(date, { weekStartsOn: 1 });
  return format(weekStart, "yyyy-MM-dd");
}

export function weekLabelFromDate(date: Date) {
  return `Week ${getISOWeek(date)}`;
}
