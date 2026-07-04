import { generateOMRPdf } from '../src/lib/omr-pdf-generator';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const config = {
    testName: 'Test 3',
    rollNumberLength: 5,
    subjects: [
      { name: 'Physics', questionCount: 25 },
      { name: 'Chemistry', questionCount: 25 },
      { name: 'Maths', questionCount: 25 },
      { name: 'Biology', questionCount: 25 }
    ],
    options: ['A', 'B', 'C', 'D'],
    includeDetails: true,
    includeInstructions: true,
    includeSignatures: true,
    collegeName: 'Campus Connect College'
  };

  const doc = generateOMRPdf(config);
  const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
  
  // Ensure .temp exists
  const tempDir = path.join(__dirname, '..', '.temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const outPath = path.join(tempDir, 'test_template.pdf');
  fs.writeFileSync(outPath, pdfBuffer);
  console.log(`Saved template OMR PDF to ${outPath}`);
}

main().catch(console.error);
