'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { nextTheme, toggleLabel } from '@/lib/theme';

// PC-705 — Sun/Moon toggle for the always-visible TopBar cluster. Mounted-guard
// avoids a hydration mismatch: resolvedTheme is unknown on the server and on the
// first client render, so render a stable, inert placeholder until mounted.
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="px-2 text-gray-700 dark:text-gray-300"
        disabled
        aria-hidden
      >
        <Sun className="w-4 h-4" />
      </Button>
    );
  }

  const isDark = resolvedTheme === 'dark';
  const label = toggleLabel(resolvedTheme);
  return (
    <Button
      onClick={() => setTheme(nextTheme(resolvedTheme))}
      variant="ghost"
      size="sm"
      className="px-2 text-gray-700 hover:bg-gray-200/60 dark:text-gray-300 dark:hover:bg-gray-800/50"
      title={label}
      aria-label={label}
    >
      {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </Button>
  );
}
