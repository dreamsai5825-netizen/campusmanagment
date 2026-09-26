import { NextRequest, NextResponse } from 'next/server';
import { getDocument, setDocument, queryDocuments } from '@/lib/firestore-rest-api';
import crypto from 'crypto';

function md5(str: string) {
  return crypto.createHash('md5').update(str).digest('hex');
}

function parseWwwAuthenticate(header: string) {
  const params: Record<string, string> = {};
  const regex = /(\w+)=(?:"([^"]*)"|([^\s,]+))/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(header)) !== null) {
    params[match[1]] = match[2] !== undefined ? match[2] : match[3];
  }
  return params;
}

function buildDigestHeader(username: string, password: string, method: string, uri: string, wwwAuthHeader: string) {
  const params = parseWwwAuthenticate(wwwAuthHeader);
  const realm = params.realm || '';
  const nonce = params.nonce || '';
  const qop = params.qop || '';
  const opaque = params.opaque !== undefined ? params.opaque : '';

  const nc = '00000001';
  const cnonce = crypto.randomBytes(8).toString('hex');

  const ha1 = md5(`${username}:${realm}:${password}`);
  const ha2 = md5(`${method}:${uri}`);

  let responseHash: string;
  if (qop && qop.includes('auth')) {
    responseHash = md5(`${ha1}:${nonce}:${nc}:${cnonce}:auth:${ha2}`);
  } else {
    responseHash = md5(`${ha1}:${nonce}:${ha2}`);
  }

  let digestHeader = `Digest username="${username}", realm="${realm}", nonce="${nonce}", uri="${uri}", response="${responseHash}"`;
  if (qop) digestHeader += `, qop="auth", nc=${nc}, cnonce="${cnonce}"`;
  if (opaque !== undefined) digestHeader += `, opaque="${opaque}"`;

  return digestHeader;
}

