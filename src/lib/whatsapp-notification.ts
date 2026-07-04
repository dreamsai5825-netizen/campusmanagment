/**
 * WhatsApp Notification Service
 * Sends WhatsApp notifications using pywhatkit Python service
 */

interface WhatsAppNotificationResult {
  success: boolean;
  message?: string;
  error?: string;
  details?: any;
}

/**
 * Send WhatsApp notification to a phone number
 * @param phoneNumber Phone number in international format (e.g., '+1234567890')
 * @param message Message content to send
 * @returns Promise with result
 */
export async function sendWhatsAppNotification(
  phoneNumber: string,
  message: string
): Promise<WhatsAppNotificationResult> {
  try {
    // Call the Next.js API route which will handle the Python service
    const response = await fetch('/api/whatsapp/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phoneNumber,
        message,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error('[WhatsApp] API Error:', error);
      return {
        success: false,
        error: error.error || error.message || `Failed to send WhatsApp notification (${response.status})`,
        details: error.details,
      };
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('WhatsApp notification error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get phone number for a user (student, parent, or teacher)
 * @param userId User ID
 * @param userType Type of user ('student', 'parent', 'teacher')
 * @returns Phone number or null
 */
export async function getUserPhoneNumber(
  userId: string,
  userType: 'student' | 'parent' | 'teacher'
): Promise<string | null> {
  try {
    const response = await fetch(`/api/whatsapp/get-phone/${userType}/${userId}`);
    
    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.phoneNumber || null;
  } catch (error) {
    console.error('Error fetching phone number:', error);
    return null;
  }
}

/**
 * Send notification via WhatsApp if phone number is available
 * @param recipientId User ID who should receive the notification
 * @param notificationTitle Title of the notification
 * @param notificationContent Content of the notification
 * @param userType Type of user ('student', 'parent', 'teacher')
 */
export async function sendNotificationViaWhatsApp(
  recipientId: string,
  notificationTitle: string,
  notificationContent: string,
  userType: 'student' | 'parent' | 'teacher' = 'student'
): Promise<void> {
  try {
    // Get phone number for the recipient
    const phoneNumber = await getUserPhoneNumber(recipientId, userType);
    
    if (!phoneNumber) {
      console.log(`No phone number found for ${userType} ${recipientId}`);
      return;
    }

    // Format the message
    const message = `🔔 *${notificationTitle}*\n\n${notificationContent}\n\n_From CampusConnect_`;

    // Send WhatsApp notification
    const result = await sendWhatsAppNotification(phoneNumber, message);
    
    if (result.success) {
      console.log(`WhatsApp notification sent to ${phoneNumber}`);
    } else {
      console.error(`Failed to send WhatsApp notification:`, result.error);
    }
  } catch (error) {
    console.error('Error sending WhatsApp notification:', error);
    // Don't throw - WhatsApp notification failure shouldn't break the app
  }
}

/**
 * Send announcement to all users via WhatsApp based on audience
 * @param collegeId College ID to filter users
 * @param announcementTitle Title of the announcement
 * @param announcementContent Content of the announcement
 * @param audience Audience type ('all-users', 'all-students', 'all-teachers', 'all-parents')
 */
export async function sendAnnouncementViaWhatsApp(
  collegeId: string,
  announcementTitle: string,
  announcementContent: string,
  audience: string
): Promise<void> {
  try {
    // Call API to get all phone numbers for the audience
    const response = await fetch('/api/whatsapp/broadcast-announcement', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        collegeId,
        announcementTitle,
        announcementContent,
        audience,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Failed to broadcast announcement:', error);
      return;
    }

    const result = await response.json();
    console.log(`WhatsApp announcement sent to ${result.sentCount || 0} users`);
  } catch (error) {
    console.error('Error broadcasting announcement via WhatsApp:', error);
    // Don't throw - WhatsApp notification failure shouldn't break the app
  }
}
