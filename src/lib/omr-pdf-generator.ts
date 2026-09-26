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
  collegeLogo2Base64?: string;
  collegeCode?: string;
  collegeAddress?: string;
}

export interface OMRStudentResultExcel {
  rollNumber: string;
  studentName?: string;
  studentClass?: string;
  studentSection?: string;
  answers?: Record<string, Record<string, string>>;
  score: number;
  correctCount: number;
  incorrectCount: number;
  unattemptedCount: number;
  maxScore: number;
  evaluatedAt: string;
}

export interface OMRExamConfigForExcel {
  subjects?: { name: string; questionCount: number }[];
  keyAnswers?: Record<string, Record<string, string>>;
  correctMarks?: number;
  negativeMarks?: number;
}

function getKeyForSubject(mapObj: Record<string, any> | undefined | null, targetName: string): Record<string, any> {
  if (!mapObj) return {};
  if (mapObj[targetName]) return mapObj[targetName];

  const targetNorm = targetName.trim().toLowerCase();
  const foundKey = Object.keys(mapObj).find((k) => k.trim().toLowerCase() === targetNorm);
  return foundKey ? mapObj[foundKey] : {};
}

export function exportOMRResultsToExcel(
  results: OMRStudentResultExcel[],
  testName: string,
  examConfig?: OMRExamConfigForExcel | null
) {
  // Sort results by Roll Number numerically / alphanumerically
  const sortedResults = [...results].sort((a, b) => {
    const rollA = (a.rollNumber || '').trim();
    const rollB = (b.rollNumber || '').trim();
    const numA = parseInt(rollA, 10);
    const numB = parseInt(rollB, 10);
    if (!isNaN(numA) && !isNaN(numB) && String(numA) === rollA && String(numB) === rollB) {
      return numA - numB;
    }
    return rollA.localeCompare(rollB, undefined, { numeric: true, sensitivity: 'base' });
  });

  // Extract subject configuration from examConfig or fallback to unique subject names in results
  let subjects: { name: string; questionCount: number }[] = [];
  if (examConfig?.subjects && examConfig.subjects.length > 0) {
    subjects = examConfig.subjects;
  } else {
    const subjectNameSet = new Set<string>();
    sortedResults.forEach((r) => {
      if (r.answers) {
        Object.keys(r.answers).forEach((sName) => subjectNameSet.add(sName));
      }
    });
    subjects = Array.from(subjectNameSet).map((name) => ({ name, questionCount: 25 }));
  }

  const corrM = examConfig?.correctMarks ?? 1;
  const negM = examConfig?.negativeMarks ?? 0;
  const keyAnswers = examConfig?.keyAnswers;

  const rows = sortedResults.map((r, idx) => {
    const row: Record<string, any> = {
      'Sl. No.': idx + 1,
      'Roll Number': r.rollNumber || 'N/A',
      'Candidate Name': r.studentName || 'N/A',
      'Class': r.studentClass || 'N/A',
      'Section': r.studentSection || 'N/A',
    };

    // Calculate & add subject-wise score columns using exact subject names created in OMR setup
    subjects.forEach((subj) => {
      const subjectHeaderName = subj.name.toUpperCase();
      let subjectScore = 0;

      if (r.answers) {
        const studObj = getKeyForSubject(r.answers, subj.name);

        if (keyAnswers) {
          const keyObj = getKeyForSubject(keyAnswers, subj.name);
          let subCorrect = 0;
          let subIncorrect = 0;

          for (let q = 1; q <= subj.questionCount; q++) {
            const correctOpt = (keyObj[String(q)] || keyObj[String(q).padStart(3, '0')] || '').trim().toUpperCase();
            const studentOpt = (studObj[String(q)] || studObj[String(q).padStart(3, '0')] || '').trim().toUpperCase();

            if (!correctOpt) continue;

            if (studentOpt === correctOpt) {
              subCorrect++;
            } else if (studentOpt) {
              subIncorrect++;
            }
          }
          subjectScore = (subCorrect * corrM) - (subIncorrect * negM);
        }
      }

      row[subjectHeaderName] = subjectScore;
    });

    // Total and summary metrics columns
    row['Total Score'] = r.score;
    row['Max Score'] = r.maxScore;
    row['Percentage'] = r.maxScore > 0 ? ((r.score / r.maxScore) * 100).toFixed(2) + '%' : '0%';
    row['Total Correct'] = r.correctCount;
    row['Total Incorrect'] = r.incorrectCount;
    row['Unattempted'] = r.unattemptedCount;
    row['Evaluation Date'] = r.evaluatedAt ? new Date(r.evaluatedAt).toLocaleDateString() : 'N/A';

    return row;
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);

  // Auto-calculate column widths for clean readability in Excel
  if (rows.length > 0) {
    const keys = Object.keys(rows[0]);
    const colWidths = keys.map((key) => {
      const maxLen = Math.max(
        key.length,
        ...rows.map((r) => String(r[key] ?? '').length)
      );
      return { wch: Math.max(maxLen + 4, 12) };
    });
    worksheet['!cols'] = colWidths;
  }

  // Calculate summary statistics
  const totalSheets = sortedResults.length;
  const totalScoreSum = sortedResults.reduce((acc, curr) => acc + (curr.score || 0), 0);
  const avgScore = totalSheets > 0 ? (totalScoreSum / totalSheets).toFixed(2) : '0';

  let highestMarkStr = 'N/A';
  let lowestMarkStr = 'N/A';

  if (totalSheets > 0) {
    const maxScore = Math.max(...sortedResults.map((r) => r.score));
    const minScore = Math.min(...sortedResults.map((r) => r.score));

    const topStudents = sortedResults.filter((r) => r.score === maxScore);
    const topDetails = topStudents
      .map((s) => `${s.studentName || 'Unknown'} (Roll: ${s.rollNumber || 'N/A'})`)
      .join(', ');
    highestMarkStr = `${maxScore} [Student: ${topDetails}]`;

    const lowStudents = sortedResults.filter((r) => r.score === minScore);
    const lowDetails = lowStudents
      .map((s) => `${s.studentName || 'Unknown'} (Roll: ${s.rollNumber || 'N/A'})`)
      .join(', ');
    lowestMarkStr = `${minScore} [Student: ${lowDetails}]`;
  }

  const summaryRows: any[][] = [
    [],
    ['Valuation Summary & Statistics'],
    ['Sheets Evaluated', totalSheets],
    ['Class Average Total Score', avgScore],
  ];

  // Include subject-wise class averages in summary statistics
  subjects.forEach((subj) => {
    const subjectHeaderName = subj.name.toUpperCase();
    const subScoresSum = rows.reduce((acc, row) => acc + (row[subjectHeaderName] || 0), 0);
    const subAvg = totalSheets > 0 ? (subScoresSum / totalSheets).toFixed(2) : '0';
    summaryRows.push([`Average ${subjectHeaderName} Score`, subAvg]);
  });

  summaryRows.push(
    ['Highest Total Mark', highestMarkStr],
    ['Lowest Total Mark', lowestMarkStr]
  );

  XLSX.utils.sheet_add_aoa(worksheet, summaryRows, { origin: -1 });

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

  // Draws template page structure (outer margin anchor marks, inner borders, title)
  const drawPageTemplate = (pdf: jsPDF, pageNum: number) => {
    // 1. Draw 4 Solid Black Anchor Timing Marks (Centered at 16.037mm -> 91px in 1191x1684 canvas)
    const anchorSize = 4.5;
    const anchorOffset = 16.037 - anchorSize / 2; // 13.787mm
    pdf.setFillColor(BLACK[0], BLACK[1], BLACK[2]);
    pdf.rect(anchorOffset, anchorOffset, anchorSize, anchorSize, 'F'); // Top Left
    pdf.rect(PAGE_WIDTH - anchorOffset - anchorSize, anchorOffset, anchorSize, anchorSize, 'F'); // Top Right
    pdf.rect(anchorOffset, PAGE_HEIGHT - anchorOffset - anchorSize, anchorSize, anchorSize, 'F'); // Bottom Left
    pdf.rect(PAGE_WIDTH - anchorOffset - anchorSize, PAGE_HEIGHT - anchorOffset - anchorSize, anchorSize, anchorSize, 'F'); // Bottom Right

    // 2. Draw Main Outer Page Framing Rectangle (Encloses content at 9.5mm with clean margin, eliminating box overlaps)
    pdf.setDrawColor(OMR_COLOR[0], OMR_COLOR[1], OMR_COLOR[2]);
    pdf.setLineWidth(0.3);
    pdf.rect(9.5, 9.5, PAGE_WIDTH - 19, PAGE_HEIGHT - 19, 'S');

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
    const institutionTitle = (config.collegeName || '').trim();
    const hasLogo1 = !!config.collegeLogoBase64;
    const hasLogo2 = !!config.collegeLogo2Base64;

    const renderPdfImage = (imgBase64: string, x: number, y: number, w: number, h: number) => {
      try {
        let fmt = 'PNG';
        if (imgBase64.startsWith('data:image/jpeg') || imgBase64.startsWith('data:image/jpg')) {
          fmt = 'JPEG';
        } else if (imgBase64.startsWith('data:image/webp')) {
          fmt = 'WEBP';
        }
        pdf.addImage(imgBase64, fmt, x, y, w, h);
      } catch (err) {
        try {
          (pdf as any).addImage(imgBase64, x, y, w, h);
        } catch (e) {
          console.error('Error drawing college logo to PDF:', e);
        }
      }
    };

    if (institutionTitle) {
      const logoSize = 11;
      const logoY = yCursor - 7;

      if (hasLogo1 && hasLogo2) {
        // Dual logos: Logo 1 on left, Logo 2 on right, text centered
        renderPdfImage(config.collegeLogoBase64!, midColX + 1, logoY, logoSize, logoSize);
        renderPdfImage(config.collegeLogo2Base64!, midColX + midColWidth - logoSize - 1, logoY, logoSize, logoSize);

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(11);
        pdf.setTextColor(TEXT_COLOR[0], TEXT_COLOR[1], TEXT_COLOR[2]);
        pdf.text(institutionTitle.toUpperCase(), midColX + midColWidth / 2, yCursor - 2, { align: 'center' });

        pdf.setFontSize(8.5);
        pdf.setTextColor(OMR_COLOR[0], OMR_COLOR[1], OMR_COLOR[2]);
        pdf.text(`${config.testName.toUpperCase()} - OMR ANSWER SHEET`, midColX + midColWidth / 2, yCursor + 3.5, { align: 'center' });
      } else if (hasLogo1) {
        // Single logo on left
        const logoX = midColX + 1;
        renderPdfImage(config.collegeLogoBase64!, logoX, logoY, logoSize, logoSize);

        const textStartX = logoX + logoSize + 3;
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(11);
        pdf.setTextColor(TEXT_COLOR[0], TEXT_COLOR[1], TEXT_COLOR[2]);
        pdf.text(institutionTitle.toUpperCase(), textStartX, yCursor - 2);

        pdf.setFontSize(8.5);
        pdf.setTextColor(OMR_COLOR[0], OMR_COLOR[1], OMR_COLOR[2]);
        pdf.text(`${config.testName.toUpperCase()} - OMR ANSWER SHEET`, textStartX, yCursor + 3.5);
      } else {
        // Text only centered
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(12.5);
        pdf.setTextColor(TEXT_COLOR[0], TEXT_COLOR[1], TEXT_COLOR[2]);
        pdf.text(institutionTitle.toUpperCase(), midColX + midColWidth / 2, yCursor - 2, { align: 'center' });

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
