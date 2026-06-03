'use client';

import * as React from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { THEME_STORAGE_KEY } from '@/lib/theme';

// PC-705 — app-wide theme context. Dark is the default so existing users see
// no change; light is opt-in via the TopBar toggle. `attribute="class"` drives
// Tailwind's `dark:` variant (darkMode: ['class']). next-themes injects a
// pre-hydration <head> script that sets the class before paint -> no FOUC.
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      storageKey={THEME_STORAGE_KEY}
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
