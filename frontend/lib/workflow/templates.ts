import { WorkflowTemplate } from './types';
import { createTemplate } from './templatesApi';

const LEGACY_STORAGE_KEY = 'pychain_workflow_templates';
const MIGRATION_FLAG_KEY = 'pychain_workflow_templates_migrated';

export function exportTemplate(template: WorkflowTemplate): string {
  return JSON.stringify(template, null, 2);
}

export function importTemplate(json: string): WorkflowTemplate {
  const template = JSON.parse(json);
  if (!template.nodes || !template.edges) {
    throw new Error('Invalid template format');
  }
  return template;
}

/**
 * One-shot import of any localStorage templates left over from the
 * pre-PC-202 storage. Idempotent: the second call is a no-op.
 *
 * Returns the number of templates uploaded (0 if there was nothing to do).
 * Errors during upload are swallowed per-row so a single bad record can't
 * block the whole migration; failures are logged to the console.
 */
export async function migrateLocalStorageToServer(): Promise<number> {
  if (typeof window === 'undefined') return 0;
  if (localStorage.getItem(MIGRATION_FLAG_KEY)) return 0;

  const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!raw) {
    localStorage.setItem(MIGRATION_FLAG_KEY, '1');
    return 0;
  }

  let legacy: WorkflowTemplate[] = [];
  try {
    legacy = JSON.parse(raw);
  } catch {
    localStorage.setItem(MIGRATION_FLAG_KEY, '1');
    return 0;
  }
  if (!Array.isArray(legacy) || legacy.length === 0) {
    localStorage.setItem(MIGRATION_FLAG_KEY, '1');
    return 0;
  }

  let migrated = 0;
  for (const template of legacy) {
    try {
      await createTemplate({
        name: template.name,
        nodes: template.nodes,
        edges: template.edges,
        viewport: template.viewport ?? { x: 0, y: 0, zoom: 1 },
      });
      migrated += 1;
    } catch (err) {
      console.error(`Failed to migrate template "${template.name}":`, err);
    }
  }

  localStorage.setItem(MIGRATION_FLAG_KEY, '1');
  // Keep the legacy key around as a backup until the user clears their
  // browser data — cheap insurance if a migration goes sideways.
  return migrated;
}
