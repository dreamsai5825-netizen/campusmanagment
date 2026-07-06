'use server';

import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const OMRValuationOutputSchema = z.object({
  studentInfo: z.object({
    name: z.string().nullable(),
    class: z.string().nullable(),
    section: z.string().nullable(),
    subject: z.string().nullable(),
    testDate: z.string().nullable(),
  }),
  rollNumber: z.string().nullable(),
  answers: z.record(z.record(z.string())).describe('Map of Subject -> Question Number -> Option'),
  scannedImage: z.string().optional().nullable(),
});

export type OMRValuationOutput = z.infer<typeof OMRValuationOutputSchema>;

export async function valuateOMRSheet(input: {
  base64Image?: string;
  base64Pdf?: string;
  pageNumber?: number;
  subjects: { name: string; questionCount: number }[];
  options: string[];
  rollNumberLength: number;
}): Promise<OMRValuationOutput> {
  const pageNumber = input.pageNumber || 1;
  
  // Unique identifiers for this execution to prevent file locking/race conditions
  const timestamp = Date.now();
  const randomSuffix = Math.floor(Math.random() * 100000);
  const runId = `${timestamp}_${randomSuffix}`;
  
  // Check if Python Cloud Run Service URL is configured
  const pythonServiceUrl = process.env.PYTHON_SERVICE_URL;
  if (pythonServiceUrl) {
    try {
      console.log(`[OMR Valuation] Forwarding to Python service on Cloud Run: ${pythonServiceUrl}`);
      
      let fileBase64 = '';
      let fileType = 'pdf';
      if (input.base64Pdf) {
        fileBase64 = input.base64Pdf;
        fileType = 'pdf';
      } else if (input.base64Image) {
        fileBase64 = input.base64Image;
        fileType = 'image';
      } else {
        throw new Error('Either base64Pdf or base64Image must be provided.');
      }

      const base64Data = fileBase64.replace(/^data:.*?;base64,/, '');
      const fileBuffer = Buffer.from(base64Data, 'base64');
      const fileBlob = new Blob([fileBuffer], { type: fileType === 'pdf' ? 'application/pdf' : 'image/png' });

      const formData = new FormData();
      formData.append('page', String(pageNumber));
      formData.append('config', JSON.stringify({
        subjects: input.subjects,
        options: input.options,
        rollNumberLength: input.rollNumberLength,
      }));
      formData.append('file', fileBlob, fileType === 'pdf' ? 'target_sheet.pdf' : 'target_sheet.png');
      formData.append('fileType', fileType);

      const response = await fetch(`${pythonServiceUrl.replace(/\/$/, '')}/api/omr/check`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Cloud Run OMR service failed: ${errText}`);
      }

      const result = await response.json();
      return result as OMRValuationOutput;
    } catch (err: any) {
      console.error(`[OMR Valuation] Cloud Run forwarding failed:`, err);
      throw err;
    }
  }

  const tempDir = path.join(process.cwd(), 'temp_run');
  await fs.mkdir(tempDir, { recursive: true });
  
  let inputFilePath = '';
  let configFilePath = '';
  let commandArgs = '';

  try {
    // 1. Write the input document file to disk
    if (input.base64Pdf) {
      const pdfBase64 = input.base64Pdf.replace(/^data:application\/pdf;base64,/, '');
      const buffer = Buffer.from(pdfBase64, 'base64');
      inputFilePath = path.join(tempDir, `input_${runId}.pdf`);
      await fs.writeFile(inputFilePath, buffer);
      commandArgs = `--pdf "${inputFilePath}"`;
    } else if (input.base64Image) {
      const imageBase64 = input.base64Image.replace(/^data:image\/[a-z]+;base64,/, '');
      const buffer = Buffer.from(imageBase64, 'base64');
      inputFilePath = path.join(tempDir, `input_${runId}.png`);
      await fs.writeFile(inputFilePath, buffer);
      commandArgs = `--image "${inputFilePath}"`;
    } else {
      throw new Error('Either base64Pdf or base64Image must be provided.');
    }

    // 2. Write the dynamic configurations to config JSON file (prevents quotes issues in CLI execution)
    const configData = {
      subjects: input.subjects,
      options: input.options,
      rollNumberLength: input.rollNumberLength,
    };
    configFilePath = path.join(tempDir, `config_${runId}.json`);
    await fs.writeFile(configFilePath, JSON.stringify(configData, null, 2), 'utf-8');

    const outDir = path.join(tempDir, `out_${runId}`);

    // 3. Execute python adapter wrapper
    const command = `python omr_checker_adapter.py ${commandArgs} --page ${pageNumber} --config "${configFilePath}" --out-dir "${outDir}"`;

    const { stdout, stderr } = await execAsync(command, { maxBuffer: 1024 * 1024 * 10 });

    // 4. Parse the output results JSON (locating the JSON line to filter out OMRChecker stdout logs)
    let result: OMRValuationOutput;
    const lines = stdout.split('\n');
    const jsonLine = lines.find(line => line.trim().startsWith('{') && line.trim().endsWith('}'));
    if (!jsonLine) {
      console.error('Failed to find JSON output in stdout:', stdout, stderr);
      throw new Error(`OMR parsing failed to return valid JSON. stdout: ${stdout}`);
    }

    try {
      result = JSON.parse(jsonLine.trim());
    } catch (parseErr) {
      console.error('Failed to parse OMR output JSON:', stdout, stderr);
      throw new Error(`OMR parsing failed to return valid JSON. stdout: ${stdout}`);
    }

    if ((result as any).error) {
      throw new Error((result as any).error);
    }

    return result;

  } finally {
    // 5. Cleanup temporary files and folder
    try {
      if (inputFilePath && await fs.stat(inputFilePath).catch(() => null)) {
        await fs.unlink(inputFilePath);
      }
      if (configFilePath && await fs.stat(configFilePath).catch(() => null)) {
        await fs.unlink(configFilePath);
      }
      const outDir = path.join(tempDir, `out_${runId}`);
      if (await fs.stat(outDir).catch(() => null)) {
        await fs.rm(outDir, { recursive: true, force: true });
      }
    } catch (cleanupErr) {
      console.error('Failed to cleanup temp OMR files:', cleanupErr);
    }
  }
}
