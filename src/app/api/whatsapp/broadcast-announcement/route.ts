import { NextRequest, NextResponse } from 'next/server';
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

/**
 * Server-side function to send WhatsApp message using Python script
 */
async function sendWhatsAppMessageServerSide(phoneNumber: string, message: string): Promise<{ success: boolean; error?: string }> {
  try {
    const pythonServiceUrl = process.env.PYTHON_SERVICE_URL;
    if (pythonServiceUrl) {
      try {
        console.log(`[Broadcast Send] Forwarding to Python service on Cloud Run: ${pythonServiceUrl}`);
        const response = await fetch(`${pythonServiceUrl.replace(/\/$/, '')}/api/whatsapp/send`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ phoneNumber, message })
        });
        const result = await response.json();
        return result;
      } catch (err: any) {
        console.error(`[Broadcast Send] Cloud Run forwarding failed:`, err);
        return { success: false, error: `Cloud Run forwarding failed: ${err.message}` };
      }
    }

    const scriptPath = path.join(process.cwd(), 'whatsapp_service.py');
    const pythonCommand = process.platform === 'win32' ? 'python' : 'python3';
    
    // Escape message properly for command line
    const escapedMessage = message.replace(/"/g, '\\"').replace(/\n/g, '\\n');
    
    const { stdout, stderr } = await execAsync(
      `${pythonCommand} "${scriptPath}" "${phoneNumber}" "${escapedMessage}"`,
      { maxBuffer: 1024 * 1024 * 10 } // 10MB buffer
    );

    if (stderr && !stderr.includes('INFO')) {
      console.error('Python script stderr:', stderr);
    }

    // Parse the JSON output from Python script
    const result = JSON.parse(stdout.trim());
    return result;
  } catch (execError: any) {
    console.error(`Error executing WhatsApp script for ${phoneNumber}:`, execError);
    
    // Try to parse error output
    try {
      const errorResult = JSON.parse(execError.stdout || execError.stderr || '{}');
      return errorResult;
    } catch {
      return {
        success: false,
        error: execError.message || 'Failed to execute WhatsApp service',
      };
    }
  }
}

/**
 * API Route to broadcast announcements via WhatsApp and create in-app notifications
 * POST /api/whatsapp/broadcast-announcement
 * 
 * Only sends notifications to users matching the selected audience:
 * - 'all-students': Only students
 * - 'all-teachers': Only teachers
 * - 'all-parents': Only parents
 * - 'all-users': All user types (students, teachers, and parents)
 */
