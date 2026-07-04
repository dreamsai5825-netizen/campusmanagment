import { describe, it, expect } from 'vitest';
import {
  formatTime24to12,
  formatSlot12h,
  parseTime12to24,
  normalizeSlotTo24h,
} from './time-utils';

describe('formatTime24to12', () => {
  it('formats 09:00 to 9:00 AM', () => {
    expect(formatTime24to12('09:00')).toBe('9:00 AM');
  });

  it('formats 14:30 to 2:30 PM', () => {
    expect(formatTime24to12('14:30')).toBe('2:30 PM');
  });

  it('formats 12:00 to 12:00 PM', () => {
    expect(formatTime24to12('12:00')).toBe('12:00 PM');
  });

  it('formats 00:00 to 12:00 AM', () => {
    expect(formatTime24to12('00:00')).toBe('12:00 AM');
  });

  it('returns empty string for empty input', () => {
    expect(formatTime24to12('')).toBe('');
  });

  it('trims input', () => {
    expect(formatTime24to12('  09:00  ')).toBe('9:00 AM');
  });
});

describe('formatSlot12h', () => {
  it('formats slot "09:00 - 10:00" to 12h', () => {
    expect(formatSlot12h('09:00 - 10:00')).toBe('9:00 AM - 10:00 AM');
  });

  it('returns original if invalid slot', () => {
    expect(formatSlot12h('invalid')).toBe('invalid');
  });
});

describe('parseTime12to24', () => {
  it('parses "9:00 AM" to 09:00', () => {
    expect(parseTime12to24('9:00 AM')).toBe('09:00');
  });

  it('parses "2:30 PM" to 14:30', () => {
    expect(parseTime12to24('2:30 PM')).toBe('14:30');
  });

  it('parses "12:00 PM" to 12:00', () => {
    expect(parseTime12to24('12:00 PM')).toBe('12:00');
  });

  it('parses "12:00 AM" to 00:00', () => {
    expect(parseTime12to24('12:00 AM')).toBe('00:00');
  });

  it('returns empty for empty input', () => {
    expect(parseTime12to24('')).toBe('');
  });
});

describe('normalizeSlotTo24h', () => {
  it('normalizes 24h slot with padding', () => {
    expect(normalizeSlotTo24h('9:0 - 10:0')).toBe('09:00 - 10:00');
  });

  it('normalizes 12h slot to 24h', () => {
    expect(normalizeSlotTo24h('9:00 AM - 2:30 PM')).toBe('09:00 - 14:30');
  });
});
