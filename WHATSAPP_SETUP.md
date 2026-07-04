# WhatsApp Notification Setup Guide

This guide explains how to set up WhatsApp notifications using pywhatkit for the CampusConnect application.

## Prerequisites

1. **Python 3.7+** installed on your system
2. **WhatsApp Web** access (you'll need to scan QR code once)
3. **Chrome browser** (pywhatkit uses Chrome to send messages)

## Installation Steps

### 1. Install Python Dependencies

```bash
pip install pywhatkit
```

Or use the requirements file:
```bash
pip install -r requirements.txt
```

### 2. First-Time Setup

1. **Open WhatsApp Web** in your browser and keep it logged in
2. The first time you send a message, pywhatkit will:
   - Open WhatsApp Web in Chrome
   - Wait for you to scan the QR code (if needed)
   - Send the message automatically

### 3. Phone Number Format

Phone numbers should be in international format:
- **India**: `+91XXXXXXXXXX` (e.g., +919876543210)
- **USA**: `+1XXXXXXXXXX` (e.g., +11234567890)
- **UK**: `+44XXXXXXXXXX` (e.g., +441234567890)

**Note**: The default country code in `whatsapp_service.py` is set to `+91` (India). 
To change it, edit line 20 in `whatsapp_service.py`:
```python
phone_number = '+1' + phone_number  # For USA
```

### 4. How It Works

1. When a notification is created in the app, it automatically:
   - Fetches the recipient's phone number from the database
   - Formats the notification message
   - Calls the Python service via API route
   - Sends WhatsApp message using pywhatkit

2. **For Announcements**:
   - When an announcement is created, it sends WhatsApp messages to all users based on the selected audience (all-users, all-students, all-teachers, all-parents)

### 5. Testing

To test the WhatsApp service manually:

```bash
python whatsapp_service.py "+919876543210" "Test message from CampusConnect"
```

## Important Notes

⚠️ **Limitations**:
- pywhatkit requires WhatsApp Web to be open in Chrome
- Messages are scheduled 1 minute in the future (pywhatkit requirement)
- The browser tab will close automatically after sending
- This is best suited for development/testing. For production, consider using WhatsApp Business API

⚠️ **Security**:
- Phone numbers are stored in Firestore
- Make sure your Firestore security rules protect user data
- The Python script runs locally on your server

## Troubleshooting

### Python not found
- Make sure Python is installed and in your PATH
- Try using `python3` instead of `python`:
  ```bash
  python3 whatsapp_service.py "+919876543210" "Test"
  ```

### Chrome not opening
- Make sure Chrome browser is installed
- Check if Chrome is your default browser

### Messages not sending
- Ensure WhatsApp Web is logged in
- Check internet connection
- Verify phone number format is correct
- Check browser console for errors

### API Route Errors
- Check server logs for detailed error messages
- Ensure Python script has execute permissions
- Verify the script path is correct

## Production Considerations

For production use, consider:
1. **WhatsApp Business API** - Official API for sending messages
2. **Twilio WhatsApp API** - Third-party service
3. **MessageBird** - WhatsApp Business solution
4. **Cloud Functions** - Deploy Python service as a cloud function

## Files Created

- `whatsapp_service.py` - Python script for sending WhatsApp messages
- `requirements.txt` - Python dependencies
- `src/lib/whatsapp-notification.ts` - TypeScript utility functions
- `src/app/api/whatsapp/send/route.ts` - API route to send messages
- `src/app/api/whatsapp/get-phone/[userType]/[userId]/route.ts` - API route to get phone numbers
- `src/app/api/whatsapp/broadcast-announcement/route.ts` - API route for broadcasting announcements
