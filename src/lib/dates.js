// Week helpers. The platform keys timesheets by the Monday of the ISO week.

export const DAYS = [
  ['mon', 'Monday'],
  ['tue', 'Tuesday'],
  ['wed', 'Wednesday'],
  ['thu', 'Thursday'],
  ['fri', 'Friday'],
  ['sat', 'Saturday'],
  ['sun', 'Sunday'],
];

// Return the Monday (as a YYYY-MM-DD string) of the week containing `date`.
export function mondayOf(date = new Date()) {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7; // 0 = Monday
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

// Human label for a week-start date, e.g. "Week of 20 Jul 2026".
export function weekLabel(isoDate) {
  const d = new Date(isoDate + 'T00:00:00');
  return 'Week of ' + d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function sumHours(hours) {
  return DAYS.reduce((t, [k]) => t + (Number(hours?.[k]) || 0), 0);
}

export function money(amount, currency = 'GBP') {
  if (amount == null) return '';
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amount);
}
