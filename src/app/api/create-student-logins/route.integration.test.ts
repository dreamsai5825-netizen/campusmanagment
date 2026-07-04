import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';

vi.mock('@/lib/firebase-admin', () => ({
  getAdminAuth: vi.fn(),
  getAdminFirestore: vi.fn(),
}));

async function getMocks() {
  const { getAdminAuth, getAdminFirestore } = await import('@/lib/firebase-admin');
  return {
    getAdminAuth: getAdminAuth as ReturnType<typeof vi.fn>,
    getAdminFirestore: getAdminFirestore as ReturnType<typeof vi.fn>,
  };
}

function createRequest(overrides: { headers?: Headers } = {}) {
  const headers = overrides.headers ?? new Headers();
  return new NextRequest('http://localhost:3000/api/create-student-logins', {
    method: 'POST',
    headers,
  });
}

describe('POST /api/create-student-logins', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when Authorization header is missing', async () => {
    const req = createRequest();
    const res = await POST(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toMatch(/missing token/i);
  });

  it('returns 401 when Bearer token is not present', async () => {
    const req = createRequest({
      headers: new Headers({ Authorization: 'Basic x' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 403 when principal not found and verifyIdToken succeeds', async () => {
    const { getAdminAuth, getAdminFirestore } = await getMocks();
    getAdminAuth.mockReturnValue({
      verifyIdToken: vi.fn().mockResolvedValue({ uid: 'uid', email: 'p@school.com' }),
    });
    const mockPrincipalGet = vi.fn().mockResolvedValue({ exists: false });
    const mockByEmailGet = vi.fn().mockResolvedValue({ empty: true });
    getAdminFirestore.mockReturnValue({
      collection: vi.fn((name: string) => {
        if (name === 'principals') {
          return {
            doc: vi.fn(() => ({ get: mockPrincipalGet })),
            where: vi.fn(() => ({ limit: vi.fn(() => ({ get: mockByEmailGet })) })),
          };
        }
        return {};
      }),
    });

    const req = createRequest({
      headers: new Headers({ Authorization: 'Bearer valid-token' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toMatch(/principal only|forbidden/i);
  });

  it('returns 200 with body shape when principal exists and has students', async () => {
    const { getAdminAuth, getAdminFirestore } = await getMocks();
    getAdminAuth.mockReturnValue({
      verifyIdToken: vi.fn().mockResolvedValue({ uid: 'principal-1', email: 'p@school.com' }),
      getUserByEmail: vi.fn().mockRejectedValue(new Error('user not found')),
      createUser: vi.fn().mockResolvedValue({ uid: 'new-uid' }),
    });
    const principalDoc = { exists: true, data: () => ({ collegeId: 'college-1' }) };
    const studentsDocs = [
      { id: 's1', data: () => ({ email: 'student1@school.com' }) },
      { id: 's2', data: () => ({ email: '' }) },
    ];
    getAdminFirestore.mockReturnValue({
      collection: vi.fn((name: string) => {
        if (name === 'principals') {
          return {
            doc: vi.fn(() => ({ get: vi.fn().mockResolvedValue(principalDoc) })),
            where: vi.fn(() => ({ limit: vi.fn(() => ({ get: vi.fn().mockResolvedValue({ empty: true }) })) })),
          };
        }
        if (name === 'students') {
          return {
            where: vi.fn(() => ({
              get: vi.fn().mockResolvedValue({ docs: studentsDocs }),
            })),
          };
        }
        return {};
      }),
    });

    const req = createRequest({
      headers: new Headers({ Authorization: 'Bearer valid-token' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({
      created: expect.any(Number),
      skipped: expect.any(Number),
      total: 2,
    });
    expect(json.message).toBeDefined();
  });
});
