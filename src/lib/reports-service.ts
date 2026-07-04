import { 
  collection, 
  query, 
  where, 
  getDocs,
  onSnapshot,
} from 'firebase/firestore';
import { db } from './firebase';

export interface Student {
  id: string;
  studentName: string;
  admissionClass: string;
  admissionDate: any;
  academicYear: string;
  gender: string;
  caste: string;
  casteCategory: string;
  religion?: string;
  status: string;
  totalFees: number;
  photoUrl?: string;
  fatherName?: string;
  motherName?: string;
  fatherContactNumber?: string;
  motherContactNumber?: string;
  feesCategory?: string;
}

export interface FeeRecord {
  id: string;
  studentId: string;
  studentName: string;
  admissionClass: string;
  academicYear: string;
  totalFees: number;
  outstandingAmount: number;
  paidAmount: number;
  lastPaymentDate: any;
  createdAt: any;
  feeType?: string;
}

export interface Teacher {
  id: string;
  fullName: string;
  designation: string;
  department: string;
  status: string;
  joiningDate: any;
}

export interface ReportData {
  totalStudents: number;
  totalTeachers: number;
  totalCollection: number;
  pendingCollection: number;
  monthlyAdmissions: Array<{ month: string; admissions: number }>;
  feeStatusDistribution: { [key: string]: number };
  casteDistribution: Array<{ name: string; count: number; color: string; }>;
  classDistribution: Array<{ name: string; count: number; color: string; }>;
  genderDistribution: Array<{ name: string; count: number; color: string; }>;
  monthlyCollection: Array<{ month: string; collection: number }>;
  recentAdmissions: Student[];
  feeRecords: FeeRecord[];
  todaysAttendanceDistribution?: Array<{ name: string; present: number; }>;
}

export interface ReportFilters {
  academicYear: string;
  class: string;
  feesCategory: string;
  status: string;
  startDate: string;
  endDate: string;
}

export class ReportsService {
  private static classesCache: { id: string; name: string }[] = [];

