const { calculateTotal, generateCSV, generateClipboardText } = require('../public/js/estimateSheet');

const sampleGroups = [
  {
    name: 'Frontend',
    tasks:     [{ name: 'Login form',      complexity: 'Low',    mandays: 1.0, notes: null }],
    edgeCases: [{ name: 'Invalid creds',   complexity: 'Low',    mandays: 0.5, notes: null }],
    testing:   [{ name: 'Form unit tests', complexity: 'Low',    mandays: 0.5, notes: null }],
  },
  {
    name: 'Backend',
    tasks:     [{ name: 'Auth endpoint',   complexity: 'Medium', mandays: 1.5, notes: ['JWT requires token rotation on each refresh', 'Must handle concurrent refresh races'] }],
    edgeCases: [],
    testing:   [],
  },
];

describe('calculateTotal', () => {
  test('sums all manday values across groups and subgroups', () => {
    expect(calculateTotal(sampleGroups)).toBeCloseTo(3.5);
  });
  test('returns 0 for empty groups array', () => {
    expect(calculateTotal([])).toBe(0);
  });
  test('handles groups with empty subgroup arrays', () => {
    const g = [{ name: 'Backend', tasks: [{ name: 'API', complexity: 'Low', mandays: 2.0, notes: null }], edgeCases: [], testing: [] }];
    expect(calculateTotal(g)).toBe(2.0);
  });
});

describe('generateCSV', () => {
  test('first row is the header with Notes column', () => {
    expect(generateCSV(sampleGroups).split('\n')[0]).toBe('Group,Subgroup,Task,Complexity,Mandays,Notes');
  });
  test('core tasks use "Tasks" as subgroup label', () => {
    expect(generateCSV(sampleGroups)).toContain('Frontend,Tasks,Login form,Low,1,');
  });
  test('edge cases use "Edge Cases" as subgroup label', () => {
    expect(generateCSV(sampleGroups)).toContain('Frontend,Edge Cases,Invalid creds,Low,0.5,');
  });
  test('testing tasks use "Testing" as subgroup label', () => {
    expect(generateCSV(sampleGroups)).toContain('Frontend,Testing,Form unit tests,Low,0.5,');
  });
  test('task names containing commas are quoted', () => {
    const g = [{ name: 'FE', tasks: [{ name: 'Build nav, footer', complexity: 'Low', mandays: 1.0, notes: null }], edgeCases: [], testing: [] }];
    expect(generateCSV(g)).toContain('"Build nav, footer"');
  });
  test('notes array is joined with " | " in the Notes column', () => {
    expect(generateCSV(sampleGroups)).toContain('JWT requires token rotation on each refresh | Must handle concurrent refresh races');
  });
  test('null notes renders as empty Notes column', () => {
    const csv = generateCSV(sampleGroups);
    const loginRow = csv.split('\n').find(r => r.includes('Login form'));
    expect(loginRow).toBeDefined();
    expect(loginRow.endsWith(',')).toBe(true);
  });
});

describe('generateClipboardText', () => {
  test('first row is tab-separated header with Notes column', () => {
    expect(generateClipboardText(sampleGroups).split('\n')[0]).toBe('Group\tSubgroup\tTask\tComplexity\tMandays\tNotes');
  });
  test('data rows are tab-separated', () => {
    expect(generateClipboardText(sampleGroups)).toContain('Frontend\tTasks\tLogin form\tLow\t1\t');
  });
  test('notes array is joined with " | " in clipboard Notes column', () => {
    expect(generateClipboardText(sampleGroups)).toContain('JWT requires token rotation on each refresh | Must handle concurrent refresh races');
  });
});
