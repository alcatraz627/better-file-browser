// One planted violation per code rule, for check-system.mjs --self-test. Never imported.
declare const el: HTMLElement, toast: (s: string) => void, kvGet: (k: string) => string;
el.addEventListener('keydown', () => {});
el.addEventListener('mousedown', () => {});
location.href = 'file:///tmp/';
kvGet('bfb-x');
el.innerHTML = '<select></select><span style="color:red"></span><svg></svg>';
try { /* */ } catch (e) { toast((e as Error).message); }
const home = '/Users/alcatraz627/';