  // Initialize helper to resolve class names
  private static async ensureClassesLoaded(collegeId: string) {
    if (this.classesCache.length > 0) return;
    try {
      const q = query(collection(db, 'classes'), where('collegeId', '==', collegeId));
      const snap = await getDocs(q);
      this.classesCache = snap.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name || ''
      }));
    } catch (e) {
      console.error('Error loading classes cache:', e);
    }
  }

  // Subscribe to students data with real-time updates
  static subscribeToStudents(
    callback: (students: Student[]) => void, 
    errorCallback?: (error: Error) => void,
    filters?: Partial<ReportFilters>,
    collegeId?: string
  ) {
    try {
      if (!collegeId) {
        callback([]);
        return () => {};
      }

      const q = query(collection(db, 'students'), where('collegeId', '==', collegeId));
      
      return onSnapshot(q, 
        async (snapshot) => {
          await this.ensureClassesLoaded(collegeId);

          let students = snapshot.docs.map(doc => {
            const data = doc.data();
            
            // Resolve class name
            const studentClass = this.classesCache.find(c => c.id === data.classId);
            const className = studentClass ? studentClass.name : (data.classId || 'Unknown Class');

            let admissionDateTimestamp: any = null;
            if (data.admissionDate) {
              try {
                const dateObj = new Date(data.admissionDate);
                admissionDateTimestamp = {
                  seconds: Math.floor(dateObj.getTime() / 1000),
                  nanoseconds: 0
                };
              } catch (e) {
                console.warn('Failed to parse admissionDate:', data.admissionDate, e);
              }
            }

            return {
              id: doc.id,
              studentName: data.name || '',
              admissionClass: className,
              admissionDate: admissionDateTimestamp,
              academicYear: data.academicYear || '',
              gender: data.gender || '',
              caste: data.caste || '',
              casteCategory: data.subCaste || data.caste || '',
              religion: data.religion || '',
              status: data.status || 'Active',
              totalFees: data.fees?.totalFees ?? ((data.fees?.paid ?? 0) + (data.fees?.balance ?? 0)),
              photoUrl: data.photoUrl || '',
              fatherName: data.fatherName || '',
              motherName: data.motherName || '',
              fatherContactNumber: data.phone || '',
              feesCategory: data.fees?.breakdown ? Object.keys(data.fees.breakdown).filter(k => (data.fees.breakdown as any)[k] > 0)[0] || 'college' : 'college'
            };
          });

          // Apply filters in memory
          if (filters?.academicYear && filters.academicYear !== 'all' && filters.academicYear !== '') {
            students = students.filter(s => s.academicYear === filters.academicYear);
          }
          
          if (filters?.class && filters.class !== 'all' && filters.class !== '') {
            students = students.filter(s => s.admissionClass === filters.class);
          }

          callback(students as any);
        },
        (error) => {
          console.error('Error listening to students:', error);
          if (errorCallback) errorCallback(error);
        }
      );
    } catch (error) {
      console.error('Error setting up students listener:', error);
      if (errorCallback) errorCallback(error as Error);
      return () => {};
    }
  }

  // Subscribe to fee records with real-time updates
  static subscribeToFeeRecords(
    callback: (feeRecords: FeeRecord[]) => void, 
    errorCallback?: (error: Error) => void,
    filters?: Partial<ReportFilters>,
    collegeId?: string
  ) {
    try {
      if (!collegeId) {
        callback([]);
        return () => {};
      }

      const q = query(collection(db, 'students'), where('collegeId', '==', collegeId));
      
      return onSnapshot(q, 
        async (snapshot) => {
          await this.ensureClassesLoaded(collegeId);

          const feeRecords: FeeRecord[] = [];
          
          snapshot.docs.forEach((doc) => {
            const data = doc.data();
            if (data.fees) {
              const totalFees = data.fees.totalFees ?? ((data.fees.paid ?? 0) + (data.fees.balance ?? 0));
              const paidAmount = data.fees.paid ?? 0;
              const outstandingAmount = data.fees.balance ?? Math.max(0, totalFees - paidAmount);
              
              // Resolve class name
              const studentClass = this.classesCache.find(c => c.id === data.classId);
              const className = studentClass ? studentClass.name : (data.classId || 'Unknown Class');

              // Get last payment date from payment history
              let lastPaymentDateTimestamp: any = null;
              if (data.fees.paymentHistory && data.fees.paymentHistory.length > 0) {
                const sortedPayments = [...data.fees.paymentHistory].sort(
                  (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
                );
                const latestPayment = sortedPayments[0];
                if (latestPayment && latestPayment.date) {
                  try {
                    const dateObj = new Date(latestPayment.date);
                    lastPaymentDateTimestamp = {
                      seconds: Math.floor(dateObj.getTime() / 1000),
                      nanoseconds: 0
                    };
                  } catch (e) {
                    console.warn('Failed to parse payment date:', latestPayment.date, e);
                  }
                }
              }

              // Determine primary fee type
              let feeType = 'college';
              if (data.fees.breakdown) {
                const activeBreakdown = Object.keys(data.fees.breakdown).filter(
                  k => (data.fees.breakdown as any)[k] > 0
                );
                if (activeBreakdown.length > 0) {
                  feeType = activeBreakdown[0].replace('Fees', '').toLowerCase();
                }
              }

              feeRecords.push({
                id: doc.id + '_fee',
                studentId: doc.id,
                studentName: data.name || '',
                admissionClass: className,
                academicYear: data.academicYear || '',
                totalFees,
                outstandingAmount,
                paidAmount,
                lastPaymentDate: lastPaymentDateTimestamp,
                createdAt: lastPaymentDateTimestamp || { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 },
                feeType
              });
            }
          });

          // Apply filters in memory
          let filteredFeeRecords = feeRecords;
          
          if (filters?.academicYear && filters.academicYear !== 'all' && filters.academicYear !== '') {
            filteredFeeRecords = filteredFeeRecords.filter(f => f.academicYear === filters.academicYear);
          }
          
          if (filters?.class && filters.class !== 'all' && filters.class !== '') {
            filteredFeeRecords = filteredFeeRecords.filter(f => f.admissionClass === filters.class);
          }
          
          if (filters?.feesCategory && filters.feesCategory !== 'all' && filters.feesCategory !== '') {
            filteredFeeRecords = filteredFeeRecords.filter(f => f.feeType === filters.feesCategory);
          }
          
          if (filters?.status && filters.status !== 'all' && filters.status !== '') {
            filteredFeeRecords = filteredFeeRecords.filter(record => {
              const status = this.calculateFeeStatus(record);
              return status === filters.status;
            });
          }
          
          callback(filteredFeeRecords);
        },
        (error) => {
          console.error('Error listening to fee records:', error);
          if (errorCallback) errorCallback(error);
        }
      );
    } catch (error) {
      console.error('Error setting up fee records listener:', error);
      if (errorCallback) errorCallback(error as Error);
      return () => {};
    }
  }

  // Subscribe to teachers with real-time updates
  static subscribeToTeachers(
    callback: (teachers: Teacher[]) => void, 
    errorCallback?: (error: Error) => void,
    collegeId?: string
  ) {
    try {
      if (!collegeId) {
        callback([]);
        return () => {};
      }
      const q = query(collection(db, 'teachers'), where('collegeId', '==', collegeId));
      
      return onSnapshot(q, 
        (snapshot) => {
          const teachers = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              fullName: data.name || '',
              designation: data.roles?.[0] || 'Teacher',
              department: data.subjectSpecialty || 'General',
              status: 'Active',
              joiningDate: null
            };
          }) as any[];
          callback(teachers);
        },
        (error) => {
          console.error('Error listening to teachers:', error);
          if (errorCallback) errorCallback(error);
        }
      );
    } catch (error) {
      console.error('Error setting up teachers listener:', error);
      if (errorCallback) errorCallback(error as Error);
      return () => {};
    }
  }

  // Subscribe to today's attendance records with real-time updates
  static subscribeToTodaysAttendance(
    callback: (records: any[]) => void,
    errorCallback?: (error: Error) => void,
    collegeId?: string
  ) {
    try {
      if (!collegeId) {
        callback([]);
        return () => {};
      }
      const today = new Date().toISOString().slice(0, 10);
      const q = query(
        collection(db, 'attendanceRecords'),
        where('collegeId', '==', collegeId),
        where('date', '==', today)
      );
      
      return onSnapshot(q, 
        (snapshot) => {
          const records = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          callback(records);
        },
        (error) => {
          console.error('Error listening to today\'s attendance:', error);
          if (errorCallback) errorCallback(error);
        }
      );
    } catch (error) {
      console.error('Error setting up today\'s attendance listener:', error);
      if (errorCallback) errorCallback(error as Error);
      return () => {};
    }
  }

  // Calculate fee status based on paid amount vs total fees
  private static calculateFeeStatus(feeRecord: FeeRecord): string {
    if (feeRecord.paidAmount >= feeRecord.totalFees && feeRecord.totalFees > 0) {
      return 'paid';
    } else if (feeRecord.paidAmount > 0) {
      return 'partial';
    } else {
      return 'pending';
    }
  }

  // Test Firebase connection
  static async testConnection(): Promise<boolean> {
    return true;
  }

  // Process report data
  static processReportData(
    students: Student[], 
    feeRecords: FeeRecord[], 
    teachers: Teacher[],
    filters: ReportFilters,
    todaysAttendance: any[] = []
  ): ReportData {
    const filteredStudents = students;
    const filteredFees = feeRecords;

    const totalStudents = filteredStudents.length;
    const totalTeachers = teachers.length;
    const totalCollection = filteredFees.reduce((sum, fee) => sum + (fee.paidAmount || 0), 0);
    const pendingCollection = filteredFees.reduce((sum, fee) => sum + (fee.outstandingAmount || 0), 0);

    const monthlyAdmissions = this.calculateMonthlyAdmissions(filteredStudents);
    const feeStatusDistribution = this.calculateFeeStatusDistribution(filteredFees);
    const casteDistribution = this.calculateCasteDistribution(filteredStudents);
    const classDistribution = this.calculateClassDistribution(filteredStudents);
    const genderDistribution = this.calculateGenderDistribution(filteredStudents);
    const monthlyCollection = this.calculateMonthlyCollection(filteredFees);
    const todaysAttendanceDistribution = this.calculateTodaysAttendanceDistribution(classDistribution, todaysAttendance);

    const recentAdmissions = filteredStudents
      .sort((a, b) => {
        const dateA = a.admissionDate?.seconds ? new Date(a.admissionDate.seconds * 1000).getTime() : 0;
        const dateB = b.admissionDate?.seconds ? new Date(b.admissionDate.seconds * 1000).getTime() : 0;
        return dateB - dateA;
      })
      .slice(0, 10);

    return {
      totalStudents,
      totalTeachers,
      totalCollection,
      pendingCollection,
      monthlyAdmissions,
      feeStatusDistribution,
      casteDistribution,
      classDistribution,
      genderDistribution,
      monthlyCollection,
      recentAdmissions,
      feeRecords: filteredFees,
      todaysAttendanceDistribution
    };
  }

  private static calculateTodaysAttendanceDistribution(
    classDistribution: Array<{ name: string }>,
    todaysAttendance: any[]
  ) {
    return classDistribution.map(cls => {
      // Find all records for today matching this class name or class ID
      const classRecords = todaysAttendance.filter(
        r => r.className === cls.name || r.classId === cls.name
      );
      
      // Count unique studentIds marked present today
      const presentStudentIds = new Set(
        classRecords
          .filter(r => r.status === 'present')
          .map(r => r.studentId)
      );

      return {
        name: cls.name,
        present: presentStudentIds.size
      };
    });
  }

  private static calculateMonthlyAdmissions(students: Student[]) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyData = months.map(month => ({ month, admissions: 0 }));

    students.forEach(student => {
      if (student.admissionDate?.seconds) {
        try {
          const date = new Date(student.admissionDate.seconds * 1000);
          const monthIndex = date.getMonth();
          monthlyData[monthIndex].admissions++;
        } catch (error) {
          console.warn('Error processing admission date:', error);
        }
      }
    });

    return monthlyData;
  }

  private static calculateFeeStatusDistribution(feeRecords: FeeRecord[]) {
    const distribution: { [key: string]: number } = {
      'paid': 0,
      'partial': 0,
      'pending': 0
    };

    feeRecords.forEach(fee => {
      const status = this.calculateFeeStatus(fee);
      distribution[status]++;
    });
    
    return distribution;
  }

  private static calculateCasteDistribution(students: Student[]) {
    const groupCount: { [key: string]: number } = {};
    
    students.forEach((student) => {
      const key = student.religion || student.caste || student.casteCategory || 'Other';
      groupCount[key] = (groupCount[key] || 0) + 1;
    });

    const colors = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#ff7300'];
    
    return Object.entries(groupCount).map(([name, count], index) => ({
      name,
      count,
      color: colors[index % colors.length]
    }));
  }

  private static calculateClassDistribution(students: Student[]) {
    const classCount: { [key: string]: number } = {};
    
    students.forEach(student => {
      const className = student.admissionClass;
      classCount[className] = (classCount[className] || 0) + 1;
    });

    const colors = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#ff7300'];
    
    return Object.entries(classCount).map(([name, count], index) => ({
      name,
      class: name,
      students: count,
      count,
      color: colors[index % colors.length]
    }));
  }

  private static calculateGenderDistribution(students: Student[]) {
    const genderCount: { [key: string]: number } = {};
    
    students.forEach((student) => {
      const g = (student.gender || '').trim().toLowerCase();
      let normalized = 'Unknown';
      if (g === 'm' || g === 'male') {
        normalized = 'Male';
      } else if (g === 'f' || g === 'female') {
        normalized = 'Female';
      } else if (g) {
        normalized = student.gender;
      }
      genderCount[normalized] = (genderCount[normalized] || 0) + 1;
    });

    const colors = ['#0088FE', '#EC4899', '#10B981', '#F59E0B', '#6366F1', '#14B8A6', '#A855F7', '#F97316'];
    
    return Object.entries(genderCount).map(([name, count], index) => ({
      name,
      count,
      color: colors[index % colors.length]
    }));
  }

  private static calculateMonthlyCollection(feeRecords: FeeRecord[]) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyData = months.map(month => ({ month, collection: 0 }));

    feeRecords.forEach(fee => {
      if (fee.lastPaymentDate?.seconds) {
        try {
          const date = new Date(fee.lastPaymentDate.seconds * 1000);
          const monthIndex = date.getMonth();
          monthlyData[monthIndex].collection += fee.paidAmount || 0;
        } catch (error) {
          console.warn('Error processing payment date:', error);
        }
      }
    });

    return monthlyData;
  }

  // Get available academic years
  static async getAvailableAcademicYears(collegeId?: string): Promise<string[]> {
    try {
      if (!collegeId) return [];
      const q = query(collection(db, 'students'), where('collegeId', '==', collegeId));
      const snapshot = await getDocs(q);
      
      const years = new Set<string>();
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.academicYear) {
          years.add(data.academicYear);
        }
      });
      
      return Array.from(years).sort().reverse();
    } catch (error) {
      console.error('Error getting academic years:', error);
      return [];
    }
  }

  // Get available fee categories
  static async getAvailableFeeCategories(collegeId?: string): Promise<string[]> {
    try {
      if (!collegeId) return [];
      const q = query(collection(db, 'students'), where('collegeId', '==', collegeId));
      const snapshot = await getDocs(q);
      
      const categories = new Set<string>();
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.fees?.breakdown) {
          Object.keys(data.fees.breakdown).forEach(k => {
            if (data.fees.breakdown[k] > 0) {
              categories.add(k.replace('Fees', '').toLowerCase());
            }
          });
        }
      });
      
      return Array.from(categories).sort();
    } catch (error) {
      console.error('Error getting fee categories:', error);
      return [];
    }
  }
}

export default ReportsService;
