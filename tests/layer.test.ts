import { describe, it, expect, beforeEach } from 'vitest';
import { openLayer, topmost, closeAll, rovingFocus } from '../src/layer';

const mk = (html = '<button>a</button><button>b</button>') => { const d = document.createElement('div'); d.innerHTML = html; return d; };
const key = (k: string, target: EventTarget = document) => target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
const press = (target: EventTarget) => target.dispatchEvent(new Event('pointerdown', { bubbles: true }));

describe('layers', () => {
  beforeEach(() => { closeAll(); document.body.innerHTML = '<div id="fe"><button id="anchor">open</button><button id="other">x</button></div>'; });

  it('Esc closes only the topmost layer and reports why', () => {
    const whys: string[] = [];
    const a = openLayer(mk(), { kind: 'popover', onClose: w => whys.push('a:' + w) });
    const b = openLayer(mk(), { kind: 'popover', onClose: w => whys.push('b:' + w) });
    key('Escape');
    expect([a.open, b.open, whys]).toEqual([true, false, ['b:esc']]);
    key('Escape');
    expect(a.open).toBe(false);
    expect(topmost()).toBeNull();
  });

  it('a click outside closes a popover but not a dialog', () => {
    const d = openLayer(mk(), { kind: 'dialog' });
    press(document.getElementById('other')!);
    expect(d.open).toBe(true);
    d.close();
    const p = openLayer(mk(), { kind: 'popover' });
    press(document.getElementById('other')!);
    expect(p.open).toBe(false);
  });

  it('a click inside the layer leaves it open; a click on its anchor toggles it shut', () => {
    const anchor = document.getElementById('anchor')!;
    const el = mk();
    const p = openLayer(el, { kind: 'popover', anchor });
    press(el.querySelector('button')!);
    expect(p.open).toBe(true);
    expect(anchor.getAttribute('aria-expanded')).toBe('true');
    press(anchor);
    expect(p.open).toBe(false);
    expect(anchor.getAttribute('aria-expanded')).toBe('false');
  });

  it('opening a layer in the same group closes the other', () => {
    const a = openLayer(mk(), { kind: 'popover', group: 'menu' });
    const b = openLayer(mk(), { kind: 'popover', group: 'menu' });
    expect([a.open, b.open]).toEqual([false, true]);
  });

  it('focus moves into a modal layer and returns to the anchor on close', () => {
    const anchor = document.getElementById('anchor')!;
    anchor.focus();
    const el = mk();
    const d = openLayer(el, { kind: 'dialog', anchor });
    expect(el.contains(document.activeElement)).toBe(true);
    d.close();
    expect(document.activeElement).toBe(anchor);
    expect(el.isConnected).toBe(false);
  });

  it('arrow keys move focus among items and wrap', () => {
    const el = mk('<button class="i">1</button><button class="i">2</button><button class="i">3</button>');
    document.getElementById('fe')!.appendChild(el);
    rovingFocus(el, '.i');
    const items = [...el.querySelectorAll<HTMLElement>('.i')];
    items.forEach(i => Object.defineProperty(i, 'offsetParent', { get: () => el }));
    items[2].focus();
    key('ArrowDown', items[2]);
    expect(document.activeElement).toBe(items[0]);
    key('End', items[0]);
    expect(document.activeElement).toBe(items[2]);
  });
});
