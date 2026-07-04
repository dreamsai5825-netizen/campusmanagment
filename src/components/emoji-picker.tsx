'use client';

import * as React from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Smile } from 'lucide-react';
import { cn } from '@/lib/utils';

const EMOJI_GROUPS: { label: string; emojis: string[] }[] = [
  { label: 'Smileys', emojis: ['😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂', '😉', '😍', '🥰', '😘', '😗', '😋', '😛', '😜', '🤪', '😎', '🤩', '🥳', '😢', '😭', '😤', '😡', '🤬', '😱', '🥵', '🥶'] },
  { label: 'Gestures', emojis: ['👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '👇', '☝️', '👋', '🤚', '🖐️', '✋', '🖖', '👏', '🙌', '🤝', '🙏', '💪', '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤'] },
  { label: 'Symbols', emojis: ['✅', '❌', '❓', '❗', '💯', '🔥', '⭐', '🌟', '✨', '💫', '🎉', '🎊', '🏆', '📌', '📍', '🔔', '💡', '📝', '📚', '🎓', '📅', '⏰', '🔒', '🔓', '⚡', '🌈', '☀️', '🌙', '🎈', '🎁'] },
];

type EmojiPickerProps = {
  value: string;
  onChange: (value: string) => void;
  onInsertAtCursor?: (emoji: string) => void;
  placeholder?: string;
  className?: string;
  /** If true, uses onInsertAtCursor(emoji); otherwise appends to value via onChange(value + emoji) */
  insertAtCursor?: boolean;
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
};

export function EmojiPicker({
  value,
  onChange,
  onInsertAtCursor,
  placeholder = 'Type your message...',
  className,
  insertAtCursor = false,
  textareaRef,
}: EmojiPickerProps) {
  const [open, setOpen] = React.useState(false);
  const cursorPosRef = React.useRef({ start: 0, end: 0 });

  React.useEffect(() => {
    if (!insertAtCursor || !textareaRef) return;
    const updateCursor = () => {
      const ta = textareaRef.current;
      if (ta && document.activeElement === ta) {
        cursorPosRef.current = {
          start: ta.selectionStart ?? 0,
          end: ta.selectionEnd ?? 0,
        };
      }
    };
    document.addEventListener('selectionchange', updateCursor);
    const ta = textareaRef.current;
    if (ta) {
      ta.addEventListener('focus', updateCursor);
      ta.addEventListener('input', updateCursor);
    }
    return () => {
      document.removeEventListener('selectionchange', updateCursor);
      if (ta) {
        ta.removeEventListener('focus', updateCursor);
        ta.removeEventListener('input', updateCursor);
      }
    };
  }, [insertAtCursor, textareaRef]);

  const insertEmoji = React.useCallback(
    (emoji: string) => {
      if (insertAtCursor && (onInsertAtCursor || textareaRef?.current)) {
        const textarea = textareaRef?.current;
        if (textarea) {
          const { start, end } = cursorPosRef.current;
          const safeStart = Math.min(Math.max(0, start), value.length);
          const safeEnd = Math.min(Math.max(safeStart, end), value.length);
          const before = value.slice(0, safeStart);
          const after = value.slice(safeEnd);
          const newValue = before + emoji + after;
          onChange(newValue);
          cursorPosRef.current = { start: safeStart + emoji.length, end: safeStart + emoji.length };
          setTimeout(() => {
            textarea.focus();
            const pos = safeStart + emoji.length;
            textarea.setSelectionRange(pos, pos);
          }, 0);
        } else if (onInsertAtCursor) {
          onInsertAtCursor(emoji);
        }
      } else {
        onChange(value + emoji);
      }
      setOpen(false);
    },
    [value, onChange, insertAtCursor, onInsertAtCursor, textareaRef]
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="icon" className={cn('h-10 w-10 shrink-0', className)} title="Insert emoji">
          <Smile className="h-5 w-5 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-2" align="start" side="top">
        <div className="max-h-[280px] overflow-y-auto space-y-2" data-emoji-picker-content>
          {EMOJI_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="text-xs font-medium text-muted-foreground px-1 mb-1">{group.label}</p>
              <div className="grid grid-cols-10 gap-0.5">
                {group.emojis.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className="text-xl p-1.5 rounded hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
                    onClick={() => insertEmoji(emoji)}
                    aria-label={`Insert ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
