import {
  buildContentDisposition,
  buildStorageKey,
  decodeUploadedName,
  getAllowedExtension,
  isSafeStorageKey,
  sanitizeOriginalName,
} from './documents-storage';

describe('documents-storage', () => {
  it('should allow only listed extensions (case-insensitive)', () => {
    expect(getAllowedExtension('NOR.PDF')).toBe('pdf');
    expect(getAllowedExtension('crew.list.xlsx')).toBe('xlsx');
    expect(getAllowedExtension('page.html')).toBeNull();
    expect(getAllowedExtension('script.pdf.exe')).toBeNull();
    expect(getAllowedExtension('noextension')).toBeNull();
  });

  it('should generate random storage keys that pass the safety check', () => {
    const key = buildStorageKey('pdf');
    expect(key).toMatch(/^[a-f0-9-]{36}\.pdf$/);
    expect(isSafeStorageKey(key)).toBe(true);
    expect(isSafeStorageKey('../../etc/passwd')).toBe(false);
  });

  it('should re-decode latin1-mangled UTF-8 names from multipart', () => {
    const mangled = Buffer.from('Декларация.pdf', 'utf8').toString('latin1');
    expect(decodeUploadedName(mangled)).toBe('Декларация.pdf');
    expect(decodeUploadedName('plain.pdf')).toBe('plain.pdf');
    // genuine latin1 that is not valid UTF-8 stays as is
    expect(decodeUploadedName('caf\u00e9.pdf')).toBe('caf\u00e9.pdf');
  });

  it('should strip path parts and control characters from names', () => {
    expect(sanitizeOriginalName('C:\\temp\\..\\evil\r\n.pdf')).toBe(
      'evil__.pdf',
    );
    expect(sanitizeOriginalName('/etc/passwd')).toBe('passwd');
    expect(sanitizeOriginalName('   ')).toBe('document');
    const long = `${'a'.repeat(300)}.pdf`;
    expect(sanitizeOriginalName(long)).toHaveLength(255);
    expect(sanitizeOriginalName(long).endsWith('.pdf')).toBe(true);
  });

  it('should build an attachment header with ASCII fallback and RFC 5987 name', () => {
    expect(buildContentDisposition('Sulină "NOR" (1).pdf')).toBe(
      `attachment; filename="Sulin_ _NOR_ (1).pdf"; filename*=UTF-8''Sulin%C4%83%20_NOR_%20%281%29.pdf`,
    );
  });
});
