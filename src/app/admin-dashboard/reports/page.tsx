'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from 'recharts';
import { 
  Download, 
  Filter, 
  TrendingUp, 
  Users, 
  BookOpen, 
  DollarSign,
  GraduationCap,
  Search,
  Eye,
  Clock,
  BarChart3,
  CheckSquare
} from 'lucide-react';
import ReportsService, { 
  Student, 
  FeeRecord, 
  Teacher, 
  ReportData, 
  ReportFilters 
} from '@/lib/reports-service';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { Preloader } from '@/components/ui/preloader';
import { useCurrentPrincipal } from '@/hooks/use-current-user';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

export default function ReportsPage() {
  const { toast } = useToast();
  const principal = useCurrentPrincipal();
  
  const [students, setStudents] = useState<Student[]>([]);
  const [feeRecords, setFeeRecords] = useState<FeeRecord[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [filters, setFilters] = useState<ReportFilters>({
    academicYear: '',
    class: '',
    feesCategory: '',
    status: '',
    startDate: '',
    endDate: ''
  });
  const [availableYears, setAvailableYears] = useState<string[]>(['2020-2021', '2021-2022', '2022-2023', '2023-2024', '2024-2025', '2025-2026', '2026-2027', '2027-2028', '2028-2029', '2029-2030', '2030-2031', '2031-2032', '2032-2033', '2033-2034', '2034-2035', '2035-2036', '2036-2037', '2037-2038', '2038-2039', '2039-2040', '2040-2041', '2041-2042', '2042-2043', '2043-2044', '2044-2045', '2045-2046', '2046-2047', '2047-2048', '2048-2049', '2049-2050']);
  const [availableClasses, setAvailableClasses] = useState<string[]>([]);
  const [availableFeeCategories, setAvailableFeeCategories] = useState<string[]>(['all', 'college', 'library', 'hostel', 'exam', 'transport', 'other']);
  const [availableStatuses, setAvailableStatuses] = useState<string[]>(['all', 'paid', 'partial', 'pending']);
  const [loading, setLoading] = useState(true);
  const [todaysAttendance, setTodaysAttendance] = useState<any[]>([]);

  useEffect(() => {
    if (!principal?.collegeId) return;

    const loadInitialData = async () => {
      try {
        // Load available filter options
        const [years, feeCategories] = await Promise.all([
          ReportsService.getAvailableAcademicYears(principal.collegeId),
          ReportsService.getAvailableFeeCategories(principal.collegeId)
        ]);

        if (years.length > 0) setAvailableYears(years);
        if (feeCategories.length > 0) setAvailableFeeCategories(feeCategories);
        
        // Fetch classes from the 'classes' collection for this college
        try {
          const classesSnapshot = await getDocs(
            query(collection(db, 'classes'), where('collegeId', '==', principal.collegeId))
          );
          const classesFromDb = classesSnapshot.docs.map(doc => {
            const data = doc.data();
            return data.name;
          }).filter(Boolean); // Remove any empty/null values
          
          if (classesFromDb.length > 0) {
            setAvailableClasses(classesFromDb);
          } else {
            // Fallback to default classes if none found
            setAvailableClasses(['DHI', 'DMLT', 'DOT&AT', 'DOT']);
          }
        } catch (error) {
          console.error('Error loading classes:', error);
          // Fallback to default classes on error
          setAvailableClasses(['DHI', 'DMLT', 'DOT&AT', 'DOT']);
        }
      } catch (error) {
        console.error('Error loading initial data:', error);
        toast({
          title: "Error",
          description: "Failed to load filter options. Check Firebase connection.",
          variant: "destructive"
        });
      }
    };

    loadInitialData();
  }, [principal?.collegeId]);

  useEffect(() => {
    if (!principal?.collegeId) return;

    const unsubscribe = ReportsService.subscribeToTodaysAttendance(
      (records) => {
        setTodaysAttendance(records);
      },
      (error) => {
        console.error('Error fetching today\'s attendance:', error);
      },
      principal.collegeId
    );

    return unsubscribe;
  }, [principal?.collegeId]);

  useEffect(() => {
    if (!principal?.collegeId) return;

    let studentsUnsubscribe: (() => void) | undefined;
    let feeRecordsUnsubscribe: (() => void) | undefined;
    let teachersUnsubscribe: (() => void) | undefined;
    
    // Subscribe to real-time data updates
    studentsUnsubscribe = ReportsService.subscribeToStudents(
      (students) => {
        setStudents(students);
      },
      (error) => {
        console.error('Error fetching students:', error);
        toast({
          title: "Error",
          description: "Failed to fetch student data",
          variant: "destructive"
        });
      },
      filters,
      principal.collegeId
    );

    feeRecordsUnsubscribe = ReportsService.subscribeToFeeRecords(
      (feeRecords) => {
        setFeeRecords(feeRecords);
      },
      (error) => {
        console.error('Error fetching fee records:', error);
        toast({
          title: "Error",
          description: "Failed to fetch fee data",
          variant: "destructive"
        });
      },
      filters,
      principal.collegeId
    );

    teachersUnsubscribe = ReportsService.subscribeToTeachers(
      (teachers) => {
        setTeachers(teachers);
      },
      (error) => {
        console.error('Error fetching teachers:', error);
        toast({
          title: "Error",
          description: "Failed to fetch teacher data",
          variant: "destructive"
        });
      },
      principal.collegeId
    );

    // Return cleanup function
    return () => {
      if (studentsUnsubscribe) studentsUnsubscribe();
      if (feeRecordsUnsubscribe) feeRecordsUnsubscribe();
      if (teachersUnsubscribe) teachersUnsubscribe();
    };
  }, [filters, principal?.collegeId]);

  useEffect(() => {
    try {
      // Process data even if arrays are empty to show empty state
      const processedData = ReportsService.processReportData(students, feeRecords, teachers, filters, todaysAttendance);
      setReportData(processedData);
      setLoading(false);
    } catch (error) {
      console.error('Error processing report data:', error);
      toast({
        title: "Error",
        description: "Failed to process report data. Check console for details.",
        variant: "destructive"
      });
      setLoading(false);
    }
  }, [students, feeRecords, teachers, filters, todaysAttendance]);

  const handleFilterChange = (key: keyof ReportFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleSelectAll = (key: keyof ReportFilters) => {
    setFilters(prev => ({ ...prev, [key]: '' }));
  };

  // Open spreadsheet-style view (in a new tab) for a given dataset
  const openSheetForChart = (
    sheet: 'feeStatus' | 'caste' | 'class' | 'gender' | 'admissions' | 'collection' | 'combined'
  ) => {
    if (!reportData) return;

    let columns: string[] = [];
    let rows: string[][] = [];
    let title = '';

    switch (sheet) {
      case 'feeStatus': {
        title = 'Fee Status - Student Details';
        columns = [
          'Student Name',
          'Student ID',
          'Class',
          'Academic Year',
          'Status',
          'Total Fees',
          'Paid Amount',
          'Outstanding',
        ];

        const detailedFees = (reportData.feeRecords || feeRecords || []).map((fee) => {
          let status: string;
          if (fee.paidAmount >= fee.totalFees) {
            status = 'Paid';
          } else if (fee.paidAmount > 0) {
            status = 'Partial';
          } else {
            status = 'Pending';
          }

          return [
            fee.studentName || '',
            fee.studentId || '',
            fee.admissionClass || '',
            fee.academicYear || '',
            status,
            String(fee.totalFees ?? ''),
            String(fee.paidAmount ?? ''),
            String(fee.outstandingAmount ?? ''),
          ];
        });

        rows = detailedFees;
        break;
      }
      case 'caste': {
        title = 'Religion / Caste Distribution';
        columns = ['Religion / Caste Group', 'Students'];
        rows = (reportData.casteDistribution || []).map((item: any) => [
          String(item.name ?? ''),
          String(item.count ?? 0),
        ]);
        break;
      }
      case 'class': {
        title = 'Class-wise Distribution Data';
        columns = ['Class', 'Students'];
        rows = (reportData.classDistribution || []).map((item: any) => [
          String(item.name ?? item.class ?? ''),
          String(item.count ?? item.students ?? 0),
        ]);
        break;
      }
      case 'gender': {
        title = 'Gender Distribution Data';
        columns = ['Gender', 'Count'];
        rows = (Array.isArray(reportData.genderDistribution)
          ? reportData.genderDistribution.map((item: any) => [String(item.name ?? ''), String(item.count ?? 0)])
          : Object.entries(reportData.genderDistribution || {}).map(([gender, value]) => [
              gender.charAt(0).toUpperCase() + gender.slice(1),
              String(value ?? 0),
            ]));
        break;
      }
      case 'admissions': {
        title = 'Yearly Admissions Data';
        columns = ['Month', 'Admissions'];
        rows = (reportData.monthlyAdmissions || []).map((item: any) => [
          String(item.month ?? ''),
          String(item.admissions ?? 0),
        ]);
        break;
      }
      case 'collection': {
        title = 'Monthly Fee Collection Data';
        columns = ['Month', 'Collection'];
        rows = (reportData.monthlyCollection || []).map((item: any) => [
          String(item.month ?? ''),
          String(item.collection ?? 0),
        ]);
        break;
      }
      case 'combined': {
        title = 'Student Combined Report';
        columns = [
          'SL NO',
          'Status',
          'Section',
          'Board Reg No',
          'Student Name',
          'Gender',
          'DOB',
          'Admission Date',
          'Admission No',
          'Aadhar No',
          'Contact Mobile',
          'Religion',
          'Caste',
          'Caste Category',
          'Address',
          'State',
          'District',
          'City',
          'Taluk',
          'Father Name',
          'Father Mobile',
          'Mother Name',
          'Fees Category',
        ];

        const feeByStudentId = new Map(
          feeRecords.map((f) => [f.studentId, f] as const)
        );

        rows = (students || []).map((s: any, index: number) => {
          const fee = feeByStudentId.get(s.id) || feeByStudentId.get(s.studentId);

          let feeStatus = '';
          if (fee) {
            if ((fee.paidAmount || 0) >= (fee.totalFees || 0)) {
              feeStatus = 'Paid';
            } else if ((fee.paidAmount || 0) > 0) {
              feeStatus = 'Partial';
            } else {
              feeStatus = 'Pending';
            }
          }

          const fullAddress =
            s.address ||
            [s.addressLine1, s.addressLine2, s.village]
              .filter(Boolean)
              .join(', ');

          return [
            String(index + 1),
            feeStatus || (s.status || 'Active'),
            s.admissionClass || '',
            s.boardRegNo || '',
            s.studentName || s.name || '',
            s.gender || '',
            s.dob || s.dateOfBirth || '',
            s.admissionDateFormatted || s.admissionDate || '',
            s.admissionNo || s.admissionNumber || '',
            s.aadharNo || s.aadharNumber || '',
            s.contactMobile || s.fatherContactNumber || s.phone || '',
            s.religion || '',
            s.caste || '',
            s.casteCategory || '',
            fullAddress || s.homeAddress || '',
            s.state || '',
            s.district || '',
            s.city || '',
            s.taluk || '',
            s.fatherName || '',
            s.fatherContactNumber || '',
            s.motherName || '',
            s.feesCategory || '',
          ];
        });
        break;
      }
    }

    if (columns.length === 0) {
      columns = ['Column 1'];
      rows = [['']];
    }

    const tableHead = `<tr>${columns
      .map((col) => `<th style="border:1px solid #ddd;padding:8px;background:#f3f4f6;text-align:left;">${col}</th>`)
      .join('')}</tr>`;

    const tableBody = rows
      .map(
        (row) =>
          `<tr>${row
            .map(
              (cell) =>
                `<td style="border:1px solid #ddd;padding:6px;font-size:12px;">${cell !== undefined ? cell : ''}</td>`
            )
            .join('')}</tr>`
      )
      .join('');

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${title}</title>
          <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
          <style>
            * {
              box-sizing: border-box;
            }
            body {
              font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
              margin: 24px;
              background: #f5f5f7;
              color: #111827;
            }
            h1 {
              font-size: 24px;
              font-weight: 700;
              margin-bottom: 16px;
            }
            .toolbar {
              display: flex;
              gap: 8px;
              margin-bottom: 16px;
            }
            .btn {
              display: inline-flex;
              align-items: center;
              gap: 4px;
              padding: 6px 14px;
              border-radius: 6px;
              border: 1px solid #d1d5db;
              background: #ffffff;
              font-size: 13px;
              cursor: pointer;
              transition: background 0.15s, box-shadow 0.15s, border-color 0.15s;
            }
            .btn-primary {
              background: #3b82f6;
              border-color: #2563eb;
              color: #ffffff;
              box-shadow: 0 1px 2px rgba(0,0,0,0.08);
            }
            .btn:hover {
              background: #f3f4f6;
            }
            .btn-primary:hover {
              background: #2563eb;
            }
            .spreadsheet-card {
              border-radius: 10px;
              background: #ffffff;
              border: 1px solid #e5e7eb;
              box-shadow: 0 4px 10px rgba(15, 23, 42, 0.06);
              overflow: hidden;
            }
            .sheet-header {
              padding: 12px 16px;
              border-bottom: 1px solid #e5e7eb;
              background: #f9fafb;
              font-weight: 600;
            }
            .table-container {
              padding: 8px 16px 16px;
              overflow: auto;
              max-height: 75vh;
            }
            table {
              border-collapse: collapse;
              min-width: max(700px, 100%);
            }
            thead {
              background: #f3f4f6;
            }
            th, td {
              border: 1px solid #e5e7eb;
              padding: 6px 10px;
              font-size: 13px;
              text-align: left;
              white-space: nowrap;
            }
            th {
              font-weight: 600;
            }
            tbody tr:nth-child(even) {
              background: #fafafa;
            }
            tbody tr:hover {
              background: #e5f2ff;
            }
            .row-index {
              background: #f9fafb;
              text-align: center;
              font-weight: 500;
              width: 40px;
            }
            .cell-input {
              width: 100%;
              border: none;
              outline: none;
              background: transparent;
              font: inherit;
            }
          </style>
          <script>
            function ensureRowNumbers() {
              const rows = document.querySelectorAll('tbody tr');
              rows.forEach((row, idx) => {
                const firstCell = row.querySelector('td');
                if (firstCell) firstCell.textContent = String(idx + 1);
              });
            }

            function addRow() {
              const tbody = document.querySelector('tbody');
              const headerCells = document.querySelectorAll('thead th');
              if (!tbody || headerCells.length === 0) return;

              const tr = document.createElement('tr');
              headerCells.forEach((_, colIndex) => {
                const td = document.createElement('td');
                if (colIndex === 0) {
                  td.className = 'row-index';
                  td.textContent = '';
                } else {
                  const input = document.createElement('input');
                  input.className = 'cell-input';
                  input.type = 'text';
                  td.appendChild(input);
                }
                tr.appendChild(td);
              });
              tbody.appendChild(tr);
              ensureRowNumbers();
            }

            function addColumn() {
              const headerRow = document.querySelector('thead tr');
              const bodyRows = document.querySelectorAll('tbody tr');
              if (!headerRow) return;

              const th = document.createElement('th');
              th.textContent = 'Column ' + headerRow.children.length;
              headerRow.appendChild(th);

              bodyRows.forEach((row, rowIndex) => {
                const td = document.createElement('td');
                if (rowIndex === 0 && row.children.length === 0) {
                  td.className = 'row-index';
                } else {
                  const input = document.createElement('input');
                  input.className = 'cell-input';
                  input.type = 'text';
                  td.appendChild(input);
                }
                row.appendChild(td);
              });
            }

            function getColumnIndexFromPrompt(message) {
              const headerRow = document.querySelector('thead tr');
              if (!headerRow) return null;
              const totalDataCols = headerRow.children.length - 1; // exclude index col
              const input = prompt(message + ' (1 - ' + totalDataCols + '):');
              if (!input) return null;
              const n = parseInt(input, 10);
              if (isNaN(n) || n < 1 || n > totalDataCols) {
                alert('Invalid column number.');
                return null;
              }
              // +1 to account for index column at position 0
              return n;
            }

            function renameColumn() {
              const colIndex = getColumnIndexFromPrompt('Enter column number to rename');
              if (colIndex == null) return;
              const headerRow = document.querySelector('thead tr');
              const current = headerRow.children[colIndex].textContent || '';
              const newName = prompt('New name for column ' + colIndex + ':', current);
              if (newName == null) return;
              headerRow.children[colIndex].textContent = newName;
            }

            function deleteColumn() {
              const colIndex = getColumnIndexFromPrompt('Enter column number to delete');
              if (colIndex == null) return;
              const headerRow = document.querySelector('thead tr');
              const bodyRows = document.querySelectorAll('tbody tr');
              headerRow.removeChild(headerRow.children[colIndex]);
              bodyRows.forEach((row) => {
                if (row.children[colIndex]) {
                  row.removeChild(row.children[colIndex]);
                }
              });
            }

            function sumColumn() {
              const colIndex = getColumnIndexFromPrompt('Enter column number to sum');
              if (colIndex == null) return;
              const bodyRows = document.querySelectorAll('tbody tr');
              let total = 0;
              bodyRows.forEach((row) => {
                const cell = row.children[colIndex];
                if (!cell) return;
                const input = cell.querySelector('input');
                const raw = input ? input.value : cell.textContent || '';
                const num = parseFloat(raw.replace(/,/g, ''));
                if (!isNaN(num)) total += num;
              });
              alert('Sum of column ' + colIndex + ' is: ' + total);
            }

            function sortColumn(ascending) {
              const colIndex = getColumnIndexFromPrompt('Enter column number to sort');
              if (colIndex == null) return;
              const tbody = document.querySelector('tbody');
              if (!tbody) return;
              const rows = Array.from(tbody.querySelectorAll('tr'));
              rows.sort((a, b) => {
                const getVal = (row) => {
                  const cell = row.children[colIndex];
                  if (!cell) return '';
                  const input = cell.querySelector('input');
                  const raw = input ? input.value : cell.textContent || '';
                  const num = parseFloat(raw.replace(/,/g, ''));
                  return isNaN(num) ? raw.toLowerCase() : num;
                };
                const av = getVal(a);
                const bv = getVal(b);
                if (typeof av === 'number' && typeof bv === 'number') {
                  return ascending ? av - bv : bv - av;
                }
                if (av < bv) return ascending ? -1 : 1;
                if (av > bv) return ascending ? 1 : -1;
                return 0;
              });
              rows.forEach((row) => tbody.appendChild(row));
              ensureRowNumbers();
            }

            function tableToCsv() {
              const rows = Array.from(document.querySelectorAll('table tr'));
              return rows
                .map((row) =>
                  Array.from(row.querySelectorAll('th,td'))
                    .map((cell) => {
                      const input = cell.querySelector('input');
                      const raw = input ? input.value : cell.textContent || '';
                      const text = raw.replace(/"/g, '""');
                      return '"' + text + '"';
                    })
                    .join(',')
                )
                .join('\\n');
            }

            function downloadCsv() {
              ensureRowNumbers();
              const csv = tableToCsv();
              const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
              const url = window.URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = (document.title || 'export') + '.csv';
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              window.URL.revokeObjectURL(url);
            }

            function downloadHtml() {
              ensureRowNumbers();
              const table = document.querySelector('.spreadsheet-card').outerHTML;
              const docHtml =
                '<!DOCTYPE html>' +
                 '<html>' +
                '<head>' +
                '<meta charset="utf-8" />' +
                '<title>Export</title>' +
                '<style>' +
                'body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 24px; background: #f5f5f7; }' +
                '</style>' +
                '</head>' +
                '<body>' +
                table +
                '</body>' +
                '</html>';
              const blob = new Blob([docHtml], { type: 'text/html;charset=utf-8;' });
              const url = window.URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = (document.title || 'export') + '.html';
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              window.URL.revokeObjectURL(url);
            }

            let currentChart = null;

            function printChartOnly() {
              const canvas = document.getElementById('visualization-canvas');
              if (!canvas) return;
              const dataUrl = canvas.toDataURL();
              const printWindow = window.open('', '_blank');
              if (printWindow) {
                printWindow.document.write('<html><head><title>Print Chart</title></head><body style="display:flex;justify-content:center;align-items:center;height:100vh;margin:0;"><img src="' + dataUrl + '" style="max-width:100%; max-height:100%; object-fit:contain;" onload="window.print();window.close();" /></body></html>');
                printWindow.document.close();
              }
            }

            function visualizeData() {
              const chartCard = document.getElementById('chart-card');
              chartCard.style.display = 'block';
              
              const headers = Array.from(document.querySelectorAll('thead th')).map(th => th.textContent || '');
              const labelSelect = document.getElementById('chart-label-col');
              const valueSelect = document.getElementById('chart-value-col');
              
              labelSelect.innerHTML = '';
              valueSelect.innerHTML = '';
              
              headers.forEach((header, index) => {
                if (index === 0) return;
                
                const labelOpt = document.createElement('option');
                labelOpt.value = String(index);
                labelOpt.textContent = header;
                labelSelect.appendChild(labelOpt);
                
                const valueOpt = document.createElement('option');
                valueOpt.value = String(index);
                valueOpt.textContent = header;
                valueSelect.appendChild(valueOpt);
              });
              
              if (headers.length > 1) {
                labelSelect.selectedIndex = 0;
                
                let selectedValIdx = 0;
                const firstRowCells = document.querySelector('tbody tr')?.querySelectorAll('td');
                if (firstRowCells) {
                  for (let i = 1; i < firstRowCells.length; i++) {
                    const input = firstRowCells[i].querySelector('input');
                    const rawVal = input ? input.value : firstRowCells[i].textContent || '';
                    const parsed = parseFloat(rawVal.replace(/,/g, ''));
                    if (!isNaN(parsed) && i > 1) {
                      selectedValIdx = i - 1;
                      break;
                    }
                  }
                }
                valueSelect.selectedIndex = selectedValIdx;
              }
              
              updateChart();
              chartCard.scrollIntoView({ behavior: 'smooth' });
            }

            function updateChart() {
              const labelColIndex = parseInt(document.getElementById('chart-label-col').value, 10);
              const valueColIndex = parseInt(document.getElementById('chart-value-col').value, 10);
              const chartType = document.getElementById('chart-type').value;
              
              const bodyRows = document.querySelectorAll('tbody tr');
              const labels = [];
              const values = [];
              
              bodyRows.forEach((row) => {
                const labelCell = row.children[labelColIndex];
                const valueCell = row.children[valueColIndex];
                if (!labelCell || !valueCell) return;
                
                const labelInput = labelCell.querySelector('input');
                const labelVal = labelInput ? labelInput.value : labelCell.textContent || '';
                
                const valueInput = valueCell.querySelector('input');
                const valueVal = valueInput ? valueInput.value : valueCell.textContent || '';
                const parsedVal = parseFloat(valueVal.replace(/,/g, ''));
                
                labels.push(labelVal);
                values.push(isNaN(parsedVal) ? 0 : parsedVal);
              });
              
              const canvas = document.getElementById('visualization-canvas');
              const ctx = canvas.getContext('2d');
              
              if (currentChart) {
                currentChart.destroy();
              }
              
              const backgroundColors = labels.map((_, i) => {
                const hue = (i * 360 / Math.max(labels.length, 1)) % 360;
                return 'hsla(' + hue + ', 70%, 60%, 0.75)';
              });
              const borderColors = labels.map((_, i) => {
                const hue = (i * 360 / Math.max(labels.length, 1)) % 360;
                return 'hsla(' + hue + ', 70%, 50%, 1)';
              });
              
              const headers = Array.from(document.querySelectorAll('thead th')).map(th => th.textContent || '');
              const valueLabel = headers[valueColIndex] || 'Values';
              
              currentChart = new Chart(ctx, {
                type: chartType,
                data: {
                  labels: labels,
                  datasets: [{
                    label: valueLabel,
                    data: values,
                    backgroundColor: chartType === 'line' ? 'rgba(59, 130, 246, 0.2)' : backgroundColors,
                    borderColor: chartType === 'line' ? 'rgba(59, 130, 246, 1)' : borderColors,
                    borderWidth: 1.5,
                    fill: chartType === 'line'
                  }]
                },
                options: {
                  responsive: true,
                  maintainAspectRatio: false,
                  scales: (chartType === 'pie' || chartType === 'doughnut') ? {} : {
                    y: {
                      beginAtZero: true
                    }
                  }
                }
              });
            }

            window.addEventListener('DOMContentLoaded', () => {
              // Wrap existing table cells (except index column) in inputs for easier editing
              const bodyRows = document.querySelectorAll('tbody tr');
              bodyRows.forEach((row, rowIndex) => {
                const cells = row.querySelectorAll('td');
                cells.forEach((cell, colIndex) => {
                  if (colIndex === 0) {
                    cell.classList.add('row-index');
                    cell.textContent = String(rowIndex + 1);
                  } else {
                    const existingText = cell.textContent || '';
                    cell.textContent = '';
                    const input = document.createElement('input');
                    input.className = 'cell-input';
                    input.type = 'text';
                    input.value = existingText;
                    cell.appendChild(input);
                  }
                });
              });
            });
          </script>
        </head>
        <body>
          <h1>${title}</h1>
          <div class="toolbar">
            <button class="btn" onclick="addRow()">+ Add Row</button>
            <button class="btn" onclick="addColumn()">+ Add Column</button>
            <button class="btn" onclick="renameColumn()">✏ Rename Column</button>
            <button class="btn" onclick="deleteColumn()">🗑 Delete Column</button>
            <button class="btn" onclick="sumColumn()">∑ Sum Column</button>
            <button class="btn" onclick="sortColumn(true)">⬆ Sort Asc</button>
            <button class="btn" onclick="sortColumn(false)">⬇ Sort Desc</button>
            <button class="btn btn-primary" onclick="downloadCsv()">💾 Export CSV / Excel</button>
            <button class="btn" onclick="downloadHtml()">⬇ Export HTML / Print</button>
            <button class="btn" onclick="visualizeData()">📊 Visualize Data</button>
          </div>
          <div class="spreadsheet-card">
            <div class="sheet-header">Data Table</div>
            <div class="table-container">
              <table>
                <thead>
                  <tr>
                    <th class="row-index">#</th>
                    ${tableHead.replace('<tr>', '').replace('</tr>', '')}
                  </tr>
                </thead>
                <tbody>
                  ${tableBody
                    .split('</tr>')
                    .filter(Boolean)
                    .map((rowHtml: string) => `<tr><td class="row-index"></td>${rowHtml.replace('<tr>', '')}</tr>`)
                    .join('')}
                </tbody>
              </table>
            </div>
          </div>
          
          <div id="chart-card" class="spreadsheet-card" style="margin-top: 24px; display: none;">
            <div class="sheet-header" style="display: flex; justify-content: space-between; align-items: center;">
              <span>📊 Data Visualization</span>
              <button class="btn btn-primary" onclick="printChartOnly()" style="padding: 4px 10px; font-size: 11px;">Print Chart</button>
            </div>
            <div style="padding: 20px; display: flex; flex-direction: column; gap: 16px;">
              <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
                <div>
                  <label style="font-size: 12px; font-weight: 500; margin-right: 6px;">Label Column:</label>
                  <select id="chart-label-col" style="padding: 4px 8px; border-radius: 4px; border: 1px solid #d1d5db; font-size: 12px;"></select>
                </div>
                <div>
                  <label style="font-size: 12px; font-weight: 500; margin-right: 6px;">Value Column:</label>
                  <select id="chart-value-col" style="padding: 4px 8px; border-radius: 4px; border: 1px solid #d1d5db; font-size: 12px;"></select>
                </div>
                <div>
                  <label style="font-size: 12px; font-weight: 500; margin-right: 6px;">Chart Type:</label>
                  <select id="chart-type" style="padding: 4px 8px; border-radius: 4px; border: 1px solid #d1d5db; font-size: 12px;" onchange="updateChart()">
                    <option value="bar">Bar Chart</option>
                    <option value="line">Line Chart</option>
                    <option value="pie">Pie Chart</option>
                    <option value="doughnut">Doughnut Chart</option>
                  </select>
                </div>
                <button class="btn btn-primary" onclick="updateChart()">Generate Chart</button>
              </div>
              <div id="canvas-container" style="position: relative; height: 350px; width: 100%; max-width: 800px; margin: 0 auto;">
                <canvas id="visualization-canvas"></canvas>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    const newWindow = window.open('', '_blank');
    if (newWindow) {
      newWindow.document.write(html);
      newWindow.document.close();
    }
  };

  // Export functions
  const exportToExcel = () => {
    try {
      let csvContent = 'Student Name,Student ID,Class,Academic Year,Total Fees,Paid Amount,Outstanding Amount,Last Payment Date\n';
      
      feeRecords.forEach(record => {
        const lastPaymentDate = record.lastPaymentDate ? new Date(record.lastPaymentDate.seconds * 1000).toLocaleDateString() : 'N/A';
        
        const totalFees = typeof record.totalFees === 'number' ? record.totalFees : 0;
        const paidAmount = typeof record.paidAmount === 'number' ? record.paidAmount : 0;
        const outstandingAmount = typeof record.outstandingAmount === 'number' ? record.outstandingAmount : 0;
        
        csvContent += `"${record.studentName || 'N/A'}","${record.studentId || 'N/A'}","${record.admissionClass || 'N/A'}","${record.academicYear || 'N/A'}",${totalFees},${paidAmount},${outstandingAmount},"${lastPaymentDate}"\n`;
      });
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Fee_Records_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Success",
        description: "Data exported to Excel successfully!",
      });
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      toast({
        title: "Error",
        description: "Failed to export to Excel. Please try again.",
        variant: "destructive",
      });
    }
  };

  const exportToWord = () => {
    try {
      let content = `
        <html>
          <head>
            <meta charset="utf-8">
            <title>Fee Records Report</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; }
              table { border-collapse: collapse; width: 100%; margin-top: 20px; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
              th { background-color: #f2f2f2; }
              h1 { color: #333; }
            </style>
          </head>
          <body>
            <h1>Fee Records Report</h1>
            <p>Generated on: ${new Date().toLocaleDateString()}</p>
            <table>
              <thead>
                <tr>
                  <th>Student Name</th>
                  <th>Student ID</th>
                  <th>Class</th>
                  <th>Academic Year</th>
                  <th>Total Fees</th>
                  <th>Paid Amount</th>
                  <th>Outstanding</th>
                </tr>
              </thead>
              <tbody>
      `;
      
      feeRecords.forEach(record => {
        const totalFees = typeof record.totalFees === 'number' ? record.totalFees : 0;
        const paidAmount = typeof record.paidAmount === 'number' ? record.paidAmount : 0;
        const outstandingAmount = typeof record.outstandingAmount === 'number' ? record.outstandingAmount : 0;
        
        content += `
          <tr>
            <td>${record.studentName || 'N/A'}</td>
            <td>${record.studentId || 'N/A'}</td>
            <td>${record.admissionClass || 'N/A'}</td>
            <td>${record.academicYear || 'N/A'}</td>
            <td>₹${totalFees.toFixed(2)}</td>
            <td>₹${paidAmount.toFixed(2)}</td>
            <td>₹${outstandingAmount.toFixed(2)}</td>
          </tr>
        `;
      });
      
      content += `
              </tbody>
            </table>
          </body>
        </html>
      `;
      
      const blob = new Blob([content], { type: 'application/msword' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Fee_Records_${new Date().toISOString().split('T')[0]}.doc`;
      link.click();
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Success",
        description: "Data exported to Word successfully!",
      });
    } catch (error) {
      console.error('Error exporting to Word:', error);
      toast({
        title: "Error",
        description: "Failed to export to Word. Please try again.",
        variant: "destructive",
      });
    }
  };

  const exportToPDF = () => {
    try {
      const { jsPDF } = require('jspdf');
      const doc = new jsPDF();
      
      doc.setFontSize(20);
      doc.text('Fee Records Report', 20, 20);
      
      doc.setFontSize(12);
      doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 20, 30);
      
      const headers = ['Student Name', 'Class', 'Total Fees', 'Paid', 'Outstanding'];
      let y = 50;
      
      doc.setFontSize(10);
      headers.forEach((header, i) => {
        doc.text(header, 20 + (i * 35), y);
      });
      
      feeRecords.slice(0, 20).forEach((record, index) => {
        y = 60 + (index * 10);
        if (y > 280) {
          doc.addPage();
          y = 20;
        }
        
        const totalFees = typeof record.totalFees === 'number' ? record.totalFees : 0;
        const paidAmount = typeof record.paidAmount === 'number' ? record.paidAmount : 0;
        const outstandingAmount = typeof record.outstandingAmount === 'number' ? record.outstandingAmount : 0;
        
        doc.text(record.studentName || 'N/A', 20, y);
        doc.text(record.admissionClass || 'N/A', 55, y);
        doc.text(`INR ${totalFees.toFixed(2)}`, 90, y);
        doc.text(`INR ${paidAmount.toFixed(2)}`, 125, y);
        doc.text(`INR ${outstandingAmount.toFixed(2)}`, 160, y);
      });
      
      doc.save(`Fee_Records_${new Date().toISOString().split('T')[0]}.pdf`);
      
      toast({
        title: "Success",
        description: "Data exported to PDF successfully!",
      });
    } catch (error) {
      console.error('Error exporting to PDF:', error);
      toast({
        title: "Error",
        description: "Failed to export to PDF. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleSearch = () => {
    setLoading(true);
    setStudents([]);
    setFeeRecords([]);
    setTeachers([]);
  };

  const resetFilters = () => {
    setFilters({
      academicYear: availableYears.length > 0 ? availableYears[0] : '',
      class: availableClasses.length > 0 ? availableClasses[0] : '',
      feesCategory: availableFeeCategories.length > 0 ? availableFeeCategories[0] : '',
      status: 'paid',
      startDate: '',
      endDate: ''
    });
  };

  if (loading) {
    return <Preloader message="Loading reports..." fullScreen size="lg" />;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Report Filters Header */}
      <div className="bg-gray-800 text-white p-6 rounded-lg">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Filter className="w-6 h-6" />
            <div>
              <h1 className="text-2xl font-bold">Report Filters</h1>
              <p className="text-gray-300">Filter data by academic year, class, and time range.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span className="text-sm">Online</span>
          </div>
        </div>
      </div>

      {/* Filter Section */}
      <div className="bg-gray-100 p-6 rounded-lg">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">ACADEMIC YEAR</label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleSelectAll('academicYear')}
                className="h-6 px-2 text-xs"
                title="Select All (Clear Filter)"
              >
                <CheckSquare className="h-3 w-3 mr-1" />
                All
              </Button>
            </div>
            <Select value={filters.academicYear || 'all'} onValueChange={(value) => handleFilterChange('academicYear', value === 'all' ? '' : value)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select academic year" />
              </SelectTrigger>
              <SelectContent side="bottom" className="max-h-48 overflow-y-auto">
                <SelectItem value="all">All</SelectItem>
                {availableYears.map((year) => (
                  <SelectItem key={year} value={year}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">CLASS</label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleSelectAll('class')}
                className="h-6 px-2 text-xs"
                title="Select All (Clear Filter)"
              >
                <CheckSquare className="h-3 w-3 mr-1" />
                All
              </Button>
            </div>
            <Select value={filters.class || 'all'} onValueChange={(value) => handleFilterChange('class', value === 'all' ? '' : value)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select class" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {availableClasses.map((cls) => (
                  <SelectItem key={cls} value={cls}>{cls}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">FEES CATEGORY</label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleSelectAll('feesCategory')}
                className="h-6 px-2 text-xs"
                title="Select All (Clear Filter)"
              >
                <CheckSquare className="h-3 w-3 mr-1" />
                All
              </Button>
            </div>
            <Select value={filters.feesCategory || 'all'} onValueChange={(value) => handleFilterChange('feesCategory', value === 'all' ? '' : value)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select fees category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {availableFeeCategories.filter(category => category !== 'all').map((category) => (
                  <SelectItem key={category} value={category}>
                    {category === 'college' ? 'College Fees' :
                     category === 'library' ? 'Library Fees' :
                     category === 'hostel' ? 'Hostel Fees' :
                     category === 'exam' ? 'Exam Fees' :
                     category === 'transport' ? 'Transport Fee' :
                     category === 'other' ? 'Other Fee' : category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">STATUS</label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleSelectAll('status')}
                className="h-6 px-2 text-xs"
                title="Select All (Clear Filter)"
              >
                <CheckSquare className="h-3 w-3 mr-1" />
                All
              </Button>
            </div>
            <Select value={filters.status || 'all'} onValueChange={(value) => handleFilterChange('status', value === 'all' ? '' : value)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {availableStatuses.filter(status => status !== 'all').map((status) => (
                  <SelectItem key={status} value={status}>
                    {status === 'paid' ? 'Paid' :
                     status === 'partial' ? 'Partial' :
                     status === 'pending' ? 'Pending' : status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">TIME RANGE</label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  handleSelectAll('startDate');
                  handleSelectAll('endDate');
                }}
                className="h-6 px-2 text-xs"
                title="Select All (Clear Filter)"
              >
                <CheckSquare className="h-3 w-3 mr-1" />
                All
              </Button>
            </div>
            <div className="flex gap-2">
              <Input
                type="date"
                value={filters.startDate}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
                placeholder="Start Date"
                className="text-sm"
              />
              <Input
                type="date"
                value={filters.endDate}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
                placeholder="End Date"
                className="text-sm"
              />
            </div>
          </div>
        </div>
        
        <div className="flex justify-end gap-2">
          <Button onClick={resetFilters} variant="outline">
            Reset Filters
          </Button>
          <Button 
            onClick={() => window.location.reload()} 
            variant="outline"
            className="text-blue-600 border-blue-600 hover:bg-blue-50"
          >
            Refresh Data
          </Button>
          
          <Button onClick={handleSearch} className="bg-green-600 hover:bg-green-700">
            <Search className="w-4 h-4 mr-2" />
            Search
          </Button>

          <Button onClick={() => openSheetForChart('combined')} className="bg-red-600 hover:bg-red-700">
            <Download className="w-4 h-4 mr-2" />
            Export to Excel
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-purple-800">Total Students</CardTitle>
            <Users className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-900">{reportData?.totalStudents || 0}</div>
            <p className="text-xs text-purple-600">Enrolled students</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-800">Total Collection</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-900">₹{reportData?.totalCollection?.toLocaleString() || 0}</div>
            <p className="text-xs text-green-600">Fee collection</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-orange-800">Pending Collection</CardTitle>
            <TrendingUp className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-900">₹{reportData?.pendingCollection?.toLocaleString() || 0}</div>
            <p className="text-xs text-orange-600">Outstanding fees</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-800">Total Teachers</CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-900">{reportData?.totalTeachers || 0}</div>
            <p className="text-xs text-blue-600">Active staff</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Fee Status Distribution */}
        <Card>
          <CardHeader className="bg-green-600 text-white">
            <div className="flex items-center gap-3">
              <Clock className="w-6 h-6 text-white" />
              <div>
                <CardTitle className="text-xl">Fee Status Distribution</CardTitle>
                <CardDescription className="text-green-200">Distribution of student fee payments</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent
            className="bg-gradient-to-b from-green-50 to-white p-6 cursor-pointer"
            onClick={() => openSheetForChart('feeStatus')}
          >
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie 
                  data={Object.entries(reportData?.feeStatusDistribution || {}).map(([key, value]) => ({
                    name: key.charAt(0).toUpperCase() + key.slice(1),
                    value
                  }))}
                  cx="50%" 
                  cy="50%" 
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8" 
                  dataKey="value"
                >
                  {Object.entries(reportData?.feeStatusDistribution || {}).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Caste Category / Religion Distribution */}
        <Card>
          <CardHeader className="bg-gradient-to-r from-blue-500 to-purple-600 text-white">
            <div className="flex items-center gap-3">
              <BarChart3 className="w-6 h-6 text-white" />
              <div>
                <CardTitle className="text-xl">Caste / Religion Distribution</CardTitle>
                <CardDescription className="text-blue-200">Student distribution by religion / caste group</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent
            className="bg-gradient-to-b from-purple-50 to-white p-6 cursor-pointer"
            onClick={() => openSheetForChart('caste')}
          >
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={reportData?.casteDistribution || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" fill="#6366f1" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Class-wise Distribution */}
        <Card>
          <CardHeader className="bg-gradient-to-r from-orange-500 to-red-500 text-white">
            <div className="flex items-center gap-3">
              <GraduationCap className="w-6 h-6 text-white" />
              <div>
                <CardTitle className="text-xl">Class-wise Distribution</CardTitle>
                <CardDescription className="text-orange-200">Student distribution across classes</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent
            className="bg-gradient-to-b from-orange-50 to-white p-6 cursor-pointer"
            onClick={() => openSheetForChart('class')}
          >
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={reportData?.classDistribution || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="class" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="students" fill="#82ca9d" />
              </BarChart>
            </ResponsiveContainer>
            <div className="flex items-center justify-center mt-4">
              <div className="w-3 h-3 bg-purple-500 rounded mr-2"></div>
              <span className="text-purple-600 text-sm">count</span>
            </div>
          </CardContent>
        </Card>

        {/* Gender Distribution */}
        <Card>
          <CardHeader className="bg-gradient-to-r from-pink-500 to-red-500 text-white">
            <div className="flex items-center gap-3">
              <Users className="w-6 h-6 text-white" />
              <div>
                <CardTitle className="text-xl">Gender Distribution</CardTitle>
                <CardDescription className="text-pink-200">Student distribution by gender</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent
            className="bg-gradient-to-b from-pink-50 to-white p-6 cursor-pointer"
            onClick={() => openSheetForChart('gender')}
          >
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={reportData?.genderDistribution || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" fill="#ec4899" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Monthly Admissions */}
        <Card>
          <CardHeader className="bg-gradient-to-r from-blue-500 to-purple-600 text-white">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-6 h-6 text-white" />
              <div>
                <CardTitle className="text-xl">Yearly Admissions</CardTitle>
                <CardDescription className="text-blue-200">Yearly trend of new student admissions</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent
            className="bg-gradient-to-b from-blue-50 to-white p-6 cursor-pointer"
            onClick={() => openSheetForChart('admissions')}
          >
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={reportData?.monthlyAdmissions || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="admissions" stroke="#8884d8" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Monthly Fee Collection */}
        <Card>
          <CardHeader className="bg-gradient-to-r from-green-500 to-green-700 text-white">
            <div className="flex items-center gap-3">
              <DollarSign className="w-6 h-6 text-white" />
              <div>
                <CardTitle className="text-xl">Monthly Fee Collection</CardTitle>
                <CardDescription className="text-green-200">Monthly trend of fee collection</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent
            className="bg-gradient-to-b from-green-50 to-white p-6 cursor-pointer"
            onClick={() => openSheetForChart('collection')}
          >
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={reportData?.monthlyCollection || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="collection" stroke="#82ca9d" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Attendance Report Card */}
        <Card className="hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 overflow-hidden">
          <Link href="/admin-dashboard/reports/attendance" className="block">
            <CardHeader className="bg-gradient-to-r from-indigo-500 to-blue-600 text-white cursor-pointer">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <BarChart3 className="w-6 h-6 text-white animate-pulse" />
                  <div>
                    <CardTitle className="text-xl">Attendance Report</CardTitle>
                    <CardDescription className="text-indigo-100 text-xs">Class-wise present students today (updates daily)</CardDescription>
                  </div>
                </div>
                <Badge className="bg-white/20 hover:bg-white/30 text-white border-none font-bold text-xs uppercase tracking-wide">
                  View Classes
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="bg-gradient-to-b from-indigo-50 to-white p-6 cursor-pointer">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={reportData?.todaysAttendanceDistribution || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="present" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="flex items-center justify-center mt-4">
                <div className="w-3 h-3 bg-indigo-600 rounded mr-2"></div>
                <span className="text-indigo-600 text-sm font-medium">Present Students Today</span>
              </div>
            </CardContent>
          </Link>
        </Card>
      </div>

      {/* Student Fees Report */}
      <Card>
        <CardHeader className="bg-green-600 text-white">
          <div className="flex items-center gap-3">
            <DollarSign className="w-6 h-6 text-white" />
            <div>
              <CardTitle className="text-xl">Student Fees Report</CardTitle>
              <CardDescription className="text-green-200">Comprehensive fee status report with export options</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="bg-gradient-to-b from-green-50 to-white p-6">
          <div className="flex justify-between items-center mb-6">
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                className="border-green-300 text-green-700 hover:bg-green-50"
                onClick={exportToExcel}
              >
                <Download className="w-4 h-4 mr-2" />
                Export to Excel
              </Button>
              <Button 
                variant="outline" 
                className="border-green-300 text-green-700 hover:bg-green-50"
                onClick={exportToWord}
              >
                <Download className="w-4 h-4 mr-2" />
                Export to Word
              </Button>
              <Button 
                variant="outline" 
                className="border-green-300 text-green-700 hover:bg-green-50"
                onClick={exportToPDF}
              >
                <Download className="w-4 h-4 mr-2" />
                Export to PDF
              </Button>
            </div>
            <div className="flex items-center gap-2 text-green-700 font-semibold">
              <span>Displaying 1 - {Math.min(10, feeRecords.length)} of {feeRecords.length}</span>
              <Eye className="w-4 h-4" />
            </div>
          </div>

          {feeRecords.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <DollarSign className="w-8 h-8 text-orange-600" />
              </div>
              <p className="text-lg font-medium text-gray-900 mb-2">No fee records found.</p>
              <p className="text-gray-600">Fee records will appear here.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {feeRecords.slice(0, 10).map((record) => (
                <div key={record.id} className="flex items-center justify-between p-4 border rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <Users className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800">{record.studentName}</p>
                      <p className="text-sm text-gray-500">{record.admissionClass} • {record.academicYear}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500 mb-1">
                      {record.lastPaymentDate?.seconds 
                        ? new Date(record.lastPaymentDate.seconds * 1000).toLocaleDateString()
                        : 'N/A'
                      }
                    </p>
                    <Badge variant={
                      record.paidAmount >= record.totalFees 
                        ? 'default' 
                        : record.paidAmount > 0 
                          ? 'secondary' 
                          : 'destructive'
                    } className="capitalize">
                      {record.paidAmount >= record.totalFees 
                        ? 'Paid' 
                        : record.paidAmount > 0 
                          ? 'Partial' 
                          : 'Unpaid'
                      }
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Admissions */}
      <Card>
        <CardHeader className="bg-gradient-to-r from-purple-500 to-pink-500 text-white">
          <div className="flex items-center gap-3">
            <BookOpen className="w-6 h-6 text-white" />
            <div>
              <CardTitle className="text-xl">Recent Admissions</CardTitle>
              <CardDescription className="text-purple-200">Latest student admissions and registrations</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="bg-gradient-to-b from-purple-50 to-white p-6">
          {students.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <BookOpen className="w-8 h-8 text-orange-600" />
              </div>
              <p className="text-lg font-medium text-gray-900 mb-2">No recent admissions found.</p>
              <p className="text-gray-600">New admissions will appear here.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {students.slice(0, 10).map((student) => (
                <div key={student.id} className="flex items-center justify-between p-4 border rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <Users className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800">{student.studentName}</p>
                      <p className="text-sm text-gray-500">{student.admissionClass} • {student.academicYear}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500 mb-1">
                      {student.admissionDate?.seconds 
                        ? new Date(student.admissionDate.seconds * 1000).toLocaleDateString()
                        : 'N/A'
                      }
                    </p>
                    <Badge variant={student.status === 'active' || student.status === 'Active' ? 'default' : 'secondary'} className="capitalize">
                      {student.status || 'Active'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
