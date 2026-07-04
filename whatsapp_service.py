#!/usr/bin/env python3
"""
WhatsApp Notification Service using pywhatkit
This service sends WhatsApp messages to users when they receive notifications.
"""

import pywhatkit as pwk
import sys
import json
import time
from datetime import datetime, timedelta

def send_whatsapp_message(phone_number: str, message: str):
    """
    Send a WhatsApp message using pywhatkit
    
    Args:
        phone_number: Phone number in international format (e.g., '+1234567890')
        message: Message content to send
    
    Returns:
        dict: Result with success status and message
    """
    try:
        # Remove any spaces, dashes, or parentheses from phone number
        phone_number = phone_number.replace(' ', '').replace('-', '').replace('(', '').replace(')', '')
        
        # Ensure phone number starts with country code
        if not phone_number.startswith('+'):
            # If it doesn't start with +, assume it's a local number
            # You may need to adjust this based on your country code
            # For India, add +91, for US add +1, etc.
            # Default to India (+91), change as needed for your region
            phone_number = '+91' + phone_number.lstrip('0')  # Remove leading 0 if present, then add country code
        
        # Get current time and add 1 minute (pywhatkit needs time in future)
        now = datetime.now()
        send_time = now + timedelta(minutes=1)
        hour = send_time.hour
        minute = send_time.minute
        
        # Send message
        pwk.sendwhatmsg(phone_number, message, hour, minute, wait_time=15, tab_close=True)
        
        return {
            'success': True,
            'message': f'WhatsApp message scheduled to {phone_number}'
        }
    except Exception as e:
        return {
            'success': False,
            'error': str(e),
            'message': f'Failed to send WhatsApp message: {str(e)}'
        }

def main():
    """Main function to handle command line arguments"""
    if len(sys.argv) < 3:
        print(json.dumps({
            'success': False,
            'error': 'Missing arguments. Usage: python whatsapp_service.py <phone_number> <message>'
        }))
        sys.exit(1)
    
    phone_number = sys.argv[1]
    message = sys.argv[2]
    
    result = send_whatsapp_message(phone_number, message)
    print(json.dumps(result))
    
    if not result['success']:
        sys.exit(1)

if __name__ == '__main__':
    main()
