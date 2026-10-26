"use strict";(()=>{var lt=`
*{box-sizing:border-box;margin:0;padding:0}
/* Palettes (design-system.md, Soft round 2): Slate is the default; Violet,
   Sand and Ink are picked in Settings. Each palette sets only the surface,
   text and accent colours below, so every rule reads the same tokens.
   Selection and hover are washes mixed from the accent, so they follow it. */
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
   data-variant: plain (the default), shade, surface (a solid fill for a
   button floating over content), outline, solid.
   data-size: xs 18, sm 22, md 28 (the default), lg 32.
   data-icon: an icon alone, square at its size and round.
   data-shape="pill": a text button with round ends, for a pill bar.
   data-mono: a code glyph label (.* or Aa).
   A Toggle is a button that stays on; it may wrap a hidden check box.
   data-tone: danger (red on hover), accent (accent text at rest).
   On: .on, .active, aria-pressed or aria-expanded="true". Busy:
   aria-busy="true" (a spinner in place of the content). Done: data-done
   (green text; the caller removes it after a moment). A disabled button
   keeps its rest look and loses every hover. */
.btn{--btn-h:var(--ctl-md);display:inline-flex;align-items:center;justify-content:center;gap:var(--sp-3);height:var(--btn-h);padding:0 var(--sp-4);flex-shrink:0;
  border:1px solid transparent;border-radius:var(--row-r);background:none;color:var(--mt);font:inherit;font-size:var(--type-ui);
  line-height:1;white-space:nowrap;text-decoration:none;cursor:pointer;box-sizing:border-box;
  transition:background var(--t-fast) var(--ease),color var(--t-fast) var(--ease),border-color var(--t-fast) var(--ease),opacity var(--t-fast) var(--ease)}
.btn[hidden]{display:none}
.btn[data-size="xs"]{--btn-h:var(--ctl-xs);--btn-ic:10px;padding:0 var(--sp-2);font-size:var(--type-micro)}
.btn[data-size="sm"]{--btn-h:var(--ctl-sm);--btn-ic:12px;padding:0 var(--sp-3);font-size:var(--type-small)}
.btn[data-size="lg"]{--btn-h:var(--ctl-lg);--btn-ic:16px;padding:0 var(--sp-5)}
.btn[data-icon]{width:var(--btn-h);padding:0;border-radius:var(--r-full)}
.btn[data-shape="pill"]{padding:0 var(--sp-5);border-radius:var(--r-full)}
.btn svg{flex:none;width:var(--btn-ic,14px);height:var(--btn-ic,14px)}
.btn[data-variant="shade"],.btn[data-shade]{background:var(--shade)}
.btn[data-variant="surface"]{background:var(--s1);border-color:var(--bd)}
.btn[data-variant="outline"]{border-color:var(--bd2)}
.btn[data-variant="outline"][data-tone="accent"]{border-color:color-mix(in srgb,var(--ac) 45%,transparent)}
.btn[data-variant="solid"]{background:var(--ac);color:var(--tx-on-ac)}
.btn[data-tone="accent"]{color:var(--ac)}
.btn:not(:disabled):not([aria-disabled="true"]):hover{color:var(--tx);background:var(--hover)}
.btn:not(:disabled):not([aria-disabled="true"]):is([data-variant="shade"],[data-shade]):hover{background:var(--shade2)}
.btn:not(:disabled):not([aria-disabled="true"])[data-variant="surface"]:hover{background:var(--s3)}
.btn:not(:disabled):not([aria-disabled="true"])[data-variant="outline"]:hover{border-color:var(--mt)}
.btn:not(:disabled):not([aria-disabled="true"])[data-variant="solid"]:hover{background:var(--ac);color:var(--tx-on-ac);filter:brightness(1.1)}
.btn:not(:disabled):not([aria-disabled="true"])[data-tone="danger"]:hover{color:var(--tone-danger)}
.btn.kb{color:var(--tx);background:var(--hover)}
.btn.on,.btn.active,.btn[aria-pressed="true"],.btn[aria-expanded="true"],.btn:has(> input:checked){color:var(--ac);background:var(--on)}
.btn[data-variant="outline"]:is(.on,.active,[aria-pressed="true"],:has(> input:checked)){border-color:color-mix(in srgb,var(--ac) 45%,transparent)}
/* A toggle can wrap a native check box, laid invisibly over the whole button. */
.btn:has(> input){position:relative}
.btn > input[type="checkbox"]{position:absolute;inset:0;width:100%;height:100%;margin:0;opacity:0;cursor:pointer}
.btn:has(> input:focus-visible){outline:2px solid var(--ac);outline-offset:1px}
.btn[data-mono]{font-family:var(--mono)}
.btn:not(:disabled):not([data-variant="solid"]):active{background:var(--s3)}
.btn[data-variant="solid"]:not(:disabled):active{filter:brightness(.95)}
.btn:disabled,.btn[aria-disabled="true"]{opacity:.45;cursor:default}
.btn:focus-visible{outline:2px solid var(--ac);outline-offset:1px}
.btn[aria-busy="true"]{position:relative;cursor:progress;color:transparent}
.btn[aria-busy="true"] > *{visibility:hidden}
.btn[aria-busy="true"]::after{content:'';position:absolute;width:var(--btn-ic,14px);height:var(--btn-ic,14px);border:2px solid var(--mt);border-right-color:transparent;border-radius:var(--r-full);animation:fe-spin var(--t-slow) linear infinite}
.btn[data-done],.btn[data-done]:not(:disabled):not([aria-disabled="true"]):hover{color:var(--tone-ok)}
/* Toolbar, the one bar (docs/system/toolbar.md). Class bar. A bar along a
   page or panel is 40px with 12px sides; its controls are md. data-inset: a
   toolbar inside content (a code block, a comment, a lens) keeps the gap
   but takes its size from its place. Controls sit 4px apart; a bar-sep
   between groups makes 12px. */
.bar{display:flex;align-items:center;gap:var(--sp-2);box-sizing:border-box;flex-shrink:0}
.bar:not([data-inset]){min-height:var(--bar-h);padding:var(--sp-2) var(--sp-5)}
.bar-sep{flex:none;width:1px;height:16px;margin:0 var(--sp-2);background:var(--bd)}
/* SectionTitle, the one heading for a part of the page (docs/system/section-title.md).
   Class sect with data-level: group (a small capital label over a list or
   card), panel (a panel's or rail's title, with its icon and count), page (a
   dialog or page header: a tile, a title and a line under it). Actions sit
   at the end in sect-acts. The place sets padding. */
/* ListRow: one line in any list (sidebar, menus, dropdowns, palette, key
   map, contents, versions). Hover and the keyboard cursor share one wash; the
   selected, current or active row takes the accent wash with body text and an
   accent icon. The place sets its own height and padding where it differs
   (docs/system/list-row.md). */
.row{display:flex;align-items:center;gap:var(--row-gap);min-width:0;min-height:var(--row-h);padding:0 var(--row-px);
  border-radius:var(--row-r);font-size:var(--row-fs);color:var(--mt);text-decoration:none;
  transition:background var(--t-fast) var(--ease),color var(--t-fast) var(--ease)}
.row:hover,.row.kb,.row:focus-visible{background:var(--hover);color:var(--tx)}
.row:is(.active,.on,.selected,[aria-selected="true"],[aria-current="page"]),.row:has(> .active){background:var(--on);color:var(--tx)}
.row:is(.active,.on,.selected,[aria-selected="true"],[aria-current="page"]) svg,.row:has(> .active) svg{color:var(--ac);opacity:1}
/* EmptyState: what a list shows in place of rows while it loads, when it is
   empty, when a filter hides everything, or when it could not be read. Inline
   sits among rows (menus, sidebar, a tree level); the default is centered in
   the space the list would fill (docs/system/empty-state.md). */
.empty{display:flex;flex-direction:column;align-items:center;gap:var(--sp-2);padding:var(--sp-8) var(--sp-5) var(--sp-7);
  text-align:center;color:var(--tx);font-size:var(--fs-md);line-height:1.5}
.empty p{margin:0}
.empty-h{color:var(--dm);font-size:var(--fs-sm)}
.empty-h kbd{font:inherit;font-family:var(--mono);padding:0 var(--sp-2);border:1px solid var(--bd2);border-radius:var(--sp-2)}
.empty-ico{display:inline-grid;place-items:center;width:34px;height:34px;margin-bottom:var(--sp-2);border-radius:50%;background:var(--s2);color:var(--dm)}
.empty-ico svg{width:16px;height:16px}
.empty-a{display:flex;flex-wrap:wrap;justify-content:center;gap:var(--sp-3);margin-top:var(--sp-3)}
.empty[data-inline]{align-items:flex-start;text-align:left;gap:var(--sp-1);padding:var(--sp-3) var(--row-px);font-size:var(--fs-sm)}
.empty[data-inline] .empty-a{justify-content:flex-start;margin-top:var(--sp-2)}
.empty[data-indent]{padding-left:calc(var(--row-px) + var(--sp-8) + var(--depth) * var(--sp-7))}
.empty:is([data-inline],[data-state="loading"]) .empty-t{color:var(--dm)}
#fe-empty[hidden]{display:none}
/* Disclosure: the chevron on anything that folds turns right when folded,
   read from aria-expanded on its button or a closed <details> around its
   summary. */
.chev{width:12px;height:12px;flex:none;transition:transform var(--t-fast) var(--ease)}
:is([aria-expanded="false"],details:not([open]) > summary) > .chev{transform:rotate(-90deg)}
.sect{display:flex;align-items:center;gap:var(--sp-3);min-width:0;margin:0}
.sect-tx{display:flex;flex-direction:column;gap:var(--sp-1);min-width:0;flex:1}
.sect-acts{display:inline-flex;align-items:center;gap:var(--sp-2);margin-left:auto}
.sect[data-level="group"]{font-size:var(--type-micro);font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:var(--dm)}
.sect[data-level="panel"]{font-size:var(--type-ui);font-weight:600;color:var(--tx)}
.sect[data-level="page"]{gap:var(--sp-5)}
.sect[data-level="page"] .sect-tx > :first-child{margin:0;font-size:var(--fs-xl);font-weight:650;line-height:1.25;color:var(--tx);letter-spacing:-.01em}
.sect[data-level="page"] .sect-tx > :nth-child(2){margin:0;font-size:var(--fs-md);font-style:normal;font-weight:400;line-height:1.35;color:var(--dm)}
/* Panel: a bounded surface with a head, a scrolling body and an optional
   foot, floating over the page or docked into it. Scrim: the dimmed page
   behind a floating panel. (docs/system/panel.md) */
.panel{display:flex;flex-direction:column;min-width:0;min-height:0;overflow:hidden;outline:none;
  background:var(--card);border:1px solid var(--pop-bd);border-radius:var(--pop-r);box-shadow:var(--pop-sh)}
.panel[data-dock]{border:0;border-radius:0;box-shadow:none}
.scrim{position:absolute;inset:0;background:rgb(var(--ink) / .55);backdrop-filter:blur(2px);animation:fe-fade var(--t-base) var(--ease)}
.panel:not([data-dock]){animation:fe-rise var(--t-base) var(--ease)}
/* Card: a bounded group inside a panel or a page. The place sets padding. */
.card{background:var(--card);border:1px solid var(--bd);border-radius:var(--row-r)}
/* Notice, a line that tells the reader about the page itself
   (docs/system/notice.md): empty, cut short, could not render, changed on
   disk. Class notice; data-tone danger, warn or ok; buttons in it act on it. */
.notice{display:flex;align-items:center;flex-wrap:wrap;gap:var(--sp-3);padding:var(--sp-3) var(--sp-5);color:var(--dm);font-size:var(--type-small);line-height:1.4}
.notice[data-tone="danger"]{color:var(--tone-danger)}
.notice[data-tone="warn"]{color:var(--tone-warn)}
.notice[data-tone="ok"]{color:var(--tone-ok)}
/* Resize handle (docs/system/resize.md). Class rz, set by resizable(). A
   thin hit area whose 2px accent line grows in on hover, drag or focus, the
   sidebar's look everywhere. data-axis="xy" is a corner grip, which keeps
   two faint lines at rest so it can be found. */
.rz{flex-shrink:0;cursor:col-resize;user-select:none;touch-action:none;outline:0;
  background:linear-gradient(var(--ac),var(--ac)) center/0 100% no-repeat;transition:background-size var(--t-fast) var(--ease)}
.rz:hover,.rz.drag,.rz:focus-visible{background-size:2px 100%}
.rz[data-axis="xy"]{cursor:nwse-resize;background:linear-gradient(135deg,transparent 50%,var(--bd) 50%,var(--bd) 60%,transparent 60%,transparent 75%,var(--bd) 75%,var(--bd) 85%,transparent 85%)}
.rz[data-axis="xy"]:hover,.rz[data-axis="xy"].drag,.rz[data-axis="xy"]:focus-visible{background:linear-gradient(var(--ac),var(--ac)) right bottom/100% 2px no-repeat,linear-gradient(var(--ac),var(--ac)) right bottom/2px 100% no-repeat}
body.fe-resizing{user-select:none}
table.fe-col-edge,table.fe-col-edge *{cursor:col-resize}
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
.tb[data-mono]{font-family:var(--mono)}
/* A search field shows a magnifier at its start. */
.tb[data-lead="search"]{padding-left:var(--sp-8);background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='13' height='13' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2' stroke-linecap='round'%3E%3Ccircle cx='11' cy='11' r='7'/%3E%3Cpath d='m20 20-3.5-3.5'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:var(--sp-4) 50%}
@keyframes fe-spin{to{transform:rotate(1turn)}}
html,body{height:100%;background:var(--bg);color:var(--tx);
  font:var(--fs-lg)/1.5 var(--font-text);overflow:hidden}
body{opacity:1!important}
#fe{display:flex;flex-direction:column;height:100vh;background:var(--bg);color:var(--tx);font-family:var(--font-text)}
#fe-bar{background:var(--s1);border-bottom:1px solid var(--bd);flex-shrink:0}
#fe-bc{display:flex;align-items:center;gap:var(--sp-1);flex:1;overflow:hidden;white-space:nowrap;min-width:0;align-self:stretch;cursor:text}
#fe-bc[hidden]{display:none}
#fe-bc > *{cursor:default}
#fe-bc-edit{flex:1;min-width:0;display:flex}
#fe-bc-edit input{flex:1;min-width:0}

/* A long folder name (a hash, a generated id) shortens so the path around it stays readable. */
.fe-crumb{color:var(--mt);text-decoration:none;padding:var(--sp-1) var(--sp-2);border-radius:var(--r-xs);
  font-size:var(--fs-md);flex-shrink:0;transition:background var(--t-fast),color var(--t-fast);
  max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer}
.fe-cg{display:inline-flex;align-items:center;flex-shrink:0;min-width:0}
.fe-cg[hidden]{display:none}
.fe-crumb.cur{color:var(--tx);font-weight:500}
/* The current folder and a file name keep their full width while middle
   folders fold; past that they shorten, but never below a readable share. */
.fe-crumb.cur,.fe-crumb-file{flex-shrink:0;max-width:45%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fe-cg:has(.cur){flex-shrink:0;max-width:45%}
.fe-cg:has(.cur) .fe-crumb.cur{max-width:100%}
.fe-crumb-more{flex:none}
#fe-bar .fe-crumb-more[hidden]{display:none}
.fe-crumb:hover{background:var(--hover);color:var(--tx)}
.fe-sep{color:var(--dm);font-size:var(--fs-sm);flex-shrink:0;padding:0 var(--sp-1)}
#fe-bar .fe-crumb-dd svg{display:block}
#fe-crumb-menu{
  position:fixed;z-index:var(--z-popover);
  min-width:220px;max-width:340px;max-height:340px;overflow:hidden;
}
#fe-crumb-menu:not([data-layer]){display:none}
.fe-dd-search{width:100%}

.fe-dd-item{display:flex;align-items:center;
  color:var(--tx);text-decoration:none;white-space:nowrap;
  overflow:hidden;text-overflow:ellipsis}
.fe-dd-item.dir{color:var(--dir)}
.fe-dd-item svg{flex-shrink:0}
#fe-bm-btn.on,#fe-bm-btn.on:hover{color:var(--gold)}
#fe-theme-btn #fe-sun{display:none}
#fe-theme-btn #fe-moon{display:block}
#fe[data-theme="light"] #fe-theme-btn #fe-sun{display:block}
#fe[data-theme="light"] #fe-theme-btn #fe-moon{display:none}
/* The lens bar sits on top: icons in a row, the open lens grown to show its
   name; the wheel over the bar moves between lenses. The lens fills the rest. */
#fe-rail{flex:none;display:flex;align-items:center;gap:var(--sp-1);padding:var(--sp-3) var(--sp-3);border-bottom:1px solid var(--bd);overflow:hidden}
.fe-rail-btn{flex:0 1 auto;min-width:26px;height:var(--ctl-lg);display:flex;align-items:center;justify-content:center;gap:0;padding:0 var(--sp-2);border:0;border-radius:var(--row-r);background:none;color:var(--mt);cursor:pointer;
  font:inherit;position:relative;z-index:1;transition:background var(--t-fast) var(--ease),color var(--t-fast) var(--ease)}
.fe-rail-btn[hidden]{display:none}
.fe-rail-btn svg{width:16px;height:16px;flex:none}
.fe-rail-btn em{font-style:normal;font-size:var(--fs-md);font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:0;opacity:0}
.fe-rail-btn.on{flex:1 0 auto;gap:var(--sp-3);padding:0 var(--sp-4)}
.fe-rail-btn.on em{max-width:110px;opacity:1}
/* The open lens's highlight. It sits inside its button, so it always fits it;
   a lens switch slides it over from the old button. */
.fe-rail-hl{position:absolute;inset:0;z-index:-1;border-radius:var(--row-r);pointer-events:none;transform-origin:0 0}
.fe-rail-btn.on .fe-rail-hl{background:color-mix(in srgb,var(--ac) 16%,transparent)}
.fe-rail-btn.on:hover .fe-rail-hl{background:color-mix(in srgb,var(--ac) 22%,transparent)}
#fe-rail.tight .fe-rail-btn:not(.on){flex:1 1 0;min-width:22px;padding:0 var(--sp-1)}
#fe-rail.tight .fe-rail-btn.on{padding:0 var(--sp-3);gap:var(--sp-2)}
#fe-rail.tighter .fe-rail-btn{flex:1 1 0;min-width:22px;padding:0 var(--sp-2)}
#fe-rail.tighter .fe-rail-btn.on{gap:0}
#fe-rail.tighter .fe-rail-btn em{display:none}
.fe-rail-btn:hover{background:var(--hover);color:var(--tx)}
.fe-rail-btn.on,.fe-rail-btn.on:hover{background:none;color:var(--tx)}
.fe-rail-btn:focus-visible{outline:2px solid var(--ac);outline-offset:1px}
.fe-lens[hidden]{display:none}
.fe-doc-row,.fe-dpl-row{display:flex;align-items:center;gap:var(--sp-4);width:calc(100% - 12px);margin:var(--sp-1) var(--sp-3);padding:var(--sp-3) var(--sp-4);border:0;border-radius:var(--row-r);background:none;color:var(--tx);font:inherit;text-align:left;cursor:pointer}
.fe-doc-tx,.fe-dpl-tx{flex:1;min-width:0;display:flex;flex-direction:column;line-height:1.3}
.fe-doc-name,.fe-doc-dir{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fe-doc-name{font-size:var(--row-fs)}
.fe-docs-top[hidden]{display:none}
.fe-doc-dir{font-size:var(--fs-sm);color:var(--dm)}
.fe-dpl-title{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:var(--row-fs)}
.fe-dpl-origin{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:var(--fs-sm);color:var(--dm)}
.fe-doc-me{display:inline-flex;color:var(--ac)}
.fe-doc-me svg{width:13px;height:13px}
.fe-doc-due{font-size:var(--fs-sm);color:var(--tx);padding:0 var(--sp-3);border-radius:var(--r-full);background:color-mix(in srgb,var(--nc-orange) 16%,transparent)}
.fe-doc-n,.fe-dpl-n{flex:none}
.fe-dpl-age{flex:none;font-size:var(--fs-sm);color:var(--dm)}
.fe-dpl-reach[data-reach="hot"]{color:var(--green)}
.fe-dpl-row.unseen{background:color-mix(in srgb,var(--gold) 9%,transparent)}
.fe-dpl-row.unseen .fe-dpl-title{font-weight:600}
.fe-dpl-row .fe-row-ico{position:relative;display:flex}
.fe-dpl-dot{position:absolute;top:calc(var(--sp-1) * -1);right:calc(var(--sp-1) * -1);width:var(--sp-3);height:var(--sp-3);border-radius:50%;background:var(--gold);box-shadow:0 0 0 2px var(--side)}
.fe-row-cm{flex:none}
#fe-side-rz{width:10px}
.fe-sec{margin-bottom:var(--sp-2)}
.fe-sec.fe-collapsed>:not(.fe-sh){display:none}
#fe-side .fe-sh{justify-content:flex-start}
/* A hidden sidebar peeks out over the page from the left edge (side-peek.ts). */
#fe-side.peek{position:fixed;left:var(--sp-4);top:calc(var(--bar-h) + var(--sp-4));bottom:var(--sp-4);z-index:var(--z-popover);border:1px solid var(--pop-bd);border-radius:var(--r-sm);box-shadow:var(--pop-sh);animation:fe-lens-in var(--t-fast) var(--ease)}
#fe-edge{position:fixed;left:0;top:var(--bar-h);bottom:0;width:var(--sp-5);z-index:var(--z-popover);cursor:e-resize}
#fe-edge::after{content:'';position:absolute;left:var(--sp-1);top:30%;bottom:30%;width:var(--sp-1);border-radius:var(--r-full);background:var(--ac);opacity:0;transition:opacity var(--t-fast) var(--ease)}
#fe-edge.near::after{opacity:.55}
#fe-edge[hidden]{display:none}
.fe-sh-collapse{min-height:24px;min-width:0;display:flex;align-items:center;gap:var(--sp-3);padding:0;border:0;background:none;color:inherit;cursor:pointer;font:inherit;letter-spacing:inherit;text-transform:inherit;text-align:left}
.fe-sh-collapse:hover{color:var(--tx)}
.fe-si{display:flex;align-items:center;color:var(--mt);text-decoration:none}
.fe-rc-ago{font-size:var(--fs-sm);color:var(--dm);flex-shrink:0}
.fe-si svg{flex-shrink:0;opacity:.7;width:19px;height:19px}
.fe-bm-item{display:flex;align-items:center;position:relative;user-select:none}
.fe-drag-h{padding:var(--sp-4) var(--sp-2) var(--sp-4) var(--sp-4);color:var(--dm);cursor:grab;opacity:0;transition:opacity var(--t-fast);flex-shrink:0;display:flex;align-items:center}
.fe-bm-item:hover .fe-drag-h{opacity:1}
.fe-bm-item.dragging{opacity:.4;background:var(--hover)}
.fe-bm-item.drag-over{border-top:2px solid var(--ac)}
.fe-si-link svg{flex-shrink:0;opacity:.7;width:19px;height:19px}
.fe-rm-btn{opacity:0;flex-shrink:0}
.fe-bm-item:hover .fe-rm-btn{opacity:1}

#fe-lens-filter,#fe-docs-q{display:block;width:calc(100% - 12px);margin:var(--sp-1) var(--sp-3) var(--sp-4)}

.fe-pl-label.editing,.fe-pl-tags.editing{outline:1px solid var(--ac);border-radius:3px;background:var(--s2);padding:0 var(--sp-2);cursor:text}
.fe-sv-tag{gap:var(--sp-4);padding:var(--sp-4) var(--sp-5) var(--sp-2)}
.fe-sv-dot{width:9px;height:9px;border-radius:50%;cursor:pointer;flex-shrink:0;box-shadow:0 0 0 1px rgb(var(--ink) / calc(4 / 15));background:var(--dot)}
#fe-lens-filter[hidden],.fe-lens-tags[hidden]{display:none}
.fe-proxy-filter{display:none}
.fe-grp > summary::-webkit-details-marker{display:none}
.fe-grp-n{margin-left:auto;font-weight:500;color:var(--dm)}
.fe-sv-dot:hover{transform:scale(1.25)}
.fe-pl-dots{display:flex;align-items:center;gap:var(--sp-2);margin-left:auto;padding-right:var(--sp-1);flex:none}
.fe-sv-mini{width:6px;height:6px;border-radius:50%;display:inline-block}
.fe-sv-more{font-size:var(--fs-xs);color:var(--dm);line-height:6px}
.fe-pl-tags{display:none;font-size:var(--fs-sm);color:var(--mt);min-width:60px;max-width:110px;white-space:nowrap;overflow:hidden}
.fe-pl-tags.show{display:inline-block}
.fe-tag-btn{opacity:0;flex-shrink:0}
.fe-bm-item:hover .fe-tag-btn{opacity:1}

/* clip, not hidden: focusing a control past the edge must not scroll the pane sideways.
   The pane is a size container so its toolbar wraps by the pane's width, which a
   docked preview can make narrow in a wide window. */
#fe-main{flex:1;display:flex;flex-direction:column;container:fe-main / inline-size;min-width:0}
#fe-toolbar{border-bottom:1px solid var(--bd);flex-shrink:0}
#fe-count{font-size:var(--fs-sm);color:var(--dm);flex:1;white-space:nowrap}
#fe-tb-right{display:flex;align-items:center;gap:var(--sp-2)}
#fe-sg-cur{font-variant-numeric:tabular-nums}
/* One "on" look across the toolbar: the accent tint the chosen view wears. */
/* Detail: a small slider between a big-square and a dense-rows icon, its stop named beside it. */
#fe-density-wrap{display:flex;align-items:center;gap:var(--sp-3);color:var(--dm)}
.fe-density-end{display:inline-grid;place-items:center}
#fe-density{display:contents}
#fe-density input{order:1;flex:none;width:72px}
#fe-density-wrap .fe-density-end:last-of-type{order:2}
#fe-density output{order:3;min-width:72px;padding:0;background:none;font-family:inherit;font-size:var(--fs-sm);color:var(--mt);text-align:left}
/* One text box for the toolbar filter and the filter bar: the sidebar filter's
   look, with toggles (.*, Aa) as chips inside its right end. */
.fe-in-box{position:relative;display:inline-flex;align-items:center;flex:none}
.fe-in-box input[type="text"]{width:100%;margin:0}

.fe-tb-box{width:170px;margin-left:var(--sp-2)}
.fe-in-name{width:220px}
.fe-in-name input[type="text"]{padding-right:40px}
.fe-in-text{width:300px}
.fe-in-text input[type="text"]{padding-right:68px}
.fe-in-chips{position:absolute;right:4px;top:50%;transform:translateY(-50%);display:flex;gap:var(--sp-2)}
#fe-sg-panel,#fe-filter-bar{display:flex;flex-direction:column;gap:var(--sp-4);
  padding:var(--sp-4) var(--sp-5);background:var(--s1);border-bottom:1px solid var(--bd);flex-shrink:0}
.fe-panel-row{display:flex;align-items:center;gap:var(--sp-4);flex-wrap:wrap}
.fe-panel-lbl{min-width:52px;font-size:var(--fs-sm);color:var(--dm);font-weight:500;white-space:nowrap}
.fe-panel-sub{display:inline-flex;align-items:center;gap:var(--sp-4)}
.fe-panel-sub .fe-panel-lbl{min-width:0}
.fe-panel-gap{margin-left:var(--sp-5)}
#fe-filter-bar .fe-dd-btn,#fe-sg-panel .fe-dd-btn{min-width:150px}
#fe-find-depth .fe-dd-btn{min-width:100px}
#fe-find-status{font-size:var(--fs-sm);color:var(--mt);margin-left:var(--sp-2)}
#fe-find-save{margin-left:auto}
.fe-view .fe-si-link svg{color:var(--ac);opacity:.9}
thead{position:sticky;top:0;z-index:var(--z-sticky)}
thead th{padding:var(--sp-3) var(--sp-5);text-align:left;font-size:var(--fs-sm);font-weight:600;text-transform:uppercase;letter-spacing:.07em;color:var(--dm);border-bottom:1px solid var(--bd);user-select:none;white-space:nowrap;position:relative}
thead th[data-sort]{cursor:pointer}
thead th[data-sort]:hover{color:var(--tx)}
.fe-col-rz{position:absolute;top:0;right:0;width:7px;height:100%}
/* Rendered tables (markdown, CSV/TSV) share the handle; col-resize.ts fixes
   the layout on the first drag so one column moves at a time. */
.fe-md-table th{position:relative}
table.fe-rz-fixed{table-layout:fixed}
.fe-ql-table.fe-rz-fixed th,.fe-ql-table.fe-rz-fixed td{overflow:hidden;text-overflow:ellipsis}
.fe-md-table.fe-rz-fixed td,.fe-md-table.fe-rz-fixed th{overflow-wrap:anywhere}
.si{opacity:.35;font-size:var(--fs-xs)}
th.sorted .si{opacity:1;color:var(--ac)}
.c-nm{width:40%}.c-tp{width:14%}.c-tg{width:14%}.c-sz{width:11%;text-align:right}.c-dt{width:21%}
td.c-tg{white-space:nowrap;overflow:hidden}
/* Named chips give up width (ending in \u2026) before the +N count does. */
.fe-chips{display:flex;gap:var(--sp-2);min-width:0;overflow:hidden}
.fe-chips .chip{flex:0 1 auto;min-width:28px}
.fe-chips .fe-chip-more{flex:none;min-width:0}
.c-match{display:none;text-align:right;width:72px;color:var(--dm)}
#fe.fe-has-find-hits[data-view="details"] .c-match{display:table-cell}
#fe.fe-has-find-hits[data-view="details"] .c-nm{width:42%}
#fe.fe-has-find-hits[data-view="details"] .c-dt{width:19%}
.fe-find-snippet{display:block;color:var(--dm);font-size:var(--fs-sm);margin:var(--sp-2) 0 var(--sp-1) 22px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fe-find-snippet mark{background:var(--ac);color:var(--bg);border-radius:2px;padding:0 var(--sp-1)}
.fe-find-badge{margin-left:22px}
#fe-find-error{color:var(--tone-danger);font-size:var(--type-small)}
#fe[data-view="details"] .fe-row .fe-find-badge{display:none}
tbody tr{border-bottom:1px solid var(--bg);transition:background var(--t-fast)}
tbody tr:hover{background:var(--hover)}
tbody td{padding:var(--sp-2) var(--sp-5);vertical-align:middle}
td.c-sz{text-align:right;white-space:nowrap;color:var(--dm);font-variant-numeric:tabular-nums;font-size:var(--fs-md)}
td.c-dt{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--dm);font-size:var(--fs-md)}
td.c-tp{color:var(--dm);font-size:var(--fs-sm)}
.fe-lnk{display:flex;align-items:center;gap:var(--sp-4);text-decoration:none;color:var(--tx)}
.fe-lnk svg{flex-shrink:0}
.fe-lnk:hover .fe-nm{color:var(--ac);text-decoration:underline}
.fe-nm{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dir .fe-nm{color:var(--dir)}
.par td.c-nm .fe-nm{color:var(--dm)}
.par:hover .fe-nm{color:var(--mt)}
.dotfile{opacity:.65}
.fe-group-hdr td{padding:var(--sp-2) var(--sp-5);font-size:var(--fs-sm);font-weight:600;
  text-transform:uppercase;letter-spacing:.08em;color:var(--dm);
  background:var(--s2);border-bottom:1px solid var(--bd);border-top:1px solid var(--bd)}
.fe-group-hdr-tile{width:100%;padding:var(--sp-3) var(--sp-2) var(--sp-1);font-size:var(--fs-sm);font-weight:600;
  text-transform:uppercase;letter-spacing:.08em;color:var(--dm)}
#fe:not(.show-hidden) .fe-row.dotfile,
#fe:not(.show-hidden) .fe-tile.dotfile,
#fe:not(.show-hidden) .fe-tree-row.dotfile{display:none}
#fe[data-view="list"] .c-tp,#fe[data-view="list"] .c-tg,#fe[data-view="list"] .c-sz,#fe[data-view="list"] .c-dt{display:none}
#fe[data-view="list"] .c-nm{width:100%}
#fe[data-view="list"] tbody td{padding:var(--sp-2) var(--sp-5)}
#fe-tiles{display:none;flex-wrap:wrap;gap:var(--sp-2) var(--sp-3);padding:var(--sp-4) var(--sp-5);align-content:flex-start;align-items:flex-start}
#fe[data-view="tiles"] #fe-table,#fe[data-view="icons"] #fe-table{display:none}
#fe[data-view="tree"] #fe-table{display:none}
#fe-tree{display:none;padding:var(--sp-3) 0}
#fe[data-view="tree"] #fe-tree{display:block}
#fe[data-view="tree"] #fe-tiles{display:none}
.fe-tree-row{display:flex;align-items:center;min-height:29px;padding-right:var(--sp-5);gap:var(--sp-2);padding-left:calc(var(--row-px) + var(--depth,0) * var(--sp-7))}
.fe-tree-toggle,.fe-tree-spacer{width:20px;height:20px;flex:none}
.fe-tree-toggle{display:flex;align-items:center;justify-content:center;border:0;background:none;color:var(--dm);cursor:pointer;border-radius:var(--r-xs)}
.fe-tree-toggle:hover{background:var(--s2);color:var(--tx)}
.fe-tree-link{display:flex;align-items:center;gap:var(--sp-4);color:var(--tx);text-decoration:none;min-width:0}
.fe-tree-link svg{flex:none}
.fe-tree-link:hover .fe-nm{text-decoration:underline;color:var(--ac)}
#fe[data-view="tiles"] #fe-tiles,#fe[data-view="icons"] #fe-tiles{display:flex}
.fe-tile{display:flex;flex-direction:column;align-items:center;gap:var(--sp-2);
  padding:var(--sp-4) var(--sp-3) var(--sp-4);border-radius:var(--r-sm);text-decoration:none;
  color:var(--tx);border:1px solid transparent;transition:all var(--t-fast);
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
#fe[data-view="tiles"] .fe-tile-ic svg{transform:scale(1.5);margin:var(--sp-2)}
#fe[data-view="icons"] .fe-tile{width:116px;padding:var(--sp-4) var(--sp-4) var(--sp-4);gap:var(--sp-2)}
#fe[data-view="icons"] .fe-tile-ic svg{transform:scale(2);margin:var(--sp-4) var(--sp-4) var(--sp-3)}
#fe[data-view="icons"] .fe-tile-nm{font-size:var(--fs-md)}
.fe-tile-img-wrap{display:block;width:68px;height:56px;border-radius:5px;overflow:hidden;
  box-shadow:0 1px 4px rgb(var(--ink) / calc(1 / 3));flex-shrink:0}
.fe-tile-thumb{width:100%;height:100%;object-fit:cover;display:block;border-radius:5px}
.fe-tile-img-wrap svg{display:none;transform:none;margin:var(--sp-2);width:24px;height:24px}
.fe-tile-img-wrap.err .fe-tile-thumb{display:none}
.fe-tile-img-wrap.err svg{display:block}
#fe[data-view="tiles"] .fe-tile-ic .fe-tile-img-wrap{width:68px;height:56px}
#fe[data-view="icons"] .fe-tile-ic .fe-tile-img-wrap{width:86px;height:70px}
#fe[data-view="tiles"] .fe-tile-ic .fe-tile-img-wrap.err svg,
#fe[data-view="icons"] .fe-tile-ic .fe-tile-img-wrap.err svg{transform:none;margin:var(--sp-4)}
.fe-tile-meta{display:none}

/* Detail levels (data-density 1 to 5, 3 is the standard look). Low numbers
   show fewer, bigger items with names only; high numbers show smaller items
   and add facts: type, date, tags and comments on tiles, columns on lists. */
#fe[data-density="1"][data-view="details"] tbody td{padding:var(--sp-5) var(--sp-6)}
#fe[data-density="1"][data-view="details"] .fe-lnk{gap:var(--sp-5);font-size:var(--fs-lg)}
#fe[data-density="1"][data-view="details"] .fe-lnk svg{transform:scale(1.45)}
#fe[data-density="1"][data-view="details"] :is(.c-tp,.c-tg,.c-sz,.c-dt){display:none}
#fe[data-density="1"][data-view="details"] .c-nm{width:100%}
#fe[data-density="2"][data-view="details"] tbody td{padding:var(--sp-4) var(--sp-5)}
#fe[data-density="2"][data-view="details"] .fe-lnk svg{transform:scale(1.2)}
#fe[data-density="2"][data-view="details"] :is(.c-tp,.c-tg){display:none}
#fe[data-density="2"][data-view="details"] .c-nm{width:60%}
#fe[data-density="4"][data-view="details"] tbody td{padding:var(--sp-2) var(--sp-5)}
#fe[data-density="5"][data-view="details"] tbody td{padding:var(--sp-1) var(--sp-4);font-size:var(--fs-sm)}
#fe[data-density="5"][data-view="details"] .fe-lnk svg{transform:scale(.85)}

#fe[data-density="1"][data-view="list"] tbody td{padding:11px var(--sp-6)}
#fe[data-density="1"][data-view="list"] .fe-lnk{gap:var(--sp-5);font-size:var(--fs-lg)}
#fe[data-density="1"][data-view="list"] .fe-lnk svg{transform:scale(1.45)}
#fe[data-density="2"][data-view="list"] tbody td{padding:var(--sp-4) var(--sp-5)}
#fe[data-density="2"][data-view="list"] .fe-lnk svg{transform:scale(1.2)}
/* List gains columns as detail goes up: size and date, then type too. */
#fe[data-density="4"][data-view="list"] :is(.c-sz,.c-dt),
#fe[data-density="5"][data-view="list"] :is(.c-sz,.c-dt,.c-tp){display:table-cell}
#fe[data-density="4"][data-view="list"] .c-nm,#fe[data-density="5"][data-view="list"] .c-nm{width:auto}
#fe[data-density="4"][data-view="list"] tbody td{padding:var(--sp-2) var(--sp-5)}
#fe[data-density="5"][data-view="list"] tbody td{padding:var(--sp-1) var(--sp-4);font-size:var(--fs-sm)}

#fe[data-density="1"] .fe-tree-row{min-height:42px;font-size:var(--fs-lg)}
#fe[data-density="1"] .fe-tree-link svg{transform:scale(1.4)}
#fe[data-density="2"] .fe-tree-row{min-height:35px}
#fe[data-density="4"] .fe-tree-row{min-height:24px}
#fe[data-density="5"] .fe-tree-row{min-height:20px;font-size:var(--fs-sm)}

/* Tiles and icons: big name-only tiles at 1 and 2; at 4 a type and date line;
   at 5 a card with the icon beside the name, type, size, date, tags, comments. */
#fe[data-density="1"] #fe-tiles,#fe[data-density="2"] #fe-tiles{gap:var(--sp-4) var(--sp-5);padding:var(--sp-5) var(--sp-6)}
#fe[data-density="1"] .fe-tile-sz,#fe[data-density="2"] .fe-tile-sz{display:none}
#fe[data-density="1"][data-view="tiles"] .fe-tile{width:168px;padding:var(--sp-6) var(--sp-4) var(--sp-5);gap:var(--sp-4)}
#fe[data-density="1"][data-view="tiles"] .fe-tile-ic svg{transform:scale(3.2);margin:22px}
#fe[data-density="1"][data-view="icons"] .fe-tile{width:220px;padding:var(--sp-7) var(--sp-5) var(--sp-5);gap:var(--sp-4)}
#fe[data-density="1"][data-view="icons"] .fe-tile-ic svg{transform:scale(4.4);margin:var(--sp-9)}
#fe[data-density="1"] .fe-tile-nm{font-size:var(--fs-lg)}
#fe[data-density="1"][data-view="tiles"] .fe-tile-ic .fe-tile-img-wrap{width:148px;height:112px}
#fe[data-density="1"][data-view="icons"] .fe-tile-ic .fe-tile-img-wrap{width:196px;height:148px}
#fe[data-density="2"][data-view="tiles"] .fe-tile{width:128px;padding:var(--sp-5) var(--sp-4) var(--sp-4);gap:var(--sp-3)}
#fe[data-density="2"][data-view="tiles"] .fe-tile-ic svg{transform:scale(2.3);margin:var(--sp-5)}
#fe[data-density="2"][data-view="icons"] .fe-tile{width:160px;padding:var(--sp-5) var(--sp-4) var(--sp-4);gap:var(--sp-4)}
#fe[data-density="2"][data-view="icons"] .fe-tile-ic svg{transform:scale(3);margin:var(--sp-7)}
#fe[data-density="2"] .fe-tile-nm{font-size:var(--fs-md)}
#fe[data-density="2"][data-view="tiles"] .fe-tile-ic .fe-tile-img-wrap{width:108px;height:84px}
#fe[data-density="2"][data-view="icons"] .fe-tile-ic .fe-tile-img-wrap{width:140px;height:108px}
#fe[data-density="4"] .fe-tile-meta{display:flex;flex-direction:column;align-items:center;gap:var(--sp-1);max-width:100%;font-size:var(--fs-xs);color:var(--dm)}
#fe[data-density="4"] .fe-tile-meta > span{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#fe[data-density="4"] .fe-tile-tags{display:none}
#fe[data-density="5"][data-view="tiles"] #fe-tiles{gap:var(--sp-2) var(--sp-3)}
#fe[data-density="5"][data-view="tiles"] .fe-tile{display:grid;grid-template-columns:auto 1fr;grid-template-rows:auto auto 1fr;column-gap:var(--sp-4);row-gap:var(--sp-1);
  align-items:start;justify-items:start;width:250px;padding:var(--sp-4) var(--sp-4);text-align:left}
#fe[data-density="5"][data-view="tiles"] .fe-tile-ic{grid-row:1 / span 3;align-self:center}
#fe[data-density="5"][data-view="tiles"] .fe-tile-ic svg{transform:scale(1.6);margin:var(--sp-3)}
#fe[data-density="5"][data-view="tiles"] .fe-tile-ic .fe-tile-img-wrap{width:44px;height:36px}
#fe[data-density="5"][data-view="tiles"] .fe-tile-nm{text-align:left;-webkit-line-clamp:1;font-size:var(--fs-md)}
#fe[data-density="5"][data-view="tiles"] .fe-tile-sz{grid-column:2;font-size:var(--fs-xs)}
#fe[data-density="5"][data-view="tiles"] .fe-tile-meta{grid-column:2;display:flex;flex-wrap:wrap;align-items:center;gap:var(--sp-1) var(--sp-4);font-size:var(--fs-xs);color:var(--dm)}
#fe[data-density="5"][data-view="tiles"] .fe-tile-tags{display:flex;align-items:center;gap:var(--sp-2)}
#fe[data-density="5"][data-view="tiles"] .fe-tile-tags .fe-chips{max-width:150px}
/* Icons keep their centred shape at 5: a smaller icon over the name and every fact. */
#fe[data-density="5"][data-view="icons"] .fe-tile{width:112px;padding:var(--sp-4) var(--sp-3) var(--sp-4);gap:var(--sp-2)}
#fe[data-density="5"][data-view="icons"] .fe-tile-ic svg{transform:scale(1.5);margin:var(--sp-2) var(--sp-4) var(--sp-2)}
#fe[data-density="5"][data-view="icons"] .fe-tile-ic .fe-tile-img-wrap{width:72px;height:56px}
#fe[data-density="5"][data-view="icons"] .fe-tile-nm{font-size:var(--fs-sm)}
#fe[data-density="5"][data-view="icons"] .fe-tile-meta{display:flex;flex-direction:column;align-items:center;gap:var(--sp-1);max-width:100%;font-size:var(--fs-xs);color:var(--dm)}
#fe[data-density="5"][data-view="icons"] .fe-tile-meta > span{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#fe[data-density="5"][data-view="icons"] .fe-tile-tags{display:flex;justify-content:center;gap:var(--sp-2)}
.fe-row .fe-acts{
  display:inline-flex;align-items:center;gap:var(--sp-2);
  position:absolute;right:8px;top:50%;transform:translateY(-50%);
  opacity:0;transition:opacity var(--t-fast);pointer-events:none}
.fe-row:hover .fe-acts{opacity:1;pointer-events:auto}
.fe-tile .fe-acts{
  display:flex;justify-content:center;gap:var(--sp-2);
  position:absolute;bottom:0;left:0;right:0;
  padding:var(--sp-2) var(--sp-2) var(--sp-2);
  background:linear-gradient(transparent,var(--s1)cc 40%,var(--s1) 100%);
  border-radius:0 0 var(--r-sm) var(--r-sm);
  opacity:0;transition:opacity var(--t-fast);pointer-events:none}
.fe-tile:hover .fe-acts{opacity:1;pointer-events:auto}
#fe[data-view="list"] .fe-tile .fe-acts{
  position:absolute;right:6px;top:50%;transform:translateY(-50%);
  background:none;border-radius:0;padding:0;width:auto;left:auto}

.fe-row td.c-nm{position:relative}
#fe-statusbar{border-top:1px solid var(--bd);flex-shrink:0;font-size:var(--fs-md);color:var(--mt)}
#fe-status-meta{display:flex;align-items:center;gap:var(--sp-5)}
.fe-meta-item{display:inline-flex;align-items:center;gap:var(--sp-2)}
.fe-meta-item svg{color:var(--dm)}
.fe-status-grow{flex:1}
#fe-fp-reload[hidden]{display:none}
#fe-fp-reload.off{color:var(--dm)}
@keyframes fe-fade-in{from{opacity:0}to{opacity:1}}
/* The path reads as a link: pointer, accent and underline on hover; a click copies it. */
#fe-status-path{min-width:0;max-width:60%;overflow:hidden;text-overflow:ellipsis;direction:rtl;text-align:left;
  height:var(--ctl-sm);padding:0;border:0;background:none;color:var(--mt);font:inherit;cursor:pointer;
  text-decoration:underline transparent;text-underline-offset:3px;transition:color var(--t-fast) var(--ease),text-decoration-color var(--t-fast) var(--ease)}
#fe-status-path:hover{color:var(--ac);text-decoration-color:currentColor}
#fe-tip{
  position:fixed;pointer-events:none;z-index:var(--z-tip);
  padding:var(--sp-4) var(--sp-5);font-size:var(--fs-md);line-height:1.7;
  max-width:380px;overflow-wrap:anywhere;word-break:break-word;
  opacity:0;
  transition:opacity var(--t-fast) ease-out;
}
#fe-tip.show{opacity:1;transition:opacity var(--t-base) ease-in calc(var(--t-fast) / 2)}
.tip-header{display:flex;align-items:center;gap:var(--sp-4);margin-bottom:var(--sp-2)}
.tip-icon{flex-shrink:0;display:flex;align-items:center}
.tip-icon svg{display:block}
.tip-name{font-weight:600;font-size:var(--fs-md);word-break:break-all;color:var(--tx)}
.tip-line{color:var(--mt);font-size:var(--fs-sm);line-height:1.6}
.tip-warn{color:var(--dm);font-size:var(--fs-sm);margin-top:var(--sp-2);border-top:1px solid var(--bd);padding-top:var(--sp-2)}
#fe-toast{
  position:fixed;bottom:32px;left:50%;transform:translateX(-50%) translateY(6px);
  padding:var(--sp-4) 18px;border-radius:20px;
  font-size:var(--fs-md);opacity:0;transition:all var(--t-base);pointer-events:none;white-space:nowrap;
  z-index:var(--z-toast)
}
#fe-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
/* The label for anything with a title (tooltip.ts); same surface as the row card #fe-tip. */
#fe-hint.on{opacity:1}
/* A control's tooltip: icon and title, a lighter line, then its keys. */
#fe-hint.rich{white-space:normal;display:flex;flex-direction:column;gap:var(--sp-1);padding:var(--sp-3) var(--sp-5)}
.fe-hint-h{display:flex;align-items:center;gap:var(--sp-3)}
.fe-hint-h svg{width:1.15em;height:1.15em;flex:none;color:var(--ac)}
.fe-hint-h b{font-weight:600}
.fe-hint-s{color:var(--dm);font-size:var(--fs-xs)}
.fe-hint-k{display:flex;align-items:center;gap:var(--sp-2);margin-top:var(--sp-1)}
.fe-hint-k i{color:var(--dm);font-style:normal;font-size:var(--fs-xs)}
/* A problem on a line: the kind in its tone and the line number, then each
   message at reading size, since the message is the point. */
#fe-hint.problem{border-left:3px solid var(--tone-warn)}
#fe-hint.problem.err{border-left-color:var(--tone-danger)}
#fe-hint.problem .fe-hint-h b{color:var(--tone-warn)}
#fe-hint.problem.err .fe-hint-h b{color:var(--tone-danger)}
.fe-hint-ln{color:var(--dm);font-size:var(--fs-xs);font-variant-numeric:tabular-nums}
#fe-hint.problem .fe-hint-s{color:var(--tx);font-size:var(--fs-sm)}
/* Parts in the top layer (layer.ts) keep their own look and placement, not the
   browser's popover defaults; zero specificity, so every part's own rule wins. */
:where([popover]){inset:auto;margin:0;padding:0;border:0;background:none;color:inherit;width:auto;height:auto;overflow:visible}
#fe-toast.act.show{pointer-events:auto}
::-webkit-scrollbar{width:5px;height:5px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:var(--bd);border-radius:3px}
::-webkit-scrollbar-thumb:hover{background:var(--dm)}
#fe.compact tbody td{padding:var(--sp-1) var(--sp-5)}
#fe.compact .fe-tile{padding:var(--sp-3) var(--sp-3) var(--sp-2);gap:var(--sp-2)}
/* Dialog: Settings and Help. A Panel over a Scrim with the title and the
   tabs down the left and one scrolling pane on the right. Every rule for it
   is here, and in the 700px block at the end (docs/system/dialog.md). */
.fe-dlg{position:fixed;inset:0;z-index:var(--z-overlay);display:flex;align-items:center;justify-content:center;container:dlg/inline-size}
/* In the sidebar: the same box fills a pane over the lenses. */
#fe-side-pane{position:absolute;inset:0;display:flex;container:dlg/inline-size;background:var(--side)}
#fe-side-pane[hidden]{display:none}
.fe-dlg-box.panel[data-dock]{width:100%;height:100%;max-height:none}
.fe-dlg-box[data-dock] [id$="-size"]{display:none}
.fe-dlg-box{position:relative;z-index:1;display:grid;grid-template-columns:216px minmax(0,1fr);grid-template-rows:auto minmax(0,1fr);
  width:min(1000px,calc(100vw - 48px));height:min(780px,84vh)}
/* Large and extra large never come out smaller than the panel's own size. */
.fe-dlg-box[data-size="lg"]{width:max(min(1000px,calc(100vw - 48px)),85vw);height:max(min(780px,84vh),90vh)}
#fe-ql-dialog[data-size="lg"]{width:max(min(1100px,calc(100vw - 64px)),85vw);height:max(min(84vh,1000px),90vh)}
.fe-dlg-box[data-size="xl"],#fe-ql-dialog[data-size="xl"]{width:calc(100vw - 32px);height:calc(100vh - var(--ctl-lg))}
.fe-dlg-title b{font-family:var(--font-head)}
.fe-dlg-title{grid-column:1;grid-row:1;padding:18px var(--sp-6) var(--sp-4);align-items:flex-start;background:var(--side);border-right:1px solid var(--bd)}
.fe-dlg-mark{flex:none;width:26px;height:26px;border-radius:var(--row-r);display:grid;place-items:center;background:var(--on);color:var(--ac)}
.fe-dlg-acts{position:absolute;top:14px;right:14px;z-index:var(--z-sticky);display:flex;gap:var(--sp-2)}
.fe-dlg-tabs{grid-column:1;grid-row:2;display:flex;flex-direction:column;gap:var(--sp-1);padding:var(--sp-2) var(--sp-4) var(--sp-5);overflow:auto;background:var(--side);border-right:1px solid var(--bd)}
.fe-dlg-tab{display:flex;flex-direction:column;gap:var(--sp-2);padding:var(--sp-4) var(--sp-4);border:0;border-radius:var(--row-r);background:none;color:var(--mt);
  cursor:pointer;text-align:left;line-height:1;transition:background var(--t-fast) var(--ease),color var(--t-fast) var(--ease)}
.fe-dlg-tab:hover{background:var(--hover);color:var(--tx)}
.fe-dlg-tab.on{background:var(--on);color:var(--tx)}
.fe-dlg-tab-main{display:flex;align-items:center;gap:var(--row-gap);min-width:0}
.fe-dlg-tab b{font-size:var(--row-fs);font-weight:500;color:inherit}
.fe-dlg-tab i{padding-left:calc(22px + var(--row-gap));font-size:var(--fs-sm);font-style:normal;line-height:1.3;color:var(--dm);opacity:.85}
.fe-dlg-tab.on i{opacity:1}
.fe-dlg-tile{flex:none;display:inline-grid;place-items:center;width:22px;height:var(--ctl-sm);border-radius:var(--r-sm);color:rgb(var(--paper));
  background:linear-gradient(165deg,color-mix(in srgb,var(--tone) 88%,rgb(var(--paper))),color-mix(in srgb,var(--tone) 80%,rgb(var(--ink))));
  box-shadow:inset 0 0 0 .5px rgb(var(--paper) / .2),0 1px 2px rgb(var(--ink) / .22)}
.fe-dlg-tile svg{width:13px;height:13px}
.fe-dlg-tile.lg{width:40px;height:var(--bar-h);border-radius:11px;box-shadow:inset 0 0 0 .5px rgb(var(--paper) / .22),0 4px 12px color-mix(in srgb,var(--tone) 30%,transparent)}
.fe-dlg-tile.lg svg{width:22px;height:var(--ctl-sm)}
.fe-dlg-pane{grid-column:2;grid-row:1/span 2;display:none;min-height:0;padding:var(--sp-7) var(--sp-8) var(--sp-8);overflow:auto;background:var(--side)}
.fe-dlg-pane.on{display:flex;flex-direction:column;gap:var(--sp-6)}
.fe-dlg-pane:has(> .fe-dlg-ph){padding-top:0}
.fe-dlg-ph{position:sticky;top:0;z-index:3;margin:0 -24px;padding:22px 96px 18px var(--sp-8);background:linear-gradient(var(--side) 82%,color-mix(in srgb,var(--side) 0%,transparent))}
.fe-dlg-pane .fe-md{max-width:none;padding:0}
.fe-dlg-pane .fe-md h2{font-size:1.15em;border:0;padding:0}
.fe-dlg-pane .fe-md>:first-child{margin-top:0;padding-right:36px}

.fe-st-input{width:100%}
#fe-st-export-out{height:calc(var(--ctl-md) * 4 + var(--sp-4));font:var(--fs-sm) var(--mono)}

.fe-st-rule{display:grid;grid-template-columns:16px 22px 1fr 58px 32px 24px;
  gap:var(--sp-3);align-items:center;padding:var(--sp-2) var(--sp-1);border-bottom:1px solid var(--bd)}
.fe-st-rule:last-child{border-bottom:none}
.fe-st-rule input[type="checkbox"]{accent-color:var(--ac);cursor:pointer;width:13px;height:13px}
.fe-st-ai-head{display:flex;align-items:center;gap:var(--sp-4);margin-bottom:var(--sp-4)}
.fe-st-ai-blink{position:relative;display:inline-flex;width:9px;height:9px;flex-shrink:0}
.fe-st-ai-blink .dot{width:9px;height:9px;border-radius:50%;background:var(--dm);z-index:1}
.fe-st-ai-blink::after{content:'';position:absolute;inset:0;border-radius:50%;background:inherit}
.fe-st-ai-head.ready .dot{background:var(--green)}
.fe-st-ai-head.cold .dot{background:var(--gold)}
/* Pulsing halo only when the model is actually resident (ready). */
.fe-st-ai-head.ready .fe-st-ai-blink::after{background:var(--green);animation:fe-blink var(--t-pulse) ease-out infinite}
.fe-st-ai-head.cold .fe-st-ai-blink::after{background:var(--gold);animation:fe-blink calc(var(--t-pulse) * 1.5) ease-out infinite}
@keyframes fe-blink{0%{transform:scale(1);opacity:.55}70%,100%{transform:scale(2.6);opacity:0}}
.fe-st-ai-state{font-size:var(--fs-md);font-weight:600;color:var(--tx)}
.fe-st-ai-grid{display:grid;grid-template-columns:auto 1fr;gap:var(--sp-2) var(--sp-5);font-size:var(--fs-md)}
.fe-st-ai-grid .k{color:var(--dm)}
.fe-st-ai-grid .v{color:var(--tx);font-family:var(--mono);font-size:var(--fs-sm);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fe-st-ai-grid .v.warm-yes{color:var(--green)}
.fe-st-ai-grid .v.warm-no{color:var(--gold)}
.fe-st-ai-hint{font-size:var(--fs-sm);color:var(--dm);margin-top:var(--sp-4);line-height:1.5}
#fe-qlook{position:fixed;inset:0;z-index:var(--z-overlay);display:flex;align-items:center;justify-content:center}
#fe-ql-dialog{position:relative;z-index:1;width:min(1100px,calc(100vw - 64px));height:min(84vh,1000px);max-width:calc(100vw - 16px);max-height:calc(100vh - 16px)}
#fe-ql-rz{position:absolute;right:0;bottom:0;width:16px;height:16px;z-index:2}
#fe-ql-rz-side{display:none;position:absolute;left:-3px;top:0;width:8px;height:100%;z-index:2}
#fe-qlook.side #fe-ql-bg,#fe-qlook.side #fe-ql-rz,#fe-qlook.side #fe-ql-size{display:none}
#fe-qlook.side #fe-ql-rz-side{display:block}
#fe-qlook.side #fe-ql-dialog{width:100%;height:100%;max-width:none;max-height:none}
#fe-tabbar{display:flex;align-items:stretch;border-bottom:1px solid var(--bd);flex-shrink:0;min-height:34px}
/* The strip takes only the room its tabs need, so + and the path button sit
   right after the last tab; past the bar's width the tabs scroll and the
   buttons stay in view. */
#fe-tabs{display:flex;align-items:stretch;gap:var(--sp-2);padding:var(--sp-3) var(--sp-2) 0 var(--sp-3);flex:0 1 auto;min-width:0;overflow-x:auto;scrollbar-width:none}
#fe-tabs-end{display:flex;align-items:center;gap:var(--sp-1);padding:var(--sp-2) var(--sp-4) 0 var(--sp-1);flex:none}
#fe-goto{position:fixed;width:min(460px,calc(100vw - 16px));padding:var(--sp-4);border-radius:var(--pop-r);
  background:var(--pop-bg);border:1px solid var(--pop-bd);box-shadow:var(--pop-sh);backdrop-filter:var(--pop-blur);-webkit-backdrop-filter:var(--pop-blur)}
#fe-goto input{width:100%}

.fe-goto-msg{margin:var(--sp-3) var(--sp-1) 0;font-size:var(--fs-sm);color:var(--dm)}
#fe-tabs::-webkit-scrollbar{display:none}
/* The list of every tab: icon, name, and the digit that jumps to it. */
.fe-tab-menu .fe-ctx-item span:not(.fe-ctx-key){flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fe-tab-menu kbd{font:500 var(--fs-xs) var(--mono);color:var(--dm);padding-left:var(--sp-5)}
.fe-tab.pinned{padding:var(--sp-2) var(--sp-3);min-width:0}
.fe-tab.pinned .fe-tab-lbl,.fe-tab.pinned .fe-tab-more{display:none}
#fe-tabs.is-empty{padding-top:var(--sp-2)}
.fe-tab{display:flex;align-items:center;gap:var(--sp-3);padding:var(--sp-2) var(--sp-4) var(--sp-2) var(--sp-4);min-height:29px;font-size:var(--fs-md);color:var(--mt);text-decoration:none;
  background:var(--s2);border:1px solid var(--bd);border-bottom:none;border-radius:7px 7px 0 0;white-space:nowrap;max-width:200px;min-width:112px;flex:0 1 auto;position:relative;top:1px;
  transition:background var(--t-fast) var(--ease),color var(--t-fast) var(--ease)}
.fe-tab:hover{background:var(--s3);color:var(--tx)}
.fe-tab.temp{background:none;border-color:transparent}
.fe-tab.temp.on{background:var(--bg);border-color:var(--bd);color:var(--mt)}
.fe-tab.drag-over{border-left:2px solid var(--ac)}
.fe-tab-lbl{display:flex;overflow:hidden;min-width:0}
.fe-tab-head{overflow:hidden;white-space:pre;min-width:0}
.fe-tab-tail{white-space:nowrap;flex-shrink:0}

.fe-tab:hover .fe-tab-x,.fe-tab.on .fe-tab-x,.fe-tab:hover .fe-tab-more{opacity:1}

/* A tab you are not on gives its name the whole width: its menu and close
   buttons float over the end of the name, and only while it is hovered. */
.fe-tab:not(.on) .fe-tab-x,.fe-tab:not(.on) .fe-tab-more{position:absolute;top:50%;margin-top:calc(var(--btn-h) / -2);background:var(--s3)}
.fe-tab:not(.on) .fe-tab-x:hover,.fe-tab:not(.on) .fe-tab-more:hover{background:var(--bd2)}
.fe-tab:not(.on) .fe-tab-x{right:6px}
.fe-tab:not(.on) .fe-tab-more{right:26px}
.fe-tab:not(.on):not(:hover):not(:focus-within) .fe-tab-x,.fe-tab:not(.on):not(:hover):not(:focus-within) .fe-tab-more{visibility:hidden}

.fe-tab.pinned::before{content:'';width:5px;height:5px;border-radius:50%;background:var(--ac);flex-shrink:0}
.fe-tab-ico{display:flex;flex-shrink:0}
.fe-tab-menu{position:fixed}
#fe.fe-file-page #fe-toolbar,#fe.fe-file-page #fe-sg-panel,#fe.fe-file-page #fe-filter-bar,#fe.fe-file-page #fe-scroll{display:none}
#fe-fp-bar{border-bottom:1px solid var(--bd);flex-shrink:0}
/* Contents and Comments float over the page as a translucent card, shown and
   hidden by the two buttons right of find. The text keeps clear of the card. */
#fe-fp{display:flex;flex:1;min-height:0;position:relative}
#fe-toc-rail{position:absolute;top:12px;right:16px;z-index:4;width:240px;max-height:calc(100% - 24px);display:flex;flex-direction:column;min-height:0;
  transition:width var(--t-base) var(--ease),border-radius var(--t-base) var(--ease)}
#fe-toc-rail[hidden]{display:none}
#fe-toc-rail.peek{box-shadow:var(--pop-sh)}
.fe-toc-head{display:flex;align-items:center;gap:var(--sp-3);padding:var(--sp-4) var(--sp-4) var(--sp-3) var(--sp-6);flex:none}
#fe-toc{flex:1;min-height:0;overflow-y:auto;padding:var(--sp-1) 0 var(--sp-6)}
#fe-toc a.fe-toc-h1{font-size:var(--fs-lg);font-weight:600;color:var(--tx)}
#fe-toc a.fe-toc-h2{font-size:var(--fs-md);padding-left:22px}
#fe-toc a.fe-toc-h3{font-size:var(--fs-md);padding-left:34px}
#fe-toc a.fe-toc-h4{font-size:var(--fs-md);padding-left:46px;color:var(--dm)}
/* The rail's two tabs, Contents and Comments. Comments needs more room, so
   the rail and the text column's right padding widen while it shows. */
.fe-rail-title{flex:1}
.fe-rail-ico{display:inline-flex;color:var(--mt)}
.fe-rail-ico svg{width:14px;height:14px}
.fe-rt{border:0;background:none;padding:var(--sp-2) var(--sp-4);border-radius:var(--r-full);font-size:var(--fs-md);font-weight:500;
  color:var(--mt);cursor:pointer;display:inline-flex;align-items:center;gap:var(--sp-3);white-space:nowrap}
.fe-rt svg{width:13px;height:13px;opacity:.85}
.fe-rt:hover{color:var(--tx);background:var(--hover)}
.fe-rt.on{color:var(--tx);background:var(--on)}
.fe-rt[hidden]{display:none}
#fe-toc-rail[data-tab="cm"]{width:320px}
/* The editor's floating pill moves left of the comments rail instead of covering its tabs. */
#fe-fp:has(#fe-toc-rail[data-tab="cm"]:not([hidden])) #fe-fe-pill{right:352px}
/* The pane buttons right of find: icons only, the comment count as a small badge. */
.fe-fp-panes{display:inline-flex;gap:var(--sp-1);flex:none}
#fe-fp-bar .fe-fp-panes button[hidden]{display:none}
#fe-fp-cm{position:relative}
#fe-fp-cm-n:empty{display:none}
#fe-fp-cm-n{position:absolute;top:-3px;right:-4px;min-width:14px;padding:0 var(--sp-2);border-radius:var(--r-full);background:var(--ac);color:var(--tx-on-ac);font-size:var(--fs-xs);line-height:14px;text-align:center}
/* Comment threads: a quote, then each comment with who and when, then chips. */
#fe-cm{flex:1;min-height:0;display:flex;flex-direction:column;position:relative}
.fe-cm-top{flex:none;display:flex;align-items:center;gap:var(--sp-2);padding:0 var(--sp-4) var(--sp-4)}
.fe-cm-list{flex:1;min-height:0;overflow-y:auto;padding:var(--sp-1) var(--sp-4) var(--sp-5)}
#fe-cm[hidden]{display:none}
.fe-cm-filters{flex:1;display:flex;gap:var(--sp-1);padding:var(--sp-1);border-radius:10px;background:var(--bg);border:1px solid var(--bd)}
.fe-cm-filters button{flex:1;border:0;background:none;border-radius:var(--row-r);padding:var(--sp-2) var(--sp-2);font-size:var(--fs-sm);color:var(--mt);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:var(--sp-2);white-space:nowrap}
.fe-cm-filters button svg{width:11px;height:11px;opacity:.75}
.fe-cm-fn{color:var(--dm)}
.fe-cm-ib{flex:none}

.fe-cm-filters button.on{background:var(--card);color:var(--tx);box-shadow:0 1px 2px rgb(var(--ink) / .18)}
.fe-cm-group{gap:var(--sp-3);margin:var(--sp-5) var(--sp-1) var(--sp-3);cursor:default}
.fe-cm-group span{font-weight:500;letter-spacing:0}
details.fe-cm-done > summary{cursor:pointer;list-style:none}
details.fe-cm-done > summary::-webkit-details-marker{display:none}
.fe-cm-th{position:relative;margin:0 0 var(--sp-4);padding:var(--sp-4) var(--sp-5);cursor:pointer;
  transition:border-color var(--t-fast) var(--ease),box-shadow var(--t-fast) var(--ease)}
.fe-cm-th:hover{border-color:var(--bd2)}
.fe-cm-th.on{border-color:color-mix(in srgb,var(--ac) 60%,var(--bd));box-shadow:0 0 0 3px color-mix(in srgb,var(--ac) 14%,transparent)}
.fe-cm-th:focus-visible{outline:2px solid var(--ac);outline-offset:2px}
.fe-cm-q{margin:0 0 var(--sp-4);padding:0 0 0 var(--sp-4);border-left:2px solid color-mix(in srgb,var(--ac) 55%,transparent);font-size:var(--fs-sm);line-height:1.45;color:var(--mt);
  display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.fe-cm-state{display:flex;align-items:center;gap:var(--sp-2);margin:-2px 0 var(--sp-4);font-size:var(--fs-xs);color:color-mix(in srgb,var(--nc-orange) 75%,var(--mt));cursor:default}
.fe-cm-state svg{width:12px;height:12px;flex:none}
.fe-cm-c + .fe-cm-c{margin-top:var(--sp-4);padding-top:var(--sp-4);border-top:1px solid color-mix(in srgb,var(--bd) 70%,transparent)}
.fe-cm-who{display:flex;align-items:center;gap:var(--sp-3);margin-bottom:var(--sp-2)}
.fe-cm-who b{display:inline-flex;align-items:center;gap:var(--sp-2);font-size:var(--fs-md);font-weight:600;color:var(--tx)}
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
.fe-cm-sug{margin-top:var(--sp-3);font-size:var(--fs-sm);color:var(--mt)}
.fe-cm-diff{display:flex;flex-wrap:wrap;gap:var(--sp-2);padding:var(--sp-3) var(--sp-4);border-radius:var(--row-r);background:var(--shade);line-height:1.5;overflow-wrap:anywhere}
.fe-cm-diff del{background:color-mix(in srgb,var(--nc-red) 14%,transparent);color:var(--mt);padding:0 var(--sp-2);border-radius:3px}
.fe-cm-sug ins{text-decoration:none;background:color-mix(in srgb,var(--nc-green) 18%,transparent);padding:0 var(--sp-2);border-radius:3px;color:var(--tx)}
.fe-cm-sug .fe-cm-tools{margin-top:var(--sp-3)}
.fe-cm-sug-state{display:inline-flex;align-items:center;gap:var(--sp-2);margin-top:var(--sp-2);font-size:var(--fs-xs);color:var(--dm)}
.fe-cm-sug-state svg{width:12px;height:12px}
.fe-cm-sug.rejected .fe-cm-diff{opacity:.6}
.fe-cm-sug-msg{display:flex;gap:var(--sp-3);align-items:flex-start;margin:var(--sp-3) 0 0;font-size:var(--fs-sm);color:color-mix(in srgb,var(--nc-orange) 75%,var(--mt));line-height:1.4}
.fe-cm-sug-msg svg{flex:none;width:13px;height:13px;margin-top:var(--sp-1)}
.fe-cm-chips{display:flex;flex-wrap:wrap;gap:var(--sp-2);margin-top:var(--sp-4)}
.fe-cm-note{margin:0 var(--sp-1) var(--sp-4);font-size:var(--fs-sm);color:var(--dm);line-height:1.4}
.fe-cm-hint{color:var(--dm);font-size:var(--fs-sm)}
.fe-cm-hint kbd{font:inherit;font-family:var(--mono);padding:0 var(--sp-2);border:1px solid var(--bd2);border-radius:var(--r-xs)}
/* Writing: the composer card, the reply box on the open thread, its tools. */
.fe-cm-new{cursor:default}
.fe-cm-box{margin-top:var(--sp-4)}
.fe-cm-new .fe-cm-box{margin-top:0}
.fe-cm-box textarea{display:block;width:100%;max-height:220px;resize:vertical}

.fe-cm-ac{position:absolute;z-index:var(--z-step);max-width:calc(100% - 20px);box-sizing:border-box;padding:var(--sp-2);border-radius:10px;
  background:var(--pop-bg);border:1px solid var(--pop-bd);box-shadow:var(--pop-sh);backdrop-filter:var(--pop-blur);-webkit-backdrop-filter:var(--pop-blur)}
.fe-cm-ac[hidden]{display:none}
.fe-cm-ac > div{padding:var(--sp-2) var(--sp-4);border-radius:var(--r-sm);font-size:var(--fs-md);color:var(--tx);cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fe-cm-ac > div span{color:var(--dm);font-size:var(--fs-sm);margin-left:var(--sp-2)}
.fe-cm-ac > div:hover{background:var(--hover)}
.fe-cm-ac > div.on{background:var(--on)}
.fe-cm-tools{flex-wrap:wrap;margin-top:var(--sp-3)}
.fe-cm-grow{flex:1}
.fe-cm-date{width:auto;color-scheme:light dark}
.fe-cm-x{margin:0 -3px 0 var(--sp-1)}

/* The floating Comment button above a selection on the page. */
#fe-cm-add{position:fixed;z-index:var(--z-panel);height:var(--ctl-md);padding:0 var(--sp-4);border-radius:var(--r-full);color:var(--tx);
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
.fe-md [data-cm]::after{content:attr(data-cm);position:absolute;top:2px;right:-30px;min-width:20px;height:var(--ctl-xs);padding:0 var(--sp-2);border-radius:9px 9px 9px 2px;
  background:color-mix(in srgb,var(--ac) 22%,var(--card));color:var(--tx);font-size:var(--fs-xs);font-weight:600;line-height:18px;text-align:center;cursor:pointer}
/* Find in file, at the right end of the file bar. */
#fe-ff{display:inline-flex;align-items:center;gap:var(--sp-2);height:var(--ctl-md);padding:0 var(--sp-2) 0 var(--sp-4);border:1px solid var(--bd);border-radius:var(--row-r);
  background:color-mix(in srgb,var(--tx) 3%,var(--card));color:var(--dm);transition:border-color var(--t-fast) var(--ease),background var(--t-fast) var(--ease)}
#fe-ff:focus-within{border-color:color-mix(in srgb,var(--ac) 60%,var(--bd));background:var(--card)}
#fe-ff[hidden]{display:none}
#fe-ff-q{width:150px;border:0;outline:0;background:none;color:var(--tx);font:inherit;font-size:var(--fs-md)}
#fe-ff-n{flex:none;width:7.5ch;text-align:right;font-size:var(--fs-sm);color:var(--dm);white-space:nowrap;font-variant-numeric:tabular-nums}
#fe-ff-n.none{color:var(--mt);font-style:italic}
#fe-ff-n.part{text-decoration:underline dotted;text-underline-offset:3px;cursor:help}
mark.fe-ff-hit{background:color-mix(in srgb,var(--gold) 35%,transparent);color:inherit;border-radius:2px}
mark.fe-ff-hit.on{background:var(--gold);color:var(--tx-on-gold)}
#fe-page{flex:1;min-width:0;overflow:auto;font-size:var(--fs-md)}
#fe-page .fe-md{overflow-wrap:break-word;max-width:none;margin:0;padding:28px 48px 80px;font-size:var(--fs-xl);line-height:var(--rd-lh,1.65)}
#fe.fe-column-xl #fe-page .fe-md{max-width:150ch;margin:0 auto}
#fe.fe-column-lg #fe-page .fe-md{max-width:130ch;margin:0 auto}
#fe.fe-column-md #fe-page .fe-md{max-width:110ch;margin:0 auto}
#fe-page .fe-md blockquote > .fe-md{padding:0;margin:0;max-width:none}
.fe-md-alert{--al:#4493f8;border-left:3px solid var(--al);padding:.6em 1em;border-radius:var(--r-xs);background:color-mix(in srgb,var(--al) 9%,transparent)}
.fe-md-alert>.fe-md-alert-title{font-weight:600;color:var(--al);margin:0 0 var(--sp-2)}
.fe-md-alert-tip{--al:#3fb950}.fe-md-alert-important{--al:#ab7df8}.fe-md-alert-warning{--al:#d29922}.fe-md-alert-caution{--al:#f85149}
#fe[data-theme="light"] .fe-md-alert{--al:#0969da}
#fe[data-theme="light"] .fe-md-alert-tip{--al:#1a7f37}#fe[data-theme="light"] .fe-md-alert-important{--al:#8250df}
#fe[data-theme="light"] .fe-md-alert-warning{--al:#9a6700}#fe[data-theme="light"] .fe-md-alert-caution{--al:#d1242f}
.fe-md-footnotes{border-top:1px solid var(--bd);margin-top:2em;padding-top:.8em;font-size:.88em;color:var(--mt)}
.fe-md-fnref a,.fe-md-fnback{text-decoration:none}
#fe-page .fe-md code,#fe-page .fe-md-pre,#fe-ql-body .fe-md code,#fe-ql-body .fe-md-pre,#fe-page .fe-code,#fe-ql-body .fe-code{font-size:calc(var(--rd-code,var(--fs-lg)) * var(--ui-text-scale,1))}
#fe.fe-notips #fe-tip{display:none}
#fe-fp-column:hover{border-color:var(--ac);color:var(--ac)}
.fe-crumb-file{color:var(--tx);font-weight:500}
#fe-fp-meta{font-size:var(--fs-sm);color:var(--dm);margin-right:auto;white-space:nowrap}
/* A text match sits on its own line under the title, inside the link, so the title keeps its width and the whole row opens the note. */
#fe-nt-list .fe-si-link:has(.fe-nt-hit){flex-wrap:wrap;row-gap:var(--sp-1)}
#fe-nt-list .fe-nt-hit{flex:1 0 100%;min-width:0;padding:0 0 var(--sp-1) var(--sp-8);font-size:var(--fs-sm);color:var(--dm);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
/* Editing in place: coloured, numbered source in the reading column. The
   painted copy (#fe-fe-paint) and the textarea share font, padding and
   wrapping exactly, so the caret sits over its own text. */
#fe-fe{flex:1;min-width:0;display:flex;flex-direction:column;min-height:0;position:relative}
#fe-fe-banner{border-bottom:1px solid var(--bd);background:var(--s1)}
#fe-fe-scroll{flex:1;min-height:0;overflow:auto;cursor:text}
/* The top padding clears the floating pill, so a long first line is never under it. */
#fe-fe-src{position:relative}
#fe-fe-src[hidden]{display:none}
#fe-fe-paint,#fe-fe-ta{margin:0;font-family:var(--mono);font-size:calc(var(--rd-code,var(--fs-lg)) * var(--ui-text-scale,1));line-height:1.7;
  white-space:pre-wrap;overflow-wrap:anywhere;tab-size:4;letter-spacing:0}
#fe-fe-paint{padding:0;color:var(--tx);pointer-events:none}
.fe-fe-row{display:grid;grid-template-columns:52px minmax(0,1fr)}
.fe-fe-ln{color:var(--dm);text-align:right;padding-right:var(--sp-6);user-select:none}
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
#fe-fe-pill{position:absolute;top:12px;right:18px;z-index:var(--z-sticky);display:flex;align-items:center;gap:var(--sp-1);padding:var(--sp-2);
  border-radius:var(--r-full)}
#fe-fe-state{display:inline-flex;align-items:center;gap:var(--sp-2);padding:0 var(--sp-4) 0 var(--sp-4);font-size:var(--fs-md);color:var(--mt);
  transition:color var(--t-fast) var(--ease)}
#fe-fe-state.saved{color:var(--green)}
#fe-fe-state.failed{color:var(--nc-red)}
#fe-fe-state.failed .fe-fe-dot{background:var(--nc-red)}
#fe-fe-state svg{width:13px;height:13px}
.fe-fe-dot{width:6px;height:6px;border-radius:50%;background:var(--ac)}
#fe-allow{position:fixed;width:340px;padding:var(--sp-5);animation:fe-pop var(--t-base) var(--ease)}
#fe-allow p{color:var(--mt);font-size:var(--fs-md);margin:var(--sp-3) 0 var(--sp-5);line-height:1.5}
#fe-allow code{font:var(--fs-md) var(--mono);background:var(--s2);padding:var(--sp-1) var(--sp-2);border-radius:var(--r-xs);overflow-wrap:anywhere}
.fe-allow-title{display:flex;align-items:center;gap:var(--sp-4);font-weight:600}
.fe-allow-acts{display:flex;gap:var(--sp-3);justify-content:flex-end}
#fe-allow.fe-allow-note{border-color:color-mix(in srgb,var(--nc-red) 50%,var(--bd2))}
#fe-fp-edit.busy{opacity:.6;cursor:progress}
@keyframes fe-pop{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}
/* The Keep card: a file's name, its Saved entry and, for a note, its pin and title. */
#fe-keep{position:fixed;width:min(320px,calc(100vw - 16px));padding:var(--sp-4);display:flex;flex-direction:column;gap:var(--sp-4);border-radius:var(--pop-r);color:var(--tx);
  background:var(--pop-bg);border:1px solid var(--pop-bd);box-shadow:var(--pop-sh);backdrop-filter:var(--pop-blur);-webkit-backdrop-filter:var(--pop-blur)}
#fe-keep.fe-rename{width:min(280px,calc(100vw - 16px))}
.fe-keep-f{display:flex;flex-direction:column;gap:var(--sp-2)}
.fe-keep-row{display:flex;gap:var(--sp-2);align-items:center}
.fe-keep-row input{flex:1;min-width:0}
.fe-keep-f input{width:100%}
.fe-keep-l{font-size:var(--fs-sm);color:var(--dm)}
.fe-keep-sec{display:flex;flex-direction:column;gap:var(--sp-3);padding-top:var(--sp-4);border-top:1px solid var(--bd)}
.fe-keep-h{display:flex;align-items:center;gap:var(--sp-3);font-size:var(--fs-md);color:var(--tx)}
.fe-keep-note{margin:0;font-size:var(--fs-sm);color:var(--dm);line-height:1.5}
.fe-keep-msg{margin:0;font-size:var(--fs-sm);color:var(--mt)}
.fe-keep-msg:empty{display:none}
#fe-fp-reload{animation:fe-fade-in var(--t-base) var(--ease);font-size:var(--fs-sm);color:var(--dm)}
#fe-ed-bar{border-bottom:1px solid var(--bd);background:var(--s2);flex-shrink:0;flex-wrap:wrap}
.fe-ed-hint{flex:1 1 0;min-width:0;text-align:right;overflow:hidden;text-overflow:ellipsis;font-size:var(--fs-sm);color:var(--dm);white-space:nowrap}
#fe-ed-hist{display:flex;flex-direction:column;gap:var(--sp-1);padding:var(--sp-3) var(--sp-4);border-bottom:1px solid var(--bd);background:var(--s2);max-height:180px;overflow:auto;flex-shrink:0;font-size:var(--fs-sm);color:var(--dm)}
.fe-hist-row{display:grid;grid-template-columns:minmax(120px,160px) 1fr auto;gap:var(--sp-4);align-items:baseline;text-align:left;background:none;border:1px solid transparent;border-radius:5px;padding:var(--sp-2) var(--sp-3);color:var(--tx);cursor:pointer;font:inherit}
.fe-hist-row code{color:var(--dm)}
.fe-hist-head{display:flex;gap:var(--sp-4);align-items:center;padding:var(--sp-4) var(--sp-5);border-bottom:1px solid var(--bd);color:var(--dm);font-size:var(--fs-sm)}
#fe-ql-body.fe-editing{display:flex;flex-direction:column}
.fe-ed{display:flex;flex:1;min-height:0}
#fe-ed-src{flex:1;min-width:0;resize:none;border:none;border-right:1px solid var(--bd);background:var(--s1);color:var(--tx);
  font:var(--fs-md)/1.6 var(--mono);padding:var(--sp-5) var(--sp-6);outline:none;tab-size:2}
#fe-ed-view{flex:1;min-width:0;overflow:auto}
#fe-qlook.side .fe-ed{flex-direction:column}
#fe-qlook.side #fe-ed-src{border-right:none;border-bottom:1px solid var(--bd);min-height:40%}
#fe-ed-conflict{display:flex;align-items:center;gap:var(--sp-4);padding:var(--sp-4) var(--sp-5);border-bottom:1px solid var(--bd)}
#fe-ed-meta{display:flex;align-items:center;gap:var(--sp-3);padding:var(--sp-4) var(--sp-4);border-bottom:1px solid var(--bd);background:var(--s1);flex-shrink:0;flex-wrap:wrap}
/* The note's title reads as a heading on the chip row; hover shows it can be
   edited, and the edit box opens with the same font and padding so nothing jumps. */
.fe-chip-title{flex:1 1 180px;min-width:120px;min-height:var(--ctl-md);padding:var(--sp-1) var(--sp-3);border:1px solid transparent;border-radius:var(--r-sm);font:inherit;font-size:var(--fs-lg);font-weight:600;line-height:1.35;color:var(--tx)}
button.fe-chip-title{display:flex;align-items:center;gap:var(--sp-3);background:none;text-align:left;cursor:text;min-width:0}
button.fe-chip-title:hover{background:var(--hover)}
button.fe-chip-title:focus-visible{outline:2px solid var(--ac);outline-offset:1px}
button.fe-chip-title svg{flex:none;width:12px;height:12px;color:var(--dm);opacity:0;transition:opacity var(--t-fast) var(--ease)}
button.fe-chip-title:hover svg,button.fe-chip-title:focus-visible svg{opacity:1}
button.fe-chip-title.untitled{color:var(--dm);font-weight:400;font-style:italic}
textarea.fe-chip-title{resize:none;overflow:hidden;box-sizing:border-box;padding:var(--sp-1) var(--sp-3);background:var(--s2);border-color:var(--ac);outline:none}
.fe-cdot{flex:none}
.fe-pmenu{position:fixed;width:250px;padding:var(--sp-4);display:flex;flex-direction:column;gap:var(--sp-3)}
.fe-pmenu .btn{justify-content:flex-start}
.fe-pm-lbl{font-size:var(--fs-sm);color:var(--mt);text-transform:uppercase;letter-spacing:.04em}
.fe-pm-colors{display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-2)}
.fe-pm-tags{display:flex;flex-wrap:wrap;gap:var(--sp-2)}
.fe-pm-add{display:flex;gap:var(--sp-2)}
.fe-pm-add input{flex:1;min-width:0}

.fe-mid{display:flex;min-width:0;max-width:100%;overflow:hidden}
.fe-mid-h{overflow:hidden;text-overflow:ellipsis;white-space:pre;min-width:0}
.fe-mid-t{white-space:pre;flex:none}
.fe-nt-label{flex:none;display:flex;min-width:0;white-space:nowrap;overflow:hidden;line-height:1.3}
.fe-nt-label.editing{display:block;white-space:normal;overflow:visible;overflow-wrap:anywhere}
.fe-nt-item:hover .fe-nt-acts,.fe-nt-item:focus-within .fe-nt-acts{opacity:1;pointer-events:auto}
.fe-nt-tags span{display:inline-flex;align-items:center;gap:var(--sp-2)}
.fe-nt-tags svg{width:10px;height:10px;flex:none}
.fe-nt-flags{display:inline-flex;align-items:center;gap:var(--sp-2);flex:none}
.fe-nt-flags svg{width:12px;height:12px}
.fe-nt-pin{color:var(--gold)}
.fe-nt-props{opacity:0;flex:none}
.fe-nt-item:hover .fe-nt-props,.fe-nt-props:focus-visible{opacity:1}

.fe-nt-tab{opacity:0;flex:none}
.fe-nt-item:hover .fe-nt-tab,.fe-nt-tab:focus-visible{opacity:1}

.fe-sh a{color:inherit;text-decoration:none}
.fe-sh a:hover{color:var(--ac)}
#fe-ql-hdr{border-bottom:1px solid var(--bd);flex-shrink:0}
#fe-ql-icon svg{display:block}
/* Docked, the header keeps its name readable and its close button inside the panel: buttons go icon-only. */
#fe-qlook.side #fe-ql-hdr > button > span,#fe-qlook.side #fe-ql-hdr > a:not(#fe-ql-name) > span{display:none}

/* Docked, the header's labelled buttons lose their labels and become icon circles. */
#fe-qlook.side #fe-ql-hdr > *{flex-shrink:0}
#fe-qlook.side #fe-ql-name,#fe-qlook.side #fe-ql-meta{flex-shrink:1;min-width:0}
#fe-qlook.side #fe-ed-bar > button > span{display:none}
#fe-qlook.side .fe-ed-hint{display:none}
#fe-ql-name:hover{color:var(--ac);text-decoration:underline}
#fe-ql-meta{font-size:var(--fs-sm);color:var(--dm);flex:1;white-space:nowrap;min-width:0;overflow:hidden;text-overflow:ellipsis}
#fe-ql-name{font-weight:600;font-size:var(--fs-lg);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:inherit;text-decoration:none;min-width:0;flex-shrink:1}
#fe-ql-body{flex:1;overflow:auto;font-size:var(--fs-md)}
#fe-ql-body:has(> .fe-ql-htmlbar){display:flex;flex-direction:column}
.fe-ql-htmlbar{border-bottom:1px solid var(--bd);flex:none}
.fe-ql-html{flex:1;min-height:0;width:100%;border:0;background:rgb(var(--paper))}
/* The preview panel reads at the same reader sizes as the file page; dialogs keep the base size. */
#fe-ql-body .fe-md{font-size:var(--fs-xl);line-height:var(--rd-lh,1.65)}
#fe-ql-ai{display:flex;flex-wrap:wrap;align-items:center;gap:var(--sp-3);padding:var(--sp-4) var(--sp-5);
  border-bottom:1px solid var(--bd);background:var(--s2);flex-shrink:0}
#fe-ql-ai-chip{display:flex;align-items:center;gap:var(--sp-2);font-size:var(--fs-sm);color:var(--dm);
  margin-right:var(--sp-2);white-space:nowrap}
#fe-ql-ai-chip .dot{width:7px;height:7px;border-radius:50%;background:var(--dm);flex-shrink:0}
#fe-ql-ai-chip.ready .dot{background:var(--green)}
#fe-ql-ai-chip.cold .dot{background:var(--gold)}
#fe-ql-ai-chip.down .dot{background:var(--danger)}
#fe-ql-ai-q{flex:1;min-width:140px}

#fe-ql-ai-q:disabled{opacity:.45}

#fe-ql-ai-out{border-bottom:1px solid var(--bd);max-height:42%;overflow-y:auto;flex-shrink:0;background:var(--s1)}
#fe-ql-ai-out-body{padding:var(--sp-4) var(--sp-6) var(--sp-2);font-size:var(--fs-md);line-height:1.6;white-space:pre-wrap}
#fe-ql-ai-out-body .fe-md{padding:0;white-space:normal}
#fe-ql-ai-out-meta{padding:var(--sp-1) var(--sp-6) var(--sp-4);font-size:var(--fs-xs);color:var(--dm)}
.fe-ql-center{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:var(--sp-4)}
.fe-ql-imgwrap{display:flex;flex-direction:column;height:100%}
.fe-ql-imgbar{border-bottom:1px solid var(--bd);background:var(--s2);flex-shrink:0;flex-wrap:wrap}
.fe-ql-imgstage{flex:1;min-height:0;overflow:auto;display:flex}
.fe-ql-imgsizer{position:relative;margin:auto;flex:none}
.fe-ql-img{position:absolute;left:50%;top:50%;max-width:none;max-height:none;border-radius:var(--r-xs);transform-origin:center}
.fe-ql-imgwrap .fe-ql-dim{padding:var(--sp-2) var(--sp-5);border-top:1px solid var(--bd);text-align:center;flex-shrink:0}
.fe-ql-dim{font-size:var(--fs-sm);color:var(--dm);font-variant-numeric:tabular-nums}
.fe-ql-pdf{width:100%;height:100%;border:none}
.fe-ql-media-wrap{display:flex;align-items:center;justify-content:center;height:100%;padding:var(--sp-6)}
.fe-ql-media{max-width:100%;max-height:100%;border-radius:var(--r-xs);background:rgb(var(--ink))}
.fe-ql-center audio{width:min(480px,90%)}
.fe-ql-font{padding:var(--sp-7) 26px;overflow:auto;line-height:1.5}
.fe-ql-font>div{margin:var(--sp-3) 0;word-break:break-word;border-bottom:1px solid var(--s2);padding-bottom:var(--sp-3);font-size:var(--fs)}
.fe-code-wrap{font:var(--fs-md)/1.55 var(--mono);min-height:100%}
.fe-code{padding:var(--sp-4) var(--sp-5) var(--sp-5) 0;width:max-content;min-width:100%}
.fe-cl-blk{content-visibility:auto;contain-intrinsic-size:auto calc(var(--n) * 1.55em)}
.fe-cl{display:grid;grid-template-columns:calc(var(--gut,4ch) + 22px) minmax(0,1fr)}
.fe-cl-n{position:sticky;left:0;padding:0 var(--sp-4) 0 var(--sp-5);text-align:right;color:var(--dm);user-select:none;background:var(--card)}
.fe-cl-t{white-space:pre;padding-left:var(--sp-4)}
/* Wrap (Settings, and the file bar toggle): long lines fold inside the page. */
#fe[data-wrap="on"] .fe-code{width:auto}
#fe[data-wrap="on"] .fe-cl-t{white-space:pre-wrap;overflow-wrap:anywhere}
.tok-cmt{color:var(--mt);font-style:italic}
.tok-str{color:var(--syn-str)}
.tok-kw,.tok-kw-ctrl{color:var(--syn-kw)}
.tok-type{color:var(--syn-type)}
.tok-builtin{color:var(--syn-builtin)}
.tok-lit{color:var(--syn-lit)}
.tok-num{color:var(--syn-num)}
.tok-var{color:var(--syn-var)}
.tok-deco{color:var(--syn-deco)}
.tok-fn{color:var(--syn-fn)}.tok-regex{color:var(--syn-regex)}
.tok-key{color:var(--syn-key)}.tok-section{color:var(--syn-section)}
.tok-add{color:var(--syn-add)}.tok-del{color:var(--syn-del)}
.fe-ql-table{border-collapse:collapse;width:100%;font:var(--fs-md) var(--mono)}
.fe-ql-table th{position:sticky;top:0;background:var(--s2);padding:var(--sp-3) var(--sp-4);text-align:left;
  border-bottom:1px solid var(--bd);cursor:pointer;white-space:nowrap;color:var(--mt);font-weight:600;z-index:1}
.fe-ql-table th:hover{color:var(--tx)}
.fe-ql-table th.sorted{color:var(--ac)}
.fe-ql-table td{padding:var(--sp-2) var(--sp-4);border-bottom:1px solid var(--s2);white-space:pre;
  max-width:340px;overflow:hidden;text-overflow:ellipsis}
.fe-ql-table th.num,.fe-ql-table td.num{text-align:right;font-variant-numeric:tabular-nums}
.fe-ql-table tbody tr:hover{background:var(--hover)}
.fe-jt-root,.fe-jl-root{padding:var(--sp-4) var(--sp-5);font:var(--fs-md)/1.6 var(--mono)}
.fe-jt summary,.fe-jl-line summary{cursor:pointer;list-style:none}
.fe-jt summary::-webkit-details-marker,.fe-jl-line summary::-webkit-details-marker{display:none}
.fe-jt summary svg,.fe-jl-line summary svg{color:var(--dm);vertical-align:-2px}
.fe-jt summary svg{margin-right:var(--sp-2)}
.fe-jt summary:hover{background:var(--hover)}
.fe-jt-kids{padding-left:var(--sp-6);border-left:1px solid var(--s3);margin-left:var(--sp-2)}
.fe-jt-key{color:var(--syn-key)}
.fe-jt-colon{color:var(--dm)}
.fe-jt-badge{color:var(--dm);font-size:var(--fs-sm)}
.fe-jt-row{padding-left:var(--sp-5)}
.fe-jl-line{border-bottom:1px solid var(--s2);padding:var(--sp-1) 0}
.fe-jl-line summary{display:flex;gap:var(--sp-4);align-items:baseline}
.fe-jl-n{color:var(--dm);min-width:28px;text-align:right;user-select:none;font-size:var(--fs-sm);flex-shrink:0}
.fe-jl-prev{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--mt)}
.fe-jl-line.bad{display:flex;gap:var(--sp-4);align-items:baseline}
.fe-jl-err{color:var(--danger);font-size:var(--fs-xs);border:1px solid color-mix(in srgb,var(--danger) calc(64% / 2.55),transparent);border-radius:3px;padding:0 var(--sp-2);flex-shrink:0}
.fe-md{padding:var(--sp-5) 22px var(--sp-7);font-size:var(--fs-lg);line-height:1.65;max-width:760px;color:var(--tx)}
/* Reading rhythm: every block owns the space below it, in em, so one scale
   holds in the file page, preview, notes, dialogs and AI answers alike. */
.fe-md>*,.fe-md-alert>*,.fe-md blockquote>*{margin:0 0 .9em}
.fe-md>:last-child,.fe-md-alert>:last-child,.fe-md blockquote>:last-child{margin-bottom:0}
.fe-md h1,.fe-md h2,.fe-md h3,.fe-md h4,.fe-md h5,.fe-md h6{font-family:var(--font-head);font-weight:600;line-height:1.3;margin:1.6em 0 .5em;color:var(--tx)}
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
.fe-md code{background:var(--s2);border:0;padding:.12em .4em;border-radius:var(--r-xs);font-family:var(--mono);font-size:.86em}
.fe-md a code{color:inherit}
.fe-md-code-bar{justify-content:space-between;padding:var(--sp-2) var(--sp-3) 0 var(--sp-5);background:none}
.fe-md-lang{font:600 var(--fs-sm)/1 var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--dm)}
.fe-md-pre{background:var(--s1);border:1px solid var(--bd);border-radius:var(--r-sm);padding:.75em 1em;
  overflow-x:auto;font-family:var(--mono);font-size:.86em;line-height:1.55;white-space:pre;color:var(--tx)}
.fe-md-code .fe-md-pre{border:none;border-radius:0;margin:0;padding-top:.4em;background:none}
.fe-md-code{border:1px solid var(--bd);border-radius:var(--row-r);overflow:hidden;background:color-mix(in srgb,var(--s1),rgb(var(--ink)) 6%)}
.fe-md-lines{counter-reset:ln;padding-left:.2em}
.fe-md-l{display:block;width:max-content;min-width:100%;box-sizing:border-box;padding-right:1em;border-radius:3px;counter-increment:ln}
.fe-md-l::before{content:counter(ln);display:inline-block;width:2.2em;margin-right:1em;text-align:right;color:var(--dm);opacity:.6;user-select:none}
.fe-md-l:hover{background:color-mix(in srgb,var(--tx) 6%,transparent)}
.fe-md-mermaid{padding:var(--sp-5);border:1px solid var(--bd);border-radius:var(--r-sm);
  background:var(--s1);overflow-x:auto;text-align:center}
.fe-md-mermaid svg{display:block;max-width:100%;height:auto;margin:auto}
.fe-md-mermaid-source[hidden]{display:none}
.fe-md-mermaid-source{margin:var(--sp-4) 0 0;padding:var(--sp-4);text-align:left;white-space:pre-wrap;
  background:var(--s2);border-radius:var(--r-xs);font:var(--fs-md)/1.55 var(--mono)}
.fe-md-anchor{margin-left:var(--sp-4);color:var(--dm);font-weight:400;text-decoration:none;opacity:0;transition:opacity var(--t-fast)}
.fe-md-anchor::before{content:'#'}
.fe-md h1:hover .fe-md-anchor,.fe-md h2:hover .fe-md-anchor,.fe-md h3:hover .fe-md-anchor,.fe-md h4:hover .fe-md-anchor,.fe-md h5:hover .fe-md-anchor,.fe-md h6:hover .fe-md-anchor{opacity:1}
.fe-md-fm{display:grid;grid-template-columns:max-content 1fr;gap:var(--sp-2) var(--sp-5);padding:var(--sp-4) var(--sp-5);background:var(--s1);border:1px solid var(--bd);border-radius:var(--r-sm);font-size:var(--fs-md)}
.fe-md-fm dt{color:var(--dm);font-weight:600}
.fe-md-fm dd{margin:0;color:var(--tx)}
.fe-md-fm-warn{grid-column:1/-1;display:flex;flex-direction:column;align-items:flex-start;gap:var(--sp-1);margin-top:var(--sp-2);padding:var(--sp-2) 0 0;border-top:1px solid var(--bd)}
.fe-md-fm-note{font-size:var(--fs-sm);color:var(--dm)}
.fe-fm-items{display:flex;flex-wrap:wrap;gap:var(--sp-1) var(--sp-3)}
a.fe-fm-path{color:var(--ac);text-decoration:none}
a.fe-fm-path:hover{text-decoration:underline}
.fe-md li.fe-task{list-style:none;margin-left:-1.3em;padding-left:0}
.fe-md li.fe-task input{accent-color:var(--ac);margin-right:var(--sp-3);vertical-align:-2px}
.fe-md-tablewrap{overflow-x:auto}
/* A directions doc: one tone per state mark, on the row's edge, the meters and the filter chips. */
[data-state="needs"]{--st:var(--nc-red)}
[data-state="waiting"]{--st:var(--nc-orange)}
[data-state="ready"]{--st:var(--nc-green)}
[data-state="parked"]{--st:var(--dm)}
[data-state="done"]{--st:var(--nc-teal)}
/* A decision page's items: as drafted is quiet, a changed answer gold, a note the accent. */
[data-state="drafted"]{--st:var(--bd2)}
[data-state="changed"]{--st:var(--gold)}
[data-state="noted"]{--st:var(--ac)}
.fe-md[data-directions] tr[data-state] td:first-child{box-shadow:inset 3px 0 0 var(--st)}
.fe-dir-sum{display:flex;flex-wrap:wrap;align-items:center;gap:var(--sp-3);margin:var(--sp-4) 0 var(--sp-6)}
.fe-dir-total{margin-left:var(--sp-3)}
.fe-md>p.fe-dir-meta{font-size:var(--fs-sm);color:var(--dm)}
/* The doc-view kit: state pills, filter chips and meters share one tone per state (--st). */
.fe-dv-pill{--chip:var(--st);--dot:var(--st);white-space:nowrap}
.fe-dv-chip{--dot:var(--st)}
.fe-dv-chip b{font-weight:600}
.fe-dv-chip[aria-pressed="true"]{border-color:var(--st);background:color-mix(in srgb,var(--st) 16%,transparent)}
.fe-dv-meter{display:inline-flex;align-items:center;gap:var(--sp-2);margin-left:var(--sp-4);vertical-align:middle;font-size:var(--fs-sm);font-weight:400;color:var(--mt)}
.fe-dv-bar{display:inline-flex;width:7em;height:.45em;border-radius:var(--r-full);overflow:hidden;background:var(--s2)}
.fe-dv-bar i{flex:1;background:var(--st)}
.fe-dv-meter-n:empty{display:none}
.fe-dv-clamp-in{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:var(--lines,3);overflow:hidden}
.fe-dv-clamp.open>.fe-dv-clamp-in{display:block}
.fe-dv-more{margin-top:var(--sp-1);color:var(--ac)}
.fe-md img{display:block;margin-left:auto;margin-right:auto;cursor:zoom-in;max-width:100%;border-radius:var(--r-sm)}
.fe-md blockquote{border-left:3px solid var(--bd2);padding:0 1em;color:var(--mt)}
.fe-md blockquote .fe-md{padding:0}
.fe-md a{color:var(--ac);text-decoration:none}
.fe-md a:hover{text-decoration:underline}
.fe-md hr{border:none;border-top:1px solid var(--bd);margin:1.6em 0}
.fe-md strong{font-weight:600}
.fe-md-table{border-collapse:separate;border-spacing:0;margin:0;font-size:.93em;border:1px solid var(--bd);border-radius:var(--r-sm);overflow:hidden}
.fe-md-table th,.fe-md-table td{border:0;border-bottom:1px solid var(--bd);padding:.55em .9em;text-align:left;vertical-align:top}
.fe-md-table tbody tr:last-child td{border-bottom:0}
.fe-md-table thead{position:static;background:none}
.fe-md-table thead th{background:color-mix(in srgb,var(--s1),var(--tx) 5%);font-weight:600;font-size:inherit;letter-spacing:0;text-transform:none;color:var(--tx);
  white-space:normal;user-select:text;padding:.55em .9em}
#fe-ctx,.fe-ctx{position:fixed;min-width:180px}
.fe-ctx:not([data-layer]){display:none}
.fe-ctx-item{display:flex;align-items:center;color:var(--tx);cursor:pointer;white-space:nowrap}
.fe-ctx-key{margin-left:auto;color:var(--dm);font-size:var(--fs-xs);padding-left:var(--sp-6)}
.fe-tab-ico svg{width:15px;height:16px}
.fe-tab-x,.fe-tab-more{opacity:.6}
.fe-tab:focus-visible,.fe-tab-x:focus-visible,.fe-tab-more:focus-visible{outline:2px solid var(--mt);outline-offset:-2px}
@media (max-width:720px){
  #fe-side{width:clamp(200px,26vw,240px)}
  #fe-toc-rail{width:clamp(150px,22vw,190px)}
  #fe-ff-q{width:110px}
  #fe-page .fe-md{padding:var(--sp-7) 18px 60px}
  #fe-fp-bar{flex-wrap:wrap}
}
@container fe-main (max-width:720px){
  #fe-toolbar{flex-wrap:wrap}
  #fe-count{flex-basis:100%}
  #fe-tb-right{width:100%;flex-wrap:wrap;justify-content:flex-start}
}
/* Soft (design-system.md): the sidebar, the main pane and a docked preview
   float as cards on the page background; rows are 36px with no lines, and
   selection is a wash with rounded ends, never a ring. The sidebar's resize
   handle is the 10px gutter between cards and shows a thin line on hover. */
#fe-body{display:flex;flex:1;overflow:hidden;padding:var(--sp-4);background:var(--bg)}
#fe-side,#fe-main,#fe-qlook.side{border:1px solid var(--bd);border-radius:var(--pop-r);overflow:hidden}
/* The page is the lightest surface, the sidebar one step below it, and the
   page background the deepest; bars inside the page share its colour and are
   set apart by a hairline, not a grey band. */
#fe-side{position:relative;width:272px;flex-shrink:0;border-right:1px solid var(--bd);display:flex;flex-direction:column;min-height:0;overflow:hidden;background:var(--side)}
#fe-main,#fe-toolbar,#fe-fp-bar,#fe-statusbar,thead{background:var(--card)}
#fe-tabbar,#fe-tabs{background:var(--side)}
.fe-tab.on{color:var(--tx);background:var(--card)}
#fe-table{width:100%;table-layout:fixed;border-collapse:separate;border-spacing:0}
#fe-table tbody tr{border-bottom:0}
#fe-table tbody tr:hover{background:none}
#fe-table tbody tr:hover td{background:var(--hover)}
#fe-table tbody tr.selected td{background:var(--on)}
#fe-table tbody td{height:36px}
#fe.compact #fe-table tbody td{height:var(--ctl-md)}
/* Row height per detail level; it wins over Compact, which only sets level 3. */
#fe[data-density="1"] #fe-table tbody td{height:52px}
#fe[data-density="2"] #fe-table tbody td{height:44px}
#fe[data-density="4"] #fe-table tbody td{height:var(--ctl-md)}
#fe[data-density="5"] #fe-table tbody td{height:23px}
#fe-table tbody td:first-child{border-radius:var(--row-r) 0 0 var(--row-r)}
#fe-table tbody td:last-child{border-radius:0 var(--row-r) var(--row-r) 0}
#fe-scroll{flex:1;overflow-y:auto;transform-origin:top left;padding:0 var(--sp-3)}
.fe-row.selected .fe-nm{color:var(--tx)}
.fe-tile.selected{background:var(--on);border-color:transparent}

/* One row and one floating surface. Every list row (Places, Saved, Notes,
   History, the path menu, context menus) shares a height, inset, corner,
   icon size, text size and hover wash; in the sidebar a row sits 6px in from
   the card edge, in a menu the menu's own 6px padding gives the same inset.
   Every popover, menu, tip and the Contents card share one surface. Notes
   rows grow to fit a tag line but keep the inset and corners. */
:root{--bg:#0f1316;--s1:#151b1f;--s2:#1c2328;--s3:#253039;--bd:#243038;--bd2:#34434d;--tx:#e7eef1;--mt:#a3b2ba;--dm:#7f9099;--ac:#3cc6c0;--tx-on-ac:#0f1316;--dir:#a3b2ba;--shade:rgb(139 148 158 / .14);--shade2:rgb(139 148 158 / .24);--gold:#d29922;--green:#3fb950;--hover:color-mix(in srgb,var(--tx) 6%,transparent);--on:color-mix(in srgb,var(--ac) 18%,transparent);--r-sm:6px;--card:color-mix(in srgb,var(--s1),var(--s2) 62%);--side:var(--s1);--t-fast:120ms;--t-base:180ms;--t-slow:260ms;--ease:cubic-bezier(.2,.8,.2,1);--mono:'SF Mono',Menlo,Consolas,monospace;--font-text:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;--font-head:var(--font-text);--nc-red:#ff6b6b;--nc-orange:#ffa94d;--nc-yellow:#ffd43b;--nc-green:#51cf66;--nc-teal:#38d9a9;--nc-blue:#4dabf7;--nc-purple:#b197fc;--nc-pink:#f783ac;--fs-xs:calc(10px * var(--ui-text-scale,1));--fs-sm:calc(11px * var(--ui-text-scale,1));--fs-md:calc(12px * var(--ui-text-scale,1));--fs-lg:calc(13px * var(--ui-text-scale,1));--fs-xl:calc(15px * var(--ui-text-scale,1));--row-h:32px;--row-r:8px;--row-px:10px;--row-gap:var(--sp-4);--row-ic:16px;--row-fs:var(--fs-lg);--pop-r:12px;--pop-pad:6px;--pop-bg:color-mix(in srgb,var(--card) 90%,transparent);--pop-bd:var(--bd2);--pop-sh:0 12px 32px rgb(var(--ink) / .34),0 1px 3px rgb(var(--ink) / .2);--pop-blur:blur(16px) saturate(1.2)}
#fe[data-theme="light"],html:has(#fe[data-theme="light"]){--pop-bg:color-mix(in srgb,var(--card) 94%,transparent);--pop-bd:var(--bd);
  --syn-str:#0a7d33;--syn-kw:#cf222e;--syn-type:#1b7c83;--syn-builtin:#953800;--syn-lit:#8250df;--syn-num:#9a6700;--syn-var:#8250df;
  --syn-deco:#9a6700;--syn-fn:#8250df;--syn-regex:#116329;--syn-key:#0550ae;--syn-section:#8250df;--syn-add:#1a7f37;--syn-del:#cf222e;
  --pop-sh:0 10px 28px rgb(16 24 32 / .12),0 1px 3px rgb(16 24 32 / .08)}
/* The component system's scales (docs/plan/component-system.md, sections 4
   and 5). Declared on #fe too, so tokens built from palette colours pick up
   the light theme's values rather than the root's. */
:root,#fe{
  --sp-1:2px;--sp-2:4px;--sp-3:6px;--sp-4:8px;--sp-5:12px;--sp-6:16px;--sp-7:20px;--sp-8:24px;--sp-9:32px;
  --ctl-xs:18px;--ctl-sm:22px;--ctl-md:28px;--ctl-lg:32px;--bar-h:40px;
  --r-xs:4px;--r-full:999px;
  --z-sticky:5;--z-panel:30;--z-popover:300;--z-overlay:400;--z-command:500;--z-toast:600;--z-tip:700;--z-step:10;
  --t-flash:1s;--t-pulse:1.6s;--t-off:1ms;
  /* Shadow and scrim ink, plain white, and a few fixed colours: the danger red, text on gold, the theme thumbnails. */
  --ink:0 0 0;--paper:255 255 255;--danger:#f85149;--tx-on-gold:#0d1117;--thumb-dark:#1c2328;--thumb-dark-2:#131a1e;--thumb-light:#f4f6f8;--thumb-light-2:#e2e7eb;
  /* Syntax colours; the light theme sets its own below. */
  --syn-str:#7ee787;--syn-kw:#ff7b72;--syn-type:#56d4dd;--syn-builtin:#ffa657;--syn-lit:#a5d6ff;--syn-num:#f2cc60;--syn-var:#d2a8ff;
  --syn-deco:#e2b340;--syn-fn:#d2a8ff;--syn-regex:#a5d6a7;--syn-key:#79c0ff;--syn-section:#d2a8ff;--syn-add:#3fb950;--syn-del:#f85149;
  --tone-ok:var(--nc-green);--tone-warn:var(--nc-orange);--tone-danger:var(--nc-red);--tone-info:var(--nc-blue);
  --type-micro:var(--fs-sm);--type-small:var(--fs-md);--type-ui:var(--fs-lg);--type-ui-strong:var(--fs-lg);--type-title:var(--fs-xl)}
/* While a page boots nothing eases in: the first frames show it settled (main.ts drops data-booting two frames in). */
#fe[data-booting]{--t-fast:0ms;--t-base:0ms;--t-slow:0ms}
.fe-si,.fe-bm-item,.fe-dd-item,.fe-ctx-item{min-height:var(--row-h);margin:0 var(--sp-3);padding:0 var(--row-px);gap:var(--row-gap);
  border-radius:var(--row-r);font-size:var(--row-fs);transition:background var(--t-fast) var(--ease),color var(--t-fast) var(--ease)}
.fe-dd-item,.fe-ctx-item{margin:0}
button.fe-si{border:0;background:none;font:inherit;text-align:left;cursor:pointer;width:auto;display:flex}
.fe-si > svg,.fe-si-link > svg,.fe-dd-item > svg,.fe-ctx-item > svg{width:var(--row-ic);height:var(--row-ic);flex:none}
.fe-sl{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;flex:1;font-size:var(--row-fs)}
.fe-si-link{display:flex;align-items:center;flex:1;color:inherit;text-decoration:none;min-width:0;transition:color var(--t-fast);padding:0;gap:var(--row-gap);min-height:var(--row-h)}
.fe-nt-item .fe-si-link{padding-left:var(--sp-5);padding:var(--sp-3) 0}
.fe-pl-item .fe-drag-h,.fe-nt-item .fe-drag-h{position:absolute;left:-7px;top:0;bottom:0;padding:0;width:8px;justify-content:center}

/* A note row's actions float over the end of the title on a solid fade, so
   nothing moves under the pointer on hover. In a narrow sidebar only delete
   shows; colour and open-in-tab stay in the right-click menu. */
.fe-nt-item .fe-nt-acts{position:absolute;top:50%;transform:translateY(-50%);display:flex;align-items:center;opacity:0;pointer-events:none;transition:opacity var(--t-fast);right:4px;border-radius:0 var(--row-r) var(--row-r) 0;padding-left:var(--sp-5);--fade:var(--hover);background:linear-gradient(to right,transparent,var(--fade) 14px),linear-gradient(to right,transparent,var(--side) 14px)}
.fe-nt-item:has(> .fe-si-link.active) .fe-nt-acts{--fade:var(--on)}
.fe-nt-item:has(.editing) .fe-nt-acts{display:none}

#fe-lenses{flex:1;min-width:0;overflow-y:auto;padding:var(--sp-3) 0;container:lens/inline-size}
@container lens (max-width:200px){.fe-nt-props,.fe-nt-tab{display:none}}
/* A tag group is a plain section: one header row (chevron, colour, name,
   count) at the row inset, and its rows exactly like every other row. */
.fe-grp{margin:var(--sp-3) 0 0;padding:0;background:none;border-radius:0}
.fe-grp:not([open]){padding-bottom:0;padding:0}
.fe-grp .fe-bm-item{margin:0 var(--sp-3)}
.fe-grp > summary{list-style:none;cursor:pointer;min-height:var(--ctl-md);margin:0 var(--sp-3);padding:0 var(--row-px);border-radius:var(--row-r);gap:var(--sp-4);font-size:var(--fs-sm);letter-spacing:.06em;transition:background var(--t-fast) var(--ease),color var(--t-fast) var(--ease)}
.fe-grp > summary:hover{background:var(--hover);color:var(--tx)}
.fe-grp > summary svg{width:12px;height:12px;opacity:.8}
.fe-sh{padding:var(--sp-4) var(--sp-6) var(--sp-2)}
.fe-hint{font-size:var(--fs-md);color:var(--dm);font-style:italic;line-height:1.7;padding:var(--sp-3) var(--sp-6)}
.fe-lens-tags{display:flex;flex-wrap:wrap;gap:var(--sp-2);padding:0 var(--sp-3) var(--sp-4)}
/* Saved and Notes: the lens's own buttons, icon only, left of one search
   box that carries a Names/Deep switch; the tag chips scroll in a row below. */
.fe-lens-tools{padding:var(--sp-1) var(--sp-3) var(--sp-4)}
.fe-lens-ib{flex:none}

a.fe-lens-ib:not([href]){opacity:.45;pointer-events:none}
.fe-lens-box{position:relative;flex:1;min-width:0;margin-left:var(--sp-2)}
.fe-lens-box #fe-lens-filter{width:100%;margin:0;padding-right:64px}
.fe-lens-depth{position:absolute;right:4px;top:50%;transform:translateY(-50%)}
#fe-lens-tags{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none}
#fe-lens-tags .fe-lens-tag{flex:none;white-space:nowrap}
/* A saved row is one quiet line: the name, then a tag count that gives way to
   the row's icon buttons on hover. Path and tags live in the hover card. */
.fe-pl-meta{display:inline-flex;align-items:center;gap:var(--sp-1);margin-left:auto;padding-right:var(--sp-1);flex:none;font-size:var(--fs-xs);color:var(--dm)}
.fe-pl-meta svg{width:11px;height:11px;opacity:1}
.fe-pl-item:hover .fe-pl-meta,.fe-pl-item:focus-within .fe-pl-meta{display:none}
.fe-pl-item .fe-tag-btn,.fe-pl-item .fe-rm-btn{opacity:1}
.fe-pl-item:not(:hover):not(:focus-within) .fe-tag-btn,.fe-pl-item:not(:hover):not(:focus-within) .fe-rm-btn{display:none}

.fe-pl-item:has(.fe-pl-hit){flex-wrap:wrap}
.fe-pl-hit{flex-basis:100%;padding:0 0 var(--sp-2) 29px;margin-top:-4px;font-size:var(--fs-sm);color:var(--dm);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#fe-sv-card{position:fixed;z-index:var(--z-popover);pointer-events:none;width:230px;padding:var(--sp-4) var(--sp-4);display:flex;flex-direction:column;gap:var(--sp-2);border:1px solid var(--pop-bd);border-radius:10px;
  background:var(--pop-bg);box-shadow:var(--pop-sh);backdrop-filter:var(--pop-blur);-webkit-backdrop-filter:var(--pop-blur);font-size:var(--fs-sm);color:var(--mt);line-height:1.45;animation:fe-rise var(--t-fast) var(--ease)}
#fe-sv-card[hidden]{display:none}
#fe-sv-card b{color:var(--tx);font-size:var(--fs-md);font-weight:600;overflow-wrap:anywhere}
.fe-svc-path{overflow-wrap:anywhere}
.fe-svc-tags{display:flex;flex-wrap:wrap;gap:var(--sp-2);padding-top:var(--sp-1)}
.fe-svc-hint{color:var(--dm);font-size:var(--fs-xs)}
/* A note row: a colour bar and tinted icon for a coloured note, the title with
   its tags as small chips beneath, and the pin in the end slot until hover. */
.fe-nt-item.coloured::before{content:'';position:absolute;left:0;top:7px;bottom:7px;width:3px;border-radius:2px;background:var(--c)}
.fe-nt-item.coloured .fe-si-link > svg{color:var(--c);opacity:1}
.fe-nt-item.two .fe-si-link{align-items:flex-start}
.fe-nt-item.two .fe-si-link > svg{margin-top:var(--sp-1)}
.fe-nt-main{display:flex;flex-direction:column;min-width:0;flex:1 1 0;gap:var(--sp-2)}
.fe-nt-tags{font-size:var(--fs-sm);color:var(--mt);display:flex;gap:var(--sp-2);flex-wrap:nowrap;overflow:hidden}
.fe-nt-tag{display:inline-flex;align-items:center;gap:var(--sp-2);height:17px;padding:0 var(--sp-3);border:1px solid var(--bd2);border-radius:var(--r-full);font-size:var(--fs-xs);color:var(--mt);white-space:nowrap;flex:none}
.fe-nt-tag i{width:6px;height:6px;border-radius:50%;flex:none;background:var(--dot)}
.fe-nt-item .fe-nt-pin{display:inline-flex;margin-left:auto;padding-right:var(--sp-2);color:var(--gold);flex:none}
.fe-nt-item .fe-nt-pin svg{width:12px;height:12px;opacity:1}
.fe-nt-item:hover .fe-nt-pin,.fe-nt-item:focus-within .fe-nt-pin{visibility:hidden}

.fe-nt-grp{gap:var(--sp-4);width:calc(100% - 12px);height:26px;margin:var(--sp-4) var(--sp-3) var(--sp-1);padding:0 var(--row-px);border:0;border-radius:var(--row-r);background:none;cursor:pointer;
  font-family:inherit;text-align:left}
.fe-nt-grp:first-child{margin-top:0}
.fe-nt-grp:hover{background:var(--hover);color:var(--tx)}
.fe-nt-grp .fe-grp-n{letter-spacing:0}
.fe-nt-grp-pin{display:inline-flex;color:var(--gold)}
.fe-nt-grp-pin svg{width:12px;height:12px}
/* Where a dragged note would land: a line above or below a row, a ring on a group header. Drawn as shadows so nothing moves. */
.fe-nt-item.drop-before{box-shadow:inset 0 2px 0 var(--ac)}
.fe-nt-item.drop-after{box-shadow:inset 0 -2px 0 var(--ac)}
.fe-nt-grp.drop-in,.fe-nt-pinzone.drop-in{box-shadow:inset 0 0 0 1px var(--ac);color:var(--tx)}
.fe-nt-pinzone{display:flex;align-items:center;gap:var(--sp-2);height:var(--ctl-md);margin:0 var(--sp-3) var(--sp-2);padding:0 var(--row-px);border:1px dashed var(--bd2);border-radius:var(--row-r);color:var(--dm);font-size:var(--fs-sm);animation:fe-rise var(--t-fast) var(--ease)}
#fe-crumb-menu,#fe-ctx,.fe-ctx,.fe-pmenu,#fe-tip,#fe-hint,#fe-allow,#fe-toc-rail,#fe-fe-pill,#fe-toast{
  background:var(--pop-bg);border:1px solid var(--pop-bd);box-shadow:var(--pop-sh);
  backdrop-filter:var(--pop-blur);-webkit-backdrop-filter:var(--pop-blur);color:var(--tx)}
#fe-crumb-menu,#fe-ctx,.fe-ctx,.fe-pmenu,#fe-tip,#fe-allow,#fe-toc-rail{border-radius:var(--pop-r)}
#fe-crumb-menu,#fe-ctx,.fe-ctx{padding:var(--pop-pad)}
#fe-hint{position:fixed;top:0;left:0;z-index:var(--z-popover);max-width:320px;pointer-events:none;background:var(--s2);color:var(--tx);border:1px solid var(--bd);box-shadow:0 4px 14px rgb(var(--ink) / .4);font-size:var(--fs-md);line-height:1.4;white-space:pre-line;opacity:0;transition:opacity var(--t-fast) ease-out;border-radius:var(--row-r);padding:var(--sp-2) var(--sp-4)}
.fe-dd-search-wrap{border-bottom:1px solid var(--bd);padding:0 0 var(--sp-3);margin-bottom:var(--sp-2)}

.fe-dd-items{max-height:288px;overflow-y:auto;padding:0}
.fe-ctx-sep{height:1px;background:var(--bd);margin:var(--sp-2) var(--sp-2)}
.fe-toast-act{background:none;border:none;cursor:pointer;font:inherit;padding:0;text-decoration:underline;color:var(--ac)}
/* Contents is a quiet card, with a faint rail per heading level so the
   hierarchy reads at a glance. */
#fe-toc-rail{box-shadow:0 1px 2px rgb(var(--ink) / .05),0 4px 14px rgb(var(--ink) / .06)}
#fe-toc a{display:block;border-radius:var(--r-sm);color:var(--mt);text-decoration:none;padding:var(--sp-2) var(--sp-4) var(--sp-2) var(--sp-4);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;transition:color var(--t-fast) var(--ease),background var(--t-fast) var(--ease);margin:0 var(--sp-3);position:relative}
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
.fe-lens.entering{animation:fe-lens-in var(--t-base) var(--ease)}
#fe-qlook.side{position:relative;inset:auto;z-index:1;flex:none;width:420px;max-width:80vw;border-left:1px solid var(--bd);align-items:stretch;justify-content:stretch;margin-left:var(--sp-4);animation:fe-dock-in var(--t-base) var(--ease)}
.fe-sh-collapse svg{transition:transform var(--t-fast) var(--ease)}
/* Settings and Help read as a page: the title across the top, the sections
   listed on the left the way the sidebar lists lenses, the pane on the right.
   In Settings each row names the setting, says what it changes and keeps its
   control on the right; rows sit in cards by subject. */
.fe-set-h{justify-content:space-between;min-height:var(--bar-h);padding:var(--sp-4) var(--sp-6) var(--sp-2)}
.fe-set{display:flex;align-items:center;gap:var(--sp-6);min-height:52px;padding:var(--sp-4) var(--sp-6);border-top:1px solid color-mix(in srgb,var(--bd) 70%,transparent)}
.fe-set-h + .fe-set{border-top:0}
.fe-set-tx{flex:1;min-width:0;display:flex;flex-direction:column;gap:var(--sp-1)}
.fe-set-l{font-size:var(--row-fs);color:var(--tx)}
.fe-set-d{font-size:var(--fs-md);color:var(--dm);line-height:1.35}
.fe-set-c .fe-st-input{width:260px;max-width:100%}
.fe-set-note{padding:var(--sp-1) var(--sp-6) var(--sp-4);font-size:var(--fs-md);color:var(--dm);line-height:1.5}
.fe-set-note:empty{display:none}
.fe-set-card #fe-st-rules-list{margin:0 var(--sp-6)}
.fe-set-danger{color:var(--nc-red)}

.fe-switch{appearance:none;-webkit-appearance:none;position:relative;flex:none;width:34px;height:20px;margin:0;border-radius:10px;
  background:var(--s3);cursor:pointer;transition:background var(--t-fast) var(--ease)}
.fe-switch::after{content:'';position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:rgb(var(--paper));
  box-shadow:0 1px 2px rgb(var(--ink) / .3);transition:transform var(--t-fast) var(--ease),background var(--t-fast) var(--ease)}
.fe-switch:checked{background:var(--ac)}
.fe-switch:checked::after{transform:translateX(14px);background:var(--tx-on-ac)}
.fe-switch:focus-visible{outline:2px solid var(--ac);outline-offset:2px}
.fe-set-sw:hover{background:var(--hover)}
.fe-set-sw:has(input:checked){background:var(--on);color:var(--tx)}
.fe-set-sw input{position:absolute;inset:0;width:100%;height:100%;margin:0;opacity:0;cursor:pointer}
.fe-set-sw-chip{width:40px;height:26px;border-radius:7px;background:linear-gradient(135deg,var(--b) 55%,var(--a) 55%);box-shadow:inset 0 0 0 1px var(--bd2)}
/* Editing: the reading width applies to Raw and Rich; Split gives each side
   half the pane and its own scroll. Problems mark their row in the gutter. */
#fe-fe-col{margin:0 auto;padding:62px 28px 120px;max-width:none}
#fe.fe-column-xl #fe-fe-col{max-width:150ch}
#fe.fe-column-lg #fe-fe-col{max-width:130ch}
#fe.fe-column-md #fe-fe-col{max-width:110ch}
[data-mode="split"] #fe-fe-scroll{overflow:hidden}
#fe [data-mode="split"] #fe-fe-col{max-width:none;height:100%;display:grid;grid-template-columns:minmax(0,3fr) minmax(0,2fr);padding:0}
/* Spacing on the text side is border, not padding: the typing layer is placed
   against the padding box, so padding would shift it off the painted text. */
[data-mode="split"] #fe-fe-src{overflow:auto;padding:0 var(--sp-7) 120px 0;border-top:24px solid transparent;border-left:12px solid transparent}
/* The typing box spans the padding box; in Split it stops short of the right padding, so it wraps where the painted text wraps. */
[data-mode="split"] #fe-fe-ta{width:calc(100% - var(--sp-7))}
[data-mode="split"] #fe-fe-view{overflow:auto;padding:60px 28px 120px;border-left:1px solid var(--bd)}
#fe-fe-diag[hidden]{display:none}
.fe-fe-rich{padding:0}
[data-mode="rich"] #fe-fe-view,[data-mode="split"] #fe-fe-view{animation:fe-fade var(--t-base) var(--ease)}
.fe-html-frame{display:block;width:100%;height:calc(100vh - 210px);min-height:320px;border:1px solid var(--bd);border-radius:var(--row-r);background:rgb(var(--paper))}
.fe-yaml-sep{border:0;border-top:1px dashed var(--bd);margin:var(--sp-5) 0}
.fe-fe-row.err,.fe-cl.err{background:color-mix(in srgb,var(--nc-red) 8%,transparent)}
.fe-fe-row.warn,.fe-cl.warn{background:color-mix(in srgb,var(--nc-orange) 7%,transparent)}
.fe-fe-row.err .fe-fe-ln,.fe-cl.err .fe-cl-n{color:var(--nc-red);font-weight:600}
.fe-fe-row.warn .fe-fe-ln,.fe-cl.warn .fe-cl-n{color:var(--nc-orange);font-weight:600}
.fe-fe-row.err .fe-fe-code,.fe-cl.err .fe-cl-t{text-decoration:underline wavy color-mix(in srgb,var(--nc-red) 70%,transparent);text-underline-offset:3px}
.fe-cl.flash{background:var(--on);transition:background var(--t-flash) var(--ease)}
.fe-fe-modes,.fe-fe-modes .fe-seg-b{border-radius:var(--r-full)}
#fe-fe-pill .fe-fe-diag{border-radius:var(--r-full);padding:0 var(--sp-4);font-size:var(--fs-md)}
.fe-fe-diag.error{color:var(--nc-red)}
.fe-fe-diag.warn{color:var(--nc-orange)}
.fe-diag{margin:0 0 var(--sp-5);font-size:var(--fs-md)}
.fe-diag > summary{cursor:pointer;padding:var(--sp-4) var(--sp-5);font-weight:600;list-style:none}
.fe-diag.error > summary{color:var(--nc-red)}
.fe-diag.warn > summary{color:var(--nc-orange)}
.fe-diag-row{display:flex;gap:var(--sp-4);width:100%;padding:var(--sp-2) var(--sp-5);border:0;background:none;color:var(--mt);font:inherit;text-align:left;cursor:pointer;border-top:1px solid color-mix(in srgb,var(--bd) 70%,transparent)}
.fe-diag-row:hover{background:var(--hover);color:var(--tx)}
.fe-diag-ln{flex:none;min-width:3ch;text-align:right;font-family:var(--mono);color:var(--dm)}
.fe-diag-row.error .fe-diag-ln{color:var(--nc-red)}
.fe-diag-row.warn .fe-diag-ln{color:var(--nc-orange)}
.fe-diag-more{display:block;padding:var(--sp-2) var(--sp-5) var(--sp-4);color:var(--dm)}
#fe-page > .fe-diag{margin:var(--sp-6) 48px 0}
/* Search and Ask lenses: a form at the row inset, results as ordinary rows. */
.fe-tl-form{display:flex;flex-direction:column;gap:var(--sp-3);margin:var(--sp-1) var(--sp-3) var(--sp-4)}
.fe-tl-input{width:100%;resize:vertical}

.fe-tl-opts{display:flex;gap:var(--sp-5);padding:0 var(--sp-2)}
.fe-srch-hit{align-items:flex-start;padding-top:var(--sp-3);padding-bottom:var(--sp-3)}
.fe-srch-hit > svg{margin-top:var(--sp-1)}
.fe-srch-tx{display:flex;flex-direction:column;gap:var(--sp-1);min-width:0;flex:1}
.fe-srch-snip{font-size:var(--fs-md);color:var(--dm);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fe-srch-snip mark{background:color-mix(in srgb,var(--ac) 28%,transparent);color:var(--tx);border-radius:3px;padding:0 var(--sp-1)}
/* Ask: a top row (model chip, new chat, history), the chat, and a composer
   pinned to the bottom of the lens. */
#fe-lens-ask:not([hidden]){display:flex;flex-direction:column;min-height:100%}
#fe-ask{flex:1;display:flex;flex-direction:column}
.fe-ask-top{position:relative;display:flex;align-items:center;gap:var(--sp-1);margin:0 var(--sp-4) var(--sp-4) var(--sp-5)}
.fe-ask-sp{flex:1}
.fe-ask-model{position:relative;display:inline-flex;min-width:0;max-width:100%}
.fe-ask-model > .dot{position:absolute;left:10px;top:50%;margin-top:-3.5px;pointer-events:none}
.fe-ask-model .fe-dd-btn{min-width:0;max-width:190px;padding-left:var(--sp-8)}
.fe-ask-model .dot,.fe-ask-status .dot{width:7px;height:7px;border-radius:50%;flex:none;background:var(--dm)}
.dot.ready{background:var(--green)}
.dot.cold{background:var(--gold)}
.dot.down,.dot.unavailable{background:var(--nc-red)}
.fe-ask-ib{position:relative}

.fe-ask-n{position:absolute;top:1px;right:0}
.fe-ask-status{display:flex;align-items:center;gap:var(--sp-4);margin:0 var(--sp-6) var(--sp-4);font-size:var(--fs-sm);line-height:1.4;color:var(--mt)}
.fe-ask-status[hidden]{display:none}
.fe-ask-cloud{display:flex;align-items:center;gap:var(--sp-3);margin:0 var(--sp-6) var(--sp-4);font-size:var(--fs-sm);color:var(--mt)}
.fe-ask-cloud[hidden]{display:none}
.fe-ask-cloud svg{width:12px;height:12px;flex:none;color:var(--gold)}
#fe-ask-thread{position:relative;display:flex;flex-direction:column;gap:var(--sp-5);padding:var(--sp-2) var(--sp-5) var(--sp-5) var(--sp-5)}
.fe-ask-turn{position:relative;display:flex;flex-direction:column;gap:var(--sp-3)}
.fe-ask-q{align-self:flex-end;max-width:88%;padding:var(--sp-3) var(--sp-4);border-radius:var(--pop-r) var(--pop-r) var(--r-xs) var(--pop-r);background:color-mix(in srgb,var(--ac) 16%,transparent);color:var(--tx);font-size:var(--fs-md);line-height:1.45;white-space:pre-wrap;overflow-wrap:anywhere}
.fe-ask-a.fe-md{padding:0;font-size:var(--fs-md);line-height:1.55;max-width:none}
/* renderMarkdown wraps its output in its own .fe-md, which must not pad again. */
.fe-ask-a .fe-md{padding:0;font-size:inherit;max-width:none}
.fe-ask-wait{color:var(--dm)}
.fe-ask-meta{font-size:var(--fs-xs);color:var(--dm)}
.fe-ask-meta:empty{display:none}.fe-ask-foot2{display:flex;align-items:center;gap:var(--sp-3);min-height:var(--btn-h)}
.fe-ask-acts{display:flex;gap:var(--sp-1);margin-left:auto;opacity:0;transition:opacity var(--t-fast) var(--ease)}
.fe-ask-turn:hover .fe-ask-acts,.fe-ask-turn:focus-within .fe-ask-acts{opacity:1}
.fe-ask-blk{position:absolute;right:var(--sp-2);z-index:var(--z-sticky);display:flex;gap:var(--sp-1);padding:var(--sp-1);border:1px solid var(--pop-bd);border-radius:var(--r-sm);background:var(--pop-bg)}
.fe-ask-blk[hidden]{display:none}
.fe-ask-err{display:flex;align-items:center;gap:var(--sp-3);padding:var(--sp-3) var(--sp-4);border:1px solid var(--bd2);border-radius:var(--r-sm);color:var(--mt)}
.fe-ask-err > span{flex:1;min-width:0}
.fe-ask-err svg{flex:none;width:var(--row-ic);height:var(--row-ic);color:var(--nc-red)}
.fe-ask-think{margin-bottom:var(--sp-4);border-left:2px solid var(--bd2);padding-left:var(--sp-4);color:var(--mt)}
.fe-ask-think summary{display:flex;align-items:center;gap:var(--sp-3);cursor:pointer;list-style:none;font-size:var(--fs-sm);color:var(--dm)}
.fe-ask-think summary::-webkit-details-marker{display:none}
.fe-ask-think summary svg{width:var(--row-ic);height:var(--row-ic)}
.fe-ask-think-n{margin-left:auto;font-variant-numeric:tabular-nums}
.fe-ask-think > .fe-md{max-height:30em;overflow:auto;margin-top:var(--sp-3);font-size:var(--fs-sm)}
.fe-ask-files{display:flex;flex-wrap:wrap;gap:var(--sp-2);padding-bottom:var(--sp-3)}
.fe-ask-files[hidden]{display:none}
.fe-ask-qfiles{display:flex;flex-wrap:wrap;gap:var(--sp-2);justify-content:flex-end}
.fe-ask-file{max-width:100%;min-width:0}
.fe-ask-file > span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fe-ask-file svg{flex:none}
.fe-ask-box.drop{outline:2px dashed var(--ac);outline-offset:-2px}
.fe-ask-via{display:flex;align-items:center;gap:var(--sp-3);font-size:var(--fs-sm);color:var(--dm)}
.fe-ask-via svg,.fe-ask-step svg{flex:none;width:var(--row-ic);height:var(--row-ic)}
.fe-ask-step{display:flex;align-items:center;gap:var(--sp-3);color:var(--dm);font-size:var(--fs-sm)}
.fe-ref{color:inherit;text-decoration:none}
.fe-ref code,.tok-str>.fe-ref{text-decoration:underline dotted var(--dm);text-underline-offset:3px}
.fe-ref:hover code,.tok-str>.fe-ref:hover{color:var(--ac)}
.fe-ref-card{width:320px;padding:var(--sp-4) var(--sp-5);font-size:var(--fs-md);line-height:1.45}
.fe-ref-head{display:flex;align-items:center;gap:var(--sp-3);margin-bottom:var(--sp-2)}
.fe-ref-name,.fe-ref-path{font-weight:600;color:var(--tx);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fe-ref-about{margin:0 0 var(--sp-3);color:var(--mt)}
.fe-ref-hint{margin:0 0 var(--sp-3);font-family:var(--mono);font-size:var(--fs-sm);color:var(--dm)}
.fe-ref-chips{display:flex;flex-wrap:wrap;gap:var(--sp-2);margin-bottom:var(--sp-3)}
.fe-ref-foot{font-size:var(--fs-xs);color:var(--dm)}
.fe-ask-qmenu{min-width:240px;max-width:320px;max-height:60vh;overflow:auto}
.fe-ask-qmenu-h{padding:var(--sp-2) var(--row-px);font-size:var(--fs-xs);color:var(--dm)}
.fe-ask-qmenu-t{display:flex;flex-direction:column;min-width:0}
.fe-ask-qmenu-s{font-size:var(--fs-xs);color:var(--dm);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fe-ask-empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:var(--sp-4);padding:var(--sp-6);color:var(--dm);font-size:var(--fs-md);text-align:center}
.fe-ask-empty[hidden]{display:none}
.fe-ask-empty p{margin:0}
.fe-ask-quick{display:flex;flex-wrap:wrap;justify-content:center;gap:var(--sp-3)}
.fe-ask-form{position:sticky;bottom:0;margin-top:auto;padding:var(--sp-4) var(--sp-4) var(--sp-4);background:linear-gradient(to bottom,transparent,var(--side) 14px)}
.fe-ask-box{display:flex;flex-direction:column;gap:var(--sp-2);padding:var(--sp-4) var(--sp-4) var(--sp-3) var(--sp-4);border:1px solid var(--bd2);border-radius:14px;background:var(--bg);transition:border-color var(--t-fast) var(--ease)}
.fe-ask-box:focus-within{border-color:var(--ac)}
#fe-ask-q{width:100%;min-height:var(--ctl-sm);max-height:140px;padding:0;border:0;outline:0;resize:none;background:none;color:var(--tx);font:inherit;font-size:var(--fs-md);line-height:1.45}
#fe-ask-q::placeholder{color:var(--dm)}
.fe-ask-foot{display:flex;align-items:center;gap:var(--sp-4)}
.fe-ask-ctx{flex:1;min-width:0;display:inline-flex;align-items:center;gap:var(--sp-2);font-size:var(--fs-xs);color:var(--dm)}
.fe-ask-ctx span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fe-ask-ctx svg{width:11px;height:11px;flex:none}
.fe-ask-send{flex:none}

.fe-ask-send.stop svg{display:none}
.fe-ask-send.stop::before{content:'';width:9px;height:9px;border-radius:2px;background:currentColor}
.fe-ask-hist{position:absolute;right:0;top:32px;width:240px;max-height:320px;overflow-y:auto;padding:var(--sp-2);border:1px solid var(--pop-bd,var(--bd2));border-radius:10px;background:var(--pop-bg,var(--s2));box-shadow:var(--pop-sh);backdrop-filter:var(--pop-blur);-webkit-backdrop-filter:var(--pop-blur)}
.fe-ask-hist[hidden]{display:none}
.fe-ask-h{display:flex;align-items:center;border-radius:var(--row-r)}
.fe-ask-h-open{flex:1;min-width:0;display:flex;flex-direction:column;align-items:flex-start;gap:var(--sp-1);padding:var(--sp-3) var(--sp-4);border:0;background:none;color:var(--tx);font:inherit;text-align:left;cursor:pointer}
.fe-ask-h-t{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:var(--fs-md)}
.fe-ask-h-m{font-size:var(--fs-xs);color:var(--dm)}
.fe-ask-h-del{opacity:0}
.fe-ask-h:hover .fe-ask-h-del,.fe-ask-h-del:focus-visible{opacity:1}
/* Review fixes: Settings follows the page order (panel a step below, cards
   on top), fields share one look, path chevrons show on hover only, and
   the palette swatch previews the theme in use. */

#fe-bar .fe-crumb-dd{background:none;border:none;cursor:pointer;font-size:var(--fs-xs);border-radius:3px;line-height:1;transition:opacity var(--t-fast),color var(--t-fast),background var(--t-fast);flex-shrink:0;min-width:0;opacity:1;color:var(--dm);padding:var(--sp-2) var(--sp-1)}
#fe-bar .fe-crumb-dd:hover{background:var(--hover);opacity:1;border:none;color:var(--tx)}
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


.fe-set-group{display:flex;flex-direction:column;gap:var(--sp-4)}
.fe-set-group > .fe-set-h{min-height:var(--ctl-sm);padding:0 var(--sp-2) 0 var(--sp-3)}
.fe-set-card{overflow:hidden}
.fe-set-card > .fe-set:first-child{border-top:0}
.fe-set-card > .fe-set-note:first-child{padding-top:var(--sp-5)}
.fe-set-card #fe-st-reset-rules{margin:var(--sp-4) var(--sp-6) var(--sp-5)}
#fe-st-ai-card{background:none;border:0;border-radius:0;padding:var(--sp-5) var(--sp-6)}
/* Theme and palette pickers: a small window drawn in the colours each one
   picks. Palette windows follow the current mode; mode windows show both. */
.fe-set-sws{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:var(--sp-3)}
.fe-set-sw{position:relative;display:flex;flex-direction:column;align-items:center;border-radius:10px;cursor:pointer;font-size:var(--fs-md);color:var(--mt);transition:background var(--t-fast) var(--ease),color var(--t-fast) var(--ease);gap:var(--sp-3);padding:var(--sp-3)}
.fe-set-thumb{position:relative;display:block;width:68px;height:46px;border-radius:var(--row-r);overflow:hidden;background:var(--b);
  box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--t) 14%,transparent),0 1px 3px rgb(var(--ink) / .18);
  --t:#fff;--c:color-mix(in srgb,var(--b) 78%,rgb(var(--ink)));transition:box-shadow var(--t-fast) var(--ease)}
.fe-set-thumb i{position:absolute;display:block}
.fe-set-thumb .sb{left:0;top:0;bottom:0;width:18px;background:var(--c)}
.fe-set-thumb .r1,.fe-set-thumb .r2{left:25px;height:4px;border-radius:2px;background:var(--t);opacity:.42}
.fe-set-thumb .r1{top:11px;width:32px}
.fe-set-thumb .r2{top:20px;width:22px;opacity:.26}
.fe-set-thumb .pill{left:25px;bottom:9px;width:20px;height:7px;border-radius:var(--r-xs);background:var(--a)}
.fe-set-sw:has(input:checked) .fe-set-thumb{box-shadow:0 0 0 2px var(--ac),0 1px 3px rgb(var(--ink) / .18)}
.fe-set-sw:has(.fe-set-thumb):has(input:checked){background:none}
.fe-set-sw:has(.fe-set-thumb):hover{background:none}
.fe-set-sw:has(.fe-set-thumb):hover .fe-set-thumb{box-shadow:0 0 0 2px color-mix(in srgb,var(--ac) 45%,transparent),0 1px 3px rgb(var(--ink) / .18)}
.fe-set-sw:has(.fe-set-thumb):has(input:checked):hover .fe-set-thumb{box-shadow:0 0 0 2px var(--ac),0 1px 3px rgb(var(--ink) / .18)}
.fe-set-sw:has(input:focus-visible) .fe-set-thumb{outline:2px solid var(--ac);outline-offset:3px}
.fe-set-thumb[data-p="slate"]{--a:#3cc6c0;--b:#1c2328}
.fe-set-thumb[data-p="violet"]{--a:#9d7cff;--b:#1f1f27}
.fe-set-thumb[data-p="sand"]{--a:#e8789a;--b:#24201c}
.fe-set-thumb[data-p="ink"]{--a:#f2f2f3;--b:#1b1b1d}
#fe[data-theme="light"] .fe-set-thumb[data-p]{--t:#000;--c:color-mix(in srgb,var(--b) 90%,rgb(var(--ink)))}
#fe[data-theme="light"] .fe-set-thumb[data-p="slate"]{--a:#0e8f8a;--b:#eef3f5}
#fe[data-theme="light"] .fe-set-thumb[data-p="violet"]{--a:#6d4aff;--b:#f3f3f8}
#fe[data-theme="light"] .fe-set-thumb[data-p="sand"]{--a:#c2406b;--b:#f5efe7}
#fe[data-theme="light"] .fe-set-thumb[data-p="ink"]{--a:#141414;--b:#f4f4f4}
#fe .fe-set-thumb[data-mode="dark"]{--a:var(--ac);--b:#1c2328;--t:#fff;--c:#131a1e}
#fe .fe-set-thumb[data-mode="light"]{--a:var(--ac);--b:#f4f6f8;--t:#000;--c:#e2e7eb}
/* Very narrow: the sidebar shrinks to its rail and a picked lens floats over
   the page; the path bar keeps its last folder in view. */
@media (max-width:520px){
  #fe #fe-side{width:54px!important;max-width:none;overflow:visible;position:relative;z-index:var(--z-panel);flex-direction:row}
  #fe-rail{flex-direction:column;padding:var(--sp-4) 0;border-bottom:0}
  .fe-rail-btn.on{flex-grow:0}
  .fe-rail-btn em{display:none}
  #fe-side-rz{display:none}
  #fe-lenses{display:none}
  #fe-side.open #fe-lenses{display:block;position:absolute;top:0;bottom:0;left:58px;width:min(260px,calc(100vw - 80px));
    background:var(--side);border:1px solid var(--pop-bd);border-radius:var(--pop-r);box-shadow:var(--pop-sh);animation:fe-lens-in var(--t-base) var(--ease)}
  #fe-rail{border-right:0}
  #fe-bc{justify-content:flex-end}
}
@container fe-main (max-width:480px){
  #fe-page .fe-md{padding:var(--sp-6) var(--sp-5) 48px}
  #fe-page .fe-md h1{font-size:1.45em}
  #fe-page > .fe-diag{margin:var(--sp-5) var(--sp-5) 0}
}
#fe-table tbody tr.fe-spacer td{padding:0;border:0;background:none;height:var(--h)}
.fe-st-ai-head.down .dot,.fe-st-ai-head.off .dot{background:var(--nc-red)}
/* A decision page takes the listing's place; Files brings the listing back. While the
   config is read, the listing stays out of sight so it never flashes first. */
#fe.fe-dp-pending #fe-toolbar,#fe.fe-dp-pending #fe-scroll,#fe.fe-dp-page #fe-toolbar,#fe.fe-dp-page #fe-sg-panel,#fe.fe-dp-page #fe-filter-bar,#fe.fe-dp-page #fe-scroll{display:none}
#fe-dp{flex:1;min-height:0;overflow:auto;padding:var(--sp-8) var(--sp-9)}
#fe-dp[hidden]{display:none}
/* One column of cards; from 720 wide a rail of every item sits beside it and stays in view, wider from 1100. */
.fe-dp-layout{max-width:920px;margin:0 auto}
.fe-dp-side{display:none;position:sticky;top:0;align-self:start}
@container fe-main (min-width:720px){
  .fe-dp-layout{display:grid;grid-template-columns:minmax(0,920px) 200px;justify-content:center;gap:var(--sp-6);max-width:none}
  .fe-dp-side{display:block}
}
@container fe-main (min-width:1100px){
  .fe-dp-layout{grid-template-columns:minmax(0,920px) 240px;gap:var(--sp-8)}
}
.fe-dp-head{margin:0 0 var(--sp-6);display:flex;flex-direction:column;gap:var(--sp-3)}
.fe-dp-titlebar{display:flex;align-items:center;gap:var(--sp-5)}
.fe-dp-title{flex:1;min-width:0;margin:0;font-family:var(--font-head);font-weight:650;font-size:calc(var(--fs-xl) * 1.6);line-height:1.25;color:var(--tx)}
.fe-dp-origin{display:flex;flex-wrap:wrap;gap:var(--sp-1) var(--sp-3);margin:0;font-size:var(--fs-sm);color:var(--dm)}
.fe-dp-origin>*+*::before{content:'\xB7';margin-right:var(--sp-3);color:var(--dm)}
.fe-dp-fact{padding:0;border:0;background:none;font:inherit;color:inherit;cursor:copy}
.fe-dp-fact:hover{color:var(--tx);text-decoration:underline}
.fe-dp-fact:focus-visible{outline:2px solid var(--ac);outline-offset:2px;border-radius:var(--r-xs)}
.fe-dp-intro{color:var(--mt)}
.fe-dp-intro .fe-md{padding:0;max-width:none;color:inherit}
#fe-dp-back{margin-left:var(--sp-4)}
.fe-dp-bar{position:sticky;top:0;z-index:1;margin:0 0 var(--sp-6);display:flex;flex-wrap:wrap;align-items:center;gap:var(--sp-2);padding:var(--sp-2) var(--sp-2) var(--sp-2) var(--sp-5);background:var(--card);border:1px solid var(--bd);border-radius:var(--row-r);box-shadow:0 var(--sp-2) var(--sp-5) rgb(var(--ink) / .08)}
.fe-dp-bar .fe-dv-meter{margin-left:0}
.fe-dp-bar-gap{flex:1}
.fe-dp-bar-end{display:flex;align-items:center;gap:var(--sp-2);margin-left:auto}
.fe-dp-answer{margin:calc(var(--sp-4) * -1) 0 var(--sp-6);padding:var(--sp-4) var(--sp-5)}
.fe-dp-answer .notice{padding:0 0 var(--sp-3)}
.fe-dp-answer-text{margin:0;max-height:40vh;overflow:auto;font-family:var(--mono);font-size:var(--fs-sm);line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere;color:var(--tx)}
.fe-dp-sent{margin:0 0 var(--sp-5);padding:var(--sp-4) var(--sp-5);border-left:3px solid var(--tone-ok)}
.fe-dp-sent[data-told="undelivered"],.fe-dp-sent[data-told="unknown"]{border-left-color:var(--tone-warn)}
.fe-dp-sent-head{display:flex;flex-wrap:wrap;align-items:baseline;gap:var(--sp-3);margin:0 0 var(--sp-3)}
.fe-dp-sent-told{font-size:var(--fs-sm);color:var(--dm)}
.fe-dp-sent-picks{display:flex;flex-wrap:wrap;gap:var(--sp-2);margin-bottom:var(--sp-3)}
.fe-dp-sent-lines{margin:0 0 var(--sp-3);padding-left:var(--sp-6);font-size:var(--fs-sm);color:var(--mt)}
.fe-dp-sent-full summary{cursor:pointer;font-size:var(--fs-sm);color:var(--dm)}
.fe-dp-sent-full pre{margin:var(--sp-3) 0 0;font-family:var(--mono);font-size:var(--fs-sm);white-space:pre-wrap;overflow-wrap:anywhere}
.fe-dp-progress{flex:1;font-size:var(--fs-sm);color:var(--mt)}
#fe-dp-body{display:flex;flex-direction:column;gap:var(--sp-6)}
/* The rail: one row per item, its dot in the item's state, its pick at the end. */
.fe-dv-outline{display:flex;flex-direction:column;max-height:calc(100vh - var(--sp-9) * 4);padding:var(--sp-3) 0;background:var(--card);border:1px solid var(--bd);border-radius:var(--row-r)}
.fe-dv-outline-h{padding:var(--sp-2) var(--sp-5) var(--sp-3);font-size:var(--fs-sm);font-weight:600;color:var(--mt)}
.fe-dv-outline ol{position:relative;margin:0;padding:0 var(--sp-2);list-style:none;overflow:auto}
.fe-dv-outline-grp{padding:var(--sp-4) var(--sp-3) var(--sp-1);font-size:var(--fs-xs);font-weight:650;letter-spacing:.06em;text-transform:uppercase;color:var(--dm)}
.fe-dv-outline-row{width:100%;border:0;background:none;font-family:inherit;text-align:left;cursor:pointer}
.fe-dv-outline-row>i{flex:none;width:var(--sp-3);height:var(--sp-3);border-radius:var(--r-full);background:var(--st,var(--bd2))}
.fe-dv-outline-id{flex:none;font-family:var(--mono);font-size:var(--fs-sm);color:var(--dm)}
.fe-dv-outline-lbl{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fe-dv-outline-val{flex:none;font-family:var(--mono);font-size:var(--fs-sm);color:var(--tx)}
.fe-dp-md>.fe-md{padding:0;max-width:none;color:inherit}
.fe-dp-grp{margin:0}
#fe-dp-body .fe-dp-grp>summary{margin:0 0 var(--sp-3);color:var(--grp,var(--mt))}
.fe-dp-grp>.fe-grp-body{display:flex;flex-direction:column;gap:var(--sp-4)}
.fe-dp-grp-ctx{margin:0 0 var(--sp-4);padding:0 var(--row-px);color:var(--mt)}
.fe-dp-card{display:flex;flex-direction:column;gap:var(--sp-4);padding:var(--sp-5) var(--sp-6);border-left:3px solid var(--bd);outline:none;transition:border-color var(--t-fast) var(--ease),box-shadow var(--t-fast) var(--ease)}
.fe-dp-card[data-flag="changed"]{border-left-color:var(--gold)}
.fe-dp-card[data-flag="noted"]{border-left-color:var(--ac)}
.fe-dp-card.current{box-shadow:0 0 0 2px var(--ac)}
.fe-dp-card-head{display:flex;align-items:center;gap:var(--sp-3)}
.fe-dp-q{flex:1;min-width:0;margin:0;font-family:var(--font-head);font-size:var(--fs-lg);font-weight:600;line-height:1.35;color:var(--tx)}
.fe-dp-agree{display:inline-flex;align-items:center;gap:var(--sp-2);flex:none;font-size:var(--fs-sm);color:var(--mt);cursor:pointer}
.fe-dp-card.disagree .fe-dp-agree-lbl{color:var(--gold)}
.fe-dp-prio{flex:none}
#fe-dp-body .fe-dp-dgrp{flex:none;color:var(--grp,var(--mt))}
.fe-dp-opts{display:flex;flex-direction:column;gap:var(--sp-2)}
/* A tile is at least its share of a row of --cols and never under 220px, so the grid makes
   no empty columns; with plain auto-fit a full-row option (None) kept them open. */
.fe-dp-opts.gallery{--gap:var(--sp-4);display:grid;grid-template-columns:repeat(auto-fill,minmax(max(220px,calc((100% - (var(--cols,3) - 1) * var(--gap)) / var(--cols,3))),1fr));gap:var(--gap)}
.fe-dp-opts.gallery .fe-dp-opt:not(.tile){grid-column:1 / -1}
.fe-dp-opt{position:relative;display:flex;flex-direction:column;gap:var(--sp-2);padding:var(--sp-3) var(--sp-4);border:1px solid var(--bd);border-radius:var(--row-r);cursor:pointer;transition:border-color var(--t-fast) var(--ease),background var(--t-fast) var(--ease)}
.fe-dp-opt:hover{background:var(--hover)}
.fe-dp-opt:has(input:checked){border-color:var(--ac);background:color-mix(in srgb,var(--ac) 10%,transparent)}
.fe-dp-opt:has(input:focus-visible){outline:2px solid var(--ac);outline-offset:1px}
.fe-dp-opt.none{border-style:dashed}
.fe-dp-opt>input{position:absolute;opacity:0;pointer-events:none}
.fe-dp-opt-row{display:flex;align-items:baseline;gap:var(--sp-4)}
.fe-dp-opt-tx{flex:1;min-width:0;display:flex;flex-wrap:wrap;align-items:baseline;gap:0 var(--sp-4)}
.fe-dp-opt-lbl{color:var(--tx)}
/* The option's key: quiet until its card is the one the keys act on, filled when picked. */
.fe-dp-num{flex:none;min-width:var(--ctl-xs);padding:0 var(--sp-2);box-sizing:border-box;border:1px solid var(--bd2);border-radius:var(--r-xs);font:500 var(--fs-sm)/1.5 var(--mono);text-align:center;color:var(--dm)}
.fe-dp-card.current .fe-dp-num{color:var(--tx)}
.fe-dp-opt:has(input:checked) .fe-dp-num{border-color:var(--ac);background:var(--ac);color:var(--card)}
.fe-dp-why{font-size:var(--fs-sm);color:var(--mt)}
.fe-dp-rec{flex:none}
.fe-dv-strip{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:var(--sp-3)}
.fe-dv-strip>.fe-dv-media.zoomed,.fe-dp-opts.gallery>.fe-dp-opt.zoomed{grid-column:1 / -1}
.fe-dp-tile-img{display:flex;flex-direction:column;gap:var(--sp-2)}
.fe-dv-media{position:relative;margin:0;border:1px solid var(--bd);border-radius:var(--row-r);overflow:hidden;background:var(--s2)}
.fe-dv-media img{display:block;width:100%;aspect-ratio:16 / 10;object-fit:contain;cursor:zoom-in}
.fe-dv-strip>.fe-dv-media img{aspect-ratio:auto;max-height:calc(var(--sp-9) * 8)}
.fe-dv-media.zoomed img{aspect-ratio:auto;cursor:zoom-out}
.fe-dv-frame{position:relative;aspect-ratio:16 / 10;overflow:hidden;background:rgb(var(--paper))}
.fe-dv-frame iframe{position:absolute;inset:0 auto auto 0;width:var(--mock-w);height:calc(100% / var(--scale,1));border:0;transform:scale(var(--scale,1));transform-origin:0 0}
.fe-dv-media-acts{position:absolute;top:var(--sp-2);right:var(--sp-2);display:flex;gap:var(--sp-1);padding:var(--sp-1);background:var(--card);border:1px solid var(--bd);border-radius:var(--row-r);opacity:0;transition:opacity var(--t-fast) var(--ease)}
.fe-dv-media:hover>.fe-dv-media-acts,.fe-dv-media:focus-within>.fe-dv-media-acts,.fe-dv-media-acts:has([aria-pressed="true"]){opacity:1}
.fe-dv-view-box{position:relative;z-index:1;width:calc(100vw - var(--sp-9) * 2);height:calc(100vh - var(--sp-9) * 2);display:flex;flex-direction:column;outline:none}
.fe-dv-view-head{display:flex;align-items:center;gap:var(--sp-2);padding:var(--sp-2) var(--sp-2) var(--sp-2) var(--sp-5);border-bottom:1px solid var(--bd)}
.fe-dv-view-title{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600;color:var(--tx)}
.fe-dv-view-tools{display:flex;gap:var(--sp-1)}
.fe-dv-view-body{flex:1;min-height:0;display:flex;flex-direction:column}
.fe-dv-view-frame{flex:1;width:100%;border:0;background:rgb(var(--paper))}
.fe-dv-compare{flex-direction:row}
.fe-dv-cmp-pane+.fe-dv-cmp-pane{border-left:1px solid var(--bd)}
.fe-dv-cmp-pane{flex:1;min-width:0;display:flex;flex-direction:column;background:var(--card)}
.fe-dv-cmp-label{padding:var(--sp-2) var(--sp-5);font-size:var(--fs-sm);color:var(--mt);border-bottom:1px solid var(--bd)}
.fe-dv-cmp-scroll{flex:1;min-height:0;overflow:auto}
.fe-dv-pic{position:relative;display:block;width:calc(100% * var(--zoom,1))}
.fe-dv-pic>img{display:block;width:100%;max-width:none}
/* Marks: numbered boxes that say "look here", laid over the picture's drawn area. */
.fe-dv-marks{position:absolute;inset:0;pointer-events:none}
.fe-dv-mark{position:absolute;left:calc(var(--x) * 100%);top:calc(var(--y) * 100%);width:calc(var(--w) * 100%);height:calc(var(--h) * 100%);box-sizing:border-box;border:2px solid var(--nc-orange);border-radius:var(--r-xs);box-shadow:0 0 0 1px rgb(var(--ink) / .45)}
.fe-dv-mark>b,.fe-dv-mark-key b{display:inline-grid;place-items:center;min-width:var(--ctl-xs);height:var(--ctl-xs);padding:0 var(--sp-1);box-sizing:border-box;border-radius:var(--r-xs);background:var(--nc-orange);color:rgb(var(--ink));font:700 var(--fs-xs)/1 var(--mono)}
.fe-dv-marks b{position:absolute;top:0;left:0}
.fe-dv-mark-key{display:flex;flex-wrap:wrap;gap:var(--sp-2) var(--sp-5);padding:var(--sp-3) var(--sp-4);font-size:var(--fs-sm);color:var(--mt)}
.fe-dv-mark-key>span{display:inline-flex;align-items:center;gap:var(--sp-2)}
.marks-off .fe-dv-marks,.marks-off .fe-dv-mark-key,.fe-ql-imgwrap:is([data-rot="90"],[data-rot="180"],[data-rot="270"],[data-flip="1"]) .fe-dv-marks{display:none}
.fe-dv-cmp-scroll iframe{display:block;width:100%;height:var(--mock-tall);border:0;background:rgb(var(--paper))}
.fe-dp-preview{position:relative;padding:var(--sp-4) var(--sp-5);background:var(--s1);border:1px solid var(--bd);border-radius:var(--row-r)}
.fe-dp-preview[data-view="md"]>.fe-dp-pre,.fe-dp-preview[data-view="raw"]>.fe-dp-md{display:none}
.fe-dp-rawbtn{float:right;margin:0 0 var(--sp-2) var(--sp-4)}
.fe-dp-preview>.fe-dp-pre{padding:0;background:none}
.fe-dp-pre{margin:0;padding:var(--sp-4);overflow-x:auto;font-family:var(--mono);font-size:var(--fs-sm);white-space:pre;background:var(--s2);border-radius:var(--row-r)}
.fe-dp-slots{display:grid;grid-template-columns:max-content 1fr;gap:var(--sp-2) var(--sp-4);margin:0}
.fe-dp-slot{display:contents}
.fe-dp-slot dt{font-size:var(--fs-xs);font-weight:650;letter-spacing:.06em;color:var(--dm)}
.fe-dp-slot dd{margin:0;color:var(--tx)}
.fe-dp-addnote{flex:none}
.fe-dp-card.has-note .fe-dp-addnote{color:var(--ac)}
.fe-dp-note textarea,.fe-dp-end textarea{width:100%}
.fe-dp-end{display:flex;flex-direction:column;gap:var(--sp-3);padding:var(--sp-6)}
#fe-dp.flagged-only .fe-dp-card:not([data-flag]),#fe-dp.flagged-only .fe-dp-grp:not(:has(.fe-dp-card[data-flag])){display:none}
/* Parts that start hidden and are shown by clearing their hidden attribute. */
#fe-ql-ai[hidden],#fe-ql-ai-out[hidden],#fe-ed-hist[hidden],#fe-fe-banner[hidden],#fe-fe[hidden],.fe-dlg[hidden],#fe-rc-tabs-sec[hidden],
#fe-sg-panel[hidden],#fe-filter-bar[hidden],#fe-find-depth-wrap[hidden],#fe-st-term-custom-row[hidden],#fe-st-export-out[hidden],#fe-ed-file[hidden],#fe-st-import-file[hidden]{display:none}
/* Reduced motion, in one place: the motion tokens go to zero and anything left still settles at once. */
@media (prefers-reduced-motion:reduce){
  :root,#fe{--t-fast:0ms;--t-base:0ms;--t-slow:0ms}
  #fe-hint{transition:none}
  #fe-allow{animation:none}
  #fe *,#fe *::before,#fe *::after{animation-duration:var(--t-off)!important;animation-iteration-count:1!important;transition-duration:var(--t-off)!important}
}

/* Narrow windows keep the reading column usable: the listing drops its
   lesser columns, Contents gives way to the text, and the sidebar is held
   to a share of the width (max-width beats a dragged inline width). */
@container fe-main (max-width:480px){
  .c-tp,.c-tg{display:none}
}
@container fe-main (max-width:480px){
  .c-dt{display:none}
}
/* A narrow window keeps the card out of the text until it is asked for;
   then it floats over the right side (the peek state, set in file-page.ts). */
@media (max-width:720px){
  #fe-toc-rail:not(.peek){display:none}
  #fe-toc-rail.peek{width:min(300px,calc(100% - 24px));right:12px}
}
@media (max-width:720px){
  #fe-side{max-width:42vw}
  #fe-side{width:clamp(180px,30vw,220px)}
  #fe-body{padding:var(--sp-3)}
  #fe-side-rz{width:6px}
  #fe-qlook.side{margin-left:var(--sp-3)}
}
/* A narrow dialog, in a small window or in the sidebar: the tabs run across the top. */
@container dlg (max-width:720px){
  .fe-dlg-box{grid-template-columns:minmax(0,1fr);grid-template-rows:auto auto minmax(0,1fr)}
  .fe-dlg-title{border-right:0}
  .fe-dlg-tabs{grid-row:2;flex-direction:row;border-right:0;border-bottom:1px solid var(--bd)}
  .fe-dlg-tab{flex:none}
  .fe-dlg-tab i{display:none}
  .fe-dlg-pane{grid-column:1;grid-row:3}
  /* Settings rows stack: the label, then the control the full width. Written
     one step more specific than the wide rules in styles-ui.ts, which come later. */
  .fe-set-card .fe-set{flex-direction:column;align-items:stretch;gap:var(--sp-4)}
  .fe-set > .fe-set-c{max-width:none;justify-content:flex-start}
  .fe-set-c .fe-set-sws.grid4{grid-template-columns:repeat(auto-fill,minmax(68px,1fr));justify-content:start}
  .fe-set-sws.grid8{grid-template-columns:repeat(auto-fill,minmax(56px,1fr))}
  .fe-set-c .fe-set-sws{width:100%;justify-content:flex-start}
  /* Help: one column of cards; the page header needs no room for the buttons. */
  .fe-dlg-pane .fe-hcs{grid-template-columns:minmax(0,1fr)}
  .fe-dlg-ph{padding-right:var(--sp-8)}
  .fe-km-g .fe-km-i{flex-wrap:wrap;padding-block:var(--sp-2)}
  .fe-km-i .fe-km-k{flex-wrap:wrap;margin-left:auto}
}
`;var dt=`
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
#fe[data-palette="mocha"],html:has(#fe[data-palette="mocha"]){
  --bg:#1e1e2e;--s1:#232334;--s2:#2a2a3c;--s3:#313244;--bd:#313244;--bd2:#45475a;--tx:#cdd6f4;--mt:#a6adc8;--dm:#8a8fa8;--ac:#cba6f7;--tx-on-ac:#1e1e2e;--dir:#a6adc8}
#fe[data-palette="mocha"][data-theme="light"],html:has(#fe[data-palette="mocha"][data-theme="light"]){
  --bg:#eff1f5;--s1:#ffffff;--s2:#e6e9ef;--s3:#dce0e8;--bd:#dce0e8;--bd2:#bcc0cc;--tx:#4c4f69;--mt:#5c5f77;--dm:#646880;--ac:#8839ef;--tx-on-ac:#ffffff;--dir:#6c6f85}
#fe[data-palette="solar"],html:has(#fe[data-palette="solar"]){
  --bg:#002b36;--s1:#05323e;--s2:#073642;--s3:#0d4250;--bd:#0d3f4b;--bd2:#1a5463;--tx:#eee8d5;--mt:#93a1a1;--dm:#849597;--ac:#e0a800;--tx-on-ac:#002b36;--dir:#93a1a1}
#fe[data-palette="solar"][data-theme="light"],html:has(#fe[data-palette="solar"][data-theme="light"]){
  --bg:#fdf6e3;--s1:#fffbef;--s2:#eee8d5;--s3:#e4dcc4;--bd:#e6dfc8;--bd2:#d3c9ab;--tx:#073642;--mt:#586e75;--dm:#5b7178;--ac:#8a6700;--tx-on-ac:#ffffff;--dir:#657b82}
#fe[data-palette="grove"],html:has(#fe[data-palette="grove"]){
  --bg:#1d2021;--s1:#242526;--s2:#2c2a29;--s3:#3c3836;--bd:#3c3836;--bd2:#504945;--tx:#ebdbb2;--mt:#bdae93;--dm:#a89984;--ac:#b8bb26;--tx-on-ac:#1d2021;--dir:#bdae93}
#fe[data-palette="grove"][data-theme="light"],html:has(#fe[data-palette="grove"][data-theme="light"]){
  --bg:#f9f5d7;--s1:#fffbe8;--s2:#f2e5bc;--s3:#ebdbb2;--bd:#e5d6aa;--bd2:#d5c4a1;--tx:#3c3836;--mt:#665c54;--dm:#74685d;--ac:#6e6a0c;--tx-on-ac:#ffffff;--dir:#7c6f64}
#fe[data-palette="velvet"],html:has(#fe[data-palette="velvet"]){
  --bg:#22212c;--s1:#282a36;--s2:#2f3140;--s3:#383a4c;--bd:#363849;--bd2:#4a4d63;--tx:#f8f8f2;--mt:#b9bccf;--dm:#9195b0;--ac:#ff79c6;--tx-on-ac:#22212c;--dir:#b9bccf}
#fe[data-palette="velvet"][data-theme="light"],html:has(#fe[data-palette="velvet"][data-theme="light"]){
  --bg:#f7f5fb;--s1:#ffffff;--s2:#efebf6;--s3:#e3ddef;--bd:#e2dcee;--bd2:#cdc4e0;--tx:#282a36;--mt:#565975;--dm:#6b6e8b;--ac:#b4237a;--tx-on-ac:#ffffff;--dir:#626582}
#fe[data-palette="coral"],html:has(#fe[data-palette="coral"]){
  --bg:#161211;--s1:#1e1817;--s2:#271f1d;--s3:#322826;--bd:#322826;--bd2:#483a37;--tx:#f4ebe8;--mt:#c2aca6;--dm:#9f8984;--ac:#ff7b6b;--tx-on-ac:#161211;--dir:#c2aca6}
#fe[data-palette="coral"][data-theme="light"],html:has(#fe[data-palette="coral"][data-theme="light"]){
  --bg:#fcf3f1;--s1:#ffffff;--s2:#f7e8e4;--s3:#eed8d2;--bd:#edd9d3;--bd2:#dfc2ba;--tx:#2d1b17;--mt:#6f524b;--dm:#84665f;--ac:#c13a29;--tx-on-ac:#ffffff;--dir:#7b5d56}
#fe[data-palette="neon"],html:has(#fe[data-palette="neon"]){
  --bg:#1a1b26;--s1:#1f2030;--s2:#24283b;--s3:#2c3047;--bd:#2a2e42;--bd2:#3b4261;--tx:#c0caf5;--mt:#9aa5ce;--dm:#7d86aa;--ac:#7dcfff;--tx-on-ac:#1a1b26;--dir:#9aa5ce}
#fe[data-palette="neon"][data-theme="light"],html:has(#fe[data-palette="neon"][data-theme="light"]){
  --bg:#e9ebf3;--s1:#ffffff;--s2:#e1e4ef;--s3:#d3d8e8;--bd:#d5d9e7;--bd2:#bcc2d8;--tx:#343b58;--mt:#4c5578;--dm:#5e6688;--ac:#0b6f8f;--tx-on-ac:#ffffff;--dir:#5a6385}
#fe[data-palette="matcha"],html:has(#fe[data-palette="matcha"]){
  --bg:#12140f;--s1:#191c15;--s2:#20241b;--s3:#2a2f23;--bd:#292e22;--bd2:#3c4331;--tx:#ecefe2;--mt:#b0b79d;--dm:#90977e;--ac:#b5d36b;--tx-on-ac:#12140f;--dir:#b0b79d}
#fe[data-palette="matcha"][data-theme="light"],html:has(#fe[data-palette="matcha"][data-theme="light"]){
  --bg:#f4f5ec;--s1:#fefff8;--s2:#ecefe0;--s3:#e0e5cf;--bd:#dfe3cf;--bd2:#c9d0b0;--tx:#22261a;--mt:#545c42;--dm:#687056;--ac:#557311;--tx-on-ac:#ffffff;--dir:#626a4e}
#fe[data-palette="plum"],html:has(#fe[data-palette="plum"]){
  --bg:#18121a;--s1:#1f1722;--s2:#281d2c;--s3:#332538;--bd:#322537;--bd2:#47354e;--tx:#f1e9f3;--mt:#bba7c1;--dm:#98859e;--ac:#f2c14e;--tx-on-ac:#18121a;--dir:#bba7c1}
#fe[data-palette="plum"][data-theme="light"],html:has(#fe[data-palette="plum"][data-theme="light"]){
  --bg:#f8f2f9;--s1:#ffffff;--s2:#f1e7f3;--s3:#e6d7e9;--bd:#e5d6e8;--bd2:#d2bdd6;--tx:#2a1a2e;--mt:#634f68;--dm:#7a657f;--ac:#865700;--tx-on-ac:#ffffff;--dir:#705a75}
.fe-set-thumb[data-p="ocean"]{--a:#4da3ff;--b:#19222f}
.fe-set-thumb[data-p="forest"]{--a:#5fc77a;--b:#1a231d}
.fe-set-thumb[data-p="ember"]{--a:#ff8a3d;--b:#251d17}
.fe-set-thumb[data-p="nord"]{--a:#88c0d0;--b:#2c323c}
#fe[data-theme="light"] .fe-set-thumb[data-p="ocean"]{--a:#1f6fd1;--b:#eef3f9}
#fe[data-theme="light"] .fe-set-thumb[data-p="forest"]{--a:#2e8b47;--b:#f0f4ef}
#fe[data-theme="light"] .fe-set-thumb[data-p="ember"]{--a:#c85a12;--b:#f8f2ec}
#fe[data-theme="light"] .fe-set-thumb[data-p="nord"]{--a:#5e81ac;--b:#eceff4}
.fe-set-thumb[data-p="mocha"]{--a:#cba6f7;--b:#2a2a3c}
.fe-set-thumb[data-p="solar"]{--a:#e0a800;--b:#073642}
.fe-set-thumb[data-p="grove"]{--a:#b8bb26;--b:#2c2a29}
.fe-set-thumb[data-p="velvet"]{--a:#ff79c6;--b:#2f3140}
.fe-set-thumb[data-p="coral"]{--a:#ff7b6b;--b:#271f1d}
.fe-set-thumb[data-p="neon"]{--a:#7dcfff;--b:#24283b}
.fe-set-thumb[data-p="matcha"]{--a:#b5d36b;--b:#20241b}
.fe-set-thumb[data-p="plum"]{--a:#f2c14e;--b:#281d2c}
#fe[data-theme="light"] .fe-set-thumb[data-p="mocha"]{--a:#8839ef;--b:#eff1f5}
#fe[data-theme="light"] .fe-set-thumb[data-p="solar"]{--a:#8a6700;--b:#fdf6e3}
#fe[data-theme="light"] .fe-set-thumb[data-p="grove"]{--a:#6e6a0c;--b:#f9f5d7}
#fe[data-theme="light"] .fe-set-thumb[data-p="velvet"]{--a:#b4237a;--b:#f7f5fb}
#fe[data-theme="light"] .fe-set-thumb[data-p="coral"]{--a:#c13a29;--b:#fcf3f1}
#fe[data-theme="light"] .fe-set-thumb[data-p="neon"]{--a:#0b6f8f;--b:#e9ebf3}
#fe[data-theme="light"] .fe-set-thumb[data-p="matcha"]{--a:#557311;--b:#f4f5ec}
#fe[data-theme="light"] .fe-set-thumb[data-p="plum"]{--a:#865700;--b:#f8f2f9}
/* System: half dark, half light. */
#fe .fe-set-thumb[data-mode="system"]{--a:var(--ac);--b:#1c2328;--t:#fff;--c:#131a1e;background:linear-gradient(135deg,var(--thumb-dark) 50%,var(--thumb-light) 50%)}
#fe .fe-set-thumb[data-mode="system"] .sb{background:linear-gradient(135deg,var(--thumb-dark-2) 50%,var(--thumb-light-2) 50%)}


/* Settings rows: a wide row puts its control under the label. */
.fe-set.wide{flex-direction:column;align-items:stretch;gap:var(--sp-4)}
.fe-set.wide .fe-set-c{max-width:none;justify-content:flex-start}
.fe-set.wide .fe-set-tx:has(.fe-set-l:empty){gap:0}
.fe-set-c{display:flex;align-items:center;justify-content:flex-end;gap:var(--sp-4);flex:none;max-width:70%;flex-wrap:wrap}
#fe-st-term-hint{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--mono);font-size:var(--fs-sm)}
.fe-set-sws.grid4{display:grid;grid-template-columns:repeat(4,max-content);gap:var(--sp-2) var(--sp-4);justify-content:end}
/* Theme: mode and palette side by side, each named above its swatches; the
   palettes sit eight to a row in smaller windows. */
.fe-set-theme{align-items:flex-start;gap:var(--sp-8)}
.fe-set-pick{display:flex;flex-direction:column;gap:var(--sp-3);min-width:0}
.fe-set-pick:last-child{flex:1}
.fe-set-pick .fe-set-sws{justify-content:flex-start}
.fe-set-sws.grid8{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:var(--sp-1) var(--sp-2)}
.fe-set-sws.grid8 .fe-set-sw{padding:var(--sp-2) 0;gap:var(--sp-2);font-size:var(--fs-sm)}
.fe-set-sws.grid8 .fe-set-thumb{width:100%;max-width:56px;height:var(--ctl-lg)}
.fe-set-sws.grid8 .fe-set-thumb .sb{width:13px}
.fe-set-sws.grid8 .fe-set-thumb .r1{left:19px;top:7px;width:24px}
.fe-set-sws.grid8 .fe-set-thumb .r2{left:19px;top:13px;width:16px}
.fe-set-sws.grid8 .fe-set-thumb .pill{left:19px;bottom:5px;width:16px;height:var(--sp-3)}

/* Icon button: no fill until hovered. */
.fe-ibtn{flex:none}




/* Segmented: a row of buttons with one on (docs/system/segmented.md). The
   group is one control high, md 28 (the default) or lg 32 with data-size;
   its items are 4px shorter, rounded squares inside it. An item with only
   an icon is square. */
.fe-seg{--seg-h:var(--ctl-md);display:inline-flex;align-items:stretch;gap:var(--sp-1);height:var(--seg-h);padding:var(--sp-1);box-sizing:border-box;border-radius:var(--row-r);
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
.fe-sld{display:inline-flex;align-items:center;gap:var(--sp-5);width:240px;--pct:50%}
.fe-sld input{flex:1;min-width:0;height:20px;margin:0;background:none;appearance:none;-webkit-appearance:none;cursor:pointer}
.fe-sld input::-webkit-slider-runnable-track{height:4px;border-radius:2px;
  background:linear-gradient(90deg,var(--ac) var(--pct),color-mix(in srgb,var(--tx) 14%,transparent) var(--pct))}
.fe-sld input::-webkit-slider-thumb{-webkit-appearance:none;width:16px;height:16px;margin-top:-6px;border-radius:50%;background:rgb(var(--paper));
  box-shadow:0 0 0 1px rgb(var(--ink) / .14),0 1px 3px rgb(var(--ink) / .3);transition:transform var(--t-fast) var(--ease)}
.fe-sld input:hover::-webkit-slider-thumb{transform:scale(1.12)}
.fe-sld input:focus-visible::-webkit-slider-thumb{box-shadow:0 0 0 3px color-mix(in srgb,var(--ac) 40%,transparent),0 1px 3px rgb(var(--ink) / .3)}
.fe-sld output{min-width:48px;padding:var(--sp-2) var(--sp-4);border-radius:var(--r-sm);background:color-mix(in srgb,var(--tx) 6%,transparent);font:500 var(--fs-md) var(--mono);color:var(--tx);text-align:center}

/* A dropdown button and its list. */
.fe-dd{--dd-h:var(--ctl-md);display:inline-flex}
.fe-dd[data-size="lg"]{--dd-h:var(--ctl-lg)}
.fe-dd-btn{display:inline-flex;align-items:center;gap:var(--sp-4);min-width:160px;height:var(--dd-h);padding:0 var(--sp-4);border:1px solid var(--bd2);border-radius:var(--row-r);background:var(--bg);
  color:var(--tx);font:inherit;font-size:var(--type-ui);cursor:pointer;transition:border-color var(--t-fast) var(--ease)}
/* The same surface and hairline as a TextBox: fields and dropdowns read as one family. */
.fe-dd-btn:hover{border-color:color-mix(in srgb,var(--mt) 60%,var(--bd2))}
.fe-dd-btn[aria-expanded="true"]{border-color:var(--ac)}
.fe-dd-btn:focus-visible{outline:2px solid var(--ac);outline-offset:1px}
.fe-dd-cur{flex:1;display:flex;align-items:center;gap:var(--sp-4);min-width:0;text-align:left}
.fe-dd-cur span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fe-dd-cur svg{flex:none;width:14px;height:14px;color:var(--mt)}
.fe-dd-btn > svg{flex:none;color:var(--dm)}
.fe-dd-none{color:var(--dm)}
.fe-dd-list{position:fixed;z-index:var(--z-toast);max-height:min(360px,60vh);overflow-y:auto;padding:var(--sp-2);border-radius:var(--pop-r);
  background:var(--pop-bg);border:1px solid var(--pop-bd);box-shadow:var(--pop-sh);backdrop-filter:var(--pop-blur);-webkit-backdrop-filter:var(--pop-blur);animation:fe-rise var(--t-fast) var(--ease)}
.fe-dd-opt{display:flex;align-items:center;gap:var(--sp-4);min-height:var(--ctl-lg);padding:0 var(--sp-4);border-radius:7px;color:var(--tx);font-size:var(--row-fs);cursor:pointer;white-space:nowrap}
.fe-dd-opt svg{flex:none;width:14px;height:14px;color:var(--mt)}
.fe-dd-l{flex:1}
.fe-dd-h{color:var(--dm);font-size:var(--fs-sm);padding-left:var(--sp-5)}
.fe-dd-g{padding:var(--sp-4) var(--sp-5) var(--sp-2);color:var(--dm);font-size:var(--fs-sm);font-weight:600}
.fe-dd-g:first-child{padding-top:var(--sp-2)}
/* Chip: a short label in a pill (docs/system/chip.md). Class chip. Tags,
   filters and facts. --chip carries a tag's colour for the border, the dot
   and the fill. data-size: sm 18 for listing rows, md 22 (the default).
   data-fill: a soft fill instead of a border. data-tone: due, done, quiet.
   A button chip is a filter: on with .on or aria-pressed. A removable chip
   ends in an xs Button. */
.chip{--chip-h:var(--ctl-sm);display:inline-flex;align-items:center;gap:var(--sp-2);max-width:100%;height:var(--chip-h);padding:0 var(--sp-4);box-sizing:border-box;
  border:1px solid color-mix(in srgb,var(--chip,var(--bd2)) 55%,transparent);border-radius:var(--r-full);background:none;color:var(--mt);
  font:inherit;font-size:var(--type-small);line-height:1;white-space:nowrap;vertical-align:middle}
.chip[data-size="sm"]{--chip-h:var(--ctl-xs);padding:0 var(--sp-3);font-size:var(--fs-sm)}
.chip > svg{flex:none;width:12px;height:12px}
.chip > i{flex:none;width:6px;height:6px;border-radius:var(--r-full);background:var(--dot)}
.chip > span{min-width:0;overflow:hidden;text-overflow:ellipsis}
.chip:has(> .btn:last-child){padding-right:var(--sp-1)}
.chip[data-fill]{border-color:transparent;background:color-mix(in srgb,var(--chip,var(--ac)) 16%,transparent);color:var(--tx)}
.chip[data-tone="due"]{--chip:var(--nc-orange)}
.chip[data-tone="done"]{--chip:var(--nc-green)}
.chip[data-tone="quiet"]{background:var(--s2);color:var(--mt)}
.chip[data-mono]{font-family:var(--mono)}
.chip[data-add]{border-style:dashed}
button.chip{cursor:pointer;transition:background var(--t-fast) var(--ease),color var(--t-fast) var(--ease),border-color var(--t-fast) var(--ease)}
button.chip:not(:disabled):hover{color:var(--tx);background:var(--hover)}
button.chip[data-add]:not(:disabled):hover{border-style:solid;border-color:var(--ac)}
.chip.on,.chip[aria-pressed="true"],button.chip.on:hover{color:var(--tx);background:color-mix(in srgb,var(--chip,var(--ac)) 22%,transparent)}
button.chip:focus-visible{outline:2px solid var(--ac);outline-offset:1px}
button.chip:disabled{opacity:.45;cursor:default}
/* Badge: a count in a small pill (docs/system/badge.md). Class badge.
   data-size: sm 14 on an icon's corner, md 18 (the default). data-tone:
   soft (the default), solid, quiet. Empty, it hides. */
.badge{--badge-h:18px;display:inline-flex;align-items:center;justify-content:center;gap:var(--sp-1);min-width:var(--badge-h);height:var(--badge-h);padding:0 var(--sp-2);
  box-sizing:border-box;border-radius:var(--r-full);background:color-mix(in srgb,var(--ac) 16%,transparent);color:var(--tx);
  font-size:var(--fs-xs);font-weight:500;line-height:1;font-variant-numeric:tabular-nums;white-space:nowrap;vertical-align:middle}
.badge[data-size="sm"]{--badge-h:14px;padding:0 var(--sp-2)}
.badge svg{flex:none;width:10px;height:10px}
.badge[data-tone="solid"]{background:var(--ac);color:var(--tx-on-ac)}
.badge[data-tone="quiet"]{background:var(--s2);color:var(--dm)}
.badge:empty{display:none}
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
.fe-chipin{display:flex;flex-wrap:wrap;align-items:center;gap:var(--sp-2);width:300px;max-width:100%;min-height:var(--ctl-lg);padding:var(--sp-1) var(--sp-3);box-sizing:border-box;border:1px solid var(--bd2);border-radius:var(--row-r);background:var(--bg);cursor:text}
.fe-set.wide .fe-chipin{width:100%}
.fe-chipin:focus-within{border-color:var(--ac)}
.fe-chipin-in{flex:1;min-width:70px;height:24px;border:0;outline:0;background:none;color:var(--tx);font:var(--fs-md) var(--mono)}

/* App icons: a grid of 16 tiles. */
.fe-appicons{display:grid;grid-template-columns:repeat(8,1fr);gap:var(--sp-3)}
.fe-appicon{position:relative;display:flex;flex-direction:column;align-items:center;gap:var(--sp-2);padding:var(--sp-4) var(--sp-2) var(--sp-3);border-radius:10px;cursor:pointer;color:var(--mt);font-size:var(--fs-sm);
  transition:background var(--t-fast) var(--ease)}
.fe-appicon:hover{background:var(--hover)}
.fe-appicon input{position:absolute;opacity:0;pointer-events:none}
.fe-appicon img{width:40px;height:var(--bar-h);border-radius:10px;box-shadow:0 1px 3px rgb(var(--ink) / .25);transition:transform var(--t-fast) var(--ease)}
.fe-appicon:hover img{transform:translateY(-1px) scale(1.04)}
.fe-appicon:has(input:checked){background:var(--on);color:var(--tx)}
.fe-appicon:has(input:checked) img{box-shadow:0 0 0 2px var(--ac),0 2px 6px rgb(var(--ink) / .25)}
.fe-appicon:has(input:focus-visible){outline:2px solid var(--ac);outline-offset:1px}

/* Icon rules. */
.fe-rule-sugg{display:flex;flex-wrap:wrap;align-items:center;gap:var(--sp-3);padding:var(--sp-5) var(--sp-6) var(--sp-2)}
.fe-rule-sugg:empty{display:none}
.fe-rule-sugg-l{font-size:var(--fs-sm);color:var(--dm);margin-right:var(--sp-1)}
.chip.fe-rule-add > svg{width:13px;height:15px}
#fe-st-rules-list{padding:var(--sp-3) var(--sp-4) var(--sp-4)}
.fe-rule{display:grid;grid-template-columns:auto auto 1fr auto auto;align-items:center;gap:var(--sp-4);padding:var(--sp-3);border-radius:9px}
.fe-rule:hover{background:var(--hover)}
.fe-rule.off .fe-rule-ico,.fe-rule.off .fe-st-rule-pattern{opacity:.45}
.fe-switch.sm{width:28px;height:16px;border-radius:var(--row-r)}
.fe-switch.sm::after{width:12px;height:12px}
.fe-switch.sm:checked::after{transform:translateX(12px)}
.fe-rule-ico{display:grid;place-items:center;width:34px;height:34px;padding:0;border:1px solid var(--bd2);border-radius:9px;background:var(--card);cursor:pointer}
.fe-rule-ico:hover{border-color:var(--ac)}
.fe-rule-ico svg{width:18px;height:20px}
.fe-st-rule-pattern{width:100%}
.fe-rule-n{min-width:26px;padding:var(--sp-1) var(--sp-3);border-radius:10px;background:color-mix(in srgb,var(--tx) 7%,transparent);color:var(--mt);font:500 var(--fs-sm) var(--mono);text-align:center}
.fe-rule-pop{position:fixed;width:330px;padding:var(--sp-5);border-radius:var(--pop-r);display:flex;flex-direction:column;gap:var(--sp-5);
  background:var(--pop-bg);border:1px solid var(--pop-bd);box-shadow:var(--pop-sh);backdrop-filter:var(--pop-blur);-webkit-backdrop-filter:var(--pop-blur);animation:fe-rise var(--t-fast) var(--ease)}
.fe-rp-sec{display:flex;flex-direction:column;gap:var(--sp-3)}
.fe-rp-l{font-size:var(--fs-xs);font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--dm)}
.fe-rp-glyphs{display:grid;grid-template-columns:repeat(9,1fr);gap:var(--sp-2)}
.fe-rp-g{display:grid;place-items:center;height:34px;padding:0;border:0;border-radius:7px;background:none;cursor:pointer}
.fe-rp-g svg{width:20px;height:var(--ctl-sm)}
.fe-rp-g:hover{background:var(--hover)}
.fe-rp-g.on{background:var(--on);box-shadow:inset 0 0 0 1.5px var(--ac)}
.fe-rp-label{width:90px}
.fe-rp-sw{display:grid;grid-template-columns:repeat(8,1fr);gap:var(--sp-3);align-items:center}
.fe-rp-c{width:26px;height:26px;padding:0;border:0;border-radius:50%;background:var(--c);cursor:pointer;box-shadow:inset 0 0 0 1px rgb(var(--ink) / .15);transition:transform var(--t-fast) var(--ease)}
.fe-rp-c:hover{transform:scale(1.1)}
.fe-rp-c.on{box-shadow:0 0 0 2px var(--card),0 0 0 4px var(--c)}
.fe-rp-c:focus-visible,.fe-rp-g:focus-visible{outline:2px solid var(--ac);outline-offset:1px}
.fe-rp-hex{grid-column:span 4}

/* AI: a status line on top, then the model controls and the list. */
.fe-ai-hero{display:flex;align-items:center;gap:var(--sp-5);padding:var(--sp-6) 18px;border-radius:14px;background:linear-gradient(135deg,color-mix(in srgb,var(--nc-purple) 18%,var(--card)),var(--card));
  border:1px solid color-mix(in srgb,var(--nc-purple) 30%,var(--bd))}
.fe-ai-hero .fe-st-ai-head{margin:0}
.fe-ai-hero .fe-st-ai-blink,.fe-ai-hero .fe-st-ai-blink .dot{width:12px;height:12px}
.fe-ai-hero-tx{flex:1;display:flex;flex-direction:column;gap:var(--sp-2);min-width:0}
.fe-ai-hero-tx b{font-size:var(--fs-xl);font-weight:650;color:var(--tx)}
.fe-ai-hero-tx span{font-size:var(--fs-md);color:var(--mt);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#fe-st-ai-grid{display:grid;grid-template-columns:auto 1fr;gap:var(--sp-2) var(--sp-5);padding:var(--sp-4) var(--sp-6) var(--sp-5);border-top:1px solid color-mix(in srgb,var(--bd) 70%,transparent)}
#fe-st-ai-grid:empty{display:none}
.fe-st-ai-hint code{background:var(--bg);border:1px solid var(--bd);border-radius:3px;padding:0 var(--sp-2);font-size:var(--fs-sm);color:var(--mt);font-family:var(--mono)}
.fe-dm{color:var(--dm)}
.fe-ai-models{display:flex;flex-direction:column;padding:var(--sp-3)}
.fe-ai-m{display:flex;align-items:center;gap:var(--sp-4);min-height:38px;padding:0 var(--sp-4);border-radius:9px}
.fe-ai-m:hover{background:var(--hover)}
.fe-ai-m svg{flex:none;width:15px;height:15px;color:var(--mt)}
.fe-ai-m b{font-size:var(--row-fs);font-weight:550;color:var(--tx)}
.fe-ai-m-id{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:var(--fs-sm) var(--mono);color:var(--dm)}
.fe-ai-where{padding:var(--sp-1) var(--sp-4);border-radius:10px;font-size:var(--fs-sm);background:color-mix(in srgb,var(--nc-green) 16%,transparent);color:var(--nc-green)}
.fe-ai-where.cloud{background:color-mix(in srgb,var(--nc-blue) 16%,transparent);color:var(--nc-blue)}
.fe-ai-def{padding:var(--sp-1) var(--sp-4);border-radius:10px;font-size:var(--fs-sm);background:var(--on);color:var(--ac)}

/* The command palette. */
.fe-pal-wrap{position:fixed;inset:0;z-index:var(--z-tip);display:flex;justify-content:center;align-items:flex-start;padding-top:12vh;background:rgb(var(--ink) / .32);animation:fe-fade var(--t-fast) var(--ease)}
.fe-pal{width:min(640px,calc(100vw - 32px));max-height:min(560px,72vh);display:flex;flex-direction:column;border-radius:16px;overflow:hidden;
  background:var(--card);border:1px solid var(--pop-bd);box-shadow:0 24px 64px rgb(var(--ink) / .45),0 2px 8px rgb(var(--ink) / .25);animation:fe-rise var(--t-base) var(--ease)}
.fe-pal-q{display:flex;align-items:center;gap:var(--sp-4);padding:var(--sp-5) var(--sp-6);border-bottom:1px solid var(--bd);color:var(--dm)}
.fe-pal-q input{flex:1;border:0;outline:0;background:none;color:var(--tx);font:inherit;font-size:var(--fs-xl)}
.fe-pal-list{flex:1;overflow-y:auto;padding:var(--sp-3)}
/* Palette tabs: one per kind of entry, each with its own colour, which the
   entries of that kind share. */
.fe-pal-tabs{flex:none;display:flex;gap:var(--sp-1);padding:var(--sp-2) var(--sp-3);border-bottom:1px solid var(--bd);overflow-x:auto;scrollbar-width:none}
.fe-pal-tab{display:inline-flex;align-items:center;gap:var(--sp-2);flex:none;height:var(--ctl-md);padding:0 var(--sp-3);border:0;border-radius:var(--r-full);background:none;color:var(--mt);font:inherit;font-size:var(--fs-sm);cursor:pointer;transition:background var(--t-fast),color var(--t-fast)}
.fe-pal-tab svg{width:1.1em;height:1.1em;color:var(--tab-c,var(--mt))}
.fe-pal-tab i{font-style:normal;color:var(--dm);font-size:var(--fs-xs)}
.fe-pal-tab:hover{background:var(--hover);color:var(--tx)}
.fe-pal-tab.on{background:color-mix(in srgb,var(--tab-c,var(--ac)) 16%,transparent);color:var(--tx)}
.fe-pal-tab.is-empty{opacity:.45}
.fe-pal-tab[data-tab="actions"],.fe-pal-i[data-tab="actions"]{--tab-c:var(--ac)}
.fe-pal-tab[data-tab="tabs"],.fe-pal-i[data-tab="tabs"]{--tab-c:var(--nc-blue)}
.fe-pal-tab[data-tab="saved"],.fe-pal-i[data-tab="saved"]{--tab-c:var(--nc-yellow)}
.fe-pal-tab[data-tab="recent"],.fe-pal-i[data-tab="recent"]{--tab-c:var(--nc-purple)}
.fe-pal-tab[data-tab="notes"],.fe-pal-i[data-tab="notes"]{--tab-c:var(--nc-green)}
.fe-pal-tab[data-tab="here"],.fe-pal-i[data-tab="here"]{--tab-c:var(--dir)}
.fe-pal-tab[data-tab="comments"],.fe-pal-i[data-tab="comments"]{--tab-c:var(--nc-orange)}
.fe-pal-tab[data-tab="chats"],.fe-pal-i[data-tab="chats"]{--tab-c:var(--nc-pink)}
.fe-pal-g{padding:var(--sp-4) var(--sp-4) var(--sp-2)}
.fe-pal-i{display:flex;align-items:center;gap:var(--sp-4);min-height:36px;padding:0 var(--sp-4);border-radius:9px;color:var(--tx);font-size:var(--row-fs);cursor:pointer}
.fe-pal-i svg{flex:none;width:16px;height:16px;color:var(--tab-c,var(--mt))}
.fe-pal-t{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fe-pal-s{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--dm);font-size:var(--fs-sm)}
.fe-pal-i kbd,.fe-pal kbd,.fe-chord kbd,.fe-hints kbd,#fe-hint kbd{display:inline-flex;align-items:center;justify-content:center;min-width:20px;height:20px;padding:0 var(--sp-3);border-radius:5px;
  background:color-mix(in srgb,var(--tx) 8%,transparent);box-shadow:inset 0 -1px 0 color-mix(in srgb,var(--tx) 14%,transparent);color:var(--mt);font:600 var(--fs-xs) var(--mono);white-space:nowrap}
.fe-pal-i kbd{margin-left:auto}
.fe-pal-foot{display:flex;gap:var(--sp-6);padding:var(--sp-4) var(--sp-5);border-top:1px solid var(--bd);font-size:var(--fs-sm);color:var(--dm)}
.fe-pal-foot span{display:inline-flex;align-items:center;gap:var(--sp-2)}

/* A key sequence waiting for its second key. */
.fe-chord{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:var(--z-tip);display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:var(--sp-4);max-width:min(720px,90vw);
  padding:var(--sp-4) var(--sp-5);border-radius:var(--pop-r);background:var(--pop-bg);border:1px solid var(--pop-bd);box-shadow:var(--pop-sh);backdrop-filter:var(--pop-blur);-webkit-backdrop-filter:var(--pop-blur);
  font-size:var(--fs-md);color:var(--mt);animation:fe-rise var(--t-fast) var(--ease)}
.fe-chord > kbd{background:var(--ac);color:var(--tx-on-ac);box-shadow:none}
.fe-chord-o{display:inline-flex;align-items:center;gap:var(--sp-2);color:var(--tx)}

/* Key badges while \u2325 is held. */
.fe-hints{position:fixed;inset:0;pointer-events:none}
.fe-hints > kbd{position:fixed;left:var(--x);top:var(--y);transform:translate(-50%,0);background:var(--ac);color:var(--tx-on-ac);box-shadow:0 2px 6px rgb(var(--ink) / .35);animation:fe-rise var(--t-fast) var(--ease)}
.fe-hints-tip{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);display:flex;align-items:center;gap:var(--sp-3);padding:var(--sp-4) var(--sp-5);border-radius:var(--pop-r);
  background:var(--pop-bg);border:1px solid var(--pop-bd);box-shadow:var(--pop-sh);font-size:var(--fs-md);color:var(--mt)}

/* Where the keyboard is. */
.fe-area-flash{animation:fe-area var(--t-flash) var(--ease)}
@keyframes fe-area{0%{box-shadow:inset 0 0 0 2px var(--ac)}100%{box-shadow:inset 0 0 0 2px transparent}}
#fe-side .fe-si:focus-visible,#fe-side .fe-si-link:focus-visible,#fe-side summary:focus-visible,#fe-side .fe-nt-grp:focus-visible,
#fe-tabs .fe-tab:focus-visible,#fe-bc a:focus-visible,#fe-bc button:focus-visible{outline:2px solid var(--ac);outline-offset:-2px;border-radius:var(--row-r)}

/* Help: the keyboard map. Keys with a use are tinted; hovering an action
   lights its keys, hovering a key lights its actions. */
.fe-km{display:flex;flex-direction:column;gap:var(--sp-5)}
.fe-km-board{display:flex;flex-direction:column;gap:var(--sp-2);padding:var(--sp-5);border-radius:14px;background:color-mix(in srgb,var(--tx) 4%,var(--card));
  border:1px solid var(--bd);position:sticky;top:-2px;z-index:2;box-shadow:0 8px 16px -12px rgb(var(--ink) / .4)}
.fe-km-row-k{display:flex;gap:var(--sp-2)}
.fe-km-cap{flex:var(--w,1) 1 0;min-width:0;height:34px;display:grid;place-items:center;border-radius:7px;font:500 var(--fs-sm) var(--mono);color:var(--dm);
  background:color-mix(in srgb,var(--tx) 5%,transparent);box-shadow:inset 0 -2px 0 color-mix(in srgb,rgb(var(--ink)) 22%,transparent);transition:background var(--t-fast),color var(--t-fast),transform var(--t-fast)}
.fe-km-cap.fn{height:var(--ctl-sm);font-size:var(--fs-xs)}
.fe-km-cap.used{color:var(--tx);background:color-mix(in srgb,var(--ac) 12%,transparent);cursor:pointer}
.fe-km-cap.hl{background:var(--ac);color:var(--tx-on-ac);transform:translateY(1px);box-shadow:inset 0 -1px 0 rgb(var(--ink) / .25),0 0 0 3px color-mix(in srgb,var(--ac) 30%,transparent)}
.fe-km-cap.pin{outline:2px solid var(--ac);outline-offset:2px}
.fe-km-ud{flex:1 1 0;display:flex;flex-direction:column;gap:var(--sp-1)}
.fe-km-cap.half{height:16px;font-size:9px}
.fe-km-bar{display:flex;align-items:center;gap:var(--sp-5);flex-wrap:wrap}
.fe-km-q{flex:1;min-width:200px;width:auto}
.fe-km-legend{font-size:var(--fs-sm);color:var(--dm);display:inline-flex;align-items:center;gap:var(--sp-2)}
.fe-km-list{columns:2 320px;column-gap:18px}
.fe-km-g{break-inside:avoid;margin-bottom:var(--sp-6);padding:var(--sp-2)}
.fe-km-g h3{padding:var(--sp-4) var(--sp-4) var(--sp-3)}
.fe-km-g h3 svg{width:14px;height:14px}
.fe-km-i{display:flex;align-items:center;justify-content:space-between;gap:var(--sp-4);min-height:var(--ctl-lg);padding:0 var(--sp-4);border-radius:var(--row-r);font-size:var(--row-fs);color:var(--tx)}
.fe-km-k{display:inline-flex;align-items:center;gap:var(--sp-2);flex:none}
.fe-km-k kbd,.fe-hc-how kbd,.fe-km-legend kbd{display:inline-flex;align-items:center;justify-content:center;min-width:22px;height:var(--ctl-sm);padding:0 var(--sp-3);border-radius:var(--r-sm);
  background:color-mix(in srgb,var(--tx) 8%,transparent);box-shadow:inset 0 -1.5px 0 color-mix(in srgb,var(--tx) 16%,transparent);color:var(--tx);font:600 var(--fs-xs) var(--mono)}
.fe-km-then,.fe-km-or{font-style:normal;font-size:var(--fs-xs);color:var(--dm);padding:0 var(--sp-1)}

/* Help: cards. */
.fe-hs{display:flex;flex-direction:column;gap:var(--sp-4)}
.fe-hs h3{padding:0 var(--sp-1)}
.fe-hcs{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:var(--sp-4)}
.fe-hc{display:flex;align-items:center;gap:var(--sp-5);min-height:62px;padding:var(--sp-4) var(--sp-5);
  transition:transform var(--t-fast) var(--ease),border-color var(--t-fast) var(--ease),box-shadow var(--t-fast) var(--ease)}
.fe-hc:hover{transform:translateY(-1px);border-color:color-mix(in srgb,var(--tone) 45%,var(--bd));box-shadow:0 6px 16px -10px color-mix(in srgb,var(--tone) 55%,transparent)}
.fe-hc-ico{flex:none;display:grid;place-items:center;width:36px;height:36px;border-radius:10px;color:var(--tone);background:color-mix(in srgb,var(--tone) 16%,transparent)}
.fe-hc-ico svg{width:18px;height:var(--ctl-xs)}
.fe-hc-tx{flex:1;min-width:0;display:flex;flex-direction:column;gap:var(--sp-1)}
.fe-hc-tx b{font-size:var(--fs-lg);font-weight:650;color:var(--tx)}
.fe-hc-tx span{font-size:var(--fs-md);color:var(--mt);line-height:1.35}
.fe-hc-how{flex:none;display:flex;align-items:center;gap:var(--sp-2)}
.fe-hc-tag{padding:var(--sp-1) var(--sp-4);border-radius:10px;font-size:var(--fs-sm);color:var(--tone);background:color-mix(in srgb,var(--tone) 14%,transparent)}
/* A journey card: a title, then its steps, each with its keys on the right. */
.fe-hj{display:flex;flex-direction:column;gap:var(--sp-4);padding:var(--sp-5) var(--sp-5)}
.fe-hj-h{display:flex;align-items:center;gap:var(--sp-4)}
.fe-hj-h .fe-hc-ico{width:28px;height:var(--ctl-md);border-radius:var(--row-r)}
.fe-hj-h b{font-size:var(--fs-lg);font-weight:650;color:var(--tx)}
.fe-hj-steps{display:flex;flex-direction:column;gap:var(--sp-2);margin:0;padding:0 0 0 38px;list-style:none;counter-reset:step}
.fe-hj-steps li{display:flex;align-items:center;justify-content:space-between;gap:var(--sp-4);min-height:24px;font-size:var(--fs-md);color:var(--mt);counter-increment:step}
.fe-hj-steps li::before{content:counter(step);flex:none;width:16px;font-size:var(--fs-xs);color:var(--dm)}
.fe-hj-steps li > span:first-of-type{flex:1;min-width:0}
#fe-help-modal .fe-dlg-pane.on{gap:22px}
`;function p(e){return String(e).replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}var $n={short:new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric",year:"numeric"}),full:new Intl.DateTimeFormat("en-US",{month:"long",day:"numeric",year:"numeric"})};function oe(e){return navigator.clipboard.writeText(e).then(()=>!0).catch(()=>{try{let t=document.createElement("textarea");t.value=e,document.body.appendChild(t),t.select();let a=document.execCommand("copy");return t.remove(),a}catch{return!1}})}var me=(e,t=14)=>`<svg width="${t}" height="${t}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${e}</svg>`,b=e=>me(e),ft='<path d="M9.94 15.5A2 2 0 0 0 8.5 14.06l-6.14-1.58a.5.5 0 0 1 0-.96L8.5 9.94A2 2 0 0 0 9.94 8.5l1.58-6.14a.5.5 0 0 1 .96 0l1.58 6.14a2 2 0 0 0 1.44 1.44l6.14 1.58a.5.5 0 0 1 0 .96l-6.14 1.58a2 2 0 0 0-1.44 1.44l-1.58 6.14a.5.5 0 0 1-.96 0z"/><path d="M20 3v4M22 5h-4"/>',pt='<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',ct='<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',gt='<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/><path d="M14 2v4a2 2 0 0 0 2 2h4M16 13H8M16 17H8M10 9H8"/>',m={appearance:b('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>'),preview:b('<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M15 3v18"/>'),files:b(gt),exclusions:b('<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="M9 12h6"/>'),notes:b('<path d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8z"/><path d="M15 3v4a2 2 0 0 0 2 2h4"/>'),tab:b('<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18M12 13v5M9.5 15.5h5"/>'),terminal:b('<path d="m7 11 2-2-2-2M11 13h4"/><rect width="18" height="18" x="3" y="3" rx="2"/>'),data:b('<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5M3 12a9 3 0 0 0 18 0"/>'),ai:b(ft),keyboard:b('<rect width="20" height="16" x="2" y="4" rx="2"/><path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M7 16h10"/>'),reset:b(ct),add:b('<path d="M5 12h14M12 5v14"/>'),export:b('<path d="M12 15V3M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/>'),import:b('<path d="M12 3v12M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/>'),warm:b('<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>'),unload:b('<path d="M2 12h20M12 2v20m-8.5-15L20.5 17M20.5 7 3.5 17M9 4l3 2 3-2M9 20l3-2 3 2"/>'),close:b('<path d="M18 6 6 18M6 6l12 12"/>'),more:b('<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>'),fmtBold:b('<path d="M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8"/>'),fmtItalic:b('<path d="M19 4h-9M14 20H5M15 4 9 20"/>'),fmtCode:b('<path d="m16 18 6-6-6-6M8 6l-6 6 6 6"/>'),fmtStrike:b('<path d="M16 4H9a3 3 0 0 0-2.83 4M14 12a4 4 0 0 1 0 8H6M4 12h16"/>'),fmtHeading:b('<path d="M6 12h12M6 20V4M18 20V4"/>'),fmtQuote:b('<path d="M17 6H3M21 12H8M21 18H8M3 12v6"/>'),fmtOlist:b('<path d="M10 12h11M10 18h11M10 6h11M4 10h2M4 6h1v4M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/>'),list:b('<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>'),task:b('<path d="m3 17 2 2 4-4M3 7l2 2 4-4M13 6h8M13 12h8M13 18h8"/>'),table:b('<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18M3 15h18M12 3v18"/>'),image:b('<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21"/>'),versions:b(ct+'<path d="M12 7v5l4 2"/>'),external:b('<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>'),pin:b('<path d="M12 17v5M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>'),tag:b('<path d="M12.59 2.59A2 2 0 0 0 11.17 2H4a2 2 0 0 0-2 2v7.17a2 2 0 0 0 .59 1.42l8.7 8.7a2.43 2.43 0 0 0 3.42 0l6.58-6.58a2.43 2.43 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r="1" fill="currentColor"/>'),palette:b('<path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.93 0 1.65-.75 1.65-1.69 0-.44-.18-.84-.44-1.13-.29-.29-.44-.65-.44-1.13a1.64 1.64 0 0 1 1.67-1.67h2c3.05 0 5.55-2.5 5.55-5.55C21.97 6.01 17.46 2 12 2z"/><circle cx="13.5" cy="6.5" r="1" fill="currentColor"/><circle cx="17.5" cy="10.5" r="1" fill="currentColor"/><circle cx="8.5" cy="7.5" r="1" fill="currentColor"/><circle cx="6.5" cy="12.5" r="1" fill="currentColor"/>'),zoomIn:b('<circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35M11 8v6M8 11h6"/>'),zoomOut:b('<circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35M8 11h6"/>'),actualSize:b('<rect width="18" height="18" x="3" y="3" rx="2"/><path d="m7.5 9 1.5-1v8M15 9l1.5-1v8M12 10.5v.01M12 14.5v.01"/>'),rotate:b('<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>'),flip:b('<path d="m3 7 5 5-5 5zM21 7l-5 5 5 5zM12 2v2M12 8v2M12 14v2M12 20v2"/>'),fit:b('<path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/>'),size:b('<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>'),rename:b('<path d="M21.17 6.81a1 1 0 0 0-3.99-3.99L3.84 16.17a2 2 0 0 0-.5.83l-1.32 4.35a.5.5 0 0 0 .62.62l4.35-1.32a2 2 0 0 0 .83-.5z"/><path d="m15 5 4 4"/>'),trash:b('<path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6M14 11v6"/>'),prev:b('<path d="m15 18-6-6 6-6"/>'),next:b('<path d="m9 18 6-6-6-6"/>'),folderOpen:b('<path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2"/>'),copy:b(pt),attach:b('<path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>'),opinion:b('<path d="M17 18a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2"/><rect width="18" height="18" x="3" y="4" rx="2"/><circle cx="12" cy="10" r="2"/><path d="M8 2v2M16 2v2"/>'),quote:b('<path d="M16 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z"/><path d="M5 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z"/>'),check:b('<path d="M20 6 9 17l-5-5"/>'),eye:b('<path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0"/><circle cx="12" cy="12" r="3"/>'),lock:b('<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'),clock:b('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),send:b('<path d="M12 19V5M5 12l7-7 7 7"/>'),file:b('<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/>'),comment:b('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'),contents:b('<path d="M15 12H3M17 18H3M21 6H3"/>'),info:b('<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>'),circle:b('<circle cx="12" cy="12" r="9"/>'),at:b('<circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8"/>'),stack:b('<path d="m12.83 2.18 8.58 3.9a1 1 0 0 1 0 1.83l-8.58 3.9a2 2 0 0 1-1.66 0L2.6 7.91a1 1 0 0 1 0-1.83l8.58-3.9a2 2 0 0 1 1.66 0z"/><path d="m22 12.5-9.17 4.16a2 2 0 0 1-1.66 0L2 12.5"/>'),link:b('<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>'),bot:b('<path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2M20 14h2M15 13v2M9 13v2"/>'),copyImage:b(pt)},mt={home:'<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .71-1.53l7-6a2 2 0 0 1 2.58 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',folder:'<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z"/>',docs:gt,recent:'<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',search:'<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',ask:ft,desk:'<rect width="20" height="14" x="2" y="3" rx="2"/><path d="M8 21h8M12 17v4"/>',down:'<path d="M12 15V3M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/>',code:'<path d="m16 18 6-6-6-6M8 6l-6 6 6 6"/>',pics:'<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21"/>',apps:'<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>',root:'<path d="M22 12H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11zM6 16h.01M10 16h.01"/>',scrnsh:'<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><path d="m8 12 3 3 5-6"/>',bm:'<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>',tabset:'<path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65M22 12.65l-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',help:'<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01"/>',gear:'<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>'};var Ie={column:'<svg width="13" height="13" viewBox="0 0 13 13" aria-hidden="true"><rect x="1.5" y="1.5" width="10" height="10" rx="1" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M4 1.5v10M9 1.5v10" stroke="currentColor" stroke-width="1.1"/></svg>',edit:'<svg width="13" height="13" viewBox="0 0 13 13" aria-hidden="true"><path d="M8.5 2.5l2 2L4.5 10.5H2.5v-2z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>',wrap:'<svg width="13" height="13" viewBox="0 0 13 13" aria-hidden="true"><path d="M1.5 3.5h10M1.5 6.5h8a2 2 0 0 1 0 4H7m1.5-1.5L7 10.5 8.5 12M1.5 9.5h3" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>',raw:'<svg width="13" height="13" viewBox="0 0 13 13" aria-hidden="true"><path d="M4.5 3 1.5 6.5 4.5 10M8.5 3l3 3.5-3 3.5" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>',copyPage:'<svg width="13" height="13" viewBox="0 0 13 13" aria-hidden="true"><rect x="4" y="4" width="7" height="7" rx="1" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M2 9H1.5V2a.5.5 0 0 1 .5-.5h7V2" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>',find:'<svg width="13" height="13" viewBox="0 0 13 13" aria-hidden="true"><circle cx="5.5" cy="5.5" r="3.8" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M8.4 8.4 11.5 11.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>',prev:'<svg width="11" height="11" viewBox="0 0 11 11" aria-hidden="true"><path d="M2.5 7 5.5 4l3 3" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',next:'<svg width="11" height="11" viewBox="0 0 11 11" aria-hidden="true"><path d="M2.5 4l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',eye:'<svg width="12" height="12" viewBox="0 0 13 13"><path d="M1 6.5C2.5 3 4.8 1.5 6.5 1.5S10.5 3 12 6.5C10.5 10 8.2 11.5 6.5 11.5S2.5 10 1 6.5z" fill="none" stroke="currentColor" stroke-width="1.2"/><circle cx="6.5" cy="6.5" r="2" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>',copySmall:'<svg width="11" height="12" viewBox="0 0 11 12"><rect x="3" y="3" width="7" height="8" rx="1" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M1 1h6v1" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>',lines:'<svg width="11" height="11" viewBox="0 0 11 11"><path d="M2 3h7M2 6h7M2 9h4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>',filter:'<svg width="14" height="14" viewBox="0 0 14 14"><path d="M1.5 2h11l-4.2 5v4.5l-2.6-1.3V7z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>',dock:'<svg width="13" height="13" viewBox="0 0 13 13"><rect x="1" y="1.5" width="11" height="10" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M8 1.5v10" stroke="currentColor" stroke-width="1.3"/></svg>',search:'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>'};var $e='<svg class="chev" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="m2.5 4.5 3.5 3 3.5-3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';var V={...Object.fromEntries(Object.entries(mt).map(([e,t])=>[e,me(t)])),drag:'<svg width="10" height="14" viewBox="0 0 10 14"><circle cx="3" cy="3" r="1.2" fill="currentColor"/><circle cx="3" cy="7" r="1.2" fill="currentColor"/><circle cx="3" cy="11" r="1.2" fill="currentColor"/><circle cx="7" cy="3" r="1.2" fill="currentColor"/><circle cx="7" cy="7" r="1.2" fill="currentColor"/><circle cx="7" cy="11" r="1.2" fill="currentColor"/></svg>'};var ht='<span class="fe-col-rz rz" data-axis="x" title="Drag to resize this column \xB7 double-click to reset"></span>';var Aa={unavailable:"The notes host did not answer. If it is new, run native/install.sh, then reload.",notes_missing:"That file is not there any more; it may have been moved or deleted.",notes_conflict:"The file changed on disk since it was opened. Reload it, then try again.","read-failed":"The file could not be read.","write-failed":"The change could not be saved.","match-timeout":"The search took too long. Narrow it and try again."},Pa=e=>e&&typeof e=="object"&&typeof e.code=="string"?e.code:"",Oa=e=>e instanceof Error?e.message:typeof e=="string"?e:e?.message??"";function te(e,t=""){let a=Aa[Pa(e)];if(a)return a;let r=Oa(e).trim(),n=t?`${t} failed`:"That did not work";return r?`${n}: ${r}`:`${n}.`}var z=e=>e.split(" ");function Da(e){let t=new Map;for(let r of e.kw)t.set(r,"tok-kw");let a=e.kwCats;if(a){for(let r of a.ctrl??[])t.set(r,"tok-kw-ctrl");for(let r of a.type??[])t.set(r,"tok-type");for(let r of a.builtin??[])t.set(r,"tok-builtin");for(let r of a.lit??[])t.set(r,"tok-lit")}return t}var qa="if then elif else fi for while until do done case esac in function select local export readonly declare unset return exit break continue shift eval exec source alias trap set echo printf read cd test true false",ut="const let var function return if else for while do switch case break continue new class extends super this typeof instanceof in of import export from default async await yield try catch finally throw delete void null undefined true false interface type enum implements private public protected readonly static namespace declare as is keyof never unknown any string number boolean object symbol",Na="def class return if elif else for while break continue pass import from as with lambda try except finally raise yield global nonlocal assert del in is not and or None True False async await match self",ja="select from where insert into update delete join left right inner outer full cross on using group by order having limit offset create table drop alter add column index view as and or not null primary key foreign references distinct union all values set default check constraint unique case when then else end exists between like ilike in is with returning interval asc desc cascade if replace begin commit rollback grant",Ia="func package import return if else for range switch case break continue defer go chan select map struct interface type var const nil true false make new len cap append",Ra="fn let mut pub use mod struct enum impl trait return if else for while loop match break continue ref self Self crate super move async await dyn where unsafe true false Some None Ok Err",_a="query mutation subscription fragment on type interface union enum input scalar directive schema implements extend true false null",Fa="syntax package import message enum service rpc returns option repeated optional required oneof map reserved public weak true false",vt={ctrl:z("return if else for while do switch case break continue new throw try catch finally yield await delete in of"),type:z("interface type enum implements string number boolean object symbol any unknown never void keyof readonly as is namespace"),builtin:z("this super console"),lit:z("true false null undefined")},Ba={ctrl:z("return if elif else for while break continue pass raise yield try except finally with assert del in is not and or match async await"),builtin:z("self print len range"),lit:z("None True False")},Va={ctrl:z("return if else for range switch case break continue defer go select"),type:z("chan map struct interface type"),builtin:z("make new len cap append"),lit:z("nil true false")},Ka={ctrl:z("return if else for while loop match break continue move async await unsafe where"),type:z("struct enum impl trait mod dyn"),lit:z("true false Some None Ok Err self Self")},Ga={ctrl:z("select from where insert into update delete join on group by order having limit union with returning case when then else end"),type:z("table view index text varchar char int integer bigint smallint serial bigserial boolean bool numeric decimal real float double precision date time timestamp timestamptz interval json jsonb uuid bytea"),builtin:z("count sum avg min max coalesce now array_agg jsonb_build_object"),lit:z("null true false")},Wa={shell:{line:["#"],strings:['"',"'"],vars:!0,kw:qa.split(" "),kwCats:{ctrl:z("if then elif else fi for while until do done case esac return exit break continue"),builtin:z("echo printf read cd test eval exec source"),lit:z("true false")}},js:{line:["//"],block:["/*","*/"],strings:['"',"'","`"],tickML:!0,deco:!0,regexLiterals:!0,namedTypes:!0,kw:ut.split(" "),kwCats:vt},py:{line:["#"],strings:[],deco:!0,kw:Na.split(" "),kwCats:Ba,strRules:['[rbfuRBFU]{0,2}"""[\\s\\S]*?"""',"[rbfuRBFU]{0,2}'''[\\s\\S]*?'''",'[rbfuRBFU]{0,2}"(?:\\\\.|[^"\\\\\\n])*"',"[rbfuRBFU]{0,2}'(?:\\\\.|[^'\\\\\\n])*'"]},go:{line:["//"],block:["/*","*/"],strings:['"',"`"],tickML:!0,namedTypes:!0,kw:Ia.split(" "),kwCats:Va},rs:{line:["//"],block:["/*","*/"],strings:[],namedTypes:!0,kw:Ra.split(" "),kwCats:Ka,strRules:['r#+"[\\s\\S]*?"#+','r"[^"\\n]*"','b?"(?:\\\\.|[^"\\\\\\n])*"']},sql:{line:["--"],block:["/*","*/"],strings:["'",'"'],caseless:!0,kw:ja.split(" "),kwCats:Ga,special:[{kind:"var",pattern:"(?<!:):[A-Za-z_]\\w*|\\$\\d+"}]},json:{strings:['"'],kw:[],kwCats:{lit:z("true false null")},special:[{kind:"key",pattern:'"(?:\\\\.|[^"\\\\\\n])*"(?=[ \\t]*:)'}]},http:{line:["#"],strings:['"'],kw:z("GET POST PUT PATCH DELETE HEAD OPTIONS HTTP"),kwCats:{lit:z("true false null")},special:[{kind:"key",pattern:"^[A-Za-z][\\w-]*(?=:[ \\t])"},{kind:"key",pattern:'"(?:\\\\.|[^"\\\\\\n])*"(?=[ \\t]*:)'}]},md:{strings:[],kw:[],prose:!0,special:[{kind:"cmt",pattern:"<!--[\\s\\S]*?(?:-->|$)"},{kind:"meta",pattern:"^[ \\t]*(?:```|~~~)[^\\n]*"},{kind:"section",pattern:"^#{1,6}[ \\t][^\\n]*"},{kind:"cmt",pattern:"^>[^\\n]*"},{kind:"tag",pattern:"^[ \\t]*(?:[-*+]|\\d+[.)])(?=[ \\t])"},{kind:"str",pattern:"`[^`\\n]+`"},{kind:"key",pattern:"!?\\[[^\\]\\n]*\\]\\([^)\\n]*\\)"},{kind:"deco",pattern:"\\*\\*[^*\\n]+\\*\\*|__[^_\\n]+__"},{kind:"meta",pattern:"^[ \\t]*\\|?(?:[ \\t]*:?-{3,}:?[ \\t]*\\|)+[^\\n]*"}]},cfg:{line:["#",";"],strings:['"',"'"],vars:!0,kw:[]},cstyle:{line:["//"],block:["/*","*/"],strings:['"',"'"],deco:!0,namedTypes:!0,kw:ut.split(" "),kwCats:vt},css:{block:["/*","*/"],strings:['"',"'"],kw:[]},jsonc:{line:["//"],block:["/*","*/"],strings:['"'],kw:[],kwCats:{lit:z("true false null")}},graphql:{line:["#"],strings:['"'],kw:z(_a),kwCats:{ctrl:z("query mutation subscription fragment on"),type:z("type interface union enum input scalar"),lit:z("true false null")}},proto:{line:["//"],block:["/*","*/"],strings:['"'],kw:z(Fa),namedTypes:!0,kwCats:{ctrl:z("import rpc returns"),type:z("message enum service oneof map"),lit:z("true false")}},html:{block:["<!--","-->"],strings:[],kw:[],special:[{kind:"tag",pattern:"<\\/?[A-Za-z][^>\\n]*>"}]},yaml:{line:["#"],strings:['"',"'"],kw:[],kwCats:{lit:z("true false null yes no True False Null")},special:[{kind:"meta",pattern:"^(?:---|\\.\\.\\.)[ \\t]*$"},{kind:"key",pattern:"(?<=^[ \\t]*(?:-[ \\t]+)?)[A-Za-z_][\\w.-]*(?=[ \\t]*:(?:[ \\t]|$))"},{kind:"deco",pattern:"(?<=[:\\s-][ \\t]*)[&*][A-Za-z_][\\w-]*"},{kind:"str",pattern:`(?<=:[ \\t]+|^[ \\t]*-[ \\t]+)(?!['"#&*|>\\[{]|(?:true|false|null|yes|no|True|False|Null|~|[-+]?\\d[\\d_.]*)[ \\t]*(?:#|$))[^\\n#]*[^\\s#]`}]},toml:{line:["#"],strings:['"',"'"],kw:[],kwCats:{lit:z("true false")},special:[{kind:"section",pattern:"^\\[[^\\]\\n]+\\]"},{kind:"key",pattern:"^[ \\t]*[A-Za-z_][\\w.-]*(?=[ \\t]*=)"}]},diff:{strings:[],kw:[],special:[{kind:"meta",pattern:"^(?:@@|diff |index |\\+\\+\\+ |--- )[^\\n]*"},{kind:"add",pattern:"^\\+[^\\n]*"},{kind:"del",pattern:"^-[^\\n]*"}]},dockerfile:{line:["#"],strings:['"',"'"],vars:!0,kw:z("FROM RUN CMD COPY ADD WORKDIR ENV ARG EXPOSE USER ENTRYPOINT VOLUME LABEL HEALTHCHECK SHELL STOPSIGNAL ONBUILD")},makefile:{line:["#"],strings:['"',"'"],vars:!0,kw:z("include define endef ifeq ifneq ifdef ifndef else endif export override private"),special:[{kind:"key",pattern:"^[A-Za-z0-9_./%-]+(?=[ \\t]*:)"}]},plain:{strings:[],kw:[]}},Ua={sh:"shell",bash:"shell",zsh:"shell",fish:"shell",js:"js",mjs:"js",cjs:"js",ts:"js",tsx:"js",jsx:"js",vue:"js",svelte:"js",py:"py",rb:"py",go:"go",rs:"rs",java:"cstyle",kt:"cstyle",swift:"cstyle",c:"cstyle",cpp:"cstyle",h:"cstyle",cs:"cstyle",php:"cstyle",css:"css",scss:"css",less:"css",ini:"cfg",conf:"cfg",env:"cfg",gitignore:"cfg",sql:"sql",diff:"diff",patch:"diff",dockerfile:"dockerfile",containerfile:"dockerfile",makefile:"makefile",jsonc:"jsonc",graphql:"graphql",gql:"graphql",proto:"proto",html:"html",htm:"html",xml:"html",yaml:"yaml",yml:"yaml",toml:"toml",json:"json",json5:"json",geojson:"json",http:"http",md:"md",mdx:"md",markdown:"md"},Ja={javascript:"js",typescript:"ts",node:"js",python:"py",python3:"py",py3:"py",ruby:"rb",shell:"sh",shellscript:"sh",console:"sh",terminal:"sh",ps:"sh",golang:"go",rust:"rs",kotlin:"kt",csharp:"cs","c++":"cpp","c#":"cs",objc:"c",postgres:"sql",postgresql:"sql",psql:"sql",mysql:"sql",sqlite:"sql",plpgsql:"sql",https:"http",rest:"http",svg:"xml",docker:"dockerfile",make:"makefile",dotenv:"env",properties:"ini",cfg:"ini",patch:"diff"};function se(e){return e.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}function Ya(e){let t=[];if(e.block&&t.push({kind:"cmt",pattern:`${se(e.block[0])}[\\s\\S]*?(?:${se(e.block[1])}|$)`}),e.line?.length){let a=e.line.map(se).join("|");t.push({kind:"cmt",pattern:`(?:${a})[^\\n]*`})}e.regexLiterals&&t.push({kind:"regex",pattern:String.raw`(?:(?<=^)|(?<=[=(,:;!&|?{}\n][ \t]{0,16})|(?<=\breturn[ \t]{1,16}))/(?:\\.|[^/\\\n])+/[dgimsuvy]*`}),t.push(...e.special??[]);for(let a of e.strRules??[])t.push({kind:"str",pattern:a});for(let a of e.strings??[]){let r=a==="`"&&e.tickML?"(?:\\\\.|[^`\\\\])*(?:`|$)":`(?:\\\\.|[^${se(a)}\\\\\\n])*(?:${se(a)}|\\n|$)`;t.push({kind:"str",pattern:`${se(a)}${r}`})}return e.vars&&t.push({kind:"var",pattern:"\\$\\{[^}\\n]*\\}?|\\$[\\w@#?!*-]+"}),e.deco&&t.push({kind:"deco",pattern:"@[A-Za-z_][\\w.]*"}),e.prose||t.push({kind:"num",pattern:"\\b(?:0[xX][0-9a-fA-F_]+|0[bB][01_]+|0[oO][0-7_]+|\\d[\\d_]*(?:\\.\\d[\\d_]*)?(?:[eE][+-]?\\d+)?)\\b"}),t.push({kind:"word",pattern:"[A-Za-z_$][\\w$]*"}),t}function Xa(e){let t=[],a=e.map((r,n)=>(t[n]=r.kind,`(?<g${n}>${r.pattern})`));return{re:new RegExp(a.join("|"),"gm"),kinds:t}}var Za={cmt:"tok-cmt",str:"tok-str",var:"tok-var",num:"tok-num",deco:"tok-deco",regex:"tok-regex",tag:"tok-type",key:"tok-key",section:"tok-section",add:"tok-add",del:"tok-del",meta:"tok-cmt"};function Qa(e,t){let a=t.toLowerCase(),r=Ua[Ja[a]??a]??"plain",n=Wa[r];if(r==="plain")return p(e);let i=Da(n),{re:o,kinds:l}=Xa(Ya(n)),g="",c=0,h;for(;(h=o.exec(e))!==null;){g+=p(e.slice(c,h.index)),c=h.index+h[0].length;let d=h.groups??{},s;for(let v=0;v<l.length;v++)if(d[`g${v}`]!==void 0){s=l[v];break}let x=p(h[0]);if(s==="word"){let v=e.slice(Math.max(0,h.index-32),h.index),y=/\b(?:function|def|func|fn)\s+$/.test(v),T=/^\s*\(/.test(e.slice(c,c+12)),w=n.namedTypes&&/^[A-Z]/.test(h[0])&&/(?:\bnew|\bextends|\bimplements|[:<,])\s*$/.test(v),k=i.get(n.caseless?h[0].toLowerCase():h[0])??(y||T?"tok-fn":w?"tok-type":void 0);g+=k?`<span class="${k}">${x}</span>`:x}else s?g+=`<span class="${Za[s]}">${x}</span>`:g+=x;h[0].length===0&&o.lastIndex++}return g+=p(e.slice(c)),g}function er(e){let t=[],a=[],r="",n=/<span[^>]*>|<\/span>|\n|[^<\n]+|</g;for(let i of e.match(n)??[])i===`
`?(t.push(r+"</span>".repeat(a.length)),r=a.join("")):i.startsWith("<span")?(a.push(i),r+=i):(i==="</span>"&&a.pop(),r+=i);return t.push(r),t}function tr(e){let t=er(e);return t.map((a,r)=>`<span class="fe-md-l">${a}${r<t.length-1?`
`:""}</span>`).join("")}function Re(e){return/^\s*(javascript|data|vbscript):/i.test(e)}function xt(e){return"file://"+e.replace(/:\d+(?::\d+)?$/,"").split("/").map(encodeURIComponent).join("/")}var Y="";var wt=e=>!!Y&&(e===Y||e.startsWith(Y+"/")),yt=e=>/^https?:/i.test(e)||/^file:\/\//i.test(e)&&wt(e.slice(7));function Te(e,t){if(wt(t))return xt(t);if(!e||/^[a-z][a-z0-9+.-]*:/i.test(t)||t.startsWith("//")||t.startsWith("#"))return t;try{return new URL(t,e).href}catch{return t}}var kt=new Set(["div","span","p","br","hr","img","a","strong","em","b","i","u","s","code","pre","center","sub","sup","details","summary","kbd","picture","source","h1","h2","h3","h4","h5","h6","ul","ol","li","table","thead","tbody","tr","th","td","blockquote"]),ar=new Set(["src","href","alt","title","width","height","align","colspan","rowspan","start"]),rr=new Set(["open","reversed"]),Mt=new Set(["br","hr","img","source"]);function $t(e,t=""){let a=new DOMParser().parseFromString(e,"text/html"),r=n=>{if(n.nodeType===Node.TEXT_NODE)return p(n.textContent??"");if(n.nodeType!==Node.ELEMENT_NODE)return"";let i=n,o=i.tagName.toLowerCase(),l=Array.from(i.childNodes).map(r).join("");if(!kt.has(o))return l;let g="";for(let c of Array.from(i.attributes)){if(rr.has(c.name)){g+=` ${c.name}`;continue}if(!ar.has(c.name))continue;let h=c.value;if(c.name==="src"||c.name==="href"){if(Re(h))continue;h=Te(t,h)}g+=` ${c.name}="${p(h)}"`}return o==="a"&&yt(Te(t,i.getAttribute("href")??""))&&(g+=' target="_blank" rel="noopener"'),Mt.has(o)?`<${o}${g}>`:`<${o}${g}>${l}</${o}>`};return Array.from(a.body.childNodes).map(r).join("")}function ue(e,t=""){let a=[],r="",n=0;for(let o=0;o<e.length;o++){if(e[o]==="`"){let x=o;for(;e[x]==="`";)x++;let v=x-o;n?n===v&&(n=0):n=v,r+=e.slice(o,x),o=x-1;continue}if(e[o]!=="<"||n||!/^<\/?[a-z][\w-]*\b/i.test(e.slice(o))){r+=e[o];continue}let l=o+1,g="";for(;l<e.length;l++)if(g)e[l]===g&&(g="");else if(e[l]==='"'||e[l]==="'")g=e[l];else if(e[l]===">")break;if(l===e.length){r+=e[o];continue}let c=e.slice(o,l+1),h=c.match(/^<\/?([a-z][\w-]*)/i)[1].toLowerCase();if(!kt.has(h)){r+=c,o=l;continue}let d=$t(c.startsWith("</")?`<${h}></${h}>`:`${c}${Mt.has(h)?"":`</${h}>`}`,t),s=c.startsWith("</")?`</${h}>`:d.slice(0,d.indexOf(">")+1);a.push(s),r+=`\uE000${a.length-1}\uE001`,o=l}let i=p(r);return i=i.replace(/`([^`]+)`/g,"<code>$1</code>"),i=i.replace(/!\[([^\]]*)\]\(([^)\s]+?)\)/g,(o,l,g)=>Re(g)?l:`<img src="${Te(t,g)}" alt="${l}" loading="lazy">`),i=i.replace(/\[([^\]]+)\]\(([^)\s]+?)\)/g,(o,l,g)=>{if(Re(g))return l;let c=Te(t,g);return`<a href="${c}"${yt(c)?' target="_blank" rel="noopener"':""}>${l}</a>`}),i=i.replace(/&lt;((?:https?|file):\/\/[^\s<>]+?)&gt;/gi,"$1"),i=i.replace(/\*\*([^*]+)\*\*/g,"<strong>$1</strong>"),i=i.replace(/(^|[\s(])\*([^*\s][^*]*)\*/g,"$1<em>$2</em>"),i=i.split(/(<code>[\s\S]*?<\/code>|<[^>]+>|\b(?:https?|file):\/\/\S+)/).map((o,l)=>l%2?o:o.replace(/(^|[^\w])__([^_\s][^_]*?)__(?!\w)/g,"$1<strong>$2</strong>").replace(/(^|[^\w])_([^_\s][^_]*?)_(?!\w)/g,"$1<em>$2</em>")).join(""),i=i.replace(/~~([^~]+)~~/g,"<del>$1</del>"),i.replace(/\uE000(\d+)\uE001/g,(o,l)=>a[Number(l)])}var Ee=/\b(?:https?|file):\/\/[^\s<>"'`]+/gi;function nr(e){let t=e.replace(/[.,;:!?*_]+$/,"");for(let[a,r]of[["(",")"],["[","]"]])for(;t.endsWith(r)&&t.split(a).length<t.split(r).length;)t=t.slice(0,-1).replace(/[.,;:!?*_]+$/,"");return t}function ir(e){let t=document.createTreeWalker(e,NodeFilter.SHOW_TEXT),a=[];for(;t.nextNode();)a.push(t.currentNode);for(let r of a){if(r.parentElement?.closest("a, pre, svg, style, script"))continue;let n=r.textContent||"";if(Ee.lastIndex=0,!Ee.test(n))continue;Ee.lastIndex=0;let i=document.createDocumentFragment(),o=0;for(let l of n.matchAll(Ee)){let g=nr(l[0]),c=l.index??0;i.append(n.slice(o,c));let h=document.createElement("a");h.href=g,h.target="_blank",h.rel="noopener",h.textContent=g,i.append(h),o=c+g.length}i.append(n.slice(o)),r.parentNode?.replaceChild(i,r)}}function or(e){if(!(Y&&e.includes(Y))&&!/(?:https?|file):\/\//i.test(e))return e;let t=document.createElement("template");t.innerHTML=e,ir(t.content);let a=document.createTreeWalker(t.content,NodeFilter.SHOW_TEXT),r=[];for(;a.nextNode();)r.push(a.currentNode);for(let n of r){if(n.parentElement?.closest("a, pre, svg, style, script"))continue;let i=n.textContent||"",o=document.createDocumentFragment(),l=0;for(;l<i.length;){let g=Y?i.indexOf(Y,l):-1;if(g<0)break;let c=i[g+Y.length];if(g&&/[\w/:]/.test(i[g-1])||c&&c!=="/"&&!/\s|[),.;!?]/.test(c)){o.append(i.slice(l,g+1)),l=g+1;continue}let h=g+Y.length,d=0,s=g?i[g-1]:"",x=s==='"'||s==="'"?s:s==="<"?">":"",v=n.parentElement?.tagName==="CODE"||!!x;for(;h<i.length;){let w=i[h];if(x&&w===x||!v&&/[\n\r<>"']/.test(w)||!v&&w===")"&&d===0||!v&&w==="]")break;if(w==="("&&d++,w===")"&&d--,!v&&/\s/.test(w)){let k=i.slice(g,h),M=/\/|\.[a-zA-Z0-9_-]{1,15}(?=:\d+|\s|$|[),;!?])/.test(i.slice(h+1,h+100));if(/\/$/.test(k)||/(?:\.[a-zA-Z0-9_-]{1,15}|:\d+(?::\d+)?)$/.test(k)||!M)break}h++}let y=i.slice(g,h);v||(y=y.replace(/[.,;!?]+$/,"")),o.append(i.slice(l,g));let T=document.createElement("a");T.href=xt(y),T.target="_blank",T.rel="noopener",T.textContent=y,o.append(T),l=g+y.length}l&&(o.append(i.slice(l)),n.parentNode?.replaceChild(o,n))}return t.innerHTML}function sr(e,t){let a=e.trim().toLowerCase().replace(/[^a-z0-9À-ɏͰ-﷏]+/g,"-").replace(/^-+|-+$/g,"")||"section",r=t.get(a)??0;return t.set(a,r+1),r&&(a+="-"+r),a}var lr={NOTE:"Note",TIP:"Tip",IMPORTANT:"Important",WARNING:"Warning",CAUTION:"Caution"},he=/^(\s*)([-*+]|\d{1,9}[.)])(?:\s+(.*)|\s*)$/;function dr(e){let t=[],a=r=>r.trim().replace(/^(["'])(.*)\1$/,"$2");for(let r of e){let n=/^([\w.-]+)\s*:\s*(.*)$/.exec(r),i=/^\s+-\s+(.*)$/.exec(r),o=t[t.length-1];if(n){let l=n[2].trim(),g=/^\[(.*)\]$/.exec(l);t.push(g?{key:n[1],value:"",items:g[1].split(",").map(a).filter(Boolean)}:{key:n[1],value:a(l)})}else i&&o?(o.items??=[]).push(a(i[1])):/^\s+\S/.test(r)&&o&&!o.items&&(o.value=(/^[|>][-+]?$/.test(o.value)?"":o.value+" ")+r.trim())}return t}var pr=/^(~\/|\.{1,2}\/|\/)?[\w@.-]+(\/[\w@.-]+)*\/?$/,Et=e=>pr.test(e)&&!/^\d/.test(e)&&(e.includes("/")||/\.[a-z][\w]{0,5}$/i.test(e));function bt(e,t){return Et(e)?`<span class="fe-fm-path" data-fm-path="${p(e)}">${p(e)}</span>`:ue(e,t)}function ae(e,t="",a=!1,r=!1){let n=e.replace(/\r\n/g,`
`).split(`
`),i=[],o=[],l=new Map,g=new Map,c=n.map((w,k)=>k+1);if(!a){let w=!1,k=[];n=n.filter((M,C)=>{/^ {0,3}(`{3,}|~{3,})/.test(M)&&(w=!w);let L=!w&&M.match(/^\[\^([^\]\s]+)\]:\s*(.*)$/);return L?(g.set(L[1],L[2]),!1):(k.push(C+1),!0)}),c=k}let h=!a&&!r,d=(w,k)=>{if(!h)return;let M=c[w]??w+1,C=c[Math.max(w,s-1)]??s;for(let L=k;L<i.length;L++)/^<[^>]* data-sl=/.test(i[L])||(i[L]=i[L].replace(/^(<[a-z][a-z0-9]*\b[^>]*?)>/,`$1 data-sl="${M}-${C}">`))},s=0;if(!a&&n[0]==="---"){let w=n.slice(1,60).findIndex(k=>k==="---");if(w>=0){let k=dr(n.slice(1,w+1));k.length&&i.push(`<dl class="fe-md-fm" data-fm-base="${p(t)}">${k.map(M=>`<dt>${p(M.key)}</dt><dd>${M.items?`<span class="fe-fm-items">${M.items.map(C=>Et(C)?`<span class="fe-fm-item">${bt(C,t)}</span>`:`<span class="fe-fm-item chip" data-size="sm" data-tone="quiet"><span>${p(C)}</span></span>`).join("")}</span>`:bt(M.value,t)}</dd>`).join("")}</dl>`),s=w+2}}let x=0,v=0,y=()=>{if(!o.length)return;let w=o.map((k,M)=>M<o.length-1&&/( {2,}|\\)$/.test(k)?k.replace(/( {2,}|\\)$/,"")+"\uE002":k.trim()).join(" ");i.push(`<p${h?` data-sl="${c[x]}-${c[v]}"`:""}>${ue(w,t).replace(/\uE002 ?/g,"<br>")}</p>`),o=[]};for(;s<n.length;){let w=n[s],k=s,M=i.length,C=w.match(/^( {0,3})(`{3,}|~{3,})([^\r\n]*)$/);if(C){y();let H=[];s++;let R=C[2][0],q=C[2].length,A=C[1].length,K=new RegExp(`^ {0,3}${R==="`"?"`":"~"}{${q},}\\s*$`);for(;s<n.length&&!K.test(n[s]);)H.push(n[s++].replace(new RegExp(`^ {0,${A}}`),""));s<n.length&&s++;let D=H.join(`
`),F=C[3].trim().split(/\s+/)[0]||"";F.toLowerCase()==="mermaid"?i.push(`<div class="fe-md-mermaid"><pre class="fe-md-mermaid-source" hidden>${p(D)}</pre><div class="fe-md-mermaid-view"></div></div>`):i.push(`<div class="fe-md-code"><div class="bar fe-md-code-bar" data-inset><span class="fe-md-lang">${p(F||"text")}</span><button type="button" class="btn fe-md-copy" data-icon data-size="sm" title="Copy this block" aria-label="Copy this block">${m.copy}</button></div><pre class="fe-md-pre fe-md-lines">${tr(Qa(D,F||"md"))}</pre></div>`),d(k,M);continue}let L=w.match(/^(#{1,6})\s+(.*)$/);if(L){y();let H=L[1].length,R=sr(L[2].replace(/[*_`]/g,""),l);i.push(`<h${H} id="${p(R)}">${ue(L[2],t)}<a class="fe-md-anchor" href="#${p(R)}" title="Link to this heading"></a></h${H}>`),s++,d(k,M);continue}if(/^\s*<[a-zA-Z!/]/.test(w)){y();let H=[];for(;s<n.length&&!/^\s*$/.test(n[s]);)H.push(n[s++]);i.push(`<div class="fe-md-html">${$t(H.join(`
`),t)}</div>`),d(k,M);continue}if(o.length===0&&/^\s*(?:\*{3,}|-{3,}|_{3,})\s*$/.test(w)){y(),i.push("<hr>"),s++,d(k,M);continue}if(/^\s*>/.test(w)){y();let H=[];for(;s<n.length&&/^\s*>/.test(n[s]);)H.push(n[s++].replace(/^\s*>\s?/,""));let R=H[0]?.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*$/i);if(R){let q=R[1].toUpperCase();i.push(`<div class="fe-md-alert fe-md-alert-${q.toLowerCase()}"><p class="fe-md-alert-title">${lr[q]}</p>${ae(H.slice(1).join(`
`),t,!0)}</div>`)}else i.push(`<blockquote>${ae(H.join(`
`),t,!1,!0)}</blockquote>`);d(k,M);continue}let O=w.match(he);if(O&&(O[3]!==void 0||o.length===0)){y();let H=O[1].length,R=/\d/.test(O[2]),q=[],A=!1;for(;s<n.length;){let D=n[s].match(he);if(!D||D[1].length!==H||/\d/.test(D[2])!==R)break;let F=D[1].length+D[2].length+1,P=[D[3]??""];for(s++;s<n.length;){let f=n[s];if(/^\s*$/.test(f)){let E=n.slice(s+1).find(N=>!/^\s*$/.test(N));if(E!==void 0&&E.match(/^\s*/)[0].length>=F){P.push(""),s++,A=!0;continue}break}let u=f.match(/^\s*/)[0].length;if(u>=F||u>H&&he.test(f)){P.push(f.slice(Math.min(u,F))),s++;continue}if(!he.test(f)&&P[P.length-1]!==""&&!/^\s*(#|>|```|~~~|\|)/.test(f)){P.push(f.trim()),s++;continue}break}let S=P[0].match(/^\[( |x|X)\]\s+(.*)$/);S&&(P[0]=S[2]);let $=ae(P.join(`
`),t,!0),B=$.match(/^<p>([\s\S]*?)<\/p>(\n?[\s\S]*)$/);B&&!A&&($=B[1]+B[2]),q.push(S?`<li class="fe-task"><input type="checkbox" disabled${S[1]===" "?"":" checked"}> ${$}</li>`:`<li>${$}</li>`),s<n.length&&/^\s*$/.test(n[s])&&n[s+1]?.match(he)?.[1].length===H&&(s++,A=!0)}let K=R?parseInt(O[2],10):1;i.push(R?`<ol${K!==1?` start="${K}"`:""}>${q.join("")}</ol>`:`<ul>${q.join("")}</ul>`),d(k,M);continue}if(w.includes("|")&&s+1<n.length&&/^\s*\|?[\s:|-]+\|[\s:|-]*\s*$/.test(n[s+1])){y();let H=A=>{let K=[],D="",F=0;for(let P=0;P<A.length;P++){if(A[P]==="\\"&&A[P+1]==="|"){D+="|",P++;continue}if(A[P]==="`"){let S=P;for(;A[S]==="`";)S++;let $=S-P;F?F===$&&(F=0):F=$,D+=A.slice(P,S),P=S-1;continue}if(A[P]==="|"&&!F){K.push(D),D="";continue}D+=A[P]}return K.push(D),/^\s*\|/.test(A)&&K.shift(),/\|\s*$/.test(A)&&!/\\\|\s*$/.test(A)&&K.pop(),K.map(P=>ue(P.trim(),t))},R=H(w);s+=2;let q=[];for(;s<n.length&&n[s].includes("|");)q.push(H(n[s++]));i.push(`<div class="fe-md-tablewrap"><table class="fe-md-table fe-rz"><thead><tr>${R.map(A=>`<th>${A}${ht}</th>`).join("")}</tr></thead><tbody>${q.map(A=>`<tr>${Array.from({length:R.length},(K,D)=>`<td>${A[D]??""}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`),d(k,M);continue}if(/^\s*$/.test(w)){y(),s++;continue}o.length||(x=s),v=s,o.push(w.replace(/^\s+/,"")),s++}if(y(),a)return i.join(`
`);let T=i.join(`
`);if(g.size){let w=[];T=T.replace(/\[\^([^\]\s]+)\]/g,(M,C)=>{if(!g.has(C))return M;w.includes(C)||w.push(C);let L=w.indexOf(C)+1;return`<sup class="fe-md-fnref"><a href="#fn-${p(C)}" id="fnref-${p(C)}">${L}</a></sup>`});let k=[...w,...[...g.keys()].filter(M=>!w.includes(M))];T+=`<section class="fe-md-footnotes"><ol>${k.map(M=>`<li id="fn-${p(M)}">${ue(g.get(M),t)} <a href="#fnref-${p(M)}" class="fe-md-fnback" title="Back to the text">\u21A9</a></li>`).join("")}</ol></section>`}return or(`<div class="fe-md">${T}</div>`)}var cr="bfb-kv-migrated",fr="bfb-strip-v2:",Fe=new Map,_e=new Map,Se=null,gr=[];function Tt(e){gr.push(e),Se||window.addEventListener("storage",t=>{t.key&&mr(t.key)&&e(t.key)})}var mr=e=>e.startsWith("bfb-")&&!e.startsWith(fr)&&e!==cr;function St(e){if(!Se)try{return localStorage.getItem(e)}catch{return null}return Fe.get(e)??null}function Lt(e,t){if(!Se){try{localStorage.setItem(e,t)}catch{}return}if(Fe.get(e)===t)return;Fe.set(e,t),_e.set(e,[..._e.get(e)??[],t]);let a=()=>_e.delete(e);try{Se.set({[e]:t}).catch(a)}catch{a()}}var hr="bfb-view",zt="bfb-theme",ur="bfb-palette",vr=["slate","violet","sand","ink","ocean","forest","ember","nord","mocha","solar","grove","velvet","coral","neon","matcha","plum"],br="bfb-density",xr="bfb-show-hidden";function wr(e){try{return sessionStorage.getItem(e)}catch{return null}}function yr(e,t){try{sessionStorage.setItem(e,t)}catch{}}function ve(e,t,a,r="profile"){let n=r==="tab";return{get:()=>t(n?wr(e):St(e)),set:i=>{let o=a(i);n?yr(e,o):Lt(e,o)},onChange:i=>{n||Tt(o=>{o===e&&i()})}}}var le=(e,t="",a)=>ve(e,r=>r??t,r=>r,a),Be=(e,t,a)=>ve(e,r=>t.includes(r??"")?r:a,r=>r),Le=(e,t,a="1",r="0")=>ve(e,n=>n===a?!0:n===r?!1:t,n=>n?a:r);function ze(e,t,a=()=>!0,r){let n=()=>JSON.parse(JSON.stringify(t));return ve(e,i=>{if(i===null)return n();try{let o=JSON.parse(i);return a(o)?o:n()}catch{return n()}},i=>JSON.stringify(i),r)}var kr=(e,t,a=Number.isFinite)=>ve(e,r=>{let n=parseInt(r??"");return a(n)?n:t},r=>String(r)),Zn=le(hr,"details"),Qn=Be(ur,vr,"slate"),ei=kr(br,3,e=>e>=1&&e<=5),ti=Le(xr,!1,"true","false");var de=class extends Error{constructor(a,r){super(r);this.code=a;this.name="FileFetchError"}};function Ct(e){return new Promise((t,a)=>{let r=new XMLHttpRequest;r.open("GET",e),r.onload=()=>t(r.responseText),r.onerror=()=>a(new Error("XHR error")),r.send()})}function Ht(e){return new Promise(t=>{chrome.runtime.sendMessage({type:"bfb-fetch",url:e},a=>{chrome.runtime.lastError||!a?t(null):t(a)})})}var At=e=>new Promise(t=>setTimeout(t,e));async function Pt(e,t=3,a=150){let r=new URL(e,location.href).href;for(let n=0;n<t;n++){if(!chrome.runtime?.id)throw new de("context-invalidated","extension reloaded under this page");let i;try{i=await Ht(r)}catch(o){throw new de("context-invalidated",String(o))}if(i===null){await At(a*(n+1));continue}return i.ok?i.text:Ct(r).catch(()=>{throw new de("read-failed",i.error||"read failed")})}return Ct(r).catch(()=>{throw new de("read-failed","no reply from the extension worker")})}async function Ot(e){let t=new URL(e,location.href).href;for(let a=0;a<2;a++){if(!chrome.runtime?.id)return!1;let r;try{r=await Ht(t)}catch{return!1}if(r)return r.ok;await At(150)}return!1}var J=class extends Error{constructor(a,r){super(r);this.code=a;this.name="NotesError"}},Mr="com.better_file_browser.notes";function j(e){return new Promise((t,a)=>{try{chrome.runtime.sendMessage({type:"bfb-native-oneshot",host:Mr,payload:e},r=>{if(chrome.runtime.lastError||!r)return a(new J("unavailable",chrome.runtime.lastError?.message||"no reply"));if(!r.ok)return a(new J("unavailable",r.error||"notes host not installed"));let n=r.response;if(n.t==="error")return a(new J(n.code,n.message));t(n)})}catch(r){a(new J("unavailable",String(r)))}})}async function $r(e,t){for(let a=0;;a++){let r=[],n=-1,i=0,o=!1;for(;i!=null;){let l=await j({op:"fileRead",root:e,rel:t,offset:i});if(n!==-1&&l.mtime!==n){o=!0;break}n=l.mtime,r.push(l.text),i=l.next}if(!o)return{text:r.join(""),mtime:n};if(a>=3)throw new J("notes_io","the file kept changing while it was read")}}var Ve={stat:e=>j({op:"stat",root:e}),list:e=>j({op:"list",root:e}).then(t=>t.notes),read:(e,t)=>j({op:"read",root:e,rel:t}),write:(e,t,a,r)=>j({op:"write",root:e,rel:t,text:a,expectMtime:r}),create:(e,t,a="")=>j({op:"create",root:e,rel:t,text:a}),rename:(e,t,a)=>j({op:"rename",root:e,rel:t,to:a}),writeBinary:(e,t,a)=>j({op:"writeBinary",root:e,rel:t,base64:a}),delete:(e,t)=>j({op:"delete",root:e,rel:t}),pick:(e,t)=>j({op:"pick",start:e,kind:t}).then(a=>a.root),home:()=>j({op:"home"}).then(e=>e.home),history:(e,t)=>j({op:"history",root:e,rel:t}).then(a=>a),version:(e,t,a)=>j({op:"version",root:e,rel:t,sha:a}),search:(e,t)=>j({op:"search",root:e,query:t}).then(a=>a.hits),fileRead:$r,fileStat:(e,t)=>j({op:"fileStat",root:e,rel:t}),commentsRead:(e,t)=>j({op:"commentsRead",root:e,rel:t}),commentsWrite:(e,t,a)=>j({op:"commentsWrite",root:e,rel:t,ops:a}),dpPages:()=>j({op:"dpPages"}).then(e=>e.pages??[]),dp:(e,t,a)=>j({op:"dp",verb:e,slug:t,payload:a}).then(r=>r.result),docsIndex:()=>j({op:"docsIndex"}).then(e=>e.docs??[]),people:()=>j({op:"people"}).then(e=>e.peers??[]),fileWrite:(e,t,a,r)=>j({op:"fileWrite",root:e,rel:t,text:a,expectMtime:r})};var Dt={text:e=>Pt(e),exists:Ot,dp:Ve.dp},X=()=>Dt;function qt(e){Dt=e}var be=[{id:"palette",group:"Anywhere",title:"Command palette",keys:["\u2318K"],own:!0,over:!0},{id:"keys",group:"Anywhere",title:"Keyboard map",keys:["?"],own:!0,over:!0},{id:"settings",group:"Anywhere",title:"Settings",keys:[","],own:!0,over:!0},{id:"hints",group:"Anywhere",title:"Show keys on screen",keys:["hold \u2325"],own:!0,over:!0},{id:"area-next",group:"Anywhere",title:"Next area",keys:["F6","\u2303`"],own:!0,over:!0},{id:"area-prev",group:"Anywhere",title:"Previous area",keys:["\u21E7F6","\u2303\u21E7`"],own:!0,over:!0},{id:"sidebar",group:"Anywhere",title:"Sidebar on or off",keys:["\\"],own:!0,over:!0},{id:"theme",group:"Anywhere",title:"Dark or light",keys:["\u21E7L"],own:!0,over:!0},{id:"esc",group:"Anywhere",title:"Close, or step back",keys:["Esc"]},{id:"up",group:"Go",title:"Parent folder",keys:["\u232B","\u2318\u2191"],own:!0,over:["\u2318\u2191"]},{id:"home",group:"Go",title:"Home",keys:["g h"],own:!0},{id:"path",group:"Go",title:"Type a path",keys:["l"],own:!0},{id:"goto-bg",group:"Go",title:"Open the typed path as a background tab",keys:["\u2325\u21A9"],scope:"goto",own:!0,field:!0},{id:"open-pick",group:"Go",title:"Open a file or folder",keys:["o"],own:!0},{id:"save",group:"Go",title:"Save or unsave folder",keys:["b"],own:!0},{id:"terminal",group:"Go",title:"Terminal here",keys:["`"],own:!0},{id:"terminal-copy",group:"Go",title:"Copy terminal command",keys:["\u21E7`"],own:!0},{id:"to-listing",group:"Go",title:"Focus the listing",keys:["g l"],own:!0},{id:"area-leave",group:"Go",title:"Close the sidebar over the page, or go back to the listing",keys:["Esc"],own:!0,over:!0},{id:"crumb-menu",group:"Go",title:"Folder menu of a path crumb",keys:["\u2193"],scope:"bar",own:!0},{id:"to-sidebar",group:"Go",title:"Focus the sidebar",keys:["g s"],own:!0},{id:"to-tabs",group:"Go",title:"Focus the tabs",keys:["g t"],own:!0},{id:"to-toolbar",group:"Go",title:"Focus the toolbar",keys:["g b"],own:!0},{id:"to-path",group:"Go",title:"Focus the path bar",keys:["g p"],own:!0},{id:"lens-places",group:"Go",title:"Places",keys:["g 1"],own:!0},{id:"lens-saved",group:"Go",title:"Saved",keys:["g 2"],own:!0},{id:"lens-notes",group:"Go",title:"Notes",keys:["g 3"],own:!0},{id:"lens-recent",group:"Go",title:"History",keys:["g 4"],own:!0},{id:"lens-search",group:"Go",title:"Search",keys:["g 5"],own:!0},{id:"lens-ask",group:"Go",title:"Ask",keys:["g 6"],own:!0},{id:"lens-docs",group:"Go",title:"Comments",keys:["g 7"],own:!0},{id:"lens-dp",group:"Go",title:"Decisions",keys:["g 8"],own:!0},{id:"move",group:"Listing",title:"Move",keys:["\u2191","\u2193"],scope:"listing",own:!0},{id:"extend-up",group:"Listing",title:"Select upward",keys:["\u21E7\u2191"],scope:"listing",own:!0},{id:"extend-down",group:"Listing",title:"Select downward",keys:["\u21E7\u2193"],scope:"listing",own:!0},{id:"first",group:"Listing",title:"First item",keys:["Home"],scope:"listing",own:!0},{id:"last",group:"Listing",title:"Last item",keys:["End"],scope:"listing",own:!0},{id:"page-up",group:"Listing",title:"Page up",keys:["PgUp"],scope:"listing",own:!0},{id:"list-rename",group:"Listing",title:"Rename the file",keys:["F2"],scope:"listing",own:!0},{id:"page-down",group:"Listing",title:"Page down",keys:["PgDn"],scope:"listing",own:!0},{id:"open",group:"Listing",title:"Open",keys:["\u21A9"],scope:"listing",own:!0},{id:"open-bg",group:"Listing",title:"Keep as a background tab",keys:["\u2325\u21A9"],scope:"listing",own:!0},{id:"open-chrome",group:"Listing",title:"Open in a Chrome tab",keys:["\u2318\u21A9"],scope:"listing",own:!0},{id:"look",group:"Listing",title:"Preview",keys:["Space"],scope:"listing",own:!0},{id:"tree-open",group:"Listing",title:"Expand folder (Tree)",keys:["\u2192"],scope:"tree",own:!0},{id:"tree-close",group:"Listing",title:"Collapse folder (Tree)",keys:["\u2190"],scope:"tree",own:!0},{id:"menu",group:"Listing",title:"Item menu",keys:["x","\u21E7F10"],scope:"listing",own:!0},{id:"select-all",group:"Listing",title:"Select all",keys:["\u2318A"],scope:"listing",own:!0},{id:"copy-paths",group:"Listing",title:"Copy selected paths",keys:["\u2318C"],scope:"listing",own:!0},{id:"copy-path",group:"Listing",title:"Copy path",keys:["y"],scope:"listing",own:!0},{id:"copy-name",group:"Listing",title:"Copy name",keys:["\u21E7Y"],scope:"listing",own:!0},{id:"filter",group:"Listing",title:"Filter",keys:["/","\u2318F"],own:!0},{id:"new-note",group:"Listing",title:"New note",keys:["n"],own:!0},{id:"view-details",group:"View",title:"Details",keys:["v d"],own:!0},{id:"view-list",group:"View",title:"List",keys:["v l"],own:!0},{id:"view-tree",group:"View",title:"Tree",keys:["v t"],own:!0},{id:"view-tiles",group:"View",title:"Tiles",keys:["v i"],own:!0},{id:"view-icons",group:"View",title:"Large icons",keys:["v g"],own:!0},{id:"sort-name",group:"View",title:"Sort by name",keys:["s n"],own:!0},{id:"sort-date",group:"View",title:"Sort by modified",keys:["s m"],own:!0},{id:"sort-size",group:"View",title:"Sort by size",keys:["s z"],own:!0},{id:"sort-type",group:"View",title:"Sort by type",keys:["s t"],own:!0},{id:"sort-rev",group:"View",title:"Reverse the order",keys:["s r"],own:!0},{id:"group",group:"View",title:"Next grouping",keys:["s g"],own:!0},{id:"filter-panel",group:"View",title:"Filter panel",keys:["f"],own:!0},{id:"deep",group:"View",title:"Include subfolders",keys:["\u21E7D"],scope:"listing",own:!0},{id:"hidden",group:"View",title:"Hidden files",keys:["."],own:!0},{id:"zoom-in",group:"View",title:"Less detail, bigger items",keys:["="],own:!0},{id:"zoom-out",group:"View",title:"More detail, smaller items",keys:["-"],own:!0},{id:"zoom-reset",group:"View",title:"Standard detail",keys:["0"],own:!0},{id:"tab-keep",group:"Tabs",title:"Keep this place",keys:["t"],own:!0},{id:"tab-close",group:"Tabs",title:"Close",keys:["w"],own:!0},{id:"tab-pin",group:"Tabs",title:"Pin",keys:["p"],own:!0},{id:"tab-step",group:"Tabs",title:"Previous or next",keys:["[","]"],own:!0,over:!0},{id:"tab-jump",group:"Tabs",title:"Jump to tab 1 to 9",keys:["e 1\u20269"],own:!0,over:!0},{id:"tab-reopen",group:"Tabs",title:"Reopen closed",keys:["\u21E7T"],own:!0},{id:"tab-left",group:"Tabs",title:"Move tab left",keys:["\u21E7["],own:!0},{id:"tab-right",group:"Tabs",title:"Move tab right",keys:["\u21E7]"],own:!0},{id:"tab-list",group:"Tabs",title:"All tabs",keys:["g a"],own:!0},{id:"tab-focus-move",group:"Tabs",title:"Move between tabs",keys:["\u2190","\u2192"],scope:"tabs"},{id:"tab-focus-shift",group:"Tabs",title:"Drag the focused tab",keys:["\u21E7\u2190","\u21E7\u2192"],scope:"tabs",own:!0},{id:"tab-focus-close",group:"Tabs",title:"Close the focused tab",keys:["\u232B"],scope:"tabs",own:!0},{id:"tab-focus-menu",group:"Tabs",title:"Menu of the focused tab",keys:["\u21E7F10"],scope:"tabs",own:!0},{id:"side-move",group:"Sidebar",title:"Move",keys:["\u2191","\u2193"],scope:"sidebar"},{id:"side-lens",group:"Sidebar",title:"Switch lens (on the bar)",keys:["\u2190","\u2192"],scope:"sidebar"},{id:"side-open",group:"Sidebar",title:"Open as a tab",keys:["\u21A9"],scope:"sidebar"},{id:"side-bg",group:"Sidebar",title:"Background tab",keys:["\u2325\u21A9"],scope:"sidebar",own:!0},{id:"side-rename",group:"Sidebar",title:"Rename",keys:["F2"],scope:"sidebar",own:!0},{id:"side-tags",group:"Sidebar",title:"Tags",keys:["#"],scope:"sidebar"},{id:"side-remove",group:"Sidebar",title:"Remove",keys:["\u232B"],scope:"sidebar",own:!0},{id:"side-rail",group:"Sidebar",title:"To the lens bar",keys:["\u2190"],scope:"sidebar",own:!0},{id:"side-into",group:"Sidebar",title:"Into the open lens (on the bar)",keys:["\u2325\u2193"],scope:"sidebar",own:!0},{id:"side-fold",group:"Sidebar",title:"Fold a group",keys:["Space"],scope:"sidebar"},{id:"lens-filter",group:"Sidebar",title:"Filter this list",keys:["/"],scope:"sidebar",own:!0},{id:"ask-quote",group:"Sidebar",title:"Quote the selection or the part of a chat under the pointer into a chat",keys:["q"],own:!0},{id:"lens-tags",group:"Sidebar",title:"Tag chips",keys:["g #"],own:!0},{id:"side-look",group:"Sidebar",title:"Preview a file",keys:["Space"],scope:"sidebar",own:!0},{id:"side-chrome",group:"Sidebar",title:"Open in a Chrome tab",keys:["\u2318\u21A9"],scope:"sidebar",own:!0},{id:"side-props",group:"Sidebar",title:"Note colour, pin and tags",keys:["#"],scope:"sidebar",own:!0},{id:"pv-close",group:"Preview",title:"Close",keys:["Space","Esc"],scope:"preview",own:!0},{id:"pv-step",group:"Preview",title:"Previous or next file",keys:["\u2191","\u2193","\u2190","\u2192"],scope:"preview",own:!0},{id:"pv-open",group:"Preview",title:"Open the page",keys:["\u21A9"],scope:"preview",own:!0},{id:"pv-tab",group:"Preview",title:"Keep as a tab",keys:["t"],scope:"preview",own:!0},{id:"pv-dock",group:"Preview",title:"Dock or float",keys:["d"],scope:"preview",own:!0},{id:"pv-copy",group:"Preview",title:"Copy contents",keys:["c"],scope:"preview",own:!0},{id:"pv-ask",group:"Preview",title:"Ask about it",keys:["a"],scope:"preview",own:!0},{id:"fp-raw",group:"File page",title:"Raw or rendered",keys:["r"],scope:"file",own:!0},{id:"fp-edit",group:"File page",title:"Edit",keys:["e e"],scope:"file",own:!0},{id:"fp-find",group:"File page",title:"Find in file",keys:["/"],scope:"file",own:!0},{id:"fp-comment",group:"File page",title:"Comment on the selection or paragraph",keys:["c"],scope:"file",own:!0},{id:"fp-cm-reply",group:"File page",title:"Reply to the comment",keys:["\u21E7R"],scope:"file",own:!0},{id:"fp-toc",group:"File page",title:"Contents",keys:["\u21E7O"],scope:"file",own:!0},{id:"fp-width",group:"File page",title:"Reading width",keys:["\u21E7W"],scope:"file",own:!0},{id:"fp-comments",group:"File page",title:"Comments panel",keys:["\u21E7C"],scope:"file",own:!0},{id:"fp-cm-step",group:"File page",title:"Previous or next comment",keys:["\u2325\u2191","\u2325\u2193"],scope:"file",own:!0},{id:"fp-cm-clear",group:"File page",title:"Let go of the comment being looked at or written",keys:["Esc"],scope:"file",own:!0},{id:"fp-cm-post",group:"File page",title:"Post, or post a reply",keys:["\u2318\u21A9","\u2318\u21E7\u21A9"],scope:"file"},{id:"ed-save",group:"Editor",title:"Save",keys:["\u2318S"],scope:"editor"},{id:"ed-bold",group:"Editor",title:"Bold, italic, code",keys:["\u2318B","\u2318I","\u2318E"],scope:"editor"},{id:"ed-move",group:"Editor",title:"Move line",keys:["\u2325\u2191","\u2325\u2193"],scope:"editor"},{id:"ed-dup",group:"Editor",title:"Copy line",keys:["\u2325\u21E7\u2191","\u2325\u21E7\u2193"],scope:"editor"},{id:"ed-indent",group:"Editor",title:"Indent",keys:["\u21E5","\u21E7\u21E5"],scope:"editor"},{id:"ed-undo",group:"Editor",title:"Undo, redo",keys:["\u2318Z","\u2318\u21E7Z"],scope:"editor"},{id:"ed-link",group:"Editor",title:"Link",keys:["\u2318K"],scope:"editor"},{id:"ed-more",group:"Editor",title:"Strike, heading, quote, numbered list",keys:["\u2318\u21E7X","\u2318\u21E7H","\u2318\u21E7.","\u2318\u21E77"],scope:"editor"},{id:"ed-mode",group:"Editor",title:"Raw, split or rich",keys:["\u2318\u21E7P"],scope:"editor"},{id:"note-rename",group:"Editor",title:"Rename this note",keys:["F2"],scope:"editor",own:!0,field:!0},{id:"note-delete",group:"Editor",title:"Move this note to .trash",keys:["\u2318\u21E7\u232B"],scope:"editor",own:!0,field:!0},{id:"dp-next",group:"Decision page",title:"Next card",keys:["j","\u2193"],scope:"decision",own:!0},{id:"dp-prev",group:"Decision page",title:"Previous card",keys:["k","\u2191"],scope:"decision",own:!0},{id:"dp-first",group:"Decision page",title:"First card",keys:["g","Home"],scope:"decision",own:!0},{id:"dp-last",group:"Decision page",title:"Last card",keys:["\u21E7G","End"],scope:"decision",own:!0},{id:"dp-pick",group:"Decision page",title:"Pick an option of this decision",keys:["1\u20269"],scope:"decision",own:!0},{id:"dp-agree",group:"Decision page",title:"Agree or disagree with this item",keys:["a"],scope:"decision",own:!0},{id:"dp-note",group:"Decision page",title:"Note on this card",keys:["n"],scope:"decision",own:!0},{id:"dp-notes-all",group:"Decision page",title:"Note fields on every card",keys:["m"],scope:"decision",own:!0},{id:"dp-end-notes",group:"Decision page",title:"Notes for Claude at the end",keys:["\u21E7N"],scope:"decision",own:!0},{id:"dp-flagged",group:"Decision page",title:"Only the cards you changed",keys:["f"],scope:"decision",own:!0},{id:"dp-theme",group:"Decision page",title:"Dark or light",keys:["t"],scope:"decision",own:!0},{id:"dp-panel",group:"Decision page",title:"Show the answer as it will be sent",keys:["p"],scope:"decision",own:!0},{id:"dp-copy",group:"Decision page",title:"Copy the answer",keys:["c"],scope:"decision",own:!0},{id:"dp-submit",group:"Decision page",title:"Send the answer, or replace the one sent",keys:["s","\u2318\u21A9"],scope:"decision",own:!0},{id:"dp-esc",group:"Decision page",title:"Shrink grown pictures, or leave the note you are typing in",keys:["Esc"],scope:"decision",own:!0,field:!0},{id:"dp-view-step",group:"Decision page",title:"Previous or next picture in the large view",keys:["\u2190","\u2192"],scope:"dialog",own:!0},{id:"menu-move",group:"Menus and dialogs",title:"Move in a menu",keys:["\u2191","\u2193"],scope:"menu",own:!0},{id:"menu-pick",group:"Menus and dialogs",title:"Pick",keys:["\u21A9"],scope:"menu",own:!0},{id:"dlg-tabs",group:"Menus and dialogs",title:"Dialog pages",keys:["[","]"],scope:"dialog",own:!0},{id:"dlg-fields",group:"Menus and dialogs",title:"Next control",keys:["\u21E5"],scope:"dialog"},{id:"dlg-choice",group:"Menus and dialogs",title:"Change a choice",keys:["\u2190","\u2192"],scope:"dialog"}];var pe={popover:{esc:!0,outside:!0,anchor:!0,scroll:!0,blur:!0},hovercard:{esc:!0,scroll:!0},transient:{},command:{esc:!0,outside:!0},dialog:{esc:!0},float:{esc:!0}},Nt={command:!0,dialog:!0,float:!0},G=[],Ke=typeof HTMLElement<"u"&&typeof HTMLElement.prototype.showPopover=="function",jt=!1,re=null,It=null,_t=0,Er='button:not([disabled]),[href],input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])';function ce(e,t){if(Sr(),t.anchor&&re===t.anchor)return re=null,{el:e,kind:t.kind,open:!1,close(){},place(){}};G.find(c=>c.el===e)?.close("replaced"),t.group&&G.filter(c=>c.opts.group===t.group).forEach(c=>c.close("replaced"));let r=document.getElementById("fe")??document.body,n=!e.isConnected;n&&r.appendChild(e),e.dataset.layer=t.kind,t.role&&e.setAttribute("role",t.role),t.label&&e.setAttribute("aria-label",t.label),Nt[t.kind]&&e.setAttribute("aria-modal","true"),Ke&&(e.setAttribute("popover","manual"),e.showPopover());let i=t.anchor??null;i?.setAttribute("aria-expanded","true"),i&&e.id&&i.setAttribute("aria-controls",e.id);let o=!0,l={el:e,kind:t.kind,opts:t,returnTo:document.activeElement,at:null,seq:0,get open(){return o},place:()=>Rt(e,t),close(c="api"){if(!o)return;o=!1;let h=G.indexOf(l);h>=0&&G.splice(h,1),i?.setAttribute("aria-expanded","false");let d=e.contains(document.activeElement);if(Ke&&e.matches(":popover-open")&&e.hidePopover(),e.removeAttribute("popover"),delete e.dataset.layer,n&&e.remove(),d||document.activeElement===document.body){let s=i??l.returnTo;s?.isConnected&&s.focus({preventScroll:!0})}t.onClose?.(c)}};G.push(l),l.seq=++_t,Rt(e,t),l.at=(i??t.origin)?.getBoundingClientRect()??null;let g=t.focus??(Nt[t.kind]?"first":"none");return g==="first"?e.querySelector(Er)?.focus({preventScroll:!0}):g instanceof HTMLElement&&g.focus({preventScroll:!0}),l}function Ce(e){if(Ke){if(e.matches(":popover-open")){let t=Number(e.dataset.raised);if(!G.some(a=>a.seq>t)||e.contains(document.activeElement))return}e.dataset.raised=String(_t),e.hasAttribute("popover")||e.setAttribute("popover","manual"),e.matches(":popover-open")&&e.hidePopover(),e.showPopover(),e.offsetWidth}}function Ft(){return G.some(e=>pe[e.kind].esc)}function Rt(e,t){let a=t.place??(t.point?"point":t.anchor?"below":"none");if(a==="none")return;e.style.position="fixed",e.style.margin="0",e.style.inset="auto";let r=t.offset??4,n=8,i=e.offsetWidth,o=e.offsetHeight,l,g;if(a==="point"&&t.point)l=t.point.x,g=t.point.y;else{let c=(t.anchor??e).getBoundingClientRect();if(a==="right")l=c.right+r,g=c.top;else{l=t.align==="end"?c.right-i:c.left;let h=c.bottom+r,d=c.top-r-o;g=a==="above"?d>=n?d:h:h+o<=innerHeight-n||d<n?h:d}}e.style.left=`${Math.max(n,Math.min(l,innerWidth-i-n))}px`,e.style.top=`${Math.max(n,Math.min(g,innerHeight-o-n))}px`}var Tr=[];function Sr(){jt||(jt=!0,document.addEventListener("keydown",e=>{if(e.key!=="Escape")return;G.filter(a=>a.kind==="hovercard").forEach(a=>a.close("esc"));let t=[...G].reverse().find(a=>pe[a.kind].esc&&!a.opts.keepOnEsc?.());t&&(e.preventDefault(),e.stopPropagation(),t.close("esc"))},!0),document.addEventListener("pointerdown",e=>{It=e.target;let t=e.target,a=G[G.length-1];if(!a){Tr.forEach(n=>{n.isOpen()&&!n.el.contains(t)&&n.close()});return}if(a.el.contains(t))return;let r=a.opts.anchor;if(r?.contains(t)){pe[a.kind].anchor&&(a.close("anchor"),re=r);return}re=null,pe[a.kind].outside&&a.close("outside")},!0),document.addEventListener("click",e=>{re&&setTimeout(()=>{re=null});let t=G[G.length-1],a=t?.opts.backdrop;a&&e.target===a&&It===a&&t.close("outside")},!0),document.addEventListener("keydown",()=>{re=null},!0),document.addEventListener("scroll",e=>{let t=e.target;for(let a of[...G]){if(!pe[a.kind].scroll||a.el.contains(t))continue;let r=a.opts.anchor??a.opts.origin;if(r&&a.at){let n=r.getBoundingClientRect();if(Math.abs(n.top-a.at.top)<2&&Math.abs(n.left-a.at.left)<2)continue}a.close("scroll")}},!0),document.addEventListener("focusin",e=>{let t=e.target;for(let a of[...G])pe[a.kind].blur&&!a.el.contains(t)&&!a.opts.anchor?.contains(t)&&a.close("blur")}))}var Ue=new Map;function _(e,t,a){Ue.set(e,{run:t,when:a})}function fe(e){let t=Ue.get(e);return!!t&&(!t.when||t.when())}function Q(e,t){return fe(e)?(Ue.get(e).run(t),!0):!1}var zr={ArrowUp:"\u2191",ArrowDown:"\u2193",ArrowLeft:"\u2190",ArrowRight:"\u2192",Enter:"\u21A9",Backspace:"\u232B",Delete:"\u232B",Escape:"Esc"," ":"Space",Tab:"\u21E5",PageUp:"PgUp",PageDown:"PgDn",Home:"Home",End:"End"},Bt={"{":"[","}":"]","~":"`"},Cr=typeof navigator>"u"||/Mac|iPhone|iPad/.test(navigator.platform);function Hr(e){let t=Cr?e:{key:e.key,code:e.code,shiftKey:e.shiftKey,altKey:e.altKey,metaKey:e.metaKey||e.ctrlKey,ctrlKey:!1},a=zr[t.key],r=a??t.key,n=t.shiftKey;return a||(Bt[r]?(r=Bt[r],n=!0):/^[a-z]$/i.test(r)?(/^[A-Z]$/.test(r)&&!t.metaKey&&(n=!0),r=n||t.metaKey?r.toUpperCase():r.toLowerCase()):r.length===1&&(n=!1)),t.altKey&&/^Key[A-Z]$/.test(t.code)&&(r=t.code.slice(3)),(t.metaKey?"\u2318":"")+(t.ctrlKey?"\u2303":"")+(t.altKey?"\u2325":"")+(n?"\u21E7":"")+r}var Gt=()=>({scopes:new Set(["any"]),typing:!1,blocked:!1});function Wt(e){Gt=e}var xe=be.filter(e=>e.own),Ar=["1","2","3","4","5","6","7","8","9"],Ae=e=>e.keys.flatMap(t=>t.endsWith("1\u20269")?Ar.map(a=>t.slice(0,-3)+a):[t]),Vt=new Set(["\u2191","\u2193","\u2190","\u2192","\u21A9","Space","\u232B","Home","End"]),Pr=new Set(be.filter(e=>e.scope==="preview").flatMap(e=>Ae(e))),Kt=e=>e.replace(/^[⌘⌃⌥⇧]+/,""),He=(e,t,a="")=>{let r=e.scope??"any";return r==="preview"&&t.widget&&Vt.has(Kt(a))?!1:r!=="any"?t.scopes.has(r):!t.scopes.has("any")||t.widget&&Vt.has(Kt(a))?!1:!t.scopes.has("preview")||e.over===!0||a&&e.over?.includes(a)?!0:!!t.docked&&!!a&&!Pr.has(a)},We="",Ge=null,Z=null;function we(e){if(We=e,Ge&&clearTimeout(Ge),!e){Z?.remove(),Z=null;return}Ge=setTimeout(()=>we(""),1600),Z||(Z=document.createElement("div"),Z.className="fe-chord",(document.getElementById("fe")??document.body).appendChild(Z),Ce(Z));let t=xe.filter(a=>fe(a.id)&&a.keys.some(r=>r.startsWith(e+" ")));Z.innerHTML=`<kbd>${p(e)}</kbd><span>then</span>${t.slice(0,8).map(a=>`<span class="fe-chord-o"><kbd>${p(a.keys.find(r=>r.startsWith(e+" ")).slice(e.length+1))}</kbd>${p(a.title)}</span>`).join("")}`}function Or(e){let t=Gt(),a=Hr(e),r=document.activeElement;if(a==="\u2318K"&&!(r?.tagName==="TEXTAREA"||r?.isContentEditable))return e.preventDefault(),Q("palette");if(t.blocked||a==="Esc"&&Ft())return we(""),!1;if(t.typing){we("");let o=xe.find(l=>l.field&&Ae(l).includes(a)&&He(l,t,a)&&fe(l.id));return o?(e.preventDefault(),e.stopImmediatePropagation(),Q(o.id,a),!0):!1}if(We){let o=`${We} ${a}`;we("");let l=xe.filter(c=>Ae(c).includes(o)&&He(c,t,o)&&fe(c.id)),g=l.find(c=>(c.scope??"any")!=="any")??l[0];return g&&Q(g.id,o)?(e.preventDefault(),e.stopImmediatePropagation(),!0):!1}let n=xe.filter(o=>Ae(o).includes(a)&&He(o,t,a)&&fe(o.id)),i=n.find(o=>(o.scope??"any")!=="any")??n[0];return i?(e.preventDefault(),e.stopImmediatePropagation(),Q(i.id,a),!0):!e.metaKey&&!e.ctrlKey&&!e.altKey&&xe.some(o=>He(o,t,a+" ")&&fe(o.id)&&o.keys.some(l=>l.startsWith(a+" ")))?(e.preventDefault(),e.stopImmediatePropagation(),we(a),!0):!1}function Ut(e){document.addEventListener("keydown",t=>{t.defaultPrevented||e?.(t)||Or(t)},!0)}var xi=[{id:"all",label:"All",icon:V.apps},{id:"actions",label:"Actions",icon:m.keyboard},{id:"tabs",label:"Tabs",icon:V.tabset},{id:"saved",label:"Saved",icon:V.bm},{id:"recent",label:"Recent",icon:V.recent},{id:"notes",label:"Notes",icon:m.notes},{id:"here",label:"Here",icon:V.folder},{id:"comments",label:"Comments",icon:m.comment},{id:"chats",label:"Chats",icon:m.ai}];var wi={keys:m.keyboard,settings:V.gear,hints:m.keyboard,sidebar:m.preview,theme:m.appearance,esc:m.close,up:m.prev,home:V.home,path:m.link,"goto-bg":m.link,"note-rename":m.rename,"note-delete":m.trash,"open-pick":m.folderOpen,save:V.bm,terminal:m.terminal,"terminal-copy":m.copy,"area-next":m.stack,"area-prev":m.stack,"to-listing":m.list,"to-sidebar":m.preview,"to-tabs":m.tab,"to-toolbar":m.stack,"to-path":m.link,"lens-places":V.home,"lens-saved":V.bm,"lens-notes":m.notes,"lens-recent":V.recent,"lens-search":V.search,"lens-ask":m.ai,"lens-docs":m.comment,"open-bg":m.tab,"open-chrome":m.external,menu:m.list,"select-all":m.task,"copy-paths":m.copy,"copy-path":m.copy,"copy-name":m.copy,filter:V.search,"new-note":m.add,"tree-open":m.folderOpen,"tree-close":V.folder,deep:m.stack,"view-details":m.table,"view-list":m.list,"view-tree":m.contents,"view-tiles":V.apps,"view-icons":m.image,"sort-name":m.contents,"sort-date":m.clock,"sort-size":m.data,"sort-type":m.file,"sort-rev":m.rotate,group:m.stack,"filter-panel":V.search,hidden:m.eye,"zoom-in":m.zoomIn,"zoom-out":m.zoomOut,"zoom-reset":m.actualSize,"tab-keep":m.tab,"tab-close":m.close,"tab-pin":m.pin,"tab-step":m.next,"tab-reopen":m.reset,"tab-left":m.prev,"tab-right":m.next,"tab-list":m.list,"pv-dock":m.preview,"pv-copy":m.copy,"pv-ask":m.ai,"pv-tab":m.tab,"pv-open":m.external,"fp-raw":m.fmtCode,"fp-edit":m.rename,"fp-find":V.search,"fp-toc":m.contents,"fp-width":m.fit,"fp-comments":m.comment,"fp-comment":m.comment,"fp-cm-reply":m.comment,"fp-cm-step":m.comment};var Pe=e=>e.noneCode||"z";function ye(e){let t={picks:{},agree:{},notes:{},endNotes:""};for(let a of e.decisions??[]){let r=a.options.find(n=>n.rec)??a.options[0];r&&(t.picks[a.id]=r.code),a.note&&(t.notes[a.id]=a.note)}for(let a of e.sections??[])t.agree[a.id]=!0,a.note&&(t.notes[a.id]=a.note);return t}function Je(e,t){let a=ye(e);if(!t)return a;for(let r of e.decisions??[]){let n=t.picks?.[r.id];n&&(r.options.some(i=>i.code===n)||r.none&&n===Pe(r))&&(a.picks[r.id]=n)}for(let r of e.sections??[])typeof t.agree?.[r.id]=="boolean"&&(a.agree[r.id]=t.agree[r.id]);for(let[r,n]of Object.entries(t.notes??{}))typeof n=="string"&&(a.picks[r]!==void 0||a.agree[r]!==void 0)&&(a.notes[r]=n);return typeof t.endNotes=="string"&&(a.endNotes=t.endNotes),a}function Oe(e,t,a){let r=ye(e);if(a in t.picks&&t.picks[a]!==r.picks[a]||a in t.agree&&t.agree[a]!==r.agree[a])return"changed";let i=(t.notes[a]??"").trim();return i&&i!==(r.notes[a]??"").trim()?"noted":null}function De(e,t){let a=[...(e.decisions??[]).map(n=>n.id),...(e.sections??[]).map(n=>n.id)],r=a.filter(n=>Oe(e,t,n)).length;return{items:a.length,flagged:r,asDrafted:r===0&&!t.endNotes.trim()}}var Jt=e=>"bfb-dp-answers:"+(e.storageKey||e.title||"untitled");function Yt(e,t){let a={d:{},dnotes:{},screens:{},endnotes:t.endNotes};for(let r of e.decisions??[])t.picks[r.id]&&(a.d[r.id]=t.picks[r.id]),a.dnotes[r.id]=t.notes[r.id]??"";for(let r of e.sections??[])a.screens[r.id]={agree:t.agree[r.id]!==!1,note:t.notes[r.id]??""};return a}function Xt(e,t){let a={picks:{...t.d??{}},agree:{},notes:{},endNotes:t.endnotes??""};for(let r of e.decisions??[])a.notes[r.id]=t.dnotes?.[r.id]??"";for(let r of e.sections??[]){let n=t.screens?.[r.id];a.agree[r.id]=n?.agree!==!1,a.notes[r.id]=n?.note??""}return Je(e,a)}function Zt(e,t){let a=[],r=e.decisions??[];r.length&&a.push(r.map(i=>i.id+(t.picks[i.id]??"?")).join(" "));let n=[];for(let i of r)(t.notes[i.id]??"").trim()&&n.push(`${i.id}: ${t.notes[i.id].trim()}`);for(let i of e.sections??[]){let o=(t.notes[i.id]??"").trim();(t.agree[i.id]===!1||o)&&n.push(`${i.id}: ${t.agree[i.id]===!1?"DISAGREE":"agree"}${o?` (${o})`:""}`)}return n.length&&a.push("notes (not composed, host down):",...n),t.endNotes.trim()&&a.push("notes:",t.endNotes.trim()),a.join(`
`)}function Qt(e,t){let a=ye(e),r=(e.decisions??[]).map(i=>{let o=t.picks[i.id]??"",l=i.options.find(g=>g.code===o)?.label??(i.none&&o===Pe(i)?i.noneLabel||"None of these":o);return{id:i.id,code:o,label:l,moved:o!==a.picks[i.id]}}),n=[];for(let i of e.decisions??[])(t.notes[i.id]??"").trim()&&n.push(`${i.id}: ${t.notes[i.id].trim()}`);for(let i of e.sections??[]){let o=(t.notes[i.id]??"").trim();t.agree[i.id]===!1?n.push(`${i.title||i.id}: disagreed${o?`, ${o}`:""}`):o&&n.push(`${i.title||i.id}: ${o}`)}return{picks:r,lines:n}}function ea(e){return`<input type="checkbox" role="switch" class="fe-switch${e.small?" sm":""}${e.cls?" "+e.cls:""}"${e.id?` id="${e.id}"`:""} title="${p(e.title)}" aria-label="${p(e.label??e.title)}"${e.checked?" checked":""}>`}var Dr={fit:!0,zoom:1,rot:0,flip:!1};function Ye(e,t,a){return a%180===0?{w:e,h:t}:{w:t,h:e}}function qr(e,t,a,r,n){let i=Ye(e,t,a);return!i.w||!i.h?1:Math.min(1,Math.max(r-32,1)/i.w,Math.max(n-32,1)/i.h)}var ta=1.25,Nr=e=>Math.min(16,Math.max(.05,e));function jr(e){return`translate(-50%,-50%) scaleX(${e.flip?-1:1}) rotate(${e.rot}deg)`}var ee=(e,t,a,r)=>`<button class="btn" data-img="${e}" title="${p(r)}">${t}<span>${a}</span></button>`;function aa(e,t){e.innerHTML=`
    <div class="bar fe-ql-imgbar" role="toolbar" aria-label="Image tools">
      ${ee("in",m.zoomIn,"zoom in","Zoom in")}
      ${ee("out",m.zoomOut,"zoom out","Zoom out")}
      ${ee("fit",m.fit,"fit","Fit the picture in the panel")}
      ${ee("actual",m.actualSize,"actual size","Show at 100%")}
      ${ee("rotate",m.rotate,"rotate","Turn a quarter clockwise")}
      ${ee("flip",m.flip,"flip","Mirror left to right")}
      ${ee("copy",m.copyImage,"copy image","Copy the picture as shown")}
      ${ee("open",m.external,"open in app","Open in the default app")}
    </div>
    <div class="fe-ql-imgstage"><div class="fe-ql-imgsizer"><img class="fe-ql-img" src="${p(t.href)}" alt="${p(t.name)}"></div></div>
    <div class="fe-ql-dim"></div>`;let a=e.querySelector(".fe-ql-imgstage"),r=e.querySelector(".fe-ql-imgsizer"),n=e.querySelector("img.fe-ql-img"),i=e.querySelector(".fe-ql-dim"),o={...Dr},l=()=>({w:n.naturalWidth,h:n.naturalHeight}),g=()=>o.fit?qr(l().w,l().h,o.rot,a.clientWidth,a.clientHeight):o.zoom,c=()=>{let s=l();if(!s.w)return;let x=g(),v=Ye(s.w*x,s.h*x,o.rot);r.style.width=`${v.w}px`,r.style.height=`${v.h}px`,n.style.width=`${s.w*x}px`,n.style.height=`${s.h*x}px`,n.style.transform=jr(o),i.textContent=`${s.w} \xD7 ${s.h} \xB7 ${Math.round(x*100)}%`,e.dataset.zoom=String(Math.round(x*100)),e.dataset.rot=String(o.rot),e.dataset.flip=o.flip?"1":"0"};n.complete?c():n.addEventListener("load",c,{once:!0}),typeof ResizeObserver<"u"&&new ResizeObserver(()=>{o.fit&&c()}).observe(a);let h=async()=>{try{let s=await new Promise(L=>chrome.runtime.sendMessage({type:"bfb-fetch-image",url:new URL(t.href,location.href).href},O=>L(O??{ok:!1,error:"no reply"})));if(!s.ok||!s.base64)throw new Error(s.error||"could not read the image");let x=Uint8Array.from(atob(s.base64),L=>L.charCodeAt(0)),v=URL.createObjectURL(new Blob([x],{type:s.type||"image/png"})),y=new Image;await new Promise((L,O)=>{y.onload=L,y.onerror=()=>O(new Error("cannot decode the image")),y.src=v});let T={w:y.naturalWidth,h:y.naturalHeight},w=Ye(T.w,T.h,o.rot),k=document.createElement("canvas");k.width=w.w,k.height=w.h;let M=k.getContext("2d");M.translate(w.w/2,w.h/2),M.scale(o.flip?-1:1,1),M.rotate(o.rot*Math.PI/180),M.drawImage(y,-T.w/2,-T.h/2),URL.revokeObjectURL(v);let C=await new Promise(L=>k.toBlob(L,"image/png"));if(!C)throw new Error("could not encode the image");await navigator.clipboard.write([new ClipboardItem({"image/png":C})]),t.notify("Image copied")}catch(s){t.notify(te(s,"Copying the image"))}},d=s=>{if(s==="in"||s==="out")o={...o,zoom:Nr(g()*(s==="in"?ta:1/ta)),fit:!1};else if(s==="fit")o={...o,fit:!0};else if(s==="actual")o={...o,zoom:1,fit:!1};else if(s==="rotate")o={...o,rot:(o.rot+90)%360};else if(s==="flip")o={...o,flip:!o.flip};else if(s==="copy"){h();return}else if(s==="open"){t.openNative(t.path).then(x=>{x||t.notify("Open in app needs the native host: run native/install.sh")});return}c()};e.querySelector(".fe-ql-imgbar").addEventListener("click",s=>{let x=s.target.closest("[data-img]");x&&d(x.dataset.img)}),a.addEventListener("wheel",s=>{(s.ctrlKey||s.metaKey)&&(s.preventDefault(),d(s.deltaY<0?"in":"out"))},{passive:!1})}var ra=1280,Ir=2400,Rr=12,_r=e=>typeof e=="number"&&e>=0&&e<=1;function oa(e){return Array.isArray(e)?e.filter(t=>!!t&&[t.x,t.y,t.w,t.h].every(_r)&&t.x+t.w<=1.001&&t.y+t.h<=1.001).slice(0,Rr).map(t=>({x:t.x,y:t.y,w:t.w,h:t.h,label:typeof t.label=="string"?t.label:void 0})):[]}function sa(e,t){let a=typeof t=="string"?t:t?.src;if(typeof a!="string")return null;let r=/\.html?$/i.test(a),n=typeof t=="object"&&!r?oa(t.marks):[],i=o=>n.length?{...o,marks:n}:o;return/^https?:\/\//.test(a)?r?null:i({src:a,name:a.split("/").pop()||a,kind:"img"}):!a||a.startsWith("/")||a.split(/[\\/]/).includes("..")||/^[a-z]+:/i.test(a)?null:i({src:e+a.split("/").map(encodeURIComponent).join("/"),name:a,kind:r?"html":"img"})}var Qe=e=>`<span class="fe-dv-marks" aria-hidden="true">${e.map((t,a)=>`<span class="fe-dv-mark" style="--x:${t.x};--y:${t.y};--w:${t.w};--h:${t.h}"${t.label?` title="${p(t.label)}"`:""}><b>${a+1}</b></span>`).join("")}</span>`,Fr=e=>e.some(t=>t.label)?`<figcaption class="fe-dv-mark-key">${e.map((t,a)=>`<span><b>${a+1}</b>${p(t.label??"")}</span>`).join("")}</figcaption>`:"";function Br(e,t){let a=t.offsetParent;if(!a||!e.naturalWidth)return;let r=e.getBoundingClientRect(),n=a.getBoundingClientRect(),i=Math.min(r.width/e.naturalWidth,r.height/e.naturalHeight),o=e.naturalWidth*i,l=e.naturalHeight*i;t.style.left=`${r.left-n.left+a.scrollLeft+(r.width-o)/2}px`,t.style.top=`${r.top-n.top+a.scrollTop+(r.height-l)/2}px`,t.style.width=`${o}px`,t.style.height=`${l}px`}function Vr(e,t){let a=()=>Br(e,t);e.complete?a():e.addEventListener("load",a,{once:!0}),new ResizeObserver(a).observe(e)}var U=(e,t,a,r="")=>`<button type="button" class="btn" data-icon data-size="sm" data-variant="ghost" data-media="${e}" title="${p(a)}" aria-label="${p(a)}"${r}>${t}</button>`;function et(e,t=!1){let a=e.kind==="html"?`<div class="fe-dv-frame"><iframe sandbox="allow-scripts" src="${p(e.src)}" title="${p(e.name)}" loading="lazy" tabindex="-1"></iframe></div>`:`<img src="${p(e.src)}" alt="${p(e.name)}" loading="lazy">${e.marks?Qe(e.marks):""}`;return`<figure class="fe-dv-media" data-kind="${e.kind}" data-src="${p(e.src)}" data-name="${p(e.name)}"${e.marks?` data-marks="${p(JSON.stringify(e.marks))}"`:""}>
    ${a}
    <span class="fe-dv-media-acts">
      ${e.marks?U("marks",m.eye,"Show or hide the marks",' aria-pressed="true"'):""}
      ${e.kind==="img"?U("zoom",m.zoomIn,"Grow to the full row, or shrink back"):""}
      ${U("focus",m.size,"Open large; \u2190 \u2192 go to the next")}
      ${t?U("compare",Ie.column,"Compare with another side by side",' aria-pressed="false"'):""}
    </span>
    ${e.marks?Fr(e.marks):""}
  </figure>`}function tt(e){return e.length?`<div class="fe-dv-strip" data-media-set>${e.map(t=>et(t)).join("")}</div>`:""}var Kr=e=>[...e.querySelectorAll(".fe-dv-media")],Xe=e=>{let t=e.dataset.marks?oa(JSON.parse(e.dataset.marks)):[];return{src:e.dataset.src,name:e.dataset.name,kind:e.dataset.kind,...t.length?{marks:t}:{}}},Gr=()=>matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth";function Wr(e){let t=!e.classList.contains("zoomed");e.classList.toggle("zoomed",t);let a=e.closest("[data-media-label]");a?.classList.toggle("zoomed",!!a.querySelector(".fe-dv-media.zoomed")),t&&requestAnimationFrame(()=>e.scrollIntoView({block:"nearest",behavior:Gr()}))}function la(e){let t=[...e.querySelectorAll(".zoomed")];return t.forEach(a=>a.classList.remove("zoomed")),t.length>0}var ne=null,Ze=!0;function da(e,t){Ze=t,e.classList.toggle("marks-off",!t)}_("dp-view-step",e=>ne?.step?.(e==="\u2190"?-1:1),()=>!!ne?.layer.open);function pa(e,t){let a=document.createElement("div");return a.className="fe-dlg fe-dv-view",a.innerHTML=`<div class="fe-dlg-bg scrim"></div>
    <div class="panel fe-dv-view-box" role="dialog" aria-label="${p(t)}" tabindex="-1">
      <header class="bar fe-dv-view-head"><b class="fe-dv-view-title">${p(e)}</b><span class="fe-dv-view-tools"></span>${U("close",m.close,"Close (Esc)")}</header>
      <div class="fe-dv-view-body"></div>
    </div>`,(document.getElementById("fe")??document.body).append(a),{root:a,body:a.querySelector(".fe-dv-view-body"),head:a.querySelector(".fe-dv-view-head")}}function ca(e,t){let a=ce(e,{kind:"dialog",place:"none",focus:e.querySelector(".fe-dv-view-box"),backdrop:e.querySelector(".fe-dlg-bg"),onClose:()=>{e.remove(),ne=null,t?.()}});return e.querySelector('[data-media="close"]').addEventListener("click",()=>a.close("api")),a}function na(e,t,a){ne?.layer.close("replaced");let{root:r,body:n,head:i}=pa("","Large view"),o=e.some(d=>d.marks);i.querySelector(".fe-dv-view-tools").innerHTML=(o?U("marks",m.eye,"Show or hide the marks",' aria-pressed="true"'):"")+(e.length>1?U("prev",m.prev,"Previous (\u2190)")+U("next",m.next,"Next (\u2192)"):"");let l=i.querySelector('[data-media="marks"]');r.classList.toggle("marks-off",!Ze),l?.setAttribute("aria-pressed",String(Ze));let g=t,c=()=>{let d=e[g];i.querySelector(".fe-dv-view-title").textContent=e.length>1?`${d.name} \xB7 ${g+1} of ${e.length}`:d.name,n.dataset.kind=d.kind,l&&(l.hidden=!d.marks),d.kind==="html"?n.innerHTML=`<iframe class="fe-dv-view-frame" sandbox="allow-scripts" src="${p(d.src)}" title="${p(d.name)}"></iframe>`:(n.innerHTML='<div class="fe-ql-imgwrap"></div>',aa(n.firstElementChild,{href:d.src,name:d.name,path:decodeURIComponent(new URL(d.src,location.href).pathname),notify:a,openNative:s=>typeof chrome>"u"||!chrome.runtime?.id?Promise.resolve(!1):new Promise(x=>chrome.runtime.sendMessage({type:"bfb-native-oneshot",host:"com.better_file_browser.ghostty",payload:{action:"open_file",path:s}},v=>x(!chrome.runtime.lastError&&!!v?.ok&&v.response?.success===!0)))}),d.marks&&n.querySelector(".fe-ql-imgsizer")?.insertAdjacentHTML("beforeend",Qe(d.marks)))},h=d=>{e.length>1&&(g=(g+d+e.length)%e.length,c())};i.querySelector('[data-media="prev"]')?.addEventListener("click",()=>h(-1)),i.querySelector('[data-media="next"]')?.addEventListener("click",()=>h(1)),l?.addEventListener("click",()=>{let d=r.classList.toggle("marks-off");l.setAttribute("aria-pressed",String(!d))}),c(),ne={layer:ca(r),step:h}}function Ur(e,t,a,r){ne?.layer.close("replaced");let{root:n,body:i,head:o}=pa(`${a[0]}  \xB7  ${a[1]}`,"Compare two");o.querySelector(".fe-dv-view-tools").innerHTML=U("out",m.zoomOut,"Zoom out both")+U("fit",m.fit,"Fit both")+U("in",m.zoomIn,"Zoom in both"),i.classList.add("fe-dv-compare"),i.innerHTML=[e,t].map((d,s)=>`<section class="fe-dv-cmp-pane" data-kind="${d.kind}">
      <div class="fe-dv-cmp-label">${p(a[s])}</div>
      <div class="fe-dv-cmp-scroll">${d.kind==="html"?`<iframe sandbox="allow-scripts" src="${p(d.src)}" title="${p(d.name)}"></iframe>`:`<span class="fe-dv-pic"><img src="${p(d.src)}" alt="${p(d.name)}">${d.marks?Qe(d.marks):""}</span>`}</div>
    </section>`).join("");let l=[...i.querySelectorAll(".fe-dv-cmp-scroll")],g=1,c=d=>{g=Math.min(8,Math.max(1,d)),l.forEach(s=>s.style.setProperty("--zoom",String(g)))};o.querySelector(".fe-dv-view-tools").addEventListener("click",d=>{let s=d.target.closest("[data-media]")?.dataset.media;s==="in"?c(g*1.5):s==="out"?c(g/1.5):s==="fit"&&c(1)});let h=!1;for(let d of l)d.addEventListener("scroll",()=>{if(h)return;h=!0;let s=d.scrollLeft/Math.max(1,d.scrollWidth-d.clientWidth),x=d.scrollTop/Math.max(1,d.scrollHeight-d.clientHeight);for(let v of l)v!==d&&(v.scrollLeft=s*(v.scrollWidth-v.clientWidth),v.scrollTop=x*(v.scrollHeight-v.clientHeight));requestAnimationFrame(()=>{h=!1})});i.style.setProperty("--mock-tall",`${Ir}px`),ne={layer:ca(n,r)}}var ia=e=>[...e.querySelectorAll(".fe-md img")].filter(t=>!t.closest(".fe-dv-media, a"));function fa(e,t){let a=new ResizeObserver(o=>{for(let l of o)l.target.style.setProperty("--scale",String(l.contentRect.width/ra))});e.querySelectorAll(".fe-dv-frame").forEach(o=>{o.style.setProperty("--mock-w",`${ra}px`),a.observe(o)}),e.querySelectorAll(".fe-dv-media[data-marks]").forEach(o=>{let l=o.querySelector("img"),g=o.querySelector(".fe-dv-marks");l&&g&&Vr(l,g)});for(let o of ia(e))o.classList.add("fe-dv-prose-img"),o.title||="Open large";let r=[],n=()=>{r.splice(0).forEach(o=>o.querySelector('[data-media="compare"]')?.setAttribute("aria-pressed","false"))},i=o=>o.closest("[data-media-label]")?.dataset.mediaLabel||o.dataset.name;e.addEventListener("click",o=>{let l=o.target,g=l.closest("img.fe-dv-prose-img");if(g){o.preventDefault(),o.stopPropagation();let d=ia(e);na(d.map(s=>({src:s.src,name:s.alt||decodeURIComponent(s.src.split("/").pop()||""),kind:"img"})),d.indexOf(g),t);return}let c=l.closest(".fe-dv-media");if(!c)return;let h=l.closest("[data-media]")?.dataset.media??(c.dataset.kind==="img"?"zoom":"");if(o.preventDefault(),o.stopPropagation(),!!h){if(h==="marks"){let d=c.classList.toggle("marks-off");c.querySelector('[data-media="marks"]').setAttribute("aria-pressed",String(!d))}else if(h==="zoom")Wr(c);else if(h==="focus"){let d=Kr(c.closest("[data-media-set]")??c);na(d.map(Xe),d.indexOf(c),t)}else if(h==="compare"){let d=r.indexOf(c);if(d>=0){r.splice(d,1),c.querySelector('[data-media="compare"]').setAttribute("aria-pressed","false");return}if(r[0]&&r[0].closest("[data-media-set]")!==c.closest("[data-media-set]")&&n(),r.push(c),c.querySelector('[data-media="compare"]').setAttribute("aria-pressed","true"),r.length===2){let[s,x]=r;Ur(Xe(s),Xe(x),[i(s),i(x)],n)}}}},!0)}var ge=(e,t=3)=>`<div class="fe-dv-clamp" style="--lines:${t}"><div class="fe-dv-clamp-in">${e}</div><button type="button" class="btn fe-dv-more" data-variant="ghost" data-size="sm" aria-expanded="false" hidden>More</button></div>`;function ga(e){let t=r=>{if(r.classList.contains("open"))return;let n=r.querySelector(".fe-dv-clamp-in");n.clientHeight&&(r.querySelector(".fe-dv-more").hidden=n.scrollHeight<=n.clientHeight+1)},a=new ResizeObserver(r=>r.forEach(n=>t(n.target.parentElement)));e.querySelectorAll(".fe-dv-clamp-in").forEach(r=>a.observe(r)),e.addEventListener("click",r=>{let n=r.target.closest(".fe-dv-more");if(!n)return;r.stopPropagation();let o=n.closest(".fe-dv-clamp").classList.toggle("open");n.textContent=o?"Less":"More",n.setAttribute("aria-expanded",String(o))})}var qe=(e,t)=>`<div class="fe-dp-md">${ae(e.replace(/([^\n])\n(?!\n)/g,`$1  
`),t)}</div>`,Jr=e=>/[─│┌┐└┘├┤═║╭╮╰╯]/.test(e)||/\S {3,}\S/.test(e),Yr=(e,t)=>{let a=Jr(e);return`<div class="fe-dp-preview" data-view="${a?"raw":"md"}">
    <button type="button" class="btn fe-dp-rawbtn" data-variant="ghost" data-size="sm" aria-pressed="${a}" title="Show the text exactly as written, or rendered">Raw</button>
    ${qe(e,t)}
    <pre class="fe-dp-pre">${p(e)}</pre>
  </div>`},at=(e,t)=>(e??[]).map(a=>sa(t,a)).filter(a=>!!a),ua=(e,t)=>t?`<button type="button" class="btn fe-dp-addnote" data-icon data-variant="ghost" data-size="sm" data-note-for="${p(e)}" title="Add a note (n)" aria-label="Add a note on ${p(e)}">${m.comment}</button>`:"",va=(e,t)=>t?`
  <div class="fe-dp-note" hidden>
    <textarea class="tb" data-note="${p(e)}" rows="2" placeholder="A note for Claude about ${p(e)}" aria-label="Note on ${p(e)}"></textarea>
  </div>`:"";function ma(e,t,a,r,n=!1){let i=at(t.images,r);return`<label class="fe-dp-opt${i.length?" tile":""}${n?" none":""}" data-code="${p(t.code)}" data-media-label="${p(`${t.code} \xB7 ${t.label}`)}" title="Answer code ${p(t.code)}">
      <input type="radio" name="dp-${p(e.id)}" value="${p(t.code)}">
      ${i.length?`<span class="fe-dp-tile-img">${i.map(o=>et(o,!0)).join("")}</span>`:""}
      <span class="fe-dp-opt-row">
        <kbd class="fe-dp-num">${a}</kbd>
        <span class="fe-dp-opt-tx"><span class="fe-dp-opt-lbl">${p(t.label)}</span>${t.why?`<span class="fe-dp-why">${p(t.why)}</span>`:""}</span>
        ${t.rec?'<span class="badge fe-dp-rec" data-size="sm" data-tone="quiet">Recommended</span>':""}
      </span>
    </label>`}var Xr=e=>e<=3?e:e===4?2:3;function Zr(e,t){if(!e.group)return"";let a=t.groups?.[e.group]?.color;return`<span class="badge fe-dp-dgrp" data-size="sm" data-tone="quiet"${a?` style="--grp:${p(a)}"`:""}>${p(e.group)}</span>`}function Qr(e,t,a,r){let n=e.options.filter(o=>o.images?.length).length,i=e.none?{code:Pe(e),label:e.noneLabel||"None of these"}:null;return`<article class="card fe-dp-card" data-id="${p(e.id)}" data-kind="decision" tabindex="-1">
    <header class="fe-dp-card-head"><span class="badge fe-dp-id" data-tone="quiet">${p(e.id)}</span><h3 class="fe-dp-q">${p(e.question)}</h3>${Zr(e,t)}${ua(e.id,r)}</header>
    ${e.context?ge(qe(e.context,a),3):""}
    ${tt(at(e.images,a))}
    <div class="fe-dp-opts${n?" gallery":""}"${n?` style="--cols:${Xr(n)}"`:""} role="radiogroup" aria-label="${p(e.question)}" data-media-set>
      ${e.options.map((o,l)=>ma(e,o,l+1,a)).join("")}
      ${i?ma(e,i,e.options.length+1,a,!0):""}
    </div>
    ${va(e.id,r)}
  </article>`}function en(e,t,a){let r=Object.entries(e.slots??{});return`<article class="card fe-dp-card" data-id="${p(e.id)}" data-kind="section" tabindex="-1">
    <header class="fe-dp-card-head">
      <span class="badge fe-dp-id" data-tone="quiet">${p(e.id)}</span>
      <h3 class="fe-dp-q">${p(e.title||e.id)}</h3>
      ${e.prio?`<span class="badge fe-dp-prio" data-prio="${p(e.prio.toLowerCase())}">${p(e.prio)}</span>`:""}
      ${ua(e.id,a)}
      <label class="fe-dp-agree"><span class="fe-dp-agree-lbl">Agree</span>${ea({title:"Agree with this as drafted (a)",label:`Agree with ${e.id}`,checked:!0,small:!0,cls:"fe-dp-agree-sw"})}</label>
    </header>
    ${e.read?ge(qe(e.read,t),4):""}
    ${e.pre?Yr(e.pre,t):""}
    ${r.length?`<dl class="fe-dp-slots">${r.map(([n,i])=>`<div class="fe-dp-slot" data-slot="${p(n.toLowerCase())}"><dt>${p(n)}</dt><dd>${p(i)}</dd></div>`).join("")}</dl>`:""}
    ${tt(at(e.images,t))}
    ${va(e.id,a)}
  </article>`}function ha(e,t,a,r,n){let i=r.groups?.[t];return`<details class="fe-grp fe-dp-grp" data-grp="${p(e)}" open${i?.color?` style="--grp:${p(i.color)}"`:""}>
    <summary class="sect" data-level="group">${$e}${p(t)}<span class="fe-grp-n">${a.length}</span></summary>
    ${i?.context?`<div class="fe-dp-grp-ctx">${ge(qe(i.context,n),2)}</div>`:""}
    <div class="fe-grp-body">${a.join("")}</div>
  </details>`}var rt=e=>e.group||"To review";function ba(e,t){let a=e.notes!==!1,r=[],n=e.decisions??[];n.length&&r.push(ha("Decisions","Decisions",n.map(o=>Qr(o,e,t,a)),e,t));let i=new Map;for(let o of e.sections??[]){let l=rt(o);i.has(l)||i.set(l,[]),i.get(l).push(en(o,t,a))}for(let[o,l]of i)r.push(ha("s:"+o,o,l,e,t));return a&&r.push(`<section class="card fe-dp-end" id="fe-dp-end">
    <h3 class="fe-dp-q">Notes for Claude</h3>
    <textarea class="tb" id="fe-dp-endnotes" rows="3" placeholder="Anything else Claude should know" aria-label="Notes for Claude"></textarea>
  </section>`),r.join("")}function ke(e,t=Date.now()/1e3){let a=Math.max(0,t-e);return a<60?"just now":a<3600?`${Math.floor(a/60)} min`:a<86400?`${Math.floor(a/3600)} h`:a<86400*14?`${Math.floor(a/86400)} d`:`${Math.floor(a/(86400*7))} w`}function xa(e,t,a=t){if(!e.some(n=>n.n))return"";let r=e.filter(n=>n.n).map(n=>`<i data-state="${p(n.state)}" title="${n.n} ${p(n.label)}"></i>`.repeat(n.n)).join("");return`<span class="fe-dv-meter" title="${p(a)}"><span class="fe-dv-bar">${r}</span><span class="fe-dv-meter-n">${p(t)}</span></span>`}var tn=4;function wa(e,t){let a,r=e.map(n=>{let i=n.group&&n.group!==a?`<li class="fe-dv-outline-grp">${p(n.group)}</li>`:"";a=n.group;let o=n.id.length<=tn;return`${i}<li><button type="button" class="row fe-dv-outline-row" data-target="${p(n.id)}" data-state="${p(n.state??"")}" title="${p(o?n.label:`${n.id}: ${n.label}`)}">
      <i></i>${o?`<span class="fe-dv-outline-id">${p(n.id)}</span>`:""}<span class="fe-dv-outline-lbl">${p(n.label)}</span><span class="fe-dv-outline-val">${p(n.value??"")}</span>
    </button></li>`}).join("");return`<nav class="fe-dv-outline" aria-label="${p(t)}"><div class="fe-dv-outline-h">${p(t)}</div><ol>${r}</ol></nav>`}function ya(e,t,a){let r=e.querySelector(`.fe-dv-outline-row[data-target="${CSS.escape(t)}"]`);r&&(a.state!==void 0&&(r.dataset.state=a.state),a.value!==void 0&&(r.querySelector(".fe-dv-outline-val").textContent=a.value))}function ka(e,t,a,r,n=()=>null){e.addEventListener("click",c=>{let h=c.target.closest(".fe-dv-outline-row");h&&r(h.dataset.target)});let i=new Map,o=c=>{let h=c.getBoundingClientRect(),d=t.getBoundingClientRect();return h.bottom>d.top&&h.top<d.bottom},l=()=>{let c=n(),h=c&&o(c)?c:a.find(x=>i.get(x));if(!h)return;e.querySelectorAll(".fe-dv-outline-row.active").forEach(x=>{x.classList.remove("active"),x.removeAttribute("aria-current")});let d=e.querySelector(`.fe-dv-outline-row[data-target="${CSS.escape(h.dataset.id??"")}"]`);if(!d)return;d.classList.add("active"),d.setAttribute("aria-current","location");let s=d.closest("ol");(d.offsetTop<s.scrollTop||d.offsetTop+d.offsetHeight>s.scrollTop+s.clientHeight)&&(s.scrollTop=d.offsetTop-s.clientHeight/2)},g=new IntersectionObserver(c=>{c.forEach(h=>i.set(h.target,h.isIntersecting)),l()},{root:t,rootMargin:"0px 0px -55% 0px"});return a.forEach(c=>g.observe(c)),l}var an={requested:"the agent was woken",queued:"the message waits for the agent",undelivered:"the agent was not told","no-origin":"the page names no agent to tell"},rn="Answered, but the agent was not told. It will see it next time it reads its pages.",nn="Not sent. Nothing was written; the picks line is on your clipboard instead.",on="Not sent. Nothing was written; the answer is on your clipboard to paste to the agent.",sn=new Set(["unavailable","dp_unavailable"]),ln=e=>e?.code??"",Ma=()=>`<span class="fe-dp-bar-end">
  <button type="button" class="btn" data-variant="ghost" data-size="sm" id="fe-dp-panel" aria-pressed="false" aria-controls="fe-dp-answer" title="Show the answer as it will be sent (p)">Answer</button>
  <button type="button" class="btn" data-variant="outline" data-size="sm" id="fe-dp-copy" title="Copy the answer (c)">Copy</button>
  <button type="button" class="btn" data-variant="solid" data-size="sm" id="fe-dp-submit" title="Send the answer to the agent that asked (s or \u2318\u21A9)">Submit</button></span>`,$a=()=>`
  <section class="card fe-dp-answer" id="fe-dp-answer" hidden aria-label="The answer as it will be sent">
    <p class="notice" id="fe-dp-answer-note" hidden></p>
    <pre class="fe-dp-answer-text" id="fe-dp-answer-text"></pre>
  </section>`,Ea=()=>'<section class="card fe-dp-sent" id="fe-dp-sent" hidden></section>';function Ta(e,t,a,r,n,i){let o=S=>t.querySelector(S),l=o("#fe-dp-answer"),g=o("#fe-dp-answer-text"),c=o("#fe-dp-answer-note"),h=o("#fe-dp-panel"),d=o("#fe-dp-copy"),s=o("#fe-dp-submit"),x=o("#fe-dp-sent"),v=a?"gcc":"outside",y="",T=null,w=0,k=!1,M=Promise.resolve(),C=(S,$,B="")=>{c.hidden=!S,c.textContent=S,c.title=B,$?c.dataset.tone=$:delete c.dataset.tone},L=()=>{let S=De(e,n.state());d.textContent=S.flagged?`Copy (${S.flagged})`:"Copy",s.textContent=T?"Replace answer":"Submit",s.disabled=v!=="gcc"||k,s.title=v==="outside"?"This page is not in gcc's registry, so it cannot be sent; Copy gives the picks line":v==="down"?"gcc cannot be reached, so nothing can be sent; Copy gives the picks line":T?"Send a new answer in place of the one already sent (s or \u2318\u21A9)":"Send the answer to the agent that asked (s or \u2318\u21A9)"},O=()=>{let S=++w,$=n.state(),B=()=>{y=Zt(e,$),g.textContent=y,L()};return a?X().dp("compose",a,Yt(e,$)).then(f=>{S===w&&(v="gcc",y=f.answer,g.textContent=y,C(""),L())}).catch(f=>{S===w&&(v="down",B(),C("Answer path down: gcc could not compose the answer, so nothing can be sent. Copy the picks line and paste it to the agent.","danger",te(f)))}):(B(),C("This page is not in gcc's registry, so it cannot be sent. Copy gives the picks line to paste to the agent."),Promise.resolve())},H=null,R=()=>{L(),H&&clearTimeout(H),H=setTimeout(()=>{M=O()},150)},q=async()=>{H&&(clearTimeout(H),H=null,M=O()),await M},A=S=>{l.hidden=!S,h.setAttribute("aria-pressed",String(S))},K=async()=>{if(await q(),!await oe(y)){A(!0),i("Copy was refused; the answer is in the panel to select by hand");return}i(v==="gcc"?"Copied the answer":"Copied the picks line; gcc did not compose it")},D=(S,$)=>{if(!T){x.hidden=!0;return}let B=S?.state?an[S.state]??S.state:"whether the agent was told is not recorded",f=$?Qt(e,$):null;x.hidden=!1,x.dataset.told=S?.state??"unknown",x.innerHTML=`<p class="fe-dp-sent-head"><strong>Answered ${p(ke(T.submitted_at)==="just now"?"just now":`${ke(T.submitted_at)} ago`)}</strong>
        <span class="fe-dp-sent-told" title="${p(T.via?`Sent from the ${T.via}`:"Sent")}">${p(B)}</span></p>
      ${f?`<div class="fe-dp-sent-picks">${f.picks.map(u=>`<span class="chip" data-size="sm" ${u.moved?'data-tone="due" data-fill':'data-tone="quiet"'} title="${p(`${u.id}${u.code} \xB7 ${u.moved?"moved off the recommendation":"as recommended"}`)}"><span>${p(u.id)} \xB7 ${p(u.label)}</span></span>`).join("")}</div>
        ${f.lines.length?`<ul class="fe-dp-sent-lines">${f.lines.map(u=>`<li>${p(u)}</li>`).join("")}</ul>`:""}`:""}
      <details class="fe-dp-sent-full"><summary>Full answer as sent</summary><pre>${p(T.answer)}</pre></details>`,L()},F=async(S=!1)=>{let $=async u=>{if(!await X().exists(r+u))return null;try{return JSON.parse(await X().text(r+u))}catch{return null}};if(T=await $(".answer.json"),!T||typeof T.answer!="string"){T=null,D(null,null);return}let B=await $(".notify.json"),f=null;if(a)try{f=Xt(e,await X().dp("parse",a,{answer:T.answer}))}catch{f=null}f&&(S||n.editedAt()<T.submitted_at*1e3)&&n.replace(f),D(B,f),R()},P=async()=>{if(k)return;if(await q(),v!=="gcc"||!a){let $=await oe(y);A(!0),i($?nn:"Not sent. Nothing was written; copy the picks line from the panel.");return}let S=!!T;if(!(S&&!confirm("Replace the answer you already sent? The agent is told again."))){k=!0,L();try{let B=(await X().dp("submit",a,{answer:y,replace:S}))?.notify?.state;i(B==="requested"?"Sent. The agent was woken.":B==="queued"?"Sent. The agent is idle; the message waits for it.":rn),await F(!0)}catch($){let B=ln($);if(B==="dp_conflict")i("Answered somewhere else already. Use Replace answer to send yours instead."),await F();else if(sn.has(B)){let f=await oe(y);A(!0),C("Not sent: gcc's page server is not answering, so nothing was written. Paste this answer to the agent, or Submit again once the server is back.","danger",te($)),i(f?on:"Not sent. Nothing was written; copy the answer from the panel.")}else i(`Not sent: ${te($)}`)}finally{k=!1,L()}}};return h.addEventListener("click",()=>A(l.hidden)),d.addEventListener("click",()=>void K()),s.addEventListener("click",()=>void P()),L(),M=O(),F(),{changed:R,togglePanel:()=>A(l.hidden),copy:K,submit:P}}function dn(e){let t;try{t=JSON.parse(e)}catch{return null}if(!t||typeof t!="object")return null;let a=t;return Array.isArray(a.decisions)||Array.isArray(a.sections)?a:null}function pn(e,t=Date.now()){if(!e)return[];let r=[["Project",e.project,""],["Session",e.session,""],["Goal",e.goal,"goal "],["Milestone",e.milestone,""],["Card",e.card,"card "]].filter(n=>!!n[1]).map(([n,i,o])=>({label:n,value:o+i,copy:i}));if(e.created){let n=Date.parse(e.created);if(Number.isNaN(n))r.push({label:"Asked",value:`asked ${e.created}`,copy:e.created});else{let i=ke(n/1e3,t/1e3);r.push({label:"Asked",value:i==="just now"?"asked just now":`asked ${i} ago`,copy:e.created,title:new Date(n).toLocaleString()})}}return r}function cn(e,t){let a=e.decisions?.length??0,r=e.sections?.length??0,n=[a?`${a} decision${a===1?"":"s"}`:"",r?`${r} to review`:""].filter(Boolean).join(", "),i=e.intro||e.origin?.topic;return`<header class="fe-dp-head">
      <div class="fe-dp-titlebar">
        <h1 class="fe-dp-title"${e.origin?.topic&&e.intro?` title="${p(e.origin.topic)}"`:""}>${p(e.title||"Decisions")}</h1>
        <button type="button" id="fe-dp-files" class="btn" data-variant="outline" data-size="sm" data-tone="accent" data-docview-files title="Show the files in this folder">${m.list}Files</button>
      </div>
      <p class="fe-dp-origin">${pn(e.origin).map(o=>`<button type="button" class="fe-dp-fact" data-fact="${p(o.label.toLowerCase())}" data-copy="${p(o.copy)}" title="${p(`${o.title??o.label}. Click to copy ${o.copy}`)}">${p(o.value)}</button>`).join("")}<span class="fe-dp-count">${p(n)}</span></p>
      ${i?`<div class="fe-dp-intro">${ge(ae(i,t),2)}</div>`:""}
    </header>
    ${Ea()}
    <div class="fe-dp-bar" id="fe-dp-bar">
      <span id="fe-dp-meter"></span>
      <span class="fe-dp-progress" id="fe-dp-progress" aria-live="polite"></span>
      ${e.notes!==!1?'<button type="button" class="btn" data-variant="ghost" data-size="sm" id="fe-dp-notes" aria-pressed="false" title="Show a note field on every card (m)">Notes</button>':""}
      <button type="button" class="btn" data-variant="ghost" data-size="sm" id="fe-dp-marks" aria-pressed="true" title="Show or hide the marks on every picture" hidden>Marks</button>
      <button type="button" class="btn" data-variant="ghost" data-size="sm" id="fe-dp-flagged" aria-pressed="false" title="Show only the cards you changed or noted (f)">Flagged only</button>
      <button type="button" class="btn" data-variant="ghost" data-size="sm" id="fe-dp-reset" title="Put every answer back as drafted">Reset</button>
      <span class="fe-dp-bar-gap"></span>${Ma()}
    </div>
    ${$a()}`}function fn(e){return[...(e.decisions??[]).map(t=>({id:t.id,label:t.question,group:"Decisions"})),...(e.sections??[]).map(t=>({id:t.id,label:t.title||t.id,group:rt(t)}))]}var nt={id:"decision-page",on:"folder",claims:(e,t)=>t.includes("config.json"),async mount({root:e,base:t,path:a,toast:r,slug:n}){let i=null;try{i=dn(await X().text(t+"config.json"))}catch{i=null}if(!i)return!1;let o=n??a.match(/\/decision-pages\/([^/]+)\/$/)?.[1];o&&X().dp("seen",o).catch(()=>{}),e.innerHTML=`<div class="fe-dp-layout">
        <div class="fe-dp-col">${cn(i,t)}<div id="fe-dp-body">${ba(i,t)}</div></div>
        <aside class="fe-dp-side">${wa(fn(i),"On this page")}</aside>
      </div>`,i.accent&&e.style.setProperty("--ac",i.accent),gn(i,e,o,t,r),fa(e,r),ga(e),e.querySelector(".fe-dp-origin")?.addEventListener("click",g=>{let c=g.target.closest(".fe-dp-fact");c&&oe(c.dataset.copy).then(h=>r(h?`Copied ${c.dataset.copy}`:"Copy failed"))});let l=e.querySelector("#fe-dp-marks");if(e.querySelector(".fe-dv-media[data-marks]")){let g=Le("bfb-dp-marks-off",!1),c=h=>{da(e,h),l.setAttribute("aria-pressed",String(h)),g.set(!h)};l.hidden=!1,l.addEventListener("click",()=>c(e.classList.contains("marks-off"))),c(!g.get())}return!0}};function gn(e,t,a,r,n){let i=Jt(e),o=ze(i,null,f=>f===null||typeof f=="object"),l=ze(i.replace("bfb-dp-answers:","bfb-dp-edited:"),0,f=>typeof f=="number"),g=ze(i.replace("bfb-dp-answers:","bfb-dp-folded:"),[],Array.isArray),c=Le("bfb-dp-notes-on",!1),h=e.notes!==!1,d=Je(e,o.get()),s=t.querySelector(".fe-dv-outline"),x=()=>[...t.querySelectorAll(".fe-dp-card")],v=f=>x().find(u=>u.dataset.id===f),y=(f,u)=>{let E=f.querySelector(".fe-dp-note"),N=f.querySelector(".fe-dp-addnote");!E||!N||(E.hidden=!u,N.setAttribute("aria-pressed",String(u)))},T=f=>{let u=f.dataset.id,E=Oe(e,d,u);E?f.dataset.flag=E:delete f.dataset.flag;let N=f.querySelector("textarea[data-note]");N&&f.classList.toggle("has-note",!!N.value.trim());let W=f.dataset.kind==="decision"?d.picks[u]??"":d.agree[u]===!1?"no":"";ya(s,u,{state:E??"drafted",value:W})},w=()=>{let f=De(e,d),u=x().map(N=>N.dataset.id),E=N=>u.filter(W=>Oe(e,d,W)===N).length;t.querySelector("#fe-dp-meter").innerHTML=xa([{state:"changed",n:E("changed"),label:"changed"},{state:"noted",n:E("noted"),label:"noted"},{state:"drafted",n:E(null),label:"as drafted"}],"",`${f.items} items`),t.querySelector("#fe-dp-progress").textContent=f.asDrafted?`${f.items} items \xB7 all as drafted`:`${f.items} items \xB7 ${f.flagged} flagged`},k=()=>{for(let u of x()){let E=u.dataset.id;if(u.dataset.kind==="decision")for(let ie of u.querySelectorAll('input[type="radio"]'))ie.checked=ie.value===d.picks[E];let N=u.querySelector(".fe-dp-agree-sw");N&&(N.checked=d.agree[E]!==!1,u.classList.toggle("disagree",!N.checked));let W=u.querySelector("textarea[data-note]");W&&(W.value=d.notes[E]??"",y(u,c.get()||!!W.value.trim())),T(u)}let f=t.querySelector("#fe-dp-endnotes");f&&(f.value=d.endNotes),t.querySelector("#fe-dp-notes")?.setAttribute("aria-pressed",String(c.get())),w(),C?.changed()},M=()=>{o.set(d),l.set(Date.now()),w(),C?.changed()},C=null,L=new Set(g.get());for(let f of t.querySelectorAll(".fe-dp-grp"))L.has(f.dataset.grp)&&(f.open=!1),f.addEventListener("toggle",()=>{f.open?L.delete(f.dataset.grp):L.add(f.dataset.grp),g.set([...L])});t.addEventListener("change",f=>{let u=f.target,E=u.closest(".fe-dp-card");if(E){if(u.type==="radio")d.picks[E.dataset.id]=u.value;else if(u.classList.contains("fe-dp-agree-sw"))d.agree[E.dataset.id]=u.checked,E.classList.toggle("disagree",!u.checked);else return;q(E,!1),T(E),M()}}),t.addEventListener("input",f=>{let u=f.target;if(u.id==="fe-dp-endnotes"){d.endNotes=u.value,M();return}let E=u.closest(".fe-dp-card");!E||!u.dataset.note||(d.notes[u.dataset.note]=u.value,T(E),M())}),t.addEventListener("click",f=>{let u=f.target,E=u.closest(".fe-dp-addnote"),N=u.closest(".fe-dp-card");if(E&&N){K(N);return}let W=u.closest(".fe-dp-rawbtn");if(W){let ie=W.closest(".fe-dp-preview");ie.dataset.view=ie.dataset.view==="raw"?"md":"raw",W.setAttribute("aria-pressed",String(ie.dataset.view==="raw"))}N&&!u.closest("input, textarea, a, button, label")?q(N,!1):N&&R(N)});let O=null,H=()=>{},R=f=>{O!==f&&(O?.classList.remove("current"),O=f,f.classList.add("current"),H())},q=(f,u=!0)=>{R(f),f.focus({preventScroll:!0}),u&&f.scrollIntoView({block:"center",behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"})},A=f=>{h&&(y(f,!0),R(f),f.querySelector("textarea[data-note]")?.focus())},K=f=>{let u=f.querySelector(".fe-dp-note");u&&!u.hidden&&!c.get()&&!f.querySelector("textarea[data-note]")?.value.trim()?y(f,!1):A(f)};H=ka(s,t,x(),f=>{let u=v(f);if(!u)return;let E=u.closest("details");E&&!E.open&&(E.open=!0),q(u)},()=>O);let D=()=>x().filter(f=>f.offsetParent!==null),F=f=>{let u=D();if(!u.length)return;let E=O?u.indexOf(O):-1;q(u[Math.max(0,Math.min(u.length-1,E<0?f>0?0:u.length-1:E+f))])},P=f=>{t.classList.toggle("flagged-only",f),t.querySelector("#fe-dp-flagged").setAttribute("aria-pressed",String(f))},S=f=>{if(h){c.set(f);for(let u of x())y(u,f||!!u.querySelector("textarea[data-note]")?.value.trim());t.querySelector("#fe-dp-notes")?.setAttribute("aria-pressed",String(f))}};t.querySelector("#fe-dp-notes")?.addEventListener("click",()=>S(!c.get())),t.querySelector("#fe-dp-flagged").addEventListener("click",()=>P(!t.classList.contains("flagged-only"))),t.querySelector("#fe-dp-reset").addEventListener("click",()=>{confirm("Put every answer back as drafted? Your picks and notes on this page are cleared.")&&(d=ye(e),o.set(null),l.set(Date.now()),k())}),C=Ta(e,t,a,r,{state:()=>d,replace:f=>{d=f,o.set(d),k()},editedAt:()=>l.get()},n);let $=()=>!t.hidden;_("dp-next",()=>F(1),$),_("dp-prev",()=>F(-1),$),_("dp-first",()=>{let f=D();f[0]&&q(f[0])},$),_("dp-last",()=>{let f=D();f.length&&q(f[f.length-1])},$),_("dp-pick",f=>{let u=Number(f?.slice(-1)),E=O?.dataset.kind==="decision"?O.querySelectorAll('input[type="radio"]')[u-1]:void 0;E&&!E.checked&&(E.checked=!0,E.dispatchEvent(new Event("change",{bubbles:!0})))},()=>$()&&O?.dataset.kind==="decision"),_("dp-agree",()=>{let f=O?.querySelector(".fe-dp-agree-sw");f&&(f.checked=!f.checked,f.dispatchEvent(new Event("change",{bubbles:!0})))},()=>$()&&O?.dataset.kind==="section"),_("dp-note",()=>O&&A(O),()=>$()&&h&&!!O),_("dp-notes-all",()=>S(!c.get()),()=>$()&&h),_("dp-end-notes",()=>{let f=t.querySelector("#fe-dp-endnotes");f?.scrollIntoView({block:"center"}),f?.focus()},()=>$()&&h),_("dp-flagged",()=>P(!t.classList.contains("flagged-only")),$),_("dp-theme",()=>Q("theme"),$),_("dp-panel",()=>C?.togglePanel(),$),_("dp-copy",()=>void C?.copy(),$),_("dp-submit",()=>void C?.submit(),$);let B=()=>!!document.activeElement?.closest("#fe-dp textarea");_("dp-esc",()=>{if(la(t))return;let f=document.activeElement?.closest(".fe-dp-card");document.activeElement?.blur(),f&&q(f,!1)},()=>$()&&(B()||!!t.querySelector(".zoomed"))),k()}function Sa(e){let t;return(a,r=2400,n)=>{if(e.textContent=a,n){let i=document.createElement("button");i.className="fe-toast-act",i.textContent=n.label,i.title=n.label,i.addEventListener("click",()=>{n.run(),e.classList.remove("show")}),e.append(" \xB7 ",i),r=Math.max(r,6e3)}e.classList.toggle("act",!!n),Ce(e),e.classList.add("show"),clearTimeout(t),t=setTimeout(()=>e.classList.remove("show"),r)}}var La=Be(zt,["dark","light","system"],"dark");function it(){return La.get()}var mn=()=>matchMedia("(prefers-color-scheme: dark)").matches;function Ne(e){return e==="system"?mn()?"dark":"light":e}function ot(e,t,a=!0){e.dataset.mode=t,e.dataset.theme=Ne(t),a&&La.set(t)}function za(e){matchMedia("(prefers-color-scheme: dark)").addEventListener("change",()=>{e.dataset.mode==="system"&&(e.dataset.theme=Ne("system"))})}var Do=le("bfb-app-icon","classic");var st="-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif",I=(e,t,a,r=st)=>({id:e,name:t,stack:`${a},${r}`}),qo=[{id:"system",name:"System",stack:st},I("inter","Inter","Inter"),I("manrope","Manrope","Manrope"),I("open-sans","Open Sans","'Open Sans'"),I("avenir","Avenir Next","'Avenir Next',Avenir"),I("helvetica","Helvetica Neue","'Helvetica Neue',Helvetica"),I("rounded","SF Rounded","'SF Pro Rounded'"),I("seravek","Seravek","Seravek"),I("charter","Charter","Charter","Georgia,serif"),I("iowan","Iowan Old Style","'Iowan Old Style'","Georgia,serif")],No=[{id:"system",name:"System",stack:st},I("inter","Inter","Inter"),I("montserrat","Montserrat","Montserrat"),I("avenir","Avenir Next","'Avenir Next',Avenir"),I("futura","Futura","Futura"),I("rounded","SF Rounded","'SF Pro Rounded'"),I("gill","Gill Sans","'Gill Sans'"),I("editorial","Editorial","'PP Editorial Old'","Georgia,serif"),I("charter","Charter","Charter","Georgia,serif"),I("baskerville","Baskerville","Baskerville","Georgia,serif")],Me="Menlo,Consolas,monospace",jo=[{id:"system",name:"System mono",stack:`'SF Mono',${Me}`},I("jetbrains","JetBrains Mono","'JetBrains Mono'",Me),I("fira","Fira Code","'Fira Code'",Me),I("source","Source Code Pro","'Source Code Pro'",Me),I("google","Google Sans Code","'Google Sans Code'",Me)],Io={text:le("bfb-font-text","system"),head:le("bfb-font-head","system"),code:le("bfb-font-code","system")};function Ca(e,t){e.dataset.docview=t}var hn=me('<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"/>'),un=()=>be.filter(e=>e.group==="Decision page"||e.id==="keys"),vn=`html,body{margin:0;height:100%;background:var(--bg)}
#fe.fe-dp-web{position:fixed;inset:0;display:flex}
.fe-dp-web #fe-main{flex:1;min-width:0}
.fe-dp-web [data-docview-files],.fe-dp-web [data-img="open"],.fe-dp-web [data-img="copy"]{display:none}
.fe-dp-web .fe-dp-titlebar .fe-dp-title{flex:1}
.fe-dp-web-keys{min-width:300px;padding:var(--sp-4) var(--sp-5);font-size:var(--fs-sm)}
.fe-dp-web-keys-h{margin:0 0 var(--sp-3);font-weight:600;color:var(--tx)}
.fe-dp-web-key{display:flex;justify-content:space-between;gap:var(--sp-6);padding:var(--sp-1) 0;color:var(--mt)}
.fe-dp-web-key kbd{font-family:var(--mono);font-size:var(--fs-xs);padding:0 var(--sp-2);border:1px solid var(--bd);border-radius:var(--r-xs);color:var(--tx)}
.fe-dp-web-fail{max-width:640px;margin:15vh auto;padding:0 var(--sp-6);color:var(--mt)}`,bn=e=>/^\/dp\/([a-z0-9][a-z0-9._-]{0,80})\/?$/.exec(e)?.[1]??null,xn=e=>e===409?"dp_conflict":"dp_failed";async function je(e,t){let a;try{a=await fetch(e,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(t)})}catch{throw new J("dp_unavailable","gcc's page server is not answering; nothing was written")}let r=await a.json().catch(()=>({}));if(!a.ok)throw new J(xn(a.status),typeof r.error=="string"?r.error:`the server answered ${a.status}`);return r}async function wn(e){for(let t=0;t<60;t++){try{let a=await fetch(".notify.json",{cache:"no-store"});if(a.ok){let r=await a.json();if(r.at&&Date.parse(r.at)>=e)return r}}catch{}await new Promise(a=>setTimeout(a,200))}return null}async function yn(e,t,a){let r=encodeURIComponent(t),n=a??{};if(e==="compose")return{answer:(await je(`/api/dp-compose/${r}`,{state:a??null})).answer};if(e==="parse")return(await je(`/api/dp-parse/${r}`,{answer:n.answer??""})).state;if(e==="seen")return je(`/api/dp-seen/${r}`,{});let i=Date.now()-1e3;return{...await je(`/api/dp-submit/${r}`,{answer:n.answer??"",replace:n.replace===!0,via:"page"}),notify:await wn(i)}}async function Ha(){document.head.insertAdjacentHTML("beforeend",'<meta name="viewport" content="width=device-width,initial-scale=1">');let e=document.createElement("style");e.textContent=lt+dt+vn,document.head.appendChild(e),document.body.innerHTML='<div id="fe" class="fe-dp-page fe-dp-web"><main id="fe-main"><div id="fe-dp"></div></main><div id="fe-toast"></div></div>';let t=document.getElementById("fe"),a=document.getElementById("fe-dp");ot(t,it(),!1),za(t);let r=Sa(document.getElementById("fe-toast")),n=v=>{a.innerHTML=`<p class="fe-dp-web-fail">${p(v)}</p>`},i=bn(location.pathname);if(!i){n("This address is not a decision page. Pages live at /dp/<name>/.");return}qt({text:v=>fetch(v,{cache:"no-store"}).then(y=>{if(!y.ok)throw new Error(`${y.status}`);return y.text()}),exists:v=>fetch(v,{cache:"no-store"}).then(y=>y.ok,()=>!1),dp:yn}),Wt(()=>{let v=document.activeElement;return{scopes:new Set(["any","decision"]),typing:!!v&&(v.tagName==="TEXTAREA"||v.tagName==="INPUT"&&v.type==="text"||v.isContentEditable),blocked:!1}}),Ut(),_("theme",()=>ot(t,Ne(it())==="dark"?"light":"dark"));let o=new URL(".",location.href).href;if(!await Promise.resolve(nt.mount({root:a,base:o,path:location.pathname,toast:v=>r(v),slug:i})).catch(()=>!1)){n("This page could not be drawn: its config.json is missing or is not a decision page.");return}Ca(a,nt.id),document.title=a.querySelector(".fe-dp-title")?.textContent||"Decision page";let g=document.createElement("button");g.type="button",g.id="fe-dp-web-theme",g.className="btn",Object.assign(g.dataset,{variant:"ghost",size:"sm",icon:""});let c=()=>{let v=t.dataset.theme==="dark";g.innerHTML=v?m.appearance:hn,g.title=g.ariaLabel=`Switch to ${v?"light":"dark"} (t)`};g.addEventListener("click",()=>{Q("theme"),c()}),new MutationObserver(c).observe(t,{attributes:!0,attributeFilter:["data-theme"]}),c();let h=document.createElement("a");h.id="fe-dp-web-all",h.className="btn",h.href="/dp/",Object.assign(h.dataset,{variant:"ghost",size:"sm"}),h.title="Every decision page, waiting ones first",h.innerHTML=`${m.opinion}All decisions`;let d=document.createElement("button");d.type="button",d.id="fe-dp-web-help",d.className="btn",Object.assign(d.dataset,{variant:"ghost",size:"sm",icon:""}),d.textContent="?",d.title=d.ariaLabel="Keys on this page (?)";let s=null,x=()=>{if(s?.open){s.close();return}let v=document.createElement("div");v.className="fe-ctx fe-dp-web-keys",v.innerHTML=`<p class="fe-dp-web-keys-h">Keys on this page</p>${un().map(y=>`<div class="fe-dp-web-key"><span>${y.keys.map(T=>`<kbd>${p(T)}</kbd>`).join(" ")}</span><span>${p(y.title)}</span></div>`).join("")}`,document.body.appendChild(v),s=ce(v,{kind:"popover",anchor:d,place:"below",align:"end",label:"Keys on this page",onClose:()=>v.remove()})};d.addEventListener("click",x),_("keys",x),a.querySelector(".fe-dp-titlebar")?.append(h,d,g)}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>void Ha()):Ha();})();
