const { validateFile, MAX_FILE_SIZE, ALLOWED_TYPES } = require('../public/js/app');

describe('validateFile', () => {
  function makeFile(name, type, size) {
    return { name, type, size };
  }

  test('accepts a valid PNG under 10 MB', () => {
    const file = makeFile('mockup.png', 'image/png', 1024 * 1024);
    expect(validateFile(file)).toBeNull();
  });

  test('accepts a valid JPEG under 10 MB', () => {
    const file = makeFile('screen.jpg', 'image/jpeg', 500 * 1024);
    expect(validateFile(file)).toBeNull();
  });

  test('accepts a valid WEBP under 10 MB', () => {
    const file = makeFile('design.webp', 'image/webp', 2 * 1024 * 1024);
    expect(validateFile(file)).toBeNull();
  });

  test('rejects a GIF with unsupported format message', () => {
    const file = makeFile('anim.gif', 'image/gif', 100 * 1024);
    const result = validateFile(file);
    expect(result).not.toBeNull();
    expect(result).toContain('unsupported format');
    expect(result).toContain('anim.gif');
  });

  test('rejects a PDF with unsupported format message', () => {
    const file = makeFile('spec.pdf', 'application/pdf', 50 * 1024);
    const result = validateFile(file);
    expect(result).not.toBeNull();
    expect(result).toContain('unsupported format');
  });

  test('rejects a file exceeding 10 MB', () => {
    const file = makeFile('big.png', 'image/png', MAX_FILE_SIZE + 1);
    const result = validateFile(file);
    expect(result).not.toBeNull();
    expect(result).toContain('10 MB limit');
    expect(result).toContain('big.png');
  });

  test('accepts a file exactly at 10 MB', () => {
    const file = makeFile('exact.png', 'image/png', MAX_FILE_SIZE);
    expect(validateFile(file)).toBeNull();
  });
});
