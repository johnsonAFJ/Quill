import { SearchQuery } from '@codemirror/search';
import { EditorSelection, EditorState } from '@codemirror/state';
import { describe, expect, it } from 'vitest';
import { matchCount } from './find';

const DOC = 'The sea. The Sea. the SEA and the sea.';

describe('matchCount', () => {
  it('counts every match, ignoring capitals unless asked', () => {
    const state = EditorState.create({ doc: DOC });
    expect(matchCount(state, new SearchQuery({ search: 'sea', literal: true }))[1]).toBe(4);
    expect(matchCount(state, new SearchQuery({ search: 'sea', literal: true, caseSensitive: true }))[1]).toBe(2);
  });

  it('knows which match you are on', () => {
    const second = DOC.indexOf('Sea');
    const state = EditorState.create({ doc: DOC, selection: EditorSelection.range(second, second + 3) });
    expect(matchCount(state, new SearchQuery({ search: 'sea', literal: true }))).toEqual([2, 4]);
  });

  it('finds nothing for an empty search', () => {
    expect(matchCount(EditorState.create({ doc: DOC }), new SearchQuery({ search: '' }))).toEqual([0, 0]);
  });
});