export async function POST(request: NextRequest) {
  try {
    const { collegeId, announcementTitle, announcementContent, audience, senderName, senderRole } = await request.json();

    if (!collegeId || !announcementTitle || !announcementContent || !audience) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate audience value
    const validAudiences = ['all-students', 'all-teachers', 'all-parents', 'all-users'];
    if (!validAudiences.includes(audience)) {
      return NextResponse.json(
        { success: false, error: `Invalid audience. Must be one of: ${validAudiences.join(', ')}` },
        { status: 400 }
      );
    }

    const users: { phone: string; userId: string; userType: string }[] = [];

    // Format the message
    const message = `🔔 *${announcementTitle}*\n\n${announcementContent}\n\n_From CampusConnect_`;

    // Get users based on audience - STRICT filtering: only include users matching the selected audience
    if (audience === 'all-students' || audience === 'all-users') {
      const studentsQuery = query(
        collection(db, 'students'),
        where('collegeId', '==', collegeId)
      );
      const studentsSnapshot = await getDocs(studentsQuery);
      
      studentsSnapshot.forEach((doc) => {
        const studentData = doc.data();
        users.push({
          phone: studentData.phone || '',
          userId: doc.id,
          userType: 'student',
        });
      });
    }

    if (audience === 'all-parents' || audience === 'all-users') {
      const parentsQuery = query(
        collection(db, 'parents'),
        where('collegeId', '==', collegeId)
      );
      const parentsSnapshot = await getDocs(parentsQuery);
      
      parentsSnapshot.forEach((doc) => {
        const parentData = doc.data();
        users.push({
          phone: parentData.phone || '',
          userId: doc.id,
          userType: 'parent',
        });
      });
    }

    if (audience === 'all-teachers' || audience === 'all-users') {
      const teachersQuery = query(
        collection(db, 'teachers'),
        where('collegeId', '==', collegeId)
      );
      const teachersSnapshot = await getDocs(teachersQuery);
      
      teachersSnapshot.forEach((doc) => {
        const teacherData = doc.data();
        users.push({
          phone: teacherData.phone || '',
          userId: doc.id,
          userType: 'teacher',
        });
      });
    }

    // Remove duplicates based on userId (same user should only get one notification)
    const uniqueUsers = new Map<string, { phone: string; userId: string; userType: string }>();
    users.forEach((item) => {
      if (!uniqueUsers.has(item.userId)) {
        uniqueUsers.set(item.userId, item);
      }
    });

    const userList = Array.from(uniqueUsers.values());
    console.log(`[Broadcast] Found ${userList.length} users for audience: ${audience}`);
    
    const notificationPromises: Promise<any>[] = [];
    const whatsAppPromises: Promise<any>[] = [];

    // Create in-app notifications for all users matching the audience
    userList.forEach((user) => {
      const notificationPromise = addDoc(collection(db, 'notifications'), {
        collegeId,
        recipientId: user.userId,
        type: 'announcement',
        sender: {
          name: senderName || 'Administrator',
          role: senderRole || 'admin',
        },
        title: announcementTitle,
        content: announcementContent,
        date: new Date().toISOString(),
        read: false,
      }).catch((err) => {
        console.error(`Failed to create notification for user ${user.userId}:`, err);
        return null;
      });
      notificationPromises.push(notificationPromise);
    });

    // Send WhatsApp notifications only to users with phone numbers
    // Call Python script directly from server-side
    const usersWithPhone = userList.filter((u) => u.phone && u.phone.trim() !== '');
    console.log(`[Broadcast] Sending WhatsApp to ${usersWithPhone.length} users with phone numbers`);
    
    usersWithPhone.forEach((user) => {
      console.log(`[Broadcast] Sending WhatsApp to ${user.phone} (${user.userType})`);
      const whatsAppPromise = sendWhatsAppMessageServerSide(user.phone, message).then((result) => {
        if (result.success) {
          console.log(`[Broadcast] Successfully sent WhatsApp to ${user.phone}`);
        } else {
          console.error(`[Broadcast] Failed to send WhatsApp to ${user.phone}:`, result.error);
        }
        return result;
      }).catch((err) => {
        console.error(`[Broadcast] Error sending WhatsApp to ${user.phone}:`, err);
        return { success: false, phone: user.phone, error: err instanceof Error ? err.message : String(err) };
      });
      whatsAppPromises.push(whatsAppPromise);
    });

    // Wait for all notifications to be created and WhatsApp messages to be sent
    const [notificationResults, whatsAppResults] = await Promise.all([
      Promise.all(notificationPromises),
      Promise.all(whatsAppPromises),
    ]);

    const notificationCount = notificationResults.filter((r) => r !== null).length;
    const whatsAppSentCount = whatsAppResults.filter((r) => r.success).length;
    const usersWithPhoneCount = userList.filter((u) => u.phone && u.phone.trim() !== '').length;
    
    console.log(`[Broadcast] Results: ${notificationCount} notifications created, ${whatsAppSentCount}/${usersWithPhoneCount} WhatsApp messages sent`);
    
    // Log failed WhatsApp attempts
    const failedWhatsApp = whatsAppResults.filter((r) => !r.success);
    if (failedWhatsApp.length > 0) {
      console.error(`[Broadcast] Failed WhatsApp attempts:`, failedWhatsApp.map((f) => ({ phone: f.phone, error: f.error })));
    }

    return NextResponse.json({
      success: true,
      notificationCount,
      whatsAppSentCount,
      totalUsers: userList.length,
      usersWithPhone: usersWithPhoneCount,
      message: `Notifications sent to ${notificationCount} users. WhatsApp messages sent to ${whatsAppSentCount} out of ${usersWithPhoneCount} users with phone numbers.`,
    });
  } catch (error) {
    console.error('Broadcast announcement error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
