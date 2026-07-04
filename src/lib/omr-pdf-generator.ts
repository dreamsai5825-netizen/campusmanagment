import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';

interface SubjectConfig {
  name: string;
  questionCount: number;
}

interface GeneratorConfig {
  testName: string;
  rollNumberLength: number;
  subjects: SubjectConfig[];
  options: string[];
  includeDetails: boolean;
  includeInstructions: boolean;
  includeSignatures: boolean;
  additionalInstructions?: string;
  collegeName?: string;
  collegeLogoBase64?: string;
}

export interface OMRStudentResultExcel {
  rollNumber: string;
  studentName?: string;
  studentClass?: string;
  studentSection?: string;
  score: number;
  correctCount: number;
  incorrectCount: number;
  unattemptedCount: number;
  maxScore: number;
  evaluatedAt: string;
}

export function exportOMRResultsToExcel(results: OMRStudentResultExcel[], testName: string) {
  const rows = results.map((r, idx) => ({
    'Sl. No.': idx + 1,
    'Roll Number': r.rollNumber || 'N/A',
    'Candidate Name': r.studentName || 'N/A',
    'Class': r.studentClass || 'N/A',
    'Section': r.studentSection || 'N/A',
    'Correct Answers': r.correctCount,
    'Incorrect Answers': r.incorrectCount,
    'Unattempted': r.unattemptedCount,
    'Score Obtained': r.score,
    'Max Score': r.maxScore,
    'Percentage': ((r.score / r.maxScore) * 100).toFixed(2) + '%',
    'Evaluation Date': new Date(r.evaluatedAt).toLocaleDateString(),
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Results');

  // Save file
  XLSX.writeFile(workbook, `${testName.replace(/\s+/g, '_')}_OMR_Results.xlsx`);
}

export function generateOMRPdf(config: GeneratorConfig): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const PAGE_WIDTH = 210;
  const PAGE_HEIGHT = 297;
  const MARGIN_LEFT = 12;
  const MARGIN_RIGHT = 12;
  const PRINT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT; // 186mm

  // Example OMR colors extracted from template analysis
  const OMR_COLOR = [222, 18, 122];     // Pink/Magenta drop-out color (#DE127A)
  const OMR_BG_COLOR = [252, 232, 239];  // Very light pink box fill (#FCE8EF)
  const TEXT_COLOR = [31, 26, 23];      // Dark Charcoal text (#1E1916)
  const BLACK = [0, 0, 0];

  // Dynamic capacity calculations
  const questionsPerColumn = 30;

  // Allocate columns dynamically to subjects.
  // Each subject gets its own clean start column, leaving remaining space blank.
  interface QuestionItem {
    subjectName: string;
    globalQNum: number;
  }
  const columnGrid: QuestionItem[][] = [];
  let currentGlobalQNum = 1;

  config.subjects.forEach((subj) => {
    const colsNeeded = Math.ceil(subj.questionCount / questionsPerColumn);
    const startCol = columnGrid.length;

    // Pre-initialize columns for this subject
    for (let c = 0; c < colsNeeded; c++) {
      columnGrid.push([]);
    }

    for (let q = 1; q <= subj.questionCount; q++) {
      const colRel = Math.floor((q - 1) / questionsPerColumn);
      const colIdx = startCol + colRel;
      const rowIdx = (q - 1) % questionsPerColumn;

      columnGrid[colIdx][rowIdx] = {
        subjectName: subj.name,
        globalQNum: currentGlobalQNum,
      };
      currentGlobalQNum++;
    }
  });

  const COL_COUNT = 4;
  const totalCols = columnGrid.length;
  const totalPages = Math.max(1, Math.ceil(totalCols / COL_COUNT));

  // Draws template page structure (borders, title, anchor marks)
  const drawPageTemplate = (pdf: jsPDF, pageNum: number) => {
    // 1. Draw 4 Solid Black Anchor Timing Marks at Corners (Required for OCR alignment)
    pdf.setFillColor(BLACK[0], BLACK[1], BLACK[2]);
    pdf.rect(6, 6, 4, 4, 'F'); // Top Left
    pdf.rect(PAGE_WIDTH - 6 - 4, 6, 4, 4, 'F'); // Top Right
    pdf.rect(6, PAGE_HEIGHT - 6 - 4, 4, 4, 'F'); // Bottom Left
    pdf.rect(PAGE_WIDTH - 6 - 4, PAGE_HEIGHT - 6 - 4, 4, 4, 'F'); // Bottom Right

    // 2. Draw Page Borders
    pdf.setDrawColor(OMR_COLOR[0], OMR_COLOR[1], OMR_COLOR[2]);
    pdf.setLineWidth(0.25);
    pdf.rect(MARGIN_LEFT, 12, PRINT_WIDTH, PAGE_HEIGHT - 24, 'S');

    // 3. Draw Header Title Block (Only for page 2 and higher - page 1 has layout header)
    if (pageNum > 1) {
      pdf.setTextColor(TEXT_COLOR[0], TEXT_COLOR[1], TEXT_COLOR[2]);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12);
      const titleText = config.collegeName
        ? `${config.collegeName.toUpperCase()} - ${config.testName.toUpperCase()}`
        : config.testName.toUpperCase();
      pdf.text(titleText, PAGE_WIDTH / 2, 20, { align: 'center' });
      pdf.setFontSize(10);
      pdf.setTextColor(OMR_COLOR[0], OMR_COLOR[1], OMR_COLOR[2]);
      pdf.text('OMR ANSWER SHEET', PAGE_WIDTH / 2, 24, { align: 'center' });
    }

    // 4. Draw Page Number
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(120, 120, 120);
    pdf.text(`Page ${pageNum} of ${totalPages}`, PAGE_WIDTH / 2, PAGE_HEIGHT - 6, { align: 'center' });
  };

  // Position coordinates for the 3-column top section
  const leftColX = MARGIN_LEFT + 2; // 14mm
  const rollNumberLength = config.rollNumberLength;
  const leftColWidth = rollNumberLength > 0 ? (rollNumberLength * 5.2 + 4) : 0;
  const rightColWidth = config.includeSignatures ? 35 : 0;
  const rightColX = PAGE_WIDTH - MARGIN_RIGHT - rightColWidth; // 163mm

  const midColGap = 5.5; // Increased gap to prevent cards from touching/overlapping
  const midColX = leftColWidth > 0 ? (leftColX + leftColWidth + midColGap) : MARGIN_LEFT;
  const midColWidth = (rightColWidth > 0 ? rightColX : (PAGE_WIDTH - MARGIN_RIGHT)) - midColX - (rightColWidth > 0 ? midColGap : 0);

  const drawTopSection = (pdf: jsPDF) => {
    const yCursor = 20;
    // Cap vertical height to exactly 75mm (from y = 20 to y = 95)
    const sectionHeight = 75;

    // 1. LEFT COLUMN: Roll Number Grid
    if (rollNumberLength > 0) {
      pdf.setDrawColor(OMR_COLOR[0], OMR_COLOR[1], OMR_COLOR[2]);
      pdf.setLineWidth(0.3);
      pdf.rect(leftColX, yCursor, leftColWidth, sectionHeight, 'S');

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8.5);
      pdf.setTextColor(OMR_COLOR[0], OMR_COLOR[1], OMR_COLOR[2]);
      pdf.text('Roll No.', leftColX + 3, yCursor + 4.5);

      const leftPadding = 2;
      const gridWidth = leftColWidth - leftPadding * 2;
      const colStep = gridWidth / rollNumberLength;
      const boxSize = 4.2;

      for (let c = 0; c < rollNumberLength; c++) {
        const colX = leftColX + leftPadding + c * colStep + (colStep - boxSize) / 2;
        pdf.setDrawColor(OMR_COLOR[0], OMR_COLOR[1], OMR_COLOR[2]);
        pdf.setLineWidth(0.2);
        pdf.rect(colX, yCursor + 6, boxSize, boxSize, 'S');

        for (let r = 0; r < 10; r++) {
          const circleY = yCursor + 14.5 + r * 5.8; // Adjusted vertical spacing to fit in 75mm
          const circleX = colX + boxSize / 2;
          const radius = 2.5;

          pdf.setDrawColor(OMR_COLOR[0], OMR_COLOR[1], OMR_COLOR[2]);
          pdf.setFillColor(255, 255, 255);
          pdf.circle(circleX, circleY, radius, 'FD');

          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(6.5);
          pdf.setTextColor(OMR_COLOR[0], OMR_COLOR[1], OMR_COLOR[2]);
          pdf.text(String(r), circleX, circleY + 0.75, { align: 'center' });
        }
      }
    }

    // 2. CENTER COLUMN: Header + Instructions + Details
    if (config.collegeName) {
      const logoSize = 10;
      const logoX = midColX + 2;
      const logoY = yCursor - 6.5;

      if (config.collegeLogoBase64) {
        try {
          pdf.addImage(config.collegeLogoBase64, 'PNG', logoX, logoY, logoSize, logoSize);
        } catch (err) {
          console.error('Error drawing college logo to PDF:', err);
        }

        const textStartX = logoX + logoSize + 4;
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(11);
        pdf.setTextColor(TEXT_COLOR[0], TEXT_COLOR[1], TEXT_COLOR[2]);
        pdf.text(config.collegeName.toUpperCase(), textStartX, yCursor - 2);

        pdf.setFontSize(8.5);
        pdf.setTextColor(OMR_COLOR[0], OMR_COLOR[1], OMR_COLOR[2]);
        pdf.text(`${config.testName.toUpperCase()} - OMR ANSWER SHEET`, textStartX, yCursor + 3.5);
      } else {
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(12);
        pdf.setTextColor(TEXT_COLOR[0], TEXT_COLOR[1], TEXT_COLOR[2]);
        pdf.text(config.collegeName.toUpperCase(), midColX + midColWidth / 2, yCursor - 2, { align: 'center' });

        pdf.setFontSize(9);
        pdf.setTextColor(OMR_COLOR[0], OMR_COLOR[1], OMR_COLOR[2]);
        pdf.text(`${config.testName.toUpperCase()} - OMR ANSWER SHEET`, midColX + midColWidth / 2, yCursor + 3.5, { align: 'center' });
      }
    } else {
      pdf.setTextColor(BLACK[0], BLACK[1], BLACK[2]);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(16);
      pdf.text('OMR ANSWER SHEET', midColX + midColWidth / 2, yCursor + 4, { align: 'center' });
    }

    const instY = yCursor + 8;
    const instHeight = 32; // Fit vertically
    if (config.includeInstructions) {
      pdf.setDrawColor(OMR_COLOR[0], OMR_COLOR[1], OMR_COLOR[2]);
      pdf.setLineWidth(0.3);
      pdf.rect(midColX, instY, midColWidth, instHeight, 'S');

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      pdf.setTextColor(OMR_COLOR[0], OMR_COLOR[1], OMR_COLOR[2]);
      pdf.text('INSTRUCTIONS FOR FILLING THE SHEET', midColX + 3, instY + 4.5);

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(6.8);
      pdf.setTextColor(OMR_COLOR[0], OMR_COLOR[1], OMR_COLOR[2]);

      const rules = [
        '1. This sheet should not be folded or crushed.',
        '2. Use only blue/ black ball point pen to fill the circles.',
        '3. Use of pencil is strictly prohibited.',
        '4. Note: Negative marks apply.',
      ];
      if (config.additionalInstructions && config.additionalInstructions.trim()) {
        rules[3] = `4. Note: ${config.additionalInstructions.trim()}`;
      }

      rules.forEach((rule, idx) => {
        pdf.text(rule, midColX + 3, instY + 9.5 + idx * 4.2);
      });

      const methodX = midColX + midColWidth - 36;

      // WRONG METHODS
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7.5);
      pdf.setTextColor(OMR_COLOR[0], OMR_COLOR[1], OMR_COLOR[2]);
      pdf.text('WRONG METHODS', methodX, instY + 4.5);

      const wcy = instY + 11;
      const circleRad = 1.1;

      pdf.setDrawColor(OMR_COLOR[0], OMR_COLOR[1], OMR_COLOR[2]);
      pdf.setLineWidth(0.2);
      pdf.setFillColor(255, 255, 255);

      // 1. Cross
      pdf.circle(methodX + 3, wcy, circleRad, 'FD');
      pdf.line(methodX + 1.8, wcy - 1.2, methodX + 4.2, wcy + 1.2);
      pdf.line(methodX + 4.2, wcy - 1.2, methodX + 1.8, wcy + 1.2);

      // 2. Dot
      pdf.circle(methodX + 9, wcy, circleRad, 'FD');
      pdf.setFillColor(OMR_COLOR[0], OMR_COLOR[1], OMR_COLOR[2]);
      pdf.circle(methodX + 9, wcy, 0.4, 'FD');

      // 3. Slash
      pdf.setFillColor(255, 255, 255);
      pdf.circle(methodX + 15, wcy, circleRad, 'FD');
      pdf.line(methodX + 13.8, wcy - 1.2, methodX + 16.2, wcy + 1.2);

      // 4. Tick
      pdf.circle(methodX + 21, wcy, circleRad, 'FD');
      pdf.line(methodX + 19.8, wcy, methodX + 20.6, wcy + 0.8);
      pdf.line(methodX + 20.6, wcy + 0.8, methodX + 22.2, wcy - 0.8);

      // CORRECT METHOD
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7.5);
      pdf.setTextColor(OMR_COLOR[0], OMR_COLOR[1], OMR_COLOR[2]);
      pdf.text('CORRECT METHOD', methodX, instY + 21.5);

      const ccy = instY + 27;
      pdf.setFillColor(255, 255, 255);
      pdf.circle(methodX + 3, ccy, circleRad, 'FD');
      pdf.circle(methodX + 9, ccy, circleRad, 'FD');
      pdf.circle(methodX + 15, ccy, circleRad, 'FD');
      pdf.circle(methodX + 21, ccy, circleRad, 'FD');
    }

    const detY = yCursor + 44;
    const detHeight = 31; // Fit inside 75mm
    if (config.includeDetails) {
      pdf.setDrawColor(OMR_COLOR[0], OMR_COLOR[1], OMR_COLOR[2]);
      pdf.setLineWidth(0.3);
      pdf.rect(midColX, detY, midColWidth, detHeight, 'S');

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8.5);
      pdf.setTextColor(OMR_COLOR[0], OMR_COLOR[1], OMR_COLOR[2]);

      // Enforced left alignment explicitly and shortened dots to fit midColWidth
      pdf.text('Name .................................................................................................................', midColX + 3, detY + 7, { align: 'left' });
      pdf.text('Class...........................................................Section.......................................................', midColX + 3, detY + 16, { align: 'left' });
      pdf.text('Subject................................................................... Test Date.........../............/..........', midColX + 3, detY + 25, { align: 'left' });
    }

    // 3. RIGHT COLUMN: Signatures
    if (config.includeSignatures) {
      pdf.setDrawColor(OMR_COLOR[0], OMR_COLOR[1], OMR_COLOR[2]);
      pdf.setLineWidth(0.3);

      // Candidate Sign (ends at y = 60)
      pdf.rect(rightColX, instY, rightColWidth, instHeight, 'S');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8.5);
      pdf.setTextColor(OMR_COLOR[0], OMR_COLOR[1], OMR_COLOR[2]);
      pdf.text('Candidate Sign', rightColX + 3, instY + 5.5);

      // Invigilator Sign (ends at y = 95)
      pdf.rect(rightColX, detY, rightColWidth, detHeight, 'S');
      pdf.text('Invigilator Sign', rightColX + 3, detY + 5.5);
    }
  };

  // Render multi-page questions layout
  for (let page = 1; page <= totalPages; page++) {
    if (page > 1) {
      doc.addPage();
    }
    drawPageTemplate(doc, page);
    if (page === 1) {
      drawTopSection(doc);
    }

    // Dynamic, self-optimizing vertical channel positioning to eliminate overlaps
    let headerY = 32;
    if (page === 1) {
      headerY = 104; // Shifts grid down to fit safely on page 1 below details card
    }

    const headerHeight = 5.5;
    const rowHeight = 5.4;
    const groupSpacer = 1.6;
    const colHeight = questionsPerColumn * rowHeight + 8 * groupSpacer + headerHeight; // 180.3mm max

    // Draw Column Grid structure
    const COL_GAP = 4;
    const COL_WIDTH = (PRINT_WIDTH - COL_GAP * (COL_COUNT - 1)) / COL_COUNT; // 43.5mm

    const getColX = (colIdx: number) => {
      return MARGIN_LEFT + colIdx * (COL_WIDTH + COL_GAP);
    };

    // 1. Draw Subject Banners above each active channel column individually.
    // Aligns with the 4mm column gaps exactly to prevent banners from touching or overlapping.
    for (let colIdxOnPage = 0; colIdxOnPage < COL_COUNT; colIdxOnPage++) {
      const globalColIdx = (page - 1) * COL_COUNT + colIdxOnPage;
      if (globalColIdx >= totalCols) continue;

      const colQuestions = columnGrid[globalColIdx];

      // Find the first valid item in the column to draw banner
      const firstValidItem = colQuestions.find((item) => item !== undefined);
      if (!firstValidItem) continue;

      const colX = getColX(colIdxOnPage);
      const subjName = firstValidItem.subjectName;

      const bannerY = headerY - 7.5; // Positions banner perfectly above the grid channel
      const bannerHeight = 6.0;

      // Draw single column banner box
      doc.setDrawColor(OMR_COLOR[0], OMR_COLOR[1], OMR_COLOR[2]);
      doc.setFillColor(OMR_BG_COLOR[0], OMR_BG_COLOR[1], OMR_BG_COLOR[2]);
      doc.setLineWidth(0.3);
      doc.rect(colX, bannerY, COL_WIDTH, bannerHeight, 'FD');

      doc.setTextColor(OMR_COLOR[0], OMR_COLOR[1], OMR_COLOR[2]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.text(subjName.toUpperCase(), colX + COL_WIDTH / 2, bannerY + 4.2, { align: 'center' });
    }

    // 2. Draw Column Grid Boxes & Rows
    for (let colIdxOnPage = 0; colIdxOnPage < COL_COUNT; colIdxOnPage++) {
      const globalColIdx = (page - 1) * COL_COUNT + colIdxOnPage;
      if (globalColIdx >= totalCols) continue;

      const colQuestions = columnGrid[globalColIdx];
      const colX = getColX(colIdxOnPage);

      // Draw Main channel border enclosing question channel
      doc.setDrawColor(OMR_COLOR[0], OMR_COLOR[1], OMR_COLOR[2]);
      doc.setLineWidth(0.3);
      doc.rect(colX, headerY, COL_WIDTH, colHeight, 'S');

      // Draw header row box
      doc.setFillColor(OMR_BG_COLOR[0], OMR_BG_COLOR[1], OMR_BG_COLOR[2]);
      doc.rect(colX + 0.1, headerY + 0.1, COL_WIDTH - 0.2, headerHeight - 0.2, 'F');

      // Draw horizontal line dividing header from rows
      doc.line(colX, headerY + headerHeight, colX + COL_WIDTH, headerY + headerHeight);

      // Draw vertical divider dividing numbers from bubbles
      const dividerX = colX + 8.5;
      doc.line(dividerX, headerY, dividerX, headerY + colHeight);

      // Spacing options in header
      const numOptions = config.options.length;
      const optStep = (COL_WIDTH - 8.5) / (numOptions + 1);

      // Render column index headers (e.g. 1 2 3 4)
      config.options.forEach((opt, optIdx) => {
        const headerOptX = dividerX + optStep * (optIdx + 1);
        doc.setTextColor(TEXT_COLOR[0], TEXT_COLOR[1], TEXT_COLOR[2]);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.text(opt, headerOptX, headerY + 4.0, { align: 'center' });
      });

      // Render questions lists (only draw elements that are defined in grid, leaving the rest empty)
      let currentY = headerY + headerHeight;
      for (let r = 0; r < questionsPerColumn; r++) {
        if (r > 0 && r % 5 === 0) {
          currentY += groupSpacer;
        }

        const qItem = colQuestions[r];
        if (qItem !== undefined) {
          // 3-digit question number (e.g. 001)
          const qNumText = String(qItem.globalQNum).padStart(3, '0');
          doc.setTextColor(TEXT_COLOR[0], TEXT_COLOR[1], TEXT_COLOR[2]);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7.5);
          doc.text(qNumText, colX + 1.5, currentY + 2.5);

          // Bubbles in row
          config.options.forEach((opt, optIdx) => {
            const bubbleX = dividerX + optStep * (optIdx + 1);
            const bubbleY = currentY + 2.7;
            const radius = 2.5;

            doc.setDrawColor(OMR_COLOR[0], OMR_COLOR[1], OMR_COLOR[2]);
            doc.setFillColor(255, 255, 255);
            doc.circle(bubbleX, bubbleY, radius, 'FD');

            // Center option text inside bubble
            doc.setTextColor(OMR_COLOR[0], OMR_COLOR[1], OMR_COLOR[2]);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7.5);
            doc.text(opt, bubbleX, bubbleY + 0.9, { align: 'center' });
          });
        }

        currentY += rowHeight;
      }
    }
  }

  return doc;
}

