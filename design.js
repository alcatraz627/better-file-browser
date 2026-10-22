"use strict";
(() => {
  // src/styles.ts
  var CSS2 = `
*{box-sizing:border-box;margin:0;padding:0}
/* Palettes (design-system.md, Soft round 2): Slate is the default; Violet,
   Sand and Ink are picked in Settings. Each palette sets only the surface,
   text and accent colours below, so every rule reads the same tokens.
   Selection and hover are washes mixed from the accent, so they follow it. */
:root{
  --bg:#0f1316;--s1:#151b1f;--s2:#1c2328;--s3:#253039;
  --bd:#243038;--bd2:#34434d;--tx:#e7eef1;--mt:#a3b2ba;--dm:#7f9099;
  --ac:#3cc6c0;--tx-on-ac:#0f1316;--dir:#a3b2ba;
  --shade:rgb(139 148 158 / .14);--shade2:rgb(139 148 158 / .24);
  --gold:#d29922;--green:#3fb950;
  --hover:color-mix(in srgb,var(--tx) 6%,transparent);--on:color-mix(in srgb,var(--ac) 18%,transparent);--r-sm:6px;
  --card:color-mix(in srgb,var(--s1),var(--s2) 62%);--side:var(--s1);
  --t-fast:120ms;--t-base:180ms;--t-slow:260ms;--ease:cubic-bezier(.2,.8,.2,1);
  --mono:'SF Mono',Menlo,Consolas,monospace;
  --nc-red:#ff6b6b;--nc-orange:#ffa94d;--nc-yellow:#ffd43b;--nc-green:#51cf66;--nc-teal:#38d9a9;--nc-blue:#4dabf7;--nc-purple:#b197fc;--nc-pink:#f783ac;
}
/* The html:has twin of each rule paints the page behind #fe to match. */
#fe[data-theme="light"],html:has(#fe[data-theme="light"]){
  --bg:#eef3f5;--s1:#ffffff;--s2:#eaf0f2;--s3:#dde6ea;
  --bd:#dbe4e8;--bd2:#c5d2d8;--tx:#17232a;--mt:#4f6370;--dm:#6b7f8a;
  --ac:#0b7a76;--tx-on-ac:#ffffff;--dir:#5d717c;
  --shade:rgb(110 119 129 / .10);--shade2:rgb(110 119 129 / .18);
  --hover:color-mix(in srgb,var(--tx) 5%,transparent);--on:color-mix(in srgb,var(--ac) 14%,transparent);
  --card:var(--s1);--side:color-mix(in srgb,var(--s1),var(--bg) 45%);
  --nc-red:#d92d2d;--nc-orange:#d9730d;--nc-yellow:#b58900;--nc-green:#2b8a3e;--nc-teal:#0c8f78;--nc-blue:#1971c2;--nc-purple:#7048e8;--nc-pink:#c2255c;
}
#fe[data-palette="violet"],html:has(#fe[data-palette="violet"]){
  --bg:#101014;--s1:#17171d;--s2:#1f1f27;--s3:#292933;
  --bd:#2a2a33;--bd2:#3a3a46;--tx:#ececf1;--mt:#a9a9b8;--dm:#85859c;
  --ac:#9d7cff;--tx-on-ac:#101014;--dir:#a9a9b8;
}
#fe[data-palette="violet"][data-theme="light"],html:has(#fe[data-palette="violet"][data-theme="light"]){
  --bg:#f4f4f7;--s1:#ffffff;--s2:#f0f0f5;--s3:#e6e6ee;
  --bd:#e3e3ea;--bd2:#cfcfdb;--tx:#1c1c24;--mt:#5d5d70;--dm:#76768c;
  --ac:#6d4aff;--tx-on-ac:#ffffff;--dir:#6e6e84;
}
#fe[data-palette="sand"],html:has(#fe[data-palette="sand"]){
  --bg:#13110f;--s1:#1b1815;--s2:#24201c;--s3:#2f2a24;
  --bd:#2f2a25;--bd2:#433b33;--tx:#efe9e2;--mt:#b8ab9c;--dm:#958778;
  --ac:#e8789a;--tx-on-ac:#13110f;--dir:#b8ab9c;
}
#fe[data-palette="sand"][data-theme="light"],html:has(#fe[data-palette="sand"][data-theme="light"]){
  --bg:#f6f2ec;--s1:#fffdfa;--s2:#f2ece4;--s3:#e8e0d5;
  --bd:#e6ddd1;--bd2:#d3c6b6;--tx:#2a221b;--mt:#6b5d4f;--dm:#867767;
  --ac:#c2406b;--tx-on-ac:#ffffff;--dir:#7a6a5a;
}
#fe[data-palette="ink"],html:has(#fe[data-palette="ink"]){
  --bg:#0c0c0d;--s1:#141415;--s2:#1b1b1d;--s3:#252527;
  --bd:#242426;--bd2:#353538;--tx:#f2f2f3;--mt:#a8a8ad;--dm:#86868c;
  --ac:#f2f2f3;--tx-on-ac:#0c0c0d;--dir:#a8a8ad;
}
#fe[data-palette="ink"][data-theme="light"],html:has(#fe[data-palette="ink"][data-theme="light"]){
  --bg:#f5f5f5;--s1:#ffffff;--s2:#f0f0f0;--s3:#e5e5e5;
  --bd:#e4e4e4;--bd2:#cfcfcf;--tx:#141414;--mt:#5c5c5c;--dm:#777777;
  --ac:#141414;--tx-on-ac:#ffffff;--dir:#666666;
}
/* Button, the one button part (docs/system/button.md). Class btn.
   data-variant: plain (the default), shade, outline, solid.
   data-size: xs 18, sm 22, md 28 (the default), lg 32.
   data-icon: an icon alone, square at its size and round.
   data-tone: danger (red on hover), accent (accent text at rest).
   On: .on, .active, aria-pressed or aria-expanded="true". Busy:
   aria-busy="true" (a spinner in place of the icon). Done: data-done (green
   text; the caller removes it after a moment). */
.btn{--btn-h:var(--ctl-md);display:inline-flex;align-items:center;justify-content:center;gap:var(--sp-3);height:var(--btn-h);padding:0 var(--sp-4);flex-shrink:0;
  border:1px solid transparent;border-radius:var(--row-r);background:none;color:var(--mt);font:inherit;font-size:var(--type-ui);
  line-height:1;white-space:nowrap;text-decoration:none;cursor:pointer;box-sizing:border-box;
  transition:background var(--t-fast) var(--ease),color var(--t-fast) var(--ease),border-color var(--t-fast) var(--ease)}
.btn[data-size="xs"]{--btn-h:var(--ctl-xs);padding:0 var(--sp-2);font-size:var(--type-micro)}
.btn[data-size="sm"]{--btn-h:var(--ctl-sm);padding:0 var(--sp-3);font-size:var(--type-small)}
.btn[data-size="lg"]{--btn-h:var(--ctl-lg);padding:0 var(--sp-5)}
.btn[data-icon]{width:var(--btn-h);padding:0;border-radius:var(--r-full)}
.btn svg{flex:none;width:var(--btn-ic,14px);height:var(--btn-ic,14px)}
.btn[data-size="xs"]{--btn-ic:10px}
.btn[data-size="sm"]{--btn-ic:12px}
.btn[data-size="lg"]{--btn-ic:16px}
.btn:hover{color:var(--tx);background:var(--hover)}
.btn:active{background:var(--s3)}
.btn[data-variant="shade"],.btn[data-shade]{background:var(--shade)}
.btn[data-variant="shade"]:hover,.btn[data-shade]:hover{background:var(--shade2)}
.btn[data-variant="outline"]{border-color:var(--bd2)}
.btn[data-variant="outline"]:hover{border-color:var(--mt)}
.btn[data-variant="solid"]{background:var(--ac);color:var(--tx-on-ac)}
.btn[data-variant="solid"]:hover{background:var(--ac);color:var(--tx-on-ac);filter:brightness(1.1)}
.btn[data-tone="danger"]:hover{color:var(--tone-danger)}
.btn[data-tone="accent"]{color:var(--ac)}
.btn.on,.btn.active,.btn[aria-pressed="true"],.btn[aria-expanded="true"]{color:var(--ac);background:var(--on)}
.btn:disabled,.btn[aria-disabled="true"]{opacity:.45;cursor:default}
.btn:not([data-variant]):disabled,.btn:not([data-variant])[aria-disabled="true"]{background:none;color:var(--mt)}
.btn:disabled:hover,.btn[aria-disabled="true"]:hover{filter:none}
.btn:focus-visible{outline:2px solid var(--ac);outline-offset:1px}
.btn[aria-busy="true"]{cursor:progress}
.btn[aria-busy="true"] svg{visibility:hidden}
.btn[aria-busy="true"]::after{content:'';position:absolute;width:var(--btn-ic,14px);height:var(--btn-ic,14px);border:2px solid currentColor;border-right-color:transparent;border-radius:var(--r-full);animation:fe-spin var(--t-slow) linear infinite}
.btn[aria-busy="true"]{position:relative}
.btn[data-done]{color:var(--tone-ok)}
/* TextBox, the one text field (docs/system/textbox.md). Class tb, on an
   input or textarea. data-size: sm 22, md 28 (the default), lg 32. A textarea
   grows from one control high. Invalid: aria-invalid="true". */
.tb{--tb-h:var(--ctl-md);display:block;width:100%;height:var(--tb-h);margin:0;padding:0 var(--sp-4);box-sizing:border-box;
  border:1px solid var(--bd2);border-radius:var(--row-r);background:var(--bg);color:var(--tx);font:inherit;font-size:var(--type-ui);outline:0;
  transition:border-color var(--t-fast) var(--ease)}
.tb[data-size="sm"]{--tb-h:var(--ctl-sm);padding:0 var(--sp-3);font-size:var(--type-small)}
.tb[data-size="lg"]{--tb-h:var(--ctl-lg);padding:0 var(--sp-5)}
textarea.tb{height:auto;min-height:var(--tb-h);padding:var(--sp-3) var(--sp-4);line-height:1.45;resize:vertical}
.tb::placeholder{color:var(--dm)}
.tb:hover{border-color:color-mix(in srgb,var(--mt) 60%,var(--bd2))}
.tb:focus{border-color:var(--ac)}
.tb[aria-invalid="true"]{border-color:var(--tone-danger)}
.tb:disabled{opacity:.45;cursor:default}
@keyframes fe-spin{to{transform:rotate(1turn)}}
html,body{height:100%;background:var(--bg);color:var(--tx);
  font:var(--fs-lg)/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;overflow:hidden}
body{opacity:1!important}
#fe{display:flex;flex-direction:column;height:100vh;background:var(--bg);color:var(--tx)}
#fe-bar{display:flex;align-items:center;gap:6px;padding:4px 12px;
  background:var(--s1);border-bottom:1px solid var(--bd);flex-shrink:0;min-height:36px;box-sizing:border-box}
#fe-bc{display:flex;align-items:center;gap:1px;flex:1;overflow:hidden;white-space:nowrap;min-width:0;align-self:stretch;cursor:text}
#fe-bc[hidden]{display:none}
#fe-bc > *{cursor:default}
#fe-bc-edit{flex:1;min-width:0;display:flex}
#fe-bc-edit input{flex:1;min-width:0}

/* A long folder name (a hash, a generated id) shortens so the path around it stays readable. */
.fe-crumb{color:var(--mt);text-decoration:none;padding:2px 5px;border-radius:4px;
  font-size:var(--fs-md);flex-shrink:0;transition:background .1s,color .1s;
  max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer}
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
  background:var(--s1);border:1px solid var(--bd);border-radius:var(--r-sm);
  min-width:220px;max-width:340px;max-height:340px;overflow:hidden;
  box-shadow:0 8px 24px #0009;padding:4px 0;
}
#fe-crumb-menu:not([data-layer]){display:none}
.fe-dd-search-wrap{padding:5px 8px 7px;border-bottom:1px solid var(--bd)}
.fe-dd-search{width:100%}

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
.fe-rail-btn{flex:0 1 auto;min-width:26px;height:var(--ctl-lg);display:flex;align-items:center;justify-content:center;gap:0;padding:0 5px;border:0;border-radius:8px;background:none;color:var(--mt);cursor:pointer;
  font:inherit;position:relative;z-index:1;transition:background var(--t-fast) var(--ease),color var(--t-fast) var(--ease)}
.fe-rail-btn[hidden]{display:none}
.fe-rail-btn svg{width:16px;height:16px;flex:none}
.fe-rail-btn em{font-style:normal;font-size:var(--fs-md);font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:0;opacity:0}
.fe-rail-btn.on{flex:1 0 auto;gap:6px;padding:0 9px}
.fe-rail-btn.on em{max-width:110px;opacity:1}
/* The open lens's highlight. It sits inside its button, so it always fits it;
   a lens switch slides it over from the old button. */
.fe-rail-hl{position:absolute;inset:0;z-index:-1;border-radius:8px;pointer-events:none;transform-origin:0 0}
.fe-rail-btn.on .fe-rail-hl{background:color-mix(in srgb,var(--ac) 16%,transparent)}
.fe-rail-btn.on:hover .fe-rail-hl{background:color-mix(in srgb,var(--ac) 22%,transparent)}
#fe-rail.tight .fe-rail-btn:not(.on){flex:1 1 0;min-width:22px;padding:0 2px}
#fe-rail.tight .fe-rail-btn.on{padding:0 6px;gap:5px}
#fe-rail.tighter .fe-rail-btn{flex:1 1 0;min-width:22px;padding:0 3px}
#fe-rail.tighter .fe-rail-btn.on{gap:0}
#fe-rail.tighter .fe-rail-btn em{display:none}
.fe-rail-btn:hover{background:var(--hover);color:var(--tx)}
.fe-rail-btn.on,.fe-rail-btn.on:hover{background:none;color:var(--tx)}
.fe-rail-btn:focus-visible{outline:2px solid var(--ac);outline-offset:1px}
#fe-lenses{flex:1;min-width:0;overflow-y:auto;padding:6px 0}
.fe-lens[hidden]{display:none}
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
.fe-doc-n{min-width:18px;height:18px;padding:0 5px;box-sizing:border-box;border-radius:999px;display:inline-grid;place-items:center;font-size:var(--fs-xs);background:var(--ac);color:var(--tx-on-ac)}
.fe-doc-n.done{background:var(--s2);color:var(--dm)}
.fe-doc-n svg{width:10px;height:10px}
.fe-row-cm{flex:none;display:inline-flex;align-items:center;gap:3px;padding:0 6px;height:18px;border-radius:999px;vertical-align:middle;
  font-size:var(--fs-xs);color:var(--tx);background:color-mix(in srgb,var(--ac) 16%,transparent)}
.fe-row-cm svg{width:11px;height:11px}
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
.fe-sh-collapse:hover{color:var(--tx)}
.fe-si{display:flex;align-items:center;gap:10px;padding:8px 14px;
  color:var(--mt);text-decoration:none;transition:background .1s,color .1s}
.fe-si:hover{background:var(--hover);color:var(--tx)}
.fe-si.active{background:var(--on);color:var(--ac)}
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
.fe-rm-btn{opacity:0;transition:opacity .1s,color .1s;flex-shrink:0}
.fe-bm-item:hover .fe-rm-btn{opacity:1}

#fe-lens-filter,#fe-docs-q{display:block;width:calc(100% - 20px);margin:2px 10px 6px}

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
.fe-sv-dot:hover{transform:scale(1.25)}
.fe-pl-dots{display:flex;align-items:center;gap:3px;margin-left:auto;padding-right:2px;flex:none}
.fe-sv-mini{width:6px;height:6px;border-radius:50%;display:inline-block}
.fe-sv-more{font-size:var(--fs-xs);color:var(--dm);line-height:6px}
.fe-pl-tags{display:none;font-size:var(--fs-sm);color:var(--mt);min-width:60px;max-width:110px;white-space:nowrap;overflow:hidden}
.fe-pl-tags.show{display:inline-block}
.fe-tag-btn{opacity:0;transition:opacity .1s,color .1s;flex-shrink:0}
.fe-bm-item:hover .fe-tag-btn{opacity:1}

/* clip, not hidden: focusing a control past the edge must not scroll the pane sideways.
   The pane is a size container so its toolbar wraps by the pane's width, which a
   docked preview can make narrow in a wide window. */
#fe-main{flex:1;display:flex;flex-direction:column;overflow:clip;container:fe-main / inline-size;min-width:0}
#fe-toolbar{display:flex;align-items:center;gap:10px;padding:7px 14px;
  background:var(--s2);border-bottom:1px solid var(--bd);flex-shrink:0}
#fe-count{font-size:var(--fs-sm);color:var(--dm);flex:1;white-space:nowrap}
#fe-tb-right{display:flex;align-items:center;gap:4px}
.fe-tb-sep{flex:none;width:1px;height:18px;margin:0 4px;background:var(--bd)}
#fe-sg-cur{font-variant-numeric:tabular-nums}
/* One "on" look across the toolbar: the accent tint the chosen view wears. */
#fe-toolbar #fe-tb-right > button.on{color:var(--ac);background:color-mix(in srgb,var(--ac) 18%,transparent)}
/* Detail: a small slider between a big-square and a dense-rows icon, its stop named beside it. */
#fe-density-wrap{display:flex;align-items:center;gap:6px;color:var(--dm)}
.fe-density-end{display:inline-grid;place-items:center}
#fe-density{display:contents}
#fe-density input{order:1;flex:none;width:72px}
#fe-density-wrap .fe-density-end:last-of-type{order:2}
#fe-density output{order:3;min-width:72px;padding:0;background:none;font-family:inherit;font-size:var(--fs-sm);color:var(--mt);text-align:left}
/* One text box for the toolbar filter and the filter bar: the sidebar filter's
   look, with toggles (.*, Aa) as chips inside its right end. */
.fe-in-box{position:relative;display:inline-flex;align-items:center;flex:none}
.fe-in-box input[type="text"]{width:100%;margin:0}

.fe-tb-box{width:170px;margin-left:4px}
.fe-in-name{width:220px}
.fe-in-name input[type="text"]{padding-right:40px!important}
.fe-in-text{width:300px}
.fe-in-text input[type="text"]{padding-right:68px!important}
.fe-in-chips{position:absolute;right:4px;top:50%;transform:translateY(-50%);display:flex;gap:3px}
.fe-in-chip{position:relative;display:inline-grid;place-items:center;min-width:26px;height:20px;padding:0 5px;box-sizing:border-box;border:1px solid var(--bd);border-radius:6px;
  background:var(--bg);color:var(--dm);font:500 var(--fs-xs) var(--mono);cursor:pointer;
  transition:background var(--t-fast) var(--ease),color var(--t-fast) var(--ease),border-color var(--t-fast) var(--ease)}
.fe-in-chip:hover{color:var(--tx)}
.fe-in-chip input{position:absolute;inset:0;width:100%;height:100%;margin:0;opacity:0;cursor:pointer}
.fe-in-chip.active,.fe-in-chip:has(input:checked){color:var(--ac);border-color:color-mix(in srgb,var(--ac) 45%,transparent);background:color-mix(in srgb,var(--ac) 12%,var(--bg))}
.fe-in-chip:focus-visible,.fe-in-chip:has(input:focus-visible){outline:2px solid var(--ac);outline-offset:1px}
#fe-sg-panel,#fe-filter-bar{display:flex;flex-direction:column;gap:8px;
  padding:9px 14px;background:var(--s1);border-bottom:1px solid var(--bd);flex-shrink:0}
.fe-panel-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.fe-panel-lbl{min-width:52px;font-size:var(--fs-sm);color:var(--dm);font-weight:500;white-space:nowrap}
.fe-panel-sub{display:inline-flex;align-items:center;gap:8px}
.fe-panel-sub .fe-panel-lbl{min-width:0}
.fe-panel-gap{margin-left:14px}
#fe-filter-bar .fe-dd-btn,#fe-sg-panel .fe-dd-btn{min-width:150px}
#fe-find-depth .fe-dd-btn{min-width:100px}
#fe-filter-bar .btn{height:28px}
#fe-filter-bar .btn svg{width:12px;height:12px}
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
/* Named chips give up width (ending in \u2026) before the +N count does. */
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
.fe-tree-row.selected{background:var(--on)}
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
  padding:8px 6px 7px;border-radius:var(--r-sm);text-decoration:none;
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
.fe-tile-meta{display:none}

/* Detail levels (data-density 1 to 5, 3 is the standard look). Low numbers
   show fewer, bigger items with names only; high numbers show smaller items
   and add facts: type, date, tags and comments on tiles, columns on lists. */
#fe[data-density="1"][data-view="details"] tbody td{padding:12px 16px}
#fe[data-density="1"][data-view="details"] .fe-lnk{gap:12px;font-size:var(--fs-lg)}
#fe[data-density="1"][data-view="details"] .fe-lnk svg{transform:scale(1.45)}
#fe[data-density="1"][data-view="details"] :is(.c-tp,.c-tg,.c-sz,.c-dt){display:none}
#fe[data-density="1"][data-view="details"] .c-nm{width:100%}
#fe[data-density="2"][data-view="details"] tbody td{padding:9px 14px}
#fe[data-density="2"][data-view="details"] .fe-lnk svg{transform:scale(1.2)}
#fe[data-density="2"][data-view="details"] :is(.c-tp,.c-tg){display:none}
#fe[data-density="2"][data-view="details"] .c-nm{width:60%}
#fe[data-density="4"][data-view="details"] tbody td{padding:3px 12px}
#fe[data-density="5"][data-view="details"] tbody td{padding:1px 10px;font-size:var(--fs-sm)}
#fe[data-density="5"][data-view="details"] .fe-lnk svg{transform:scale(.85)}

#fe[data-density="1"][data-view="list"] tbody td{padding:11px 16px}
#fe[data-density="1"][data-view="list"] .fe-lnk{gap:12px;font-size:var(--fs-lg)}
#fe[data-density="1"][data-view="list"] .fe-lnk svg{transform:scale(1.45)}
#fe[data-density="2"][data-view="list"] tbody td{padding:8px 14px}
#fe[data-density="2"][data-view="list"] .fe-lnk svg{transform:scale(1.2)}
/* List gains columns as detail goes up: size and date, then type too. */
#fe[data-density="4"][data-view="list"] :is(.c-sz,.c-dt),
#fe[data-density="5"][data-view="list"] :is(.c-sz,.c-dt,.c-tp){display:table-cell}
#fe[data-density="4"][data-view="list"] .c-nm,#fe[data-density="5"][data-view="list"] .c-nm{width:auto}
#fe[data-density="4"][data-view="list"] tbody td{padding:3px 12px}
#fe[data-density="5"][data-view="list"] tbody td{padding:1px 10px;font-size:var(--fs-sm)}

#fe[data-density="1"] .fe-tree-row{min-height:42px;font-size:var(--fs-lg)}
#fe[data-density="1"] .fe-tree-link svg{transform:scale(1.4)}
#fe[data-density="2"] .fe-tree-row{min-height:35px}
#fe[data-density="4"] .fe-tree-row{min-height:24px}
#fe[data-density="5"] .fe-tree-row{min-height:20px;font-size:var(--fs-sm)}

/* Tiles and icons: big name-only tiles at 1 and 2; at 4 a type and date line;
   at 5 a card with the icon beside the name, type, size, date, tags, comments. */
#fe[data-density="1"] #fe-tiles,#fe[data-density="2"] #fe-tiles{gap:10px 12px;padding:14px 16px}
#fe[data-density="1"] .fe-tile-sz,#fe[data-density="2"] .fe-tile-sz{display:none}
#fe[data-density="1"][data-view="tiles"] .fe-tile{width:168px;padding:16px 10px 12px;gap:8px}
#fe[data-density="1"][data-view="tiles"] .fe-tile-ic svg{transform:scale(3.2);margin:22px}
#fe[data-density="1"][data-view="icons"] .fe-tile{width:220px;padding:20px 12px 14px;gap:10px}
#fe[data-density="1"][data-view="icons"] .fe-tile-ic svg{transform:scale(4.4);margin:32px}
#fe[data-density="1"] .fe-tile-nm{font-size:var(--fs-lg)}
#fe[data-density="1"][data-view="tiles"] .fe-tile-ic .fe-tile-img-wrap{width:148px;height:112px}
#fe[data-density="1"][data-view="icons"] .fe-tile-ic .fe-tile-img-wrap{width:196px;height:148px}
#fe[data-density="2"][data-view="tiles"] .fe-tile{width:128px;padding:12px 8px 10px;gap:6px}
#fe[data-density="2"][data-view="tiles"] .fe-tile-ic svg{transform:scale(2.3);margin:14px}
#fe[data-density="2"][data-view="icons"] .fe-tile{width:160px;padding:14px 10px 10px;gap:8px}
#fe[data-density="2"][data-view="icons"] .fe-tile-ic svg{transform:scale(3);margin:20px}
#fe[data-density="2"] .fe-tile-nm{font-size:var(--fs-md)}
#fe[data-density="2"][data-view="tiles"] .fe-tile-ic .fe-tile-img-wrap{width:108px;height:84px}
#fe[data-density="2"][data-view="icons"] .fe-tile-ic .fe-tile-img-wrap{width:140px;height:108px}
#fe[data-density="4"] .fe-tile-meta{display:flex;flex-direction:column;align-items:center;gap:1px;max-width:100%;font-size:var(--fs-xs);color:var(--dm)}
#fe[data-density="4"] .fe-tile-meta > span{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#fe[data-density="4"] .fe-tile-tags{display:none!important}
#fe[data-density="5"][data-view="tiles"] #fe-tiles{gap:4px 6px}
#fe[data-density="5"][data-view="tiles"] .fe-tile{display:grid;grid-template-columns:auto 1fr;grid-template-rows:auto auto 1fr;column-gap:10px;row-gap:1px;
  align-items:start;justify-items:start;width:250px;padding:8px 10px;text-align:left}
#fe[data-density="5"][data-view="tiles"] .fe-tile-ic{grid-row:1 / span 3;align-self:center}
#fe[data-density="5"][data-view="tiles"] .fe-tile-ic svg{transform:scale(1.6);margin:6px}
#fe[data-density="5"][data-view="tiles"] .fe-tile-ic .fe-tile-img-wrap{width:44px;height:36px}
#fe[data-density="5"][data-view="tiles"] .fe-tile-nm{text-align:left;-webkit-line-clamp:1;font-size:var(--fs-md)}
#fe[data-density="5"][data-view="tiles"] .fe-tile-sz{grid-column:2;font-size:var(--fs-xs)}
#fe[data-density="5"][data-view="tiles"] .fe-tile-meta{grid-column:2;display:flex;flex-wrap:wrap;align-items:center;gap:2px 8px;font-size:var(--fs-xs);color:var(--dm)}
#fe[data-density="5"][data-view="tiles"] .fe-tile-tags{display:flex;align-items:center;gap:4px}
#fe[data-density="5"][data-view="tiles"] .fe-tile-tags .fe-chips{max-width:150px}
/* Icons keep their centred shape at 5: a smaller icon over the name and every fact. */
#fe[data-density="5"][data-view="icons"] .fe-tile{width:112px;padding:8px 6px 7px;gap:3px}
#fe[data-density="5"][data-view="icons"] .fe-tile-ic svg{transform:scale(1.5);margin:5px 8px 4px}
#fe[data-density="5"][data-view="icons"] .fe-tile-ic .fe-tile-img-wrap{width:72px;height:56px}
#fe[data-density="5"][data-view="icons"] .fe-tile-nm{font-size:var(--fs-sm)}
#fe[data-density="5"][data-view="icons"] .fe-tile-meta{display:flex;flex-direction:column;align-items:center;gap:1px;max-width:100%;font-size:var(--fs-xs);color:var(--dm)}
#fe[data-density="5"][data-view="icons"] .fe-tile-meta > span{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#fe[data-density="5"][data-view="icons"] .fe-tile-tags{display:flex;justify-content:center;gap:4px}
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
  border-radius:0 0 var(--r-sm) var(--r-sm);
  opacity:0;transition:opacity .14s;pointer-events:none}
.fe-tile:hover .fe-acts{opacity:1;pointer-events:auto}
#fe[data-view="list"] .fe-tile .fe-acts{
  position:absolute;right:6px;top:50%;transform:translateY(-50%);
  background:none;border-radius:0;padding:0;width:auto;left:auto}
/* Row actions float over the name, so they sit on a solid surface; small circles like every icon button. */
.fe-act-btn{display:inline-grid;
  transition:background var(--t-fast) var(--ease),color var(--t-fast) var(--ease)}

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
  background:var(--s2);border:1px solid var(--bd);border-radius:var(--r-sm);
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
  background:var(--s2);color:var(--tx);border:1px solid var(--bd);border-radius:var(--r-sm);
  box-shadow:0 4px 14px #0006;padding:4px 8px;
  font-size:var(--fs-md);line-height:1.4;white-space:pre-line;
  opacity:0;transition:opacity .12s ease-out}
#fe-hint.on{opacity:1}
/* A control's tooltip: icon and title, a lighter line, then its keys. */
#fe-hint.rich{white-space:normal;display:flex;flex-direction:column;gap:var(--sp-1);padding:var(--sp-3) var(--sp-5)}
.fe-hint-h{display:flex;align-items:center;gap:var(--sp-3)}
.fe-hint-h svg{width:1.15em;height:1.15em;flex:none;color:var(--ac)}
.fe-hint-h b{font-weight:600}
.fe-hint-s{color:var(--dm);font-size:var(--fs-xs)}
.fe-hint-k{display:flex;align-items:center;gap:var(--sp-2);margin-top:var(--sp-1)}
.fe-hint-k i{color:var(--dm);font-style:normal;font-size:var(--fs-xs)}
/* Parts in the top layer (layer.ts) keep their own look and placement, not the
   browser's popover defaults; zero specificity, so every part's own rule wins. */
:where([popover]){inset:auto;margin:0;padding:0;border:0;background:none;color:inherit;width:auto;height:auto;overflow:visible}
@media (prefers-reduced-motion:reduce){#fe-hint{transition:none}}
#fe-toast.act.show{pointer-events:auto}
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
  background:var(--on);color:var(--ac);border:1px solid var(--ac)}
.fe-dlg-tx{display:flex;flex-direction:column;gap:3px;min-width:0;flex:1}
.fe-dlg-tx b{font-size:var(--fs-xl);font-weight:600;line-height:1.2;color:var(--tx);letter-spacing:-.01em}
.fe-dlg-tx i{font-size:var(--fs-sm);line-height:1.2;font-style:normal;color:var(--dm)}
.fe-dlg-close{display:inline-grid;transition:color var(--t-fast) var(--ease),background var(--t-fast) var(--ease)}

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
  padding:4px 8px;border-radius:var(--r-sm);font-size:var(--fs-md);outline:none;cursor:pointer}
.fe-st-input{width:100%}

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
  padding:3px 6px;border-radius:var(--r-sm);font-size:var(--fs-sm);
  font-family:'SF Mono',Consolas,monospace;outline:none;transition:border-color .15s;width:100%}
.fe-st-rule-pattern:focus,.fe-st-rule-label:focus{border-color:var(--ac)}
.fe-st-rule-label{text-align:center}
.fe-st-rule-color{border:1px solid var(--bd);background:none;cursor:pointer;
  width:28px;height:24px;padding:1px;border-radius:4px;flex-shrink:0}
.fe-st-rule-del{background:none;border:none;color:var(--dm);cursor:pointer;
  padding:3px 5px;font-size:var(--fs-md);border-radius:3px;line-height:1;transition:color .1s,background .1s;text-align:center}
.fe-st-rule-del:hover{color:#f85149;background:var(--hover)}
.fe-st-rules-empty{font-size:var(--fs-md);color:var(--dm);padding:8px 2px;font-style:italic}
#fe-st-ai-card{background:var(--s2);border:1px solid var(--bd);border-radius:var(--r-sm);padding:11px 13px}
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
.fe-row.selected td{background:var(--on)}
.fe-row.selected .fe-nm{color:var(--ac)}
.fe-tile.selected{background:var(--on);border-color:var(--ac)}
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
/* The strip takes only the room its tabs need, so + and the path button sit
   right after the last tab; past the bar's width the tabs scroll and the
   buttons stay in view. */
#fe-tabs{display:flex;align-items:stretch;gap:4px;padding:6px 4px 0 6px;flex:0 1 auto;min-width:0;overflow-x:auto;scrollbar-width:none}
#fe-tabs-end{display:flex;align-items:center;gap:2px;padding:4px 8px 0 2px;flex:none}
#fe-goto{position:fixed;z-index:60;width:min(460px,calc(100vw - 16px));padding:8px;border-radius:var(--pop-r);
  background:var(--pop-bg);border:1px solid var(--pop-bd);box-shadow:var(--pop-sh);backdrop-filter:var(--pop-blur);-webkit-backdrop-filter:var(--pop-blur)}
#fe-goto input{width:100%}

.fe-goto-msg{margin:6px 2px 0;font-size:var(--fs-sm);color:var(--dm)}
#fe-tabs::-webkit-scrollbar{display:none}
/* The list of every tab: icon, name, and the digit that jumps to it. */
.fe-tab-menu .fe-ctx-item span:not(.fe-ctx-key){flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fe-tab-menu .fe-ctx-item.on{color:var(--ac);font-weight:600}
.fe-tab-menu kbd{font:500 var(--fs-xs) var(--mono);color:var(--dm);padding-left:12px}
.fe-tab.pinned{padding:5px 6px;min-width:0}
.fe-tab.pinned .fe-tab-lbl,.fe-tab.pinned .fe-tab-more{display:none}
#fe-tabs.empty{padding-top:4px}
.fe-tab{display:flex;align-items:center;gap:6px;padding:5px 8px 5px 10px;min-height:29px;font-size:var(--fs-md);color:var(--mt);text-decoration:none;
  background:var(--s2);border:1px solid var(--bd);border-bottom:none;border-radius:7px 7px 0 0;white-space:nowrap;max-width:200px;min-width:112px;flex:0 1 auto;position:relative;top:1px;
  transition:background var(--t-fast) var(--ease),color var(--t-fast) var(--ease)}
.fe-tab:hover{background:var(--s3);color:var(--tx)}
.fe-tab.on{background:var(--bg);color:var(--tx)}
.fe-tab.temp{background:none;border-color:transparent}
.fe-tab.temp.on{background:var(--bg);border-color:var(--bd)}
.fe-tab.temp.on{color:var(--mt)}
.fe-tab.drag-over{border-left:2px solid var(--ac)}
.fe-tab-lbl{display:flex;overflow:hidden;min-width:0}
.fe-tab-head{overflow:hidden;white-space:pre;min-width:0}
.fe-tab-tail{white-space:nowrap;flex-shrink:0}
.fe-tab-x,.fe-tab-more{display:inline-grid;opacity:0;transition:opacity var(--t-fast),background var(--t-fast)}

.fe-tab:hover .fe-tab-x,.fe-tab.on .fe-tab-x,.fe-tab:hover .fe-tab-more{opacity:1}

/* A tab you are not on gives its name the whole width: its menu and close
   buttons float over the end of the name, and only while it is hovered. */
.fe-tab:not(.on) .fe-tab-x,.fe-tab:not(.on) .fe-tab-more{position:absolute;top:50%;margin-top:-9px;background:var(--s3)}
.fe-tab:not(.on) .fe-tab-x{right:6px}
.fe-tab:not(.on) .fe-tab-more{right:26px}
.fe-tab:not(.on):not(:hover):not(:focus-within) .fe-tab-x,.fe-tab:not(.on):not(:hover):not(:focus-within) .fe-tab-more{visibility:hidden}

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
.fe-rt.on{color:var(--tx);background:var(--on)}
.fe-rt[hidden]{display:none}
.fe-rt-n:empty{display:none}
.fe-rt-n{min-width:16px;padding:0 5px;border-radius:999px;background:var(--ac);color:var(--tx-on-ac);font-size:var(--fs-xs);letter-spacing:0;line-height:16px;text-align:center}
#fe-toc-rail[data-tab="cm"]{width:320px}
/* The editor's floating pill moves left of the comments rail instead of covering its tabs. */
#fe-fp:has(#fe-toc-rail[data-tab="cm"]:not([hidden])) #fe-fe-pill{right:352px}
/* The pane buttons right of find: icons only, the comment count as a small badge. */
.fe-fp-panes{display:inline-flex;gap:2px;flex:none}
#fe-fp-bar .fe-fp-panes button[hidden]{display:none}
#fe-fp-cm{position:relative}
#fe-fp-cm-n:empty{display:none}
#fe-fp-cm-n{position:absolute;top:-3px;right:-4px;min-width:14px;padding:0 4px;border-radius:999px;background:var(--ac);color:var(--tx-on-ac);font-size:10px;line-height:14px;text-align:center}
/* Comment threads: a quote, then each comment with who and when, then chips. */
#fe-cm{flex:1;min-height:0;display:flex;flex-direction:column;position:relative}
.fe-cm-top{flex:none;display:flex;align-items:center;gap:4px;padding:0 10px 8px}
.fe-cm-list{flex:1;min-height:0;overflow-y:auto;padding:2px 10px 14px}
#fe-cm[hidden]{display:none}
.fe-cm-filters{flex:1;display:flex;gap:2px;padding:2px;border-radius:10px;background:var(--bg);border:1px solid var(--bd)}
.fe-cm-filters button{flex:1;border:0;background:none;border-radius:8px;padding:3px 4px;font-size:var(--fs-sm);color:var(--mt);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:4px;white-space:nowrap}
.fe-cm-filters button svg{width:11px;height:11px;opacity:.75}
.fe-cm-fn{color:var(--dm)}
.fe-cm-ib{display:inline-grid;flex:none;
  transition:background var(--t-fast) var(--ease),color var(--t-fast) var(--ease)}

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

.fe-cm-c.gone .fe-cm-tx{color:var(--dm)}
.fe-cm-sug{margin-top:6px;font-size:var(--fs-sm);color:var(--mt)}
.fe-cm-diff{display:flex;flex-wrap:wrap;gap:4px;padding:6px 8px;border-radius:var(--row-r);background:var(--shade);line-height:1.5;overflow-wrap:anywhere}
.fe-cm-diff del{background:color-mix(in srgb,var(--nc-red) 14%,transparent);color:var(--mt);padding:0 3px;border-radius:3px}
.fe-cm-sug ins{text-decoration:none;background:color-mix(in srgb,var(--nc-green) 18%,transparent);padding:0 3px;border-radius:3px;color:var(--tx)}
.fe-cm-sug .fe-cm-tools{margin-top:6px}
.fe-cm-sug-state{display:inline-flex;align-items:center;gap:4px;margin-top:4px;font-size:var(--fs-xs);color:var(--dm)}
.fe-cm-sug-state svg{width:12px;height:12px}
.fe-cm-sug.rejected .fe-cm-diff{opacity:.6}
.fe-cm-sug-msg{display:flex;gap:6px;align-items:flex-start;margin:6px 0 0;font-size:var(--fs-sm);color:color-mix(in srgb,var(--nc-orange) 75%,var(--mt));line-height:1.4}
.fe-cm-sug-msg svg{flex:none;width:13px;height:13px;margin-top:2px}
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
.fe-cm-box textarea{display:block;width:100%;max-height:220px;resize:vertical}

.fe-cm-ac{position:absolute;z-index:10;max-width:calc(100% - 20px);box-sizing:border-box;padding:4px;border-radius:10px;
  background:var(--pop-bg);border:1px solid var(--pop-bd);box-shadow:var(--pop-sh);backdrop-filter:var(--pop-blur);-webkit-backdrop-filter:var(--pop-blur)}
.fe-cm-ac[hidden]{display:none}
.fe-cm-ac > div{padding:4px 8px;border-radius:6px;font-size:var(--fs-md);color:var(--tx);cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fe-cm-ac > div span{color:var(--dm);font-size:var(--fs-sm);margin-left:4px}
.fe-cm-ac > div.on,.fe-cm-ac > div:hover{background:var(--on)}
.fe-cm-tools{display:flex;flex-wrap:wrap;align-items:center;gap:2px;margin-top:6px}
.fe-cm-tools .btn svg{width:12px;height:12px}
.fe-cm-grow{flex:1}
.fe-cm-date{height:22px;padding:0 6px;border:1px solid var(--bd2);border-radius:6px;background:var(--bg);color:var(--tx);font:inherit;font-size:var(--fs-sm);color-scheme:light dark}
.fe-cm-x{display:inline-flex;margin:0 -3px 0 1px}

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
#fe-toc a.on{color:var(--tx);background:var(--on)}
.fe-crumb-file{color:var(--tx);font-weight:500}
#fe-fp-meta{font-size:var(--fs-sm);color:var(--dm);margin-right:auto;white-space:nowrap}
/* A text match sits on its own line under the title, inside the link, so the title keeps its width and the whole row opens the note. */
#fe-nt-list .fe-si-link:has(.fe-nt-hit){flex-wrap:wrap;row-gap:1px}
#fe-nt-list .fe-nt-hit{flex:1 0 100%;min-width:0;padding:0 0 2px 24px;font-size:var(--fs-sm);color:var(--dm);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
/* Editing in place: coloured, numbered source in the reading column. The
   painted copy (#fe-fe-paint) and the textarea share font, padding and
   wrapping exactly, so the caret sits over its own text. */
#fe-fe{flex:1;min-width:0;display:flex;flex-direction:column;min-height:0;position:relative}
#fe-fe-banner{display:flex;align-items:center;gap:8px;padding:8px 14px;border-bottom:1px solid var(--bd);background:var(--s1)}
#fe-fe-scroll{flex:1;min-height:0;overflow:auto;cursor:text}
/* The top padding clears the floating pill, so a long first line is never under it. */
#fe-fe-col{max-width:980px;margin:0 auto;padding:62px 28px 120px}
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
.fe-ed-sep{width:1px;align-self:stretch;margin:4px;background:var(--bd)}
.fe-ed-hint{margin-left:auto;font-size:var(--fs-sm);color:var(--dm);white-space:nowrap}
#fe-ed-hist{display:flex;flex-direction:column;gap:2px;padding:6px 10px;border-bottom:1px solid var(--bd);background:var(--s2);max-height:180px;overflow:auto;flex-shrink:0;font-size:var(--fs-sm);color:var(--dm)}
.fe-hist-row{display:grid;grid-template-columns:minmax(120px,160px) 1fr auto;gap:10px;align-items:baseline;text-align:left;background:none;border:1px solid transparent;border-radius:5px;padding:3px 6px;color:var(--tx);cursor:pointer;font:inherit}
.fe-hist-row:hover,.fe-hist-row.active{border-color:var(--ac);background:var(--on)}
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
.fe-cdot{flex:none}
.fe-pmenu{position:fixed;z-index:2147483000;width:250px;background:var(--s1);border:1px solid var(--bd);border-radius:8px;padding:8px;box-shadow:0 8px 24px rgba(0,0,0,.35);display:flex;flex-direction:column;gap:6px}
.fe-pmenu .btn{justify-content:flex-start}
.fe-pm-lbl{font-size:var(--fs-sm);color:var(--mt);text-transform:uppercase;letter-spacing:.04em}
.fe-pm-colors{display:grid;grid-template-columns:1fr 1fr;gap:4px}
.fe-pm-tags{display:flex;flex-wrap:wrap;gap:4px}
.fe-pm-add{display:flex;gap:4px}
.fe-pm-add input{flex:1;min-width:0}

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
.fe-nt-props{display:grid;opacity:0;flex:none}
.fe-nt-item:hover .fe-nt-props,.fe-nt-props:focus-visible{opacity:1}

.fe-nt-item .fe-si-link{padding-left:14px}
.fe-nt-tab{display:grid;opacity:0;flex:none}
.fe-nt-item:hover .fe-nt-tab,.fe-nt-tab:focus-visible{opacity:1}

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
#fe-ql-meta{font-size:var(--fs-sm);color:var(--dm);flex:1;white-space:nowrap;min-width:0;overflow:hidden;text-overflow:ellipsis}
#fe-ql-name{min-width:0;flex-shrink:1}
#fe-ql-body{flex:1;overflow:auto;font-size:var(--fs-md)}
#fe-ql-body:has(> .fe-ql-htmlbar){display:flex;flex-direction:column}
.fe-ql-htmlbar{display:flex;gap:4px;padding:6px 10px;border-bottom:1px solid var(--bd);flex:none}
.fe-ql-html{flex:1;min-height:0;width:100%;border:0;background:#fff}
/* The preview panel reads at the same reader sizes as the file page; dialogs keep the base size. */
#fe-ql-body .fe-md{font-size:var(--fs-xl);line-height:var(--rd-lh,1.65)}
#fe-ql-ai{display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:7px 14px;
  border-bottom:1px solid var(--bd);background:var(--s2);flex-shrink:0}
#fe-ql-ai-chip{display:flex;align-items:center;gap:5px;font-size:var(--fs-sm);color:var(--dm);
  margin-right:4px;white-space:nowrap}
#fe-ql-ai-chip .dot{width:7px;height:7px;border-radius:50%;background:var(--dm);flex-shrink:0}
#fe-ql-ai-chip.ready .dot{background:var(--green)}
#fe-ql-ai-chip.cold .dot{background:var(--gold)}
#fe-ql-ai-chip.down .dot{background:#f85149}
#fe-ql-ai-q{flex:1;min-width:140px}

#fe-ql-ai-q:disabled{opacity:.45}

#fe-ql-ai-out{border-bottom:1px solid var(--bd);max-height:42%;overflow-y:auto;flex-shrink:0;background:var(--s1)}
#fe-ql-ai-out-body{padding:10px 16px 4px;font-size:var(--fs-md);line-height:1.6;white-space:pre-wrap}
#fe-ql-ai-out-body .fe-md{padding:0;white-space:normal}
#fe-ql-ai-out-meta{padding:2px 16px 8px;font-size:var(--fs-xs);color:var(--dm)}
.fe-ql-center{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:10px}
.fe-ql-note{font-size:var(--fs-md);color:var(--dm);padding:6px 14px}
.fe-ql-note.err{color:#f85149}
.fe-ql-imgwrap{display:flex;flex-direction:column;height:100%}
.fe-ql-imgbar{display:flex;align-items:center;gap:4px;padding:6px 10px;border-bottom:1px solid var(--bd);background:var(--s2);flex-shrink:0;flex-wrap:wrap}
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
#fe-ctx,.fe-ctx{position:fixed;z-index:360;background:var(--s1);border:1px solid var(--bd);border-radius:var(--r-sm);
  min-width:180px;box-shadow:0 8px 24px #0009;padding:4px 0}
.fe-ctx:not([data-layer]){display:none}
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
#fe-tabbar,#fe-tabs{background:var(--side)}
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
/* Row height per detail level; it wins over Compact, which only sets level 3. */
#fe[data-density="1"] #fe-table tbody td{height:52px}
#fe[data-density="2"] #fe-table tbody td{height:44px}
#fe[data-density="4"] #fe-table tbody td{height:28px}
#fe[data-density="5"] #fe-table tbody td{height:23px}
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
/* The component system's scales (docs/plan/component-system.md, sections 4
   and 5). Declared on #fe too, so tokens built from palette colours pick up
   the light theme's values rather than the root's. */
:root,#fe{
  --sp-1:2px;--sp-2:4px;--sp-3:6px;--sp-4:8px;--sp-5:12px;--sp-6:16px;--sp-7:20px;--sp-8:24px;--sp-9:32px;
  --ctl-xs:18px;--ctl-sm:22px;--ctl-md:28px;--ctl-lg:32px;--bar-h:40px;
  --r-xs:4px;--r-full:999px;
  --z-sticky:5;--z-panel:30;--z-popover:300;--z-overlay:400;--z-command:500;--z-toast:600;--z-tip:700;--z-step:10;
  --tone-ok:var(--nc-green);--tone-warn:var(--nc-orange);--tone-danger:var(--nc-red);--tone-info:var(--nc-blue);
  --type-micro:var(--fs-sm);--type-small:var(--fs-md);--type-ui:var(--fs-lg);--type-ui-strong:var(--fs-lg);--type-title:var(--fs-xl)}
@media (prefers-reduced-motion:reduce){:root,#fe{--t-fast:0ms;--t-base:0ms;--t-slow:0ms}}
.fe-si,.fe-bm-item,.fe-dd-item,.fe-ctx-item{min-height:var(--row-h);margin:0 6px;padding:0 var(--row-px);gap:var(--row-gap);
  border-radius:var(--row-r);font-size:var(--row-fs);transition:background var(--t-fast) var(--ease),color var(--t-fast) var(--ease)}
.fe-dd-item,.fe-ctx-item{margin:0}
button.fe-si{width:auto;display:flex}
.fe-si:hover,.fe-bm-item:hover,.fe-dd-item:hover,.fe-ctx-item:hover{background:var(--hover)}
.fe-bm-item:has(> .fe-si-link.active){background:var(--on)}
.fe-si > svg,.fe-si-link > svg,.fe-dd-item > svg,.fe-ctx-item > svg{width:var(--row-ic);height:var(--row-ic);flex:none}
.fe-sl{font-size:var(--row-fs)}
.fe-si-link{padding:0;gap:var(--row-gap);min-height:var(--row-h)}
.fe-nt-item .fe-si-link{padding:6px 0}
.fe-pl-item .fe-drag-h{position:absolute;left:-7px;top:0;bottom:0;padding:0;width:8px;justify-content:center}

/* A note row's actions float over the end of the title on a solid fade, so
   nothing moves under the pointer on hover. In a narrow sidebar only delete
   shows; colour and open-in-tab stay in the right-click menu. */
.fe-nt-item .fe-nt-acts{right:4px;border-radius:0 var(--row-r) var(--row-r) 0;padding-left:14px;
  background:linear-gradient(to right,transparent,color-mix(in srgb,var(--side),var(--tx) 6%) 14px)}
.fe-nt-item:has(> .fe-si-link.active) .fe-nt-acts{background:linear-gradient(to right,transparent,color-mix(in srgb,var(--side),var(--ac) 18%) 14px)}
.fe-nt-item:has(.editing) .fe-nt-acts{display:none}

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
.fe-hint{padding:6px 16px}
#fe-lens-filter,#fe-docs-q{width:calc(100% - 12px);margin:2px 6px 8px}
#fe-lens-filter,#fe-search,#fe-srch-q,#fe-find-text,#fe-filter-q,#fe-docs-q,.fe-dd-search{padding-left:28px!important;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='13' height='13' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2' stroke-linecap='round'%3E%3Ccircle cx='11' cy='11' r='7'/%3E%3Cpath d='m20 20-3.5-3.5'/%3E%3C/svg%3E");
  background-repeat:no-repeat;background-position:9px 50%}
.fe-lens-tags{padding:0 6px 8px}
/* Saved and Notes: the lens's own buttons, icon only, left of one search
   box that carries a Names/Deep switch; the tag chips scroll in a row below. */
.fe-lens-tools{display:flex;align-items:center;gap:2px;padding:2px 6px 8px}
.fe-lens-ib{flex:none;display:inline-grid;
  transition:background var(--t-fast) var(--ease),color var(--t-fast) var(--ease)}

a.fe-lens-ib:not([href]){opacity:.45;pointer-events:none}
.fe-lens-box{position:relative;flex:1;min-width:0;margin-left:4px}
.fe-lens-box #fe-lens-filter{width:100%;margin:0;padding-right:64px}
.fe-lens-depth{position:absolute;right:4px;top:50%;transform:translateY(-50%);height:22px;padding:0 7px;border:1px solid var(--bd);border-radius:6px;background:var(--bg);
  color:var(--dm);font:inherit;font-size:var(--fs-xs);cursor:pointer;transition:background var(--t-fast) var(--ease),color var(--t-fast) var(--ease),border-color var(--t-fast) var(--ease)}
.fe-lens-depth:hover{color:var(--tx)}
.fe-lens-depth.on{color:var(--ac);border-color:color-mix(in srgb,var(--ac) 45%,transparent);background:color-mix(in srgb,var(--ac) 12%,var(--bg))}
#fe-lens-tags{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none}
#fe-lens-tags .fe-lens-tag{flex:none;white-space:nowrap}
.fe-lens-tag{display:inline-flex;align-items:center;gap:5px}
.fe-lens-tag i{width:6px;height:6px;border-radius:50%;flex:none}
/* A saved row is one quiet line: the name, then a tag count that gives way to
   the row's icon buttons on hover. Path and tags live in the hover card. */
.fe-pl-meta{display:inline-flex;align-items:center;gap:2px;margin-left:auto;padding-right:2px;flex:none;font-size:var(--fs-xs);color:var(--dm)}
.fe-pl-meta svg{width:11px!important;height:11px!important;opacity:1}
.fe-pl-item:hover .fe-pl-meta,.fe-pl-item:focus-within .fe-pl-meta{display:none}
.fe-pl-item .fe-tag-btn,.fe-pl-item .fe-rm-btn{display:none;opacity:1}
.fe-pl-item:hover .fe-tag-btn,.fe-pl-item:hover .fe-rm-btn,.fe-pl-item:focus-within .fe-tag-btn,.fe-pl-item:focus-within .fe-rm-btn{display:inline-grid}

.fe-pl-item:has(.fe-pl-hit){flex-wrap:wrap}
.fe-pl-hit{flex-basis:100%;padding:0 0 5px 29px;margin-top:-4px;font-size:var(--fs-sm);color:var(--dm);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#fe-sv-card{position:fixed;z-index:60;pointer-events:none;width:230px;padding:8px 10px;display:flex;flex-direction:column;gap:4px;border:1px solid var(--pop-bd);border-radius:10px;
  background:var(--pop-bg);box-shadow:var(--pop-sh);backdrop-filter:var(--pop-blur);-webkit-backdrop-filter:var(--pop-blur);font-size:var(--fs-sm);color:var(--mt);line-height:1.45;animation:fe-rise var(--t-fast) var(--ease)}
#fe-sv-card[hidden]{display:none}
#fe-sv-card b{color:var(--tx);font-size:var(--fs-md);font-weight:600;overflow-wrap:anywhere}
.fe-svc-path{overflow-wrap:anywhere}
.fe-svc-tags{display:flex;flex-wrap:wrap;gap:4px;padding-top:2px}
.fe-svc-hint{color:var(--dm);font-size:var(--fs-xs)}
/* A note row: a colour bar and tinted icon for a coloured note, the title with
   its tags as small chips beneath, and the pin in the end slot until hover. */
.fe-nt-item.coloured::before{content:'';position:absolute;left:0;top:7px;bottom:7px;width:3px;border-radius:2px;background:var(--c)}
.fe-nt-item.coloured .fe-si-link > svg{color:var(--c);opacity:1}
.fe-nt-item.two .fe-si-link{align-items:flex-start}
.fe-nt-item.two .fe-si-link > svg{margin-top:1px}
.fe-nt-main{gap:4px}
.fe-nt-tags{gap:4px;flex-wrap:nowrap;overflow:hidden}
.fe-nt-tag{display:inline-flex;align-items:center;gap:4px;height:17px;padding:0 6px;border:1px solid var(--bd2);border-radius:999px;font-size:var(--fs-xs);color:var(--mt);white-space:nowrap;flex:none}
.fe-nt-tag i{width:6px;height:6px;border-radius:50%;flex:none}
.fe-nt-item .fe-nt-pin{display:inline-flex;margin-left:auto;padding-right:4px;color:var(--gold);flex:none}
.fe-nt-item .fe-nt-pin svg{width:12px!important;height:12px!important;opacity:1}
.fe-nt-item:hover .fe-nt-pin,.fe-nt-item:focus-within .fe-nt-pin{visibility:hidden}

.fe-nt-grp{display:flex;align-items:center;gap:7px;width:calc(100% - 12px);height:26px;margin:8px 6px 2px;padding:0 var(--row-px);border:0;border-radius:var(--row-r);background:none;cursor:pointer;
  font:inherit;font-size:var(--fs-xs);font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--dm);text-align:left}
.fe-nt-grp:first-child{margin-top:0}
.fe-nt-grp:hover{background:var(--hover);color:var(--tx)}
.fe-nt-grp .fe-grp-n{letter-spacing:0}
.fe-nt-grp svg{width:12px;height:12px;flex:none;transition:transform var(--t-fast) var(--ease)}
.fe-nt-grp[aria-expanded="false"] > svg:first-child{transform:rotate(-90deg)}
.fe-nt-grp-pin{display:inline-flex;color:var(--gold)}
.fe-nt-grp-pin svg{width:12px;height:12px}
#fe-crumb-menu,#fe-ctx,.fe-ctx,.fe-pmenu,#fe-tip,#fe-hint,#fe-allow,#fe-toc-rail,#fe-fe-pill,#fe-toast{
  background:var(--pop-bg);border:1px solid var(--pop-bd);box-shadow:var(--pop-sh);
  backdrop-filter:var(--pop-blur);-webkit-backdrop-filter:var(--pop-blur);color:var(--tx)}
#fe-crumb-menu,#fe-ctx,.fe-ctx,.fe-pmenu,#fe-tip,#fe-allow,#fe-toc-rail{border-radius:var(--pop-r)}
#fe-crumb-menu,#fe-ctx,.fe-ctx{padding:var(--pop-pad)}
#fe-hint{border-radius:var(--row-r);padding:5px 10px}
.fe-dd-search-wrap{padding:0 0 6px;margin-bottom:4px}

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
.fe-dlg-tab.on{background:var(--on);color:var(--tx)}
.fe-dlg-tab-main{gap:var(--row-gap)}
.fe-dlg-tab-main svg{width:15px;height:15px}
.fe-dlg-tab b{font-size:var(--row-fs);font-weight:500}
.fe-dlg-tab i{padding-left:25px;line-height:1.3}
.fe-dlg-pane{padding:20px 24px 24px}
.fe-dlg-pane.on{gap:16px}
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

.fe-switch{appearance:none;-webkit-appearance:none;position:relative;flex:none;width:34px;height:20px;margin:0;border-radius:10px;
  background:var(--s3);cursor:pointer;transition:background var(--t-fast) var(--ease)}
.fe-switch::after{content:'';position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#fff;
  box-shadow:0 1px 2px rgb(0 0 0 / .3);transition:transform var(--t-fast) var(--ease),background var(--t-fast) var(--ease)}
.fe-switch:checked{background:var(--ac)}
.fe-switch:checked::after{transform:translateX(14px);background:var(--tx-on-ac)}
.fe-switch:focus-visible{outline:2px solid var(--ac);outline-offset:2px}
.fe-set-sws{display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end}
.fe-set-sw{position:relative;display:flex;flex-direction:column;align-items:center;gap:5px;padding:6px 8px;border-radius:10px;cursor:pointer;
  font-size:var(--fs-md);color:var(--mt);transition:background var(--t-fast) var(--ease),color var(--t-fast) var(--ease)}
.fe-set-sw:hover{background:var(--hover)}
.fe-set-sw:has(input:checked){background:var(--on);color:var(--tx)}
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
.fe-cl.flash{background:var(--on);transition:background 1s var(--ease)}
.fe-fe-modes,.fe-fe-modes .fe-seg-b{border-radius:var(--r-full)}
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
.fe-tl-input{width:100%;resize:vertical}

.fe-tl-opts{display:flex;gap:12px;padding:0 4px}
.fe-srch-hit{align-items:flex-start;padding-top:6px;padding-bottom:6px}
.fe-srch-hit > svg{margin-top:1px}
.fe-srch-tx{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1}
.fe-srch-snip{font-size:var(--fs-md);color:var(--dm);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fe-srch-snip mark{background:color-mix(in srgb,var(--ac) 28%,transparent);color:var(--tx);border-radius:3px;padding:0 1px}
/* Ask: a top row (model chip, new chat, history), the chat, and a composer
   pinned to the bottom of the lens. */
#fe-lens-ask:not([hidden]){display:flex;flex-direction:column;min-height:100%}
#fe-ask{flex:1;display:flex;flex-direction:column}
.fe-ask-top{position:relative;display:flex;align-items:center;gap:2px;margin:0 10px 8px 14px}
.fe-ask-sp{flex:1}
.fe-ask-model{position:relative;display:inline-flex;min-width:0;max-width:100%}
.fe-ask-model > .dot{position:absolute;left:10px;top:50%;margin-top:-3.5px;pointer-events:none}
.fe-ask-model .fe-dd-btn{min-width:0;max-width:190px;padding-left:var(--sp-8)}
.fe-ask-model .dot,.fe-ask-status .dot{width:7px;height:7px;border-radius:50%;flex:none;background:var(--dm)}
.dot.ready{background:var(--green)}
.dot.cold{background:var(--gold)}
.dot.down,.dot.unavailable{background:var(--nc-red)}
.fe-ask-ib{position:relative;display:inline-grid}

.fe-ask-n{position:absolute;top:1px;right:0;min-width:14px;height:14px;padding:0 3px;border-radius:999px;font-size:10px;line-height:14px;text-align:center;background:var(--ac);color:var(--tx-on-ac)}
.fe-ask-n:empty{display:none}
.fe-ask-status{display:flex;align-items:center;gap:8px;margin:0 16px 8px;font-size:var(--fs-sm);line-height:1.4;color:var(--mt)}
.fe-ask-status[hidden]{display:none}
.fe-ask-cloud{display:flex;align-items:center;gap:6px;margin:0 16px 8px;font-size:var(--fs-sm);color:var(--mt)}
.fe-ask-cloud[hidden]{display:none}
.fe-ask-cloud svg{width:12px;height:12px;flex:none;color:var(--gold)}
#fe-ask-thread{display:flex;flex-direction:column;gap:14px;padding:4px 12px 12px 14px}
.fe-ask-turn{display:flex;flex-direction:column;gap:6px}
.fe-ask-q{align-self:flex-end;max-width:88%;padding:6px 10px;border-radius:12px 12px 4px 12px;background:color-mix(in srgb,var(--ac) 16%,transparent);color:var(--tx);font-size:var(--fs-md);line-height:1.45;white-space:pre-wrap;overflow-wrap:anywhere}
.fe-ask-a.fe-md{padding:0;font-size:var(--fs-md);line-height:1.55;max-width:none}
/* renderMarkdown wraps its output in its own .fe-md, which must not pad again. */
.fe-ask-a .fe-md{padding:0;font-size:inherit;max-width:none}
.fe-ask-wait{color:var(--dm)}
.fe-ask-meta{font-size:var(--fs-xs);color:var(--dm)}
.fe-ask-meta:empty{display:none}
.fe-ask-empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:16px;color:var(--dm);font-size:var(--fs-md);text-align:center}
.fe-ask-empty[hidden]{display:none}
.fe-ask-empty p{margin:0}
.fe-ask-quick{display:flex;flex-wrap:wrap;justify-content:center;gap:6px}
.fe-ask-chip{cursor:pointer;background:none;font:inherit;font-size:var(--fs-md)}
.fe-ask-chip:hover{background:var(--hover)}
.fe-ask-form{position:sticky;bottom:0;margin-top:auto;padding:8px 10px 10px;background:linear-gradient(to bottom,transparent,var(--side) 14px)}
.fe-ask-box{display:flex;flex-direction:column;gap:4px;padding:8px 8px 6px 10px;border:1px solid var(--bd2);border-radius:14px;background:var(--bg);transition:border-color var(--t-fast) var(--ease)}
.fe-ask-box:focus-within{border-color:var(--ac)}
#fe-ask-q{width:100%;min-height:22px;max-height:140px;padding:0;border:0;outline:0;resize:none;background:none;color:var(--tx);font:inherit;font-size:var(--fs-md);line-height:1.45}
#fe-ask-q::placeholder{color:var(--dm)}
.fe-ask-foot{display:flex;align-items:center;gap:8px}
.fe-ask-ctx{flex:1;min-width:0;display:inline-flex;align-items:center;gap:4px;font-size:var(--fs-xs);color:var(--dm)}
.fe-ask-ctx span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fe-ask-ctx svg{width:11px;height:11px;flex:none}
.fe-ask-send{flex:none;display:inline-grid}
.fe-ask-send:disabled{opacity:.4}

.fe-ask-send.stop svg{display:none}
.fe-ask-send.stop::before{content:'';width:9px;height:9px;border-radius:2px;background:currentColor}
.fe-ask-hist{position:absolute;right:0;top:32px;z-index:20;width:240px;max-height:320px;overflow-y:auto;padding:4px;border:1px solid var(--pop-bd,var(--bd2));border-radius:10px;background:var(--pop-bg,var(--s2));box-shadow:var(--pop-sh);backdrop-filter:var(--pop-blur);-webkit-backdrop-filter:var(--pop-blur)}
.fe-ask-hist[hidden]{display:none}
.fe-ask-h{display:flex;align-items:center;border-radius:var(--row-r)}
.fe-ask-h:hover,.fe-ask-h.on{background:var(--hover)}
.fe-ask-h-open{flex:1;min-width:0;display:flex;flex-direction:column;align-items:flex-start;gap:1px;padding:6px 8px;border:0;background:none;color:var(--tx);font:inherit;text-align:left;cursor:pointer}
.fe-ask-h-t{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:var(--fs-md)}
.fe-ask-h-m{font-size:var(--fs-xs);color:var(--dm)}
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
  #fe *,#fe *::before,#fe *::after{animation-duration:1ms!important;animation-iteration-count:1!important;transition-duration:1ms!important}
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

  // src/styles-ui.ts
  var UI_CSS = `
/* Palettes beyond the first four: dark tokens, then light. */
#fe[data-palette="ocean"],html:has(#fe[data-palette="ocean"]){
  --bg:#0d1219;--s1:#131a24;--s2:#19222f;--s3:#222d3d;--bd:#222c3a;--bd2:#313e50;--tx:#e6edf5;--mt:#a1b0c2;--dm:#7d8ca0;--ac:#4da3ff;--tx-on-ac:#0d1219;--dir:#a1b0c2}
#fe[data-palette="ocean"][data-theme="light"],html:has(#fe[data-palette="ocean"][data-theme="light"]){
  --bg:#eef3f9;--s1:#ffffff;--s2:#e9eff7;--s3:#dbe5f1;--bd:#d9e2ee;--bd2:#c2cfdf;--tx:#152030;--mt:#4b5d75;--dm:#687a92;--ac:#1f6fd1;--tx-on-ac:#ffffff;--dir:#5b6d85}
#fe[data-palette="forest"],html:has(#fe[data-palette="forest"]){
  --bg:#0e1310;--s1:#141b16;--s2:#1a231d;--s3:#232e26;--bd:#232d26;--bd2:#334136;--tx:#e6efe8;--mt:#a3b3a7;--dm:#7f9184;--ac:#5fc77a;--tx-on-ac:#0e1310;--dir:#a3b3a7}
#fe[data-palette="forest"][data-theme="light"],html:has(#fe[data-palette="forest"][data-theme="light"]){
  --bg:#f0f4ef;--s1:#ffffff;--s2:#eaf0e9;--s3:#dde6dc;--bd:#dbe3d9;--bd2:#c3d0c1;--tx:#18241a;--mt:#4d6151;--dm:#697d6c;--ac:#247338;--tx-on-ac:#ffffff;--dir:#5a6e5d}
#fe[data-palette="ember"],html:has(#fe[data-palette="ember"]){
  --bg:#14100d;--s1:#1c1612;--s2:#251d17;--s3:#30261e;--bd:#30261f;--bd2:#45372b;--tx:#f2e9e1;--mt:#bba99a;--dm:#988676;--ac:#ff8a3d;--tx-on-ac:#14100d;--dir:#bba99a}
#fe[data-palette="ember"][data-theme="light"],html:has(#fe[data-palette="ember"][data-theme="light"]){
  --bg:#f8f2ec;--s1:#fffcf9;--s2:#f4ebe2;--s3:#eadccf;--bd:#e8dccf;--bd2:#d6c3b0;--tx:#2b1f15;--mt:#6c5847;--dm:#88725f;--ac:#a64a0e;--tx-on-ac:#ffffff;--dir:#7a6553}
#fe[data-palette="nord"],html:has(#fe[data-palette="nord"]){
  --bg:#1f232b;--s1:#262b34;--s2:#2c323c;--s3:#353c48;--bd:#353c47;--bd2:#444c59;--tx:#e5e9f0;--mt:#aeb6c4;--dm:#8a93a3;--ac:#88c0d0;--tx-on-ac:#1f232b;--dir:#aeb6c4}
#fe[data-palette="nord"][data-theme="light"],html:has(#fe[data-palette="nord"][data-theme="light"]){
  --bg:#eceff4;--s1:#ffffff;--s2:#e5e9f0;--s3:#d8dee9;--bd:#d8dee9;--bd2:#c2cad6;--tx:#2e3440;--mt:#4c566a;--dm:#67728a;--ac:#4b6c96;--tx-on-ac:#ffffff;--dir:#5c667a}
.fe-set-thumb[data-p="ocean"]{--a:#4da3ff;--b:#19222f}
.fe-set-thumb[data-p="forest"]{--a:#5fc77a;--b:#1a231d}
.fe-set-thumb[data-p="ember"]{--a:#ff8a3d;--b:#251d17}
.fe-set-thumb[data-p="nord"]{--a:#88c0d0;--b:#2c323c}
#fe[data-theme="light"] .fe-set-thumb[data-p="ocean"]{--a:#1f6fd1;--b:#eef3f9}
#fe[data-theme="light"] .fe-set-thumb[data-p="forest"]{--a:#2e8b47;--b:#f0f4ef}
#fe[data-theme="light"] .fe-set-thumb[data-p="ember"]{--a:#c85a12;--b:#f8f2ec}
#fe[data-theme="light"] .fe-set-thumb[data-p="nord"]{--a:#5e81ac;--b:#eceff4}
/* System: half dark, half light. */
#fe .fe-set-thumb[data-mode="system"]{--a:var(--ac);--b:#1c2328;--t:#fff;--c:#131a1e;background:linear-gradient(135deg,#1c2328 50%,#f4f6f8 50%)}
#fe .fe-set-thumb[data-mode="system"] .sb{background:linear-gradient(135deg,#131a1e 50%,#e2e7eb 50%)}

/* Taller dialogs: room for a page of settings or help without scrolling at once. */
.fe-dlg-box{height:min(780px,calc(100vh - 48px))}
#fe-settings-modal .fe-dlg-box,#fe-help-modal .fe-dlg-box{width:min(1000px,calc(100vw - 48px))}

/* Settings rows: a wide row puts its control under the label. */
.fe-set.wide{flex-direction:column;align-items:stretch;gap:10px}
.fe-set.wide .fe-set-c{max-width:none;justify-content:flex-start}
.fe-set.wide .fe-set-tx:has(.fe-set-l:empty){gap:0}
.fe-set-c{max-width:70%;flex-wrap:wrap}
#fe-st-term-hint{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--mono);font-size:var(--fs-sm)}
.fe-set-sws.grid4{display:grid;grid-template-columns:repeat(4,max-content);gap:4px 8px;justify-content:end}
.fe-set-h-acts{display:inline-flex;align-items:center;gap:6px}

/* Icon button: no fill until hovered. */
.fe-ibtn{display:inline-grid;flex:none;
  transition:background var(--t-fast) var(--ease),color var(--t-fast) var(--ease)}




/* Segmented: a row of buttons with one on (docs/system/segmented.md). The
   group is one control high, md 28 (the default) or lg 32 with data-size;
   its items are 4px shorter, rounded squares inside it. An item with only
   an icon is square. */
.fe-seg{--seg-h:var(--ctl-md);display:inline-flex;align-items:stretch;gap:2px;height:var(--seg-h);padding:2px;box-sizing:border-box;border-radius:var(--row-r);
  background:color-mix(in srgb,var(--tx) 6%,transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--bd2) 60%,transparent)}
.fe-seg[data-size="lg"]{--seg-h:var(--ctl-lg)}
.fe-seg-b{display:inline-flex;align-items:center;justify-content:center;gap:var(--sp-3);min-width:calc(var(--seg-h) - 4px);padding:0 var(--sp-4);border:0;border-radius:var(--r-sm);
  background:none;color:var(--mt);font:inherit;font-size:var(--type-ui);font-weight:500;cursor:pointer;white-space:nowrap;box-sizing:border-box;
  transition:background var(--t-fast) var(--ease),color var(--t-fast) var(--ease)}
.fe-seg-b.ico{width:calc(var(--seg-h) - 4px);padding:0}
.fe-seg-b svg{flex:none;width:14px;height:14px}
.fe-seg-b:hover{color:var(--tx);background:var(--hover)}
.fe-seg-b.on,.fe-seg-b.on:hover{color:var(--ac);background:var(--on)}
.fe-seg-b:focus-visible{outline:2px solid var(--ac);outline-offset:1px}

/* A slider that steps through set values, with the value beside it. */
.fe-sld{display:inline-flex;align-items:center;gap:12px;width:240px;--pct:50%}
.fe-sld input{flex:1;min-width:0;height:20px;margin:0;background:none;appearance:none;-webkit-appearance:none;cursor:pointer}
.fe-sld input::-webkit-slider-runnable-track{height:4px;border-radius:2px;
  background:linear-gradient(90deg,var(--ac) var(--pct),color-mix(in srgb,var(--tx) 14%,transparent) var(--pct))}
.fe-sld input::-webkit-slider-thumb{-webkit-appearance:none;width:16px;height:16px;margin-top:-6px;border-radius:50%;background:#fff;
  box-shadow:0 0 0 1px rgb(0 0 0 / .14),0 1px 3px rgb(0 0 0 / .3);transition:transform var(--t-fast) var(--ease)}
.fe-sld input:hover::-webkit-slider-thumb{transform:scale(1.12)}
.fe-sld input:focus-visible::-webkit-slider-thumb{box-shadow:0 0 0 3px color-mix(in srgb,var(--ac) 40%,transparent),0 1px 3px rgb(0 0 0 / .3)}
.fe-sld output{min-width:48px;padding:3px 7px;border-radius:6px;background:color-mix(in srgb,var(--tx) 6%,transparent);font:500 var(--fs-md) var(--mono);color:var(--tx);text-align:center}

/* A dropdown button and its list. */
.fe-dd{--dd-h:var(--ctl-md);display:inline-flex}
.fe-dd[data-size="lg"]{--dd-h:var(--ctl-lg)}
.fe-dd-btn{display:inline-flex;align-items:center;gap:8px;min-width:160px;height:var(--dd-h);padding:0 10px;border:1px solid var(--bd2);border-radius:var(--row-r);background:var(--card);
  color:var(--tx);font:inherit;font-size:var(--row-fs);cursor:pointer;transition:border-color var(--t-fast) var(--ease)}
.fe-dd-btn:hover,.fe-dd-btn[aria-expanded="true"]{border-color:color-mix(in srgb,var(--ac) 60%,var(--bd2))}
.fe-dd-btn:focus-visible{outline:2px solid var(--ac);outline-offset:1px}
.fe-dd-cur{flex:1;display:flex;align-items:center;gap:8px;min-width:0;text-align:left}
.fe-dd-cur span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fe-dd-cur svg{flex:none;width:14px;height:14px;color:var(--mt)}
.fe-dd-btn > svg{flex:none;color:var(--dm)}
.fe-dd-none{color:var(--dm)}
.fe-dd-list{position:fixed;z-index:600;max-height:min(360px,60vh);overflow-y:auto;padding:5px;border-radius:var(--pop-r);
  background:var(--pop-bg);border:1px solid var(--pop-bd);box-shadow:var(--pop-sh);backdrop-filter:var(--pop-blur);-webkit-backdrop-filter:var(--pop-blur);animation:fe-rise var(--t-fast) var(--ease)}
.fe-dd-opt{display:flex;align-items:center;gap:9px;min-height:32px;padding:0 10px;border-radius:7px;color:var(--tx);font-size:var(--row-fs);cursor:pointer;white-space:nowrap}
.fe-dd-opt svg{flex:none;width:14px;height:14px;color:var(--mt)}
.fe-dd-opt.kb{background:var(--hover)}
.fe-dd-opt.on{color:var(--ac)}
.fe-dd-opt.on svg{color:var(--ac)}
.fe-dd-l{flex:1}
.fe-dd-h{color:var(--dm);font-size:var(--fs-sm);padding-left:14px}
.fe-dd-g{padding:var(--sp-4) var(--sp-5) var(--sp-2);color:var(--dm);font-size:var(--fs-sm);font-weight:600}
.fe-dd-g:first-child{padding-top:var(--sp-2)}
/* Check: a box with a tick, and its label. Mixed shows a bar. */
.fe-check{display:inline-flex;align-items:center;gap:var(--sp-3);min-height:var(--ctl-sm);color:var(--mt);font-size:var(--type-small);cursor:pointer;user-select:none}
.fe-check:hover{color:var(--tx)}
.fe-check input{appearance:none;-webkit-appearance:none;display:grid;place-content:center;flex:none;width:14px;height:14px;margin:0;border:1px solid var(--bd2);border-radius:var(--r-xs);background:var(--card);cursor:pointer;
  transition:background var(--t-fast) var(--ease),border-color var(--t-fast) var(--ease)}
.fe-check:hover input{border-color:var(--mt)}
.fe-check input:checked,.fe-check input:indeterminate{background:var(--ac);border-color:var(--ac)}
.fe-check input:checked::after{content:'';width:7px;height:4px;margin-top:-2px;border:solid var(--tx-on-ac);border-width:0 0 2px 2px;transform:rotate(-45deg)}
.fe-check input:indeterminate::after{content:'';width:8px;height:2px;border-radius:1px;background:var(--tx-on-ac)}
.fe-check input:focus-visible{outline:2px solid var(--ac);outline-offset:1px}
.fe-check input:disabled{opacity:.45;cursor:default}

/* A list edited as chips. */
.fe-chipin{display:flex;flex-wrap:wrap;align-items:center;gap:5px;width:300px;max-width:100%;min-height:var(--ctl-lg);padding:var(--sp-1) var(--sp-3);box-sizing:border-box;border:1px solid var(--bd2);border-radius:var(--row-r);background:var(--bg);cursor:text}
.fe-set.wide .fe-chipin{width:100%}
.fe-chipin:focus-within{border-color:var(--ac)}
.fe-chip-x{display:inline-flex;align-items:center;gap:2px;height:24px;padding:0 3px 0 9px;border-radius:12px;background:color-mix(in srgb,var(--ac) 14%,transparent);color:var(--tx);font:500 var(--fs-md) var(--mono)}
.fe-chip-x button{display:inline-grid;place-items:center;width:18px;height:18px;padding:0;border:0;border-radius:50%;background:none;color:var(--mt);cursor:pointer;font-size:13px;line-height:1}
.fe-chip-x button:hover{background:var(--shade2);color:var(--tx)}
.fe-chipin-in{flex:1;min-width:70px;height:24px;border:0;outline:0;background:none;color:var(--tx);font:var(--fs-md) var(--mono)}

/* App icons: a grid of 16 tiles. */
.fe-appicons{display:grid;grid-template-columns:repeat(8,1fr);gap:6px}
.fe-appicon{position:relative;display:flex;flex-direction:column;align-items:center;gap:5px;padding:8px 4px 6px;border-radius:10px;cursor:pointer;color:var(--mt);font-size:var(--fs-sm);
  transition:background var(--t-fast) var(--ease)}
.fe-appicon:hover{background:var(--hover)}
.fe-appicon input{position:absolute;opacity:0;pointer-events:none}
.fe-appicon img{width:40px;height:40px;border-radius:10px;box-shadow:0 1px 3px rgb(0 0 0 / .25);transition:transform var(--t-fast) var(--ease)}
.fe-appicon:hover img{transform:translateY(-1px) scale(1.04)}
.fe-appicon:has(input:checked){background:var(--on);color:var(--tx)}
.fe-appicon:has(input:checked) img{box-shadow:0 0 0 2px var(--ac),0 2px 6px rgb(0 0 0 / .25)}
.fe-appicon:has(input:focus-visible){outline:2px solid var(--ac);outline-offset:1px}

/* Icon rules. */
.fe-rule-sugg{display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:12px 16px 4px}
.fe-rule-sugg:empty{display:none}
.fe-rule-sugg-l{font-size:var(--fs-sm);color:var(--dm);margin-right:2px}
.fe-rule-add{display:inline-flex;align-items:center;gap:5px;height:26px;padding:0 10px 0 6px;margin:0;border:1px dashed var(--bd2);border-radius:13px;background:none;color:var(--mt);font:inherit;font-size:var(--fs-md);cursor:pointer}
.fe-rule-add:hover{border-style:solid;border-color:var(--ac);color:var(--tx)}
.fe-rule-add svg{width:13px;height:15px}
#fe-st-rules-list{padding:6px 10px 10px}
.fe-rule{display:grid;grid-template-columns:auto auto 1fr auto auto;align-items:center;gap:10px;padding:6px;border-radius:9px}
.fe-rule:hover{background:var(--hover)}
.fe-rule.off .fe-rule-ico,.fe-rule.off .fe-st-rule-pattern{opacity:.45}
.fe-switch.sm{width:28px;height:16px;border-radius:8px}
.fe-switch.sm::after{width:12px;height:12px}
.fe-switch.sm:checked::after{transform:translateX(12px)}
.fe-rule-ico{display:grid;place-items:center;width:34px;height:34px;padding:0;border:1px solid var(--bd2);border-radius:9px;background:var(--card);cursor:pointer}
.fe-rule-ico:hover{border-color:var(--ac)}
.fe-rule-ico svg{width:18px;height:20px}
.fe-st-rule-pattern{width:100%;height:32px;padding:0 10px;border:1px solid var(--bd2);border-radius:var(--row-r);background:var(--card);color:var(--tx);font:var(--fs-md) var(--mono);outline:0}
.fe-st-rule-pattern:focus{border-color:var(--ac)}
.fe-st-rule-pattern.bad{border-color:var(--nc-red);color:var(--nc-red)}
.fe-rule-n{min-width:26px;padding:2px 6px;border-radius:10px;background:color-mix(in srgb,var(--tx) 7%,transparent);color:var(--mt);font:500 var(--fs-sm) var(--mono);text-align:center}
.fe-st-rule-del:hover{color:var(--nc-red)}
.fe-rule-pop{position:fixed;z-index:610;width:330px;padding:12px;border-radius:var(--pop-r);display:flex;flex-direction:column;gap:12px;
  background:var(--pop-bg);border:1px solid var(--pop-bd);box-shadow:var(--pop-sh);backdrop-filter:var(--pop-blur);-webkit-backdrop-filter:var(--pop-blur);animation:fe-rise var(--t-fast) var(--ease)}
.fe-rp-sec{display:flex;flex-direction:column;gap:6px}
.fe-rp-l{font-size:var(--fs-xs);font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--dm)}
.fe-rp-glyphs{display:grid;grid-template-columns:repeat(9,1fr);gap:3px}
.fe-rp-g{display:grid;place-items:center;height:34px;padding:0;border:0;border-radius:7px;background:none;cursor:pointer}
.fe-rp-g svg{width:20px;height:22px}
.fe-rp-g:hover{background:var(--hover)}
.fe-rp-g.on{background:var(--on);box-shadow:inset 0 0 0 1.5px var(--ac)}
.fe-rp-label{width:90px;height:30px;padding:0 10px;font:600 var(--fs-md) var(--mono);border-radius:var(--row-r)}
.fe-rp-sw{display:grid;grid-template-columns:repeat(8,1fr);gap:6px;align-items:center}
.fe-rp-c{width:26px;height:26px;padding:0;border:0;border-radius:50%;background:var(--c);cursor:pointer;box-shadow:inset 0 0 0 1px rgb(0 0 0 / .15);transition:transform var(--t-fast) var(--ease)}
.fe-rp-c:hover{transform:scale(1.1)}
.fe-rp-c.on{box-shadow:0 0 0 2px var(--card),0 0 0 4px var(--c)}
.fe-rp-c:focus-visible,.fe-rp-g:focus-visible{outline:2px solid var(--ac);outline-offset:1px}
.fe-rp-hex{grid-column:span 4;height:28px;padding:0 8px;font:var(--fs-md) var(--mono);border-radius:var(--row-r)}

/* AI: a status line on top, then the model controls and the list. */
.fe-ai-hero{display:flex;align-items:center;gap:14px;padding:16px 18px;border-radius:14px;background:linear-gradient(135deg,color-mix(in srgb,var(--nc-purple) 18%,var(--card)),var(--card));
  border:1px solid color-mix(in srgb,var(--nc-purple) 30%,var(--bd))}
.fe-ai-hero .fe-st-ai-head{margin:0}
.fe-ai-hero .fe-st-ai-blink,.fe-ai-hero .fe-st-ai-blink .dot{width:12px;height:12px}
.fe-ai-hero-tx{flex:1;display:flex;flex-direction:column;gap:3px;min-width:0}
.fe-ai-hero-tx b{font-size:var(--fs-xl);font-weight:650;color:var(--tx)}
.fe-ai-hero-tx span{font-size:var(--fs-md);color:var(--mt);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#fe-st-ai-grid{display:grid;grid-template-columns:auto 1fr;gap:4px 14px;padding:10px 16px 12px;border-top:1px solid color-mix(in srgb,var(--bd) 70%,transparent)}
#fe-st-ai-grid:empty{display:none}
.fe-st-ai-hint code{font-family:var(--mono)}
.fe-dm{color:var(--dm)}
.fe-ai-models{display:flex;flex-direction:column;padding:6px}
.fe-ai-m{display:flex;align-items:center;gap:10px;min-height:38px;padding:0 10px;border-radius:9px}
.fe-ai-m:hover{background:var(--hover)}
.fe-ai-m svg{flex:none;width:15px;height:15px;color:var(--mt)}
.fe-ai-m b{font-size:var(--row-fs);font-weight:550;color:var(--tx)}
.fe-ai-m-id{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:var(--fs-sm) var(--mono);color:var(--dm)}
.fe-ai-where{padding:2px 8px;border-radius:10px;font-size:var(--fs-sm);background:color-mix(in srgb,var(--nc-green) 16%,transparent);color:var(--nc-green)}
.fe-ai-where.cloud{background:color-mix(in srgb,var(--nc-blue) 16%,transparent);color:var(--nc-blue)}
.fe-ai-def{padding:2px 8px;border-radius:10px;font-size:var(--fs-sm);background:var(--on);color:var(--ac)}

/* The command palette. */
.fe-pal-wrap{position:fixed;inset:0;z-index:700;display:flex;justify-content:center;align-items:flex-start;padding-top:12vh;background:rgb(0 0 0 / .32);animation:fe-fade var(--t-fast) var(--ease)}
.fe-pal{width:min(640px,calc(100vw - 32px));max-height:min(560px,72vh);display:flex;flex-direction:column;border-radius:16px;overflow:hidden;
  background:var(--card);border:1px solid var(--pop-bd);box-shadow:0 24px 64px rgb(0 0 0 / .45),0 2px 8px rgb(0 0 0 / .25);animation:fe-rise var(--t-base) var(--ease)}
.fe-pal-q{display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid var(--bd);color:var(--dm)}
.fe-pal-q input{flex:1;border:0;outline:0;background:none;color:var(--tx);font:inherit;font-size:var(--fs-xl)}
.fe-pal-list{flex:1;overflow-y:auto;padding:6px}
/* Palette tabs: one per kind of entry, each with its own colour, which the
   entries of that kind share. */
.fe-pal-tabs{flex:none;display:flex;gap:var(--sp-1);padding:var(--sp-2) var(--sp-3);border-bottom:1px solid var(--bd);overflow-x:auto;scrollbar-width:none}
.fe-pal-tab{display:inline-flex;align-items:center;gap:var(--sp-2);flex:none;height:var(--ctl-md);padding:0 var(--sp-3);border:0;border-radius:var(--r-full);background:none;color:var(--mt);font:inherit;font-size:var(--fs-sm);cursor:pointer;transition:background var(--t-fast),color var(--t-fast)}
.fe-pal-tab svg{width:1.1em;height:1.1em;color:var(--tab-c,var(--mt))}
.fe-pal-tab i{font-style:normal;color:var(--dm);font-size:var(--fs-xs)}
.fe-pal-tab:hover{background:var(--hover);color:var(--tx)}
.fe-pal-tab.on{background:color-mix(in srgb,var(--tab-c,var(--ac)) 16%,transparent);color:var(--tx)}
.fe-pal-tab.empty{opacity:.45}
.fe-pal-tab[data-tab="actions"],.fe-pal-i[data-tab="actions"]{--tab-c:var(--ac)}
.fe-pal-tab[data-tab="tabs"],.fe-pal-i[data-tab="tabs"]{--tab-c:var(--nc-blue)}
.fe-pal-tab[data-tab="saved"],.fe-pal-i[data-tab="saved"]{--tab-c:var(--nc-yellow)}
.fe-pal-tab[data-tab="recent"],.fe-pal-i[data-tab="recent"]{--tab-c:var(--nc-purple)}
.fe-pal-tab[data-tab="notes"],.fe-pal-i[data-tab="notes"]{--tab-c:var(--nc-green)}
.fe-pal-tab[data-tab="here"],.fe-pal-i[data-tab="here"]{--tab-c:var(--dir)}
.fe-pal-tab[data-tab="comments"],.fe-pal-i[data-tab="comments"]{--tab-c:var(--nc-orange)}
.fe-pal-tab[data-tab="chats"],.fe-pal-i[data-tab="chats"]{--tab-c:var(--nc-pink)}
.fe-pal-g{padding:10px 10px 4px;font-size:var(--fs-xs);font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:var(--dm)}
.fe-pal-i{display:flex;align-items:center;gap:10px;min-height:36px;padding:0 10px;border-radius:9px;color:var(--tx);font-size:var(--row-fs);cursor:pointer}
.fe-pal-i svg{flex:none;width:16px;height:16px;color:var(--tab-c,var(--mt))}
.fe-pal-i.on{background:var(--on)}
.fe-pal-t{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fe-pal-s{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--dm);font-size:var(--fs-sm)}
.fe-pal-i kbd,.fe-pal kbd,.fe-chord kbd,.fe-hints kbd,#fe-hint kbd{display:inline-flex;align-items:center;justify-content:center;min-width:20px;height:20px;padding:0 6px;border-radius:5px;
  background:color-mix(in srgb,var(--tx) 8%,transparent);box-shadow:inset 0 -1px 0 color-mix(in srgb,var(--tx) 14%,transparent);color:var(--mt);font:600 var(--fs-xs) var(--mono);white-space:nowrap}
.fe-pal-i kbd{margin-left:auto}
.fe-pal-none{padding:24px;text-align:center;color:var(--dm)}
.fe-pal-foot{display:flex;gap:16px;padding:8px 14px;border-top:1px solid var(--bd);font-size:var(--fs-sm);color:var(--dm)}
.fe-pal-foot span{display:inline-flex;align-items:center;gap:4px}

/* A key sequence waiting for its second key. */
.fe-chord{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:700;display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:8px;max-width:min(720px,90vw);
  padding:8px 12px;border-radius:12px;background:var(--pop-bg);border:1px solid var(--pop-bd);box-shadow:var(--pop-sh);backdrop-filter:var(--pop-blur);-webkit-backdrop-filter:var(--pop-blur);
  font-size:var(--fs-md);color:var(--mt);animation:fe-rise var(--t-fast) var(--ease)}
.fe-chord > kbd{background:var(--ac);color:var(--tx-on-ac);box-shadow:none}
.fe-chord-o{display:inline-flex;align-items:center;gap:5px;color:var(--tx)}

/* Key badges while \u2325 is held. */
.fe-hints{position:fixed;inset:0;z-index:690;pointer-events:none}
.fe-hints > kbd{position:fixed;transform:translate(-50%,0);background:var(--ac);color:var(--tx-on-ac);box-shadow:0 2px 6px rgb(0 0 0 / .35);animation:fe-rise var(--t-fast) var(--ease)}
.fe-hints-tip{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);display:flex;align-items:center;gap:6px;padding:8px 14px;border-radius:12px;
  background:var(--pop-bg);border:1px solid var(--pop-bd);box-shadow:var(--pop-sh);font-size:var(--fs-md);color:var(--mt)}

/* Where the keyboard is. */
.fe-area-flash{animation:fe-area .7s var(--ease)}
@keyframes fe-area{0%{box-shadow:inset 0 0 0 2px var(--ac)}100%{box-shadow:inset 0 0 0 2px transparent}}
#fe-side .fe-si:focus-visible,#fe-side .fe-si-link:focus-visible,#fe-side summary:focus-visible,#fe-side .fe-nt-grp:focus-visible,
#fe-tabs .fe-tab:focus-visible,#fe-bc a:focus-visible,#fe-bc button:focus-visible{outline:2px solid var(--ac);outline-offset:-2px;border-radius:var(--row-r)}
#fe-ctx .fe-ctx-item.kb,.fe-ctx .fe-ctx-item.kb,#fe-crumb-menu .fe-dd-item.kb,.fe-pmenu button.kb{background:var(--on);color:var(--tx)}

/* Help: the keyboard map. Keys with a use are tinted; hovering an action
   lights its keys, hovering a key lights its actions. */
.fe-km{display:flex;flex-direction:column;gap:14px}
.fe-km-board{display:flex;flex-direction:column;gap:5px;padding:14px;border-radius:14px;background:color-mix(in srgb,var(--tx) 4%,var(--card));
  border:1px solid var(--bd);position:sticky;top:-2px;z-index:2;box-shadow:0 8px 16px -12px rgb(0 0 0 / .4)}
.fe-km-row-k{display:flex;gap:5px}
.fe-km-cap{flex:var(--w,1) 1 0;min-width:0;height:34px;display:grid;place-items:center;border-radius:7px;font:500 var(--fs-sm) var(--mono);color:var(--dm);
  background:color-mix(in srgb,var(--tx) 5%,transparent);box-shadow:inset 0 -2px 0 color-mix(in srgb,#000 22%,transparent);transition:background .12s,color .12s,transform .12s}
.fe-km-cap.fn{height:22px;font-size:var(--fs-xs)}
.fe-km-cap.used{color:var(--tx);background:color-mix(in srgb,var(--ac) 12%,transparent);cursor:pointer}
.fe-km-cap.hl{background:var(--ac);color:var(--tx-on-ac);transform:translateY(1px);box-shadow:inset 0 -1px 0 rgb(0 0 0 / .25),0 0 0 3px color-mix(in srgb,var(--ac) 30%,transparent)}
.fe-km-cap.pin{outline:2px solid var(--ac);outline-offset:2px}
.fe-km-ud{flex:1 1 0;display:flex;flex-direction:column;gap:2px}
.fe-km-cap.half{height:16px;font-size:9px}
.fe-km-bar{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.fe-km-q{flex:1;min-width:200px;width:auto}
.fe-km-legend{font-size:var(--fs-sm);color:var(--dm);display:inline-flex;align-items:center;gap:4px}
.fe-km-list{columns:2 320px;column-gap:18px}
.fe-km-g{break-inside:avoid;margin-bottom:16px;padding:4px;border-radius:12px;background:var(--card);border:1px solid var(--bd)}
.fe-km-g h3{display:flex;align-items:center;gap:7px;margin:0;padding:8px 10px 6px;font-size:var(--fs-xs);font-weight:650;letter-spacing:.07em;text-transform:uppercase;color:var(--dm)}
.fe-km-g h3 svg{width:14px;height:14px}
.fe-km-i{display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:32px;padding:0 10px;border-radius:8px;font-size:var(--row-fs);color:var(--tx)}
.fe-km-i.on{background:var(--on)}
.fe-km-k{display:inline-flex;align-items:center;gap:3px;flex:none}
.fe-km-k kbd,.fe-hc-how kbd,.fe-km-legend kbd{display:inline-flex;align-items:center;justify-content:center;min-width:22px;height:22px;padding:0 6px;border-radius:6px;
  background:color-mix(in srgb,var(--tx) 8%,transparent);box-shadow:inset 0 -1.5px 0 color-mix(in srgb,var(--tx) 16%,transparent);color:var(--tx);font:600 var(--fs-xs) var(--mono)}
.fe-km-then,.fe-km-or{font-style:normal;font-size:var(--fs-xs);color:var(--dm);padding:0 2px}

/* Help: cards. */
.fe-hs{display:flex;flex-direction:column;gap:10px}
.fe-hs h3{margin:0;padding:0 2px;font-size:var(--fs-xs);font-weight:650;letter-spacing:.07em;text-transform:uppercase;color:var(--dm)}
.fe-hcs{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:8px}
.fe-hc{display:flex;align-items:center;gap:12px;min-height:62px;padding:10px 14px;border-radius:12px;background:var(--card);border:1px solid var(--bd);
  transition:transform var(--t-fast) var(--ease),border-color var(--t-fast) var(--ease),box-shadow var(--t-fast) var(--ease)}
.fe-hc:hover{transform:translateY(-1px);border-color:color-mix(in srgb,var(--tone) 45%,var(--bd));box-shadow:0 6px 16px -10px color-mix(in srgb,var(--tone) 55%,transparent)}
.fe-hc-ico{flex:none;display:grid;place-items:center;width:36px;height:36px;border-radius:10px;color:var(--tone);background:color-mix(in srgb,var(--tone) 16%,transparent)}
.fe-hc-ico svg{width:18px;height:18px}
.fe-hc-tx{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.fe-hc-tx b{font-size:var(--fs-lg);font-weight:650;color:var(--tx)}
.fe-hc-tx span{font-size:var(--fs-md);color:var(--mt);line-height:1.35}
.fe-hc-how{flex:none;display:flex;align-items:center;gap:3px}
.fe-hc-tag{padding:2px 8px;border-radius:10px;font-size:var(--fs-sm);color:var(--tone);background:color-mix(in srgb,var(--tone) 14%,transparent)}
#fe-help-modal .fe-dlg-pane.on{gap:22px}
`;

  // src/utils.ts
  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // src/control-icons.ts
  var line = (body, size = 14) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
  var svg = (body) => line(body);
  var SPARKLE = '<path d="M9.94 15.5A2 2 0 0 0 8.5 14.06l-6.14-1.58a.5.5 0 0 1 0-.96L8.5 9.94A2 2 0 0 0 9.94 8.5l1.58-6.14a.5.5 0 0 1 .96 0l1.58 6.14a2 2 0 0 0 1.44 1.44l6.14 1.58a.5.5 0 0 1 0 .96l-6.14 1.58a2 2 0 0 0-1.44 1.44l-1.58 6.14a.5.5 0 0 1-.96 0z"/><path d="M20 3v4M22 5h-4"/>';
  var COPY = '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>';
  var HISTORY = '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>';
  var FILE_TEXT = '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/><path d="M14 2v4a2 2 0 0 0 2 2h4M16 13H8M16 17H8M10 9H8"/>';
  var UI_ICON = {
    appearance: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>'),
    preview: svg('<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M15 3v18"/>'),
    files: svg(FILE_TEXT),
    exclusions: svg('<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="M9 12h6"/>'),
    notes: svg('<path d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8z"/><path d="M15 3v4a2 2 0 0 0 2 2h4"/>'),
    tab: svg('<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18M12 13v5M9.5 15.5h5"/>'),
    terminal: svg('<path d="m7 11 2-2-2-2M11 13h4"/><rect width="18" height="18" x="3" y="3" rx="2"/>'),
    data: svg('<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5M3 12a9 3 0 0 0 18 0"/>'),
    ai: svg(SPARKLE),
    keyboard: svg('<rect width="20" height="16" x="2" y="4" rx="2"/><path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M7 16h10"/>'),
    reset: svg(HISTORY),
    add: svg('<path d="M5 12h14M12 5v14"/>'),
    export: svg('<path d="M12 15V3M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/>'),
    import: svg('<path d="M12 3v12M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/>'),
    warm: svg('<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>'),
    unload: svg('<path d="M2 12h20M12 2v20m-8.5-15L20.5 17M20.5 7 3.5 17M9 4l3 2 3-2M9 20l3-2 3 2"/>'),
    close: svg('<path d="M18 6 6 18M6 6l12 12"/>'),
    // Text formatting in the note editor.
    fmtBold: svg('<path d="M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8"/>'),
    fmtItalic: svg('<path d="M19 4h-9M14 20H5M15 4 9 20"/>'),
    fmtCode: svg('<path d="m16 18 6-6-6-6M8 6l-6 6 6 6"/>'),
    fmtStrike: svg('<path d="M16 4H9a3 3 0 0 0-2.83 4M14 12a4 4 0 0 1 0 8H6M4 12h16"/>'),
    fmtHeading: svg('<path d="M6 12h12M6 20V4M18 20V4"/>'),
    fmtQuote: svg('<path d="M17 6H3M21 12H8M21 18H8M3 12v6"/>'),
    fmtOlist: svg('<path d="M10 12h11M10 18h11M10 6h11M4 10h2M4 6h1v4M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/>'),
    list: svg('<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>'),
    task: svg('<path d="m3 17 2 2 4-4M3 7l2 2 4-4M13 6h8M13 12h8M13 18h8"/>'),
    table: svg('<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18M3 15h18M12 3v18"/>'),
    image: svg('<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21"/>'),
    versions: svg(HISTORY + '<path d="M12 7v5l4 2"/>'),
    external: svg('<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>'),
    pin: svg('<path d="M12 17v5M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>'),
    tag: svg('<path d="M12.59 2.59A2 2 0 0 0 11.17 2H4a2 2 0 0 0-2 2v7.17a2 2 0 0 0 .59 1.42l8.7 8.7a2.43 2.43 0 0 0 3.42 0l6.58-6.58a2.43 2.43 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r="1" fill="currentColor"/>'),
    palette: svg('<path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.93 0 1.65-.75 1.65-1.69 0-.44-.18-.84-.44-1.13-.29-.29-.44-.65-.44-1.13a1.64 1.64 0 0 1 1.67-1.67h2c3.05 0 5.55-2.5 5.55-5.55C21.97 6.01 17.46 2 12 2z"/><circle cx="13.5" cy="6.5" r="1" fill="currentColor"/><circle cx="17.5" cy="10.5" r="1" fill="currentColor"/><circle cx="8.5" cy="7.5" r="1" fill="currentColor"/><circle cx="6.5" cy="12.5" r="1" fill="currentColor"/>'),
    zoomIn: svg('<circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35M11 8v6M8 11h6"/>'),
    zoomOut: svg('<circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35M8 11h6"/>'),
    actualSize: svg('<rect width="18" height="18" x="3" y="3" rx="2"/><path d="m7.5 9 1.5-1v8M15 9l1.5-1v8M12 10.5v.01M12 14.5v.01"/>'),
    rotate: svg('<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>'),
    flip: svg('<path d="m3 7 5 5-5 5zM21 7l-5 5 5 5zM12 2v2M12 8v2M12 14v2M12 20v2"/>'),
    fit: svg('<path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/>'),
    rename: svg('<path d="M21.17 6.81a1 1 0 0 0-3.99-3.99L3.84 16.17a2 2 0 0 0-.5.83l-1.32 4.35a.5.5 0 0 0 .62.62l4.35-1.32a2 2 0 0 0 .83-.5z"/><path d="m15 5 4 4"/>'),
    trash: svg('<path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6M14 11v6"/>'),
    prev: svg('<path d="m15 18-6-6 6-6"/>'),
    next: svg('<path d="m9 18 6-6-6-6"/>'),
    folderOpen: svg('<path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2"/>'),
    copy: svg(COPY),
    check: svg('<path d="M20 6 9 17l-5-5"/>'),
    eye: svg('<path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0"/><circle cx="12" cy="12" r="3"/>'),
    lock: svg('<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'),
    clock: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
    send: svg('<path d="M12 19V5M5 12l7-7 7 7"/>'),
    file: svg('<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/>'),
    comment: svg('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'),
    contents: svg('<path d="M15 12H3M17 18H3M21 6H3"/>'),
    info: svg('<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>'),
    circle: svg('<circle cx="12" cy="12" r="9"/>'),
    at: svg('<circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8"/>'),
    stack: svg('<path d="m12.83 2.18 8.58 3.9a1 1 0 0 1 0 1.83l-8.58 3.9a2 2 0 0 1-1.66 0L2.6 7.91a1 1 0 0 1 0-1.83l8.58-3.9a2 2 0 0 1 1.66 0z"/><path d="m22 12.5-9.17 4.16a2 2 0 0 1-1.66 0L2 12.5"/>'),
    link: svg('<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>'),
    bot: svg('<path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2M20 14h2M15 13v2M9 13v2"/>'),
    copyImage: svg(COPY)
  };
  var LINE_ICON = {
    home: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .71-1.53l7-6a2 2 0 0 1 2.58 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    folder: '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z"/>',
    docs: FILE_TEXT,
    recent: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    ask: SPARKLE,
    desk: '<rect width="20" height="14" x="2" y="3" rx="2"/><path d="M8 21h8M12 17v4"/>',
    down: '<path d="M12 15V3M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/>',
    code: '<path d="m16 18 6-6-6-6M8 6l-6 6 6 6"/>',
    pics: '<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21"/>',
    apps: '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>',
    root: '<path d="M22 12H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11zM6 16h.01M10 16h.01"/>',
    scrnsh: '<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><path d="m8 12 3 3 5-6"/>',
    bm: '<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>',
    tabset: '<path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65M22 12.65l-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
    help: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01"/>',
    gear: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>'
  };

  // src/icons.ts
  var CHEVRON_DOWN = '<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="m2.5 4.5 3.5 3 3.5-3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var PI = {
    ...Object.fromEntries(Object.entries(LINE_ICON).map(([k, body]) => [k, line(body)])),
    drag: `<svg width="10" height="14" viewBox="0 0 10 14"><circle cx="3" cy="3" r="1.2" fill="currentColor"/><circle cx="3" cy="7" r="1.2" fill="currentColor"/><circle cx="3" cy="11" r="1.2" fill="currentColor"/><circle cx="7" cy="3" r="1.2" fill="currentColor"/><circle cx="7" cy="7" r="1.2" fill="currentColor"/><circle cx="7" cy="11" r="1.2" fill="currentColor"/></svg>`
  };

  // src/layer.ts
  var CLOSES = {
    popover: { esc: true, outside: true, anchor: true, scroll: true, blur: true },
    hovercard: { esc: true, scroll: true },
    transient: {},
    command: { esc: true, outside: true },
    dialog: { esc: true },
    float: { esc: true }
  };
  var MODAL = { command: true, dialog: true, float: true };
  var stack = [];
  var topLayer = typeof HTMLElement !== "undefined" && typeof HTMLElement.prototype.showPopover === "function";
  var wired = false;
  var anchorClosed = null;
  var pressTarget = null;
  var opened = 0;
  var FOCUSABLE = 'button:not([disabled]),[href],input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])';
  function openLayer(el, opts) {
    wire();
    if (opts.anchor && anchorClosed === opts.anchor) {
      anchorClosed = null;
      return { el, kind: opts.kind, open: false, close() {
      }, place() {
      } };
    }
    const existing = stack.find((l) => l.el === el);
    existing?.close("replaced");
    if (opts.group) stack.filter((l) => l.opts.group === opts.group).forEach((l) => l.close("replaced"));
    const host = document.getElementById("fe") ?? document.body;
    const added = !el.isConnected;
    if (added) host.appendChild(el);
    el.dataset.layer = opts.kind;
    if (opts.role) el.setAttribute("role", opts.role);
    if (opts.label) el.setAttribute("aria-label", opts.label);
    if (MODAL[opts.kind]) el.setAttribute("aria-modal", "true");
    if (topLayer) {
      el.setAttribute("popover", "manual");
      el.showPopover();
    }
    const anchor = opts.anchor ?? null;
    anchor?.setAttribute("aria-expanded", "true");
    if (anchor && el.id) anchor.setAttribute("aria-controls", el.id);
    let open = true;
    const layer = {
      el,
      kind: opts.kind,
      opts,
      returnTo: document.activeElement,
      at: null,
      seq: 0,
      get open() {
        return open;
      },
      place: () => position(el, opts),
      close(why = "api") {
        if (!open) return;
        open = false;
        const i = stack.indexOf(layer);
        if (i >= 0) stack.splice(i, 1);
        anchor?.setAttribute("aria-expanded", "false");
        const hadFocus = el.contains(document.activeElement);
        if (topLayer && el.matches(":popover-open")) el.hidePopover();
        el.removeAttribute("popover");
        delete el.dataset.layer;
        if (added) el.remove();
        if (hadFocus || document.activeElement === document.body) {
          const back = anchor ?? layer.returnTo;
          if (back?.isConnected) back.focus({ preventScroll: true });
        }
        opts.onClose?.(why);
      }
    };
    stack.push(layer);
    layer.seq = ++opened;
    position(el, opts);
    layer.at = (anchor ?? opts.origin)?.getBoundingClientRect() ?? null;
    const f = opts.focus ?? (MODAL[opts.kind] ? "first" : "none");
    if (f === "first") el.querySelector(FOCUSABLE)?.focus({ preventScroll: true });
    else if (f instanceof HTMLElement) f.focus({ preventScroll: true });
    return layer;
  }
  function position(el, o) {
    const place = o.place ?? (o.point ? "point" : o.anchor ? "below" : "none");
    if (place === "none") return;
    el.style.position = "fixed";
    el.style.margin = "0";
    el.style.inset = "auto";
    const gap = o.offset ?? 4, pad = 8;
    const w = el.offsetWidth, h = el.offsetHeight;
    let x, y;
    if (place === "point" && o.point) {
      x = o.point.x;
      y = o.point.y;
    } else {
      const r = (o.anchor ?? el).getBoundingClientRect();
      if (place === "right") {
        x = r.right + gap;
        y = r.top;
      } else {
        x = o.align === "end" ? r.right - w : r.left;
        const below = r.bottom + gap, above = r.top - gap - h;
        y = place === "above" ? above >= pad ? above : below : below + h <= innerHeight - pad || above < pad ? below : above;
      }
    }
    el.style.left = `${Math.max(pad, Math.min(x, innerWidth - w - pad))}px`;
    el.style.top = `${Math.max(pad, Math.min(y, innerHeight - h - pad))}px`;
  }
  function wire() {
    if (wired) return;
    wired = true;
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      stack.filter((l) => l.kind === "hovercard").forEach((l) => l.close("esc"));
      const top = [...stack].reverse().find((l) => CLOSES[l.kind].esc);
      if (!top) return;
      e.preventDefault();
      e.stopPropagation();
      top.close("esc");
    }, true);
    document.addEventListener("pointerdown", (e) => {
      pressTarget = e.target;
      const t = e.target;
      const top = stack[stack.length - 1];
      if (!top || top.el.contains(t)) return;
      const anchor = top.opts.anchor;
      if (anchor?.contains(t)) {
        if (CLOSES[top.kind].anchor) {
          top.close("anchor");
          anchorClosed = anchor;
        }
        return;
      }
      anchorClosed = null;
      if (CLOSES[top.kind].outside) top.close("outside");
    }, true);
    document.addEventListener("click", (e) => {
      if (anchorClosed) setTimeout(() => {
        anchorClosed = null;
      });
      const top = stack[stack.length - 1], bd = top?.opts.backdrop;
      if (bd && e.target === bd && pressTarget === bd) top.close("outside");
    }, true);
    document.addEventListener("keydown", () => {
      anchorClosed = null;
    }, true);
    document.addEventListener("scroll", (e) => {
      const t = e.target;
      for (const l of [...stack]) {
        if (!CLOSES[l.kind].scroll || l.el.contains(t)) continue;
        const a = l.opts.anchor ?? l.opts.origin;
        if (a && l.at) {
          const r = a.getBoundingClientRect();
          if (Math.abs(r.top - l.at.top) < 2 && Math.abs(r.left - l.at.left) < 2) continue;
        }
        l.close("scroll");
      }
    }, true);
    document.addEventListener("focusin", (e) => {
      const t = e.target;
      for (const l of [...stack]) if (CLOSES[l.kind].blur && !l.el.contains(t) && !l.opts.anchor?.contains(t)) l.close("blur");
    });
  }
  function rovingFocus(root, items, o = {}) {
    const axis = o.axis ?? "vertical";
    const onKey = (e) => {
      if (e.defaultPrevented || e.altKey || e.metaKey || e.ctrlKey || e.shiftKey) return;
      const t = e.target;
      if (t.isContentEditable || t.matches("textarea, select, input:not([type=checkbox], [type=radio], [type=button], [type=submit])")) return;
      const list2 = [...root.querySelectorAll(items)].filter((x) => !x.hasAttribute("disabled") && x.offsetParent !== null);
      if (!list2.length) return;
      const i = list2.indexOf(document.activeElement);
      const next = axis !== "horizontal" && e.key === "ArrowDown" || axis !== "vertical" && e.key === "ArrowRight";
      const prev = axis !== "horizontal" && e.key === "ArrowUp" || axis !== "vertical" && e.key === "ArrowLeft";
      let to = -1;
      if (e.key === "Home") to = 0;
      else if (e.key === "End") to = list2.length - 1;
      else if (next) to = i < 0 ? 0 : i + 1 >= list2.length ? o.wrap === false ? i : 0 : i + 1;
      else if (prev) to = i <= 0 ? o.wrap === false ? 0 : list2.length - 1 : i - 1;
      if (to < 0) return;
      e.preventDefault();
      e.stopPropagation();
      list2[to].focus();
      o.onMove?.(list2[to]);
    };
    root.addEventListener("keydown", onKey);
    return () => root.removeEventListener("keydown", onKey);
  }

  // src/controls.ts
  function segHtml(id, opts, title, size = "md") {
    return `<div class="fe-seg" id="${id}"${size === "md" ? "" : ` data-size="${size}"`} role="radiogroup" aria-label="${esc(title)}" title="${esc(title)}">${opts.map((o) => `<button type="button" role="radio" class="fe-seg-b${o.label ? "" : " ico"}" data-v="${esc(o.value)}" aria-checked="false" tabindex="-1" title="${esc(o.hint ?? o.label ?? o.value)}"${o.label ? "" : ` aria-label="${esc(o.hint ?? o.value)}"`}>${o.icon ?? ""}${o.label ? `<span>${esc(o.label)}</span>` : ""}</button>`).join("")}</div>`;
  }
  function sliderHtml(id, values, unit, title, names) {
    return `<div class="fe-sld" id="${id}" data-values="${values.join(",")}" data-unit="${esc(unit)}"${names ? ` data-names="${esc(names.join("|"))}"` : ""} title="${esc(title)}">
    <input type="range" min="0" max="${values.length - 1}" step="1" aria-label="${esc(title)}" title="${esc(title)}">
    <output></output>
  </div>`;
  }
  function ddHtml(id, opts, title, size = "md") {
    return `<div class="fe-dd" id="${id}"${size === "md" ? "" : ` data-size="${size}"`} data-opts="${esc(JSON.stringify(opts))}">
    <button type="button" class="fe-dd-btn" aria-haspopup="listbox" aria-expanded="false" title="${esc(title)}"><span class="fe-dd-cur"></span>${CHEVRON_DOWN}</button>
  </div>`;
  }
  function chipsHtml(id, placeholder, title) {
    return `<div class="fe-chipin" id="${id}" title="${esc(title)}"><input class="fe-chipin-in" placeholder="${esc(placeholder)}" spellcheck="false" aria-label="${esc(title)}"></div>`;
  }
  var fire = (host) => host.dispatchEvent(new Event("change", { bubbles: true }));
  function upgradeSeg(host) {
    const btns = [...host.querySelectorAll(".fe-seg-b")];
    let cur = "";
    const paint = () => btns.forEach((b) => {
      const on = b.dataset.v === cur;
      b.classList.toggle("on", on);
      b.setAttribute("aria-checked", String(on));
      b.tabIndex = on || !cur && b === btns[0] ? 0 : -1;
    });
    Object.defineProperty(host, "value", { get: () => cur, set: (v) => {
      cur = String(v);
      paint();
    } });
    btns.forEach((b) => b.addEventListener("click", () => {
      if (cur !== b.dataset.v) {
        cur = b.dataset.v;
        paint();
        fire(host);
      }
    }));
    rovingFocus(host, ".fe-seg-b", { axis: "both", onMove: (b) => b.click() });
    paint();
  }
  function upgradeSlider(host) {
    const values = host.dataset.values.split(",").map(Number);
    const unit = host.dataset.unit ?? "";
    const names = host.dataset.names?.split("|");
    const range = host.querySelector("input");
    const out = host.querySelector("output");
    const show = () => {
      const v = values[Number(range.value)];
      out.textContent = names?.[Number(range.value)] ?? `${v}${unit}`;
      if (names) range.setAttribute("aria-valuetext", out.textContent);
      host.style.setProperty("--pct", `${Number(range.value) / (values.length - 1) * 100}%`);
    };
    Object.defineProperty(host, "value", {
      get: () => String(values[Number(range.value)]),
      set: (v) => {
        const n = Number(v);
        let best = 0;
        values.forEach((x, i) => {
          if (Math.abs(x - n) < Math.abs(values[best] - n)) best = i;
        });
        range.value = String(best);
        show();
      }
    });
    range.addEventListener("input", () => {
      show();
      host.dispatchEvent(new Event("input", { bubbles: true }));
    });
    range.addEventListener("change", (e) => {
      e.stopPropagation();
      fire(host);
    });
    show();
  }
  var list = null;
  var closeList = null;
  function upgradeDd(host) {
    const btn = host.querySelector(".fe-dd-btn");
    const curEl = host.querySelector(".fe-dd-cur");
    let opts = JSON.parse(host.dataset.opts || "[]");
    let cur = "";
    const paint = () => {
      host.dataset.value = cur;
      const o = opts.find((x) => x.value === cur);
      curEl.innerHTML = o ? `${o.icon ?? ""}<span>${esc(o.label ?? o.value)}</span>` : cur ? `<span>${esc(cur)}</span>` : '<span class="fe-dd-none">None</span>';
    };
    Object.defineProperty(host, "value", { get: () => cur, set: (v) => {
      cur = String(v);
      paint();
    } });
    host.setOptions = (o) => {
      opts = o;
      host.dataset.opts = JSON.stringify(o);
      paint();
    };
    let keys = null;
    function open() {
      closeList?.();
      list = document.createElement("div");
      list.className = "fe-dd-list";
      list.innerHTML = opts.map((o, i) => (o.group && o.group !== opts[i - 1]?.group ? `<div class="fe-dd-g" role="presentation">${esc(o.group)}</div>` : "") + `<div role="option" class="fe-dd-opt${o.value === cur ? " on" : ""}" data-v="${esc(o.value)}" aria-selected="${o.value === cur}">${o.icon ?? ""}<span class="fe-dd-l">${esc(o.label ?? o.value)}</span>${o.hint ? `<span class="fe-dd-h">${esc(o.hint)}</span>` : ""}</div>`).join("");
      list.style.minWidth = `${btn.getBoundingClientRect().width}px`;
      const layer = openLayer(list, { kind: "popover", anchor: btn, align: "end", role: "listbox", group: "menu", onClose: () => {
        keys = null;
        list = null;
        closeList = null;
      } });
      if (!layer.open) return;
      const items = [...list.querySelectorAll(".fe-dd-opt")];
      let at = Math.max(0, items.findIndex((i) => i.dataset.v === cur));
      const mark = () => {
        items.forEach((it, i) => it.classList.toggle("kb", i === at));
        items[at]?.scrollIntoView({ block: "nearest" });
      };
      mark();
      const pick = (v) => {
        const changed = v !== cur;
        cur = v;
        paint();
        layer.close("pick");
        btn.focus();
        if (changed) fire(host);
      };
      list.addEventListener("click", (e) => {
        const it = e.target.closest(".fe-dd-opt");
        if (it) pick(it.dataset.v);
      });
      list.addEventListener("mousemove", (e) => {
        const it = e.target.closest(".fe-dd-opt");
        if (it) {
          at = items.indexOf(it);
          mark();
        }
      });
      let typed = "", typedAt = 0;
      keys = (e) => {
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          at = (at + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
          mark();
        } else if (e.key === "Home" || e.key === "End") {
          at = e.key === "Home" ? 0 : items.length - 1;
          mark();
        } else if (e.key === "Enter" || e.key === " ") {
          if (items[at]) pick(items[at].dataset.v);
        } else if (e.key === "Tab") {
          layer.close("blur");
          return;
        } else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey) {
          typed = Date.now() - typedAt > 700 ? e.key.toLowerCase() : typed + e.key.toLowerCase();
          typedAt = Date.now();
          const hit = items.findIndex((it) => (it.querySelector(".fe-dd-l")?.textContent ?? "").toLowerCase().startsWith(typed));
          if (hit >= 0) {
            at = hit;
            mark();
          }
        } else return;
        e.preventDefault();
        e.stopPropagation();
      };
      closeList = () => layer.close("api");
    }
    btn.addEventListener("click", () => {
      if (btn.getAttribute("aria-expanded") === "true") closeList?.();
      else open();
    });
    btn.addEventListener("keydown", (e) => {
      if (keys) keys(e);
      else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        open();
      }
    });
    paint();
  }
  function upgradeChips(host) {
    const input = host.querySelector(".fe-chipin-in");
    let items = [];
    const paint = () => {
      host.dataset.value = items.join(", ");
      host.querySelectorAll(".fe-chip-x").forEach((c) => c.remove());
      input.insertAdjacentHTML("beforebegin", items.map((t, i) => `<span class="fe-chip-x">${esc(t)}<button type="button" data-i="${i}" title="Remove ${esc(t)}" aria-label="Remove ${esc(t)}">\xD7</button></span>`).join(""));
    };
    const commit = () => {
      const add = input.value.split(/[,\s]+/).map((x) => x.trim()).filter(Boolean);
      input.value = "";
      if (!add.length) return;
      items = [...items, ...add.filter((a) => !items.includes(a))];
      paint();
      fire(host);
    };
    Object.defineProperty(host, "value", {
      get: () => items.join(", "),
      set: (v) => {
        items = String(v).split(",").map((x) => x.trim()).filter(Boolean);
        paint();
      }
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === ",") {
        e.preventDefault();
        commit();
      } else if (e.key === "Backspace" && !input.value && items.length) {
        items.pop();
        paint();
        fire(host);
      }
    });
    input.addEventListener("blur", commit);
    input.addEventListener("change", (e) => e.stopPropagation());
    host.addEventListener("click", (e) => {
      const b = e.target.closest(".fe-chip-x button");
      if (b) {
        items.splice(Number(b.dataset.i), 1);
        paint();
        fire(host);
        input.focus();
      } else if (e.target === host) input.focus();
    });
  }
  function upgradeControls(root = document) {
    root.querySelectorAll(".fe-seg:not([data-up])").forEach((h) => {
      h.dataset.up = "1";
      upgradeSeg(h);
    });
    root.querySelectorAll(".fe-sld:not([data-up])").forEach((h) => {
      h.dataset.up = "1";
      upgradeSlider(h);
    });
    root.querySelectorAll(".fe-dd:not([data-up])").forEach((h) => {
      h.dataset.up = "1";
      upgradeDd(h);
    });
    root.querySelectorAll(".fe-chipin:not([data-up])").forEach((h) => {
      h.dataset.up = "1";
      upgradeChips(h);
    });
  }

  // src/storage.ts
  var PALETTES = ["slate", "violet", "sand", "ink", "ocean", "forest", "ember", "nord"];

  // src/design-page.ts
  var PAGE_CSS = `
html,body{height:auto;overflow:auto;margin:0;background:var(--bg)}
#fe{display:block;height:auto;min-height:100vh;color:var(--tx);font:var(--type-ui) -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
.ds-wrap{max-width:1080px;margin:0 auto;padding:var(--sp-8) var(--sp-6) var(--sp-9)}
.ds-head{display:flex;align-items:center;gap:var(--sp-5);flex-wrap:wrap;margin-bottom:var(--sp-8)}
.ds-head h1{font-size:var(--type-title);font-weight:600;margin-right:auto}
.ds-sec{margin-bottom:var(--sp-9)}
.ds-sec > h2{font-size:var(--type-micro);font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--dm);margin-bottom:var(--sp-4)}
.ds-sec > p{color:var(--mt);margin-bottom:var(--sp-5);max-width:72ch}
.ds-card{background:var(--card);border:1px solid var(--bd);border-radius:var(--pop-r);padding:var(--sp-6)}
.ds-row{display:flex;align-items:center;gap:var(--sp-5);flex-wrap:wrap;padding:var(--sp-3) 0}
.ds-row + .ds-row{border-top:1px solid var(--bd)}
.ds-lbl{min-width:140px;color:var(--mt);font-size:var(--type-small)}
.ds-sw{display:grid;gap:var(--sp-2);justify-items:center;font-size:var(--type-micro);color:var(--mt)}
.ds-sw i{display:block;width:56px;height:36px;border-radius:var(--row-r);border:1px solid var(--bd)}
.ds-bar{height:var(--sp-5);background:var(--ac);border-radius:var(--r-xs)}
.ds-box{background:var(--s2);border:1px solid var(--bd2)}
.ds-tag{font-size:var(--type-micro);color:var(--dm)}
.ds-plan{color:var(--dm)}
`;
  var swatch = (token) => `<span class="ds-sw"><i style="background:var(${token})"></i>${esc(token)}</span>`;
  var row = (label, body) => `<div class="ds-row"><span class="ds-lbl">${esc(label)}</span>${body}</div>`;
  var sec = (title, intro, body) => `<section class="ds-sec"><h2>${esc(title)}</h2>${intro ? `<p>${esc(intro)}</p>` : ""}<div class="ds-card">${body}</div></section>`;
  var SPACE = ["--sp-1", "--sp-2", "--sp-3", "--sp-4", "--sp-5", "--sp-6", "--sp-7", "--sp-8", "--sp-9"];
  var CTL = ["--ctl-xs", "--ctl-sm", "--ctl-md", "--ctl-lg", "--row-h", "--bar-h"];
  var RADII = ["--r-xs", "--r-sm", "--row-r", "--pop-r", "--r-full"];
  var TYPE = ["--type-micro", "--type-small", "--type-ui", "--type-ui-strong", "--type-title"];
  var LEVELS = ["--z-sticky", "--z-panel", "--z-popover", "--z-overlay", "--z-command", "--z-toast", "--z-tip"];
  function render() {
    const btns = (attrs) => ["", "shade", "outline", "solid"].map((v) => `<button class="btn" ${attrs} ${v ? `data-variant="${v}"` : ""} title="${v || "plain"}">${UI_ICON.copy}${v || "Plain"}</button>`).join("");
    const iconBtns = ["", "shade", "outline", "solid"].map((v) => `<button class="btn" data-icon ${v ? `data-variant="${v}"` : ""} title="${v || "plain"} icon button" aria-label="${v || "plain"}">${UI_ICON.copy}</button>`).join("");
    return `
<div class="ds-wrap">
  <div class="ds-head">
    <h1>Better File Browser design system</h1>
    ${segHtml("ds-theme", [{ value: "dark", label: "Dark" }, { value: "light", label: "Light" }], "Theme")}
    ${ddHtml("ds-palette", PALETTES.map((p) => ({ value: p, label: p[0].toUpperCase() + p.slice(1) })), "Palette")}
  </div>
  ${sec("Colour", "Surfaces step one layer at a time; text has three weights; states and tones are mixed from these.", [
      row("Surfaces", ["--bg", "--s1", "--s2", "--s3", "--card", "--side"].map(swatch).join("")),
      row("Text", ["--tx", "--mt", "--dm"].map(swatch).join("")),
      row("Lines and accent", ["--bd", "--bd2", "--ac", "--on", "--hover", "--shade"].map(swatch).join("")),
      row("Tones", ["--tone-ok", "--tone-warn", "--tone-danger", "--tone-info"].map(swatch).join(""))
    ].join(""))}
  ${sec("Type", "Five roles; every text in the app maps to one.", TYPE.map((t) => row(t, `<span style="font-size:var(${t})${t === "--type-ui-strong" || t === "--type-title" ? ";font-weight:600" : ""}">Read the folder, open the file</span>`)).join(""))}
  ${sec("Space", "Every gap and padding is one of these steps.", SPACE.map((t) => row(t, `<span class="ds-bar" style="width:var(${t})"></span>`)).join(""))}
  ${sec("Sizes and shape", "Control heights, row and bar heights, and the corner radii.", [
      ...CTL.map((t) => row(t, `<span class="ds-box" style="display:inline-block;width:120px;height:var(${t});border-radius:var(--row-r)"></span>`)),
      ...RADII.map((t) => row(t, `<span class="ds-box" style="display:inline-block;width:64px;height:40px;border-radius:var(${t})"></span>`))
    ].join(""))}
  ${sec("Layer levels", "Each floating archetype has a base level; a layer opened from another sits one step above it.", LEVELS.map((t) => row(t, `<span class="ds-tag">${esc(getComputedStyle(document.documentElement).getPropertyValue(t).trim() || "?")}</span>`)).join(""))}
  ${sec("Buttons (today)", "The shared button. Slice 3 makes it the only button.", [
      row("Text, md", btns("")),
      row("Text, sm", btns('data-size="sm"')),
      row("Icon", iconBtns),
      row("States", `<button class="btn on" title="on">${UI_ICON.check}On</button><button class="btn" disabled title="disabled">${UI_ICON.check}Disabled</button>`)
    ].join(""))}
  ${sec("Controls (today)", "The Settings controls the filter bar and sort panel already use.", [
      row("Segmented", segHtml("ds-seg", [{ value: "a", label: "Name" }, { value: "b", label: "Size" }, { value: "c", label: "Modified" }], "Segmented")),
      row("Segmented, icons", segHtml("ds-seg-i", [{ value: "a", icon: UI_ICON.list, hint: "List" }, { value: "b", icon: UI_ICON.table, hint: "Table" }, { value: "c", icon: UI_ICON.image, hint: "Images" }], "Segmented with icons")),
      row("Dropdown", ddHtml("ds-dd", [{ value: "a", label: "As listed", icon: UI_ICON.list }, { value: "b", label: "Name", icon: UI_ICON.file }, { value: "c", label: "Modified", icon: UI_ICON.clock }], "Dropdown")),
      row("Slider", sliderHtml("ds-sld", [1, 2, 3, 4, 5], "", "Detail", ["Overview", "Large", "Standard", "Detailed", "Full detail"])),
      row("Chips", chipsHtml("ds-chips", "Add a tag", "Chips")),
      row("Text box", `<label class="fe-in-box" style="width:260px"><input class="tb" type="text" placeholder="Pattern" title="Text box"><span class="fe-in-chips"><button type="button" class="fe-in-chip active" title="Regex">.*</button></span></label>`)
    ].join(""))}
  ${sec("Planned parts", "Built slice by slice (component-system.md, section 14); each appears here when it lands.", [
      row("Slice 1", '<span class="ds-plan">Layer, Menu, HoverCard, rich tooltip, RovingFocus, FocusTrap</span>'),
      row("Slice 2", '<span class="ds-plan">Actions, key scopes, palette tabs</span>'),
      row("Slice 3", '<span class="ds-plan">Icon, Button, IconButton, Toggle, Busy</span>'),
      row("Slice 4", '<span class="ds-plan">TextBox, Dropdown, Check, Switch, Chip, Badge</span>'),
      row("Slices 5 to 8", '<span class="ds-plan">Toolbar, SectionTitle, Notice, Panel, Dialog, ListRow, EmptyState, services</span>')
    ].join(""))}
</div>`;
  }
  var style = document.createElement("style");
  style.textContent = CSS2 + UI_CSS + PAGE_CSS;
  document.head.appendChild(style);
  var fe = document.createElement("div");
  fe.id = "fe";
  fe.dataset.theme = "dark";
  fe.dataset.palette = "slate";
  document.body.appendChild(fe);
  fe.innerHTML = render();
  upgradeControls(fe);
  var theme = document.getElementById("ds-theme");
  var palette = document.getElementById("ds-palette");
  theme.value = "dark";
  palette.value = "slate";
  document.getElementById("ds-dd").value = "a";
  document.getElementById("ds-seg").value = "a";
  document.getElementById("ds-seg-i").value = "b";
  document.getElementById("ds-sld").value = "3";
  var [hTheme, hPalette] = location.search.slice(1).split(",");
  if (hTheme === "light") {
    theme.value = "light";
    fe.dataset.theme = "light";
  }
  if (hPalette && PALETTES.includes(hPalette)) {
    palette.value = hPalette;
    fe.dataset.palette = hPalette;
  }
  theme.addEventListener("change", () => {
    fe.dataset.theme = theme.value;
  });
  palette.addEventListener("change", () => {
    fe.dataset.palette = palette.value;
  });
})();
