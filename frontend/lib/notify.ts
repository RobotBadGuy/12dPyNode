import { toast } from 'sonner';

// PC-901: thin wrapper over sonner so future swaps / centralised tweaks
// happen in one place. Bespoke template success notifications go through
// TemplateNotification, NOT this module — that distinction is intentional.
export const notify = {
  success: (message: string, opts?: { description?: string }) =>
    toast.success(message, opts),
  error: (
    message: string,
    opts?: {
      description?: string;
      action?: { label: string; onClick: () => void };
    },
  ) => toast.error(message, opts),
  warning: (message: string, opts?: { description?: string }) =>
    toast.warning(message, opts),
  info: (message: string, opts?: { description?: string }) =>
    toast.info(message, opts),
};
