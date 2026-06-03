// PC-1101 — the inverse of the backend command generators: maps a 12d `.chain`
// command element back to a PyChain node type + node-data. v1 contains ONLY the
// cleanly-invertible commands (see the spec's Coverage table); everything else is
// placeholdered by chainToGraph. Element matching is by `localName` because the
// .chain XML uses a default namespace.

/** First DIRECT child element matching localName (namespace-agnostic), trimmed text. */
export function childTextByLocalName(el: Element, localName: string): string | undefined {
  for (const child of Array.from(el.children)) {
    if (child.localName === localName) return (child.textContent ?? '').trim();
  }
  return undefined;
}

/** 12d emits booleans as the strings 'true'/'false'. Anything else defaults to true (the node default). */
export function parseChainBool(s: string | undefined): boolean {
  const v = (s ?? '').trim().toLowerCase();
  if (v === 'true') return true;
  if (v === 'false') return false;
  return true;
}

export interface CommandMapping {
  nodeType: string;
  toData: (el: Element) => Record<string, unknown>;
}

const t = childTextByLocalName;
const b = (el: Element) => parseChainBool(t(el, 'Continue_on_failure'));
const comments = (el: Element) => t(el, 'Comments') ?? '';

/** Keyed by the command element's localName. Only cleanly-invertible commands (PC-1101 v1). */
export const CHAIN_COMMAND_MAP: Record<string, CommandMapping> = {
  Clean_model: {
    nodeType: 'cleanModel',
    toData: (el) => ({
      commandName: t(el, 'Name'),
      modelName: t(el, 'Model_Name'),
      comments: comments(el),
      continueOnFailure: b(el),
    }),
  },
  Create_view: {
    nodeType: 'createView',
    toData: (el) => ({
      modifiedVariable: t(el, 'View'),
      coordinates: ['Top', 'Left', 'Bot', 'Right'].map((k) => Number(t(el, k))),
      comments: comments(el),
      continueOnFailure: b(el),
    }),
  },
  Add_model_to_view: {
    nodeType: 'addModelToView',
    toData: (el) => ({
      modelName: t(el, 'Model'),
      viewName: t(el, 'View'),
      comments: comments(el),
      continueOnFailure: b(el),
    }),
  },
  Remove_model_from_view: {
    nodeType: 'removeModelFromView',
    toData: (el) => ({
      pattern: t(el, 'Model'),
      modifiedVariable: t(el, 'View'),
      comments: comments(el),
      continueOnFailure: b(el),
    }),
  },
  Comment: {
    nodeType: 'addComment',
    toData: (el) => ({ commentName: t(el, 'Name'), comments: comments(el), continueOnFailure: b(el) }),
  },
  Label: {
    nodeType: 'addLabel',
    toData: (el) => ({ labelName: t(el, 'Name'), comments: comments(el), continueOnFailure: b(el) }),
  },
};
