import { buildTableName, normalizeTablePrefix, TableNames } from '../../src/database/table-names';

describe('database table name normalization', () => {
  afterEach(() => {
    TableNames.initialize('mochi');
  });

  it.each([
    ['mochi', 'mochi_servers'],
    ['mochi_', 'mochi_servers'],
    ['mochi.', 'mochi_servers'],
    ['mochi__', 'mochi_servers'],
    ['', 'servers']
  ])('maps prefix %p to a single canonical separator', (prefix, expected) => {
    expect(buildTableName(prefix, 'servers')).toBe(expected);
  });

  it('normalizes whitespace and trailing separators', () => {
    expect(normalizeTablePrefix('  custom_.  ')).toBe('custom');
  });

  it('keeps all TableNames getters on the initialized prefix', () => {
    TableNames.initialize('custom_');

    expect(TableNames.servers).toBe('custom_servers');
    expect(TableNames.apiTokens).toBe('custom_api_tokens');
    expect(TableNames.groupBindings).toBe('custom_group_bindings');
  });
});
