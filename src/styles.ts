// The file-explorer UI stylesheet, injected at runtime. Static — no interpolation.
export const CSS = `
*{box-sizing:border-box;margin:0;padding:0}
/* Palettes (design-system.md, Soft round 2): Slate is the default; Violet,
   Sand and Ink are picked in Settings. Each palette sets only the surface,
   text and accent colours below, so every rule reads the same tokens.
   Selection and hover are washes mixed from the accent, so they follow it. */
:root{
  --bg:#0f1316;--s1:#151b1f;--s2:#1c2328;--s3:#253039;
  --bd:#243038;--bd2:#34434d;--tx:#e7eef1;--mt:#a3b2ba;--dm:#7f9099;
  --ac:#3cc6c0;--on-ac:#0f1316;--dir:#a3b2ba;
  --shade:rgb(139 148 158 / .14);--shade2:rgb(139 148 158 / .24);
  --gold:#d29922;--green:#3fb950;
  --hover:color-mix(in srgb,var(--tx) 6%,transparent);--act:color-mix(in srgb,var(--ac) 18%,transparent);--r:6px;
  --card:color-mix(in srgb,var(--s1),var(--s2) 62%);--side:var(--s1);
  --t-fast:120ms;--t-base:180ms;--t-slow:260ms;--ease:cubic-bezier(.2,.8,.2,1);
  --mono:'SF Mono',Menlo,Consolas,monospace;
  --nc-red:#ff6b6b;--nc-orange:#ffa94d;--nc-yellow:#ffd43b;--nc-green:#51cf66;--nc-teal:#38d9a9;--nc-blue:#4dabf7;--nc-purple:#b197fc;--nc-pink:#f783ac;
}
/* The html:has twin of each rule paints the page behind #fe to match. */
#fe[data-theme="light"],html:has(#fe[data-theme="light"]){
  --bg:#eef3f5;--s1:#ffffff;--s2:#eaf0f2;--s3:#dde6ea;
  --bd:#dbe4e8;--bd2:#c5d2d8;--tx:#17232a;--mt:#4f6370;--dm:#6b7f8a;
  --ac:#0e8f8a;--on-ac:#ffffff;--dir:#5d717c;
  --shade:rgb(110 119 129 / .10);--shade2:rgb(110 119 129 / .18);
  --hover:color-mix(in srgb,var(--tx) 5%,transparent);--act:color-mix(in srgb,var(--ac) 14%,transparent);
  --card:var(--s1);--side:color-mix(in srgb,var(--s1),var(--bg) 45%);
  --nc-red:#d92d2d;--nc-orange:#d9730d;--nc-yellow:#b58900;--nc-green:#2b8a3e;--nc-teal:#0c8f78;--nc-blue:#1971c2;--nc-purple:#7048e8;--nc-pink:#c2255c;
}
#fe[data-palette="violet"],html:has(#fe[data-palette="violet"]){
  --bg:#101014;--s1:#17171d;--s2:#1f1f27;--s3:#292933;
  --bd:#2a2a33;--bd2:#3a3a46;--tx:#ececf1;--mt:#a9a9b8;--dm:#85859c;
  --ac:#9d7cff;--on-ac:#101014;--dir:#a9a9b8;
}
#fe[data-palette="violet"][data-theme="light"],html:has(#fe[data-palette="violet"][data-theme="light"]){
  --bg:#f4f4f7;--s1:#ffffff;--s2:#f0f0f5;--s3:#e6e6ee;
  --bd:#e3e3ea;--bd2:#cfcfdb;--tx:#1c1c24;--mt:#5d5d70;--dm:#76768c;
  --ac:#6d4aff;--on-ac:#ffffff;--dir:#6e6e84;
}
#fe[data-palette="sand"],html:has(#fe[data-palette="sand"]){
  --bg:#13110f;--s1:#1b1815;--s2:#24201c;--s3:#2f2a24;
  --bd:#2f2a25;--bd2:#433b33;--tx:#efe9e2;--mt:#b8ab9c;--dm:#958778;
  --ac:#e8789a;--on-ac:#13110f;--dir:#b8ab9c;
}
#fe[data-palette="sand"][data-theme="light"],html:has(#fe[data-palette="sand"][data-theme="light"]){
  --bg:#f6f2ec;--s1:#fffdfa;--s2:#f2ece4;--s3:#e8e0d5;
  --bd:#e6ddd1;--bd2:#d3c6b6;--tx:#2a221b;--mt:#6b5d4f;--dm:#867767;
  --ac:#c2406b;--on-ac:#ffffff;--dir:#7a6a5a;
}
#fe[data-palette="ink"],html:has(#fe[data-palette="ink"]){
  --bg:#0c0c0d;--s1:#141415;--s2:#1b1b1d;--s3:#252527;
  --bd:#242426;--bd2:#353538;--tx:#f2f2f3;--mt:#a8a8ad;--dm:#86868c;
  --ac:#f2f2f3;--on-ac:#0c0c0d;--dir:#a8a8ad;
}
#fe[data-palette="ink"][data-theme="light"],html:has(#fe[data-palette="ink"][data-theme="light"]){
  --bg:#f5f5f5;--s1:#ffffff;--s2:#f0f0f0;--s3:#e5e5e5;
  --bd:#e4e4e4;--bd2:#cfcfcf;--tx:#141414;--mt:#5c5c5c;--dm:#777777;
  --ac:#141414;--on-ac:#ffffff;--dir:#666666;
}
/* Button: plain by default (design-system.md). data-variant solid|outline|shade,
   data-shade (same as variant shade), data-hover-shade, data-icon (a circle),
   data-size sm. Every bar's buttons share these rules. */
.btn,#fe-bar button,#fe-toolbar button,#fe-fp-bar button,#fe-ql-hdr button,#fe-ql-hdr #fe-ql-open,.fe-ql-ai-btn,.fe-pbn{display:inline-flex;align-items:center;justify-content:center;gap:5px;height:26px;padding:0 8px;flex-shrink:0;
  border:1px solid transparent;border-radius:6px;background:none;color:var(--mt);font:inherit;font-size:var(--fs-md);
  line-height:1;white-space:nowrap;text-decoration:none;cursor:pointer;
  transition:background var(--t-fast) var(--ease),color var(--t-fast) var(--ease),border-color var(--t-fast) var(--ease)}
.btn:hover{color:var(--tx)}
.btn[data-hover-shade]:hover,#fe-bar button:hover,#fe-toolbar button:hover,#fe-fp-bar button:hover,#fe-ql-hdr button:hover,#fe-ql-hdr #fe-ql-open:hover,.fe-ql-ai-btn:hover,.fe-pbn:hover{color:var(--tx);background:var(--shade)}
.btn[data-variant="shade"],#fe-bar button[data-variant="shade"],#fe-toolbar button[data-variant="shade"],#fe-fp-bar button[data-variant="shade"],#fe-ql-hdr button[data-variant="shade"],#fe-ql-hdr #fe-ql-open[data-variant="shade"],.fe-ql-ai-btn[data-variant="shade"],.fe-pbn[data-variant="shade"],.btn[data-shade],#fe-bar button[data-shade],#fe-toolbar button[data-shade],#fe-fp-bar button[data-shade],#fe-ql-hdr button[data-shade],#fe-ql-hdr #fe-ql-open[data-shade],.fe-ql-ai-btn[data-shade],.fe-pbn[data-shade]{background:var(--shade)}
.btn[data-variant="shade"]:hover,#fe-bar button[data-variant="shade"]:hover,#fe-toolbar button[data-variant="shade"]:hover,#fe-fp-bar button[data-variant="shade"]:hover,#fe-ql-hdr button[data-variant="shade"]:hover,#fe-ql-hdr #fe-ql-open[data-variant="shade"]:hover,.fe-ql-ai-btn[data-variant="shade"]:hover,.fe-pbn[data-variant="shade"]:hover,.btn[data-shade]:hover,#fe-bar button[data-shade]:hover,#fe-toolbar button[data-shade]:hover,#fe-fp-bar button[data-shade]:hover,#fe-ql-hdr button[data-shade]:hover,#fe-ql-hdr #fe-ql-open[data-shade]:hover,.fe-ql-ai-btn[data-shade]:hover,.fe-pbn[data-shade]:hover{background:var(--shade2)}
.btn[data-variant="outline"],#fe-bar button[data-variant="outline"],#fe-toolbar button[data-variant="outline"],#fe-fp-bar button[data-variant="outline"],#fe-ql-hdr button[data-variant="outline"],#fe-ql-hdr #fe-ql-open[data-variant="outline"],.fe-ql-ai-btn[data-variant="outline"],.fe-pbn[data-variant="outline"]{border-color:var(--bd2)}
.btn[data-variant="outline"]:hover,#fe-bar button[data-variant="outline"]:hover,#fe-toolbar button[data-variant="outline"]:hover,#fe-fp-bar button[data-variant="outline"]:hover,#fe-ql-hdr button[data-variant="outline"]:hover,#fe-ql-hdr #fe-ql-open[data-variant="outline"]:hover,.fe-ql-ai-btn[data-variant="outline"]:hover,.fe-pbn[data-variant="outline"]:hover{border-color:var(--mt)}
.btn[data-variant="solid"],#fe-bar button[data-variant="solid"],#fe-toolbar button[data-variant="solid"],#fe-fp-bar button[data-variant="solid"],#fe-ql-hdr button[data-variant="solid"],#fe-ql-hdr #fe-ql-open[data-variant="solid"],.fe-ql-ai-btn[data-variant="solid"],.fe-pbn[data-variant="solid"]{background:var(--ac);color:var(--on-ac)}
.btn[data-variant="solid"]:hover,#fe-bar button[data-variant="solid"]:hover,#fe-toolbar button[data-variant="solid"]:hover,#fe-fp-bar button[data-variant="solid"]:hover,#fe-ql-hdr button[data-variant="solid"]:hover,#fe-ql-hdr #fe-ql-open[data-variant="solid"]:hover,.fe-ql-ai-btn[data-variant="solid"]:hover,.fe-pbn[data-variant="solid"]:hover{background:var(--ac);color:var(--on-ac);filter:brightness(1.1)}
.btn[data-icon],#fe-bar button[data-icon],#fe-toolbar button[data-icon],#fe-fp-bar button[data-icon],#fe-ql-hdr button[data-icon],#fe-ql-hdr #fe-ql-open[data-icon],.fe-ql-ai-btn[data-icon],.fe-pbn[data-icon]{width:26px;padding:0;border-radius:50%}
.btn[data-size="sm"],#fe-bar button[data-size="sm"],#fe-toolbar button[data-size="sm"],#fe-fp-bar button[data-size="sm"],#fe-ql-hdr button[data-size="sm"],#fe-ql-hdr #fe-ql-open[data-size="sm"],.fe-ql-ai-btn[data-size="sm"],.fe-pbn[data-size="sm"]{height:22px;font-size:var(--fs-sm)}
.btn[data-size="sm"][data-icon],#fe-bar button[data-size="sm"][data-icon],#fe-toolbar button[data-size="sm"][data-icon],#fe-fp-bar button[data-size="sm"][data-icon],#fe-ql-hdr button[data-size="sm"][data-icon],#fe-ql-hdr #fe-ql-open[data-size="sm"][data-icon],.fe-ql-ai-btn[data-size="sm"][data-icon],.fe-pbn[data-size="sm"][data-icon]{width:22px}
.btn.on,#fe-bar button.on,#fe-toolbar button.on,#fe-fp-bar button.on,#fe-ql-hdr button.on,#fe-ql-hdr #fe-ql-open.on,.fe-ql-ai-btn.on,.fe-pbn.on,.btn.active,#fe-bar button.active,#fe-toolbar button.active,#fe-fp-bar button.active,#fe-ql-hdr button.active,#fe-ql-hdr #fe-ql-open.active,.fe-ql-ai-btn.active,.fe-pbn.active{color:var(--ac);background:var(--shade)}
.btn:disabled,#fe-bar button:disabled,#fe-toolbar button:disabled,#fe-fp-bar button:disabled,#fe-ql-hdr button:disabled,#fe-ql-hdr #fe-ql-open:disabled,.fe-ql-ai-btn:disabled,.fe-pbn:disabled{opacity:.45;cursor:default;background:none}
.btn:focus-visible,#fe-bar button:focus-visible,#fe-toolbar button:focus-visible,#fe-fp-bar button:focus-visible,#fe-ql-hdr button:focus-visible,#fe-ql-hdr #fe-ql-open:focus-visible,.fe-ql-ai-btn:focus-visible,.fe-pbn:focus-visible{outline:2px solid var(--ac);outline-offset:1px}
.btn svg,#fe-bar button svg,#fe-toolbar button svg,#fe-fp-bar button svg,#fe-ql-hdr button svg,#fe-ql-hdr #fe-ql-open svg,.fe-ql-ai-btn svg,.fe-pbn svg{flex:none}
@media (prefers-reduced-motion:reduce){.btn,#fe-bar button,#fe-toolbar button,#fe-fp-bar button,#fe-ql-hdr button,#fe-ql-hdr #fe-ql-open,.fe-ql-ai-btn,.fe-pbn{transition:none}}
html,body{height:100%;background:var(--bg);color:var(--tx);
  font:var(--fs-lg)/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;overflow:hidden}
body{opacity:1!important}
#fe{display:flex;flex-direction:column;height:100vh;background:var(--bg);color:var(--tx)}
#fe-bar{display:flex;align-items:center;gap:6px;padding:8px 14px;
  background:var(--s1);border-bottom:1px solid var(--bd);flex-shrink:0;min-height:42px}
#fe-bc{display:flex;align-items:center;gap:1px;flex:1;overflow:hidden;white-space:nowrap;min-width:0}
.fe-crumb{color:var(--mt);text-decoration:none;padding:2px 5px;border-radius:4px;
  font-size:var(--fs-md);flex-shrink:0;transition:background .1s,color .1s}
.fe-cg{display:inline-flex;align-items:center;flex-shrink:0;min-width:0}
.fe-cg[hidden]{display:none}
.fe-crumb.cur{color:var(--tx);font-weight:500}
/* The current folder and a file name keep their full width while middle
   folders fold; past that they shorten, but never below a readable share. */
.fe-crumb.cur,.fe-crumb-file{flex-shrink:0;max-width:45%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fe-cg:has(.cur){flex-shrink:0;max-width:45%}
.fe-cg:has(.cur) .fe-crumb.cur{max-width:100%}
.fe-crumb-more{flex:none;background:none;border:0;color:var(--mt);cursor:pointer;font:inherit;font-size:var(--fs-md);padding:2px 6px;border-radius:4px;line-height:1}
#fe-bar .fe-crumb-more[hidden]{display:none}
.fe-crumb-more:hover{background:var(--hover);color:var(--tx)}
.fe-crumb:hover{background:var(--hover);color:var(--tx)}
.fe-sep{color:var(--dm);font-size:var(--fs-sm);flex-shrink:0;padding:0 1px}
#fe-bar .fe-crumb-dd{background:none;border:none;color:var(--dm);cursor:pointer;
  padding:0 2px;font-size:var(--fs-xs);border-radius:3px;line-height:1;opacity:0.35;
  transition:opacity .1s,color .1s,background .1s;flex-shrink:0;min-width:0}
#fe-bar .fe-crumb-dd:hover{background:var(--hover);color:var(--ac);opacity:1;border:none}
#fe-bar .fe-crumb-dd svg{display:block}
#fe-crumb-menu{
  position:fixed;z-index:300;
  background:var(--s1);border:1px solid var(--bd);border-radius:var(--r);
  min-width:220px;max-width:340px;max-height:340px;overflow:hidden;
  box-shadow:0 8px 24px #0009;display:none;padding:4px 0;
}
.fe-dd-search-wrap{padding:5px 8px 7px;border-bottom:1px solid var(--bd)}
.fe-dd-search{width:100%;background:var(--bg);border:1px solid var(--bd);color:var(--tx);
  padding:4px 8px;border-radius:5px;font-size:var(--fs-md);outline:none;box-sizing:border-box}
.fe-dd-search:focus{border-color:var(--ac)}
.fe-dd-items{max-height:288px;overflow-y:auto;padding:2px 0}
.fe-dd-item{display:flex;align-items:center;gap:8px;padding:6px 12px;
  color:var(--tx);text-decoration:none;font-size:var(--fs-md);white-space:nowrap;
  overflow:hidden;text-overflow:ellipsis;transition:background .08s}
.fe-dd-item:hover{background:var(--hover)}
.fe-dd-item.dir{color:var(--dir)}
.fe-dd-item svg{flex-shrink:0}
.fe-dd-spinner,.fe-dd-empty{padding:10px 14px;font-size:var(--fs-md);color:var(--dm);font-style:italic}
#fe-bm-btn.on,#fe-bm-btn.on:hover{color:var(--gold)}
#fe-theme-btn #fe-sun{display:none}
#fe-theme-btn #fe-moon{display:block}
#fe[data-theme="light"] #fe-theme-btn #fe-sun{display:block}
#fe[data-theme="light"] #fe-theme-btn #fe-moon{display:none}
#fe-body{display:flex;flex:1;overflow:hidden}
#fe-side{width:272px;flex-shrink:0;background:var(--s1);border-right:1px solid var(--bd);display:flex;flex-direction:column;min-height:0;overflow:hidden}
/* The lens bar sits on top: icons in a row, the open lens grown to show its
   name; the wheel over the bar moves between lenses. The lens fills the rest. */
#fe-rail{flex:none;display:flex;align-items:center;gap:1px;padding:6px 6px;border-bottom:1px solid var(--bd);overflow:hidden}
.fe-rail-btn{flex:0 1 auto;min-width:26px;height:30px;display:flex;align-items:center;justify-content:center;gap:0;padding:0 5px;border:0;border-radius:8px;background:none;color:var(--mt);cursor:pointer;
  font:inherit;transition:background var(--t-fast) var(--ease),color var(--t-fast) var(--ease),flex-grow var(--t-base) var(--ease),gap var(--t-base) var(--ease)}
.fe-rail-btn[hidden]{display:none}
.fe-rail-btn svg{width:16px;height:16px;flex:none}
.fe-rail-btn em{font-style:normal;font-size:var(--fs-md);font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:0;opacity:0;
  transition:max-width var(--t-base) var(--ease),opacity var(--t-base) var(--ease)}
.fe-rail-btn.on{flex:1 0 auto;gap:6px;padding:0 9px}
.fe-rail-btn.on em{max-width:110px;opacity:1}
#fe-rail.measuring .fe-rail-btn,#fe-rail.measuring .fe-rail-btn em{transition:none}
#fe-rail.tight .fe-rail-btn{flex:1 1 0;min-width:22px;padding:0 3px}
#fe-rail.tight .fe-rail-btn.on{gap:0}
#fe-rail.tight .fe-rail-btn em{display:none}
@media (prefers-reduced-motion:reduce){.fe-rail-btn,.fe-rail-btn em{transition:none}}
.fe-rail-btn:hover{background:var(--hover);color:var(--tx)}
.fe-rail-btn.on{background:color-mix(in srgb,var(--ac) 16%,transparent);color:var(--tx)}
.fe-rail-btn.on:hover{background:color-mix(in srgb,var(--ac) 22%,transparent)}
.fe-rail-btn:focus-visible{outline:2px solid var(--ac);outline-offset:1px}
#fe-lenses{flex:1;min-width:0;overflow-y:auto;padding:6px 0}
.fe-lens[hidden]{display:none}
.fe-lens-h{display:flex;align-items:center;gap:8px;padding:6px 12px 8px 14px}
.fe-lens-ico{display:inline-flex;color:var(--mt)}
.fe-lens-ico svg{width:16px;height:16px}
.fe-doc-row{display:flex;align-items:center;gap:10px;width:calc(100% - 12px);margin:1px 6px;padding:6px 10px;border:0;border-radius:var(--row-r);background:none;color:var(--tx);font:inherit;text-align:left;cursor:pointer}
.fe-doc-row:hover{background:var(--hover)}
.fe-doc-tx{flex:1;min-width:0;display:flex;flex-direction:column;line-height:1.3}
.fe-doc-name,.fe-doc-dir{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fe-doc-name{font-size:var(--row-fs)}
.fe-docs-top[hidden]{display:none}
.fe-doc-dir{font-size:var(--fs-sm);color:var(--dm)}
.fe-doc-me{display:inline-flex;color:var(--ac)}
.fe-doc-me svg{width:13px;height:13px}
.fe-doc-due{font-size:var(--fs-sm);color:var(--tx);padding:0 6px;border-radius:999px;background:color-mix(in srgb,var(--nc-orange) 16%,transparent)}
.fe-doc-n{min-width:18px;height:18px;padding:0 5px;box-sizing:border-box;border-radius:999px;display:inline-grid;place-items:center;font-size:var(--fs-xs);background:var(--ac);color:var(--on-ac)}
.fe-doc-n.done{background:var(--s2);color:var(--dm)}
.fe-doc-n svg{width:10px;height:10px}
.fe-row-cm{flex:none;display:inline-flex;align-items:center;gap:3px;padding:0 6px;height:18px;border-radius:999px;vertical-align:middle;
  font-size:var(--fs-xs);color:var(--tx);background:color-mix(in srgb,var(--ac) 16%,transparent)}
.fe-row-cm svg{width:11px;height:11px}
.fe-lens-t{flex:1;display:flex;flex-direction:column;line-height:1.25;min-width:0}
.fe-lens-t b{font-size:var(--fs-xl);font-weight:600;color:var(--tx)}
.fe-lens-t i{font-style:normal;font-size:var(--fs-md);color:var(--dm)}
#fe-side-rz{width:5px;flex-shrink:0;cursor:col-resize;background:transparent;transition:background .12s}
#fe-side-rz:hover,#fe-side-rz.drag{background:var(--ac)}
.fe-sec{margin-bottom:4px}
.fe-sec.fe-collapsed>:not(.fe-sh){display:none!important}
.fe-sh{font-size:var(--fs-sm);font-weight:600;text-transform:uppercase;letter-spacing:.08em;
  color:var(--dm);padding:10px 14px 5px;display:flex;align-items:center;gap:6px}
#fe-side .fe-sh{justify-content:flex-start!important}
.fe-sh-collapse{min-height:24px;min-width:0;display:flex;align-items:center;gap:6px;padding:0;border:0;background:none;color:inherit;cursor:pointer;font:inherit;letter-spacing:inherit;text-transform:inherit;text-align:left}
.fe-sh-collapse svg{width:12px;height:12px;flex:none;transition:transform .12s}
.fe-collapsed .fe-sh-collapse svg{transform:rotate(-90deg)}
.fe-sh-collapse:hover,#fe-notes-root:hover{color:var(--tx)}
#fe-notes-root{display:grid;place-items:center;width:24px;height:24px;margin-left:auto;color:inherit}
#fe-notes-root svg{width:14px;height:14px}
#fe-notes-root:not([href]){opacity:.45;pointer-events:none}
.fe-si{display:flex;align-items:center;gap:10px;padding:8px 14px;
  color:var(--mt);text-decoration:none;transition:background .1s,color .1s}
.fe-si:hover{background:var(--hover);color:var(--tx)}
.fe-si.active{background:var(--act);color:var(--ac)}
button.fe-si{width:100%;border:0;background:none;font:inherit;text-align:left;cursor:pointer}
.fe-rc-ago{font-size:var(--fs-sm);color:var(--dm);flex-shrink:0}
.fe-si svg{flex-shrink:0;opacity:.7;width:19px;height:19px}
.fe-sl{font-size:var(--fs-lg);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;flex:1}
.fe-hint{font-size:var(--fs-md);color:var(--dm);padding:6px 14px;font-style:italic;line-height:1.7}
.fe-hint-action{border:0;background:none;color:var(--ac);padding:0;cursor:pointer;font:inherit;font-style:normal;text-decoration:underline;text-underline-offset:2px}
.fe-hint-action:hover{color:var(--tx)}
.fe-hint-action.fe-icon-act{display:inline-flex;align-items:center;gap:5px;margin-bottom:3px}
.fe-hint-action.fe-icon-act svg{width:13px;height:13px;flex:none}
.fe-bm-item{display:flex;align-items:center;gap:0;position:relative;user-select:none}
.fe-drag-h{padding:7px 4px 7px 10px;color:var(--dm);cursor:grab;opacity:0;transition:opacity .1s;flex-shrink:0;display:flex;align-items:center}
.fe-bm-item:hover .fe-drag-h{opacity:1}
.fe-bm-item.dragging{opacity:.4;background:var(--hover)}
.fe-bm-item.drag-over{border-top:2px solid var(--ac)}
.fe-si-link{display:flex;align-items:center;gap:10px;flex:1;padding:7px 6px 7px 4px;
  color:var(--mt);text-decoration:none;min-width:0;transition:color .1s}
.fe-si-link:hover{color:var(--tx)}
.fe-si-link.active{color:var(--ac)}
.fe-si-link svg{flex-shrink:0;opacity:.7;width:19px;height:19px}
.fe-rm-btn{background:none;border:none;color:var(--dm);cursor:pointer;
  padding:4px 10px 4px 4px;font-size:var(--fs-md);opacity:0;transition:opacity .1s,color .1s;flex-shrink:0}
.fe-bm-item:hover .fe-rm-btn{opacity:1}
.fe-rm-btn:hover{color:#f85149}
#fe-sv-add{background:none;border:1px solid var(--bd);color:var(--mt);cursor:pointer;border-radius:4px;
  width:18px;height:18px;line-height:1;font-size:var(--fs-lg);padding:0;display:flex;align-items:center;justify-content:center}
#fe-sv-add:hover{border-color:var(--ac);color:var(--ac)}
#fe-lens-filter,#fe-docs-q{display:block;width:calc(100% - 20px);margin:2px 10px 6px;box-sizing:border-box;background:var(--bg);border:1px solid var(--bd);color:var(--tx);
  padding:3px 8px;border-radius:var(--r);font-size:var(--fs-sm);outline:none;transition:border-color .15s}
#fe-lens-filter:focus,#fe-docs-q:focus{border-color:var(--ac)}
#fe-lens-filter::placeholder,#fe-docs-q::placeholder{color:var(--dm)}
.fe-pl-label.editing,.fe-pl-tags.editing{outline:1px solid var(--ac);border-radius:3px;background:var(--s2);padding:0 3px;cursor:text}
.fe-sv-tag{display:flex;align-items:center;gap:7px;padding:8px 14px 3px;font-size:var(--fs-sm);font-weight:600;
  text-transform:uppercase;letter-spacing:.07em;color:var(--dm)}
.fe-sv-dot{width:9px;height:9px;border-radius:50%;cursor:pointer;flex-shrink:0;box-shadow:0 0 0 1px #0004}
#fe-lens-filter[hidden],.fe-lens-tags[hidden]{display:none}
.fe-proxy-filter{display:none!important}
.fe-lens-tags{display:flex;flex-wrap:wrap;gap:4px;padding:0 10px 8px}
.fe-lens-tag{cursor:pointer;background:none;font:inherit;font-size:var(--fs-sm)}
.fe-lens-tag:hover{background:var(--hover)}
.fe-lens-tag.on{background:color-mix(in srgb,var(--chip) 22%,transparent);color:var(--tx)}
.fe-grp{margin:4px 8px;background:var(--s2);border-radius:10px;padding:0 0 4px}
.fe-grp:not([open]){padding-bottom:0}
.fe-grp > summary{list-style:none;cursor:pointer;padding:7px 8px 5px}
.fe-grp > summary::-webkit-details-marker{display:none}
.fe-grp > summary svg{width:10px;height:10px;flex:none;transition:transform var(--t-fast) var(--ease)}
.fe-grp:not([open]) > summary svg{transform:rotate(-90deg)}
.fe-grp-n{margin-left:auto;font-weight:500;color:var(--dm)}
@media (prefers-reduced-motion:reduce){.fe-grp > summary svg{transition:none}}
.fe-sv-dot:hover{transform:scale(1.25)}
.fe-pl-dots{display:flex;align-items:center;gap:3px;margin-left:auto;padding-right:2px;flex:none}
.fe-sv-mini{width:6px;height:6px;border-radius:50%;display:inline-block}
.fe-sv-more{font-size:var(--fs-xs);color:var(--dm);line-height:6px}
.fe-pl-tags{display:none;font-size:var(--fs-sm);color:var(--mt);min-width:60px;max-width:110px;white-space:nowrap;overflow:hidden}
.fe-pl-tags.show{display:inline-block}
.fe-tag-btn{background:none;border:none;color:var(--dm);cursor:pointer;padding:4px 4px;font-size:var(--fs-md);opacity:0;transition:opacity .1s,color .1s;flex-shrink:0}
.fe-bm-item:hover .fe-tag-btn{opacity:1}
.fe-tag-btn:hover{color:var(--ac)}
/* clip, not hidden: focusing a control past the edge must not scroll the pane sideways.
   The pane is a size container so its toolbar wraps by the pane's width, which a
   docked preview can make narrow in a wide window. */
#fe-main{flex:1;display:flex;flex-direction:column;overflow:clip;container:fe-main / inline-size;min-width:0}
#fe-toolbar{display:flex;align-items:center;gap:10px;padding:7px 14px;
  background:var(--s2);border-bottom:1px solid var(--bd);flex-shrink:0}
#fe-count{font-size:var(--fs-sm);color:var(--dm);flex:1;white-space:nowrap}
#fe-tb-right{display:flex;align-items:center;gap:6px}
#fe-zoom-wrap{display:flex;align-items:center;gap:5px;color:var(--dm)}
#fe-zoom{width:80px;accent-color:var(--ac);cursor:pointer}
#fe-zoom-val{font-size:var(--fs-xs);color:var(--dm);width:34px;text-align:right}
#fe-view-group{display:flex;gap:2px}
#fe-search{background:var(--bg);border:1px solid var(--bd);color:var(--tx);
  padding:4px 10px;border-radius:var(--r);font-size:var(--fs-md);width:150px;outline:none;transition:border-color .15s}
#fe-search:focus{border-color:var(--ac)}
#fe-search::placeholder{color:var(--dm)}
#fe-sg-panel,#fe-filter-bar{
  padding:8px 14px;background:var(--s1);border-bottom:1px solid var(--bd);flex-shrink:0}
.fe-panel-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.fe-panel-lbl{font-size:var(--fs-sm);color:var(--dm);font-weight:500;white-space:nowrap}
.fe-btn-group{display:flex;gap:4px;flex-wrap:wrap}
#fe-filter-q{background:var(--bg);border:1px solid var(--bd);color:var(--tx);
  padding:3px 8px;border-radius:var(--r);font-size:var(--fs-md);width:200px;outline:none;transition:border-color .15s}
#fe-filter-q:focus{border-color:var(--ac)}
#fe-type-filter{background:var(--s2);border:1px solid var(--bd);color:var(--tx);
  padding:3px 8px;border-radius:var(--r);font-size:var(--fs-md);outline:none;cursor:pointer}
#fe-regex-btn.active{background:var(--act);border-color:var(--ac);color:var(--ac)}
#fe-find-text{background:var(--bg);border:1px solid var(--bd);color:var(--tx);padding:4px 8px;border-radius:5px;font-size:var(--fs-md);width:260px;outline:none}
#fe-find-text:focus{border-color:var(--ac)}
#fe-find-status{font-size:var(--fs-sm);color:var(--mt);margin-left:4px}
.fe-view .fe-si-link svg{color:var(--ac);opacity:.9}
#fe-scroll{flex:1;overflow-y:auto;transform-origin:top left}
#fe-table{width:100%;border-collapse:collapse;table-layout:fixed}
thead{position:sticky;top:0;z-index:5;background:var(--s2)}
thead th{padding:6px 12px;text-align:left;font-size:var(--fs-sm);font-weight:600;
  text-transform:uppercase;letter-spacing:.07em;color:var(--dm);
  border-bottom:1px solid var(--bd);user-select:none;white-space:nowrap}
thead th{position:relative}
thead th[data-sort]{cursor:pointer}
thead th[data-sort]:hover{color:var(--tx)}
.fe-col-rz{position:absolute;top:0;right:0;width:7px;height:100%;cursor:col-resize;user-select:none}
.fe-col-rz:hover{background:linear-gradient(90deg,transparent,var(--ac))}
/* Rendered tables (markdown, CSV/TSV) share the handle; col-resize.ts fixes
   the layout on the first drag so one column moves at a time. */
.fe-md-table th{position:relative}
table.fe-rz-fixed{table-layout:fixed}
.fe-ql-table.fe-rz-fixed th,.fe-ql-table.fe-rz-fixed td{overflow:hidden;text-overflow:ellipsis}
.fe-md-table.fe-rz-fixed td,.fe-md-table.fe-rz-fixed th{overflow-wrap:anywhere}
body.fe-col-dragging{cursor:col-resize;user-select:none}
.si{opacity:.35;font-size:var(--fs-xs)}
th.sorted .si{opacity:1;color:var(--ac)}
.c-nm{width:40%}.c-tp{width:14%}.c-tg{width:14%}.c-sz{width:11%;text-align:right}.c-dt{width:21%}
td.c-tg{white-space:nowrap;overflow:hidden}
/* Named chips give up width (ending in …) before the +N count does. */
.fe-chips{display:flex;min-width:0;overflow:hidden}
.fe-chips .fe-chip{display:block;flex:0 1 auto;min-width:28px;overflow:hidden;text-overflow:ellipsis;line-height:16px}
.fe-chips .fe-chip-more{flex:none;min-width:0}
.fe-chip{display:inline-flex;align-items:center;height:18px;padding:0 7px;margin-right:4px;border:1px solid color-mix(in srgb,var(--chip,var(--bd2)) 55%,transparent);
  border-radius:9px;font-size:var(--fs-sm);color:var(--mt);line-height:1}
.c-match{display:none;text-align:right;width:72px;color:var(--dm)}
#fe.fe-has-find-hits[data-view="details"] .c-match{display:table-cell}
#fe.fe-has-find-hits[data-view="details"] .c-nm{width:42%}
#fe.fe-has-find-hits[data-view="details"] .c-dt{width:19%}
.fe-find-snippet{display:block;color:var(--dm);font-size:var(--fs-sm);margin:3px 0 1px 22px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fe-find-snippet mark{background:var(--ac);color:var(--bg);border-radius:2px;padding:0 1px}
.fe-find-badge{display:inline-block;color:var(--ac);border:1px solid var(--bd);border-radius:8px;padding:0 5px;font-size:var(--fs-xs);margin-left:22px}
#fe-find-error{color:#f85149;font-size:var(--fs-sm)}
#fe[data-view="details"] .fe-row .fe-find-badge{display:none}
tbody tr{border-bottom:1px solid var(--bg);transition:background .08s}
tbody tr:hover{background:var(--hover)}
tbody td{padding:5px 12px;vertical-align:middle}
td.c-sz{text-align:right;white-space:nowrap;color:var(--dm);font-variant-numeric:tabular-nums;font-size:var(--fs-md)}
td.c-dt{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--dm);font-size:var(--fs-md)}
td.c-tp{color:var(--dm);font-size:var(--fs-sm)}
.fe-lnk{display:flex;align-items:center;gap:8px;text-decoration:none;color:var(--tx)}
.fe-lnk svg{flex-shrink:0}
.fe-lnk:hover .fe-nm{color:var(--ac);text-decoration:underline}
.fe-nm{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dir .fe-nm{color:var(--dir)}
.par td.c-nm .fe-nm{color:var(--dm)}
.par:hover .fe-nm{color:var(--mt)}
.dotfile{opacity:.65}
.fe-group-hdr td{padding:5px 12px;font-size:var(--fs-sm);font-weight:600;
  text-transform:uppercase;letter-spacing:.08em;color:var(--dm);
  background:var(--s2);border-bottom:1px solid var(--bd);border-top:1px solid var(--bd)}
.fe-group-hdr-tile{width:100%;padding:6px 4px 2px;font-size:var(--fs-sm);font-weight:600;
  text-transform:uppercase;letter-spacing:.08em;color:var(--dm)}
#fe:not(.show-hidden) .fe-row.dotfile,
#fe:not(.show-hidden) .fe-tile.dotfile,
#fe:not(.show-hidden) .fe-tree-row.dotfile{display:none!important}
#fe[data-view="list"] .c-tp,#fe[data-view="list"] .c-tg,#fe[data-view="list"] .c-sz,#fe[data-view="list"] .c-dt{display:none}
#fe[data-view="list"] .c-nm{width:100%}
#fe[data-view="list"] tbody td{padding:4px 12px}
#fe-tiles{display:none;flex-wrap:wrap;gap:4px 6px;padding:10px 12px;align-content:flex-start;align-items:flex-start}
#fe[data-view="tiles"] #fe-table,#fe[data-view="icons"] #fe-table{display:none}
#fe[data-view="tree"] #fe-table{display:none}
#fe-tree{display:none;padding:6px 0}
#fe[data-view="tree"] #fe-tree{display:block}
#fe[data-view="tree"] #fe-tiles{display:none}
.fe-tree-row{display:flex;align-items:center;min-height:29px;padding-right:12px;gap:4px}
.fe-tree-row:hover{background:var(--hover)}
.fe-tree-row.selected{background:var(--act)}
.fe-tree-row.selected .fe-nm{color:var(--ac)}
.fe-tree-toggle,.fe-tree-spacer{width:20px;height:20px;flex:none}
.fe-tree-toggle{display:flex;align-items:center;justify-content:center;border:0;background:none;color:var(--dm);cursor:pointer;border-radius:4px}
.fe-tree-toggle:hover{background:var(--s2);color:var(--tx)}
.fe-tree-toggle svg{width:12px;height:12px;transform:rotate(-90deg)}
.fe-tree-toggle[aria-expanded="true"] svg{transform:none}
.fe-tree-link{display:flex;align-items:center;gap:8px;color:var(--tx);text-decoration:none;min-width:0}
.fe-tree-link svg{flex:none}
.fe-tree-link:hover .fe-nm{text-decoration:underline;color:var(--ac)}
.fe-tree-message{padding:4px 12px;color:var(--dm);font-size:var(--fs-sm)}
#fe[data-view="tiles"] #fe-tiles,#fe[data-view="icons"] #fe-tiles{display:flex}
.fe-tile{display:flex;flex-direction:column;align-items:center;gap:3px;
  padding:8px 6px 7px;border-radius:var(--r);text-decoration:none;
  color:var(--tx);border:1px solid transparent;transition:all .12s;
  width:96px;overflow:hidden;cursor:pointer;position:relative}
.fe-tile:hover{background:var(--hover);border-color:var(--bd)}
.fe-tile-ic{font-size:0;line-height:0}
.fe-tile-ic svg{display:block}
.fe-tile-nm{font-size:var(--fs-sm);text-align:center;overflow-wrap:anywhere;word-break:normal;max-width:100%;
  overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;
  line-height:1.3}
.fe-tile-sz{font-size:var(--fs-xs);color:var(--dm)}
.fe-tile.dir .fe-tile-nm{color:var(--dir)}
.fe-tile.par .fe-tile-nm{color:var(--dm)}
#fe[data-view="tiles"] .fe-tile-ic svg{transform:scale(1.5);margin:4px}
#fe[data-view="icons"] .fe-tile{width:116px;padding:10px 8px 8px;gap:4px}
#fe[data-view="icons"] .fe-tile-ic svg{transform:scale(2);margin:8px 10px 6px}
#fe[data-view="icons"] .fe-tile-nm{font-size:var(--fs-md)}
.fe-tile-img-wrap{display:block;width:68px;height:56px;border-radius:5px;overflow:hidden;
  box-shadow:0 1px 4px #0005;flex-shrink:0}
.fe-tile-thumb{width:100%;height:100%;object-fit:cover;display:block;border-radius:5px}
.fe-tile-img-wrap svg{display:none;transform:none!important;margin:4px!important;width:24px;height:24px}
.fe-tile-img-wrap.err .fe-tile-thumb{display:none}
.fe-tile-img-wrap.err svg{display:block}
#fe[data-view="tiles"] .fe-tile-ic .fe-tile-img-wrap{width:68px;height:56px}
#fe[data-view="icons"] .fe-tile-ic .fe-tile-img-wrap{width:86px;height:70px}
#fe[data-view="tiles"] .fe-tile-ic .fe-tile-img-wrap svg,
#fe[data-view="icons"] .fe-tile-ic .fe-tile-img-wrap svg{transform:none!important;margin:8px!important}
.fe-row .fe-acts{
  display:inline-flex;align-items:center;gap:3px;
  position:absolute;right:8px;top:50%;transform:translateY(-50%);
  opacity:0;transition:opacity .12s;pointer-events:none}
.fe-row:hover .fe-acts{opacity:1;pointer-events:auto}
.fe-tile .fe-acts{
  display:flex;justify-content:center;gap:4px;
  position:absolute;bottom:0;left:0;right:0;
  padding:4px 4px 5px;
  background:linear-gradient(transparent,var(--s1)cc 40%,var(--s1) 100%);
  border-radius:0 0 var(--r) var(--r);
  opacity:0;transition:opacity .14s;pointer-events:none}
.fe-tile:hover .fe-acts{opacity:1;pointer-events:auto}
#fe[data-view="list"] .fe-tile .fe-acts{
  position:absolute;right:6px;top:50%;transform:translateY(-50%);
  background:none;border-radius:0;padding:0;width:auto;left:auto}
/* Row actions float over the name, so they sit on a solid surface; small circles like every icon button. */
.fe-act-btn{display:inline-grid;place-items:center;width:22px;height:22px;padding:0;border-radius:50%;
  background:var(--s1);border:1px solid var(--bd);color:var(--mt);cursor:pointer;
  transition:background var(--t-fast) var(--ease),color var(--t-fast) var(--ease)}
.fe-act-btn:hover{background:var(--s3);color:var(--tx)}
.fe-row td.c-nm{position:relative}
#fe-statusbar{display:flex;align-items:center;gap:14px;min-height:30px;padding:0 14px;
  background:var(--s1);border-top:1px solid var(--bd);flex-shrink:0;font-size:var(--fs-md);color:var(--mt);white-space:nowrap;overflow:hidden}
#fe-status-meta{display:flex;align-items:center;gap:14px}
.fe-meta-item{display:inline-flex;align-items:center;gap:5px}
.fe-meta-item svg{color:var(--dm)}
.fe-status-grow{flex:1}
#fe-fp-reload{color:var(--green);animation:fe-fade-in var(--t-base) var(--ease)}
#fe-fp-reload[hidden]{display:none}
#fe-fp-reload.off{color:var(--dm)}
@keyframes fe-fade-in{from{opacity:0}to{opacity:1}}
/* The path reads as a link: pointer, accent and underline on hover; a click copies it. */
#fe-status-path{min-width:0;max-width:60%;overflow:hidden;text-overflow:ellipsis;direction:rtl;text-align:left;
  height:22px;padding:0;border:0;background:none;color:var(--mt);font:inherit;cursor:pointer;
  text-decoration:underline transparent;text-underline-offset:3px;transition:color var(--t-fast) var(--ease),text-decoration-color var(--t-fast) var(--ease)}
#fe-status-path:hover{color:var(--ac);text-decoration-color:currentColor}
#fe-tip{
  position:fixed;pointer-events:none;z-index:200;
  background:var(--s2);border:1px solid var(--bd);border-radius:var(--r);
  padding:9px 12px;font-size:var(--fs-md);line-height:1.7;color:var(--tx);
  max-width:380px;overflow-wrap:anywhere;word-break:break-word;
  box-shadow:0 4px 20px #000a;opacity:0;
  transition:opacity .15s ease-out;
}
#fe-tip.show{opacity:1;transition:opacity .18s ease-in .06s}
.tip-header{display:flex;align-items:center;gap:7px;margin-bottom:4px}
.tip-icon{flex-shrink:0;display:flex;align-items:center}
.tip-icon svg{display:block}
.tip-name{font-weight:600;font-size:var(--fs-md);word-break:break-all;color:var(--tx)}
.tip-line{color:var(--mt);font-size:var(--fs-sm);line-height:1.6}
.tip-warn{color:var(--dm);font-size:var(--fs-sm);margin-top:3px;border-top:1px solid var(--bd);padding-top:3px}
#fe-toast{
  position:fixed;bottom:32px;left:50%;transform:translateX(-50%) translateY(6px);
  background:#1f2937;color:#e5e7eb;padding:8px 18px;border-radius:20px;
  font-size:var(--fs-md);opacity:0;transition:all .22s;pointer-events:none;white-space:nowrap;
  border:1px solid #374151;z-index:200
}
#fe-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
/* The label for anything with a title (tooltip.ts); same surface as the row card #fe-tip. */
#fe-hint{position:fixed;top:0;left:0;z-index:300;max-width:320px;pointer-events:none;
  background:var(--s2);color:var(--tx);border:1px solid var(--bd);border-radius:var(--r);
  box-shadow:0 4px 14px #0006;padding:4px 8px;
  font-size:var(--fs-md);line-height:1.4;white-space:pre-line;
  opacity:0;transition:opacity .12s ease-out}
#fe-hint.on{opacity:1}
@media (prefers-reduced-motion:reduce){#fe-hint{transition:none}}
#fe-toast.act{pointer-events:auto}
.fe-toast-act{background:none;border:none;color:#79b8ff;cursor:pointer;font:inherit;padding:0;text-decoration:underline}
::-webkit-scrollbar{width:5px;height:5px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:var(--bd);border-radius:3px}
::-webkit-scrollbar-thumb:hover{background:var(--dm)}
#fe.compact tbody td{padding:2px 12px}
#fe.compact .fe-tile{padding:6px 6px 5px;gap:3px}
.fe-dlg{position:fixed;inset:0;z-index:400;display:flex;align-items:center;justify-content:center}
.fe-dlg-bg{position:absolute;inset:0;background:#00000088;backdrop-filter:blur(2px)}
.fe-dlg-box{position:relative;z-index:1;background:var(--s1);border:1px solid var(--bd);border-radius:10px;
  width:min(760px,calc(100vw - 40px));max-height:84vh;display:flex;flex-direction:column;box-shadow:0 24px 64px #000d;outline:none}
#fe-settings-modal .fe-dlg-box{width:min(900px,calc(100vw - 40px))}
.fe-dlg-title{display:flex;align-items:center;gap:11px;padding:14px 16px 12px;background:var(--s2);flex:none;border-radius:10px 10px 0 0}
.fe-dlg-mark{flex:none;width:26px;height:26px;border-radius:6px;display:grid;place-items:center;
  background:var(--act);color:var(--ac);border:1px solid var(--ac)}
.fe-dlg-tx{display:flex;flex-direction:column;gap:3px;min-width:0;flex:1}
.fe-dlg-tx b{font-size:var(--fs-xl);font-weight:600;line-height:1.2;color:var(--tx);letter-spacing:-.01em}
.fe-dlg-tx i{font-size:var(--fs-sm);line-height:1.2;font-style:normal;color:var(--dm)}
.fe-dlg-close{display:inline-grid;place-items:center;width:26px;height:26px;padding:0;background:none;border:none;color:var(--dm);cursor:pointer;border-radius:50%;transition:color var(--t-fast) var(--ease),background var(--t-fast) var(--ease)}
.fe-dlg-close:hover{background:var(--shade);color:var(--tx)}
.fe-dlg-tabs{display:flex;gap:3px;padding:0 16px;background:var(--s2);border-bottom:1px solid var(--bd);flex:none;align-items:stretch;overflow-x:auto}
.fe-dlg-tab{display:flex;flex-direction:column;gap:2px;background:none;border:none;border-bottom:2px solid transparent;border-radius:6px 6px 0 0;
  padding:9px 13px 8px;color:var(--mt);cursor:pointer;text-align:left;line-height:1;white-space:nowrap;transition:background .1s,color .1s,border-color .1s}
.fe-dlg-tab-main{display:flex;align-items:center;gap:5px;min-width:0}
.fe-dlg-tab-main svg{flex:none;width:13px;height:13px}
.fe-dlg-tab b{font-size:var(--fs-md);font-weight:600;color:inherit}
.fe-dlg-tab i{font-size:var(--fs-sm);font-style:normal;color:var(--dm);opacity:.85}
.fe-dlg-tab:hover{color:var(--tx);background:var(--s1)}
.fe-dlg-tab.on{background:var(--s1);color:var(--tx);border-bottom-color:var(--ac)}
.fe-dlg-tab.on i{opacity:1}
.fe-dlg-pane{display:none;padding:18px 22px 22px;overflow:auto;min-height:0}
.fe-dlg-pane.on{display:flex;flex-direction:column;gap:20px}
.fe-dlg-pane .fe-pbn{display:inline-flex;align-items:center;justify-content:center;gap:5px}
.fe-dlg-pane .fe-pbn svg{flex:none;width:13px;height:13px}
.fe-dlg-pane .fe-md{max-width:none;padding:0}
.fe-dlg-pane .fe-md h2{font-size:1.15em;border:0;padding:0}
.fe-dlg-pane .fe-md>:first-child{margin-top:0}
.fe-st-section{display:flex;flex-direction:column;gap:10px}
.fe-st-title{font-size:var(--fs-sm);font-weight:600;text-transform:uppercase;letter-spacing:.08em;
  color:var(--dm);padding-bottom:4px;border-bottom:1px solid var(--bd)}
.fe-st-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.fe-st-lbl{font-size:var(--fs-md);color:var(--mt);min-width:90px;flex-shrink:0}
.fe-st-radio{display:flex;align-items:center;gap:6px;font-size:var(--fs-lg);color:var(--tx);cursor:pointer}
.fe-st-radio input{accent-color:var(--ac);cursor:pointer}
.fe-st-swatch{width:12px;height:12px;border-radius:50%;background:var(--sw);box-shadow:inset 0 0 0 1px var(--bd2)}
.fe-st-check{display:flex;align-items:center;gap:7px;font-size:var(--fs-lg);color:var(--tx);cursor:pointer}
.fe-st-check input{accent-color:var(--ac);cursor:pointer;width:14px;height:14px}
.fe-st-select{background:var(--s2);border:1px solid var(--bd);color:var(--tx);
  padding:4px 8px;border-radius:var(--r);font-size:var(--fs-md);outline:none;cursor:pointer}
.fe-st-input{background:var(--bg);border:1px solid var(--bd);color:var(--tx);
  padding:4px 8px;border-radius:var(--r);font-size:var(--fs-md);outline:none;width:100%;
  font-family:inherit;box-sizing:border-box}
.fe-st-input:focus{border-color:var(--ac)}
.fe-st-rules-hint{font-size:var(--fs-sm);color:var(--dm);font-style:italic}
.fe-st-rules-cols{display:grid;grid-template-columns:16px 22px 1fr 58px 32px 24px;
  gap:6px;padding:0 2px 4px;align-items:center;font-size:var(--fs-xs);color:var(--dm)}
.fe-st-col-lbl{font-size:var(--fs-xs);color:var(--dm);font-weight:500}
.fe-st-rule{display:grid;grid-template-columns:16px 22px 1fr 58px 32px 24px;
  gap:6px;align-items:center;padding:5px 2px;border-bottom:1px solid var(--bd)}
.fe-st-rule:last-child{border-bottom:none}
.fe-st-rule input[type="checkbox"]{accent-color:var(--ac);cursor:pointer;width:13px;height:13px}
.fe-st-rule-preview{display:flex;align-items:center;justify-content:center;height:20px}
.fe-st-rule-pattern,.fe-st-rule-label{
  background:var(--bg);border:1px solid var(--bd);color:var(--tx);
  padding:3px 6px;border-radius:var(--r);font-size:var(--fs-sm);
  font-family:'SF Mono',Consolas,monospace;outline:none;transition:border-color .15s;width:100%}
.fe-st-rule-pattern:focus,.fe-st-rule-label:focus{border-color:var(--ac)}
.fe-st-rule-label{text-align:center}
.fe-st-rule-color{border:1px solid var(--bd);background:none;cursor:pointer;
  width:28px;height:24px;padding:1px;border-radius:4px;flex-shrink:0}
.fe-st-rule-del{background:none;border:none;color:var(--dm);cursor:pointer;
  padding:3px 5px;font-size:var(--fs-md);border-radius:3px;line-height:1;transition:color .1s,background .1s;text-align:center}
.fe-st-rule-del:hover{color:#f85149;background:var(--hover)}
.fe-st-rules-empty{font-size:var(--fs-md);color:var(--dm);padding:8px 2px;font-style:italic}
#fe-st-ai-card{background:var(--s2);border:1px solid var(--bd);border-radius:var(--r);padding:11px 13px}
.fe-st-ai-head{display:flex;align-items:center;gap:8px;margin-bottom:9px}
.fe-st-ai-blink{position:relative;display:inline-flex;width:9px;height:9px;flex-shrink:0}
.fe-st-ai-blink .dot{width:9px;height:9px;border-radius:50%;background:var(--dm);z-index:1}
.fe-st-ai-blink::after{content:'';position:absolute;inset:0;border-radius:50%;background:inherit}
.fe-st-ai-head.ready .dot{background:var(--green)}
.fe-st-ai-head.cold .dot{background:var(--gold)}
.fe-st-ai-head.down .dot,.fe-st-ai-head.off .dot{background:#f85149}
/* Pulsing halo only when the model is actually resident (ready). */
.fe-st-ai-head.ready .fe-st-ai-blink::after{background:var(--green);animation:fe-blink 1.6s ease-out infinite}
.fe-st-ai-head.cold .fe-st-ai-blink::after{background:var(--gold);animation:fe-blink 2.4s ease-out infinite}
@keyframes fe-blink{0%{transform:scale(1);opacity:.55}70%,100%{transform:scale(2.6);opacity:0}}
.fe-st-ai-state{font-size:var(--fs-md);font-weight:600;color:var(--tx)}
.fe-st-ai-grid{display:grid;grid-template-columns:auto 1fr;gap:3px 12px;font-size:var(--fs-md)}
.fe-st-ai-grid .k{color:var(--dm)}
.fe-st-ai-grid .v{color:var(--tx);font-family:'SF Mono',Menlo,Consolas,monospace;font-size:var(--fs-sm);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fe-st-ai-grid .v.warm-yes{color:var(--green)}
.fe-st-ai-grid .v.warm-no{color:var(--gold)}
.fe-st-ai-controls{display:flex;align-items:center;gap:8px;margin-top:10px;flex-wrap:wrap}
.fe-st-ai-controls .fe-st-select{flex:1;min-width:120px}
.fe-st-ai-hint{font-size:var(--fs-sm);color:var(--dm);margin-top:8px;line-height:1.5}
.fe-st-ai-hint code{background:var(--bg);border:1px solid var(--bd);border-radius:3px;padding:0 4px;
  font-family:'SF Mono',Menlo,Consolas,monospace;font-size:var(--fs-sm);color:var(--mt)}
.fe-row.selected td{background:var(--act)}
.fe-row.selected .fe-nm{color:var(--ac)}
.fe-tile.selected{background:var(--act);border-color:var(--ac)}
#fe-qlook{position:fixed;inset:0;z-index:350;display:flex;align-items:center;justify-content:center}
#fe-ql-bg{position:absolute;inset:0;background:#0009;backdrop-filter:blur(2px)}
#fe-ql-dialog{position:relative;z-index:1;background:var(--s1);border:1px solid var(--bd);
  border-radius:10px;width:min(1100px,calc(100vw - 64px));height:min(84vh,1000px);
  max-width:calc(100vw - 16px);max-height:calc(100vh - 16px);
  display:flex;flex-direction:column;box-shadow:0 24px 64px #000d;overflow:hidden}
#fe-ql-rz{position:absolute;right:0;bottom:0;width:16px;height:16px;cursor:nwse-resize;z-index:2;
  background:linear-gradient(135deg,transparent 50%,var(--bd) 50%,var(--bd) 60%,transparent 60%,transparent 75%,var(--bd) 75%,var(--bd) 85%,transparent 85%)}
#fe-ql-rz:hover{background:linear-gradient(135deg,transparent 50%,var(--ac) 50%)}
#fe-ql-rz-side{display:none;position:absolute;left:0;top:0;width:6px;height:100%;cursor:col-resize;z-index:2}
#fe-ql-rz-side:hover{background:linear-gradient(90deg,var(--ac),transparent)}
#fe-qlook.side{position:relative;inset:auto;z-index:1;flex:none;width:420px;max-width:80vw;
  border-left:1px solid var(--bd);align-items:stretch;justify-content:stretch}
#fe-qlook.side #fe-ql-bg,#fe-qlook.side #fe-ql-rz{display:none}
#fe-qlook.side #fe-ql-rz-side{display:block}
#fe-qlook.side #fe-ql-dialog{width:100%;height:100%;max-width:none;max-height:none;border:none;border-radius:0;box-shadow:none}
#fe-tabbar{display:flex;align-items:stretch;background:var(--s1);border-bottom:1px solid var(--bd);flex-shrink:0;min-height:34px}
#fe-tabs{display:flex;align-items:stretch;gap:4px;padding:6px 4px 0 6px;flex:1;min-width:0;overflow-x:auto;scrollbar-width:none}
#fe-tabs-end{display:flex;align-items:center;gap:2px;padding:4px 8px 0 2px;flex:none}
#fe-tabs-end button{color:var(--mt)}
#fe-tabs-end button svg{width:13px;height:13px}
#fe-goto{position:fixed;z-index:60;width:min(460px,calc(100vw - 16px));padding:8px;border-radius:var(--pop-r);
  background:var(--pop-bg);border:1px solid var(--pop-bd);box-shadow:var(--pop-sh);backdrop-filter:var(--pop-blur);-webkit-backdrop-filter:var(--pop-blur)}
#fe-goto input{width:100%;box-sizing:border-box;height:30px;padding:0 10px;border:1px solid var(--bd2);border-radius:var(--row-r);background:var(--bg);color:var(--tx);font:inherit;font-size:var(--fs-md);outline:0}
#fe-goto input:focus{border-color:color-mix(in srgb,var(--ac) 70%,var(--bd2))}
.fe-goto-msg{margin:6px 2px 0;font-size:var(--fs-sm);color:var(--dm)}
#fe-tabs::-webkit-scrollbar{display:none}
.fe-tab-list{position:sticky;right:0;flex-shrink:0;align-self:center;background:var(--s1);border:1px solid var(--bd);color:var(--mt);cursor:pointer;
  font-size:var(--fs-sm);padding:2px 6px;border-radius:5px;margin-left:4px}
.fe-tab-list:hover{border-color:var(--ac);color:var(--ac)}
.fe-tab-list svg{display:block}
.fe-tab.pinned{padding:5px 6px;min-width:0}
.fe-tab.pinned .fe-tab-lbl,.fe-tab.pinned .fe-tab-more{display:none}
#fe-tabs.empty{padding-top:4px}
.fe-tab{display:flex;align-items:center;gap:6px;padding:5px 8px 5px 10px;min-height:29px;font-size:var(--fs-md);color:var(--mt);text-decoration:none;
  background:var(--s2);border:1px solid var(--bd);border-bottom:none;border-radius:7px 7px 0 0;white-space:nowrap;max-width:200px;min-width:64px;flex:0 1 auto;position:relative;top:1px;
  transition:background var(--t-fast) var(--ease),color var(--t-fast) var(--ease)}
.fe-tab:hover{background:var(--s3);color:var(--tx)}
.fe-tab.on{background:var(--bg);color:var(--tx)}
.fe-tab.temp{background:none;border-color:transparent}
.fe-tab.temp.on{background:var(--bg);border-color:var(--bd)}
.fe-tab.temp.on{color:var(--mt);border-style:dashed}
.fe-tab.drag-over{border-left:2px solid var(--ac)}
.fe-tab-lbl{display:flex;overflow:hidden;min-width:0}
.fe-tab-head{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.fe-tab-tail{white-space:nowrap;flex-shrink:0}
.fe-tab-x,.fe-tab-more{display:inline-grid;place-items:center;width:18px;height:18px;padding:0;background:none;border:none;color:var(--dm);cursor:pointer;font-size:var(--fs-xs);border-radius:50%;opacity:0;line-height:1;transition:opacity var(--t-fast),background var(--t-fast)}
.fe-tab-more{font-size:var(--fs-md);letter-spacing:1px}
.fe-tab:hover .fe-tab-x,.fe-tab.on .fe-tab-x,.fe-tab:hover .fe-tab-more{opacity:1}
.fe-tab-x:hover{background:var(--shade2);color:#f85149}
.fe-tab-more:hover{background:var(--shade2);color:var(--tx)}
.fe-tab.pinned::before{content:'';width:5px;height:5px;border-radius:50%;background:var(--ac);flex-shrink:0}
.fe-tab-ico{display:flex;flex-shrink:0}
.fe-tab-ico svg{width:11px;height:12px}
.fe-tab-menu{position:fixed}
#fe.fe-file-page #fe-toolbar,#fe.fe-file-page #fe-sg-panel,#fe.fe-file-page #fe-filter-bar,#fe.fe-file-page #fe-scroll{display:none!important}
#fe-fp-bar{display:flex;align-items:center;gap:6px;padding:7px 14px;background:var(--s2);border-bottom:1px solid var(--bd);flex-shrink:0}
#fe-fp{display:flex;flex:1;min-height:0}
/* Contents and Comments float over the page as a translucent card, shown and
   hidden by the two buttons right of find. The text keeps clear of the card. */
#fe-fp{position:relative}
#fe-toc-rail{position:absolute;top:12px;right:16px;z-index:4;width:240px;max-height:calc(100% - 24px);display:flex;flex-direction:column;min-height:0;
  border:1px solid color-mix(in srgb,var(--bd) 80%,transparent);border-radius:12px;
  background:color-mix(in srgb,var(--card) 80%,transparent);backdrop-filter:blur(14px) saturate(1.2);-webkit-backdrop-filter:blur(14px) saturate(1.2);
  box-shadow:0 8px 24px rgb(0 0 0 / .12),0 1px 3px rgb(0 0 0 / .08);transition:width var(--t-base) var(--ease),border-radius var(--t-base) var(--ease)}
#fe-toc-rail[hidden]{display:none}
#fe-toc-rail.peek{box-shadow:var(--pop-sh)}
.fe-toc-head{display:flex;align-items:center;gap:6px;padding:10px 8px 6px 16px;flex:none}
.fe-toc-title{flex:1;font-size:var(--fs-sm);font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--dm)}
#fe-toc{flex:1;min-height:0;overflow-y:auto;padding:2px 0 16px}
#fe-toc a{display:block;margin:1px 6px;border-radius:6px;color:var(--mt);text-decoration:none;padding:3px 10px 3px 10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;transition:color var(--t-fast) var(--ease),background var(--t-fast) var(--ease)}
#fe-toc a:hover{color:var(--tx);background:var(--hover)}
#fe-toc a.fe-toc-h1{font-size:var(--fs-lg);font-weight:600;color:var(--tx)}
#fe-toc a.fe-toc-h2{font-size:var(--fs-md);padding-left:22px}
#fe-toc a.fe-toc-h3{font-size:var(--fs-md);padding-left:34px}
#fe-toc a.fe-toc-h4{font-size:var(--fs-md);padding-left:46px;color:var(--dm)}
/* The rail's two tabs, Contents and Comments. Comments needs more room, so
   the rail and the text column's right padding widen while it shows. */
.fe-rail-title{flex:1;display:flex;align-items:center;gap:7px;margin:0;font-size:var(--fs-md);font-weight:600;color:var(--tx)}
.fe-rail-ico{display:inline-flex;color:var(--mt)}
.fe-rail-ico svg{width:14px;height:14px}
.fe-rt{border:0;background:none;padding:3px 9px;border-radius:999px;font-size:var(--fs-md);font-weight:500;
  color:var(--mt);cursor:pointer;display:inline-flex;align-items:center;gap:6px;white-space:nowrap}
.fe-rt svg{width:13px;height:13px;opacity:.85}
.fe-rt:hover{color:var(--tx);background:var(--hover)}
.fe-rt.on{color:var(--tx);background:var(--act)}
.fe-rt[hidden]{display:none}
.fe-rt-n:empty{display:none}
.fe-rt-n{min-width:16px;padding:0 5px;border-radius:999px;background:var(--ac);color:var(--on-ac);font-size:var(--fs-xs);letter-spacing:0;line-height:16px;text-align:center}
#fe-toc-rail[data-tab="cm"]{width:320px}
/* The editor's floating pill moves left of the comments rail instead of covering its tabs. */
#fe-fp:has(#fe-toc-rail[data-tab="cm"]:not([hidden])) #fe-fe-pill{right:352px}
/* The pane buttons right of find: icons only, the comment count as a small badge. */
.fe-fp-panes{display:inline-flex;gap:2px;flex:none}
#fe-fp-bar .fe-fp-panes button[hidden]{display:none}
#fe-fp-cm{position:relative}
#fe-fp-cm-n:empty{display:none}
#fe-fp-cm-n{position:absolute;top:-3px;right:-4px;min-width:14px;padding:0 4px;border-radius:999px;background:var(--ac);color:var(--on-ac);font-size:10px;line-height:14px;text-align:center}
/* Comment threads: a quote, then each comment with who and when, then chips. */
#fe-cm{flex:1;min-height:0;display:flex;flex-direction:column;position:relative}
.fe-cm-top{flex:none;display:flex;align-items:center;gap:4px;padding:0 10px 8px}
.fe-cm-list{flex:1;min-height:0;overflow-y:auto;padding:2px 10px 14px}
#fe-cm[hidden]{display:none}
.fe-cm-filters{flex:1;display:flex;gap:2px;padding:2px;border-radius:10px;background:var(--bg);border:1px solid var(--bd)}
.fe-cm-filters button{flex:1;border:0;background:none;border-radius:8px;padding:3px 4px;font-size:var(--fs-sm);color:var(--mt);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:4px;white-space:nowrap}
.fe-cm-filters button svg{width:11px;height:11px;opacity:.75}
.fe-cm-fn{color:var(--dm)}
.fe-cm-ib{display:inline-grid;place-items:center;width:24px;height:24px;padding:0;border:0;border-radius:50%;background:none;color:var(--mt);cursor:pointer;flex:none;
  transition:background var(--t-fast) var(--ease),color var(--t-fast) var(--ease)}
.fe-cm-ib:hover{background:var(--shade);color:var(--tx)}
.fe-cm-ib:focus-visible{outline:2px solid var(--ac);outline-offset:1px}
.fe-cm-ib svg{width:13px;height:13px}
.fe-cm-filters button.on{background:var(--card);color:var(--tx);box-shadow:0 1px 2px rgb(0 0 0 / .18)}
.fe-cm-group{display:flex;align-items:center;gap:6px;margin:14px 2px 6px;font-size:var(--fs-xs);font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:var(--dm);cursor:default}
.fe-cm-group span{font-weight:500;letter-spacing:0}
details.fe-cm-done > summary{cursor:pointer;list-style:none}
details.fe-cm-done > summary::-webkit-details-marker{display:none}
.fe-cm-th{position:relative;margin:0 0 8px;padding:10px 12px;border:1px solid var(--bd);border-radius:12px;background:var(--card);cursor:pointer;
  transition:border-color var(--t-fast) var(--ease),box-shadow var(--t-fast) var(--ease)}
.fe-cm-th:hover{border-color:var(--bd2)}
.fe-cm-th.on{border-color:color-mix(in srgb,var(--ac) 60%,var(--bd));box-shadow:0 0 0 3px color-mix(in srgb,var(--ac) 14%,transparent)}
.fe-cm-th:focus-visible{outline:2px solid var(--ac);outline-offset:2px}
.fe-cm-q{margin:0 0 8px;padding:0 0 0 9px;border-left:2px solid color-mix(in srgb,var(--ac) 55%,transparent);font-size:var(--fs-sm);line-height:1.45;color:var(--mt);
  display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.fe-cm-state{display:flex;align-items:center;gap:5px;margin:-2px 0 8px;font-size:var(--fs-xs);color:color-mix(in srgb,var(--nc-orange) 75%,var(--mt));cursor:default}
.fe-cm-state svg{width:12px;height:12px;flex:none}
.fe-cm-c + .fe-cm-c{margin-top:9px;padding-top:9px;border-top:1px solid color-mix(in srgb,var(--bd) 70%,transparent)}
.fe-cm-who{display:flex;align-items:center;gap:6px;margin-bottom:3px}
.fe-cm-who b{display:inline-flex;align-items:center;gap:4px;font-size:var(--fs-md);font-weight:600;color:var(--tx)}
.fe-cm-who b.agent{color:var(--nc-purple)}
.fe-cm-who b svg{width:12px;height:12px}
.fe-cm-who time{font-size:var(--fs-sm);color:var(--dm)}
.fe-cm-tx{font-size:var(--fs-md);line-height:1.5;color:var(--tx);overflow-wrap:anywhere}
.fe-cm-tx code{font-size:.92em}
.fe-cm-tx p{margin:0}
.fe-cm-tx p + p,.fe-cm-tx ul + p,.fe-cm-tx p + ul{margin-top:.45em}
.fe-cm-tx ul{margin:.15em 0;padding-left:1.15em}
.fe-cm-own{margin-left:auto;display:inline-flex;opacity:0;transition:opacity var(--t-fast) var(--ease)}
.fe-cm-c:hover .fe-cm-own,.fe-cm-own:focus-within{opacity:1}
.fe-cm-own .fe-cm-ib{width:20px;height:20px}
.fe-cm-own .fe-cm-ib svg{width:12px;height:12px}
.fe-cm-c.gone .fe-cm-tx{color:var(--dm)}
.fe-cm-sug{margin-top:6px;font-size:var(--fs-sm);color:var(--mt)}
.fe-cm-sug ins{text-decoration:none;background:color-mix(in srgb,var(--nc-green) 18%,transparent);padding:0 3px;border-radius:3px;color:var(--tx)}
.fe-cm-chips{display:flex;flex-wrap:wrap;gap:4px;margin-top:8px}
.fe-cm-chip{display:inline-flex;align-items:center;gap:4px;padding:1px 7px;border-radius:999px;font-size:var(--fs-sm);background:var(--s2);color:var(--mt)}
.fe-cm-chip svg{width:11px;height:11px}
.fe-cm-chip.due{background:color-mix(in srgb,var(--nc-orange) 16%,transparent);color:var(--tx)}
.fe-cm-chip.done{background:color-mix(in srgb,var(--nc-green) 16%,transparent);color:var(--tx)}
.fe-cm-note{margin:0 2px 8px;font-size:var(--fs-sm);color:var(--dm);line-height:1.4}
.fe-cm-empty{padding:22px 6px 18px;text-align:center;color:var(--tx);font-size:var(--fs-md);line-height:1.5}
.fe-cm-empty p{margin:0}
.fe-cm-empty .fe-cm-hint{margin-top:4px}
.fe-cm-empty-ico{display:inline-grid;place-items:center;width:34px;height:34px;margin-bottom:8px;border-radius:50%;background:var(--s2);color:var(--dm)}
.fe-cm-empty-ico svg{width:16px;height:16px}
.fe-cm-empty .btn{margin-top:10px}
.fe-cm-hint{color:var(--dm);font-size:var(--fs-sm)}
.fe-cm-hint kbd{font:inherit;font-family:var(--mono);padding:0 4px;border:1px solid var(--bd2);border-radius:4px}
/* Writing: the composer card, the reply box on the open thread, its tools. */
.fe-cm-new{cursor:default}
.fe-cm-box{margin-top:10px}
.fe-cm-new .fe-cm-box{margin-top:0}
.fe-cm-box textarea{display:block;width:100%;box-sizing:border-box;min-height:52px;max-height:220px;resize:vertical;padding:6px 8px;border:1px solid var(--bd2);border-radius:8px;
  background:var(--bg);color:var(--tx);font:inherit;font-size:var(--fs-md);line-height:1.45;outline:0;transition:border-color var(--t-fast) var(--ease)}
.fe-cm-box textarea:focus{border-color:color-mix(in srgb,var(--ac) 70%,var(--bd2))}
.fe-cm-box textarea::placeholder{color:var(--dm)}
.fe-cm-ac{position:absolute;z-index:10;max-width:calc(100% - 20px);box-sizing:border-box;padding:4px;border-radius:10px;
  background:var(--pop-bg);border:1px solid var(--pop-bd);box-shadow:var(--pop-sh);backdrop-filter:var(--pop-blur);-webkit-backdrop-filter:var(--pop-blur)}
.fe-cm-ac[hidden]{display:none}
.fe-cm-ac > div{padding:4px 8px;border-radius:6px;font-size:var(--fs-md);color:var(--tx);cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fe-cm-ac > div span{color:var(--dm);font-size:var(--fs-sm);margin-left:4px}
.fe-cm-ac > div.on,.fe-cm-ac > div:hover{background:var(--act)}
.fe-cm-tools{display:flex;flex-wrap:wrap;align-items:center;gap:2px;margin-top:6px}
.fe-cm-tools .btn svg{width:12px;height:12px}
.fe-cm-grow{flex:1}
.fe-cm-date{height:22px;padding:0 6px;border:1px solid var(--bd2);border-radius:6px;background:var(--bg);color:var(--tx);font:inherit;font-size:var(--fs-sm);color-scheme:light dark}
.fe-cm-x{display:inline-flex;align-items:center;justify-content:center;width:14px;height:14px;margin:0 -3px 0 1px;padding:0;border:0;border-radius:50%;background:none;color:var(--dm);cursor:pointer}
.fe-cm-x:hover{background:var(--shade);color:var(--tx)}
.fe-cm-x svg{width:9px;height:9px}
/* The floating Comment button above a selection on the page. */
#fe-cm-add{position:fixed;z-index:30;height:28px;padding:0 10px;border-radius:999px;color:var(--tx);
  background:var(--pop-bg);border:1px solid var(--pop-bd);box-shadow:var(--pop-sh);backdrop-filter:var(--pop-blur);-webkit-backdrop-filter:var(--pop-blur)}
#fe-cm-add:hover{color:var(--ac)}
#fe-cm-add[hidden]{display:none}
#fe-cm-add svg{width:13px;height:13px}
/* In the editor, a row where an open comment starts carries a mark in the gutter. */
.fe-fe-row.cm .fe-fe-ln{position:relative}
.fe-fe-row.cm .fe-fe-ln::before{content:'';position:absolute;left:6px;top:.55em;width:9px;height:8px;border-radius:3px 3px 3px 0;background:var(--ac);cursor:pointer}
/* In the text: commented words get a wash, the open thread a stronger one,
   and each block with comments a count in the right margin. */
::highlight(bfb-cm){background-color:color-mix(in srgb,var(--ac) 9%,transparent)}
::highlight(bfb-cm-hover){background-color:color-mix(in srgb,var(--ac) 17%,transparent)}
::highlight(bfb-cm-on){background-color:color-mix(in srgb,var(--ac) 24%,transparent)}
#fe-page.fe-cm-pointing{cursor:pointer}
.fe-md [data-cm]{position:relative}
.fe-md [data-cm]::after{content:attr(data-cm);position:absolute;top:2px;right:-30px;min-width:20px;height:18px;padding:0 5px;border-radius:9px 9px 9px 2px;
  background:color-mix(in srgb,var(--ac) 22%,var(--card));color:var(--tx);font-size:var(--fs-xs);font-weight:600;line-height:18px;text-align:center;cursor:pointer}
/* Find in file, at the right end of the file bar. */
#fe-ff{display:inline-flex;align-items:center;gap:4px;height:28px;padding:0 3px 0 9px;border:1px solid var(--bd);border-radius:8px;
  background:color-mix(in srgb,var(--tx) 3%,var(--card));color:var(--dm);transition:border-color var(--t-fast) var(--ease),background var(--t-fast) var(--ease)}
#fe-ff:focus-within{border-color:color-mix(in srgb,var(--ac) 60%,var(--bd));background:var(--card)}
#fe-ff[hidden]{display:none}
#fe-ff-q{width:150px;border:0;outline:0;background:none;color:var(--tx);font:inherit;font-size:var(--fs-md)}
#fe-ff-n{flex:none;width:7.5ch;text-align:right;font-size:var(--fs-sm);color:var(--dm);white-space:nowrap;font-variant-numeric:tabular-nums}
#fe-ff-n.none{color:var(--mt);font-style:italic}
#fe-ff-n.part{text-decoration:underline dotted;text-underline-offset:3px;cursor:help}
#fe-fp-bar #fe-ff button{height:20px;width:20px}
mark.fe-ff-hit{background:color-mix(in srgb,var(--gold) 35%,transparent);color:inherit;border-radius:2px}
mark.fe-ff-hit.on{background:var(--gold);color:#0d1117}
#fe-page{flex:1;min-width:0;overflow:auto;font-size:var(--fs-md)}
#fe-page .fe-md{overflow-wrap:break-word;max-width:none;margin:0;padding:28px 48px 80px;font-size:var(--fs-xl);line-height:var(--rd-lh,1.65)}
#fe.fe-column-xl #fe-page .fe-md{max-width:150ch;margin:0 auto}
#fe.fe-column-lg #fe-page .fe-md{max-width:130ch;margin:0 auto}
#fe.fe-column-md #fe-page .fe-md{max-width:110ch;margin:0 auto}
#fe-page .fe-md blockquote > .fe-md{padding:0;margin:0;max-width:none}
.fe-md-alert{--al:#4493f8;border-left:3px solid var(--al);padding:.6em 1em;border-radius:4px;background:color-mix(in srgb,var(--al) 9%,transparent)}
.fe-md-alert-title{font-weight:600;color:var(--al);margin:0 0 4px!important}
.fe-md-alert-tip{--al:#3fb950}.fe-md-alert-important{--al:#ab7df8}.fe-md-alert-warning{--al:#d29922}.fe-md-alert-caution{--al:#f85149}
#fe[data-theme="light"] .fe-md-alert{--al:#0969da}
#fe[data-theme="light"] .fe-md-alert-tip{--al:#1a7f37}#fe[data-theme="light"] .fe-md-alert-important{--al:#8250df}
#fe[data-theme="light"] .fe-md-alert-warning{--al:#9a6700}#fe[data-theme="light"] .fe-md-alert-caution{--al:#d1242f}
.fe-md-footnotes{border-top:1px solid var(--bd);margin-top:2em;padding-top:.8em;font-size:.88em;color:var(--mt)}
.fe-md-fnref a,.fe-md-fnback{text-decoration:none}
#fe-page .fe-md code,#fe-page .fe-md-pre,#fe-ql-body .fe-md code,#fe-ql-body .fe-md-pre{font-size:calc(var(--rd-code,13px) * var(--ui-text-scale,1))}
#fe.fe-notips #fe-tip{display:none!important}
#fe-fp-column:hover{border-color:var(--ac);color:var(--ac)}
#fe-toc a.on{color:var(--tx);background:var(--act)}
.fe-crumb-file{color:var(--tx);font-weight:500}
#fe-fp-meta{font-size:var(--fs-sm);color:var(--dm);margin-right:auto;white-space:nowrap}
#fe-nt-list .fe-nt-hit{display:block;padding:0 10px 4px 32px;font-size:var(--fs-sm);color:var(--dm);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
/* Editing in place: coloured, numbered source in the reading column. The
   painted copy (#fe-fe-paint) and the textarea share font, padding and
   wrapping exactly, so the caret sits over its own text. */
#fe-fe{flex:1;min-width:0;display:flex;flex-direction:column;min-height:0;position:relative}
#fe-fe-banner{display:flex;align-items:center;gap:8px;padding:8px 14px;border-bottom:1px solid var(--bd);background:var(--s1)}
#fe-fe-scroll{flex:1;min-height:0;overflow:auto;cursor:text}
#fe-fe-col{max-width:980px;margin:0 auto;padding:28px 28px 120px}
#fe-fe-src{position:relative}
#fe-fe-src[hidden]{display:none}
#fe-fe-paint,#fe-fe-ta{margin:0;font-family:var(--mono);font-size:calc(var(--rd-code,13px) * var(--ui-text-scale,1));line-height:1.7;
  white-space:pre-wrap;overflow-wrap:anywhere;tab-size:4;letter-spacing:0}
#fe-fe-paint{padding:0;color:var(--tx);pointer-events:none}
.fe-fe-row{display:grid;grid-template-columns:52px minmax(0,1fr)}
.fe-fe-ln{color:var(--dm);text-align:right;padding-right:16px;user-select:none}
/* The caret's line, so every click shows where it landed. */
.fe-fe-row.cur{background:color-mix(in srgb,var(--ac) 8%,transparent);border-radius:3px}
.fe-fe-row.cur .fe-fe-ln{color:var(--tx)}
#fe-fe-ta{position:absolute;top:0;left:0;width:100%;padding:0 0 0 52px;border:0;outline:0;resize:none;overflow:hidden;
  background:transparent;color:transparent;caret-color:var(--ac)}
#fe-fe-ta::selection{background:color-mix(in srgb,var(--ac) 40%,transparent);color:transparent}
/* Large files: no wrapping, so every row is one line tall and only a window
   of rows is painted (#fe-fe-win, moved down to where the viewport is). */
.fe-fe-big #fe-fe-paint,.fe-fe-big #fe-fe-ta{white-space:pre;overflow-wrap:normal}
#fe-fe-win{will-change:transform}
#fe-fe-view{padding:0;max-width:none}
#fe-fe-pill{position:absolute;top:12px;right:18px;z-index:5;display:flex;align-items:center;gap:2px;padding:3px;
  background:var(--s1);border:1px solid var(--bd);border-radius:999px;box-shadow:0 6px 20px rgb(0 0 0 / .25)}
#fe-fe-pill .btn[data-variant="solid"]{border-radius:999px;padding:0 12px}
#fe-fe-state{display:inline-flex;align-items:center;gap:5px;padding:0 8px 0 10px;font-size:var(--fs-md);color:var(--mt);
  transition:color var(--t-fast) var(--ease)}
#fe-fe-state.saved{color:var(--green)}
#fe-fe-state.failed{color:var(--nc-red)}
#fe-fe-state.failed .fe-fe-dot{background:var(--nc-red)}
#fe-fe-state svg{width:13px;height:13px}
.fe-fe-dot{width:6px;height:6px;border-radius:50%;background:var(--ac)}
#fe-allow{position:fixed;z-index:320;width:340px;padding:14px;background:var(--s1);border:1px solid var(--bd2);border-radius:10px;
  box-shadow:0 12px 32px rgb(0 0 0 / .3);animation:fe-pop var(--t-base) var(--ease)}
#fe-allow p{color:var(--mt);font-size:var(--fs-md);margin:6px 0 12px;line-height:1.5}
#fe-allow code{font:var(--fs-md) var(--mono);background:var(--s2);padding:1px 4px;border-radius:4px;overflow-wrap:anywhere}
.fe-allow-title{display:flex;align-items:center;gap:8px;font-weight:600}
.fe-allow-acts{display:flex;gap:6px;justify-content:flex-end}
#fe-allow.fe-allow-note{border-color:color-mix(in srgb,var(--nc-red) 50%,var(--bd2))}
#fe-fp-edit.busy{opacity:.6;cursor:progress}
@keyframes fe-pop{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){#fe-allow{animation:none}}
#fe-fp-reload{font-size:var(--fs-sm);color:var(--dm)}
#fe-ed-bar{display:flex;align-items:center;gap:4px;padding:6px 10px;border-bottom:1px solid var(--bd);background:var(--s2);flex-shrink:0;flex-wrap:wrap}
#fe-ed-bar .fe-pbn{padding:2px 7px;font-size:var(--fs-sm);display:inline-flex;align-items:center;gap:5px}
.fe-ed-hint{margin-left:auto;font-size:var(--fs-sm);color:var(--dm);white-space:nowrap}
#fe-ed-hist{display:flex;flex-direction:column;gap:2px;padding:6px 10px;border-bottom:1px solid var(--bd);background:var(--s2);max-height:180px;overflow:auto;flex-shrink:0;font-size:var(--fs-sm);color:var(--dm)}
.fe-hist-row{display:grid;grid-template-columns:minmax(120px,160px) 1fr auto;gap:10px;align-items:baseline;text-align:left;background:none;border:1px solid transparent;border-radius:5px;padding:3px 6px;color:var(--tx);cursor:pointer;font:inherit}
.fe-hist-row:hover,.fe-hist-row.active{border-color:var(--ac);background:var(--act)}
.fe-hist-row code{color:var(--dm)}
.fe-hist-head{display:flex;gap:8px;align-items:center;padding:8px 12px;border-bottom:1px solid var(--bd);color:var(--dm);font-size:var(--fs-sm)}
#fe-ql-body.fe-editing{display:flex;flex-direction:column}
.fe-ed{display:flex;flex:1;min-height:0}
.fe-md img{max-width:100%;border-radius:6px}
#fe-ed-src{flex:1;min-width:0;resize:none;border:none;border-right:1px solid var(--bd);background:var(--s1);color:var(--tx);
  font:var(--fs-md)/1.6 ui-monospace,SFMono-Regular,Menlo,monospace;padding:14px 16px;outline:none;tab-size:2}
#fe-ed-view{flex:1;min-width:0;overflow:auto}
#fe-qlook.side .fe-ed{flex-direction:column}
#fe-qlook.side #fe-ed-src{border-right:none;border-bottom:1px solid var(--bd);min-height:40%}
#fe-ed-conflict{display:flex;align-items:center;gap:8px;padding:8px 14px;border-bottom:1px solid var(--bd)}
#fe-ed-meta{display:flex;align-items:center;gap:6px;padding:7px 10px;border-bottom:1px solid var(--bd);background:var(--s1);flex-shrink:0;flex-wrap:wrap}
.fe-chip-title{flex:1 1 180px;min-width:120px;background:var(--bg);border:1px solid var(--bd);color:var(--tx);border-radius:5px;padding:3px 8px;font:inherit;font-weight:600}
.fe-chip-title:focus{outline:none;border-color:var(--ac)}
button.fe-chip-title{display:flex;align-items:center;gap:6px;text-align:left;cursor:text;min-width:0}
button.fe-chip-title:hover{border-color:var(--ac)}
button.fe-chip-title svg{flex:none;width:12px;height:12px;color:var(--dm)}
textarea.fe-chip-title{flex:1 1 100%;resize:none;overflow:hidden;line-height:1.35;min-height:28px}
.fe-chip,.fe-chip-btn{display:inline-flex;align-items:center;gap:5px}
.fe-chip{border:1px solid var(--bd);border-radius:999px;padding:1px 4px 1px 8px;font-size:var(--fs-sm);color:var(--mt);background:var(--bg)}
.fe-chip svg,.fe-chip-btn svg{flex:none;width:12px;height:12px}
.fe-chip-static{padding-right:8px}
.fe-chip-x{background:none;border:0;color:var(--dm);cursor:pointer;display:grid;place-items:center;padding:2px;border-radius:50%}
.fe-chip-x:hover{color:var(--ac)}
#fe-ed-meta .fe-pbn{padding:2px 8px;font-size:var(--fs-sm)}
.fe-cdot{flex:none}
.fe-pmenu{position:fixed;z-index:2147483000;width:250px;background:var(--s1);border:1px solid var(--bd);border-radius:8px;padding:8px;box-shadow:0 8px 24px rgba(0,0,0,.35);display:flex;flex-direction:column;gap:6px}
.fe-pmenu .fe-pbn{display:inline-flex;align-items:center;gap:6px;text-align:left}
.fe-pmenu .fe-pbn svg{flex:none;width:12px;height:12px}
.fe-pm-lbl{font-size:var(--fs-sm);color:var(--mt);text-transform:uppercase;letter-spacing:.04em}
.fe-pm-colors{display:grid;grid-template-columns:1fr 1fr;gap:4px}
.fe-pm-tags{display:flex;flex-wrap:wrap;gap:4px}
.fe-pm-add{display:flex;gap:4px}
.fe-pm-add input{flex:1;min-width:0;background:var(--bg);border:1px solid var(--bd);color:var(--tx);border-radius:5px;padding:3px 7px;font:inherit}
.fe-pm-add input:focus{outline:none;border-color:var(--ac)}
.fe-nt-main{display:flex;flex-direction:column;min-width:0;flex:1 1 0;gap:1px}
.fe-mid{display:flex;min-width:0;max-width:100%;overflow:hidden}
.fe-mid-h{overflow:hidden;text-overflow:ellipsis;white-space:pre;min-width:0}
.fe-mid-t{white-space:pre;flex:none}
.fe-nt-label{flex:none;display:flex;min-width:0;white-space:nowrap;overflow:hidden;line-height:1.3}
.fe-nt-label.editing{display:block;white-space:normal;overflow:visible;overflow-wrap:anywhere}
.fe-nt-item .fe-nt-acts{position:absolute;right:0;top:50%;transform:translateY(-50%);display:flex;align-items:center;
  background:var(--hover);border-radius:4px;opacity:0;pointer-events:none;transition:opacity .1s}
.fe-nt-item:hover .fe-nt-acts,.fe-nt-item:focus-within .fe-nt-acts{opacity:1;pointer-events:auto}
.fe-nt-tags{font-size:var(--fs-sm);color:var(--mt);display:flex;gap:6px;flex-wrap:wrap}
.fe-nt-tags span{display:inline-flex;align-items:center;gap:3px}
.fe-nt-tags svg{width:10px;height:10px;flex:none}
.fe-nt-flags{display:inline-flex;align-items:center;gap:4px;flex:none}
.fe-nt-flags svg{width:12px;height:12px}
.fe-nt-pin{color:var(--gold)}
.fe-nt-props{background:none;border:0;color:var(--dm);cursor:pointer;padding:4px;display:grid;place-items:center;opacity:0;flex:none}
.fe-nt-item:hover .fe-nt-props,.fe-nt-props:focus-visible{opacity:1}
.fe-nt-props:hover{color:var(--ac)}
.fe-nt-props svg{width:14px;height:14px}
.fe-nt-item .fe-si-link{padding-left:14px}
.fe-nt-tab{background:none;border:0;color:var(--dm);cursor:pointer;padding:4px;display:grid;place-items:center;opacity:0;flex:none}
.fe-nt-item:hover .fe-nt-tab,.fe-nt-tab:focus-visible{opacity:1}
.fe-nt-tab:hover{color:var(--ac)}
.fe-nt-tab svg{width:14px;height:14px}
#fe-nt-add{background:none;border:1px solid var(--bd);color:var(--mt);cursor:pointer;border-radius:4px;
  width:18px;height:18px;line-height:1;font-size:var(--fs-lg);padding:0;display:flex;align-items:center;justify-content:center}
#fe-sv-add{margin-left:auto}
#fe-nt-add:hover{border-color:var(--ac);color:var(--ac)}
.fe-sh a{color:inherit;text-decoration:none}
.fe-sh a:hover{color:var(--ac)}
#fe-ql-hdr{display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid var(--bd);flex-shrink:0}
#fe-ql-icon svg{display:block}
/* Docked, the header keeps its name readable and its close button inside the panel: buttons go icon-only. */
#fe-qlook.side #fe-ql-hdr > button > span,#fe-qlook.side #fe-ql-hdr > a:not(#fe-ql-name) > span{display:none}
#fe-qlook.side #fe-ql-hdr{gap:5px;padding:8px 10px}
/* Docked, the header's labelled buttons lose their labels and become icon circles. */
#fe-qlook.side #fe-ql-hdr > button,#fe-qlook.side #fe-ql-hdr > #fe-ql-open{width:26px;padding:0;border-radius:50%}
#fe-qlook.side #fe-ql-hdr > *{flex-shrink:0}
#fe-qlook.side #fe-ql-name,#fe-qlook.side #fe-ql-meta{flex-shrink:1;min-width:0}
#fe-qlook.side #fe-ed-bar > button > span{display:none}
#fe-qlook.side .fe-ed-hint{display:none}
#fe-ql-name{font-weight:600;font-size:var(--fs-lg);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:inherit;text-decoration:none}
#fe-ql-name:hover{color:var(--ac);text-decoration:underline}
#fe-ql-meta{font-size:var(--fs-sm);color:var(--dm);flex:1;white-space:nowrap}
#fe-ql-body{flex:1;overflow:auto;font-size:var(--fs-md)}
#fe-ql-body:has(> .fe-ql-htmlbar){display:flex;flex-direction:column}
.fe-ql-htmlbar{display:flex;gap:4px;padding:6px 10px;border-bottom:1px solid var(--bd);flex:none}
.fe-ql-html{flex:1;min-height:0;width:100%;border:0;background:#fff}
/* The preview panel reads at the same reader sizes as the file page; dialogs keep the base size. */
#fe-ql-body .fe-md{font-size:var(--fs-xl);line-height:var(--rd-lh,1.65)}
#fe-ql-ai{display:flex;align-items:center;gap:6px;padding:7px 14px;
  border-bottom:1px solid var(--bd);background:var(--s2);flex-shrink:0}
#fe-ql-ai-chip{display:flex;align-items:center;gap:5px;font-size:var(--fs-sm);color:var(--dm);
  margin-right:4px;white-space:nowrap}
#fe-ql-ai-chip .dot{width:7px;height:7px;border-radius:50%;background:var(--dm);flex-shrink:0}
#fe-ql-ai-chip.ready .dot{background:var(--green)}
#fe-ql-ai-chip.cold .dot{background:var(--gold)}
#fe-ql-ai-chip.down .dot{background:#f85149}
#fe-ql-ai-q{flex:1;min-width:80px;background:var(--bg);border:1px solid var(--bd);color:var(--tx);
  padding:4px 9px;border-radius:5px;font-size:var(--fs-md);outline:none;transition:border-color .15s}
#fe-ql-ai-q:focus{border-color:var(--ac)}
#fe-ql-ai-q:disabled{opacity:.45}
#fe-ql-ai-q::placeholder{color:var(--dm)}
#fe-ql-ai-out{border-bottom:1px solid var(--bd);max-height:42%;overflow-y:auto;flex-shrink:0;background:var(--s1)}
#fe-ql-ai-out-body{padding:10px 16px 4px;font-size:var(--fs-md);line-height:1.6;white-space:pre-wrap}
#fe-ql-ai-out-body .fe-md{padding:0;white-space:normal}
#fe-ql-ai-out-meta{padding:2px 16px 8px;font-size:var(--fs-xs);color:var(--dm)}
.fe-ql-center{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:10px}
.fe-ql-note{font-size:var(--fs-md);color:var(--dm);padding:6px 14px}
.fe-ql-note.err{color:#f85149}
.fe-ql-imgwrap{display:flex;flex-direction:column;height:100%}
.fe-ql-imgbar{display:flex;align-items:center;gap:4px;padding:6px 10px;border-bottom:1px solid var(--bd);background:var(--s2);flex-shrink:0;flex-wrap:wrap}
.fe-ql-imgbar .fe-pbn{padding:2px 7px;font-size:var(--fs-sm);display:inline-flex;align-items:center;gap:5px}
.fe-ql-imgbar .fe-pbn svg{flex:none;width:13px;height:13px}
.fe-ql-imgstage{flex:1;min-height:0;overflow:auto;display:flex}
.fe-ql-imgsizer{position:relative;margin:auto;flex:none}
.fe-ql-img{position:absolute;left:50%;top:50%;max-width:none;max-height:none;border-radius:4px;transform-origin:center}
.fe-ql-imgwrap .fe-ql-dim{padding:4px 12px;border-top:1px solid var(--bd);text-align:center;flex-shrink:0}
.fe-ql-dim{font-size:var(--fs-sm);color:var(--dm);font-variant-numeric:tabular-nums}
.fe-ql-pdf{width:100%;height:100%;border:none}
.fe-ql-media-wrap{display:flex;align-items:center;justify-content:center;height:100%;padding:16px}
.fe-ql-media{max-width:100%;max-height:100%;border-radius:4px;background:#000}
.fe-ql-center audio{width:min(480px,90%)}
.fe-ql-font{padding:20px 26px;overflow:auto;line-height:1.5}
.fe-ql-font>div{margin:6px 0;word-break:break-word;border-bottom:1px solid var(--s2);padding-bottom:6px}
.fe-code-wrap{font:var(--fs-md)/1.55 'SF Mono',Menlo,Consolas,monospace;min-height:100%}
.fe-code{padding:10px 14px 14px 0;width:max-content;min-width:100%}
.fe-cl-blk{content-visibility:auto;contain-intrinsic-size:auto calc(var(--n) * 1.55em)}
.fe-cl{display:grid;grid-template-columns:calc(var(--gut,4ch) + 22px) minmax(0,1fr)}
.fe-cl-n{position:sticky;left:0;padding:0 10px 0 12px;text-align:right;color:var(--dm);user-select:none;background:var(--card)}
.fe-cl-t{white-space:pre;padding-left:10px}
/* Wrap (Settings, and the file bar toggle): long lines fold inside the page. */
#fe[data-wrap="on"] .fe-code{width:auto}
#fe[data-wrap="on"] .fe-cl-t{white-space:pre-wrap;overflow-wrap:anywhere}
.tok-cmt{color:var(--mt);font-style:italic}
.tok-str{color:#7ee787}
.tok-kw{color:#ff7b72}
.tok-kw-ctrl{color:#ff7b72}
.tok-type{color:#56d4dd}
.tok-builtin{color:#ffa657}
.tok-lit{color:#a5d6ff}
.tok-num{color:#f2cc60}
.tok-var{color:#d2a8ff}
.tok-deco{color:#e2b340}
.tok-fn{color:#d2a8ff}.tok-regex{color:#a5d6a7}
.tok-key{color:#79c0ff}.tok-section{color:#d2a8ff}
.tok-add{color:#3fb950}.tok-del{color:#f85149}
#fe[data-theme="light"] .tok-str{color:#0a7d33}
#fe[data-theme="light"] .tok-kw,#fe[data-theme="light"] .tok-kw-ctrl{color:#cf222e}
#fe[data-theme="light"] .tok-type{color:#1b7c83}
#fe[data-theme="light"] .tok-builtin{color:#953800}
#fe[data-theme="light"] .tok-lit{color:#8250df}
#fe[data-theme="light"] .tok-num{color:#9a6700}
#fe[data-theme="light"] .tok-var{color:#8250df}
#fe[data-theme="light"] .tok-deco{color:#9a6700}
#fe[data-theme="light"] .tok-fn{color:#8250df}
#fe[data-theme="light"] .tok-regex{color:#116329}
#fe[data-theme="light"] .tok-key{color:#0550ae}
#fe[data-theme="light"] .tok-section{color:#8250df}
#fe[data-theme="light"] .tok-add{color:#1a7f37}
#fe[data-theme="light"] .tok-del{color:#cf222e}
.fe-ql-table{border-collapse:collapse;width:100%;font:var(--fs-md) 'SF Mono',Menlo,Consolas,monospace}
.fe-ql-table th{position:sticky;top:0;background:var(--s2);padding:6px 10px;text-align:left;
  border-bottom:1px solid var(--bd);cursor:pointer;white-space:nowrap;color:var(--mt);font-weight:600;z-index:1}
.fe-ql-table th:hover{color:var(--tx)}
.fe-ql-table th.sorted{color:var(--ac)}
.fe-ql-table td{padding:4px 10px;border-bottom:1px solid var(--s2);white-space:pre;
  max-width:340px;overflow:hidden;text-overflow:ellipsis}
.fe-ql-table th.num,.fe-ql-table td.num{text-align:right;font-variant-numeric:tabular-nums}
.fe-ql-table tbody tr:hover{background:var(--hover)}
.fe-jt-root,.fe-jl-root{padding:10px 14px;font:var(--fs-md)/1.6 'SF Mono',Menlo,Consolas,monospace}
.fe-jt summary,.fe-jl-line summary{cursor:pointer;list-style:none}
.fe-jt summary::-webkit-details-marker,.fe-jl-line summary::-webkit-details-marker{display:none}
.fe-jt summary svg,.fe-jl-line summary svg{color:var(--dm);flex-shrink:0;vertical-align:-2px;transform:rotate(-90deg)}
.fe-jt[open]>summary>svg,.fe-jl-line[open]>summary>svg{transform:none}
.fe-jt summary svg{margin-right:4px}
.fe-jt summary:hover{background:var(--hover)}
.fe-jt-kids{padding-left:16px;border-left:1px solid var(--s3);margin-left:4px}
.fe-jt-key{color:#79c0ff}
#fe[data-theme="light"] .fe-jt-key{color:#0550ae}
.fe-jt-colon{color:var(--dm)}
.fe-jt-badge{color:var(--dm);font-size:var(--fs-sm)}
.fe-jt-row{padding-left:12px}
.fe-jl-line{border-bottom:1px solid var(--s2);padding:2px 0}
.fe-jl-line summary{display:flex;gap:8px;align-items:baseline}
.fe-jl-n{color:var(--dm);min-width:28px;text-align:right;user-select:none;font-size:var(--fs-sm);flex-shrink:0}
.fe-jl-prev{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--mt)}
.fe-jl-line.bad{display:flex;gap:8px;align-items:baseline}
.fe-jl-err{color:#f85149;font-size:var(--fs-xs);border:1px solid #f8514940;border-radius:3px;padding:0 4px;flex-shrink:0}
.fe-md{padding:14px 22px 20px;font-size:var(--fs-lg);line-height:1.65;max-width:760px;color:var(--tx)}
/* Reading rhythm: every block owns the space below it, in em, so one scale
   holds in the file page, preview, notes, dialogs and AI answers alike. */
.fe-md>*,.fe-md-alert>*,.fe-md blockquote>*{margin:0 0 .9em}
.fe-md>:last-child,.fe-md-alert>:last-child,.fe-md blockquote>:last-child{margin-bottom:0}
.fe-md h1,.fe-md h2,.fe-md h3,.fe-md h4,.fe-md h5,.fe-md h6{font-weight:600;line-height:1.3;margin:1.6em 0 .5em;color:var(--tx)}
.fe-md>h1:first-child,.fe-md>h2:first-child,.fe-md>h3:first-child,.fe-md>.fe-md-fm+h1,.fe-md>.fe-md-fm+h2{margin-top:0}
.fe-md h1{font-size:1.75em;padding-bottom:.3em;border-bottom:1px solid var(--bd)}
.fe-md h2{font-size:1.4em;padding-bottom:.3em;border-bottom:1px solid var(--bd)}
.fe-md h3{font-size:1.15em}
.fe-md h4,.fe-md h5,.fe-md h6{font-size:1em}
.fe-md h5,.fe-md h6{color:var(--mt)}
.fe-md ul,.fe-md ol{padding-left:1.6em}
.fe-md li{margin:0}
.fe-md li+li{margin-top:.35em}
.fe-md li>p{margin:0}
.fe-md li>p+p,.fe-md li>p+ul,.fe-md li>p+ol,.fe-md li>ul,.fe-md li>ol,.fe-md li>.fe-md-code,.fe-md li>.fe-md-pre{margin:.35em 0 0}
.fe-md li::marker{color:var(--mt)}
.fe-md code{background:var(--s2);border:0;padding:.12em .4em;border-radius:4px;font-family:var(--mono);font-size:.86em}
.fe-md a code{color:inherit}
.fe-md-code{border:1px solid var(--bd);border-radius:8px;background:color-mix(in srgb,var(--card),var(--tx) 3.5%);overflow:hidden}
.fe-md-code-bar{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:4px 6px 0 12px;background:none}
.fe-md-lang{font:600 var(--fs-sm)/1 var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--dm)}
.fe-md-copy{position:relative;display:inline-grid;place-items:center;width:24px;height:24px;padding:0;border:0;border-radius:50%;
  background:none;color:var(--dm);cursor:pointer;transition:background var(--t-fast) var(--ease),color var(--t-fast) var(--ease)}
.fe-md-copy:hover{background:var(--shade);color:var(--tx)}
.fe-md-copy:focus-visible{outline:2px solid var(--ac);outline-offset:1px}
.fe-md-copy svg{width:14px;height:14px}
.fe-md-copy.copied{color:var(--green)}
.fe-md-pre{background:var(--s1);border:1px solid var(--bd);border-radius:6px;padding:.75em 1em;
  overflow-x:auto;font-family:var(--mono);font-size:.86em;line-height:1.55;white-space:pre;color:var(--tx)}
.fe-md-code .fe-md-pre{border:none;border-radius:0;margin:0;padding-top:.4em;background:none}
.fe-md-code{background:color-mix(in srgb,var(--s1),#000 6%)}
.fe-md-lines{counter-reset:ln;padding-left:.2em}
.fe-md-l{display:block;width:max-content;min-width:100%;box-sizing:border-box;padding-right:1em;border-radius:3px;counter-increment:ln}
.fe-md-l::before{content:counter(ln);display:inline-block;width:2.2em;margin-right:1em;text-align:right;color:var(--dm);opacity:.6;user-select:none}
.fe-md-l:hover{background:color-mix(in srgb,var(--tx) 6%,transparent)}
.fe-md-mermaid{padding:14px;border:1px solid var(--bd);border-radius:6px;
  background:var(--s1);overflow-x:auto;text-align:center}
.fe-md-mermaid svg{display:block;max-width:100%;height:auto;margin:auto}
.fe-md-mermaid-source[hidden]{display:none}
.fe-md-mermaid-source{margin:8px 0 0;padding:10px;text-align:left;white-space:pre-wrap;
  background:var(--s2);border-radius:4px;font:var(--fs-md)/1.55 var(--mono)}
.fe-md-anchor{margin-left:8px;color:var(--dm);font-weight:400;text-decoration:none;opacity:0;transition:opacity var(--t-fast)}
.fe-md-anchor::before{content:'#'}
.fe-md h1:hover .fe-md-anchor,.fe-md h2:hover .fe-md-anchor,.fe-md h3:hover .fe-md-anchor,.fe-md h4:hover .fe-md-anchor,.fe-md h5:hover .fe-md-anchor,.fe-md h6:hover .fe-md-anchor{opacity:1}
.fe-md-fm{display:grid;grid-template-columns:max-content 1fr;gap:3px 14px;padding:10px 14px;background:var(--s1);border:1px solid var(--bd);border-radius:6px;font-size:var(--fs-md)}
.fe-md-fm dt{color:var(--dm);font-weight:600}
.fe-md-fm dd{margin:0;color:var(--tx)}
.fe-md li.fe-task{list-style:none;margin-left:-1.3em;padding-left:0}
.fe-md li.fe-task input{accent-color:var(--ac);margin-right:6px;vertical-align:-2px}
.fe-md-tablewrap{overflow-x:auto}
.fe-md img{display:block;margin-left:auto;margin-right:auto;cursor:zoom-in;max-width:100%;border-radius:6px}
.fe-md blockquote{border-left:3px solid var(--bd2);padding:0 1em;color:var(--mt)}
.fe-md blockquote .fe-md{padding:0}
.fe-md a{color:var(--ac);text-decoration:none}
.fe-md a:hover{text-decoration:underline}
.fe-md hr{border:none;border-top:1px solid var(--bd);margin:1.6em 0}
.fe-md strong{font-weight:600}
.fe-md-table{border-collapse:separate;border-spacing:0;margin:0;font-size:.93em;border:1px solid var(--bd);border-radius:6px;overflow:hidden}
.fe-md-table th,.fe-md-table td{border:0;border-bottom:1px solid var(--bd);padding:.55em .9em;text-align:left;vertical-align:top}
.fe-md-table tbody tr:last-child td{border-bottom:0}
.fe-md-table thead{position:static;background:none}
.fe-md-table thead th{background:color-mix(in srgb,var(--s1),var(--tx) 5%);font-weight:600;font-size:inherit;letter-spacing:0;text-transform:none;color:var(--tx);
  white-space:normal;user-select:text;padding:.55em .9em}
#fe-ctx,.fe-ctx{position:fixed;z-index:360;background:var(--s1);border:1px solid var(--bd);border-radius:var(--r);
  min-width:180px;box-shadow:0 8px 24px #0009;display:none;padding:4px 0}
.fe-ctx-item{display:flex;align-items:center;gap:8px;padding:6px 12px;color:var(--tx);
  font-size:var(--fs-md);cursor:pointer;white-space:nowrap}
.fe-ctx-item:hover{background:var(--hover)}
.fe-ctx-key{margin-left:auto;color:var(--dm);font-size:var(--fs-xs);padding-left:16px}
.fe-ctx-sep{height:1px;background:var(--bd);margin:4px 0}
.fe-tab-ico svg{width:15px;height:16px}
.fe-tab-x,.fe-tab-more{opacity:.6}
.fe-tab:focus-visible,.fe-tab-x:focus-visible,.fe-tab-more:focus-visible{outline:2px solid var(--mt);outline-offset:-2px}
@media (max-width:900px){
  #fe-side{width:clamp(200px,26vw,240px)}
  #fe-toc-rail{width:clamp(150px,22vw,190px)}
  #fe-ff-q{width:110px}
  #fe-page .fe-md{padding:20px 18px 60px}
  #fe-fp-bar{flex-wrap:wrap;padding:7px 10px}
}
@container fe-main (max-width:760px){
  #fe-toolbar{flex-wrap:wrap}
  #fe-count{flex-basis:100%}
  #fe-tb-right{width:100%;flex-wrap:wrap;justify-content:flex-start}
}
/* Soft (design-system.md): the sidebar, the main pane and a docked preview
   float as cards on the page background; rows are 36px with no lines, and
   selection is a wash with rounded ends, never a ring. The sidebar's resize
   handle is the 10px gutter between cards and shows a thin line on hover. */
#fe-body{padding:10px;background:var(--bg)}
#fe-side,#fe-main,#fe-qlook.side{border:1px solid var(--bd);border-radius:12px;overflow:hidden}
/* The page is the lightest surface, the sidebar one step below it, and the
   page background the deepest; bars inside the page share its colour and are
   set apart by a hairline, not a grey band. */
#fe-side{background:var(--side)}
#fe-main,#fe-toolbar,#fe-fp-bar,#fe-statusbar,thead{background:var(--card)}
#fe-tabs{background:var(--side)}
.fe-tab.on{background:var(--card)}
#fe-qlook.side{margin-left:10px}
#fe-side-rz{width:10px;background:linear-gradient(var(--ac),var(--ac)) center/0 100% no-repeat;transition:background-size var(--t-fast) var(--ease)}
#fe-side-rz:hover,#fe-side-rz.drag{background:linear-gradient(var(--ac),var(--ac)) center/2px 100% no-repeat}
#fe-table{border-collapse:separate;border-spacing:0}
#fe-table tbody tr{border-bottom:0}
#fe-table tbody tr:hover{background:none}
#fe-table tbody tr:hover td{background:var(--hover)}
#fe-table tbody td{height:36px}
#fe.compact #fe-table tbody td{height:28px}
#fe-table tbody td:first-child{border-radius:8px 0 0 8px}
#fe-table tbody td:last-child{border-radius:0 8px 8px 0}
#fe-scroll{padding:0 6px}
.fe-row.selected .fe-nm{color:var(--tx)}
.fe-tile.selected{border-color:transparent}
.fe-hist-row.active{border-color:transparent}

/* One row and one floating surface. Every list row (Places, Saved, Notes,
   History, the path menu, context menus) shares a height, inset, corner,
   icon size, text size and hover wash; in the sidebar a row sits 6px in from
   the card edge, in a menu the menu's own 6px padding gives the same inset.
   Every popover, menu, tip and the Contents card share one surface. Notes
   rows grow to fit a tag line but keep the inset and corners. */
:root{--fs-xs:calc(10px * var(--ui-text-scale,1));--fs-sm:calc(11px * var(--ui-text-scale,1));--fs-md:calc(12px * var(--ui-text-scale,1));--fs-lg:calc(13px * var(--ui-text-scale,1));--fs-xl:calc(15px * var(--ui-text-scale,1));--row-h:32px;--row-r:8px;--row-px:10px;--row-gap:10px;--row-ic:16px;--row-fs:var(--fs-lg);
  --pop-r:12px;--pop-pad:6px;--pop-bg:color-mix(in srgb,var(--card) 90%,transparent);--pop-bd:var(--bd2);
  --pop-sh:0 12px 32px rgb(0 0 0 / .34),0 1px 3px rgb(0 0 0 / .2);--pop-blur:blur(16px) saturate(1.2)}
#fe[data-theme="light"],html:has(#fe[data-theme="light"]){--pop-bg:color-mix(in srgb,var(--card) 94%,transparent);--pop-bd:var(--bd);
  --pop-sh:0 10px 28px rgb(16 24 32 / .12),0 1px 3px rgb(16 24 32 / .08)}
.fe-si,.fe-bm-item,.fe-dd-item,.fe-ctx-item{min-height:var(--row-h);margin:0 6px;padding:0 var(--row-px);gap:var(--row-gap);
  border-radius:var(--row-r);font-size:var(--row-fs);transition:background var(--t-fast) var(--ease),color var(--t-fast) var(--ease)}
.fe-dd-item,.fe-ctx-item{margin:0}
button.fe-si{width:auto;display:flex}
.fe-si:hover,.fe-bm-item:hover,.fe-dd-item:hover,.fe-ctx-item:hover{background:var(--hover)}
.fe-bm-item:has(> .fe-si-link.active){background:var(--act)}
.fe-si > svg,.fe-si-link > svg,.fe-dd-item > svg,.fe-ctx-item > svg{width:var(--row-ic);height:var(--row-ic);flex:none}
.fe-sl{font-size:var(--row-fs)}
.fe-si-link{padding:0;gap:var(--row-gap);min-height:var(--row-h)}
.fe-nt-item .fe-si-link{padding:6px 0}
.fe-pl-item .fe-drag-h{position:absolute;left:-7px;top:0;bottom:0;padding:0;width:8px;justify-content:center}
.fe-pl-item .fe-rm-btn{padding:4px 0 4px 4px}
/* A note row's actions float over the end of the title on a solid fade, so
   nothing moves under the pointer on hover. In a narrow sidebar only delete
   shows; colour and open-in-tab stay in the right-click menu. */
.fe-nt-item .fe-nt-acts{right:4px;border-radius:0 var(--row-r) var(--row-r) 0;padding-left:14px;
  background:linear-gradient(to right,transparent,color-mix(in srgb,var(--side),var(--tx) 6%) 14px)}
.fe-nt-item:has(> .fe-si-link.active) .fe-nt-acts{background:linear-gradient(to right,transparent,color-mix(in srgb,var(--side),var(--ac) 18%) 14px)}
.fe-nt-item:has(.editing) .fe-nt-acts{display:none}
.fe-nt-item .fe-rm-btn{padding:4px 6px}
#fe-lenses{container:lens/inline-size}
@container lens (max-width:200px){.fe-nt-props,.fe-nt-tab{display:none!important}}
/* A tag group is a plain section: one header row (chevron, colour, name,
   count) at the row inset, and its rows exactly like every other row. */
.fe-grp{margin:6px 0 0;padding:0;background:none;border-radius:0}
.fe-grp:not([open]){padding:0}
.fe-grp .fe-bm-item{margin:0 6px}
.fe-grp > summary{min-height:28px;margin:0 6px;padding:0 var(--row-px);border-radius:var(--row-r);gap:8px;
  font-size:var(--fs-sm);letter-spacing:.06em;transition:background var(--t-fast) var(--ease),color var(--t-fast) var(--ease)}
.fe-grp > summary:hover{background:var(--hover);color:var(--tx)}
.fe-grp > summary svg{width:12px;height:12px;opacity:.8}
.fe-sh{padding:10px 16px 4px}
.fe-lens-h{padding:6px 12px 8px 16px}
.fe-hint{padding:6px 16px}
#fe-lens-filter,#fe-docs-q{width:calc(100% - 12px);margin:2px 6px 8px;height:30px;padding:0 10px;border-radius:var(--row-r);font-size:var(--row-fs)}
#fe-lens-filter,#fe-search,#fe-srch-q,#fe-find-text,#fe-filter-q,#fe-docs-q,.fe-dd-search{padding-left:28px!important;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='13' height='13' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2' stroke-linecap='round'%3E%3Ccircle cx='11' cy='11' r='7'/%3E%3Cpath d='m20 20-3.5-3.5'/%3E%3C/svg%3E");
  background-repeat:no-repeat;background-position:9px 50%}
.fe-lens-tags{padding:0 6px 8px}
#fe-crumb-menu,#fe-ctx,.fe-ctx,.fe-pmenu,#fe-tip,#fe-hint,#fe-allow,#fe-toc-rail,#fe-fe-pill,#fe-toast{
  background:var(--pop-bg);border:1px solid var(--pop-bd);box-shadow:var(--pop-sh);
  backdrop-filter:var(--pop-blur);-webkit-backdrop-filter:var(--pop-blur);color:var(--tx)}
#fe-crumb-menu,#fe-ctx,.fe-ctx,.fe-pmenu,#fe-tip,#fe-allow,#fe-toc-rail{border-radius:var(--pop-r)}
#fe-crumb-menu,#fe-ctx,.fe-ctx{padding:var(--pop-pad)}
#fe-hint{border-radius:var(--row-r);padding:5px 10px}
.fe-dd-search-wrap{padding:0 0 6px;margin-bottom:4px}
.fe-dd-search{height:30px;padding:0 10px;border-radius:var(--row-r);font-size:var(--row-fs)}
.fe-dd-items{padding:0}
.fe-ctx-sep{margin:4px 4px}
.fe-toast-act{color:var(--ac)}
/* Contents is a quiet card, with a faint rail per heading level so the
   hierarchy reads at a glance. */
#fe-toc-rail{box-shadow:0 1px 2px rgb(0 0 0 / .05),0 4px 14px rgb(0 0 0 / .06)}
#fe-toc a{margin:0 6px;position:relative}
#fe-toc a.fe-toc-h2,#fe-toc a.fe-toc-h3,#fe-toc a.fe-toc-h4{--rail:color-mix(in srgb,var(--bd2) 55%,transparent)}
#fe-toc a.fe-toc-h2::before,#fe-toc a.fe-toc-h3::before,#fe-toc a.fe-toc-h4::before{content:'';position:absolute;inset:0 auto 0 0;width:44px;pointer-events:none;
  background:linear-gradient(var(--rail),var(--rail)) 13px 0/1px 100% no-repeat}
#fe-toc a.fe-toc-h3::before,#fe-toc a.fe-toc-h4::before{background:linear-gradient(var(--rail),var(--rail)) 13px 0/1px 100% no-repeat,linear-gradient(var(--rail),var(--rail)) 25px 0/1px 100% no-repeat}
#fe-toc a.fe-toc-h4::before{background:linear-gradient(var(--rail),var(--rail)) 13px 0/1px 100% no-repeat,linear-gradient(var(--rail),var(--rail)) 25px 0/1px 100% no-repeat,linear-gradient(var(--rail),var(--rail)) 37px 0/1px 100% no-repeat}

/* Motion. Things that appear fade and settle from a few pixels away; a
   folded group's body eases its height; the lens that takes over the
   sidebar slides in from the side it was picked on. One duration family
   (--t-fast, --t-base) and one ease. Reduced motion snaps everything. */
@keyframes fe-rise{from{opacity:0;transform:translateY(-4px) scale(.985)}to{opacity:1;transform:none}}
@keyframes fe-fade{from{opacity:0}to{opacity:1}}
@keyframes fe-lens-in{from{opacity:0;transform:translateX(-6px)}to{opacity:1;transform:none}}
@keyframes fe-dock-in{from{opacity:0;transform:translateX(16px)}to{opacity:1;transform:none}}
#fe-crumb-menu,#fe-ctx,.fe-ctx,.fe-pmenu{animation:fe-rise var(--t-fast) var(--ease);transform-origin:top left}
.fe-lens:not([hidden]){animation:fe-lens-in var(--t-base) var(--ease)}
.fe-dlg-bg,#fe-ql-bg{animation:fe-fade var(--t-base) var(--ease)}
.fe-dlg-box,#fe-qlook:not(.side) #fe-ql-dialog{animation:fe-rise var(--t-base) var(--ease)}
#fe-qlook.side{animation:fe-dock-in var(--t-base) var(--ease)}
.fe-grp{interpolate-size:allow-keywords}
.fe-grp::details-content{block-size:0;overflow:hidden;transition:block-size var(--t-base) var(--ease),content-visibility var(--t-base) allow-discrete}
.fe-grp[open]::details-content{block-size:auto}
.fe-sh-collapse svg{transition:transform var(--t-fast) var(--ease)}
/* Settings and Help read as a page: the title across the top, the sections
   listed on the left the way the sidebar lists lenses, the pane on the right.
   In Settings each row names the setting, says what it changes and keeps its
   control on the right; rows sit in cards by subject. */
.fe-dlg-box{display:grid;grid-template-columns:200px minmax(0,1fr);grid-template-rows:auto minmax(0,1fr);
  width:min(920px,calc(100vw - 40px));height:min(640px,86vh);border-radius:14px;background:var(--card);border-color:var(--pop-bd);box-shadow:var(--pop-sh)}
#fe-settings-modal .fe-dlg-box{width:min(920px,calc(100vw - 40px))}
.fe-dlg-title{grid-column:1/-1;background:none;border-bottom:1px solid var(--bd);border-radius:14px 14px 0 0}
.fe-dlg-mark{border:0;border-radius:8px}
.fe-dlg-tabs{flex-direction:column;gap:2px;padding:10px 6px;background:var(--side);border-bottom:0;border-right:1px solid var(--bd);overflow-y:auto;border-radius:0 0 0 14px}
.fe-dlg-tab{border:0;border-radius:var(--row-r);padding:8px 10px;gap:3px;white-space:normal;transition:background var(--t-fast) var(--ease),color var(--t-fast) var(--ease)}
.fe-dlg-tab:hover{background:var(--hover)}
.fe-dlg-tab.on{background:var(--act);color:var(--tx)}
.fe-dlg-tab-main{gap:var(--row-gap)}
.fe-dlg-tab-main svg{width:15px;height:15px}
.fe-dlg-tab b{font-size:var(--row-fs);font-weight:500}
.fe-dlg-tab i{padding-left:25px;line-height:1.3}
.fe-dlg-pane{padding:20px 24px 24px}
.fe-dlg-pane.on{gap:16px}
.fe-dlg-pane .fe-pbn{height:30px;padding:0 12px;border-radius:var(--row-r);font-size:var(--row-fs)}
.fe-set-card{background:var(--side);border:1px solid var(--bd);border-radius:12px;padding:2px 0 4px}
.fe-set-h{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:40px;padding:8px 16px 4px;
  font-size:var(--fs-md);font-weight:600;color:var(--tx)}
.fe-set{display:flex;align-items:center;gap:16px;min-height:52px;padding:8px 16px;border-top:1px solid color-mix(in srgb,var(--bd) 70%,transparent)}
.fe-set-h + .fe-set{border-top:0}
.fe-set-tx{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.fe-set-l{font-size:var(--row-fs);color:var(--tx)}
.fe-set-d{font-size:var(--fs-md);color:var(--dm);line-height:1.35}
.fe-set-c{display:flex;align-items:center;justify-content:flex-end;gap:8px;flex:none;max-width:62%}
.fe-set-c .fe-st-input{width:260px;max-width:100%}
.fe-set-note{padding:2px 16px 10px;font-size:var(--fs-md);color:var(--dm);line-height:1.5}
.fe-set-note:empty{display:none}
.fe-set-card .fe-st-rules-cols,.fe-set-card #fe-st-rules-list{margin:0 16px}
.fe-set-card #fe-st-reset-rules{margin:10px 16px 8px}
.fe-set-danger{color:var(--nc-red)}
.fe-dlg-pane .fe-st-select{height:30px;padding:0 28px 0 10px;border-radius:var(--row-r);font-size:var(--row-fs);background:var(--card) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' fill='none' stroke='%238b949e' stroke-width='1.4' stroke-linecap='round'/%3E%3C/svg%3E") no-repeat right 10px center;
  border-color:var(--bd2);appearance:none;-webkit-appearance:none}
.fe-dlg-pane .fe-st-input{height:30px;padding:0 10px;border-radius:var(--row-r);font-size:var(--row-fs)}
.fe-switch{appearance:none;-webkit-appearance:none;position:relative;flex:none;width:34px;height:20px;margin:0;border-radius:10px;
  background:var(--s3);cursor:pointer;transition:background var(--t-fast) var(--ease)}
.fe-switch::after{content:'';position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#fff;
  box-shadow:0 1px 2px rgb(0 0 0 / .3);transition:transform var(--t-fast) var(--ease),background var(--t-fast) var(--ease)}
.fe-switch:checked{background:var(--ac)}
.fe-switch:checked::after{transform:translateX(14px);background:var(--on-ac)}
.fe-switch:focus-visible{outline:2px solid var(--ac);outline-offset:2px}
.fe-seg{display:inline-flex;padding:2px;border-radius:10px;background:var(--bg);border:1px solid var(--bd)}
.fe-seg label{position:relative;cursor:pointer}
.fe-seg input{position:absolute;inset:0;width:100%;height:100%;margin:0;opacity:0;cursor:pointer}
.fe-seg span{display:block;padding:0 16px;line-height:26px;border-radius:8px;font-size:var(--row-fs);color:var(--mt);transition:background var(--t-fast) var(--ease),color var(--t-fast) var(--ease)}
.fe-seg input:checked + span{background:var(--card);color:var(--tx);box-shadow:0 1px 2px rgb(0 0 0 / .18)}
.fe-seg input:focus-visible + span{outline:2px solid var(--ac);outline-offset:1px}
.fe-set-sws{display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end}
.fe-set-sw{position:relative;display:flex;flex-direction:column;align-items:center;gap:5px;padding:6px 8px;border-radius:10px;cursor:pointer;
  font-size:var(--fs-md);color:var(--mt);transition:background var(--t-fast) var(--ease),color var(--t-fast) var(--ease)}
.fe-set-sw:hover{background:var(--hover)}
.fe-set-sw:has(input:checked){background:var(--act);color:var(--tx)}
.fe-set-sw input{position:absolute;inset:0;width:100%;height:100%;margin:0;opacity:0;cursor:pointer}
.fe-set-sw-chip{width:40px;height:26px;border-radius:7px;background:linear-gradient(135deg,var(--b) 55%,var(--a) 55%);box-shadow:inset 0 0 0 1px var(--bd2)}
/* Editing: the reading width applies to Raw and Rich; Split gives each side
   half the pane and its own scroll. Problems mark their row in the gutter. */
#fe-fe-col{max-width:none}
#fe.fe-column-xl #fe-fe-col{max-width:150ch}
#fe.fe-column-lg #fe-fe-col{max-width:130ch}
#fe.fe-column-md #fe-fe-col{max-width:110ch}
[data-mode="split"] #fe-fe-scroll{overflow:hidden}
#fe [data-mode="split"] #fe-fe-col{max-width:none;height:100%;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);padding:0}
/* Spacing on the text side is border, not padding: the typing layer is placed
   against the padding box, so padding would shift it off the painted text. */
[data-mode="split"] #fe-fe-src{overflow:auto;padding:0 20px 120px 0;border-top:24px solid transparent;border-left:12px solid transparent}
[data-mode="split"] #fe-fe-view{overflow:auto;padding:60px 28px 120px;border-left:1px solid var(--bd)}
#fe-fe-diag[hidden]{display:none}
.fe-fe-rich{padding:0}
[data-mode="rich"] #fe-fe-view,[data-mode="split"] #fe-fe-view{animation:fe-fade var(--t-base) var(--ease)}
.fe-html-frame{display:block;width:100%;height:calc(100vh - 210px);min-height:320px;border:1px solid var(--bd);border-radius:8px;background:#fff}
.fe-yaml-sep{border:0;border-top:1px dashed var(--bd);margin:12px 0}
.fe-fe-row.err,.fe-cl.err{background:color-mix(in srgb,var(--nc-red) 8%,transparent)}
.fe-fe-row.warn,.fe-cl.warn{background:color-mix(in srgb,var(--nc-orange) 7%,transparent)}
.fe-fe-row.err .fe-fe-ln,.fe-cl.err .fe-cl-n{color:var(--nc-red);font-weight:600}
.fe-fe-row.warn .fe-fe-ln,.fe-cl.warn .fe-cl-n{color:var(--nc-orange);font-weight:600}
.fe-fe-row.err .fe-fe-code,.fe-cl.err .fe-cl-t{text-decoration:underline wavy color-mix(in srgb,var(--nc-red) 70%,transparent);text-underline-offset:3px}
.fe-cl.flash{background:var(--act);transition:background 1s var(--ease)}
.fe-fe-modes{padding:2px;border-radius:999px}
.fe-fe-modes button{height:24px;padding:0 10px;border:0;border-radius:999px;background:none;color:var(--mt);font:inherit;font-size:var(--fs-md);cursor:pointer;transition:background var(--t-fast) var(--ease),color var(--t-fast) var(--ease)}
.fe-fe-modes button:hover{color:var(--tx)}
.fe-fe-modes button.on{background:var(--card);color:var(--tx);box-shadow:0 1px 2px rgb(0 0 0 / .18)}
#fe-fe-pill .fe-fe-diag{border-radius:999px;padding:0 10px;font-size:var(--fs-md)}
.fe-fe-diag.error{color:var(--nc-red)}
.fe-fe-diag.warn{color:var(--nc-orange)}
.fe-diag{margin:0 0 14px;border:1px solid var(--bd);border-radius:10px;background:var(--side);font-size:var(--fs-md)}
.fe-diag > summary{cursor:pointer;padding:8px 12px;font-weight:600;list-style:none}
.fe-diag.error > summary{color:var(--nc-red)}
.fe-diag.warn > summary{color:var(--nc-orange)}
.fe-diag-row{display:flex;gap:10px;width:100%;padding:5px 12px;border:0;background:none;color:var(--mt);font:inherit;text-align:left;cursor:pointer;border-top:1px solid color-mix(in srgb,var(--bd) 70%,transparent)}
.fe-diag-row:hover{background:var(--hover);color:var(--tx)}
.fe-diag-ln{flex:none;min-width:3ch;text-align:right;font-family:var(--mono);color:var(--dm)}
.fe-diag-row.error .fe-diag-ln{color:var(--nc-red)}
.fe-diag-row.warn .fe-diag-ln{color:var(--nc-orange)}
.fe-diag-more{display:block;padding:5px 12px 8px;color:var(--dm)}
#fe-page > .fe-diag{margin:16px 48px 0}
/* Search and Ask lenses: a form at the row inset, results as ordinary rows. */
.fe-tl-form{display:flex;flex-direction:column;gap:6px;margin:2px 6px 8px}
.fe-tl-input{width:100%;min-height:30px;padding:6px 10px;border:1px solid var(--bd);border-radius:var(--row-r);background:var(--bg);color:var(--tx);
  font:inherit;font-size:var(--row-fs);outline:none;resize:vertical;transition:border-color var(--t-fast) var(--ease)}
.fe-tl-input:focus{border-color:var(--ac)}
.fe-tl-opts{display:flex;gap:12px;padding:0 4px}
.fe-tl-opt{display:flex;align-items:center;gap:5px;font-size:var(--fs-md);color:var(--mt);cursor:pointer}
.fe-tl-opt input{accent-color:var(--ac)}
.fe-srch-hit{align-items:flex-start;padding-top:6px;padding-bottom:6px}
.fe-srch-hit > svg{margin-top:1px}
.fe-srch-tx{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1}
.fe-srch-snip{font-size:var(--fs-md);color:var(--dm);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fe-srch-snip mark{background:color-mix(in srgb,var(--ac) 28%,transparent);color:var(--tx);border-radius:3px;padding:0 1px}
.fe-ask-status{display:flex;align-items:flex-start;gap:8px;line-height:1.4;margin:0 16px 6px;font-size:var(--fs-md);color:var(--mt)}
.fe-ask-status .dot{width:8px;height:8px;margin-top:4px;border-radius:50%;background:var(--dm);flex:none}
.fe-ask-status.ready .dot{background:var(--green)}
.fe-ask-status.cold .dot{background:var(--gold)}
.fe-ask-status.down .dot,.fe-ask-status.unavailable .dot{background:var(--nc-red)}
.fe-ask-about{margin:0 16px 8px;font-size:var(--fs-md);color:var(--dm);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fe-ask-about b{color:var(--tx);font-weight:500}
.fe-ask-quick{display:flex;flex-wrap:wrap;gap:4px;margin:0 16px 10px}
.fe-ask-chip{cursor:pointer;background:none;font:inherit;font-size:var(--fs-md)}
.fe-ask-chip:hover{background:var(--hover)}
.fe-ask-turn{margin:0 6px 10px;padding:10px;border-radius:10px;background:var(--hover)}
.fe-ask-q{font-weight:600;font-size:var(--row-fs);margin-bottom:6px;color:var(--tx)}
.fe-ask-a.fe-md{padding:0;font-size:var(--fs-md);max-width:none}
/* renderMarkdown wraps its output in its own .fe-md, which must not pad again. */
.fe-ask-a .fe-md{padding:0;font-size:inherit;max-width:none}
.fe-ask-wait{color:var(--dm);font-style:italic}
.fe-ask-meta{margin-top:6px;font-size:var(--fs-sm);color:var(--dm)}
.fe-ask-form{flex-direction:row;align-items:flex-end}
.fe-ask-form .btn{flex:none;height:30px}
.fe-ask-model{display:flex;align-items:center;gap:8px;margin:0 16px 6px;font-size:var(--fs-md);color:var(--mt)}
.fe-ask-model select{flex:1;min-width:0;height:28px;padding:0 6px;border-radius:var(--row-r);border:1px solid var(--bd);background:var(--bg);color:var(--tx);font:inherit;font-size:var(--fs-md)}
.fe-ask-cloud{display:flex;align-items:flex-start;gap:6px;margin:0 16px 8px;padding:6px 8px;border-radius:8px;font-size:var(--fs-sm);line-height:1.4;color:var(--tx);background:color-mix(in srgb,var(--gold) 14%,transparent)}
.fe-ask-cloud[hidden]{display:none}
.fe-ask-cloud svg{width:13px;height:13px;flex:none;margin-top:2px;color:var(--gold)}
.fe-ask-bar{display:flex;gap:4px;margin:0 12px 6px}
.fe-ask-bar .btn{gap:5px}
.fe-ask-bar .btn svg{width:13px;height:13px}
.fe-ask-bar .btn.on{background:var(--hover)}
.fe-ask-n{min-width:16px;height:16px;padding:0 4px;border-radius:999px;font-size:var(--fs-xs);display:inline-grid;place-items:center;background:var(--s2);color:var(--mt)}
.fe-ask-n:empty{display:none}
.fe-ask-hist{margin:0 6px 10px;padding:4px;border:1px solid var(--bd);border-radius:10px;background:var(--card,var(--s1))}
.fe-ask-hist[hidden]{display:none}
.fe-ask-h{display:flex;align-items:center;border-radius:var(--row-r)}
.fe-ask-h:hover,.fe-ask-h.on{background:var(--hover)}
.fe-ask-h-open{flex:1;min-width:0;display:flex;flex-direction:column;align-items:flex-start;gap:1px;padding:6px 8px;border:0;background:none;color:var(--tx);font:inherit;text-align:left;cursor:pointer}
.fe-ask-h-t{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:var(--row-fs)}
.fe-ask-h-m{font-size:var(--fs-sm);color:var(--dm)}
.fe-ask-h-del{flex:none;border:0;background:none;color:var(--dm);cursor:pointer;padding:6px;border-radius:6px;opacity:0}
.fe-ask-h:hover .fe-ask-h-del,.fe-ask-h-del:focus-visible{opacity:1}
.fe-ask-h-del:hover{color:var(--nc-red);background:var(--hover)}
.fe-ask-h-del svg{width:12px;height:12px}
.fe-ask-h-none{margin:6px 8px;font-size:var(--fs-sm);color:var(--dm)}
/* Review fixes: Settings follows the page order (panel a step below, cards
   on top), fields share one look, path chevrons show on hover only, and
   the palette swatch previews the theme in use. */
.fe-dlg-pane{background:var(--side)}
.fe-set-card{background:var(--card)}
.fe-dlg-pane .fe-st-input{background:var(--card);border-color:var(--bd2)}
.fe-dlg-pane .fe-st-select{min-width:150px}
.fe-st-ai-why{margin-top:6px}
.fe-st-ai-why > summary{cursor:pointer;color:var(--ac)}
#fe-bar .fe-crumb-dd{opacity:1;color:var(--dm);padding:3px 1px}
#fe-bar .fe-crumb-dd:hover{color:var(--tx)}
#fe-statusbar{min-width:0;overflow:hidden;white-space:nowrap}
#fe[data-theme="light"] .fe-set-sw:nth-child(1) .fe-set-sw-chip{--b:#eaf0f2;--a:#0e8f8a}
#fe[data-theme="light"] .fe-set-sw:nth-child(2) .fe-set-sw-chip{--b:#f0f0f5;--a:#6d4aff}
#fe[data-theme="light"] .fe-set-sw:nth-child(3) .fe-set-sw-chip{--b:#f2ece4;--a:#c2406b}
#fe[data-theme="light"] .fe-set-sw:nth-child(4) .fe-set-sw-chip{--b:#f0f0f0;--a:#141414}
/* Settings and Help as a desktop settings window: the title and the tabs
   down the left, each tab a coloured tile; each page opens with a header
   (large tile, title, what the page covers) that stays put while the page
   scrolls; sections are small headings over grouped cards. Hierarchy comes
   from weight, colour, case and space, inside the five-step type scale. */
.fe-dlg-box{grid-template-columns:216px minmax(0,1fr);grid-template-rows:auto minmax(0,1fr)}
.fe-dlg-title{grid-column:1;grid-row:1;padding:18px 16px 10px;background:var(--side);border-bottom:0;border-right:1px solid var(--bd);border-radius:14px 0 0 0;align-items:flex-start}
.fe-dlg-tx i{line-height:1.35}
.fe-dlg-close{position:absolute;top:14px;right:14px;z-index:5}
.fe-dlg-tabs{grid-column:1;grid-row:2;padding:4px 8px 12px}
.fe-dlg-pane{grid-column:2;grid-row:1/span 2;border-radius:0 14px 14px 0}
.fe-dlg-pane .fe-md>:first-child{padding-right:36px}
.fe-dlg-tile{flex:none;display:inline-grid;place-items:center;width:22px;height:22px;border-radius:6px;color:#fff;
  background:linear-gradient(165deg,color-mix(in srgb,var(--tone) 88%,#fff),color-mix(in srgb,var(--tone) 80%,#000));
  box-shadow:inset 0 0 0 .5px rgb(255 255 255 / .2),0 1px 2px rgb(0 0 0 / .22)}
.fe-dlg-tab-main .fe-dlg-tile svg{width:13px;height:13px}
.fe-dlg-tile.lg{width:40px;height:40px;border-radius:11px;box-shadow:inset 0 0 0 .5px rgb(255 255 255 / .22),0 4px 12px color-mix(in srgb,var(--tone) 30%,transparent)}
.fe-dlg-tile.lg svg{width:22px;height:22px}
.fe-dlg-tab i{padding-left:calc(22px + var(--row-gap))}
.fe-dlg-pane:has(> .fe-dlg-ph){padding-top:0}
.fe-dlg-ph{position:sticky;top:0;z-index:3;display:flex;align-items:center;gap:14px;margin:0 -24px;padding:22px 60px 18px 24px;
  background:linear-gradient(var(--side) 82%,color-mix(in srgb,var(--side) 0%,transparent))}
.fe-dlg-ph-tx{min-width:0}
.fe-dlg-ph h2{margin:0;font-size:var(--fs-xl);font-weight:650;line-height:1.25;color:var(--tx);letter-spacing:-.01em}
.fe-dlg-ph p{margin:3px 0 0;font-size:var(--fs-md);line-height:1.4;color:var(--dm)}
.fe-set-group{display:flex;flex-direction:column;gap:8px}
.fe-set-group > .fe-set-h{min-height:22px;padding:0 4px 0 6px;font-size:var(--fs-xs);font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:var(--dm)}
.fe-set-group > .fe-set-h .fe-pbn{height:24px;padding:0 9px;font-size:var(--fs-sm);font-weight:500;letter-spacing:0;text-transform:none}
.fe-set-card{padding:0;overflow:hidden}
.fe-set-card > .fe-set:first-child{border-top:0}
.fe-set-card > .fe-set-note:first-child{padding-top:12px}
.fe-set-card #fe-st-reset-rules{margin:10px 16px 12px}
#fe-st-ai-card{background:none;border:0;border-radius:0;padding:14px 16px}
/* Theme and palette pickers: a small window drawn in the colours each one
   picks. Palette windows follow the current mode; mode windows show both. */
.fe-set-sws{gap:6px}
.fe-set-sw{gap:6px;padding:6px}
.fe-set-thumb{position:relative;display:block;width:68px;height:46px;border-radius:8px;overflow:hidden;background:var(--b);
  box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--t) 14%,transparent),0 1px 3px rgb(0 0 0 / .18);
  --t:#fff;--c:color-mix(in srgb,var(--b) 78%,#000);transition:box-shadow var(--t-fast) var(--ease)}
.fe-set-thumb i{position:absolute;display:block}
.fe-set-thumb .sb{left:0;top:0;bottom:0;width:18px;background:var(--c)}
.fe-set-thumb .r1,.fe-set-thumb .r2{left:25px;height:4px;border-radius:2px;background:var(--t);opacity:.42}
.fe-set-thumb .r1{top:11px;width:32px}
.fe-set-thumb .r2{top:20px;width:22px;opacity:.26}
.fe-set-thumb .pill{left:25px;bottom:9px;width:20px;height:7px;border-radius:4px;background:var(--a)}
.fe-set-sw:has(input:checked) .fe-set-thumb{box-shadow:0 0 0 2px var(--ac),0 1px 3px rgb(0 0 0 / .18)}
.fe-set-sw:has(.fe-set-thumb):has(input:checked){background:none}
.fe-set-sw:has(.fe-set-thumb):hover{background:none}
.fe-set-sw:has(.fe-set-thumb):hover .fe-set-thumb{box-shadow:0 0 0 2px color-mix(in srgb,var(--ac) 45%,transparent),0 1px 3px rgb(0 0 0 / .18)}
.fe-set-sw:has(.fe-set-thumb):has(input:checked):hover .fe-set-thumb{box-shadow:0 0 0 2px var(--ac),0 1px 3px rgb(0 0 0 / .18)}
.fe-set-sw:has(input:focus-visible) .fe-set-thumb{outline:2px solid var(--ac);outline-offset:3px}
.fe-set-thumb[data-p="slate"]{--a:#3cc6c0;--b:#1c2328}
.fe-set-thumb[data-p="violet"]{--a:#9d7cff;--b:#1f1f27}
.fe-set-thumb[data-p="sand"]{--a:#e8789a;--b:#24201c}
.fe-set-thumb[data-p="ink"]{--a:#f2f2f3;--b:#1b1b1d}
#fe[data-theme="light"] .fe-set-thumb[data-p]{--t:#000;--c:color-mix(in srgb,var(--b) 90%,#000)}
#fe[data-theme="light"] .fe-set-thumb[data-p="slate"]{--a:#0e8f8a;--b:#eef3f5}
#fe[data-theme="light"] .fe-set-thumb[data-p="violet"]{--a:#6d4aff;--b:#f3f3f8}
#fe[data-theme="light"] .fe-set-thumb[data-p="sand"]{--a:#c2406b;--b:#f5efe7}
#fe[data-theme="light"] .fe-set-thumb[data-p="ink"]{--a:#141414;--b:#f4f4f4}
#fe .fe-set-thumb[data-mode="dark"]{--a:var(--ac);--b:#1c2328;--t:#fff;--c:#131a1e}
#fe .fe-set-thumb[data-mode="light"]{--a:var(--ac);--b:#f4f6f8;--t:#000;--c:#e2e7eb}
/* Very narrow: the sidebar shrinks to its rail and a picked lens floats over
   the page; the path bar keeps its last folder in view. */
@media (max-width:520px){
  #fe #fe-side{width:54px!important;max-width:none;overflow:visible;position:relative;z-index:30;flex-direction:row}
  #fe-rail{flex-direction:column;padding:8px 0;border-bottom:0}
  .fe-rail-btn.on{flex-grow:0}
  .fe-rail-btn em{display:none}
  #fe-side-rz{display:none}
  #fe-lenses{display:none}
  #fe-side.open #fe-lenses{display:block;position:absolute;top:0;bottom:0;left:58px;width:min(260px,calc(100vw - 80px));
    background:var(--side);border:1px solid var(--pop-bd);border-radius:12px;box-shadow:var(--pop-sh);animation:fe-lens-in var(--t-base) var(--ease)}
  #fe-rail{border-right:0}
  #fe-bc{justify-content:flex-end}
}
@container fe-main (max-width:480px){
  #fe-page .fe-md{padding:16px 14px 48px}
  #fe-page .fe-md h1{font-size:1.45em}
  #fe-page > .fe-diag{margin:12px 14px 0}
}
#fe-table tbody tr.fe-spacer td{padding:0;border:0;background:none!important}
.fe-st-rule-del:hover{color:var(--nc-red)}
.fe-st-ai-head.down .dot,.fe-st-ai-head.off .dot{background:var(--nc-red)}
@media (prefers-reduced-motion:reduce){
  #fe *,#fe *::before,#fe *::after,#fe .fe-grp::details-content{animation-duration:1ms!important;animation-iteration-count:1!important;transition-duration:1ms!important}
}

/* Narrow windows keep the reading column usable: the listing drops its
   lesser columns, Contents gives way to the text, and the sidebar is held
   to a share of the width (max-width beats a dragged inline width). */
@container fe-main (max-width:560px){
  .c-tp,.c-tg{display:none}
}
@container fe-main (max-width:400px){
  .c-dt{display:none}
}
/* A narrow window keeps the card out of the text until it is asked for;
   then it floats over the right side (the peek state, set in file-page.ts). */
@media (max-width:760px){
  #fe-toc-rail:not(.peek){display:none}
  #fe-toc-rail.peek{width:min(300px,calc(100% - 24px));right:12px}
}
@media (max-width:640px){
  #fe-side{max-width:42vw}
  #fe-side{width:clamp(180px,30vw,220px)}
  #fe-body{padding:6px}
  #fe-side-rz{width:6px}
  #fe-qlook.side{margin-left:6px}
}
@media (max-width:700px){
  .fe-dlg-box{grid-template-columns:minmax(0,1fr);grid-template-rows:auto auto minmax(0,1fr)}
  .fe-dlg-title{grid-row:1;border-right:0;border-radius:14px 14px 0 0}
  .fe-dlg-pane{grid-column:1;grid-row:3;border-radius:0 0 14px 14px}
  .fe-dlg-tabs{grid-row:2;flex-direction:row;overflow-x:auto;border-right:0;border-bottom:1px solid var(--bd);border-radius:0}
  .fe-dlg-tab{flex:none}
  .fe-dlg-tab i{display:none}
  .fe-set{flex-wrap:wrap}
  .fe-set-c{max-width:100%}
}
`;
