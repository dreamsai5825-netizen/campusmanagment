import * as XLSX from 'xlsx';
import { normalizeSlotTo24h } from './time-utils';

export type ParsedTimetableEvent = {
  id: string;
  day: string;
  startTime: string;
  endTime: string;
  customText?: string;
};

export type ParsedTimetable = {
  timeSlots: string[];
  days: string[];
  events: ParsedTimetableEvent[];
};

/**
 * Parse an Excel (.xlsx, .xls) or CSV file into timetable structure.
 * Expected format:
 * - Row 0: First cell = "Day" (or empty), rest = time slot headers e.g. "09:00 - 10:00" or "9:00 AM - 10:00 AM"
 * - Row 1+: First column = day name (Monday, Tuesday...), rest = event label per slot (empty = no event)
 */
export function parseTimetableFile(file: File): Promise<ParsedTimetable> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data || !(data instanceof ArrayBuffer)) {
          reject(new Error('Could not read file'));
          return;
        }
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        if (!firstSheet) {
          reject(new Error('No sheet found'));
          return;
        }
        const rows = XLSX.utils.sheet_to_json(firstSheet, {
          header: 1,
          defval: '',
          raw: false,
        }) as (string | number)[][];

        if (!rows.length) {
          resolve({ timeSlots: [], days: [], events: [] });
          return;
        }

        const headerRow = rows[0].map((c) => String(c ?? '').trim());
        const dayHeader = headerRow[0];
        const slotHeaders = headerRow.slice(1).filter(Boolean);
        const timeSlots = slotHeaders.map((h) => normalizeSlotTo24h(h)).filter(Boolean);

        const days: string[] = [];
        const events: ParsedTimetableEvent[] = [];
        let eventId = 0;

        for (let r = 1; r < rows.length; r++) {
          const row = rows[r] as (string | number)[];
          const dayCell = String(row[0] ?? '').trim();
          if (!dayCell) continue;
          days.push(dayCell);

          for (let c = 0; c < timeSlots.length; c++) {
            const slot = timeSlots[c];
            const [startTime = '', endTime = ''] = slot.split(' - ').map((s) => s.trim());
            const cellVal = row[c + 1];
            const label = typeof cellVal === 'number' ? String(cellVal) : String(cellVal ?? '').trim();
            if (!label) continue;
            events.push({
              id: `tt-upload-${++eventId}`,
              day: dayCell,
              startTime,
              endTime,
              customText: label,
            });
          }
        }

        resolve({
          timeSlots: timeSlots.length ? timeSlots : ['09:00 - 10:00', '10:00 - 11:00', '11:00 - 12:00', '12:00 - 13:00', '14:00 - 15:00', '15:00 - 16:00'],
          days: days.length ? days : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
          events,
        });
      } catch (err) {
        reject(err instanceof Error ? err : new Error('Failed to parse file'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}