export function normalizeAnswersCasing(
  parsedAnswers: Record<string, Record<string, string>>,
  expectedSubjects: { name: string; questionCount: number }[]
): Record<string, Record<string, string>> {
  const normalized: Record<string, Record<string, string>> = {};

  // Calculate questionsPerColumn using the exact same capacity math as the OMR PDF generator
  const questionsPerColumn = 30;

  let startCol = 0;
  let currentGlobalQNum = 1;

  expectedSubjects.forEach((sub) => {
    const matchingKey = Object.keys(parsedAnswers || {}).find(
      (k) => k.toLowerCase().replace(/\s+/g, '') === sub.name.toLowerCase().replace(/\s+/g, '')
    );

    const rawAnswers = matchingKey ? parsedAnswers[matchingKey] : {};
    const subAnswers: Record<string, string> = {};

    for (let q = 1; q <= sub.questionCount; q++) {
      const colRel = Math.floor((q - 1) / questionsPerColumn);
      const colIdx = startCol + colRel;
      const rowIdx = (q - 1) % questionsPerColumn;
      const globalQNum = currentGlobalQNum;

      // Look up by global index (e.g. "26"), zero-padded global ("026"), local ("1"), or zero-padded local ("001")
      const val =
        rawAnswers[String(globalQNum)] ||
        rawAnswers[String(globalQNum).padStart(3, '0')] ||
        rawAnswers[String(q)] ||
        rawAnswers[String(q).padStart(3, '0')] ||
        '';

      subAnswers[String(q)] = val;
      currentGlobalQNum++;
    }

    normalized[sub.name] = subAnswers;

    // Update startCol using the exact column-allocation math of the OMR generator
    const colsNeeded = Math.ceil(sub.questionCount / questionsPerColumn);
    startCol += colsNeeded;
  });

  return normalized;
}