const HIK_GROUP_DEPT_MAP: Record<number, string> = {
  1: 'ADMINISTRATOR',
  2: 'DEGREE',
  3: 'PARAMEDICAL',
  8: 'NURSING'
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const collegeId = body.collegeId;

    if (!collegeId) {
      return NextResponse.json({ error: 'collegeId is required' }, { status: 400 });
    }

    const collegeData = await getDocument('colleges', collegeId);
    if (!collegeData) {
      return NextResponse.json({ error: 'College not found' }, { status: 404 });
    }

    const biometrics = collegeData.biometricSettings;
    if (!biometrics || !biometrics.enabled) {
      return NextResponse.json({
        success: false,
        error: 'Biometric hardware integration is currently disabled for this institution. Please enable it in Settings.'
      }, { status: 400 });
    }

    const mappedDepartment = biometrics.mappedDepartment || '';
    if (!mappedDepartment) {
      return NextResponse.json({
        success: false,
        error: 'Biometric department mapping is not configured for this college. Please select the Mapped Department in settings first.'
      }, { status: 400 });
    }

    const deviceIp = biometrics.deviceIp?.trim();
    const username = biometrics.username || 'admin';
    const password = biometrics.password || '';

    if (!deviceIp) {
      return NextResponse.json({
        success: false,
        error: 'Device IP address is not configured.'
      }, { status: 400 });
    }

    // Retrieve existing faculty in Firestore
    const existingTeachers = await queryDocuments('teachers', 'collegeId', 'EQUAL', collegeId);

    // Fetch all registered terminal members from Hikvision device with pagination
    const isapiPath = '/ISAPI/AccessControl/UserInfo/Search?format=json';
    const isapiUrl = `http://${deviceIp}${isapiPath}`;
    const allTerminalUsers: Array<{ employeeNo: string; name: string; department: string }> = [];

    let searchPos = 0;
    const pageSize = 30;
    let keepSearching = true;

    while (keepSearching && searchPos < 300) {
      const searchPayload = {
        UserInfoSearchCond: {
          searchID: `import_users_${Date.now()}_${searchPos}`,
          searchResultPosition: searchPos,
          maxResults: pageSize
        }
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      // Probe request R1
      let response = await fetch(isapiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(searchPayload),
        signal: controller.signal
      }).finally(() => clearTimeout(timeoutId));

      // Handle Digest Auth if 401
      if (response.status === 401) {
        const wwwAuth = response.headers.get('www-authenticate');
        if (wwwAuth && wwwAuth.toLowerCase().includes('digest')) {
          const digestHeader = buildDigestHeader(username, password, 'POST', isapiPath, wwwAuth);
          const controller2 = new AbortController();
          const timeoutId2 = setTimeout(() => controller2.abort(), 6000);

          response = await fetch(isapiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': digestHeader
            },
            body: JSON.stringify(searchPayload),
            signal: controller2.signal
          }).finally(() => clearTimeout(timeoutId2));
        }
      }

      if (!response.ok) {
        break;
      }

      const data = await response.json();
      const userSearch = data?.UserInfoSearch || {};
      const users: any[] = userSearch?.UserInfo || [];

      if (!users.length) {
        break;
      }

      for (const u of users) {
        if (u.employeeNo) {
          const groupId = u.groupId;
          const mappedDept = HIK_GROUP_DEPT_MAP[groupId] || 'General Faculty';
          
          // Data isolation: Only import users belonging to the mapped department of the college
          if (mappedDepartment !== 'ALL' && mappedDept !== mappedDepartment) {
            continue;
          }

          allTerminalUsers.push({
            employeeNo: String(u.employeeNo).trim(),
            name: (u.name || `Faculty ${u.employeeNo}`).trim(),
            department: mappedDept
          });
        }
      }

      searchPos += users.length;
      const totalMatches = userSearch.totalMatches || 0;
      if (searchPos >= totalMatches) {
        keepSearching = false;
      }
    }

    if (allTerminalUsers.length === 0) {
      return NextResponse.json({
        success: false,
        error: `Could not retrieve registered members from ${deviceIp}. Check device connection and credentials.`
      }, { status: 400 });
    }

    // Import and map terminal members into Firestore teachers collection with correct Hikvision department
    let updatedCount = 0;
    let createdCount = 0;

    for (const member of allTerminalUsers) {
      const empNo = member.employeeNo;
      const memberName = member.name;
      const memberDept = member.department;

      // Find match in existing faculty roster
      const match = existingTeachers.find((t) =>
        (t.biometricId && String(t.biometricId).trim() === empNo) ||
        (t.name && t.name.toLowerCase().trim() === memberName.toLowerCase())
      );

      if (match) {
        // Update existing teacher with biometric ID and Hikvision department
        await setDocument('teachers', match.id, {
          ...match,
          biometricId: empNo,
          department: memberDept
        });
        updatedCount++;
      } else {
        // Create new teacher record for registered hardware member
        const cleanName = memberName.toLowerCase().replace(/[^a-z0-9]/g, '.');
        const generatedEmail = `${cleanName || 'member.' + empNo}@campus.edu`;
        const newTeacherId = `teacher_bio_${empNo}_${Date.now()}`;

        await setDocument('teachers', newTeacherId, {
          id: newTeacherId,
          name: memberName,
          email: generatedEmail,
          biometricId: empNo,
          collegeId: collegeId,
          department: memberDept,
          createdAt: new Date().toISOString()
        });
        createdCount++;
      }
    }

    return NextResponse.json({
      success: true,
      totalTerminalUsers: allTerminalUsers.length,
      updatedCount,
      createdCount,
      message: `Successfully imported and categorized ${allTerminalUsers.length} members from Hikvision terminal into their exact departments (${createdCount} new, ${updatedCount} updated).`
    });

  } catch (err: any) {
    console.error('Error importing terminal members:', err);
    return NextResponse.json({
      success: false,
      error: err.message || 'Failed to import terminal members'
    }, { status: 500 });
  }
}
