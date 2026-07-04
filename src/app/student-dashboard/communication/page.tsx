'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Send, MessageSquare, Camera, Paperclip, MoreVertical, Trash2, ArrowLeft } from 'lucide-react';
import React, { useEffect, useState, useRef } from 'react';
import { collection, onSnapshot, addDoc, query, where, doc, updateDoc, writeBatch, arrayUnion } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { useCurrentStudent, useCurrentPrincipal } from '@/hooks/use-current-user';
import { useToast } from '@/hooks/use-toast';
import type { Teacher, PrincipalMessage, DirectMessage } from '@/lib/types';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { playNotificationSound } from '@/lib/notification-sound';
import { Badge } from '@/components/ui/badge';
import { EmojiPicker } from '@/components/emoji-picker';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DELETED_MESSAGE_TEXT } from '@/lib/chat-constants';

type DirectConversation = { id: string; name: string; type: 'teacher' | 'student' | 'parent' };

export default function StudentCommunicationPage() {
  const student = useCurrentStudent();
  const principal = useCurrentPrincipal();
  const { toast } = useToast();
  const [allTeachers, setAllTeachers] = useState<Teacher[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!student?.collegeId) {
      setAllTeachers([]);
      return;
    }
    const unsubT = onSnapshot(
      query(collection(db, 'teachers'), where('collegeId', '==', student.collegeId)),
      (snap) => setAllTeachers(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Teacher)))
    );
    return () => unsubT();
  }, [student?.collegeId]);

  const [activeTab, setActiveTab] = useState('principal');
  const [principalMessages, setPrincipalMessages] = useState<PrincipalMessage[]>([]);
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
    if (!student?.collegeId) {
      setPrincipalMessages([]);
      return;
    }
    const q = query(collection(db, 'principalMessages'), where('collegeId', '==', student.collegeId));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as PrincipalMessage));
      list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      setPrincipalMessages(list);
    });
    return () => unsub();
  }, [student?.collegeId]);

  const threadWithPrincipal = React.useMemo(() => {
    if (!student?.id) return [];
    return principalMessages
      .filter(
        (m) =>
          ((m.fromId === student.id && !m.toId) || (m.toId === student.id)) &&
          !(m.deletedForIds ?? []).includes(student.id)
      )
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }, [principalMessages, student?.id]);

  const unreadFromPrincipal = React.useMemo(() => {
    if (!student?.id) return 0;
    return principalMessages.filter((m) => m.toId === student.id && !m.read).length;
  }, [principalMessages, student?.id]);

  const markPrincipalThreadRead = React.useCallback(async () => {
    if (!student?.id) return;
    const toMark = principalMessages.filter((m) => m.toId === student.id && !m.read);
    if (toMark.length === 0) return;
    try {
      const batch = writeBatch(db);
      toMark.forEach((m) => batch.update(doc(db, 'principalMessages', m.id), { read: true }));
      await batch.commit();
    } catch {
      // ignore
    }
  }, [principalMessages, student?.id]);

  useEffect(() => {
    if (activeTab === 'principal' && unreadFromPrincipal > 0) markPrincipalThreadRead();
  }, [activeTab, unreadFromPrincipal, markPrincipalThreadRead]);

  const handleDeletePrincipalMessageForMe = async (msg: PrincipalMessage) => {
    if (!student?.id) return;
    try {
      await updateDoc(doc(db, 'principalMessages', msg.id), {
        deletedForIds: arrayUnion(student.id),
      });
      toast({ title: 'Message deleted for you' });
    } catch {
      toast({ variant: 'destructive', title: 'Could not delete message' });
    }
  };

  const handleDeletePrincipalMessageForEveryone = async (msg: PrincipalMessage) => {
    if (!student?.id || msg.fromId !== student.id) return;
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
  }, [threadWithPrincipal]);

  const prevPrincipalThreadLenRef = useRef<number | null>(null);
  useEffect(() => {
    const len = threadWithPrincipal.length;
    if (prevPrincipalThreadLenRef.current !== null && len > prevPrincipalThreadLenRef.current && student?.id) {
      const lastMsg = threadWithPrincipal[threadWithPrincipal.length - 1];
      if (lastMsg && lastMsg.fromId !== student.id) playNotificationSound();
    }
    prevPrincipalThreadLenRef.current = len;
  }, [threadWithPrincipal, student?.id]);

  const handleSendMessageToPrincipalChat = async () => {
    if (!student) return;
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
        collegeId: student.collegeId,
        fromId: student.id,
        fromName: student.name,
        fromType: 'student',
        content: messageContent,
        createdAt: new Date().toISOString(),
        read: false,
        ...(attachmentUrl && { attachmentUrl }),
        ...(attachmentName && { attachmentName }),
      });
      if (principal?.id) {
        await addDoc(collection(db, 'notifications'), {
          collegeId: student.collegeId,
          recipientId: principal.id,
          type: 'message',
          sender: { name: student.name, role: 'student' },
          title: `New message from ${student.name}`,
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

  useEffect(() => {
    if (!cameraDialogOpen) return;
    setCameraError(null);
    let stream: MediaStream | null = null;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user' } })
      .then((s) => {
        stream = s;
        streamRef.current = s;
        if (videoRef.current) videoRef.current.srcObject = s;
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

  const [directMessagesFrom, setDirectMessagesFrom] = useState<DirectMessage[]>([]);
  const [directMessagesTo, setDirectMessagesTo] = useState<DirectMessage[]>([]);

  useEffect(() => {
    if (!student?.id) {
      setDirectMessagesFrom([]);
      setDirectMessagesTo([]);
      return;
    }
    const qFrom = query(collection(db, 'directMessages'), where('fromId', '==', student.id));
    const qTo = query(collection(db, 'directMessages'), where('toId', '==', student.id));
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
  }, [student?.id]);

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

  const markDirectThreadRead = async (fromId: string) => {
    if (!student?.id) return;
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

  const threadDirect = React.useMemo(() => {
    if (!student?.id || !selectedDirectConversation) return [];
    return directMessages
      .filter(
        (m) =>
          ((m.fromId === student.id && m.toId === selectedDirectConversation.id) ||
            (m.fromId === selectedDirectConversation.id && m.toId === student.id)) &&
          !(m.deletedForIds ?? []).includes(student.id)
      )
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }, [directMessages, student?.id, selectedDirectConversation]);

  const sortedTeachers = React.useMemo(() => {
    return allTeachers.sort((a, b) => {
      const lastMsgA = directMessages
        .filter((m) => (m.fromId === a.id || m.toId === a.id) && student?.id && ((m.fromId === student.id && m.toId === a.id) || (m.toId === student.id && m.fromId === a.id)))
        .sort((x, y) => y.createdAt.localeCompare(x.createdAt))[0];
      const lastMsgB = directMessages
        .filter((m) => (m.fromId === b.id || m.toId === b.id) && student?.id && ((m.fromId === student.id && m.toId === b.id) || (m.toId === student.id && m.fromId === b.id)))
        .sort((x, y) => y.createdAt.localeCompare(x.createdAt))[0];
      // Sort by most recent first (descending), teachers without messages go to the end
      return (lastMsgB?.createdAt || '').localeCompare(lastMsgA?.createdAt || '');
    });
  }, [allTeachers, directMessages, student?.id]);

  const filteredTeachers = React.useMemo(() => {
    if (!searchQuery.trim()) return sortedTeachers;
    return sortedTeachers.filter((t) =>
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.subjectSpecialty?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
    );
  }, [sortedTeachers, searchQuery]);

  const handleDeleteDirectMessageForMe = async (msg: DirectMessage) => {
    if (!student?.id) return;
    try {
      await updateDoc(doc(db, 'directMessages', msg.id), {
        deletedForIds: arrayUnion(student.id),
      });
      toast({ title: 'Message deleted for you' });
    } catch {
      toast({ variant: 'destructive', title: 'Could not delete message' });
    }
  };

  const handleDeleteDirectMessageForEveryone = async (msg: DirectMessage) => {
    if (!student?.id || msg.fromId !== student.id) return;
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

  const prevDirectThreadLenRef = useRef<number | null>(null);
  useEffect(() => {
    const len = threadDirect.length;
    if (prevDirectThreadLenRef.current !== null && len > prevDirectThreadLenRef.current && student?.id) {
      const lastMsg = threadDirect[threadDirect.length - 1];
      if (lastMsg && lastMsg.fromId !== student.id) playNotificationSound();
    }
    prevDirectThreadLenRef.current = len;
  }, [threadDirect, student?.id]);

  const handleSendDirectMessage = async () => {
    if (!student || !selectedDirectConversation) return;
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
        collegeId: student.collegeId,
        fromId: student.id,
        fromName: student.name,
        fromType: 'student',
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
        collegeId: student.collegeId,
        recipientId: selectedDirectConversation.id,
        type: 'message',
        sender: { name: student.name, role: 'student' },
        title: `New message from ${student.name}`,
        content: (messageContent.slice(0, 120) || 'Attachment') + (messageContent.length > 120 ? '…' : ''),
        date: new Date().toISOString(),
        read: false,
      });

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

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold font-headline tracking-tight">
          Communication
        </h1>
        <p className="text-muted-foreground">
          Reach out to your teachers and the principal.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); if (v === 'principal') markPrincipalThreadRead(); }} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="principal" className="relative">
            Principal
            {unreadFromPrincipal > 0 && (
              <Badge variant="default" className="ml-2 h-5 min-w-5 px-1.5 text-xs">
                {unreadFromPrincipal > 99 ? '99+' : unreadFromPrincipal}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="teachers" className="relative">
            Teachers
            {(Object.values(unreadByFromId).reduce((a, b) => a + b, 0) || 0) > 0 && (
              <Badge variant="default" className="ml-2 h-5 min-w-5 px-1.5 text-xs">
                {Object.values(unreadByFromId).reduce((a, b) => a + b, 0) > 99 ? '99+' : Object.values(unreadByFromId).reduce((a, b) => a + b, 0)}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="principal" className="space-y-4 mt-6">
          <Card className={cn('flex flex-col min-h-[320px] max-h-[75vh]', unreadFromPrincipal > 0 && 'border-primary/30')}>
            <CardHeader className="shrink-0 flex-row items-center gap-3">
              <Avatar className={cn('h-10 w-10', unreadFromPrincipal > 0 && 'relative')}>
                <AvatarFallback>{principal?.name?.charAt(0) ?? 'P'}</AvatarFallback>
                {unreadFromPrincipal > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                    {unreadFromPrincipal > 99 ? '99+' : unreadFromPrincipal}
                  </span>
                )}
              </Avatar>
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  Chat with Principal
                  {unreadFromPrincipal > 0 && (
                    <Badge variant="secondary" className="text-xs">{unreadFromPrincipal} unread</Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  One-to-one chat. Your messages appear in the principal&apos;s Communication → Messages.
                </CardDescription>
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
                    const isMe = msg.fromType === 'student' && msg.fromId === student?.id;
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
                    <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setPendingAttachment(null)}>
                      Remove
                    </Button>
                  </div>
                )}
                <div className="flex items-end gap-2">
                  <Button type="button" variant="ghost" size="icon" className="h-10 w-10 shrink-0" title="Take photo" onClick={() => { setCameraForDirect(false); setCameraDialogOpen(true); }}>
                    <Camera className="h-5 w-5 text-muted-foreground" />
                  </Button>
                  <input
                    id="student-principal-chat-attach"
                    type="file"
                    className="sr-only"
                    aria-label="Attach file"
                    onChange={handlePrincipalChatFileSelect}
                  />
                  <label
                    htmlFor="student-principal-chat-attach"
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
                  <Button type="button" size="icon" onClick={handleSendMessageToPrincipalChat} disabled={chatSending} title="Send">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="teachers" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Contact Teachers</CardTitle>
              <CardDescription>Select a teacher to start a conversation.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <input
                type="text"
                placeholder="Search teachers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg bg-background text-sm"
              />
              {sortedTeachers.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No teachers available.</p>
              ) : filteredTeachers.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No teachers match your search.</p>
              ) : (
                <>
                  {filteredTeachers.map((t) => {
                    const teacherImage = PlaceHolderImages.find(
                      (p) => p.id === t.id || p.id === `${t.id}-profile` || (t.id === 'teacher-01' && p.id === 'teacher-profile')
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
                </>
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
            <DialogDescription>Allow camera access to capture a photo. It will be attached to your message.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {cameraError ? (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">{cameraError}</div>
            ) : (
              <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-muted">
                <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCameraDialogOpen(false)}>Cancel</Button>
            {!cameraError && (
              <Button type="button" onClick={handleCapturePhoto}><Camera className="h-4 w-4 mr-2" /> Capture</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Direct chat dialog (Teachers) */}
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
                  const isMe = msg.fromId === student?.id;
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
                        <p className={cn('whitespace-pre-wrap break-words', isDeleted && 'italic text-muted-foreground')}>
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
                  onClick={() => { setCameraForDirect(true); setCameraDialogOpen(true); }}
                >
                  <Camera className="h-5 w-5 text-muted-foreground" />
                </Button>
                <input
                  id="student-direct-chat-attach"
                  type="file"
                  className="sr-only"
                  aria-label="Attach file"
                  onChange={handleDirectChatFileSelect}
                />
                <label
                  htmlFor="student-direct-chat-attach"
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
                  className="shrink-0"
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
