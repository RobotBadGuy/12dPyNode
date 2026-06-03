// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseChainXml, chainToGraph } from '../chainImport';

const wrap = (commands: string) =>
  `<?xml version="1.0"?><xml12d xmlns="http://www.12d.com/schema/xml12d-10.0">` +
  `<meta_data></meta_data><Chain><version>1</version><Settings></Settings>` +
  `<Commands>${commands}</Commands></Chain></xml12d>`;

describe('parseChainXml', () => {
  it('returns the ordered command elements (by localName) under <Commands>', () => {
    const r = parseChainXml(wrap('<Clean_model></Clean_model><Create_view></Create_view>'));
    expect('error' in r).toBe(false);
    if ('error' in r) return;
    expect(r.commands.map((c) => c.localName)).toEqual(['Clean_model', 'Create_view']);
  });
  it('flags malformed XML', () => {
    const r = parseChainXml('<xml12d><Commands><broken></Commands>');
    expect('error' in r).toBe(true);
  });
  it('flags non-chain XML (no <Commands>)', () => {
    const r = parseChainXml('<?xml version="1.0"?><notachain><x/></notachain>');
    expect('error' in r && /chain/i.test((r as { error: string }).error)).toBe(true);
  });
  it('empty <Commands> yields zero commands (not an error)', () => {
    const r = parseChainXml(wrap(''));
    expect('error' in r).toBe(false);
    if (!('error' in r)) expect(r.commands).toHaveLength(0);
  });
});

function graphFor(commands: string) {
  const parsed = parseChainXml(wrap(commands));
  if ('error' in parsed) throw new Error(parsed.error);
  return chainToGraph(parsed);
}

describe('chainToGraph', () => {
  it('maps known commands to real nodes and synthesizes the foreach+output scaffold', () => {
    const g = graphFor(
      '<Clean_model><Name>n</Name><Model_Name>m</Model_Name><Comments></Comments>' +
        '<Continue_on_failure>true</Continue_on_failure></Clean_model>',
    );
    const types = g.nodes.map((n) => n.type).sort();
    expect(types).toEqual(['chainFileOutput', 'cleanModel', 'foreachModel'].sort());
    expect(g.report).toMatchObject({ total: 1, mapped: 1, placeholders: [], modelSourceMissing: true });
  });

  it('wires flow edges in document order: foreach -> cmd0 -> cmd1 -> output', () => {
    const g = graphFor('<Clean_model></Clean_model><Add_model_to_view></Add_model_to_view>');
    expect(g.edges).toHaveLength(3); // foreach->c0, c0->c1, c1->output
    expect(g.edges.every((e) => e.sourceHandle === 'flow:output' && e.targetHandle === 'flow:input')).toBe(true);
    expect(g.edges[0].source).toBe('imported-foreach');
    expect(g.edges[g.edges.length - 1].target).toBe('imported-output');
  });

  it('unknown command -> stickyNote placeholder preserving raw XML; counted in report', () => {
    const g = graphFor('<Manual_option><Name>panel thing</Name></Manual_option>');
    const sticky = g.nodes.find((n) => n.type === 'stickyNote');
    expect(sticky).toBeTruthy();
    expect(String((sticky!.data as Record<string, unknown>).text)).toContain('Manual_option');
    expect(g.report).toMatchObject({ total: 1, mapped: 0, placeholders: [{ element: 'Manual_option', count: 1 }] });
  });

  it('a group-leader <Label> (followed by <Function>) is a placeholder, not addLabel', () => {
    const g = graphFor('<Label><Name>run tin function</Name></Label><Function></Function>');
    expect(g.nodes.some((n) => n.type === 'addLabel')).toBe(false);
    expect(g.nodes.filter((n) => n.type === 'stickyNote')).toHaveLength(2);
  });

  it('a standalone <Label> maps to addLabel', () => {
    const g = graphFor(
      '<Label><Name>L1</Name><Comments></Comments><Continue_on_failure>true</Continue_on_failure></Label>',
    );
    expect(g.nodes.some((n) => n.type === 'addLabel')).toBe(true);
  });

  it('zero commands -> foreach wired straight to output, mapped 0', () => {
    const g = graphFor('');
    expect(g.edges).toHaveLength(1);
    expect(g.edges[0]).toMatchObject({ source: 'imported-foreach', target: 'imported-output' });
    expect(g.report).toMatchObject({ total: 0, mapped: 0 });
  });
});

const fixture = (name: string) => readFileSync(join(__dirname, 'fixtures', name), 'utf8');

describe('round-trip golden fixture', () => {
  it('imports a generator-produced chain into the expected clean nodes', () => {
    const parsed = parseChainXml(fixture('clean-view.chain'));
    if ('error' in parsed) throw new Error(parsed.error);
    const g = chainToGraph(parsed);
    const real = g.nodes.filter((n) => !['foreachModel', 'chainFileOutput'].includes(n.type as string));
    expect(real.map((n) => n.type)).toEqual(['cleanModel', 'createView', 'addModelToView']);
    expect(g.report).toMatchObject({ total: 3, mapped: 3, placeholders: [] });
    const clean = real[0].data as Record<string, unknown>;
    expect(clean.modelName).toBe('Alpha');
    const view = real[1].data as Record<string, unknown>;
    expect(view.modifiedVariable).toBe('Alpha View');
    expect(view.coordinates).toEqual([40, 30, 565, 715]);
  });

  it('hand-authored chain: maps the known command, placeholders the panel command', () => {
    const parsed = parseChainXml(fixture('handauthored.chain'));
    if ('error' in parsed) throw new Error(parsed.error);
    const g = chainToGraph(parsed);
    expect(g.report).toMatchObject({
      total: 2,
      mapped: 1,
      placeholders: [{ element: 'Manual_option', count: 1 }],
    });
  });
});
