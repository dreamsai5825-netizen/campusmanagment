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
  alignmentInfo: z.object({
    cornersDetected: z.number(),
    warpApplied: z.boolean(),
    deskewAngle: z.number().optional(),
    detectedCorners: z.record(z.array(z.number())).optional(),
    expectedCorners: z.record(z.array(z.number())).optional(),
  }).optional(),
  mlAnalysis: z.object({
    modelActive: z.boolean().optional(),
    modelAccuracy: z.number().optional(),
    totalTrainingSamples: z.number().optional(),
    lastTrained: z.string().optional(),
    totalBubblesEvaluated: z.number().optional(),
    mlRefinementCorrections: z.number().optional(),
    avgModelConfidence: z.number().optional(),
    status: z.string().optional(),
  }).optional(),
});

export type OMRValuationOutput = z.infer<typeof OMRValuationOutputSchema>;

const DEFAULT_PYTHON_SERVICE_URL = 'https://python-service-674639396653.us-central1.run.app';

function getPythonServiceUrl(): string {
  return process.env.PYTHON_SERVICE_URL || DEFAULT_PYTHON_SERVICE_URL;
}

export async function valuateOMRSheet(input: {
  base64Image?: string;
  base64Pdf?: string;
  pageNumber?: number;
  subjects: { name: string; questionCount: number }[];
  options: string[];
  rollNumberLength: number;
  rotationAngle?: number; // manual tilt override in degrees (−45 to +45)
}): Promise<OMRValuationOutput> {
  const pageNumber = input.pageNumber || 1;
  
  // Unique identifiers for this execution to prevent file locking/race conditions
  const timestamp = Date.now();
  const randomSuffix = Math.floor(Math.random() * 100000);
  const runId = `${timestamp}_${randomSuffix}`;
  
  // Check if Python Cloud Run Service URL is configured (or fallback to deployed Cloud Run service)
  const pythonServiceUrl = getPythonServiceUrl();
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
      if (typeof input.rotationAngle === 'number' && input.rotationAngle !== 0) {
        formData.append('rotationAngle', String(input.rotationAngle));
      }

      const response = await fetch(`${pythonServiceUrl.replace(/\/$/, '')}/api/omr/check`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        let errText = '';
        try {
          const errJson = await response.json();
          errText = errJson.detail || errJson.error || JSON.stringify(errJson);
        } catch {
          errText = await response.text();
        }
        throw new Error(`Cloud Run OMR service failed (${response.status}): ${errText}`);
      }

      const result = await response.json();
      return result as OMRValuationOutput;
    } catch (err: any) {
      console.error(`[OMR Valuation] Cloud Run forwarding failed:`, err);
      // If we are in local environment where local python might be available, fallback to local python, otherwise rethrow
      const venvPython = path.join(process.cwd(), '.venv', 'Scripts', 'python.exe');
      const hasLocalVenv = await fs.stat(venvPython).catch(() => null);
      if (!hasLocalVenv && process.env.NODE_ENV === 'production') {
        throw err;
      }
      console.warn(`[OMR Valuation] Falling back to local python execution...`);
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

    const rotationFlag = typeof input.rotationAngle === 'number' && input.rotationAngle !== 0
      ? ` --rotation ${input.rotationAngle}`
      : '';

    const venvPython = path.join(process.cwd(), '.venv', 'Scripts', 'python.exe');
    let pyExe = 'python';
    if (await fs.stat(venvPython).catch(() => null)) {
      pyExe = `"${venvPython}"`;
    }

    const command = `${pyExe} omr_checker_adapter.py ${commandArgs} --page ${pageNumber} --config "${configFilePath}" --out-dir "${outDir}"${rotationFlag}`;

    const { stdout, stderr } = await execAsync(command, { maxBuffer: 1024 * 1024 * 10 });

    // 4. Parse the output results JSON (robustly extracting the JSON payload from stdout)
    let result: OMRValuationOutput;
    let parsedJson: any = null;

    // First try: reverse line search for single-line JSON string
    const lines = stdout.split('\n');
    const jsonLine = [...lines].reverse().find(line => line.trim().startsWith('{') && line.trim().endsWith('}'));
    if (jsonLine) {
      try {
        parsedJson = JSON.parse(jsonLine.trim());
      } catch (_) {}
    }

    // Fallback: extract substring between first '{' and last '}'
    if (!parsedJson) {
      const firstBrace = stdout.indexOf('{');
      const lastBrace = stdout.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        try {
          parsedJson = JSON.parse(stdout.slice(firstBrace, lastBrace + 1));
        } catch (_) {}
      }
    }

    if (!parsedJson) {
      console.error('Failed to parse JSON from OMR stdout:', stdout, stderr);
      throw new Error(`OMR parsing failed to return valid JSON. stdout: ${stdout || '(empty)'}\nstderr: ${stderr || '(empty)'}`);
    }

    result = parsedJson as OMRValuationOutput;

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

export async function getOMRMLStatus(): Promise<{
  model_loaded: boolean;
  total_labeled_samples: number;
  unlabelled_samples: number;
  last_trained: string;
  training_accuracy: number;
  loss: number;
}> {
  const pythonServiceUrl = getPythonServiceUrl();
  if (pythonServiceUrl) {
    try {
      const res = await fetch(`${pythonServiceUrl.replace(/\/$/, '')}/api/omr/ml/status`);
      if (!res.ok) throw new Error('Failed to fetch ML status from service');
      return await res.json();
    } catch (err: any) {
      console.warn('[OMR ML Status] Cloud service fetch error:', err);
    }
  }
  try {
    const { stdout } = await execAsync(`python -c "import omr_ml_classifier, json; print(json.dumps(omr_ml_classifier.get_model_status()))"`);
    return JSON.parse(stdout.trim());
  } catch (e) {
    const venvPython = path.join(process.cwd(), '.venv', 'Scripts', 'python.exe');
    const { stdout } = await execAsync(`"${venvPython}" -c "import omr_ml_classifier, json; print(json.dumps(omr_ml_classifier.get_model_status()))"`);
    return JSON.parse(stdout.trim());
  }
}

