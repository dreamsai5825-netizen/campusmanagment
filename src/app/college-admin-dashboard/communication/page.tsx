'use client';

import React, { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, query, where, addDoc, updateDoc, doc, writeBatch } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { useCurrentPrincipal } from '@/hooks/use-current-user';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { MessageSquare, Send, Paperclip, Loader2, User } from 'lucide-react';
import { EmojiPicker } from '@/components/emoji-picker';
import { cn } from '@/lib/utils';
import type { Teacher, Principal } from '@/lib/types';

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

type ChatParticipant = {
  id: string;
  name: string;
  email: string;
  role: 'principal' | 'teacher';
};

export default function CollegeAdminCommunicationPage() {
  const { toast } = useToast();
  const admin = useCurrentPrincipal();
  const [participants, setParticipants] = useState<ChatParticipant[]>([]);
  const [selectedParticipant, setSelectedParticipant] = useState<ChatParticipant | null>(null);
  const [messages, setMessages] = useState<MessageEntity[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingParticipants, setLoadingParticipants] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // File attachments state
  const [fileToSend, setFileToSend] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const chatTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Fetch teachers and principals in the college
  useEffect(() => {
    if (!admin?.collegeId) return;

    const unsubTeachers = onSnapshot(
      query(collection(db, 'teachers'), where('collegeId', '==', admin.collegeId)),
      (snap) => {
        const teachersList = snap.docs.map((d) => {
          const data = d.data();
          return { id: d.id, name: data.name, email: data.email, role: 'teacher' as const };
        });
        
        // Fetch principals
        onSnapshot(
          query(collection(db, 'principals'), where('collegeId', '==', admin.collegeId)),
          (principalSnap) => {
            const principalsList = principalSnap.docs
              .filter((d) => d.id !== admin.id) // Exclude self if in principal collection
              .map((d) => {
                const data = d.data();
                return { id: d.id, name: data.name, email: data.email, role: 'principal' as const };
              });
            
            setParticipants([...principalsList, ...teachersList]);
            setLoadingParticipants(false);
          }
        );
      }
    );

    return () => {
      unsubTeachers();
    };
  }, [admin?.collegeId, admin?.id]);

  // Sync direct messages
  useEffect(() => {
    if (!admin?.collegeId || !admin?.id) return;

    const q = query(
      collection(db, 'adminMessages'),
      where('collegeId', '==', admin.collegeId)
    );

    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as MessageEntity));
      list.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      setMessages(list);
    });

    return () => unsub();
  }, [admin?.collegeId, admin?.id]);

  // Scroll to bottom when conversation changes or messages arrive
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, selectedParticipant]);

  // Thread filter
  const threadMessages = React.useMemo(() => {
    if (!selectedParticipant || !admin?.id) return [];
    return messages.filter(
      (m) =>
        (m.fromId === admin.id && m.toId === selectedParticipant.id) ||
        (m.fromId === selectedParticipant.id && m.toId === admin.id)
    );
  }, [messages, selectedParticipant, admin?.id]);

  // Mark unread messages as read
  useEffect(() => {
    if (!selectedParticipant || !admin?.id) return;
    const unread = threadMessages.filter((m) => m.toId === admin.id && !m.read);
    if (unread.length === 0) return;

    const batch = writeBatch(db);
    unread.forEach((m) => {
      batch.update(doc(db, 'adminMessages', m.id), { read: true });
    });
    batch.commit().catch((err) => console.error('Failed to mark read:', err));
  }, [threadMessages, selectedParticipant, admin?.id]);

  // Send message handler
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!admin?.id || !selectedParticipant) return;
    if (!chatInput.trim() && !fileToSend) return;

    setSending(true);
    try {
      let attachmentUrl: string | undefined = undefined;
      let attachmentName: string | undefined = undefined;

      if (fileToSend) {
        attachmentName = fileToSend.name;
        const storageRef = ref(storage, `chats/admin-${admin.id}/${Date.now()}-${fileToSend.name}`);
        const snap = await uploadBytes(storageRef, fileToSend);
        attachmentUrl = await getDownloadURL(snap.ref);
      }

      await addDoc(collection(db, 'adminMessages'), {
        collegeId: admin.collegeId,
        fromId: admin.id,
        fromName: admin.name || 'Admin',
        fromType: 'college-admin',
        toId: selectedParticipant.id,
        toName: selectedParticipant.name,
        toType: selectedParticipant.role,
        content: chatInput.trim(),
        createdAt: new Date().toISOString(),
        read: false,
        ...(attachmentUrl && { attachmentUrl }),
        ...(attachmentName && { attachmentName }),
      });

      setChatInput('');
      setFileToSend(null);
    } catch (err) {
      console.error('Failed to send message:', err);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to send message.' });
    } finally {
      setSending(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setFileToSend(file);
    e.target.value = '';
  };

  // Emojis helper
  const handleEmojiSelect = (emoji: string) => {
    setChatInput((prev) => prev + emoji);
  };

  // Search filter for participants list
  const filteredParticipants = React.useMemo(() => {
    return participants.filter((p) =>
      (p.name || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [participants, searchQuery]);

  // Group unread message counts
  const unreadCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    if (!admin?.id) return counts;
    messages.forEach((m) => {
      if (m.toId === admin.id && !m.read) {
        counts[m.fromId] = (counts[m.fromId] || 0) + 1;
      }
    });
    return counts;
  }, [messages, admin?.id]);

  if (loadingParticipants) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 sm:gap-8 h-[calc(100vh-140px)]">
      {/* Header */}
      <div className="shrink-0 min-w-0">
        <h1 className="text-2xl font-bold font-headline tracking-tight sm:text-3xl flex items-center gap-2">
          <MessageSquare className="h-7 w-7 text-sky-500" />
          Communication Portal
        </h1>
        <p className="text-muted-foreground text-sm">
          Select a Principal or Faculty member below to start a live conversation thread.
        </p>
      </div>

      {/* Main chat box split */}
      <div className="flex-1 flex gap-4 min-h-0 border rounded-xl overflow-hidden bg-card shadow-sm">
        {/* Left Side: Users list */}
        <div className="w-80 shrink-0 border-r flex flex-col bg-muted/10">
          <div className="p-4 border-b">
            <Input
              placeholder="Search faculty..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-sm"
            />
          </div>
          <div className="flex-1 overflow-y-auto divide-y">
            {filteredParticipants.map((p) => {
              const unread = unreadCounts[p.id] || 0;
              const isSelected = selectedParticipant?.id === p.id;
              return (
                <div
                  key={p.id}
                  onClick={() => setSelectedParticipant(p)}
                  className={cn(
                    "flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/40 transition-colors",
                    isSelected && "bg-muted"
                  )}
                >
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarFallback className={p.role === 'principal' ? 'bg-sky-100 text-sky-700' : 'bg-amber-100 text-amber-700'}>
                      {p.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline">
                      <span className="font-semibold text-sm truncate text-foreground">{p.name}</span>
                      <Badge variant="outline" className="text-[10px] uppercase font-bold shrink-0 ml-2">
                        {p.role}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{p.email}</p>
                  </div>
                  {unread > 0 && (
                    <Badge variant="default" className="rounded-full h-5 w-5 justify-center p-0 text-[10px] shrink-0">
                      {unread}
                    </Badge>
                  )}
                </div>
              );
            })}
            {filteredParticipants.length === 0 && (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No users found.
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Message Thread */}
        <div className="flex-1 flex flex-col bg-background min-w-0">
          {selectedParticipant ? (
            <>
              {/* Active User Header */}
              <div className="flex items-center gap-3 p-4 border-b bg-muted/5 shrink-0">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className={selectedParticipant.role === 'principal' ? 'bg-sky-100 text-sky-700' : 'bg-amber-100 text-amber-700'}>
                    {selectedParticipant.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-sm text-foreground">{selectedParticipant.name}</h3>
                  <p className="text-xs text-muted-foreground truncate">{selectedParticipant.email}</p>
                </div>
              </div>

              {/* Chat Thread Messages Box */}
              <div
                ref={chatScrollRef}
                className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/5"
              >
                {threadMessages.map((msg) => {
                  const isOwn = msg.fromId === admin?.id;
                  return (
                    <div
                      key={msg.id}
                      className={cn(
                        "flex items-end gap-2 max-w-[75%]",
                        isOwn ? "ml-auto flex-row-reverse" : "mr-auto"
                      )}
                    >
                      <div className="flex flex-col gap-1">
                        <div
                          className={cn(
                            "rounded-2xl px-4 py-2.5 text-sm shadow-sm leading-relaxed",
                            isOwn
                              ? "bg-primary text-primary-foreground rounded-br-none"
                              : "bg-muted text-foreground rounded-bl-none border"
                          )}
                        >
                          {msg.content && <p className="whitespace-pre-wrap">{msg.content}</p>}

                          {msg.attachmentName && (
                            <div className={cn("mt-2 border-t pt-2 text-xs", isOwn ? "border-primary-foreground/20" : "border-muted-foreground/15")}>
                              <a
                                href={msg.attachmentUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={cn("inline-flex items-center gap-1 hover:underline font-medium", isOwn ? "text-primary-foreground" : "text-primary")}
                              >
                                <Paperclip className="h-3 w-3 shrink-0" />
                                <span className="truncate max-w-[150px]">{msg.attachmentName}</span>
                              </a>
                            </div>
                          )}
                        </div>
                        <span className={cn("text-[9px] text-muted-foreground mt-0.5", isOwn && "text-right")}>
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  );
                })}
                {threadMessages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-8">
                    <MessageSquare className="h-10 w-10 text-muted-foreground/30 mb-2" />
                    <p className="text-sm">No messages yet. Send a greeting to start chatting!</p>
                  </div>
                )}
              </div>

              {/* Chat Input Field / Footer */}
              <div className="p-4 border-t bg-card shrink-0">
                <form onSubmit={handleSendMessage} className="space-y-3">
                  {fileToSend && (
                    <div className="flex items-center gap-2 bg-muted p-2 rounded-lg text-xs">
                      <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="truncate flex-1 font-medium">{fileToSend.name}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setFileToSend(null)}
                        className="h-6 px-1.5 text-muted-foreground hover:text-foreground shrink-0"
                      >
                        Cancel
                      </Button>
                    </div>
                  )}
                  
                  <div className="flex items-end gap-2">
                    <div className="flex gap-1 shrink-0 mb-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => fileInputRef.current?.click()}
                        className="h-9 w-9 text-muted-foreground hover:text-foreground rounded-full"
                      >
                        <Paperclip className="h-5 w-5" />
                      </Button>
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        className="hidden"
                      />
                      <EmojiPicker
                        value={chatInput}
                        onChange={setChatInput}
                        textareaRef={chatTextareaRef}
                        insertAtCursor
                      />
                    </div>

                    <Textarea
                      ref={chatTextareaRef}
                      placeholder="Type a message..."
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage(e);
                        }
                      }}
                      className="min-h-[38px] max-h-[120px] resize-none py-2 rounded-xl focus-visible:ring-1"
                      rows={1}
                    />

                    <Button
                      type="submit"
                      disabled={sending || (!chatInput.trim() && !fileToSend)}
                      className="h-9 w-9 p-0 flex items-center justify-center rounded-full shrink-0 mb-1"
                    >
                      {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </div>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8">
              <User className="h-16 w-16 text-muted-foreground/20 mb-4" />
              <p className="text-base font-semibold">No Conversation Selected</p>
              <p className="text-sm mt-1 text-center max-w-sm">
                Select a teacher or principal from the list on the left to start viewing your communication history and send messages.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
