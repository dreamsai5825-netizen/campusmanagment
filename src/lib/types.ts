/** Institution (school/college) – one per tenant. */
export type College = {
  id: string;
  name: string;
  /** Unique code: official (DICE/university) or auto-generated for private. */
  code: string;
  createdAt: string;
  address?: string;
  logoUrl?: string;
  logo2Url?: string;
  status?: 'active' | 'deactivated';
  deactivationReason?: string;
};

export type Principal = {
  id: string;
  name: string;
  email: string;
  collegeId: string;
  /** Profile picture URL (e.g. from Firebase Storage). */
  photoUrl?: string;
};

export type Teacher = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  collegeId: string;
  /** Profile picture URL (e.g. from Firebase Storage). */
  photoUrl?: string;
  /** University/seat number or employee ID. */
  usn?: string;
  /** @deprecated Use subjectIds; kept for backward compat. First subject name. */
  subjectSpecialty?: string;
  /** Subject document IDs this teacher teaches. */
  subjectIds?: string[];
  /** @deprecated Use roles; kept for backward compat */
  role?: string;
  /** Teacher roles or designations (e.g. "Teacher", "Senior Teacher", etc.) */
  roles?: string[];
  /** Academic year batch (e.g. "2025-2026"). Used for year-scoped admin views. */
  academicYear?: string;
};

export type Class = {
  id: string;
  name: string;
  collegeId: string;
  branch?: string;
  /** @deprecated Use subjectIds; kept for backward compat. First subject name. */
  subject?: string;
  /** Subject document IDs allocated to this class. */
  subjectIds?: string[];
};

export type Student = {
  id: string;
  studentId: string;
  name: string;
  email: string;
  phone?: string;
  classId: string;
  collegeId: string;
  /** Academic year batch (e.g. "2025-2026"). Used for year-scoped admin views. */
  academicYear?: string;
  /** Profile picture URL (e.g. from Firebase Storage). */
  photoUrl?: string;
  /** University seat number / roll number. */
  usn?: string;
  fees?: {
    status: string;
    balance: number;
    /** Total fee amount for the student. */
    totalFees?: number;
    /** Amount paid so far. */
    paid?: number;
    /** Itemized fee breakdown from admission. */
    breakdown?: {
      collegeFees?: number;
      libraryFees?: number;
      hostelFees?: number;
      examFees?: number;
      transportFees?: number;
      otherFees?: number;
    };
    paymentHistory?: {
      id: string;
      amount: number;
      date: string;
      method: 'Cash' | 'Online' | 'Cheque' | 'Bank Transfer';
      receiptNumber?: string;
      remarks?: string;
    }[];
  };
  attendance?: {
    summary: { present: number; absent: number; totalDays: number };
    bySubject: { subject: string; present: number; absent: number; total: number }[];
  };
  assessments?: { subject: string; marks: number }[];
  firstName?: string;
  lastName?: string;
  caste?: string;
  subCaste?: string;
  religion?: string;
  gender?: string;
  bloodGroup?: string;
  admissionDate?: string;
  admissionNumber?: string;
  emergencyNumber?: string;
  homeAddress?: string;
  aadharNumber?: string;
  dateOfBirth?: string;
  documentsUrl?: string;
  documentsName?: string;
  status?: string;
};

export type Assignment = {
  id: string;
  collegeId: string;
  title: string;
  /** Subject name (e.g. A.I, Mathematics). */
  subject?: string;
  classId: string;
  dueDate: string;
  status: string;
  description?: string;
};

/** Student submission for an assignment (text + optional file). */
export type AssignmentSubmission = {
  id: string;
  assignmentId: string;
  assignmentTitle: string;
  studentId: string;
  studentName: string;
  collegeId: string;
  classId: string;
  submittedAt: string;
  textContent: string;
  attachmentUrl?: string;
  attachmentName?: string;
  status: 'submitted' | 'graded';
  grade?: string;
  /** Teacher feedback so the student can see it. */
  feedback?: string;
  feedbackAt?: string;
  feedbackBy?: string;
};

export type Announcement = {
  id: string;
  collegeId: string;
  title: string;
  content: string;
  date: string;
};

