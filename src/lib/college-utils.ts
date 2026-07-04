/**
 * Generates a short, easy-to-type code for private institutions.
 * 6 characters, uppercase + digits, avoids ambiguous chars (I,O,0,1).
 */
export function generatePrivateCollegeCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I, O, 0, 1
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/** Normalize college code for lookup: uppercase, trim. */
export function normalizeCollegeCode(code: string): string {
  return code.trim().toUpperCase();
}
