// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { childTextByLocalName, parseChainBool, CHAIN_COMMAND_MAP } from '../chainCommandMap';

function el(xml: string): Element {
  // jsdom DOMParser. Namespace mirrors a real .chain so localName matching is exercised.
  const doc = new DOMParser().parseFromString(
    `<root xmlns="http://www.12d.com/schema/xml12d-10.0">${xml}</root>`,
    'application/xml',
  );
  return doc.documentElement;
}

function cmd(xml: string): Element {
  const doc = new DOMParser().parseFromString(
    `<root xmlns="http://www.12d.com/schema/xml12d-10.0">${xml}</root>`,
    'application/xml',
  );
  return doc.documentElement.children[0];
}

describe('childTextByLocalName', () => {
  it('returns the trimmed text of the first direct child with that localName', () => {
    expect(childTextByLocalName(el('<Name>  hi  </Name>'), 'Name')).toBe('hi');
  });
  it('ignores nested (non-direct) descendants of the same name', () => {
    const e = el('<Panel><Name>inner</Name></Panel><Name>outer</Name>');
    expect(childTextByLocalName(e, 'Name')).toBe('outer'); // only direct children
  });
  it('returns undefined when absent', () => {
    expect(childTextByLocalName(el('<Other>x</Other>'), 'Name')).toBeUndefined();
  });
});

describe('parseChainBool', () => {
  it("'true' -> true", () => expect(parseChainBool('true')).toBe(true));
  it("'false' -> false", () => expect(parseChainBool('false')).toBe(false));
  it('defaults missing/odd to true', () => {
    expect(parseChainBool(undefined)).toBe(true);
    expect(parseChainBool('')).toBe(true);
  });
});

describe('CHAIN_COMMAND_MAP', () => {
  it('Clean_model -> cleanModel with params', () => {
    const m = CHAIN_COMMAND_MAP['Clean_model'];
    expect(m.nodeType).toBe('cleanModel');
    expect(
      m.toData(
        cmd(
          '<Clean_model><Name>Clean model X</Name><Continue_on_failure>false</Continue_on_failure>' +
            '<Comments>c</Comments><Model_Name>RoadA</Model_Name></Clean_model>',
        ),
      ),
    ).toEqual({ commandName: 'Clean model X', modelName: 'RoadA', comments: 'c', continueOnFailure: false });
  });

  it('Create_view -> createView reassembles the coordinate 4-tuple', () => {
    const m = CHAIN_COMMAND_MAP['Create_view'];
    expect(m.nodeType).toBe('createView');
    expect(
      m.toData(
        cmd(
          '<Create_view><View>Plan</View><Continue_on_failure>true</Continue_on_failure><Comments></Comments>' +
            '<Top>40</Top><Left>30</Left><Bot>565</Bot><Right>715</Right></Create_view>',
        ),
      ),
    ).toEqual({ modifiedVariable: 'Plan', coordinates: [40, 30, 565, 715], comments: '', continueOnFailure: true });
  });

  it('Add_model_to_view -> addModelToView', () => {
    expect(
      CHAIN_COMMAND_MAP['Add_model_to_view'].toData(
        cmd(
          '<Add_model_to_view><Model>RoadA</Model><View>Plan</View>' +
            '<Continue_on_failure>true</Continue_on_failure><Comments></Comments></Add_model_to_view>',
        ),
      ),
    ).toEqual({ modelName: 'RoadA', viewName: 'Plan', comments: '', continueOnFailure: true });
  });

  it('Remove_model_from_view -> removeModelFromView (Model is the pattern)', () => {
    expect(
      CHAIN_COMMAND_MAP['Remove_model_from_view'].toData(
        cmd(
          '<Remove_model_from_view><Model>*tin</Model><View>Plan</View>' +
            '<Continue_on_failure>true</Continue_on_failure><Comments></Comments></Remove_model_from_view>',
        ),
      ),
    ).toEqual({ pattern: '*tin', modifiedVariable: 'Plan', comments: '', continueOnFailure: true });
  });

  it('Comment -> addComment', () => {
    expect(
      CHAIN_COMMAND_MAP['Comment'].toData(
        cmd('<Comment><Name>note</Name><Continue_on_failure>true</Continue_on_failure><Comments>hi</Comments></Comment>'),
      ),
    ).toEqual({ commentName: 'note', comments: 'hi', continueOnFailure: true });
  });

  it('Label -> addLabel', () => {
    expect(
      CHAIN_COMMAND_MAP['Label'].toData(
        cmd('<Label><Name>L1</Name><Continue_on_failure>true</Continue_on_failure><Comments></Comments></Label>'),
      ),
    ).toEqual({ labelName: 'L1', comments: '', continueOnFailure: true });
  });
});
