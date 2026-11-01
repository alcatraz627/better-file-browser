import { describe, it, expect } from 'vitest';
import { mergeAskStores, mergeAskHistory } from '../src/ask-merge';

const chat = (id: string, at: number, n = 1) => ({ id, at, title: id, turns: Array.from({ length: n }, (_, i) => ({ at: at - i, q: `q${i}` })) });

describe('mergeAskStores', () => {
  it('keeps a chat asked on the phone beside the Mac copy', () => {
    const mac = { '/a': [chat('m1', 100)] };
    const phone = { '/a': [chat('p1', 200)], '/b': [chat('p2', 50)] };
    const out = mergeAskStores(mac, phone);
    expect(out['/a'].map(c => c.id)).toEqual(['p1', 'm1']);
    expect(out['/b'].map(c => c.id)).toEqual(['p2']);
  });
  it('the same chat keeps the copy with more turns', () => {
    const out = mergeAskStores({ '/a': [chat('c', 100, 1)] }, { '/a': [chat('c', 90, 3)] });
    expect(out['/a']).toHaveLength(1);
    expect(out['/a'][0].turns).toHaveLength(3);
  });
  it('same turns: the later one wins', () => {
    const out = mergeAskStores({ '/a': [chat('c', 100)] }, { '/a': [chat('c', 300)] });
    expect(out['/a'][0].at).toBe(300);
  });
  it('survives a missing or broken copy', () => {
    expect(mergeAskStores(undefined, { '/a': [chat('c', 1)] })['/a']).toHaveLength(1);
    expect(mergeAskStores({ '/a': [chat('c', 1)] }, 'junk')['/a']).toHaveLength(1);
    expect(mergeAskStores(null, null)).toEqual({});
    expect(mergeAskStores({ '/a': 'x' }, { '/a': [null, { id: 3 }] })).toEqual({});
  });
  it('joins the stored JSON text form too', () => {
    const out = JSON.parse(mergeAskHistory(JSON.stringify({ '/a': [chat('m', 1)] }), JSON.stringify({ '/a': [chat('p', 2)] })));
    expect(out['/a'].map((c: { id: string }) => c.id)).toEqual(['p', 'm']);
    expect(JSON.parse(mergeAskHistory('not json', undefined))).toEqual({});
  });
  it('caps a subject at 20 chats, newest kept', () => {
    const many = Array.from({ length: 25 }, (_, i) => chat(`c${i}`, i));
    const out = mergeAskStores({ '/a': many }, {});
    expect(out['/a']).toHaveLength(20);
    expect(out['/a'][0].id).toBe('c24');
  });
});
