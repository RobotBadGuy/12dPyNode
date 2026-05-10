import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.mock factories are hoisted to the top of the file by Vitest's transform,
// so any variable they reference must also be hoisted via vi.hoisted().
// Without this, `toastMock` would be a TDZ reference at the time the factory runs.
const toastMock = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
}));

vi.mock('sonner', () => ({ toast: toastMock }));

import { notify } from '../notify';

describe('notify wrapper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('routes success to toast.success with options forwarded', () => {
    notify.success('Saved', { description: 'all good' });
    expect(toastMock.success).toHaveBeenCalledWith('Saved', { description: 'all good' });
  });

  it('routes success with no opts (undefined forwarded)', () => {
    notify.success('Saved');
    expect(toastMock.success).toHaveBeenCalledWith('Saved', undefined);
  });

  it('routes error to toast.error', () => {
    notify.error('Boom');
    expect(toastMock.error).toHaveBeenCalledWith('Boom', undefined);
  });

  it('forwards action slot on error so PC-911 can use it', () => {
    const onClick = vi.fn();
    notify.error('Failed', {
      description: 'because',
      action: { label: 'Retry', onClick },
    });
    expect(toastMock.error).toHaveBeenCalledWith('Failed', {
      description: 'because',
      action: { label: 'Retry', onClick },
    });
  });

  it('routes warning to toast.warning', () => {
    notify.warning('Careful');
    expect(toastMock.warning).toHaveBeenCalledWith('Careful', undefined);
  });

  it('routes info to toast.info', () => {
    notify.info('FYI', { description: 'just so you know' });
    expect(toastMock.info).toHaveBeenCalledWith('FYI', { description: 'just so you know' });
  });
});
