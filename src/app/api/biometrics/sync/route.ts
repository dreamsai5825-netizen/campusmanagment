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

    const deviceIp = biometrics.deviceIp?.trim();
    const username = biometrics.username || 'admin';
    const password = biometrics.password || '';

    if (!deviceIp) {
      return NextResponse.json({
        success: false,
        error: 'Device IP address is not configured.'
      }, { status: 400 });
    }

    // Date range determination
    const nowObj = new Date();
    const todayIso = nowObj.toISOString().split('T')[0];
    const thirtyDaysAgoIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const isFullBackfill = Boolean(body.fullBackfill);
    const startDate = isFullBackfill ? '2024-01-01' : (body.startDate || thirtyDaysAgoIso);
    const endDate = body.endDate || todayIso;

    // Build list of date range chunks to query from Hikvision device
    const dateChunks: Array<{ startDate: string; endDate: string }> = [];

    const reqStart = isFullBackfill ? '2024-01-01' : (body.startDate || thirtyDaysAgoIso);
    const reqEnd = body.endDate || todayIso;

    // Helper to generate monthly chunks between reqStart and reqEnd
    const startObj = new Date(reqStart);
    const endObj = new Date(reqEnd);

    let curY = startObj.getFullYear();
    let curM = startObj.getMonth() + 1; // 1-12

    const endY = endObj.getFullYear();
    const endM = endObj.getMonth() + 1;

    while (curY < endY || (curY === endY && curM <= endM)) {
      const mm = String(curM).padStart(2, '0');
      const lastDayNum = new Date(curY, curM, 0).getDate();
      
      const monthStartStr = `${curY}-${mm}-01`;
      const monthEndStr = `${curY}-${mm}-${String(lastDayNum).padStart(2, '0')}`;

      const chunkStart = reqStart > monthStartStr ? reqStart : monthStartStr;
      const chunkEnd = reqEnd < monthEndStr ? reqEnd : monthEndStr;

      if (chunkStart <= chunkEnd) {
        dateChunks.push({
          startDate: chunkStart,
          endDate: chunkEnd
        });
      }

      curM++;
      if (curM > 12) {
        curM = 1;
        curY++;
      }
    }

    // Retrieve faculty in Firestore
    const teachersList = await queryDocuments('teachers', 'collegeId', 'EQUAL', collegeId);
    const mappedTeachersByBioId: Record<string, { id: string; name: string }> = {};
    const mappedTeachersByName: Record<string, { id: string; name: string }> = {};
    let mappedCount = 0;

    for (const t of teachersList) {
      if (t.biometricId) {
        const cleanBioId = String(t.biometricId).trim();
        mappedTeachersByBioId[cleanBioId] = { id: t.id, name: t.name };
        const numBioId = parseInt(cleanBioId, 10);
        if (!isNaN(numBioId) && !mappedTeachersByBioId[String(numBioId)]) {
          mappedTeachersByBioId[String(numBioId)] = { id: t.id, name: t.name };
        }
        mappedCount++;
      }
      if (t.name) {
        mappedTeachersByName[t.name.trim().toLowerCase()] = { id: t.id, name: t.name };
      }
    }

    let fetchedEvents: Array<{ emp_no: string; name: string; time: string; device_name: string }> = [];
    let isMockOrSimulated = false;
    let networkErrorMessage = '';

    // Query Hikvision device ISAPI for each date chunk
    const isapiPath = '/ISAPI/AccessControl/AcsEvent?format=json';
    const isapiUrl = `http://${deviceIp}${isapiPath}`;

    for (let chunkIdx = 0; chunkIdx < dateChunks.length; chunkIdx++) {
      const chunk = dateChunks[chunkIdx];
      // CRITICAL FIX: Generate ONE stable searchID per chunk session so Hikvision ISAPI advances pagination cursor!
      const stableSearchId = `sync_${collegeId}_${chunkIdx}_${Date.now()}`;
      
      let searchPos = 0;
      const pageSize = 30;
      let keepFetching = true;
      const maxSearchPosForChunk = 2000;

      try {
        while (keepFetching && searchPos < maxSearchPosForChunk) {
          const acsCond: any = {
            searchID: stableSearchId,
            searchResultPosition: searchPos,
            maxResults: pageSize,
            major: 0,
            minor: 0,
            startTime: `${chunk.startDate}T00:00:00+05:30`,
            endTime: `${chunk.endDate}T23:59:59+05:30`
          };

          const searchPayload = { AcsEventCond: acsCond };

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 6000);

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
            const errBodyText = await response.text().catch(() => '');
            if (errBodyText.includes('<lockStatus>lock</lockStatus>') || errBodyText.includes('lockStatus')) {
              const matchTime = errBodyText.match(/<unlockTime>(\d+)<\/unlockTime>/);
              const secondsLeft = matchTime ? parseInt(matchTime[1], 10) : 1800;
              const minsLeft = Math.ceil(secondsLeft / 60);
              networkErrorMessage = `Hikvision terminal at ${deviceIp} is locked (${minsLeft} min remaining). Power cycle device to clear.`;
            } else if (response.status === 401) {
              networkErrorMessage = `Device authentication failed (HTTP 401). Check password in Settings.`;
            } else {
              networkErrorMessage = `Device HTTP response ${response.status}: ${response.statusText}`;
            }
            break;
          }

          const data = await response.json();
          const acsEvent = data?.AcsEvent || {};
          const infoList: any[] = acsEvent?.InfoList || [];

          if (!infoList.length) {
            break;
          }

          for (const ev of infoList) {
            const empNo = ev.employeeNoString ? String(ev.employeeNoString).trim() : '';
            const name = ev.name ? String(ev.name).trim() : '';
            if (empNo || name) {
              fetchedEvents.push({
                emp_no: empNo,
                name: name,
                time: ev.time || new Date().toISOString(),
                device_name: ev.deviceName || 'Main Gate Terminal'
              });
            }
          }

          searchPos += infoList.length;
          const totalMatches = acsEvent.totalMatches || 0;
          if (searchPos >= totalMatches) {
            keepFetching = false;
          }
        }
      } catch (err: any) {
        networkErrorMessage = err.name === 'AbortError'
          ? `Connection to device IP ${deviceIp} timed out.`
          : (err.message || 'Device connection failed.');
      }
    }

    // Simulation fallback ONLY when explicitly requested (e.g. for testing/demo)
    if (fetchedEvents.length === 0 && (body.simulateIfUnreachable || body.mock)) {
      isMockOrSimulated = true;
      
      // Calculate start and end date objects for simulation
      const startDt = new Date(startDate);
      const endDt = new Date(endDate);
      const dayMs = 24 * 60 * 60 * 1000;
      const numDays = Math.min(31, Math.max(1, Math.round((endDt.getTime() - startDt.getTime()) / dayMs) + 1));

      Object.keys(mappedTeachersByBioId).forEach((empNo) => {
        const teacherName = mappedTeachersByBioId[empNo].name;
        for (let i = 0; i < numDays; i++) {
          const curDt = new Date(startDt.getTime() + i * dayMs);
          // Skip Sundays for realistic simulation
          if (curDt.getDay() === 0) continue;

          const dateIso = curDt.toISOString().split('T')[0];
          
          // Morning check-in (between 08:45 AM and 09:45 AM)
          const inTimeIso = `${dateIso}T09:15:00+05:30`;
          // Afternoon check-out (between 17:00 PM and 17:45 PM)
          const outTimeIso = `${dateIso}T17:30:00+05:30`;

          fetchedEvents.push({
            emp_no: empNo,
            name: teacherName,
            time: inTimeIso,
            device_name: `Wi-Fi Terminal (${deviceIp})`
          });

          fetchedEvents.push({
            emp_no: empNo,
            name: teacherName,
            time: outTimeIso,
            device_name: `Wi-Fi Terminal (${deviceIp})`
          });
        }
      });
    }

    if (fetchedEvents.length === 0) {
      const updatedSettings = {
        ...biometrics,
        lastSyncedAt: new Date().toISOString(),
        lastSyncStatus: 'Offline / Unreachable',
        lastSyncMessage: networkErrorMessage || `No swipe events returned.`
      };
      await setDocument('colleges', collegeId, { biometricSettings: updatedSettings });

      return NextResponse.json({
        success: false,
        deviceIp,
        mappedFacultyCount: mappedCount,
        error: `Could not fetch logs directly from ${deviceIp}. ${networkErrorMessage || 'No swipe events found on hardware.'}`,
        recommendation: `Ensure device is powered on at ${deviceIp} and connected on local Wi-Fi.`
      });
    }

    // High-performance in-memory grouping by (eventDate + teacherId)
    const groupedEvents: Record<string, {
      teacherId: string;
      teacherName: string;
      date: string;
      logs: Array<{ time: string; type: string; deviceId: string }>;
    }> = {};

    for (const ev of fetchedEvents) {
      const cleanEmpNo = ev.emp_no ? String(parseInt(ev.emp_no, 10)) : '';
      const teacherInfo = mappedTeachersByBioId[ev.emp_no]
        || (cleanEmpNo ? mappedTeachersByBioId[cleanEmpNo] : undefined)
        || (ev.name ? mappedTeachersByName[ev.name.toLowerCase()] : undefined);

      if (!teacherInfo) continue;

      const eventDate = ev.time.split('T')[0];
      const docId = `${eventDate}_${teacherInfo.id}`;

      if (!groupedEvents[docId]) {
        groupedEvents[docId] = {
          teacherId: teacherInfo.id,
          teacherName: teacherInfo.name,
          date: eventDate,
          logs: []
        };
      }

      const logTimeObj = new Date(ev.time);
      const logType = logTimeObj.getHours() < 13 ? 'Check-In' : 'Check-Out';

      groupedEvents[docId].logs.push({
        time: ev.time,
        type: logType,
        deviceId: ev.device_name
      });
    }

    // Fast batch write of aggregated daily attendance documents
    let processedRecords = 0;
    let newCheckInsCount = 0;

    for (const docId of Object.keys(groupedEvents)) {
      const group = groupedEvents[docId];
      const existingDoc = await getDocument('facultyAttendance', docId);

      const existingLogs: any[] = existingDoc ? (existingDoc.logs || []) : [];
      const combinedLogs = [...existingLogs];

      let newLogAdded = false;
      for (const newL of group.logs) {
        if (!combinedLogs.some((l) => l.time === newL.time)) {
          combinedLogs.push(newL);
          newLogAdded = true;
        }
      }

      if (newLogAdded || !existingDoc) {
        combinedLogs.sort((a: any, b: any) => (a.time || '').localeCompare(b.time || ''));
        const firstIn = combinedLogs[0].time;
        const lastOut = combinedLogs[combinedLogs.length - 1].time;

        await setDocument('facultyAttendance', docId, {
          teacherId: group.teacherId,
          teacherName: group.teacherName,
          collegeId: collegeId,
          date: group.date,
          firstCheckIn: firstIn,
          lastCheckOut: lastOut,
          status: 'Present',
          logs: combinedLogs
        });

        processedRecords += combinedLogs.length;
        if (!existingDoc) newCheckInsCount++;
      }
    }

    const nowStr = new Date().toISOString();
    const updatedBiometrics = {
      ...biometrics,
      lastSyncedAt: nowStr,
      lastSyncStatus: 'Success',
      lastSyncMessage: `Synced ${processedRecords} swipe record(s) ${isFullBackfill ? '(Full History)' : `between ${startDate} and ${endDate}`}.`
    };
    await setDocument('colleges', collegeId, { biometricSettings: updatedBiometrics });

    return NextResponse.json({
      success: true,
      deviceIp,
      syncedCount: processedRecords,
      newCheckIns: newCheckInsCount,
      totalEventsFound: fetchedEvents.length,
      isSimulated: isMockOrSimulated,
      isFullBackfill,
      lastSyncedAt: nowStr,
      message: isFullBackfill
        ? `Successfully backfilled ${processedRecords} historical attendance logs from terminal installation date.`
        : `Successfully fetched and synced ${processedRecords} biometric attendance logs from terminal (${deviceIp}).`
    });

  } catch (err: any) {
    console.error('Error syncing biometric data:', err);
    return NextResponse.json({
      success: false,
      error: err.message || 'Internal server error while syncing biometric data'
    }, { status: 500 });
  }
}
