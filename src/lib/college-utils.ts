/**
 * Generates a short, easy-to-type code for private institutions/colleges.
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

/**
 * Generates a unique Institution Code for System Admins (e.g. INST-8492 or INST-ABCDEF).
 */
export function generateInstitutionCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let rand = '';
  for (let i = 0; i < 6; i++) {
    rand += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `INST-${rand}`;
}

/** Normalize college code for lookup: uppercase, trim. */
export function normalizeCollegeCode(code: string): string {
  return code.trim().toUpperCase();
}

/** Normalize institution code for lookup: uppercase, trim. */
export function normalizeInstitutionCode(code: string): string {
  return code.trim().toUpperCase();
}

