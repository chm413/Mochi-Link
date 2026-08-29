import {
  createTimestamp,
  isCompatibleVersion,
  isValidTimestamp,
  normalizeTimestamp
} from '../../src/utils/protocol-helpers';

describe('protocol timestamp helpers', () => {
  it('creates and validates canonical Unix millisecond timestamps', () => {
    const timestamp = createTimestamp();

    expect(Number.isInteger(timestamp)).toBe(true);
    expect(isValidTimestamp(timestamp)).toBe(true);
    expect(isValidTimestamp(new Date(timestamp).toISOString())).toBe(false);
  });

  it('normalizes legacy ISO strings and Date objects to milliseconds', () => {
    const iso = '2026-08-29T12:00:00.000Z';
    const expected = Date.parse(iso);

    expect(normalizeTimestamp(iso)).toBe(expected);
    expect(normalizeTimestamp(new Date(iso))).toBe(expected);
    expect(normalizeTimestamp(expected)).toBe(expected);
  });

  it('accepts only the canonical version and its documented legacy alias', () => {
    expect(isCompatibleVersion('2.0')).toBe(true);
    expect(isCompatibleVersion('2.0.0')).toBe(true);
    expect(isCompatibleVersion('2.0.1')).toBe(false);
  });
});
