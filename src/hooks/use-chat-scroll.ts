import { useEffect, useRef, useCallback } from 'react';

export function useChatScroll<T extends HTMLElement = HTMLDivElement>(
  deps: React.DependencyList = [],
  enabled = true
) {
  const ref = useRef<T | null>(null);
  const isInitialMount = useRef(true);

  const scrollToBottom = useCallback((smooth = false) => {
    const el = ref.current;
    if (!el) return;

    const doScroll = () => {
      if (!el) return;
      el.scrollTo({
        top: el.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto',
      });
    };

    // Immediate attempt
    doScroll();

    // Double requestAnimationFrame to ensure layout reflow & modal dialog animation frames complete
    requestAnimationFrame(() => {
      doScroll();
      requestAnimationFrame(() => {
        doScroll();
      });
    });

    // Fallback delays for async dialog open animations & font loading
    const timer1 = setTimeout(doScroll, 50);
    const timer2 = setTimeout(doScroll, 150);
    const timer3 = setTimeout(doScroll, 300);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, []);

  // Track conversation/thread state changes
  useEffect(() => {
    if (!enabled) return;

    // Use instant scroll on initial mount or when opening a conversation thread
    const smooth = !isInitialMount.current;
    const cleanup = scrollToBottom(smooth);
    isInitialMount.current = false;

    return cleanup;
  }, deps);

  // Handle image load inside messages to adjust scroll height
  const handleImageLoad = useCallback(() => {
    if (ref.current) {
      ref.current.scrollTo({
        top: ref.current.scrollHeight,
        behavior: 'auto',
      });
    }
  }, []);

  return {
    ref,
    scrollToBottom,
    handleImageLoad,
  };
}
