'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { FileText, MessageSquare, ShieldAlert, Check, X, Camera, Paperclip, Send, MoreVertical, Trash2 } from 'lucide-react';
import { collection, onSnapshot, doc, updateDoc, query, where, addDoc, writeBatch, arrayUnion } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { useCurrentPrincipal } from '@/hooks/use-current-user';
import type { LeaveRequest, PrincipalMessage, ReportIssue, Teacher } from '@/lib/types';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { EmojiPicker } from '@/components/emoji-picker';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DELETED_MESSAGE_TEXT } from '@/lib/chat-constants';

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { dateStyle: 'medium' });
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
}

type ConversationParticipant = { id: string; name: string; type: 'teacher' | 'student' };

export default function AdminCommunicationPage() {
  const { toast } = useToast();
  const principal = useCurrentPrincipal();
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [messages, setMessages] = useState<PrincipalMessage[]>([]);
  const [reportIssues, setReportIssues] = useState<ReportIssue[]>([]);
  const [allTeachers, setAllTeachers] = useState<Teacher[]>([]);
  const [selectedLeave, setSelectedLeave] = useState<LeaveRequest | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<ConversationParticipant | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<ReportIssue | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // College Admin chat states
  const [collegeAdmins, setCollegeAdmins] = useState<{ id: string; name: string; email: string }[]>([]);
  const [adminMessages, setAdminMessages] = useState<MessageEntity[]>([]);
  const [selectedAdmin, setSelectedAdmin] = useState<{ id: string; name: string; email: string } | null>(null);
  const [adminChatInput, setAdminChatInput] = useState('');
  const [sendingAdminMsg, setSendingAdminMsg] = useState(false);

  type MessageEntity = {
    id: string;
    collegeId: string;
    fromId: string;
    fromName: string;
    fromType: string;
    toId: string;
    toName: string;
    toType: string;
    content: string;
    createdAt: string;
    read: boolean;
    attachmentUrl?: string;
    attachmentName?: string;
  };

  const conversations: ConversationParticipant[] = React.useMemo(() => {
    const map = new Map<string, ConversationParticipant>();
    messages.forEach((m) => {
      if (m.fromType === 'principal' && m.toId && m.toName) {
        map.set(m.toId, { id: m.toId, name: m.toName, type: m.toType ?? 'teacher' });
      } else if (m.fromType !== 'principal' && !m.toId) {
        map.set(m.fromId, { id: m.fromId, name: m.fromName, type: m.fromType });
      }
    });
    const conversationsList = Array.from(map.values());
    // Sort conversations by most recent message time
    conversationsList.sort((a, b) => {
      const lastToPrincipalA = messages
        .filter((m) => m.fromId === a.id && !m.toId)
        .sort((x, y) => y.createdAt.localeCompare(x.createdAt))[0];
      const lastFromPrincipalA = messages
        .filter((m) => m.fromId === principal?.id && m.toId === a.id)
        .sort((x, y) => y.createdAt.localeCompare(x.createdAt))[0];
      const lastMsgA = [lastToPrincipalA, lastFromPrincipalA]
        .filter(Boolean)
        .sort((x, y) => y!.createdAt.localeCompare(x!.createdAt))[0];

      const lastToPrincipalB = messages
        .filter((m) => m.fromId === b.id && !m.toId)
        .sort((x, y) => y.createdAt.localeCompare(x.createdAt))[0];
      const lastFromPrincipalB = messages
        .filter((m) => m.fromId === principal?.id && m.toId === b.id)
        .sort((x, y) => y.createdAt.localeCompare(x.createdAt))[0];
      const lastMsgB = [lastToPrincipalB, lastFromPrincipalB]
        .filter(Boolean)
        .sort((x, y) => y!.createdAt.localeCompare(x!.createdAt))[0];

      // Sort by most recent first (descending)
      return (lastMsgB?.createdAt || '').localeCompare(lastMsgA?.createdAt || '');
    });
    return conversationsList;
  }, [messages, principal?.id]);

  const filteredConversations = React.useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    return conversations.filter((c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [conversations, searchQuery]);

  const unreadByFromId = React.useMemo(() => {
    const count: Record<string, number> = {};
    messages.forEach((m) => {
      if (m.fromType !== 'principal' && !m.toId && !m.read) {
        count[m.fromId] = (count[m.fromId] ?? 0) + 1;
      }
    });
    return count;
  }, [messages]);

  useEffect(() => {
    if (!principal?.collegeId) {
      setLeaveRequests([]);
      setMessages([]);
      setReportIssues([]);
      setAllTeachers([]);
      setCollegeAdmins([]);
      setAdminMessages([]);
      return;
    }
    const unsubLR = onSnapshot(
      query(collection(db, 'leaveRequests'), where('collegeId', '==', principal.collegeId)),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as LeaveRequest));
        list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        setLeaveRequests(list);
      }
    );
    const unsubM = onSnapshot(
      query(collection(db, 'principalMessages'), where('collegeId', '==', principal.collegeId)),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as PrincipalMessage));
        list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        setMessages(list);
      }
    );
    const unsubI = onSnapshot(
      query(collection(db, 'reportIssues'), where('collegeId', '==', principal.collegeId)),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ReportIssue));
        list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        setReportIssues(list);
      }
    );
    const unsubT = onSnapshot(
      query(collection(db, 'teachers'), where('collegeId', '==', principal.collegeId)),
      (snap) => setAllTeachers(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Teacher)))
    );
    const unsubAdmins = onSnapshot(
      query(collection(db, 'college_admins'), where('collegeId', '==', principal.collegeId)),
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
      query(collection(db, 'adminMessages'), where('collegeId', '==', principal.collegeId)),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as MessageEntity));
        list.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        setAdminMessages(list);
      }
    );
    return () => {
      unsubLR();
      unsubM();
      unsubI();
      unsubT();
      unsubAdmins();
      unsubAdminMsgs();
    };
  }, [principal?.collegeId]);

  const pendingLeaveCount = leaveRequests.filter((r) => r.status === 'pending').length;
  const unreadMessageCount = messages.filter((m) => !m.read && !m.toId).length;

  const handleSendAdminMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!principal?.id || !selectedAdmin || !adminChatInput.trim()) return;
    setSendingAdminMsg(true);
    try {
      await addDoc(collection(db, 'adminMessages'), {
        collegeId: principal.collegeId,
        fromId: principal.id,
        fromName: principal.name || 'Principal',
        fromType: 'principal',
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

  const handleApproveLeave = async (id: string) => {
    try {
      await updateDoc(doc(db, 'leaveRequests', id), { status: 'approved' });
      setSelectedLeave(null);
      toast({ title: 'Leave request approved' });
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to update request.' });
    }
  };

  const handleRejectLeave = async (id: string) => {
    try {
      await updateDoc(doc(db, 'leaveRequests', id), { status: 'rejected' });
      setSelectedLeave(null);
      toast({ title: 'Leave request rejected' });
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to update request.' });
    }
  };

  const handleMarkThreadRead = async (fromId: string) => {
    const toMark = messages.filter((m) => m.fromId === fromId && !m.toId && !m.read);
    if (toMark.length === 0) return;
    try {
      const batch = writeBatch(db);
      toMark.forEach((m) => batch.update(doc(db, 'principalMessages', m.id), { read: true }));
      await batch.commit();
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to mark as read.' });
    }
  };

  const handleOpenConversation = (participant: ConversationParticipant) => {
    setSelectedConversation(participant);
    handleMarkThreadRead(participant.id);
  };

  const [chatInput, setChatInput] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState<File | null>(null);
  const [cameraDialogOpen, setCameraDialogOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const principalChatTextareaRef = useRef<HTMLTextAreaElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const threadMessages = React.useMemo(() => {
    if (!selectedConversation || !principal) return [];
    return messages
      .filter(
        (m) =>
          ((m.fromId === principal.id && m.toId === selectedConversation.id) ||
            (m.fromId === selectedConversation.id && !m.toId)) &&
          !(m.deletedForIds ?? []).includes(principal.id)
      )
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }, [messages, selectedConversation, principal]);

  const handleDeleteMessageForMe = async (msg: PrincipalMessage) => {
    if (!principal?.id) return;
    try {
      await updateDoc(doc(db, 'principalMessages', msg.id), {
        deletedForIds: arrayUnion(principal.id),
      });
      toast({ title: 'Message deleted for you' });
    } catch {
      toast({ variant: 'destructive', title: 'Could not delete message' });
    }
  };

  const handleDeleteMessageForEveryone = async (msg: PrincipalMessage) => {
    if (!principal?.id) return;
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

  useEffect(() => {
    chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [threadMessages]);

  const handleSendMessage = async () => {
    if (!principal || !selectedConversation) return;
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
            description: 'Message will be sent without the file. Enable Storage CORS (gsutil) and deploy Storage rules (firebase deploy --only storage).',
          });
          attachmentName = undefined;
          attachmentUrl = undefined;
        }
      }
      const messageContent =
        content ||
        (attachmentName ? `[Attachment: ${attachmentName}]` : '') ||
        (fileToSend ? `[File "${fileToSend.name}" could not be uploaded – enable Storage CORS and deploy storage.rules]` : '');
      await addDoc(collection(db, 'principalMessages'), {
        collegeId: principal.collegeId,
        fromId: principal.id,
        fromName: principal.name,
        fromType: 'principal',
        toId: selectedConversation.id,
        toName: selectedConversation.name,
        toType: selectedConversation.type,
        content: messageContent,
        createdAt: new Date().toISOString(),
        read: false,
        ...(attachmentUrl && { attachmentUrl }),
        ...(attachmentName && { attachmentName }),
      });
      await addDoc(collection(db, 'notifications'), {
        collegeId: principal.collegeId,
        recipientId: selectedConversation.id,
        type: 'message',
        sender: { name: principal.name, role: 'principal' },
        title: 'Reply from Principal',
        content: (messageContent.slice(0, 120) || 'Attachment') + (messageContent.length > 120 ? '…' : ''),
        date: new Date().toISOString(),
        read: false,
      });

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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setPendingAttachment(file);
    e.target.value = '';
  };

  const clearPendingAttachment = () => setPendingAttachment(null);

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
        setCameraError(err?.message ?? 'Webcam access failed. Allow camera permission or use Attach to choose a file.');
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
        setPendingAttachment(file);
        setCameraDialogOpen(false);
        toast({ title: 'Photo captured' });
      },
      'image/png',
      0.9
    );
  };

  const handleIssueStatus = async (id: string, status: ReportIssue['status']) => {
    try {
      await updateDoc(doc(db, 'reportIssues', id), { status });
      setSelectedIssue((prev) => (prev?.id === id ? { ...prev, status } : prev));
      toast({ title: `Issue marked as ${status}` });
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to update issue.' });
    }
  };

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold font-headline tracking-tight sm:text-3xl">
          Communication
        </h1>
        <p className="text-muted-foreground">
          Leave requests, messages, and issue reports from teachers and students.
        </p>
      </div>

      <Tabs defaultValue="teachers" className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5">
          <TabsTrigger value="teachers" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Teachers
          </TabsTrigger>
          <TabsTrigger value="messages" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Messages
            {unreadMessageCount > 0 && (
              <Badge variant="secondary" className="ml-1">{unreadMessageCount}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="leave" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Leave Requests
            {pendingLeaveCount > 0 && (
              <Badge variant="secondary" className="ml-1">{pendingLeaveCount}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="college-admin" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            College Admin
          </TabsTrigger>
          <TabsTrigger value="issues">
            <ShieldAlert className="h-4 w-4 mr-2" />
            Report Issues
          </TabsTrigger>
        </TabsList>

        <TabsContent value="teachers" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Contact Teachers</CardTitle>
              <CardDescription>Select a teacher to start a conversation.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {allTeachers.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No teachers in your college yet.</p>
              ) : (
                allTeachers.map((t) => {
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
                          <AvatarFallback>{t.name.charAt(0)}</AvatarFallback>
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
                          <p className="text-sm text-muted-foreground">{t.subjectSpecialty ?? '—'}</p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setSelectedConversation({ id: t.id, name: t.name, type: 'teacher' });
                          handleMarkThreadRead(t.id);
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
                })
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leave" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Leave Requests from Teachers</CardTitle>
              <CardDescription>
                Review and approve or reject leave requests.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {leaveRequests.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No leave requests yet.</p>
              ) : (
                <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                  {leaveRequests.map((req) => (
                    <div
                      key={req.id}
                      className={cn(
                        'flex items-center justify-between rounded-lg border p-4 cursor-pointer hover:bg-muted/50 transition-colors',
                        req.status === 'pending' && 'border-primary/30'
                      )}
                      onClick={() => setSelectedLeave(req)}
                    >
                      <div className="flex items-center gap-4">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback>{req.senderName.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-semibold">{req.senderName}</p>
                          <p className="text-sm text-muted-foreground">{req.subject}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(req.startDate)} – {formatDate(req.endDate)}
                          </p>
                        </div>
                      </div>
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
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="messages" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Messages</CardTitle>
              <CardDescription>
                One-to-one chat with teachers and students. Click a conversation to open the chat.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg bg-background text-sm"
              />
              {conversations.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No conversations yet.</p>
              ) : filteredConversations.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No conversations match your search.</p>
              ) : (
                <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                  {filteredConversations.map((participant) => {
                    const lastToPrincipal = messages
                      .filter((m) => m.fromId === participant.id && !m.toId)
                      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
                    const lastFromPrincipal = messages
                      .filter((m) => m.fromId === principal?.id && m.toId === participant.id)
                      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
                    const lastMsg = [lastToPrincipal, lastFromPrincipal]
                      .filter(Boolean)
                      .sort((a, b) => b!.createdAt.localeCompare(a!.createdAt))[0];
                    const unread = unreadByFromId[participant.id] ?? 0;
                    return (
                      <div
                        key={participant.id}
                        className={cn(
                          'flex items-center gap-4 rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors',
                          unread > 0 && 'bg-primary/5 border-primary/20'
                        )}
                        onClick={() => handleOpenConversation(participant)}
                      >
                        <Avatar className="h-10 w-10 shrink-0">
                          <AvatarFallback>{participant.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold flex items-center gap-2 flex-wrap">
                            <span>{participant.name}</span>
                            <Badge variant="outline" className="text-xs">{participant.type}</Badge>
                            {unread > 0 && (
                              <Badge variant="secondary">{unread}</Badge>
                            )}
                          </div>
                          {lastMsg && (
                            <p className="text-sm text-muted-foreground truncate">
                              {lastMsg.content}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="issues" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Reported Issues</CardTitle>
              <CardDescription>
                Issue reports from teachers and students.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {reportIssues.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No reported issues yet.</p>
              ) : (
                <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                  {reportIssues.map((issue) => (
                    <div
                      key={issue.id}
                      className="flex items-center justify-between rounded-lg border p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => setSelectedIssue(issue)}
                    >
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <Avatar className="h-10 w-10 shrink-0">
                          <AvatarFallback>{issue.senderName.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold">{issue.title}</p>
                          <p className="text-sm text-muted-foreground truncate">{issue.content}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {issue.senderName} ({issue.senderType}) · {formatDateTime(issue.createdAt)}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant={
                          issue.status === 'resolved'
                            ? 'default'
                            : issue.status === 'acknowledged'
                            ? 'secondary'
                            : 'destructive'
                        }
                      >
                        {issue.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
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
                                (m.fromId === principal?.id && m.toId === selectedAdmin.id) ||
                                (m.fromId === selectedAdmin.id && m.toId === principal?.id)
                            )
                            .map((msg) => {
                              const isOwn = msg.fromId === principal?.id;
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
                              (m.fromId === principal?.id && m.toId === selectedAdmin.id) ||
                              (m.fromId === selectedAdmin.id && m.toId === principal?.id)
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
                            onChange={(e: any) => setAdminChatInput(e.target.value)}
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

      {/* Leave request detail dialog */}
      <Dialog open={!!selectedLeave} onOpenChange={() => setSelectedLeave(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Leave Request</DialogTitle>
            <DialogDescription>
              From {selectedLeave?.senderName}
            </DialogDescription>
          </DialogHeader>
          {selectedLeave && (
            <div className="grid gap-4 py-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Subject</p>
                <p>{selectedLeave.subject}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Start Date</p>
                  <p>{formatDate(selectedLeave.startDate)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">End Date</p>
                  <p>{formatDate(selectedLeave.endDate)}</p>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Reason</p>
                <p className="text-sm">{selectedLeave.reason}</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Submitted {formatDateTime(selectedLeave.createdAt)}
              </p>
            </div>
          )}
          <DialogFooter>
            {selectedLeave?.status === 'pending' && (
              <>
                <Button variant="outline" onClick={() => setSelectedLeave(null)}>Close</Button>
                <Button variant="destructive" onClick={() => handleRejectLeave(selectedLeave.id)}>
                  <X className="h-4 w-4 mr-2" /> Reject
                </Button>
                <Button onClick={() => handleApproveLeave(selectedLeave.id)}>
                  <Check className="h-4 w-4 mr-2" /> Approve
                </Button>
              </>
            )}
            {selectedLeave?.status !== 'pending' && (
              <Button onClick={() => setSelectedLeave(null)}>Close</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Principal chat dialog */}
      <Dialog
        open={!!selectedConversation}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedConversation(null);
            setPendingAttachment(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg p-0 flex flex-col max-h-[85vh]" aria-describedby={undefined}>
          <DialogHeader className="flex-row items-center gap-3 p-4 border-b shrink-0">
            <Avatar className="h-10 w-10">
              <AvatarFallback>{selectedConversation?.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <DialogTitle>{selectedConversation?.name}</DialogTitle>
              <DialogDescription className="sr-only">One-to-one chat.</DialogDescription>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                <Badge variant="outline" className="text-xs">{selectedConversation?.type}</Badge>
                <span>One-to-one chat</span>
              </div>
            </div>
          </DialogHeader>
          <div className="flex flex-col flex-1 min-h-0">
            <div
              ref={chatScrollRef}
              className="flex-1 overflow-y-auto space-y-4 p-4 bg-muted/20"
            >
              {threadMessages.map((msg) => {
                const isPrincipal = msg.fromType === 'principal';
                const isDeleted = msg.deleted || msg.content === DELETED_MESSAGE_TEXT;
                return (
                  <div
                    key={msg.id}
                    className={cn(
                      'flex items-end gap-2 group',
                      isPrincipal ? 'justify-end' : 'justify-start'
                    )}
                  >
                    <div
                      className={cn(
                        'max-w-[85%] rounded-lg p-3 text-sm relative',
                        isPrincipal ? 'bg-primary text-primary-foreground' : 'bg-background border'
                      )}
                    >
                      {isPrincipal && !isDeleted && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button type="button" variant="ghost" size="icon" className="absolute top-1 right-1 h-7 w-7 opacity-0 group-hover:opacity-100 text-primary-foreground/80 hover:text-primary-foreground">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleDeleteMessageForMe(msg)}>
                              <Trash2 className="h-4 w-4 mr-2" /> Delete for me
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDeleteMessageForEveryone(msg)}>
                              <Trash2 className="h-4 w-4 mr-2" /> Delete for everyone
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                      {!isPrincipal && !isDeleted && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button type="button" variant="ghost" size="icon" className="absolute top-1 right-1 h-7 w-7 opacity-0 group-hover:opacity-100">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleDeleteMessageForMe(msg)}>
                              <Trash2 className="h-4 w-4 mr-2" /> Delete for me
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDeleteMessageForEveryone(msg)}>
                              <Trash2 className="h-4 w-4 mr-2" /> Delete for everyone
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
                            isPrincipal ? 'text-primary-foreground/80' : 'text-muted-foreground'
                          )}
                        >
                          {msg.attachmentName ?? 'Attachment'}
                        </a>
                      )}
                      <p
                        className={cn(
                          'text-xs mt-1',
                          isPrincipal ? 'text-primary-foreground/70 text-right' : 'text-muted-foreground'
                        )}
                      >
                        {formatDateTime(msg.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="p-4 border-t shrink-0 space-y-2">
              {pendingAttachment && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Paperclip className="h-4 w-4 shrink-0" />
                  <span className="truncate flex-1">Attached: {pendingAttachment.name}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={clearPendingAttachment}
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
                  title="Take photo with webcam"
                  onClick={() => setCameraDialogOpen(true)}
                >
                  <Camera className="h-5 w-5 text-muted-foreground" />
                </Button>
                <input
                  id="principal-chat-attach"
                  type="file"
                  className="sr-only"
                  aria-label="Attach document"
                  onChange={handleFileSelect}
                />
                <label
                  htmlFor="principal-chat-attach"
                  className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-10 w-10 shrink-0 cursor-pointer"
                  title="Attach document"
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
                      handleSendMessage();
                    }
                  }}
                />
                <Button
                  type="button"
                  size="icon"
                  onClick={handleSendMessage}
                  disabled={chatSending}
                  title="Send"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Camera capture dialog */}
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

      {/* Issue detail dialog */}
      <Dialog open={!!selectedIssue} onOpenChange={() => setSelectedIssue(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedIssue?.title}</DialogTitle>
            <DialogDescription>
              From {selectedIssue?.senderName} ({selectedIssue?.senderType}) ·{' '}
              {selectedIssue && formatDateTime(selectedIssue.createdAt)}
            </DialogDescription>
          </DialogHeader>
          {selectedIssue && (
            <div className="py-4 space-y-4">
              <p className="text-sm whitespace-pre-wrap">{selectedIssue.content}</p>
              <Badge>{selectedIssue.status}</Badge>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setSelectedIssue(null)}>Close</Button>
            {selectedIssue && selectedIssue.status === 'open' && (
              <>
                <Button variant="secondary" onClick={() => handleIssueStatus(selectedIssue.id, 'acknowledged')}>
                  Acknowledge
                </Button>
                <Button onClick={() => handleIssueStatus(selectedIssue.id, 'resolved')}>
                  Mark resolved
                </Button>
              </>
            )}
            {selectedIssue && selectedIssue.status === 'acknowledged' && (
              <Button onClick={() => handleIssueStatus(selectedIssue.id, 'resolved')}>
                Mark resolved
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
