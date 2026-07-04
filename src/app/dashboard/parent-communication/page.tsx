'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  PhoneOutgoing,
  Send,
  MessageSquare,
  FileText,
  ShieldAlert,
  Camera,
  Paperclip,
  MoreVertical,
  Trash2,
  ArrowLeft,
} from 'lucide-react';
import Image from 'next/image';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import React, { useEffect, useState, useRef } from 'react';
import { collection, onSnapshot, addDoc, query, where, getDocs, doc, updateDoc, writeBatch, arrayUnion } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { useCurrentTeacher, useCurrentPrincipal } from '@/hooks/use-current-user';
import { useToast } from '@/hooks/use-toast';
import type { Parent, Student, Teacher, Class, LeaveRequest, PrincipalMessage, DirectMessage, ReportIssue } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { playNotificationSound } from '@/lib/notification-sound';
import { EmojiPicker } from '@/components/emoji-picker';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DELETED_MESSAGE_TEXT } from '@/lib/chat-constants';

type DirectConversation = { id: string; name: string; type: 'teacher' | 'student' | 'parent' };

export default function CommunicationPage() {
  const principal = useCurrentPrincipal();
  const teacher = useCurrentTeacher();
  const [searchQuery, setSearchQuery] = useState('');
  // College Admin chat states
  const [collegeAdmins, setCollegeAdmins] = useState<{ id: string; name: string; email: string }[]>([]);
  const [adminMessages, setAdminMessages] = useState<any[]>([]);
  const [selectedAdmin, setSelectedAdmin] = useState<{ id: string; name: string; email: string } | null>(null);
  const [adminChatInput, setAdminChatInput] = useState('');
  const [sendingAdminMsg, setSendingAdminMsg] = useState(false);
  const [parents, setParents] = useState<Parent[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [allTeachers, setAllTeachers] = useState<Teacher[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [assignedClassIds, setAssignedClassIds] = useState<string[]>([]);
  const [leaveSubject, setLeaveSubject] = useState('');
  const [leaveStartDate, setLeaveStartDate] = useState('');
  const [leaveEndDate, setLeaveEndDate] = useState('');
  const [leaveReason, setLeaveReason] = useState('');
  const [leaveSubmitting, setLeaveSubmitting] = useState(false);
  const [issueTitle, setIssueTitle] = useState('');
  const [issueContent, setIssueContent] = useState('');
  const [issueSubmitting, setIssueSubmitting] = useState(false);
  const [issueDialogOpen, setIssueDialogOpen] = useState(false);
  const [myLeaveRequests, setMyLeaveRequests] = useState<LeaveRequest[]>([]);
  const [myReportIssues, setMyReportIssues] = useState<ReportIssue[]>([]);

  useEffect(() => {
    if (!teacher?.collegeId) {
      setParents([]);
      setStudents([]);
      setAllTeachers([]);
      setClasses([]);
      setAssignedClassIds([]);
      setCollegeAdmins([]);
      setAdminMessages([]);
      return;
    }
    const unsubP = onSnapshot(
      query(collection(db, 'parents'), where('collegeId', '==', teacher.collegeId)),
      (snap) => setParents(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Parent)))
    );
    const unsubS = onSnapshot(
      query(collection(db, 'students'), where('collegeId', '==', teacher.collegeId)),
      (snap) => setStudents(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Student)))
    );
    const unsubT = onSnapshot(
      query(collection(db, 'teachers'), where('collegeId', '==', teacher.collegeId)),
      (snap) => setAllTeachers(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Teacher)))
    );
    const unsubC = onSnapshot(
      query(collection(db, 'classes'), where('collegeId', '==', teacher.collegeId)),
      (snap) => setClasses(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Class)))
    );
    const unsubAdmins = onSnapshot(
      query(collection(db, 'college_admins'), where('collegeId', '==', teacher.collegeId)),
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          name: d.data().name || 'College Admin',
          email: d.data().email || '',
        }));
        setCollegeAdmins(list);
        if (list.length > 0 && !selectedAdmin) {
          setSelectedAdmin(list[0]);
        }
      }
    );
    const unsubAdminMsgs = onSnapshot(
      query(collection(db, 'adminMessages'), where('collegeId', '==', teacher.collegeId)),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as any));
        list.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
        setAdminMessages(list);
      }
    );
    return () => { 
      unsubP(); 
      unsubS(); 
      unsubT(); 
      unsubC(); 
      unsubAdmins();
      unsubAdminMsgs();
    };
  }, [teacher?.collegeId]);

  // Load classes explicitly assigned to this teacher (used for student broadcasts).
  useEffect(() => {
    if (!teacher?.id) {
      setAssignedClassIds([]);
      return;
    }
    const unsub = onSnapshot(
      collection(db, 'teachers', teacher.id, 'assignedClasses'),
      (snap) => {
        setAssignedClassIds(snap.docs.map((d) => d.id));
      }
    );
    return () => unsub();
  }, [teacher?.id]);

  useEffect(() => {
    if (!teacher?.id || !teacher?.collegeId) {
      setMyLeaveRequests([]);
      return;
    }
    const q = query(collection(db, 'leaveRequests'), where('collegeId', '==', teacher.collegeId));
    const unsub = onSnapshot(q, (snap) => {
      const all = snap.docs.map((d) => ({ id: d.id, ...d.data() } as LeaveRequest));
      const mine = all.filter((r) => r.senderId === teacher.id);
      mine.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      setMyLeaveRequests(mine);
    });
    return () => unsub();
  }, [teacher?.id, teacher?.collegeId]);

  useEffect(() => {
    if (!teacher?.id || !teacher?.collegeId) {
      setMyReportIssues([]);
      return;
    }
    const q = query(collection(db, 'reportIssues'), where('collegeId', '==', teacher.collegeId));
    const unsub = onSnapshot(q, (snap) => {
      const all = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ReportIssue));
      const mine = all.filter((r) => r.senderId === teacher.id);
      mine.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      setMyReportIssues(mine);
    });
    return () => unsub();
  }, [teacher?.id, teacher?.collegeId]);

  const principalImage = PlaceHolderImages.find(
    (p) => p.id === 'principal-profile'
  );
  const { toast } = useToast();

  const [principalMessages, setPrincipalMessages] = useState<PrincipalMessage[]>([]);
  const [collegePrincipalId, setCollegePrincipalId] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState<File | null>(null);
  const [cameraDialogOpen, setCameraDialogOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const principalChatTextareaRef = useRef<HTMLTextAreaElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!teacher?.collegeId) {
      setPrincipalMessages([]);
      setCollegePrincipalId(null);
      return;
    }
    const q = query(collection(db, 'principalMessages'), where('collegeId', '==', teacher.collegeId));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as PrincipalMessage));
      list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      setPrincipalMessages(list);
    });
    return () => unsub();
  }, [teacher?.collegeId]);

  useEffect(() => {
    if (!teacher?.collegeId) return;
    const q = query(collection(db, 'principals'), where('collegeId', '==', teacher.collegeId));
    getDocs(q).then((snap) => {
      const first = snap.docs[0];
      setCollegePrincipalId(first ? first.id : null);
    });
  }, [teacher?.collegeId]);

  const threadWithPrincipal = React.useMemo(() => {
    const principalId = collegePrincipalId ?? principal?.id;
    if (!teacher?.id || !principalId) return [];
    return principalMessages
      .filter(
        (m) =>
          ((m.fromId === teacher.id && !m.toId) ||
            (m.fromId === principalId && m.toId === teacher.id)) &&
          !(m.deletedForIds ?? []).includes(teacher.id)
      )
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }, [principalMessages, teacher?.id, collegePrincipalId, principal?.id]);

  const handleDeletePrincipalMessageForMe = async (msg: PrincipalMessage) => {
    if (!teacher?.id) return;
    try {
      await updateDoc(doc(db, 'principalMessages', msg.id), {
        deletedForIds: arrayUnion(teacher.id),
      });
      toast({ title: 'Message deleted for you' });
    } catch {
      toast({ variant: 'destructive', title: 'Could not delete message' });
    }
  };

  const handleDeletePrincipalMessageForEveryone = async (msg: PrincipalMessage) => {
    if (!teacher?.id || msg.fromId !== teacher.id) return;
    try {
      await updateDoc(doc(db, 'principalMessages', msg.id), {
        content: DELETED_MESSAGE_TEXT,
        deleted: true,
      });
      toast({ title: 'Message deleted for everyone' });
    } catch {
      toast({ variant: 'destructive', title: 'Could not delete message' });
    }
  };

  const unreadFromPrincipal = React.useMemo(() => {
    if (!teacher?.id) return 0;
    return principalMessages.filter((m) => m.toId === teacher.id && !m.read).length;
  }, [principalMessages, teacher?.id]);

  useEffect(() => {
    chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [threadWithPrincipal]);

  const handleSendMessageToPrincipalChat = async () => {
    if (!teacher?.id || !teacher?.collegeId) {
      toast({ variant: 'destructive', title: 'Error', description: 'Your profile is not loaded. Please refresh the page.' });
      return;
    }
    const content = chatInput.trim();
    const fileToSend = pendingAttachment;
    if (!content && !fileToSend) {
      toast({ variant: 'destructive', title: 'Error', description: 'Enter a message or attach a file.' });
      return;
    }
    setChatSending(true);
    let attachmentUrl: string | undefined;
    let attachmentName: string | undefined;
    try {
      if (fileToSend) {
        try {
          const path = `principal-messages/${Date.now()}_${fileToSend.name}`;
          const storageRef = ref(storage, path);
          await uploadBytes(storageRef, fileToSend);
          attachmentUrl = await getDownloadURL(storageRef);
          attachmentName = fileToSend.name;
        } catch (uploadErr) {
          console.error('Upload failed:', uploadErr);
          toast({
            variant: 'destructive',
            title: 'File could not be uploaded',
            description: 'Message will be sent without the file. Enable Storage CORS and deploy storage.rules.',
          });
          attachmentName = undefined;
          attachmentUrl = undefined;
        }
      }
      const messageContent =
        content ||
        (attachmentName ? `[Attachment: ${attachmentName}]` : '') ||
        (fileToSend ? `[File "${fileToSend.name}" could not be uploaded]` : '');
      await addDoc(collection(db, 'principalMessages'), {
        collegeId: teacher.collegeId,
        fromId: teacher.id,
        fromName: teacher.name,
        fromType: 'teacher',
        content: messageContent,
        createdAt: new Date().toISOString(),
        read: false,
        ...(attachmentUrl && { attachmentUrl }),
        ...(attachmentName && { attachmentName }),
      });
      const principalIdToNotify = collegePrincipalId ?? principal?.id;
      if (principalIdToNotify) {
        await addDoc(collection(db, 'notifications'), {
          collegeId: teacher.collegeId,
          recipientId: principalIdToNotify,
          type: 'message',
          sender: { name: teacher.name ?? 'Teacher', role: 'teacher' },
          title: `New message from ${teacher.name ?? 'Teacher'}`,
          content: (messageContent.slice(0, 120) || 'Attachment') + (messageContent.length > 120 ? '…' : ''),
          date: new Date().toISOString(),
          read: false,
        });

      }
      setChatInput('');
      setPendingAttachment(null);
      toast({ title: 'Message sent' });
    } catch (err) {
      console.error('Send message failed:', err);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to send message.' });
    } finally {
      setChatSending(false);
    }
  };

  const handlePrincipalChatFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setPendingAttachment(file);
    e.target.value = '';
  };

  const handleSendAdminMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacher?.id || !selectedAdmin || !adminChatInput.trim()) return;
    setSendingAdminMsg(true);
    try {
      await addDoc(collection(db, 'adminMessages'), {
        collegeId: teacher.collegeId,
        fromId: teacher.id,
        fromName: teacher.name || 'Teacher',
        fromType: 'teacher',
        toId: selectedAdmin.id,
        toName: selectedAdmin.name,
        toType: 'college-admin',
        content: adminChatInput.trim(),
        createdAt: new Date().toISOString(),
        read: false,
      });
      setAdminChatInput('');
    } catch (err) {
      console.error('Failed to send admin message:', err);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to send message.' });
    } finally {
      setSendingAdminMsg(false);
    }
  };

  useEffect(() => {
    if (!cameraDialogOpen) return;
    setCameraError(null);
    let stream: MediaStream | null = null;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user' } })
      .then((s) => {
        stream = s;
        streamRef.current = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
        }
      })
      .catch((err) => {
        setCameraError(err?.message ?? 'Webcam access failed. Allow camera or use Attach to choose a file.');
      });
    return () => {
      stream?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [cameraDialogOpen]);

  const handleCapturePhoto = () => {
    const video = videoRef.current;
    if (!video || !streamRef.current || video.readyState !== 4) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `capture-${Date.now()}.png`, { type: 'image/png' });
        if (cameraForDirect) {
          setPendingDirectAttachment(file);
          setCameraForDirect(false);
        } else {
          setPendingAttachment(file);
        }
        setCameraDialogOpen(false);
        toast({ title: 'Photo captured' });
      },
      'image/png',
      0.9
    );
  };

  function formatDateTime(iso: string) {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
  }

  const [selectedDirectConversation, setSelectedDirectConversation] = useState<DirectConversation | null>(null);
  const [directChatInput, setDirectChatInput] = useState('');
  const [directChatSending, setDirectChatSending] = useState(false);
  const [pendingDirectAttachment, setPendingDirectAttachment] = useState<File | null>(null);
  const [cameraForDirect, setCameraForDirect] = useState(false);
  const directChatScrollRef = useRef<HTMLDivElement>(null);
  const directChatTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Common message to students (broadcast)
  const [studentsBroadcastMessage, setStudentsBroadcastMessage] = useState('');
  const [studentsBroadcastSending, setStudentsBroadcastSending] = useState(false);
  const [pendingStudentsBroadcastAttachment, setPendingStudentsBroadcastAttachment] = useState<File | null>(null);
  const studentsBroadcastTextareaRef = useRef<HTMLTextAreaElement>(null);

  const [directMessagesFrom, setDirectMessagesFrom] = useState<DirectMessage[]>([]);
  const [directMessagesTo, setDirectMessagesTo] = useState<DirectMessage[]>([]);

  useEffect(() => {
    if (!teacher?.id) {
      setDirectMessagesFrom([]);
      setDirectMessagesTo([]);
      return;
    }
    const qFrom = query(collection(db, 'directMessages'), where('fromId', '==', teacher.id));
    const qTo = query(collection(db, 'directMessages'), where('toId', '==', teacher.id));
    const unsubFrom = onSnapshot(qFrom, (snap) =>
      setDirectMessagesFrom(snap.docs.map((d) => ({ id: d.id, ...d.data() } as DirectMessage)))
    );
    const unsubTo = onSnapshot(qTo, (snap) =>
      setDirectMessagesTo(snap.docs.map((d) => ({ id: d.id, ...d.data() } as DirectMessage)))
    );
    return () => {
      unsubFrom();
      unsubTo();
    };
  }, [teacher?.id]);

  const directMessages = React.useMemo(() => {
    const byId = new Map<string, DirectMessage>();
    directMessagesFrom.forEach((m) => byId.set(m.id, m));
    directMessagesTo.forEach((m) => byId.set(m.id, m));
    return Array.from(byId.values()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }, [directMessagesFrom, directMessagesTo]);

  const unreadByFromId = React.useMemo(() => {
    const count: Record<string, number> = {};
    directMessagesTo.forEach((m) => {
      if (!m.read) count[m.fromId] = (count[m.fromId] ?? 0) + 1;
    });
    return count;
  }, [directMessagesTo]);

  const sortedParents = React.useMemo(() => {
    return parents.sort((a, b) => {
      const lastMsgA = directMessages
        .filter((m) => (m.fromId === a.id || m.toId === a.id) && teacher?.id && ((m.fromId === teacher.id && m.toId === a.id) || (m.toId === teacher.id && m.fromId === a.id)))
        .sort((x, y) => y.createdAt.localeCompare(x.createdAt))[0];
      const lastMsgB = directMessages
        .filter((m) => (m.fromId === b.id || m.toId === b.id) && teacher?.id && ((m.fromId === teacher.id && m.toId === b.id) || (m.toId === teacher.id && m.fromId === b.id)))
        .sort((x, y) => y.createdAt.localeCompare(x.createdAt))[0];
      // Sort by most recent first (descending), parents without messages go to the end
      return (lastMsgB?.createdAt || '').localeCompare(lastMsgA?.createdAt || '');
    });
  }, [parents, directMessages, teacher?.id]);

  const sortedStudents = React.useMemo(() => {
    return students.sort((a, b) => {
      const lastMsgA = directMessages
        .filter((m) => (m.fromId === a.id || m.toId === a.id) && teacher?.id && ((m.fromId === teacher.id && m.toId === a.id) || (m.toId === teacher.id && m.fromId === a.id)))
        .sort((x, y) => y.createdAt.localeCompare(x.createdAt))[0];
      const lastMsgB = directMessages
        .filter((m) => (m.fromId === b.id || m.toId === b.id) && teacher?.id && ((m.fromId === teacher.id && m.toId === b.id) || (m.toId === teacher.id && m.fromId === b.id)))
        .sort((x, y) => y.createdAt.localeCompare(x.createdAt))[0];
      // Sort by most recent first (descending), students without messages go to the end
      return (lastMsgB?.createdAt || '').localeCompare(lastMsgA?.createdAt || '');
    });
  }, [students, directMessages, teacher?.id]);

  const filteredParents = React.useMemo(() => {
    if (!searchQuery.trim()) return sortedParents;
    return sortedParents.filter((p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [sortedParents, searchQuery]);

  const filteredStudents = React.useMemo(() => {
    if (!searchQuery.trim()) return sortedStudents;
    return sortedStudents.filter((s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.usn?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
      (s.studentId?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
    );
  }, [sortedStudents, searchQuery]);

  const markDirectThreadRead = async (fromId: string) => {
    if (!teacher?.id) return;
    const toMark = directMessagesTo.filter((m) => m.fromId === fromId && !m.read);
    if (toMark.length === 0) return;
    try {
      const batch = writeBatch(db);
      toMark.forEach((m) => batch.update(doc(db, 'directMessages', m.id), { read: true }));
      await batch.commit();
    } catch {
      // ignore
    }
  };

  const prevIncomingCountRef = useRef<number | null>(null);
  useEffect(() => {
    const incomingCount = directMessagesTo.length;
    if (prevIncomingCountRef.current !== null && incomingCount > prevIncomingCountRef.current) {
      playNotificationSound();
    }
    prevIncomingCountRef.current = incomingCount;
  }, [directMessagesTo.length]);

  const threadDirect = React.useMemo(() => {
    if (!teacher?.id || !selectedDirectConversation) return [];
    return directMessages
      .filter(
        (m) =>
          ((m.fromId === teacher.id && m.toId === selectedDirectConversation.id) ||
            (m.fromId === selectedDirectConversation.id && m.toId === teacher.id)) &&
          !(m.deletedForIds ?? []).includes(teacher.id)
      )
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }, [directMessages, teacher?.id, selectedDirectConversation]);

  const handleDeleteDirectMessageForMe = async (msg: DirectMessage) => {
    if (!teacher?.id) return;
    try {
      await updateDoc(doc(db, 'directMessages', msg.id), {
        deletedForIds: arrayUnion(teacher.id),
      });
      toast({ title: 'Message deleted for you' });
    } catch {
      toast({ variant: 'destructive', title: 'Could not delete message' });
    }
  };

  const handleDeleteDirectMessageForEveryone = async (msg: DirectMessage) => {
    if (!teacher?.id || msg.fromId !== teacher.id) return;
    try {
      await updateDoc(doc(db, 'directMessages', msg.id), {
        content: DELETED_MESSAGE_TEXT,
        deleted: true,
      });
      toast({ title: 'Message deleted for everyone' });
    } catch {
      toast({ variant: 'destructive', title: 'Could not delete message' });
    }
  };

  useEffect(() => {
    directChatScrollRef.current?.scrollTo({ top: directChatScrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [threadDirect]);

  const handleSendDirectMessage = async () => {
    if (!teacher || !selectedDirectConversation) return;
    const content = directChatInput.trim();
    const fileToSend = pendingDirectAttachment;
    if (!content && !fileToSend) {
      toast({ variant: 'destructive', title: 'Error', description: 'Enter a message or attach a file.' });
      return;
    }
    setDirectChatSending(true);
    let attachmentUrl: string | undefined;
    let attachmentName: string | undefined;
    try {
      if (fileToSend) {
        try {
          const path = `direct-messages/${Date.now()}_${fileToSend.name}`;
          const storageRef = ref(storage, path);
          await uploadBytes(storageRef, fileToSend);
          attachmentUrl = await getDownloadURL(storageRef);
          attachmentName = fileToSend.name;
        } catch (uploadErr) {
          console.error('Upload failed:', uploadErr);
          toast({
            variant: 'destructive',
            title: 'File could not be uploaded',
            description: 'Message will be sent without the file.',
          });
          attachmentName = undefined;
          attachmentUrl = undefined;
        }
      }
      const messageContent =
        content ||
        (attachmentName ? `[Attachment: ${attachmentName}]` : '') ||
        (fileToSend ? `[File "${fileToSend.name}" could not be uploaded]` : '');
      await addDoc(collection(db, 'directMessages'), {
        fromId: teacher.id,
        fromName: teacher.name,
        fromType: 'teacher',
        toId: selectedDirectConversation.id,
        toName: selectedDirectConversation.name,
        toType: selectedDirectConversation.type,
        content: messageContent,
        createdAt: new Date().toISOString(),
        read: false,
        ...(attachmentUrl && { attachmentUrl }),
        ...(attachmentName && { attachmentName }),
      });
      await addDoc(collection(db, 'notifications'), {
        collegeId: teacher.collegeId,
        recipientId: selectedDirectConversation.id,
        type: 'message',
        sender: { name: teacher.name ?? 'Teacher', role: 'teacher' },
        title: `New message from ${teacher.name ?? 'Teacher'}`,
        content: (messageContent.slice(0, 120) || 'Attachment') + (messageContent.length > 120 ? '…' : ''),
        date: new Date().toISOString(),
        read: false,
      });

      // Send WhatsApp notification
      const { sendNotificationViaWhatsApp } = await import('@/lib/whatsapp-notification');
      const userType = selectedDirectConversation.type === 'student' ? 'student' : selectedDirectConversation.type === 'parent' ? 'parent' : 'teacher';
      setDirectChatInput('');
      setPendingDirectAttachment(null);
      toast({ title: 'Message sent' });
    } catch (err) {
      console.error('Send direct message failed:', err);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to send message.' });
    } finally {
      setDirectChatSending(false);
    }
  };

  const handleDirectChatFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setPendingDirectAttachment(file);
    e.target.value = '';
  };

  const handleStudentsBroadcastFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setPendingStudentsBroadcastAttachment(file);
    e.target.value = '';
  };

  const handleSendStudentsBroadcast = async () => {
    if (!teacher?.id || !teacher.collegeId) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Your profile is not loaded. Please refresh the page.',
      });
      return;
    }

    const content = studentsBroadcastMessage.trim();
    const fileToSend = pendingStudentsBroadcastAttachment;

    if (!content && !fileToSend) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Enter a message or attach a file.',
      });
      return;
    }

    const studentsForBroadcast = students.filter((s) =>
      assignedClassIds.includes(s.classId)
    );

    if (studentsForBroadcast.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No students found',
        description: 'You do not have any students assigned to your classes.',
      });
      return;
    }

    setStudentsBroadcastSending(true);
    let attachmentUrl: string | undefined;
    let attachmentName: string | undefined;

    try {
      if (fileToSend) {
        try {
          const path = `direct-messages/broadcast/${Date.now()}_${fileToSend.name}`;
          const storageRef = ref(storage, path);
          await uploadBytes(storageRef, fileToSend);
          attachmentUrl = await getDownloadURL(storageRef);
          attachmentName = fileToSend.name;
        } catch (uploadErr) {
          console.error('Broadcast upload failed:', uploadErr);
          toast({
            variant: 'destructive',
            title: 'File could not be uploaded',
            description: 'Message will be sent without the file.',
          });
          attachmentName = undefined;
          attachmentUrl = undefined;
        }
      }

      const messageContent =
        content ||
        (attachmentName ? `[Attachment: ${attachmentName}]` : '') ||
        (fileToSend ? `[File "${fileToSend.name}" could not be uploaded]` : '');

      const createdAt = new Date().toISOString();

      await Promise.all(
        studentsForBroadcast.map(async (s) => {
          const dmRef = await addDoc(collection(db, 'directMessages'), {
            fromId: teacher.id,
            fromName: teacher.name,
            fromType: 'teacher',
            toId: s.id,
            toName: s.name,
            toType: 'student',
            content: messageContent,
            createdAt,
            read: false,
            collegeId: teacher.collegeId,
            ...(attachmentUrl && { attachmentUrl }),
            ...(attachmentName && { attachmentName }),
          });

          await addDoc(collection(db, 'notifications'), {
            collegeId: teacher.collegeId,
            recipientId: s.id,
            type: 'message',
            sender: { name: teacher.name ?? 'Teacher', role: 'teacher' },
            title: `New message from ${teacher.name ?? 'Teacher'}`,
            content:
              (messageContent.slice(0, 120) || 'Attachment') +
              (messageContent.length > 120 ? '…' : ''),
            date: createdAt,
            read: false,
            directMessageId: dmRef.id,
          });
        })
      );

      setStudentsBroadcastMessage('');
      setPendingStudentsBroadcastAttachment(null);
      toast({
        title: 'Message sent',
        description: `Sent to ${studentsForBroadcast.length} student${
          studentsForBroadcast.length === 1 ? '' : 's'
        }.`,
      });
    } catch (err) {
      console.error('Broadcast to students failed:', err);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to send message to students.',
      });
    } finally {
      setStudentsBroadcastSending(false);
    }
  };

  const handleSubmitLeaveRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacher || !leaveSubject.trim() || !leaveStartDate || !leaveEndDate || !leaveReason.trim()) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please fill all fields.' });
      return;
    }
    if (!teacher.collegeId || !teacher.id) {
      toast({ variant: 'destructive', title: 'Error', description: 'Your profile is missing college info. Please refresh or contact admin.' });
      return;
    }
    if (leaveStartDate > leaveEndDate) {
      toast({ variant: 'destructive', title: 'Error', description: 'End date must be after start date.' });
      return;
    }
    setLeaveSubmitting(true);
    try {
      await addDoc(collection(db, 'leaveRequests'), {
        collegeId: teacher.collegeId,
        senderId: teacher.id,
        senderName: teacher.name ?? 'Teacher',
        senderType: 'teacher',
        subject: leaveSubject.trim(),
        startDate: leaveStartDate,
        endDate: leaveEndDate,
        reason: leaveReason.trim(),
        status: 'pending',
        createdAt: new Date().toISOString(),
      });
      if (principal?.id) {
        await addDoc(collection(db, 'notifications'), {
          collegeId: teacher.collegeId,
          recipientId: principal.id,
          type: 'message',
          sender: { name: teacher.name ?? 'Teacher', role: 'teacher' },
          title: `New leave request from ${teacher.name ?? 'Teacher'}`,
          content: leaveSubject.trim(),
          date: new Date().toISOString(),
          read: false,
        });

        // Send WhatsApp notification
        const { sendNotificationViaWhatsApp } = await import('@/lib/whatsapp-notification');
        sendNotificationViaWhatsApp(
          principal.id,
          `New leave request from ${teacher.name ?? 'Teacher'}`,
          `Subject: ${leaveSubject.trim()}\nDates: ${leaveStartDate} to ${leaveEndDate}\nReason: ${leaveReason.trim()}`,
          'teacher'
        ).catch(err => console.error('WhatsApp notification failed:', err));
      }
      setLeaveSubject('');
      setLeaveStartDate('');
      setLeaveEndDate('');
      setLeaveReason('');
      toast({ title: 'Leave request submitted' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to submit leave request.';
      console.error('Leave request submit error:', err);
      toast({ variant: 'destructive', title: 'Error', description: message });
    } finally {
      setLeaveSubmitting(false);
    }
  };

  const handleReportIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacher || !issueTitle.trim() || !issueContent.trim()) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please fill title and content.' });
      return;
    }
    setIssueSubmitting(true);
    try {
      await addDoc(collection(db, 'reportIssues'), {
        collegeId: teacher.collegeId,
        senderId: teacher.id,
        senderName: teacher.name,
        senderType: 'teacher',
        title: issueTitle.trim(),
        content: issueContent.trim(),
        status: 'open',
        createdAt: new Date().toISOString(),
      });
      if (principal?.id) {
        await addDoc(collection(db, 'notifications'), {
          collegeId: teacher.collegeId,
          recipientId: principal.id,
          type: 'message',
          sender: { name: teacher.name, role: 'teacher' },
          title: `Issue reported by ${teacher.name}`,
          content: issueTitle.trim(),
          date: new Date().toISOString(),
          read: false,
        })
      }
      setIssueTitle('');
      setIssueContent('');
      setIssueDialogOpen(false);
      toast({ title: 'Issue reported' });
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to report issue.' });
    } finally {
      setIssueSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold font-headline tracking-tight sm:text-3xl">
          Communication
        </h1>
        <p className="text-muted-foreground">
          Reach out to staff, students, and parents.
        </p>
      </div>

      <Tabs defaultValue="principal" className="w-full">
        <TabsList className="w-full h-auto flex overflow-x-auto overflow-y-hidden gap-2 sm:grid sm:grid-cols-5 sm:gap-1 sm:overflow-visible">
          <TabsTrigger value="principal" className="relative justify-center min-w-0 shrink-0 whitespace-nowrap sm:w-full">
            Principal
            {unreadFromPrincipal > 0 && (
              <Badge variant="default" className="ml-2 h-5 min-w-5 px-1.5 text-xs">
                {unreadFromPrincipal > 99 ? '99+' : unreadFromPrincipal}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="teachers" className="relative justify-center min-w-0 shrink-0 whitespace-nowrap sm:w-full">
            Teachers
            {(allTeachers.filter((t) => t.id !== teacher?.id).reduce((sum, t) => sum + (unreadByFromId[t.id] ?? 0), 0) || 0) > 0 && (
              <Badge variant="default" className="ml-2 h-5 min-w-5 px-1.5 text-xs">
                {(() => {
                  const n = allTeachers.filter((t) => t.id !== teacher?.id).reduce((sum, t) => sum + (unreadByFromId[t.id] ?? 0), 0);
                  return n > 99 ? '99+' : n;
                })()}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="students" className="relative justify-center min-w-0 shrink-0 whitespace-nowrap sm:w-full">
            Students
            {(students.filter((s) => (unreadByFromId[s.id] ?? 0) > 0).length) > 0 && (
              <Badge variant="default" className="ml-2 h-5 min-w-5 px-1.5 text-xs">
                {students.filter((s) => (unreadByFromId[s.id] ?? 0) > 0).length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="parents" className="relative justify-center min-w-0 shrink-0 whitespace-nowrap sm:w-full">
            Parents
            {(parents.filter((p) => (unreadByFromId[p.id] ?? 0) > 0).length) > 0 && (
              <Badge variant="default" className="ml-2 h-5 min-w-5 px-1.5 text-xs">
                {parents.filter((p) => (unreadByFromId[p.id] ?? 0) > 0).length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="college-admin" className="relative justify-center min-w-0 shrink-0 whitespace-nowrap sm:w-full">
            College Admin
          </TabsTrigger>
        </TabsList>
        <TabsContent value="principal">
          <Card>
            <CardHeader>
              <CardTitle>Contact the Principal</CardTitle>
              <CardDescription>
                Send requests or report issues directly to Mr. Thompson.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-3">
              <Dialog>
                <DialogTrigger asChild>
                  <Card className="cursor-pointer hover:shadow-lg transition-shadow">
                    <CardHeader className="items-center text-center">
                      <FileText className="h-8 w-8 text-primary" />
                      <CardTitle className="text-lg mt-2">
                        Send Leave Request
                      </CardTitle>
                    </CardHeader>
                  </Card>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <form onSubmit={handleSubmitLeaveRequest}>
                    <DialogHeader>
                      <DialogTitle>Leave Request</DialogTitle>
                      <DialogDescription>
                        Fill out the form to request leave. The principal will review it.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="leave-subject">Subject</Label>
                        <Input
                          id="leave-subject"
                          placeholder="e.g., Family event"
                          value={leaveSubject}
                          onChange={(e) => setLeaveSubject(e.target.value)}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="start-date">Start Date</Label>
                          <Input
                            id="start-date"
                            type="date"
                            value={leaveStartDate}
                            onChange={(e) => setLeaveStartDate(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="end-date">End Date</Label>
                          <Input
                            id="end-date"
                            type="date"
                            value={leaveEndDate}
                            onChange={(e) => setLeaveEndDate(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="reason">Reason</Label>
                        <Textarea
                          id="reason"
                          placeholder="Please provide a brief reason for your leave."
                          value={leaveReason}
                          onChange={(e) => setLeaveReason(e.target.value)}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="submit" disabled={leaveSubmitting}>
                        {leaveSubmitting ? 'Submitting…' : 'Submit Request'}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
              {/* Chat with Principal - WhatsApp-style: fixed viewport, messages scroll inside */}
              <Card className="md:col-span-2 flex flex-col min-h-[320px] max-h-[75vh]">
                <CardHeader className="shrink-0 flex-row items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback>{principal?.name?.charAt(0) ?? 'P'}</AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-lg">Chat with Principal</CardTitle>
                    <CardDescription>One-to-one chat. Your messages appear in the principal&apos;s Communication → Messages.</CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col flex-1 min-h-0 gap-4 pt-0 overflow-hidden">
                  <div
                    ref={chatScrollRef}
                    className="min-h-[180px] max-h-[50vh] overflow-y-auto overflow-x-hidden space-y-4 rounded-lg border bg-muted/20 p-4 overscroll-behavior-contain"
                  >
                    {threadWithPrincipal.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">No messages yet. Type below to start the conversation.</p>
                    ) : (
                      threadWithPrincipal.map((msg) => {
                        const isMe = msg.fromType === 'teacher' && msg.fromId === teacher?.id;
                        const isDeleted = msg.deleted || msg.content === DELETED_MESSAGE_TEXT;
                        return (
                          <div
                            key={msg.id}
                            className={cn(
                              'flex items-end gap-2 group',
                              isMe ? 'justify-end' : 'justify-start'
                            )}
                          >
                            <div
                              className={cn(
                                'max-w-[85%] rounded-lg p-3 text-sm relative',
                                isMe ? 'bg-primary text-primary-foreground' : 'bg-background border'
                              )}
                            >
                              {isMe && !isDeleted && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button type="button" variant="ghost" size="icon" className="absolute top-1 right-1 h-7 w-7 opacity-0 group-hover:opacity-100 text-primary-foreground/80 hover:text-primary-foreground">
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => handleDeletePrincipalMessageForMe(msg)}>
                                      <Trash2 className="h-4 w-4 mr-2" /> Delete for me
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleDeletePrincipalMessageForEveryone(msg)}>
                                      <Trash2 className="h-4 w-4 mr-2" /> Delete for everyone
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                              {!isMe && !isDeleted && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button type="button" variant="ghost" size="icon" className="absolute top-1 right-1 h-7 w-7 opacity-0 group-hover:opacity-100">
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => handleDeletePrincipalMessageForMe(msg)}>
                                      <Trash2 className="h-4 w-4 mr-2" /> Delete for me
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                              <p className={cn('whitespace-pre-wrap', isDeleted && 'italic text-muted-foreground')}>
                                {isDeleted ? DELETED_MESSAGE_TEXT : msg.content}
                              </p>
                              {!isDeleted && msg.attachmentUrl && (
                                <a
                                  href={msg.attachmentUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={cn(
                                    'text-xs underline mt-1 block',
                                    isMe ? 'text-primary-foreground/80' : 'text-muted-foreground'
                                  )}
                                >
                                  {msg.attachmentName ?? 'Attachment'}
                                </a>
                              )}
                              <p
                                className={cn(
                                  'text-xs mt-1',
                                  isMe ? 'text-primary-foreground/70 text-right' : 'text-muted-foreground'
                                )}
                              >
                                {formatDateTime(msg.createdAt)}
                              </p>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                  <div className="space-y-2 shrink-0">
                    {pendingAttachment && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Paperclip className="h-4 w-4 shrink-0" />
                        <span className="truncate flex-1">Attached: {pendingAttachment.name}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => setPendingAttachment(null)}
                        >
                          Remove
                        </Button>
                      </div>
                    )}
                    <div className="flex items-end gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 shrink-0"
                        title="Take photo"
                        onClick={() => {
                          setCameraForDirect(false);
                          setCameraDialogOpen(true);
                        }}
                      >
                        <Camera className="h-5 w-5 text-muted-foreground" />
                      </Button>
                      <input
                        id="teacher-principal-chat-attach"
                        type="file"
                        className="sr-only"
                        aria-label="Attach file"
                        onChange={handlePrincipalChatFileSelect}
                      />
                      <label
                        htmlFor="teacher-principal-chat-attach"
                        className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-10 w-10 shrink-0 cursor-pointer"
                        title="Attach file"
                      >
                        <Paperclip className="h-5 w-5 text-muted-foreground" />
                      </label>
                      <EmojiPicker
                        value={chatInput}
                        onChange={setChatInput}
                        textareaRef={principalChatTextareaRef}
                        insertAtCursor
                      />
                      <Textarea
                        ref={principalChatTextareaRef}
                        placeholder="Type your message..."
                        className="flex-1 min-h-[40px] max-h-24 resize-none"
                        rows={1}
                        inputMode="text"
                        autoComplete="off"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessageToPrincipalChat();
                          }
                        }}
                      />
                      <Button
                        type="button"
                        size="icon"
                        onClick={handleSendMessageToPrincipalChat}
                        disabled={chatSending}
                        title="Send"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Dialog open={issueDialogOpen} onOpenChange={setIssueDialogOpen}>
                <DialogTrigger asChild>
                  <Card className="cursor-pointer hover:shadow-lg transition-shadow">
                    <CardHeader className="items-center text-center">
                      <ShieldAlert className="h-8 w-8 text-destructive" />
                      <CardTitle className="text-lg mt-2 text-destructive">
                        Report an Issue
                      </CardTitle>
                    </CardHeader>
                  </Card>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <form onSubmit={handleReportIssue}>
                    <DialogHeader>
                      <DialogTitle>Report an Issue</DialogTitle>
                      <DialogDescription>
                        Report will be received by the principal in Communication.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="issue-title">Title</Label>
                        <Input
                          id="issue-title"
                          placeholder="Brief title for the issue"
                          value={issueTitle}
                          onChange={(e) => setIssueTitle(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="issue-content">Details</Label>
                        <Textarea
                          id="issue-content"
                          placeholder="Describe the issue..."
                          rows={4}
                          value={issueContent}
                          onChange={(e) => setIssueContent(e.target.value)}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setIssueDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={issueSubmitting}>
                        {issueSubmitting ? 'Submitting…' : 'Submit'}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </CardContent>
            {teacher && (
              <CardContent className="border-t pt-6">
                <CardTitle className="text-lg mb-3">My Leave Requests</CardTitle>
                <CardDescription className="mb-4">
                  Status of your submitted leave requests.
                </CardDescription>
                {myLeaveRequests.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No leave requests yet.</p>
                ) : (
                  <div className="rounded-md border overflow-x-auto">
                    <Table className="min-w-[320px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Subject</TableHead>
                          <TableHead>Start – End</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {myLeaveRequests.map((req) => (
                          <TableRow key={req.id}>
                            <TableCell className="font-medium">{req.subject}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {new Date(req.startDate).toLocaleDateString()} – {new Date(req.endDate).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  req.status === 'approved'
                                    ? 'default'
                                    : req.status === 'rejected'
                                    ? 'destructive'
                                    : 'secondary'
                                }
                              >
                                {req.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            )}
            {teacher && (
              <CardContent className="border-t pt-6">
                <CardTitle className="text-lg mb-3">My Report Issues</CardTitle>
                <CardDescription className="mb-4">
                  Status of issues you have reported to the principal.
                </CardDescription>
                {myReportIssues.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No report issues yet.</p>
                ) : (
                  <div className="rounded-md border overflow-x-auto">
                    <Table className="min-w-[320px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Title</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {myReportIssues.map((issue) => (
                          <TableRow key={issue.id}>
                            <TableCell className="font-medium">{issue.title}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {issue.createdAt ? new Date(issue.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' }) : '—'}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  issue.status === 'resolved'
                                    ? 'default'
                                    : issue.status === 'acknowledged'
                                    ? 'secondary'
                                    : 'outline'
                                }
                              >
                                {issue.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        </TabsContent>
        <TabsContent value="teachers">
          <Card>
            <CardHeader>
              <CardTitle>Contact Teachers</CardTitle>
              <CardDescription>
                Select a teacher to start a conversation.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {allTeachers.filter((t) => t.id !== teacher?.id).map((t) => {
                const teacherImage = PlaceHolderImages.find(
                  (p) =>
                    p.id === t.id || p.id === `${t.id}-profile` || (t.id === 'teacher-01' && p.id === 'teacher-profile')
                );
                const unread = unreadByFromId[t.id] ?? 0;
                return (
                  <div
                    key={t.id}
                    className={cn(
                      'flex items-center justify-between rounded-lg border p-3',
                      unread > 0 && 'border-primary/30 bg-primary/5'
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <Avatar className="relative">
                        <AvatarImage src={teacherImage?.imageUrl} />
                        <AvatarFallback>
                          {t.name.charAt(0)}
                        </AvatarFallback>
                        {unread > 0 && (
                          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                            {unread > 99 ? '99+' : unread}
                          </span>
                        )}
                      </Avatar>
                      <div>
                        <p className={cn('font-semibold', unread > 0 && 'text-primary')}>
                          {t.name}
                          {unread > 0 && (
                            <span className="ml-2 inline-flex h-2 w-2 rounded-full bg-primary" aria-label={`${unread} unread`} />
                          )}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {t.subjectSpecialty}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSelectedDirectConversation({ id: t.id, name: t.name, type: 'teacher' });
                        markDirectThreadRead(t.id);
                      }}
                    >
                      <MessageSquare className="mr-2 h-4 w-4" /> Chat
                      {unread > 0 && (
                        <Badge variant="default" className="ml-2 h-5 min-w-5 px-1.5 text-xs">
                          {unread > 99 ? '99+' : unread}
                        </Badge>
                      )}
                    </Button>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="students">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Common message to students</CardTitle>
                <CardDescription>
                  Send a common message to all students in your assigned classes. They will receive it in their Messages tab.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {pendingStudentsBroadcastAttachment && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground min-w-0">
                    <Paperclip className="h-4 w-4 shrink-0" />
                    <span className="truncate flex-1 min-w-0">
                      Attached: {pendingStudentsBroadcastAttachment.name}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs shrink-0"
                      onClick={() => setPendingStudentsBroadcastAttachment(null)}
                    >
                      Remove
                    </Button>
                  </div>
                )}
                <div className="flex items-end gap-2 min-w-0 w-full">
                  <input
                    id="students-broadcast-attach"
                    type="file"
                    className="sr-only"
                    aria-label="Attach file"
                    onChange={handleStudentsBroadcastFileSelect}
                  />
                  <label
                    htmlFor="students-broadcast-attach"
                    className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-10 w-10 shrink-0 cursor-pointer"
                    title="Attach file"
                  >
                    <Paperclip className="h-5 w-5 text-muted-foreground" />
                  </label>
                  <EmojiPicker
                    value={studentsBroadcastMessage}
                    onChange={setStudentsBroadcastMessage}
                    textareaRef={studentsBroadcastTextareaRef}
                    insertAtCursor
                  />
                  <Textarea
                    ref={studentsBroadcastTextareaRef}
                    placeholder="Type your message to students..."
                    className="flex-1 min-h-[40px] min-w-0 w-0 basis-0 max-h-24 resize-none"
                    rows={2}
                    inputMode="text"
                    autoComplete="off"
                    value={studentsBroadcastMessage}
                    onChange={(e) => setStudentsBroadcastMessage(e.target.value)}
                  />
                  <Button
                    type="button"
                    size="icon"
                    onClick={handleSendStudentsBroadcast}
                    disabled={studentsBroadcastSending}
                    title="Send to students"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Contact Students</CardTitle>
                <CardDescription>
                  Select a student to start a one-to-one conversation.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 max-h-[60vh] overflow-y-auto">
                <input
                  type="text"
                  placeholder="Search students..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg bg-background text-sm"
                />
                {sortedStudents.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No students available.</p>
                ) : filteredStudents.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No students match your search.</p>
                ) : (
                  <>
                    {filteredStudents.map((student) => {
                        const studentImage = PlaceHolderImages.find(
                          (p) => p.id === student.id
                        );
                        const studentClass = classes.find(
                          (c) => c.id === student.classId
                        );
                    const unread = unreadByFromId[student.id] ?? 0;
                    return (
                      <div
                        key={student.id}
                        className={cn(
                          'flex items-center justify-between rounded-lg border p-3',
                          unread > 0 && 'border-primary/30 bg-primary/5'
                        )}
                      >
                        <div className="flex items-center gap-4">
                          <Avatar className="relative">
                            <AvatarImage src={studentImage?.imageUrl} />
                            <AvatarFallback>
                              {student.name.charAt(0)}
                            </AvatarFallback>
                            {unread > 0 && (
                              <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                                {unread > 99 ? '99+' : unread}
                              </span>
                            )}
                          </Avatar>
                          <div>
                            <p
                              className={cn(
                                'font-semibold',
                                unread > 0 && 'text-primary'
                              )}
                            >
                              {student.name}
                              {unread > 0 && (
                                <span
                                  className="ml-2 inline-flex h-2 w-2 rounded-full bg-primary"
                                  aria-label={`${unread} unread`}
                                />
                              )}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {(student.usn || student.studentId) &&
                              studentClass?.name
                                ? `${student.usn || student.studentId} • ${
                                    studentClass.name
                                  }`
                                : studentClass?.name}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setSelectedDirectConversation({
                              id: student.id,
                              name: student.name,
                              type: 'student',
                            });
                            markDirectThreadRead(student.id);
                          }}
                        >
                          <MessageSquare className="mr-2 h-4 w-4" /> Chat
                          {unread > 0 && (
                            <Badge
                              variant="default"
                              className="ml-2 h-5 min-w-5 px-1.5 text-xs"
                            >
                              {unread > 99 ? '99+' : unread}
                            </Badge>
                          )}
                        </Button>
                      </div>
                    );
                  })}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        <TabsContent value="parents">
          <Card>
            <CardHeader>
              <CardTitle>Contact Parents</CardTitle>
              <CardDescription>
                Contact parents regarding their child's progress.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="Search parents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg bg-background text-sm"
                />
                {sortedParents.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No parents available.</p>
                ) : filteredParents.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No parents match your search.</p>
                ) : (
                  <div className="border rounded-lg overflow-hidden overflow-x-auto">
                    <Table className="min-w-[600px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Student</TableHead>
                          <TableHead>Parent Name</TableHead>
                          <TableHead>Relationship</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredParents.map((parent) => {
                          const student = students.find(
                            (s) => s.id === parent.studentId
                          );
                          if (!student) return null;
                      const studentImage = PlaceHolderImages.find(
                        (p) => p.id === student.id
                      );
                      const unread = unreadByFromId[parent.id] ?? 0;

                      return (
                        <TableRow key={parent.id} className={unread > 0 ? 'bg-primary/5' : undefined}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-3">
                              {studentImage && (
                                <Image
                                  src={studentImage.imageUrl}
                                  alt={student.name}
                                  width={32}
                                  height={32}
                                  className="rounded-full"
                                />
                              )}
                              <span className={cn(unread > 0 && 'font-semibold text-primary')}>{student.name}</span>
                              {unread > 0 && (
                                <Badge variant="default" className="h-5 min-w-5 px-1.5 text-xs">
                                  {unread > 99 ? '99+' : unread}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{parent.name}</TableCell>
                          <TableCell>{parent.relationship}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedDirectConversation({ id: parent.id, name: parent.name, type: 'parent' });
                                markDirectThreadRead(parent.id);
                              }}
                            >
                              <MessageSquare className="mr-2 h-4 w-4" /> Chat
                              {unread > 0 && (
                                <Badge variant="default" className="ml-1.5 h-5 min-w-5 px-1.5 text-xs">
                                  {unread > 99 ? '99+' : unread}
                                </Badge>
                              )}
                            </Button>
                            <a
                              href={`https://wa.me/${parent.phone.replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="ml-2 inline-block"
                            >
                              <Button variant="ghost" size="sm">
                                <PhoneOutgoing className="mr-2 h-4 w-4" /> WhatsApp
                              </Button>
                            </a>
                          </TableCell>
                        </TableRow>
                      );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="college-admin" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>College Admin Chat</CardTitle>
              <CardDescription>
                Live conversation channel with the College / School Administrator.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {collegeAdmins.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No college admin registered for this college yet.</p>
              ) : (
                <div className="flex gap-4 h-[500px]">
                  {/* Admins list on left */}
                  <div className="w-1/3 border-r pr-4 overflow-y-auto space-y-2">
                    {collegeAdmins.map((adm) => (
                      <div
                        key={adm.id}
                        onClick={() => setSelectedAdmin(adm)}
                        className={cn(
                          "p-3 rounded-lg cursor-pointer transition-colors border",
                          selectedAdmin?.id === adm.id ? "bg-muted border-primary/25" : "hover:bg-muted/40"
                        )}
                      >
                        <p className="font-semibold text-sm">{adm.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{adm.email}</p>
                      </div>
                    ))}
                  </div>

                  {/* Chat window on right */}
                  <div className="flex-1 flex flex-col min-w-0 h-full">
                    {selectedAdmin ? (
                      <>
                        {/* Messages display */}
                        <div className="flex-1 border rounded-lg p-4 overflow-y-auto bg-muted/5 space-y-3 mb-3">
                          {adminMessages
                            .filter(
                              (m) =>
                                (m.fromId === teacher?.id && m.toId === selectedAdmin.id) ||
                                (m.fromId === selectedAdmin.id && m.toId === teacher?.id)
                            )
                            .map((msg) => {
                              const isOwn = msg.fromId === teacher?.id;
                              return (
                                <div
                                  key={msg.id}
                                  className={cn(
                                    "max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-sm",
                                    isOwn
                                      ? "bg-primary text-primary-foreground ml-auto rounded-br-none"
                                      : "bg-muted border mr-auto rounded-bl-none"
                                  )}
                                >
                                  <p>{msg.content}</p>
                                  <span className={cn("text-[8px] mt-1 block text-right", isOwn ? "text-primary-foreground/75" : "text-muted-foreground")}>
                                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                              );
                            })}
                          {adminMessages.filter(
                            (m) =>
                              (m.fromId === teacher?.id && m.toId === selectedAdmin.id) ||
                              (m.fromId === selectedAdmin.id && m.toId === teacher?.id)
                          ).length === 0 && (
                            <p className="text-center text-xs text-muted-foreground py-12">
                              No messages. Send a message to start conversation.
                            </p>
                          )}
                        </div>

                        {/* Text form input */}
                        <form onSubmit={handleSendAdminMessage} className="flex gap-2">
                          <Input
                            placeholder="Type a message..."
                            value={adminChatInput}
                            onChange={(e) => setAdminChatInput(e.target.value)}
                            disabled={sendingAdminMsg}
                          />
                          <Button type="submit" disabled={sendingAdminMsg || !adminChatInput.trim()}>
                            Send
                          </Button>
                        </form>
                      </>
                    ) : (
                      <p className="text-center text-sm text-muted-foreground py-12 flex-1 flex items-center justify-center">
                        Select an administrator to view thread history.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Camera capture dialog - outside Tabs so it opens from Principal or Direct chat */}
      <Dialog open={cameraDialogOpen} onOpenChange={setCameraDialogOpen}>
        <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Take photo</DialogTitle>
            <DialogDescription>
              Allow camera access to capture a photo. It will be attached to your message.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {cameraError ? (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
                {cameraError}
              </div>
            ) : (
              <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-muted">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="h-full w-full object-cover"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCameraDialogOpen(false)}>
              Cancel
            </Button>
            {!cameraError && (
              <Button type="button" onClick={handleCapturePhoto}>
                <Camera className="h-4 w-4 mr-2" />
                Capture
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Direct chat dialog (Teachers / Students / Parents) - modal={false} so portaled EmojiPicker can receive clicks */}
      <Dialog
        open={!!selectedDirectConversation}
        modal={false}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedDirectConversation(null);
            setDirectChatInput('');
            setPendingDirectAttachment(null);
          }
        }}
      >
        <DialogContent
          className="fixed left-0 right-0 top-0 bottom-0 z-50 h-[100dvh] w-full max-w-full min-w-0 max-h-none rounded-none p-0 flex flex-col border-0 overflow-hidden translate-x-0 translate-y-0 sm:inset-auto sm:left-[50%] sm:top-[50%] sm:translate-x-[-50%] sm:translate-y-[-50%] sm:h-auto sm:max-h-[85vh] sm:w-full sm:max-w-lg sm:rounded-lg sm:border data-[state=closed]:slide-out-to-left-full data-[state=open]:slide-in-from-left-full sm:data-[state=closed]:zoom-out-95 sm:data-[state=open]:zoom-in-95 [&>button]:hidden sm:[&>button]:block"
          aria-describedby={undefined}
          onPointerDownOutside={(e) => {
            if ((e.target as HTMLElement).closest?.('[data-emoji-picker-content]')) e.preventDefault();
          }}
          onInteractOutside={(e) => {
            if ((e.target as HTMLElement).closest?.('[data-emoji-picker-content]')) e.preventDefault();
          }}
        >
          <DialogHeader className="flex-row items-center gap-3 p-3 sm:p-4 border-b shrink-0 bg-background">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 md:hidden"
              onClick={() => {
                setSelectedDirectConversation(null);
                setDirectChatInput('');
                setPendingDirectAttachment(null);
              }}
              aria-label="Back to list"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <Avatar className="h-9 w-9 sm:h-10 sm:w-10 shrink-0">
              <AvatarFallback>{selectedDirectConversation?.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-base sm:text-lg truncate">{selectedDirectConversation?.name}</DialogTitle>
              <DialogDescription className="sr-only">Direct chat.</DialogDescription>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 capitalize truncate">{selectedDirectConversation?.type}</p>
            </div>
          </DialogHeader>
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <div
              ref={directChatScrollRef}
              className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden space-y-4 p-4 bg-muted/20"
            >
              {threadDirect.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No messages yet. Type below to start.</p>
              ) : (
                threadDirect.map((msg) => {
                  const isMe = msg.fromId === teacher?.id;
                  const isDeleted = msg.deleted || msg.content === DELETED_MESSAGE_TEXT;
                  return (
                    <div
                      key={msg.id}
                      className={cn(
                        'flex items-end gap-2 group min-w-0',
                        isMe ? 'justify-end' : 'justify-start'
                      )}
                    >
                      <div
                        className={cn(
                          'max-w-[85%] min-w-0 rounded-lg p-3 text-sm relative break-words',
                          isMe ? 'bg-primary text-primary-foreground' : 'bg-background border'
                        )}
                      >
                        {isMe && !isDeleted && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button type="button" variant="ghost" size="icon" className="absolute top-1 right-1 h-7 w-7 opacity-0 group-hover:opacity-100 text-primary-foreground/80 hover:text-primary-foreground">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleDeleteDirectMessageForMe(msg)}>
                                <Trash2 className="h-4 w-4 mr-2" /> Delete for me
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDeleteDirectMessageForEveryone(msg)}>
                                <Trash2 className="h-4 w-4 mr-2" /> Delete for everyone
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                        {!isMe && !isDeleted && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button type="button" variant="ghost" size="icon" className="absolute top-1 right-1 h-7 w-7 opacity-0 group-hover:opacity-100">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleDeleteDirectMessageForMe(msg)}>
                                <Trash2 className="h-4 w-4 mr-2" /> Delete for me
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                        <p className={cn('whitespace-pre-wrap', isDeleted && 'italic text-muted-foreground')}>
                          {isDeleted ? DELETED_MESSAGE_TEXT : msg.content}
                        </p>
                        {!isDeleted && msg.attachmentUrl && (
                          <a
                            href={msg.attachmentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={cn(
                              'text-xs underline mt-1 block',
                              isMe ? 'text-primary-foreground/80' : 'text-muted-foreground'
                            )}
                          >
                            {msg.attachmentName ?? 'Attachment'}
                          </a>
                        )}
                        <p
                          className={cn(
                            'text-xs mt-1',
                            isMe ? 'text-primary-foreground/70 text-right' : 'text-muted-foreground'
                          )}
                        >
                          {formatDateTime(msg.createdAt)}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <div className="p-3 sm:p-4 border-t shrink-0 space-y-2 bg-background pb-[env(safe-area-inset-bottom)] sm:pb-4 min-w-0 overflow-hidden">
              {pendingDirectAttachment && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground min-w-0">
                  <Paperclip className="h-4 w-4 shrink-0" />
                  <span className="truncate flex-1 min-w-0">Attached: {pendingDirectAttachment.name}</span>
                  <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs shrink-0" onClick={() => setPendingDirectAttachment(null)}>
                    Remove
                  </Button>
                </div>
              )}
              <div className="flex items-end gap-2 min-w-0 w-full overflow-hidden">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 shrink-0"
                  title="Take photo"
                  onClick={() => {
                    setCameraForDirect(true);
                    setCameraDialogOpen(true);
                  }}
                >
                  <Camera className="h-5 w-5 text-muted-foreground" />
                </Button>
                <input
                  id="teacher-direct-chat-attach"
                  type="file"
                  className="sr-only"
                  aria-label="Attach file"
                  onChange={handleDirectChatFileSelect}
                />
                <label
                  htmlFor="teacher-direct-chat-attach"
                  className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-10 w-10 shrink-0 cursor-pointer"
                  title="Attach file"
                >
                  <Paperclip className="h-5 w-5 text-muted-foreground" />
                </label>
                <EmojiPicker
                  value={directChatInput}
                  onChange={setDirectChatInput}
                  textareaRef={directChatTextareaRef}
                  insertAtCursor
                />
                <Textarea
                  ref={directChatTextareaRef}
                  placeholder="Type your message..."
                  className="flex-1 min-h-[40px] min-w-0 w-0 basis-0 max-h-24 resize-none"
                  rows={1}
                  inputMode="text"
                  autoComplete="off"
                  value={directChatInput}
                  onChange={(e) => setDirectChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendDirectMessage();
                    }
                  }}
                />
                <Button
                  type="button"
                  size="icon"
                  onClick={handleSendDirectMessage}
                  disabled={directChatSending}
                  title="Send"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