export type Complaint = {
  id: string;
  collegeId: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  classId: string;
  title: string;
  description: string;
  category: 'academic' | 'bullying' | 'faculty' | 'facilities' | 'other';
  status: 'open' | 'in-progress' | 'resolved' | 'closed';
  createdAt: string;
  resolvedAt?: string;
  coordinatorId?: string;
  resolution?: string;
  attachmentUrl?: string;
  attachmentName?: string;
};

export type Notification = {
  id: string;
  type: 'announcement' | 'message';
  sender: {
    name: string;
    role: string;
  };
  title: string;
  content: string;
  date: string;
  read: boolean;
  /** Who should see this notification (principal id, teacher id, or student id). Omit = legacy, show to principal. */
  recipientId?: string;
  collegeId?: string;
};

export type Parent = {
  id: string;
  studentId: string;
  name: string;
  relationship: string;
  phone: string;
  collegeId?: string;
};

export type TimetableEvent = {
  id: string;
  day: string;
  startTime: string;
  endTime: string;
  classId?: string;
  customText?: string;
};

export type Timetable = {
  id: string;
  collegeId: string;
  name: string;
  events: TimetableEvent[];
  /** Column headers; e.g. ['09:00 - 10:00', '10:00 - 11:00']. Editable by admin. */
  timeSlots?: string[];
  /** Row labels; e.g. ['Monday', 'Tuesday']. Editable by admin. */
  days?: string[];
};

export type Transaction = {
  id: string;
  collegeId: string;
  description: string;
  amount: number;
  type: 'revenue' | 'expense';
  date: string;
};

export type Subject = {
  id: string;
  collegeId: string;
  name: string;
};

/** Leave request sent by a teacher to the principal. */
export type LeaveRequest = {
  id: string;
  collegeId: string;
  senderId: string;
  senderName: string;
  senderType: 'teacher';
  subject: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
};

/** Message to/from the principal (thread with teacher or student). */
export type PrincipalMessage = {
  id: string;
  collegeId: string;
  fromId: string;
  fromName: string;
  fromType: 'teacher' | 'student' | 'principal';
  /** When set, message is from principal to this user (reply). */
  toId?: string;
  toName?: string;
  /** Type of the recipient when fromType is 'principal'. */
  toType?: 'teacher' | 'student';
  content: string;
  createdAt: string;
  read: boolean;
  attachmentUrl?: string;
  attachmentName?: string;
  /** When true, content is replaced with "This message was deleted" for everyone. */
  deleted?: boolean;
  /** User IDs who chose "Delete for me" – message is hidden for these users. */
  deletedForIds?: string[];
};

/** Issue report sent to the principal (from teacher or student). */
export type ReportIssue = {
  id: string;
  collegeId: string;
  senderId: string;
  senderName: string;
  senderType: 'teacher' | 'student';
  title: string;
  content: string;
  status: 'open' | 'acknowledged' | 'resolved';
  createdAt: string;
};

/** Direct message between teacher and teacher/student/parent (Communication tabs). */
export type DirectMessage = {
  id: string;
  collegeId: string;
  fromId: string;
  fromName: string;
  fromType: 'teacher' | 'student' | 'parent';
  toId: string;
  toName: string;
  toType: 'teacher' | 'student' | 'parent';
  content: string;
  createdAt: string;
  read: boolean;
  attachmentUrl?: string;
  attachmentName?: string;
  deleted?: boolean;
  deletedForIds?: string[];
};

export interface OMRExam {
  id: string;
  testName: string;
  subjects: { name: string; questionCount: number }[];
  options: string[];
  rollNumberLength: number;
  keyAnswers: Record<string, Record<string, string>>; // Subject -> QuestionNum -> Option
  correctMarks: number;
  negativeMarks: number;
  teacherId: string;
  collegeId: string;
  createdAt: string;
}

export interface OMRStudentResult {
  id: string;
  examId: string;
  rollNumber: string;
  studentName?: string;
  studentClass?: string;
  studentSection?: string;
  answers: Record<string, Record<string, string>>; // Subject -> QuestionNum -> Option
  score: number;
  correctCount: number;
  incorrectCount: number;
  unattemptedCount: number;
  maxScore: number;
  evaluatedAt: string;
  scannedImage?: string; // Base64 or storage URL of the page image
}

