import { assert, expect, test } from 'vitest';
import { normalizationTable, normalize } from './hfsDecomposition.js';

test('normalizationTable の illegal と replaceWith に共通部分がない', () => {
  const illegalSet = new Set(normalizationTable.keys());
  const replaceSet = new Set([...normalizationTable.values()].flatMap((s) => [...s]));
  const intersectSet = <T>(aSet: ReadonlySet<T>, bSet: ReadonlySet<T>): Set<T> => {
    if (aSet.size > bSet.size) {
      [aSet, bSet] = [bSet, aSet];
    }
    const result: Set<T> = new Set();
    for (const elem of aSet) {
      if (bSet.has(elem)) {
        result.add(elem);
      }
    }
    return result;
  };
  const illegalAndReplaceSet = intersectSet(illegalSet, replaceSet);
  expect(illegalAndReplaceSet).to.be.empty;
});

test('normalize パプリカ', () => {
  expect('パプリカ').to.have.length(4);
  expect(normalize('パプリカ')).to.have.length(6);
  expect(normalize('パプリカ')).eq('パプリカ');
});
