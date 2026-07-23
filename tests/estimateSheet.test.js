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
    tasks:     [{ name: 'Auth endpoint',   complexity: 'Medium', mandays: 1.5, notes: 'JWT handling' }],
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
  test('first row is the header', () => {
    expect(generateCSV(sampleGroups).split('\n')[0]).toBe('Group,Subgroup,Task,Complexity,Mandays');
  });
  test('core tasks use "Tasks" as subgroup label', () => {
    expect(generateCSV(sampleGroups)).toContain('Frontend,Tasks,Login form,Low,1');
  });
  test('edge cases use "Edge Cases" as subgroup label', () => {
    expect(generateCSV(sampleGroups)).toContain('Frontend,Edge Cases,Invalid creds,Low,0.5');
  });
  test('testing tasks use "Testing" as subgroup label', () => {
    expect(generateCSV(sampleGroups)).toContain('Frontend,Testing,Form unit tests,Low,0.5');
  });
  test('task names containing commas are quoted', () => {
    const g = [{ name: 'FE', tasks: [{ name: 'Build nav, footer', complexity: 'Low', mandays: 1.0, notes: null }], edgeCases: [], testing: [] }];
    expect(generateCSV(g)).toContain('"Build nav, footer"');
  });
});

describe('generateClipboardText', () => {
  test('first row is tab-separated header', () => {
    expect(generateClipboardText(sampleGroups).split('\n')[0]).toBe('Group\tSubgroup\tTask\tComplexity\tMandays');
  });
  test('data rows are tab-separated', () => {
    expect(generateClipboardText(sampleGroups)).toContain('Frontend\tTasks\tLogin form\tLow\t1');
  });
});
