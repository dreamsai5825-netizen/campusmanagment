'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCurrentPrincipal } from '@/hooks/use-current-user';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { 
  FileSpreadsheet, 
  Boxes, 
  ArrowRightLeft, 
  ClipboardList, 
  Wrench, 
  Briefcase, 
  Download, 
  Loader2, 
  Activity, 
  Info 
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';

interface Department {
  id: string;
  name: string;
}

interface Asset {
  id: string;
  departmentId: string;
  assetName: string;
  assetType: string;
  assetNumber: string;
  condition: string;
  quantity: number;
  addedAt: string;
}

interface AssetTransfer {
  id: string;
  fromDept: string;
  toDept: string;
  assetName: string;
  assetNumber: string;
  condition: string;
  quantity: number;
  transferredAt: string;
}

interface AssetRequest {
  id: string;
  assetName: string;
  requestedBy: string;
  department: string;
  quantity?: number;
  status: string;
  remarks?: string;
  requestedAt: string;
}

interface ManagementRequest {
  id: string;
  type: 'maintenance' | 'procurement';
  assetName: string;
  description: string;
  estimatedCost: number;
  priority: string;
  status: string;
  remarks?: string;
  requestedAt: string;
}

export default function ReportsPage() {
  const principal = useCurrentPrincipal();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);

  // Raw Database states
  const [departments, setDepartments] = useState<Department[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [transfers, setTransfers] = useState<AssetTransfer[]>([]);
  const [assetRequests, setAssetRequests] = useState<AssetRequest[]>([]);
  const [mgtRequests, setMgtRequests] = useState<ManagementRequest[]>([]);

  useEffect(() => {
    if (!principal?.collegeId) return;

    setLoading(true);

    // 1. Fetch departments
    const unsubDepts = onSnapshot(
      query(collection(db, 'asset_departments'), where('collegeId', '==', principal.collegeId)),
      (snap) => {
        setDepartments(snap.docs.map(d => ({ id: d.id, name: d.data().name } as Department)));
      }
    );

    // 2. Fetch Assets
    const unsubAssets = onSnapshot(
      query(collection(db, 'assets'), where('collegeId', '==', principal.collegeId)),
      (snap) => {
        setAssets(snap.docs.map(d => ({ id: d.id, ...d.data() } as Asset)));
      }
    );

    // 3. Fetch Transfers
    const unsubTransfers = onSnapshot(
      query(collection(db, 'asset_transfers'), where('collegeId', '==', principal.collegeId)),
      (snap) => {
        setTransfers(snap.docs.map(d => ({ id: d.id, ...d.data() } as AssetTransfer)));
      }
    );

    // 4. Fetch Asset Requests
    const unsubRequests = onSnapshot(
      query(collection(db, 'asset_requests'), where('collegeId', '==', principal.collegeId)),
      (snap) => {
        setAssetRequests(snap.docs.map(d => ({ id: d.id, ...d.data() } as AssetRequest)));
      }
    );

    // 5. Fetch Management Requests (Maintenance & Procurement)
    const unsubMgtRequests = onSnapshot(
      query(collection(db, 'management_requests'), where('collegeId', '==', principal.collegeId)),
      (snap) => {
        setMgtRequests(snap.docs.map(d => ({ id: d.id, ...d.data() } as ManagementRequest)));
        setLoading(false);
      }
    );

    return () => {
      unsubDepts();
      unsubAssets();
      unsubTransfers();
      unsubRequests();
      unsubMgtRequests();
    };
  }, [principal?.collegeId]);

  // Derived filtered requests
  const maintenanceRequests = mgtRequests.filter(r => r.type === 'maintenance');
  const procurementRequests = mgtRequests.filter(r => r.type === 'procurement');

  // Mappers to clean Excel formats
  const mappedAssets = assets.map(asset => {
    const deptName = departments.find(d => d.id === asset.departmentId)?.name || 'Unknown Department';
    return {
      'Asset Name': asset.assetName,
      'Asset Type': asset.assetType,
      'Asset Number / ID': asset.assetNumber,
      'Condition': asset.condition,
      'Quantity': asset.quantity,
      'Department': deptName,
      'Added Date': asset.addedAt ? new Date(asset.addedAt).toLocaleDateString() : 'N/A'
    };
  });

  const mappedTransfers = transfers.map(t => ({
    'Asset Name': t.assetName,
    'Asset Number / ID': t.assetNumber,
    'From Department': t.fromDept,
    'To Department': t.toDept,
    'Condition': t.condition,
    'Quantity': t.quantity,
    'Transfer Date': t.transferredAt ? new Date(t.transferredAt).toLocaleDateString() : 'N/A'
  }));

  const mappedRequests = assetRequests.map(r => ({
    'Asset Name': r.assetName,
    'Requested By': r.requestedBy,
    'Department': r.department,
    'Quantity': r.quantity || 1,
    'Status': r.status,
    'Remarks': r.remarks || 'None',
    'Requested Date': r.requestedAt ? new Date(r.requestedAt).toLocaleDateString() : 'N/A'
  }));

  const mappedMaintenance = maintenanceRequests.map(m => ({
    'Asset Name': m.assetName,
    'Issue / Description': m.description,
    'Estimated Cost ($)': m.estimatedCost,
    'Priority': m.priority,
    'Status': m.status,
    'Management Remarks': m.remarks || 'None',
    'Requested Date': m.requestedAt ? new Date(m.requestedAt).toLocaleDateString() : 'N/A'
  }));

  const mappedProcurement = procurementRequests.map(p => ({
    'Asset Name': p.assetName,
    'Justification / Description': p.description,
    'Estimated Cost ($)': p.estimatedCost,
    'Priority': p.priority,
    'Status': p.status,
    'Management Remarks': p.remarks || 'None',
    'Requested Date': p.requestedAt ? new Date(p.requestedAt).toLocaleDateString() : 'N/A'
  }));

  // General Excel Export Helper
  const exportToExcel = (data: any[], fileName: string, sheetName: string) => {
    if (data.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No Data Available',
        description: `There are no records in the ${sheetName} queue to export.`,
      });
      return;
    }

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    
    // Auto-fit column widths
    const maxKeys = Object.keys(data[0]);
    const wscols = maxKeys.map(key => {
      let maxLen = key.length;
      data.forEach(row => {
        const cellValue = (row as any)[key];
        if (cellValue) {
          maxLen = Math.max(maxLen, String(cellValue).length);
        }
      });
      return { wch: maxLen + 3 };
    });
    worksheet['!cols'] = wscols;

    XLSX.writeFile(workbook, `${fileName}.xlsx`);
    
    toast({
      title: 'Export Successful',
      description: `Downloaded "${fileName}.xlsx" successfully.`,
    });
  };

  // Comprehensive Export Workbook Helper
  const exportAllToExcel = () => {
    const workbook = XLSX.utils.book_new();
    let hasData = false;

    const dataSheets = [
      { data: mappedAssets, name: 'Inventory' },
      { data: mappedTransfers, name: 'Transfers' },
      { data: mappedRequests, name: 'Requests' },
      { data: mappedMaintenance, name: 'Maintenance' },
      { data: mappedProcurement, name: 'Procurement' },
    ];

    dataSheets.forEach(sheet => {
      if (sheet.data.length > 0) {
        hasData = true;
        const worksheet = XLSX.utils.json_to_sheet(sheet.data);
        
        // Auto-fit columns
        const keys = Object.keys(sheet.data[0]);
        const wscols = keys.map(key => {
          let maxLen = key.length;
          sheet.data.forEach(row => {
            const cellValue = (row as any)[key];
            if (cellValue) {
              maxLen = Math.max(maxLen, String(cellValue).length);
            }
          });
          return { wch: maxLen + 3 };
        });
        worksheet['!cols'] = wscols;

        XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name);
      }
    });

    if (!hasData) {
      toast({
        variant: 'destructive',
        title: 'Export Failed',
        description: 'No asset logs are available to export.',
      });
      return;
    }

    const timestamp = new Date().toISOString().split('T')[0];
    XLSX.writeFile(workbook, `Campus_Asset_Manager_Comprehensive_Report_${timestamp}.xlsx`);

    toast({
      title: 'Workbook Exported',
      description: 'Downloaded the comprehensive multi-sheet report workbook.',
    });
  };

  const reportCards = [
    {
      title: 'Catalog & Inventory',
      description: 'A complete inventory listing of all cataloged hardware, facility devices, and campus equipment categorized by department.',
      count: assets.length,
      unit: 'items',
      icon: Boxes,
      color: 'text-blue-500 bg-blue-500/10',
      action: () => exportToExcel(mappedAssets, 'Asset_Catalog_Inventory_Report', 'Inventory')
    },
    {
      title: 'Transfer History',
      description: 'Historical transfers log of all assets moved from one department to another, including transfer date, condition, and quantities.',
      count: transfers.length,
      unit: 'transfers',
      icon: ArrowRightLeft,
      color: 'text-amber-500 bg-amber-500/10',
      action: () => exportToExcel(mappedTransfers, 'Asset_Transfers_History_Report', 'Transfers')
    },
    {
      title: 'Departmental Requests',
      description: 'Log of incoming equipment requests issued by campus students or teachers, tracking approvals, returns, and remarks.',
      count: assetRequests.length,
      unit: 'requests',
      icon: ClipboardList,
      color: 'text-emerald-500 bg-emerald-500/10',
      action: () => exportToExcel(mappedRequests, 'Departmental_Asset_Requests_Report', 'Requests')
    },
    {
      title: 'Maintenance Queue',
      description: 'Scheduled inspections, repairs, and hardware servicing requests submitted to management, tracking priority and costings.',
      count: maintenanceRequests.length,
      unit: 'repair jobs',
      icon: Wrench,
      color: 'text-purple-500 bg-purple-500/10',
      action: () => exportToExcel(mappedMaintenance, 'Asset_Maintenance_Queue_Report', 'Maintenance')
    },
    {
      title: 'Procurement Pipeline',
      description: 'Equipment procurement proposals sent to College Admin, detailing asset titles, justification notes, and budget costings.',
      count: procurementRequests.length,
      unit: 'orders',
      icon: Briefcase,
      color: 'text-pink-500 bg-pink-500/10',
      action: () => exportToExcel(mappedProcurement, 'Asset_Procurement_Pipeline_Report', 'Procurement')
    }
  ];

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold font-headline tracking-tight bg-gradient-to-r from-primary to-violet-500 bg-clip-text text-transparent">
            Asset Management Reports
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base mt-1">
            Generate, review, and export asset catalogs and logistics data sheets in Microsoft Excel format.
          </p>
        </div>
        
        {!loading && (
          <Button 
            onClick={exportAllToExcel}
            className="bg-gradient-to-r from-primary to-violet-600 hover:from-primary/90 hover:to-violet-600/90 text-white shadow-md font-semibold"
          >
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Export Comprehensive Workbook
          </Button>
        )}
      </div>

      {/* Main content area */}
      {loading ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Loader2 className="h-8 w-8 animate-spin rounded-full text-primary" />
            <p className="text-muted-foreground text-sm mt-4">Analyzing datastores and caching records...</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          
          {/* Comprehensive Report Hero Card */}
          <Card className="border border-primary/20 bg-primary/5 relative overflow-hidden transition-all hover:shadow-md">
            <div className="absolute top-0 right-0 -mt-6 -mr-6 w-32 h-32 bg-gradient-to-br from-primary/10 to-violet-500/15 rounded-full blur-2xl" />
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-6 w-6 text-primary" />
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 font-bold uppercase tracking-wider text-[10px]">
                  All-In-One
                </Badge>
              </div>
              <CardTitle className="text-xl font-bold mt-2 text-foreground">Comprehensive Workbook Export</CardTitle>
              <CardDescription className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
                Compile and download all asset manager databases into a single Excel workbook. This generated workbook contains separate, formatted sheets for <strong>Inventory</strong>, <strong>Transfers</strong>, <strong>Requests</strong>, <strong>Maintenance</strong>, and <strong>Procurement</strong>.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-border/40 pt-4 mt-2">
                <div className="flex flex-wrap gap-4 text-xs font-semibold text-muted-foreground">
                  <span className="flex items-center gap-1"><Boxes className="h-3.5 w-3.5" /> {assets.length} Inventory Items</span>
                  <span className="flex items-center gap-1"><ArrowRightLeft className="h-3.5 w-3.5" /> {transfers.length} Transfers</span>
                  <span className="flex items-center gap-1"><ClipboardList className="h-3.5 w-3.5" /> {assetRequests.length} Requests</span>
                  <span className="flex items-center gap-1"><Wrench className="h-3.5 w-3.5" /> {maintenanceRequests.length} Repairs</span>
                </div>
                <Button 
                  onClick={exportAllToExcel}
                  className="bg-primary hover:bg-primary/90 text-white font-semibold flex items-center gap-1.5"
                >
                  <Download className="h-4 w-4" />
                  Download Workbook
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Individual Report Cards Grid */}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {reportCards.map((card, idx) => (
              <Card key={idx} className="flex flex-col justify-between border border-border/80 shadow-sm transition-all duration-300 hover:scale-[1.02] hover:shadow-md bg-card">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className={`p-2.5 rounded-xl ${card.color}`}>
                      <card.icon className="h-5 w-5" />
                    </div>
                    <Badge variant="outline" className="font-semibold text-xs py-0.5">
                      {card.count} {card.unit}
                    </Badge>
                  </div>
                  <CardTitle className="text-lg font-bold mt-3 text-foreground">{card.title}</CardTitle>
                  <CardDescription className="text-xs leading-relaxed mt-1 text-muted-foreground">
                    {card.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-2">
                  <Button 
                    variant="outline" 
                    onClick={card.action}
                    className="w-full flex items-center justify-center gap-1.5 hover:bg-primary/5 hover:text-primary hover:border-primary/20 transition-all font-medium text-xs shadow-sm mt-2"
                  >
                    <Download className="h-3.5 w-3.5 text-primary" />
                    Download {card.title} Excel
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

        </div>
      )}
    </div>
  );
}
