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

  it('Esc closes an open hover card and the layer under it together', () => {
    const p = openLayer(mk(), { kind: 'popover' });
    const card = openLayer(mk(), { kind: 'hovercard' });
    key('Escape');
    expect([card.open, p.open]).toEqual([false, false]);
  });

  it('a transient never takes Esc', () => {
    const p = openLayer(mk(), { kind: 'popover' });
    const t = openLayer(mk(), { kind: 'transient' });
    key('Escape');
    expect([t.open, p.open]).toEqual([true, false]);
    t.close();
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
    // The click that ends the same press does not open it again.
    expect(openLayer(el, { kind: 'popover', anchor }).open).toBe(false);
    expect(openLayer(el, { kind: 'popover', anchor }).open).toBe(true);
  });

  it('a layer the page already holds stays in the page when it closes', () => {
    const own = mk();
    document.getElementById('fe')!.appendChild(own);
    const l = openLayer(own, { kind: 'popover' });
    expect(own.dataset.layer).toBe('popover');
    l.close();
    expect([own.isConnected, own.dataset.layer]).toEqual([true, undefined]);
  });

  it('a scroll closes an anchored layer only when its anchor moved', () => {
    const anchor = document.getElementById('anchor')!;
    let top = 10;
    anchor.getBoundingClientRect = () => ({ top, left: 0, right: 10, bottom: top + 10, width: 10, height: 10, x: 0, y: top, toJSON() {} }) as DOMRect;
    const p = openLayer(mk(), { kind: 'popover', anchor });
    document.dispatchEvent(new Event('scroll'));
    expect(p.open).toBe(true);
    top = 40;
    document.dispatchEvent(new Event('scroll'));
    expect(p.open).toBe(false);
  });

  it('a slow press on the anchor still only closes it; a key afterwards opens normally', async () => {
    const anchor = document.getElementById('anchor')!;
    const p = openLayer(mk(), { kind: 'popover', anchor });
    press(anchor);
    expect(p.open).toBe(false);
    await new Promise(r => setTimeout(r, 700));
    expect(openLayer(mk(), { kind: 'popover', anchor }).open).toBe(false);
    openLayer(mk(), { kind: 'popover', anchor }).close();
    press(anchor);
    key('Enter');
    const viaKey = openLayer(mk(), { kind: 'popover', anchor });
    expect(viaKey.open).toBe(true);
    viaKey.close();
  });

  it('a menu shown at a point closes on a scroll that moves its origin, not on any other', () => {
    const origin = document.getElementById('other')!;
    let top = 10;
    origin.getBoundingClientRect = () => ({ top, left: 0, right: 10, bottom: top + 10, width: 10, height: 10, x: 0, y: top, toJSON() {} }) as DOMRect;
    const m = openLayer(mk(), { kind: 'popover', place: 'point', point: { x: 5, y: 5 }, origin });
    document.dispatchEvent(new Event('scroll'));
    expect(m.open).toBe(true);
    top = 50;
    document.dispatchEvent(new Event('scroll'));
    expect(m.open).toBe(false);
  });

  it('a press that starts and ends on the backdrop closes a modal layer; a drag that ends there does not', () => {
    const el = mk('<div class="bd"></div><input>');
    const bd = el.querySelector<HTMLElement>('.bd')!, input = el.querySelector('input')!;
    const d = openLayer(el, { kind: 'dialog', backdrop: bd });
    press(input);
    bd.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(d.open).toBe(true);
    press(bd);
    bd.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(d.open).toBe(false);
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
