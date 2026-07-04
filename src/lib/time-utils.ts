/**
 * Format 24-hour time string (HH:mm or H:mm) to 12-hour with AM/PM.
 * e.g. "09:00" -> "9:00 AM", "14:30" -> "2:30 PM", "12:00" -> "12:00 PM"
 */
export function formatTime24to12(time24: string): string {
  const t = time24.trim();
  if (!t) return '';
  const [hStr = '0', mStr = '0'] = t.split(':');
  const h = parseInt(hStr, 10) || 0;
  const m = parseInt(mStr, 10) || 0;
  const h12 = h % 12 || 12;
  const ampm = h < 12 ? 'AM' : 'PM';
  const mm = String(m).padStart(2, '0');
  return `${h12}:${mm} ${ampm}`;
}

/** Format a slot string "09:00 - 10:00" to "9:00 AM - 10:00 AM". */
export function formatSlot12h(slot: string): string {
  const [start = '', end = ''] = slot.split(' - ').map((s) => s.trim());
  if (!start || !end) return slot;
  return `${formatTime24to12(start)} - ${formatTime24to12(end)}`;
}

/** Parse 12h time "9:00 AM" / "2:30 PM" to 24h "09:00" / "14:30". */
export function parseTime12to24(time12: string): string {
  const t = time12.trim().toUpperCase();
  if (!t) return '';
  const hasAm = t.endsWith(' AM');
  const hasPm = t.endsWith(' PM');
  let rest = t.replace(/\s*(AM|PM)$/i, '').trim();
  const [hStr = '0', mStr = '0'] = rest.split(':').map((s) => s.trim());
  let h = parseInt(hStr, 10) || 0;
  const m = parseInt(mStr, 10) || 0;
  if (hasPm && h !== 12) h += 12;
  if (hasAm && h === 12) h = 0;
  if (!hasAm && !hasPm) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Normalize slot string to 24h "HH:mm - HH:mm" (handles 12h or 24h input). */
export function normalizeSlotTo24h(slot: string): string {
  const [start = '', end = ''] = slot.split(' - ').map((s) => s.trim());
  if (!start || !end) return slot;
  const s24 = start.includes('AM') || start.includes('PM') ? parseTime12to24(start) : start;
  const e24 = end.includes('AM') || end.includes('PM') ? parseTime12to24(end) : end;
  const pad = (x: string) => {
    const [a = '0', b = '0'] = x.split(':');
    return `${String(parseInt(a, 10)).padStart(2, '0')}:${String(parseInt(b, 10)).padStart(2, '0')}`;
  };
  return `${pad(s24)} - ${pad(e24)}`;
}
