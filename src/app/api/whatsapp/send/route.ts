import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

/**
 * API Route to send WhatsApp notifications using pywhatkit
 * POST /api/whatsapp/send
 */
export async function POST(request: NextRequest) {
  try {
    const { phoneNumber, message } = await request.json();

    if (!phoneNumber || !message) {
      return NextResponse.json(
        { success: false, error: 'Phone number and message are required' },
        { status: 400 }
      );
    }

    console.log(`[WhatsApp Send] Attempting to send message to ${phoneNumber}`);

    // Get the path to the Python script
    const scriptPath = path.join(process.cwd(), 'whatsapp_service.py');
    console.log(`[WhatsApp Send] Script path: ${scriptPath}`);
    
    // Execute Python script
    // Use python3 if python is not available, and handle Windows/Unix paths
    const pythonCommand = process.platform === 'win32' ? 'python' : 'python3';
    console.log(`[WhatsApp Send] Using Python command: ${pythonCommand}`);
    
    try {
      // Escape message properly for command line
      const escapedMessage = message.replace(/"/g, '\\"').replace(/\n/g, '\\n');
      const command = `${pythonCommand} "${scriptPath}" "${phoneNumber}" "${escapedMessage}"`;
      console.log(`[WhatsApp Send] Executing command: ${command.substring(0, 100)}...`);
      
      const { stdout, stderr } = await execAsync(
        command,
        { maxBuffer: 1024 * 1024 * 10 } // 10MB buffer
      );

      console.log(`[WhatsApp Send] stdout: ${stdout}`);
      if (stderr && !stderr.includes('INFO')) {
        console.error(`[WhatsApp Send] stderr: ${stderr}`);
      }

      // Parse the JSON output from Python script
      let result;
      try {
        result = JSON.parse(stdout.trim());
        console.log(`[WhatsApp Send] Parsed result:`, result);
      } catch (parseError) {
        console.error(`[WhatsApp Send] Failed to parse stdout as JSON:`, stdout);
        return NextResponse.json(
          {
            success: false,
            error: `Python script returned invalid JSON. Output: ${stdout.substring(0, 200)}`,
          },
          { status: 500 }
        );
      }
      
      return NextResponse.json(result);
    } catch (execError: any) {
      console.error(`[WhatsApp Send] Execution error:`, execError);
      console.error(`[WhatsApp Send] Error code:`, execError.code);
      console.error(`[WhatsApp Send] Error stdout:`, execError.stdout);
      console.error(`[WhatsApp Send] Error stderr:`, execError.stderr);
      console.error(`[WhatsApp Send] Error message:`, execError.message);
      
      // Check if Python is available
      if (execError.code === 'ENOENT' || execError.message.includes('python') || execError.message.includes('Python') || execError.message.includes('not found')) {
        return NextResponse.json(
          {
            success: false,
            error: `Python not found. Please install Python and ensure '${pythonCommand}' is in your PATH. For Windows, use 'python', for Linux/Mac use 'python3'.`,
            details: execError.message,
          },
          { status: 500 }
        );
      }

      // Try to parse error output
      try {
        const errorOutput = execError.stdout || execError.stderr || '';
        if (errorOutput.trim()) {
          const errorResult = JSON.parse(errorOutput.trim());
          return NextResponse.json({
            success: false,
            ...errorResult,
            details: execError.message,
          }, { status: 500 });
        }
      } catch (parseError) {
        // If we can't parse, return the raw error
      }
      
      return NextResponse.json(
        {
          success: false,
          error: execError.message || 'Failed to execute WhatsApp service',
          details: `Command: ${pythonCommand} "${scriptPath}" "${phoneNumber}" "${message.substring(0, 50)}..."`,
          code: execError.code,
          stdout: execError.stdout?.substring(0, 500),
          stderr: execError.stderr?.substring(0, 500),
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[WhatsApp Send] Top-level error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : String(error),
      },
      { status: 500 }
    );
  }
}
