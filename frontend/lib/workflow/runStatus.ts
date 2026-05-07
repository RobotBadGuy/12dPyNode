/**
 * PC-303 — derive per-node execution state from a run's per-model events.
 *
 * `BaseNode` already understands four states (`idle | running | success | error`)
 * with corresponding visuals — this helper just decides which state to put on
 * each node id given the events streamed back from the backend so far.
 *
 * Aggregation rules (in priority order):
 *   1. `error` — at least one model emitted an error event for this node.
 *   2. `running` — at least one in-flight model has not yet reported on this
 *      node, AND at least one model has reported on this node successfully.
 *      I.e. the run is moving past it but hasn't covered every model yet.
 *      We also surface 'running' for the *first* node of a queued model,
 *      which the polling tick reveals as soon as the seed snapshot arrives.
 *   3. `success` — every model that has been attempted reports success here,
 *      and there are no queued models left to cover.
 *   4. `idle` — no events for this node yet (run hasn't started, or this
 *      node sits on a branch that hasn't been hit).
 */

import type { FileDetail, NodeEvent } from './run';

export type NodeExecutionState = 'idle' | 'running' | 'success' | 'error';

export function aggregateNodeStates(
  fileDetails: FileDetail[] | undefined,
): Map<string, NodeExecutionState> {
  const out = new Map<string, NodeExecutionState>();
  if (!fileDetails || fileDetails.length === 0) return out;

  // Index events by node_id, splitting into success / error.
  const byNode = new Map<string, { success: number; error: number; events: NodeEvent[] }>();
  for (const row of fileDetails) {
    if (!row.node_events) continue;
    for (const ev of row.node_events) {
      let bucket = byNode.get(ev.node_id);
      if (!bucket) {
        bucket = { success: 0, error: 0, events: [] };
        byNode.set(ev.node_id, bucket);
      }
      bucket.events.push(ev);
      if (ev.status === 'error') bucket.error += 1;
      else if (ev.status === 'success') bucket.success += 1;
    }
  }

  const queuedModelCount = fileDetails.filter((r) => r.status === 'queued').length;

  for (const [nodeId, bucket] of byNode.entries()) {
    if (bucket.error > 0) {
      out.set(nodeId, 'error');
      continue;
    }
    if (queuedModelCount > 0) {
      // At least one model still pending — the node is not fully done yet.
      out.set(nodeId, 'running');
      continue;
    }
    if (bucket.success > 0) {
      out.set(nodeId, 'success');
      continue;
    }
    out.set(nodeId, 'idle');
  }

  return out;
}

/**
 * PC-303 — group all events for a given node by model so the right-sidebar
 * Run Details panel can show "Bridge-01: ✓", "Bridge-02: ✗ (TypeError: ...)"
 * for every model the run touched.
 */
export function eventsForNode(
  fileDetails: FileDetail[] | undefined,
  nodeId: string,
): Array<{ model: string; status: 'success' | 'error'; error?: string | null }> {
  if (!fileDetails) return [];
  const out: Array<{ model: string; status: 'success' | 'error'; error?: string | null }> = [];
  for (const row of fileDetails) {
    if (!row.node_events) continue;
    for (const ev of row.node_events) {
      if (ev.node_id === nodeId) {
        out.push({ model: ev.model, status: ev.status, error: ev.error });
      }
    }
  }
  return out;
}