export async function trainOMRMLModel(epochs = 5, lr = 0.001): Promise<{
  success: boolean;
  message: string;
  metrics: {
    last_trained: string;
    total_samples: number;
    training_accuracy: number;
    loss: number;
  };
}> {
  const pythonServiceUrl = getPythonServiceUrl();
  if (pythonServiceUrl) {
    try {
      const res = await fetch(`${pythonServiceUrl.replace(/\/$/, '')}/api/omr/ml/train`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ epochs, lr })
      });
      if (!res.ok) throw new Error('ML model training failed');
      return await res.json();
    } catch (err: any) {
      console.warn('[OMR ML Train] Cloud service error:', err);
    }
  }
  try {
    const { stdout } = await execAsync(`python -c "import omr_ml_classifier, json; meta=omr_ml_classifier.train_and_save_model(epochs=${epochs}, lr=${lr}); print(json.dumps({'success': True, 'message': 'Trained successfully', 'metrics': meta}))"`);
    return JSON.parse(stdout.trim());
  } catch (e) {
    const venvPython = path.join(process.cwd(), '.venv', 'Scripts', 'python.exe');
    const { stdout } = await execAsync(`"${venvPython}" -c "import omr_ml_classifier, json; meta=omr_ml_classifier.train_and_save_model(epochs=${epochs}, lr=${lr}); print(json.dumps({'success': True, 'message': 'Trained successfully', 'metrics': meta}))"`);
    return JSON.parse(stdout.trim());
  }
}

export async function submitOMRMLFeedback(base64Image: string, label: string, sampleName?: string): Promise<{
  success: boolean;
  saved_path?: string;
}> {
  const pythonServiceUrl = getPythonServiceUrl();
  if (pythonServiceUrl) {
    try {
      const res = await fetch(`${pythonServiceUrl.replace(/\/$/, '')}/api/omr/ml/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64Image, label, sampleName })
      });
      if (!res.ok) throw new Error('ML feedback submission failed');
      return await res.json();
    } catch (err: any) {
      console.warn('[OMR ML Feedback] Cloud service error:', err);
    }
  }
  const tempDir = path.join(process.cwd(), 'temp_run');
  await fs.mkdir(tempDir, { recursive: true });
  const timestamp = Date.now();
  const randomSuffix = Math.floor(Math.random() * 100000);
  const runId = `${timestamp}_${randomSuffix}`;
  const tempImgPath = path.join(tempDir, `fb_${runId}.png`);

  try {
    const cleanB64 = base64Image.replace(/^data:image\/[a-z]+;base64,/, '');
    const buffer = Buffer.from(cleanB64, 'base64');
    await fs.writeFile(tempImgPath, buffer);

    const safeImgPath = tempImgPath.replace(/\\/g, '/');
    const safeSampleName = sampleName ? `'${sampleName.replace(/'/g, "\\'")}'` : 'None';
    const safeLabel = label.replace(/'/g, "\\'");

    const pyCode = `import cv2, omr_ml_classifier, json; img = cv2.imread('${safeImgPath}'); lbl = 1 if '${safeLabel}'.lower() in ['filled', '1', 'true'] else 0; p = omr_ml_classifier.save_active_sample(img, label=lbl, sample_name=${safeSampleName}); print(json.dumps({'success': True, 'saved_path': p}))`;

    const venvPython = path.join(process.cwd(), '.venv', 'Scripts', 'python.exe');
    try {
      const { stdout } = await execAsync(`"${venvPython}" -c "${pyCode}"`);
      return JSON.parse(stdout.trim());
    } catch (e) {
      const { stdout } = await execAsync(`python -c "${pyCode}"`);
      return JSON.parse(stdout.trim());
    }
  } finally {
    try {
      if (await fs.stat(tempImgPath).catch(() => null)) {
        await fs.unlink(tempImgPath);
      }
    } catch (cleanupErr) {
      console.error('Failed to cleanup temp feedback image:', cleanupErr);
    }
  }
}

export async function getOMRMLDatasetSamples(limit = 60, offset = 0, category = 'all'): Promise<{
  total: number;
  filled_count: number;
  unfilled_count: number;
  samples: Array<{ name: string; label: 'filled' | 'unfilled'; base64Image: string }>;
}> {
  const pythonServiceUrl = getPythonServiceUrl();
  if (pythonServiceUrl) {
    try {
      const res = await fetch(`${pythonServiceUrl.replace(/\/$/, '')}/api/omr/ml/samples?limit=${limit}&offset=${offset}&category=${category}`);
      if (!res.ok) throw new Error('Failed to fetch dataset samples');
      return await res.json();
    } catch (err: any) {
      console.warn('[OMR ML Samples] Cloud service error:', err);
    }
  }
  const venvPython = path.join(process.cwd(), '.venv', 'Scripts', 'python.exe');
  const pyCode = `import omr_ml_classifier, json; print(json.dumps(omr_ml_classifier.get_dataset_samples(limit=${limit}, offset=${offset}, category='${category}')))`;
  try {
    const { stdout } = await execAsync(`"${venvPython}" -c "${pyCode}"`);
    return JSON.parse(stdout.trim());
  } catch (e) {
    const { stdout } = await execAsync(`python -c "${pyCode}"`);
    return JSON.parse(stdout.trim());
  }
}
