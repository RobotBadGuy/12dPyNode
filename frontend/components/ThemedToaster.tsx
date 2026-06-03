'use client';

import { Toaster } from 'sonner';
import { useTheme } from 'next-themes';

// PC-705 — Sonner toasts follow OUR toggle (not the OS). Before mount
// resolvedTheme is undefined; default to 'dark' to match the default theme.
export function ThemedToaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Toaster
      theme={resolvedTheme === 'light' ? 'light' : 'dark'}
      richColors
      position="bottom-right"
      closeButton
    />
  );
}
