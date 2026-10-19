// The file-explorer UI stylesheet, injected at runtime. Static — no interpolation.
export const CSS = `
*{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#0d1117;--s1:#161b22;--s2:#1c2230;--s3:#21262d;
  --bd:#30363d;--tx:#e6edf3;--mt:#8b949e;--dm:#484f58;
  --ac:#58a6ff;--dir:#79c0ff;--gold:#d29922;--green:#3fb950;
  --hover:#21262d;--act:#1a3a5c;--r:6px;
  --nc-red:#ff6b6b;--nc-orange:#ffa94d;--nc-yellow:#ffd43b;--nc-green:#51cf66;--nc-teal:#38d9a9;--nc-blue:#4dabf7;--nc-purple:#b197fc;--nc-pink:#f783ac;
}
#fe[data-theme="light"]{
  --bg:#ffffff;--s1:#f6f8fa;--s2:#eaeef2;--s3:#e2e8f0;
  --bd:#d0d7de;--tx:#1f2328;--mt:#656d76;--dm:#8c959f;
  --hover:#f3f4f6;--act:#dbeafe;--ac:#0969da;--dir:#0550ae;
  --nc-red:#d92d2d;--nc-orange:#d9730d;--nc-yellow:#b58900;--nc-green:#2b8a3e;--nc-teal:#0c8f78;--nc-blue:#1971c2;--nc-purple:#7048e8;--nc-pink:#c2255c;
}
html:has(#fe[data-theme="light"]){
  --bg:#ffffff;--s1:#f6f8fa;--s2:#eaeef2;--s3:#e2e8f0;
  --bd:#d0d7de;--tx:#1f2328;--mt:#656d76;--dm:#8c959f;
  --hover:#f3f4f6;--act:#dbeafe;--ac:#0969da;--dir:#0550ae;
  --nc-red:#d92d2d;--nc-orange:#d9730d;--nc-yellow:#b58900;--nc-green:#2b8a3e;--nc-teal:#0c8f78;--nc-blue:#1971c2;--nc-purple:#7048e8;--nc-pink:#c2255c;
}
html,body{height:100%;background:var(--bg);color:var(--tx);
  font:calc(13px * var(--ui-text-scale,1))/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;overflow:hidden}
body{opacity:1!important}
#fe{display:flex;flex-direction:column;height:100vh;background:var(--bg);color:var(--tx)}
#fe-bar{display:flex;align-items:center;gap:6px;padding:8px 14px;
  background:var(--s1);border-bottom:1px solid var(--bd);flex-shrink:0;min-height:42px}
#fe-bc{display:flex;align-items:center;gap:1px;flex:1;overflow:hidden;white-space:nowrap;min-width:0}
.fe-crumb{color:var(--mt);text-decoration:none;padding:2px 5px;border-radius:4px;
  font-size:calc(12px * var(--ui-text-scale,1));flex-shrink:0;transition:background .1s,color .1s}
.fe-crumb:last-of-type{color:var(--tx);font-weight:500}
.fe-crumb:hover{background:var(--hover);color:var(--tx)}
.fe-sep{color:var(--dm);font-size:calc(11px * var(--ui-text-scale,1));flex-shrink:0;padding:0 1px}
#fe-bar .fe-crumb-dd{background:none;border:none;color:var(--dm);cursor:pointer;
  padding:0 2px;font-size:calc(9px * var(--ui-text-scale,1));border-radius:3px;line-height:1;opacity:0.35;
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
  padding:4px 8px;border-radius:5px;font-size:calc(12px * var(--ui-text-scale,1));outline:none;box-sizing:border-box}
.fe-dd-search:focus{border-color:var(--ac)}
.fe-dd-items{max-height:288px;overflow-y:auto;padding:2px 0}
.fe-dd-item{display:flex;align-items:center;gap:8px;padding:6px 12px;
  color:var(--tx);text-decoration:none;font-size:calc(12px * var(--ui-text-scale,1));white-space:nowrap;
  overflow:hidden;text-overflow:ellipsis;transition:background .08s}
.fe-dd-item:hover{background:var(--hover)}
.fe-dd-item.dir{color:var(--dir)}
.fe-dd-item svg{flex-shrink:0}
.fe-dd-spinner,.fe-dd-empty{padding:10px 14px;font-size:calc(12px * var(--ui-text-scale,1));color:var(--dm);font-style:italic}
#fe-bar button{background:none;border:1px solid var(--bd);color:var(--mt);cursor:pointer;
  padding:4px 8px;border-radius:var(--r);line-height:1;display:flex;align-items:center;
  justify-content:center;gap:5px;transition:all .15s;flex-shrink:0}
#fe-bar button:hover{border-color:var(--ac);color:var(--ac)}
#fe-bm-btn.on{color:var(--gold);border-color:var(--gold)}
#fe-bm-btn.on:hover{color:var(--gold)}
#fe-term-btn:hover{border-color:var(--green);color:var(--green)}
#fe-theme-btn #fe-sun{display:none}
#fe-theme-btn #fe-moon{display:block}
#fe[data-theme="light"] #fe-theme-btn #fe-sun{display:block}
#fe[data-theme="light"] #fe-theme-btn #fe-moon{display:none}
#fe-body{display:flex;flex:1;overflow:hidden}
#fe-side{width:220px;flex-shrink:0;background:var(--s1);border-right:1px solid var(--bd);overflow-y:auto;padding:6px 0}
#fe-side-rz{width:5px;flex-shrink:0;cursor:col-resize;background:transparent;transition:background .12s}
#fe-side-rz:hover,#fe-side-rz.drag{background:var(--ac)}
.fe-sec{margin-bottom:4px}
.fe-sec.fe-collapsed>:not(.fe-sh){display:none!important}
.fe-sh{font-size:calc(11px * var(--ui-text-scale,1));font-weight:600;text-transform:uppercase;letter-spacing:.08em;
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
.fe-si svg{flex-shrink:0;opacity:.7;width:19px;height:19px}
.fe-sl{font-size:calc(13.5px * var(--ui-text-scale,1));white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;flex:1}
.fe-hint{font-size:calc(12px * var(--ui-text-scale,1));color:var(--dm);padding:6px 14px;font-style:italic;line-height:1.7}
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
  padding:4px 10px 4px 4px;font-size:calc(12px * var(--ui-text-scale,1));opacity:0;transition:opacity .1s,color .1s;flex-shrink:0}
.fe-bm-item:hover .fe-rm-btn{opacity:1}
.fe-rm-btn:hover{color:#f85149}
#fe-sv-add{background:none;border:1px solid var(--bd);color:var(--mt);cursor:pointer;border-radius:4px;
  width:18px;height:18px;line-height:1;font-size:calc(13px * var(--ui-text-scale,1));padding:0;display:flex;align-items:center;justify-content:center}
#fe-sv-add:hover{border-color:var(--ac);color:var(--ac)}
#fe-sv-filter,#fe-nt-filter{display:block;width:calc(100% - 20px);margin:0 10px 4px;box-sizing:border-box;background:var(--bg);border:1px solid var(--bd);color:var(--tx);
  padding:3px 8px;border-radius:var(--r);font-size:calc(11px * var(--ui-text-scale,1));outline:none;transition:border-color .15s}
#fe-sv-filter:focus,#fe-nt-filter:focus{border-color:var(--ac)}
#fe-sv-filter::placeholder,#fe-nt-filter::placeholder{color:var(--dm)}
.fe-pl-label.editing,.fe-pl-tags.editing{outline:1px solid var(--ac);border-radius:3px;background:var(--s2);padding:0 3px;cursor:text}
.fe-sv-tag{display:flex;align-items:center;gap:7px;padding:8px 14px 3px;font-size:calc(10.5px * var(--ui-text-scale,1));font-weight:600;
  text-transform:uppercase;letter-spacing:.07em;color:var(--dm)}
.fe-sv-dot{width:9px;height:9px;border-radius:50%;cursor:pointer;flex-shrink:0;box-shadow:0 0 0 1px #0004}
.fe-sv-dot:hover{transform:scale(1.25)}
.fe-pl-dots{display:flex;gap:3px;margin-left:auto;padding-right:2px}
.fe-sv-mini{width:6px;height:6px;border-radius:50%;display:inline-block}
.fe-pl-tags{display:none;font-size:calc(11px * var(--ui-text-scale,1));color:var(--mt);min-width:60px;max-width:110px;white-space:nowrap;overflow:hidden}
.fe-pl-tags.show{display:inline-block}
.fe-tag-btn{background:none;border:none;color:var(--dm);cursor:pointer;padding:4px 4px;font-size:calc(12px * var(--ui-text-scale,1));opacity:0;transition:opacity .1s,color .1s;flex-shrink:0}
.fe-bm-item:hover .fe-tag-btn{opacity:1}
.fe-tag-btn:hover{color:var(--ac)}
#fe-main{flex:1;display:flex;flex-direction:column;overflow:hidden}
#fe-toolbar{display:flex;align-items:center;gap:10px;padding:7px 14px;
  background:var(--s2);border-bottom:1px solid var(--bd);flex-shrink:0}
#fe-count{font-size:calc(11px * var(--ui-text-scale,1));color:var(--dm);flex:1;white-space:nowrap}
#fe-tb-right{display:flex;align-items:center;gap:6px}
#fe-toolbar button{background:none;border:1px solid var(--bd);color:var(--dm);cursor:pointer;
  padding:4px 8px;border-radius:var(--r);display:flex;align-items:center;gap:4px;
  font-size:calc(12px * var(--ui-text-scale,1));transition:all .15s}
#fe-toolbar button:hover{border-color:var(--ac);color:var(--ac)}
#fe-hidden-btn.on{border-color:var(--ac);color:var(--ac);background:var(--act)}
#fe-deep-btn.on{border-color:var(--ac);color:var(--ac);background:var(--act)}
#fe-sg-btn.on,#fe-filter-btn.on{border-color:var(--ac);color:var(--ac);background:var(--act)}
#fe-zoom-wrap{display:flex;align-items:center;gap:5px;color:var(--dm)}
#fe-zoom{width:80px;accent-color:var(--ac);cursor:pointer}
#fe-zoom-val{font-size:calc(10px * var(--ui-text-scale,1));color:var(--dm);width:34px;text-align:right}
#fe-view-group{display:flex;gap:2px}
.fe-view-btn{background:none;border:1px solid transparent;color:var(--dm);cursor:pointer;
  padding:4px 7px;border-radius:5px;display:flex;align-items:center;transition:all .12s}
.fe-view-btn:hover{background:var(--hover);color:var(--tx)}
.fe-view-btn.active{background:var(--s3);border-color:var(--bd);color:var(--tx)}
#fe-search{background:var(--bg);border:1px solid var(--bd);color:var(--tx);
  padding:4px 10px;border-radius:var(--r);font-size:calc(12px * var(--ui-text-scale,1));width:150px;outline:none;transition:border-color .15s}
#fe-search:focus{border-color:var(--ac)}
#fe-search::placeholder{color:var(--dm)}
#fe-sg-panel,#fe-filter-bar{
  padding:8px 14px;background:var(--s1);border-bottom:1px solid var(--bd);flex-shrink:0}
.fe-panel-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.fe-panel-lbl{font-size:calc(11px * var(--ui-text-scale,1));color:var(--dm);font-weight:500;white-space:nowrap}
.fe-btn-group{display:flex;gap:4px;flex-wrap:wrap}
.fe-pbn{background:none;border:1px solid var(--bd);color:var(--dm);cursor:pointer;
  padding:3px 9px;border-radius:5px;font-size:calc(11px * var(--ui-text-scale,1));transition:all .12s;white-space:nowrap}
.fe-pbn:hover{border-color:var(--ac);color:var(--ac)}
.fe-pbn.active{background:var(--act);border-color:var(--ac);color:var(--ac)}
#fe-filter-q{background:var(--bg);border:1px solid var(--bd);color:var(--tx);
  padding:3px 8px;border-radius:var(--r);font-size:calc(12px * var(--ui-text-scale,1));width:200px;outline:none;transition:border-color .15s}
#fe-filter-q:focus{border-color:var(--ac)}
#fe-type-filter{background:var(--s2);border:1px solid var(--bd);color:var(--tx);
  padding:3px 8px;border-radius:var(--r);font-size:calc(12px * var(--ui-text-scale,1));outline:none;cursor:pointer}
#fe-regex-btn.active{background:var(--act);border-color:var(--ac);color:var(--ac)}
#fe-find-text{background:var(--bg);border:1px solid var(--bd);color:var(--tx);padding:4px 8px;border-radius:5px;font-size:calc(12px * var(--ui-text-scale,1));width:260px;outline:none}
#fe-find-text:focus{border-color:var(--ac)}
#fe-find-status{font-size:calc(11px * var(--ui-text-scale,1));color:var(--mt);margin-left:4px}
.fe-view .fe-si-link svg{color:var(--ac);opacity:.9}
#fe-scroll{flex:1;overflow-y:auto;transform-origin:top left}
#fe-table{width:100%;border-collapse:collapse;table-layout:fixed}
thead{position:sticky;top:0;z-index:5;background:var(--s2)}
thead th{padding:6px 12px;text-align:left;font-size:calc(11px * var(--ui-text-scale,1));font-weight:600;
  text-transform:uppercase;letter-spacing:.07em;color:var(--dm);
  border-bottom:1px solid var(--bd);user-select:none;white-space:nowrap}
thead th{position:relative}
thead th[data-sort]{cursor:pointer}
thead th[data-sort]:hover{color:var(--tx)}
.fe-col-rz{position:absolute;top:0;right:0;width:7px;height:100%;cursor:col-resize;user-select:none}
.fe-col-rz:hover{background:linear-gradient(90deg,transparent,var(--ac))}
.si{opacity:.35;font-size:calc(10px * var(--ui-text-scale,1))}
th.sorted .si{opacity:1;color:var(--ac)}
.c-nm{width:46%}.c-tp{width:16%}.c-sz{width:13%;text-align:right}.c-dt{width:25%}
.c-match{display:none;text-align:right;width:72px;color:var(--dm)}
#fe.fe-has-find-hits[data-view="details"] .c-match{display:table-cell}
#fe.fe-has-find-hits[data-view="details"] .c-nm{width:42%}
#fe.fe-has-find-hits[data-view="details"] .c-dt{width:19%}
.fe-find-snippet{display:block;color:var(--dm);font-size:calc(11px * var(--ui-text-scale,1));margin:3px 0 1px 22px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fe-find-snippet mark{background:var(--ac);color:var(--bg);border-radius:2px;padding:0 1px}
.fe-find-badge{display:inline-block;color:var(--ac);border:1px solid var(--bd);border-radius:8px;padding:0 5px;font-size:calc(10px * var(--ui-text-scale,1));margin-left:22px}
#fe-find-error{color:#f85149;font-size:calc(11px * var(--ui-text-scale,1))}
#fe[data-view="details"] .fe-row .fe-find-badge{display:none}
tbody tr{border-bottom:1px solid var(--bg);transition:background .08s}
tbody tr:hover{background:var(--hover)}
tbody td{padding:5px 12px;vertical-align:middle}
td.c-sz{text-align:right;color:var(--dm);font-variant-numeric:tabular-nums;font-size:calc(12px * var(--ui-text-scale,1))}
td.c-dt{color:var(--dm);font-size:calc(12px * var(--ui-text-scale,1))}
td.c-tp{color:var(--dm);font-size:calc(11px * var(--ui-text-scale,1))}
.fe-lnk{display:flex;align-items:center;gap:8px;text-decoration:none;color:var(--tx)}
.fe-lnk svg{flex-shrink:0}
.fe-lnk:hover .fe-nm{color:var(--ac);text-decoration:underline}
.fe-nm{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dir .fe-nm{color:var(--dir)}
.par td.c-nm .fe-nm{color:var(--dm)}
.par:hover .fe-nm{color:var(--mt)}
.dotfile{opacity:.65}
.fe-group-hdr td{padding:5px 12px;font-size:calc(10.5px * var(--ui-text-scale,1));font-weight:600;
  text-transform:uppercase;letter-spacing:.08em;color:var(--dm);
  background:var(--s2);border-bottom:1px solid var(--bd);border-top:1px solid var(--bd)}
.fe-group-hdr-tile{width:100%;padding:6px 4px 2px;font-size:calc(10.5px * var(--ui-text-scale,1));font-weight:600;
  text-transform:uppercase;letter-spacing:.08em;color:var(--dm)}
#fe:not(.show-hidden) .fe-row.dotfile,
#fe:not(.show-hidden) .fe-tile.dotfile,
#fe:not(.show-hidden) .fe-tree-row.dotfile{display:none!important}
#fe[data-view="list"] .c-tp,#fe[data-view="list"] .c-sz,#fe[data-view="list"] .c-dt{display:none}
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
.fe-tree-message{padding:4px 12px;color:var(--dm);font-size:calc(11px * var(--ui-text-scale,1))}
#fe[data-view="tiles"] #fe-tiles,#fe[data-view="icons"] #fe-tiles{display:flex}
.fe-tile{display:flex;flex-direction:column;align-items:center;gap:3px;
  padding:8px 6px 7px;border-radius:var(--r);text-decoration:none;
  color:var(--tx);border:1px solid transparent;transition:all .12s;
  width:96px;overflow:hidden;cursor:pointer;position:relative}
.fe-tile:hover{background:var(--hover);border-color:var(--bd)}
.fe-tile-ic{font-size:0;line-height:0}
.fe-tile-ic svg{display:block}
.fe-tile-nm{font-size:calc(11px * var(--ui-text-scale,1));text-align:center;overflow-wrap:anywhere;word-break:normal;max-width:100%;
  overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;
  line-height:1.3}
.fe-tile-sz{font-size:calc(10px * var(--ui-text-scale,1));color:var(--dm)}
.fe-tile.dir .fe-tile-nm{color:var(--dir)}
.fe-tile.par .fe-tile-nm{color:var(--dm)}
#fe[data-view="tiles"] .fe-tile-ic svg{transform:scale(1.5);margin:4px}
#fe[data-view="icons"] .fe-tile{width:116px;padding:10px 8px 8px;gap:4px}
#fe[data-view="icons"] .fe-tile-ic svg{transform:scale(2);margin:8px 10px 6px}
#fe[data-view="icons"] .fe-tile-nm{font-size:calc(12px * var(--ui-text-scale,1))}
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
.fe-act-btn{
  background:var(--s2);border:1px solid var(--bd);border-radius:4px;
  color:var(--mt);cursor:pointer;padding:3px 5px;
  transition:background .1s,color .1s,border-color .1s;
  display:flex;align-items:center;justify-content:center}
.fe-act-btn:hover{background:var(--hover);color:var(--ac);border-color:var(--ac)}
.fe-row td.c-nm{position:relative}
#fe-statusbar{display:flex;justify-content:space-between;padding:4px 14px;
  background:var(--s1);border-top:1px solid var(--bd);flex-shrink:0;font-size:calc(11px * var(--ui-text-scale,1));color:var(--dm)}
#fe-tip{
  position:fixed;pointer-events:none;z-index:200;
  background:var(--s2);border:1px solid var(--bd);border-radius:var(--r);
  padding:9px 12px;font-size:calc(11.5px * var(--ui-text-scale,1));line-height:1.7;color:var(--tx);
  max-width:380px;overflow-wrap:anywhere;word-break:break-word;
  box-shadow:0 4px 20px #000a;opacity:0;
  transition:opacity .15s ease-out;
}
#fe-tip.show{opacity:1;transition:opacity .18s ease-in .06s}
.tip-header{display:flex;align-items:center;gap:7px;margin-bottom:4px}
.tip-icon{flex-shrink:0;display:flex;align-items:center}
.tip-icon svg{display:block}
.tip-name{font-weight:600;font-size:calc(12px * var(--ui-text-scale,1));word-break:break-all;color:var(--tx)}
.tip-line{color:var(--mt);font-size:calc(11px * var(--ui-text-scale,1));line-height:1.6}
.tip-warn{color:var(--dm);font-size:calc(10.5px * var(--ui-text-scale,1));margin-top:3px;border-top:1px solid var(--bd);padding-top:3px}
#fe-toast{
  position:fixed;bottom:32px;left:50%;transform:translateX(-50%) translateY(6px);
  background:#1f2937;color:#e5e7eb;padding:8px 18px;border-radius:20px;
  font-size:calc(12px * var(--ui-text-scale,1));opacity:0;transition:all .22s;pointer-events:none;white-space:nowrap;
  border:1px solid #374151;z-index:200
}
#fe-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
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
.fe-dlg-tx b{font-size:calc(14px * var(--ui-text-scale,1));font-weight:600;line-height:1.2;color:var(--tx);letter-spacing:-.01em}
.fe-dlg-tx i{font-size:calc(11px * var(--ui-text-scale,1));line-height:1.2;font-style:normal;color:var(--dm)}
.fe-dlg-close{background:none;border:none;color:var(--dm);cursor:pointer;font-size:calc(14px * var(--ui-text-scale,1));padding:3px 7px;border-radius:4px;line-height:1;transition:color .1s,background .1s}
.fe-dlg-close:hover{background:var(--hover);color:var(--tx)}
.fe-dlg-tabs{display:flex;gap:3px;padding:0 16px;background:var(--s2);border-bottom:1px solid var(--bd);flex:none;align-items:stretch;overflow-x:auto}
.fe-dlg-tab{display:flex;flex-direction:column;gap:2px;background:none;border:none;border-bottom:2px solid transparent;border-radius:6px 6px 0 0;
  padding:9px 13px 8px;color:var(--mt);cursor:pointer;text-align:left;line-height:1;white-space:nowrap;transition:background .1s,color .1s,border-color .1s}
.fe-dlg-tab-main{display:flex;align-items:center;gap:5px;min-width:0}
.fe-dlg-tab-main svg{flex:none;width:13px;height:13px}
#fe-settings-modal .fe-dlg-tabs{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:0;overflow:visible;padding:0 8px}
#fe-settings-modal .fe-dlg-tab{min-width:0;padding:9px 7px 8px;white-space:normal}
#fe-settings-modal .fe-dlg-tab i{line-height:1.15;white-space:normal}
.fe-dlg-tab b{font-size:calc(12.5px * var(--ui-text-scale,1));font-weight:600;color:inherit}
.fe-dlg-tab i{font-size:calc(10.5px * var(--ui-text-scale,1));font-style:normal;color:var(--dm);opacity:.85}
.fe-dlg-tab:hover{color:var(--tx);background:var(--s1)}
.fe-dlg-tab.on{background:var(--s1);color:var(--tx);border-bottom-color:var(--ac)}
.fe-dlg-tab.on i{opacity:1}
.fe-dlg-pane{display:none;padding:18px 22px 22px;overflow:auto;min-height:0}
.fe-dlg-pane.on{display:flex;flex-direction:column;gap:20px}
.fe-dlg-pane .fe-pbn{display:inline-flex;align-items:center;justify-content:center;gap:5px}
.fe-dlg-pane .fe-pbn svg{flex:none;width:13px;height:13px}
.fe-dlg-pane .fe-md{max-width:none;padding:0}
.fe-dlg-pane .fe-md h2{font-size:calc(15px * var(--ui-text-scale,1));margin-top:6px}
.fe-dlg-pane .fe-md>:first-child{margin-top:0}
.fe-st-section{display:flex;flex-direction:column;gap:10px}
.fe-st-title{font-size:calc(11px * var(--ui-text-scale,1));font-weight:600;text-transform:uppercase;letter-spacing:.08em;
  color:var(--dm);padding-bottom:4px;border-bottom:1px solid var(--bd)}
.fe-st-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.fe-st-lbl{font-size:calc(12px * var(--ui-text-scale,1));color:var(--mt);min-width:90px;flex-shrink:0}
.fe-st-radio{display:flex;align-items:center;gap:6px;font-size:calc(13px * var(--ui-text-scale,1));color:var(--tx);cursor:pointer}
.fe-st-radio input{accent-color:var(--ac);cursor:pointer}
.fe-st-check{display:flex;align-items:center;gap:7px;font-size:calc(13px * var(--ui-text-scale,1));color:var(--tx);cursor:pointer}
.fe-st-check input{accent-color:var(--ac);cursor:pointer;width:14px;height:14px}
.fe-st-select{background:var(--s2);border:1px solid var(--bd);color:var(--tx);
  padding:4px 8px;border-radius:var(--r);font-size:calc(12px * var(--ui-text-scale,1));outline:none;cursor:pointer}
.fe-st-input{background:var(--bg);border:1px solid var(--bd);color:var(--tx);
  padding:4px 8px;border-radius:var(--r);font-size:calc(12px * var(--ui-text-scale,1));outline:none;width:100%;
  font-family:inherit;box-sizing:border-box}
.fe-st-input:focus{border-color:var(--ac)}
.fe-st-rules-hint{font-size:calc(11px * var(--ui-text-scale,1));color:var(--dm);font-style:italic}
.fe-st-rules-cols{display:grid;grid-template-columns:16px 22px 1fr 58px 32px 24px;
  gap:6px;padding:0 2px 4px;align-items:center;font-size:calc(10px * var(--ui-text-scale,1));color:var(--dm)}
.fe-st-col-lbl{font-size:calc(10px * var(--ui-text-scale,1));color:var(--dm);font-weight:500}
.fe-st-rule{display:grid;grid-template-columns:16px 22px 1fr 58px 32px 24px;
  gap:6px;align-items:center;padding:5px 2px;border-bottom:1px solid var(--bd)}
.fe-st-rule:last-child{border-bottom:none}
.fe-st-rule input[type="checkbox"]{accent-color:var(--ac);cursor:pointer;width:13px;height:13px}
.fe-st-rule-preview{display:flex;align-items:center;justify-content:center;height:20px}
.fe-st-rule-pattern,.fe-st-rule-label{
  background:var(--bg);border:1px solid var(--bd);color:var(--tx);
  padding:3px 6px;border-radius:var(--r);font-size:calc(11px * var(--ui-text-scale,1));
  font-family:'SF Mono',Consolas,monospace;outline:none;transition:border-color .15s;width:100%}
.fe-st-rule-pattern:focus,.fe-st-rule-label:focus{border-color:var(--ac)}
.fe-st-rule-label{text-align:center}
.fe-st-rule-color{border:1px solid var(--bd);background:none;cursor:pointer;
  width:28px;height:24px;padding:1px;border-radius:4px;flex-shrink:0}
.fe-st-rule-del{background:none;border:none;color:var(--dm);cursor:pointer;
  padding:3px 5px;font-size:calc(12px * var(--ui-text-scale,1));border-radius:3px;line-height:1;transition:color .1s,background .1s;text-align:center}
.fe-st-rule-del:hover{color:#f85149;background:var(--hover)}
.fe-st-rules-empty{font-size:calc(12px * var(--ui-text-scale,1));color:var(--dm);padding:8px 2px;font-style:italic}
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
.fe-st-ai-state{font-size:calc(12.5px * var(--ui-text-scale,1));font-weight:600;color:var(--tx)}
.fe-st-ai-grid{display:grid;grid-template-columns:auto 1fr;gap:3px 12px;font-size:calc(11.5px * var(--ui-text-scale,1))}
.fe-st-ai-grid .k{color:var(--dm)}
.fe-st-ai-grid .v{color:var(--tx);font-family:'SF Mono',Menlo,Consolas,monospace;font-size:calc(11px * var(--ui-text-scale,1));
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fe-st-ai-grid .v.warm-yes{color:var(--green)}
.fe-st-ai-grid .v.warm-no{color:var(--gold)}
.fe-st-ai-controls{display:flex;align-items:center;gap:8px;margin-top:10px;flex-wrap:wrap}
.fe-st-ai-controls .fe-st-select{flex:1;min-width:120px}
.fe-st-ai-hint{font-size:calc(11px * var(--ui-text-scale,1));color:var(--dm);margin-top:8px;line-height:1.5}
.fe-st-ai-hint code{background:var(--bg);border:1px solid var(--bd);border-radius:3px;padding:0 4px;
  font-family:'SF Mono',Menlo,Consolas,monospace;font-size:calc(10.5px * var(--ui-text-scale,1));color:var(--mt)}
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
#fe-tabs{display:flex;align-items:stretch;gap:2px;padding:6px 10px 0;background:var(--s1);border-bottom:1px solid var(--bd);
  overflow-x:auto;flex-shrink:0;min-height:34px;scrollbar-width:none;
  mask-image:linear-gradient(90deg,transparent 0,#000 10px,#000 calc(100% - 10px),transparent)}
#fe-tabs::-webkit-scrollbar{display:none}
.fe-tab-list{position:sticky;right:0;flex-shrink:0;align-self:center;background:var(--s1);border:1px solid var(--bd);color:var(--mt);cursor:pointer;
  font-size:calc(11px * var(--ui-text-scale,1));padding:2px 6px;border-radius:5px;margin-left:4px}
.fe-tab-list:hover{border-color:var(--ac);color:var(--ac)}
.fe-tab-list svg{display:block}
.fe-tab.pinned{padding:5px 6px;min-width:0}
.fe-tab.pinned .fe-tab-lbl,.fe-tab.pinned .fe-tab-more{display:none}
#fe-tabs.empty{padding-top:4px}
.fe-tab{display:flex;align-items:center;gap:6px;padding:5px 8px 5px 12px;font-size:calc(12px * var(--ui-text-scale,1));color:var(--mt);text-decoration:none;
  border:1px solid transparent;border-bottom:none;border-radius:6px 6px 0 0;white-space:nowrap;max-width:200px;min-width:64px;flex:0 1 auto;position:relative;top:1px}
.fe-tab:hover{background:var(--hover);color:var(--tx)}
.fe-tab.on{background:var(--s2);color:var(--tx);border-color:var(--bd)}
.fe-tab.temp .fe-tab-lbl{font-style:italic;color:var(--mt)}
.fe-tab.drag-over{border-left:2px solid var(--ac)}
.fe-tab-lbl{display:flex;overflow:hidden;min-width:0}
.fe-tab-head{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.fe-tab-tail{white-space:nowrap;flex-shrink:0}
.fe-tab-x,.fe-tab-more{background:none;border:none;color:var(--dm);cursor:pointer;font-size:calc(10px * var(--ui-text-scale,1));padding:1px 4px;border-radius:3px;opacity:0;line-height:1}
.fe-tab-more{font-size:calc(12px * var(--ui-text-scale,1));letter-spacing:1px}
.fe-tab:hover .fe-tab-x,.fe-tab.on .fe-tab-x,.fe-tab:hover .fe-tab-more{opacity:1}
.fe-tab-x:hover{background:var(--s3);color:#f85149}
.fe-tab-more:hover{background:var(--s3);color:var(--tx)}
.fe-tab.pinned::before{content:'';width:5px;height:5px;border-radius:50%;background:var(--ac);flex-shrink:0}
.fe-tab-ico{display:flex;flex-shrink:0}
.fe-tab-ico svg{width:11px;height:12px}
.fe-tab-menu{position:fixed}
#fe.fe-file-page #fe-toolbar,#fe.fe-file-page #fe-sg-panel,#fe.fe-file-page #fe-filter-bar,#fe.fe-file-page #fe-scroll{display:none!important}
#fe-fp-bar{display:flex;align-items:center;gap:6px;padding:7px 14px;background:var(--s2);border-bottom:1px solid var(--bd);flex-shrink:0}
#fe-fp{display:flex;flex:1;min-height:0}
#fe-toc{width:220px;flex-shrink:0;overflow-y:auto;background:var(--s1);border-right:1px solid var(--bd);padding:10px 0;font-size:calc(12px * var(--ui-text-scale,1))}
#fe-toc a{display:block;color:var(--mt);text-decoration:none;padding:3px 14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#fe-toc a:hover{color:var(--ac);background:var(--hover)}
#fe-toc a.fe-toc-h2{padding-left:24px}#fe-toc a.fe-toc-h3{padding-left:34px}#fe-toc a.fe-toc-h4{padding-left:44px}
#fe-page{flex:1;min-width:0;overflow:auto;font-size:calc(12px * var(--ui-text-scale,1))}
#fe-page .fe-md{max-width:none;margin:0;padding:28px 48px 80px;font-size:calc(15px * var(--ui-text-scale,1));line-height:var(--rd-lh,1.65)}
#fe.fe-column-xl #fe-page .fe-md{max-width:150ch;margin:0 auto}
#fe.fe-column-lg #fe-page .fe-md{max-width:130ch;margin:0 auto}
#fe.fe-column-md #fe-page .fe-md{max-width:110ch;margin:0 auto}
#fe-page .fe-md h1{font-size:calc(26px * var(--ui-text-scale,1));margin:8px 0 16px;padding-bottom:8px}
#fe-page .fe-md h2{font-size:calc(21px * var(--ui-text-scale,1));margin:32px 0 12px;padding-bottom:6px}
#fe-page .fe-md h3{font-size:calc(17px * var(--ui-text-scale,1));margin:24px 0 8px}
#fe-page .fe-md h4,#fe-page .fe-md h5,#fe-page .fe-md h6{font-size:calc(15px * var(--ui-text-scale,1));margin:18px 0 6px}
#fe-page .fe-md p{margin:12px 0}
#fe-page .fe-md blockquote > .fe-md{padding:0;margin:0;max-width:none}
#fe-page .fe-md ul,#fe-page .fe-md ol{margin:10px 0;padding-left:28px}
#fe-page .fe-md li{margin:0 0 12px}
#fe-page .fe-md li:last-child{margin-bottom:0}
#fe-page .fe-md li > ul,#fe-page .fe-md li > ol{margin:6px 0 0}
#fe-page .fe-md li li{margin-bottom:4px}
.fe-md-alert{--al:#4493f8;border-left:3px solid var(--al);padding:8px 14px;margin:14px 0;border-radius:4px;background:color-mix(in srgb,var(--al) 9%,transparent)}
#fe .fe-md-alert > :last-child{margin-bottom:0}
.fe-md-alert-title{font-weight:600;color:var(--al);margin:0 0 4px!important}
.fe-md-alert-tip{--al:#3fb950}.fe-md-alert-important{--al:#ab7df8}.fe-md-alert-warning{--al:#d29922}.fe-md-alert-caution{--al:#f85149}
#fe[data-theme="light"] .fe-md-alert{--al:#0969da}
#fe[data-theme="light"] .fe-md-alert-tip{--al:#1a7f37}#fe[data-theme="light"] .fe-md-alert-important{--al:#8250df}
#fe[data-theme="light"] .fe-md-alert-warning{--al:#9a6700}#fe[data-theme="light"] .fe-md-alert-caution{--al:#d1242f}
.fe-md-footnotes{border-top:1px solid var(--bd);margin-top:28px;padding-top:10px;font-size:.88em;color:var(--mt)}
.fe-md-fnref a,.fe-md-fnback{text-decoration:none}
#fe-page .fe-md code{font-size:calc(var(--rd-code,13px) * var(--ui-text-scale,1))}
#fe-page .fe-md-pre{font-size:calc(var(--rd-code,13px) * var(--ui-text-scale,1));line-height:1.5}
#fe.fe-notips #fe-tip{display:none!important}
#fe-page .fe-md-table{font-size:calc(14px * var(--ui-text-scale,1))}
#fe-page .fe-md-table th,#fe-page .fe-md-table td{padding:7px 13px}
#fe-fp-toc,#fe-fp-column{background:none;border:1px solid var(--bd);color:var(--mt);cursor:pointer;font-size:calc(11px * var(--ui-text-scale,1));padding:3px 8px;border-radius:5px}
#fe-fp-bar button{display:inline-flex;align-items:center;gap:5px}
#fe-fp-bar button svg{flex-shrink:0}
#fe-fp-toc:hover,#fe-fp-column:hover{border-color:var(--ac);color:var(--ac)}
#fe-fp-toc.on,#fe-fp-column.on{border-color:var(--ac);color:var(--ac);background:var(--act)}
#fe-toc a.on{color:var(--ac);border-left:2px solid var(--ac);padding-left:12px}
#fe-side.fe-side-split{display:flex;flex-direction:column;overflow:hidden;padding:0}
#fe-side-toc{flex:0 1 auto;max-height:50%;min-height:0;overflow-y:auto;border-bottom:1px solid var(--bd);padding:6px 0;position:relative}
#fe-side-toc:has(> #fe-toc[style*="none"]){display:none}
#fe-side-toc #fe-toc{width:auto;border:0;background:none;padding:0;overflow:visible}
#fe-side-rest{flex:1;min-height:0;overflow-y:auto;padding:6px 0}
.fe-crumb-file{color:var(--tx);font-weight:500}
#fe-fp-meta{font-size:calc(11px * var(--ui-text-scale,1));color:var(--dm);margin-right:auto;white-space:nowrap}
#fe-nt-list .fe-nt-hit{display:block;padding:0 10px 4px 32px;font-size:calc(10.5px * var(--ui-text-scale,1));color:var(--dm);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#fe-fe{flex:1;min-width:0;display:flex;flex-direction:column;min-height:0}
#fe-fe-bar{display:flex;align-items:center;gap:6px;padding:6px 14px;border-bottom:1px solid var(--bd);background:var(--s1)}
#fe-fe-state{color:var(--dm);font-size:calc(11px * var(--ui-text-scale,1));margin-left:6px}
#fe-fe-state.dirty{color:var(--ac)}
#fe-fe-banner{display:flex;align-items:center;gap:8px;padding:8px 14px;border-bottom:1px solid var(--bd);background:var(--act)}
#fe-fe .fe-ed{flex:1}
#fe-fp-edit.on{border-color:var(--ac);color:var(--ac);background:var(--act)}
#fe-fp-edit,#fe-fp-raw,#fe-fp-copy{background:none;border:1px solid var(--bd);color:var(--mt);cursor:pointer;font-size:calc(11px * var(--ui-text-scale,1));padding:3px 8px;border-radius:5px}
#fe-fp-edit:hover,#fe-fp-raw:hover,#fe-fp-copy:hover{border-color:var(--ac);color:var(--ac)}
#fe-fp-raw.on{border-color:var(--ac);color:var(--ac);background:var(--act)}
#fe-fp-reload{font-size:calc(11px * var(--ui-text-scale,1));color:var(--dm)}
#fe-ed-bar{display:flex;align-items:center;gap:4px;padding:6px 10px;border-bottom:1px solid var(--bd);background:var(--s2);flex-shrink:0;flex-wrap:wrap}
#fe-ed-bar .fe-pbn{padding:2px 7px;font-size:calc(11px * var(--ui-text-scale,1));display:inline-flex;align-items:center;gap:5px}
.fe-ed-hint{margin-left:auto;font-size:calc(10.5px * var(--ui-text-scale,1));color:var(--dm);white-space:nowrap}
#fe-ed-hist{display:flex;flex-direction:column;gap:2px;padding:6px 10px;border-bottom:1px solid var(--bd);background:var(--s2);max-height:180px;overflow:auto;flex-shrink:0;font-size:calc(11px * var(--ui-text-scale,1));color:var(--dm)}
.fe-hist-row{display:grid;grid-template-columns:minmax(120px,160px) 1fr auto;gap:10px;align-items:baseline;text-align:left;background:none;border:1px solid transparent;border-radius:5px;padding:3px 6px;color:var(--tx);cursor:pointer;font:inherit}
.fe-hist-row:hover,.fe-hist-row.active{border-color:var(--ac);background:var(--act)}
.fe-hist-row code{color:var(--dm)}
.fe-hist-head{display:flex;gap:8px;align-items:center;padding:8px 12px;border-bottom:1px solid var(--bd);color:var(--dm);font-size:calc(11px * var(--ui-text-scale,1))}
#fe-ql-body.fe-editing{display:flex;flex-direction:column}
.fe-ed{display:flex;flex:1;min-height:0}
.fe-md img{max-width:100%;border-radius:6px}
#fe-ed-src{flex:1;min-width:0;resize:none;border:none;border-right:1px solid var(--bd);background:var(--s1);color:var(--tx);
  font:calc(12.5px * var(--ui-text-scale,1))/1.6 ui-monospace,SFMono-Regular,Menlo,monospace;padding:14px 16px;outline:none;tab-size:2}
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
.fe-chip{border:1px solid var(--bd);border-radius:999px;padding:1px 4px 1px 8px;font-size:calc(11px * var(--ui-text-scale,1));color:var(--mt);background:var(--bg)}
.fe-chip svg,.fe-chip-btn svg{flex:none;width:12px;height:12px}
.fe-chip-static{padding-right:8px}
.fe-chip-x{background:none;border:0;color:var(--dm);cursor:pointer;display:grid;place-items:center;padding:2px;border-radius:50%}
.fe-chip-x:hover{color:var(--ac)}
#fe-ed-meta .fe-pbn{padding:2px 8px;font-size:calc(11px * var(--ui-text-scale,1))}
.fe-cdot{flex:none}
.fe-pmenu{position:fixed;z-index:2147483000;width:250px;background:var(--s1);border:1px solid var(--bd);border-radius:8px;padding:8px;box-shadow:0 8px 24px rgba(0,0,0,.35);display:flex;flex-direction:column;gap:6px}
.fe-pmenu .fe-pbn{display:inline-flex;align-items:center;gap:6px;text-align:left}
.fe-pmenu .fe-pbn svg{flex:none;width:12px;height:12px}
.fe-pm-lbl{font-size:calc(10.5px * var(--ui-text-scale,1));color:var(--mt);text-transform:uppercase;letter-spacing:.04em}
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
.fe-nt-tags{font-size:calc(10.5px * var(--ui-text-scale,1));color:var(--mt);display:flex;gap:6px;flex-wrap:wrap}
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
  width:18px;height:18px;line-height:1;font-size:calc(13px * var(--ui-text-scale,1));padding:0;display:flex;align-items:center;justify-content:center}
#fe-sv-add{margin-left:auto}
#fe-nt-add:hover{border-color:var(--ac);color:var(--ac)}
.fe-sh a{color:inherit;text-decoration:none}
.fe-sh a:hover{color:var(--ac)}
#fe-ql-dock{background:none;border:1px solid var(--bd);color:var(--mt);cursor:pointer;padding:3px 7px;border-radius:5px;line-height:1;display:flex;align-items:center}
#fe-ql-dock:hover{border-color:var(--ac);color:var(--ac)}
#fe-ql-dock.on{color:var(--ac);border-color:var(--ac)}
#fe-ql-hdr{display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid var(--bd);flex-shrink:0}
#fe-ql-icon svg{display:block}
/* Docked, the header keeps its name readable and its close button inside the panel: buttons go icon-only. */
#fe-qlook.side #fe-ql-hdr > button > span,#fe-qlook.side #fe-ql-hdr > a:not(#fe-ql-name) > span{display:none}
#fe-qlook.side #fe-ql-hdr{gap:5px;padding:8px 10px}
#fe-qlook.side #fe-ql-hdr > *{flex-shrink:0}
#fe-qlook.side #fe-ql-name,#fe-qlook.side #fe-ql-meta{flex-shrink:1;min-width:0}
#fe-qlook.side #fe-ed-bar > button > span{display:none}
#fe-qlook.side .fe-ed-hint{display:none}
#fe-ql-name{font-weight:600;font-size:calc(13px * var(--ui-text-scale,1));overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:inherit;text-decoration:none}
#fe-ql-name:hover{color:var(--ac);text-decoration:underline}
#fe-ql-meta{font-size:calc(11px * var(--ui-text-scale,1));color:var(--dm);flex:1;white-space:nowrap}
#fe-ql-open{font-size:calc(11px * var(--ui-text-scale,1));color:var(--ac);text-decoration:none;padding:3px 8px;border:1px solid var(--bd);border-radius:5px;white-space:nowrap;display:inline-flex;align-items:center;gap:5px}
#fe-ql-go,#fe-ql-tab{font-size:calc(11px * var(--ui-text-scale,1));color:var(--mt);background:none;cursor:pointer;padding:3px 8px;border:1px solid var(--bd);border-radius:5px;white-space:nowrap;display:inline-flex;align-items:center;gap:5px}
#fe-ql-go:hover,#fe-ql-tab:hover{border-color:var(--ac);color:var(--ac)}
#fe-ql-open:hover{border-color:var(--ac)}
#fe-ql-copy{display:flex;align-items:center;gap:5px;font-size:calc(11px * var(--ui-text-scale,1));color:var(--mt);background:none;
  cursor:pointer;padding:3px 8px;border:1px solid var(--bd);border-radius:5px;white-space:nowrap;line-height:1.4}
#fe-ql-copy:hover:not(:disabled){border-color:var(--ac);color:var(--ac)}
#fe-ql-copy:disabled{opacity:.45;cursor:default}
#fe-ql-close{background:none;border:none;color:var(--dm);cursor:pointer;font-size:calc(13px * var(--ui-text-scale,1));padding:3px 7px;border-radius:4px;line-height:1}
#fe-ql-close:hover{background:var(--hover);color:var(--tx)}
#fe-ql-body{flex:1;overflow:auto;font-size:calc(12px * var(--ui-text-scale,1))}
#fe-ql-body:has(> .fe-ql-htmlbar){display:flex;flex-direction:column}
.fe-ql-htmlbar{display:flex;gap:4px;padding:6px 10px;border-bottom:1px solid var(--bd);flex:none}
.fe-ql-htmlbar .fe-pbn.on{border-color:var(--ac);color:var(--ac)}
.fe-ql-html{flex:1;min-height:0;width:100%;border:0;background:#fff}
/* The preview panel reads at the same reader sizes as the file page; dialogs keep the base size. */
#fe-ql-body .fe-md{font-size:calc(15px * var(--ui-text-scale,1));line-height:var(--rd-lh,1.65)}
#fe-ql-body .fe-md code{font-size:calc(var(--rd-code,13px) * var(--ui-text-scale,1))}
#fe-ql-body .fe-md-pre{font-size:calc(var(--rd-code,13px) * var(--ui-text-scale,1))}
#fe-ql-ai{display:flex;align-items:center;gap:6px;padding:7px 14px;
  border-bottom:1px solid var(--bd);background:var(--s2);flex-shrink:0}
#fe-ql-ai-chip{display:flex;align-items:center;gap:5px;font-size:calc(10.5px * var(--ui-text-scale,1));color:var(--dm);
  margin-right:4px;white-space:nowrap}
#fe-ql-ai-chip .dot{width:7px;height:7px;border-radius:50%;background:var(--dm);flex-shrink:0}
#fe-ql-ai-chip.ready .dot{background:var(--green)}
#fe-ql-ai-chip.cold .dot{background:var(--gold)}
#fe-ql-ai-chip.down .dot{background:#f85149}
.fe-ql-ai-btn{background:none;border:1px solid var(--bd);color:var(--mt);cursor:pointer;
  padding:3px 9px;border-radius:5px;font-size:calc(11px * var(--ui-text-scale,1));transition:all .12s;white-space:nowrap}
.fe-ql-ai-btn:hover:not(:disabled){border-color:var(--ac);color:var(--ac)}
.fe-ql-ai-btn:disabled{opacity:.45;cursor:default}
#fe-ql-ai-q{flex:1;min-width:80px;background:var(--bg);border:1px solid var(--bd);color:var(--tx);
  padding:4px 9px;border-radius:5px;font-size:calc(11.5px * var(--ui-text-scale,1));outline:none;transition:border-color .15s}
#fe-ql-ai-q:focus{border-color:var(--ac)}
#fe-ql-ai-q:disabled{opacity:.45}
#fe-ql-ai-q::placeholder{color:var(--dm)}
#fe-ql-ai-out{border-bottom:1px solid var(--bd);max-height:42%;overflow-y:auto;flex-shrink:0;background:var(--s1)}
#fe-ql-ai-out-body{padding:10px 16px 4px;font-size:calc(12.5px * var(--ui-text-scale,1));line-height:1.6;white-space:pre-wrap}
#fe-ql-ai-out-body .fe-md{padding:0;white-space:normal}
#fe-ql-ai-out-meta{padding:2px 16px 8px;font-size:calc(10px * var(--ui-text-scale,1));color:var(--dm)}
.fe-ql-center{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:10px}
.fe-ql-note{font-size:calc(11.5px * var(--ui-text-scale,1));color:var(--dm);padding:6px 14px}
.fe-ql-note.err{color:#f85149}
.fe-ql-imgwrap{display:flex;flex-direction:column;height:100%}
.fe-ql-imgbar{display:flex;align-items:center;gap:4px;padding:6px 10px;border-bottom:1px solid var(--bd);background:var(--s2);flex-shrink:0;flex-wrap:wrap}
.fe-ql-imgbar .fe-pbn{padding:2px 7px;font-size:calc(11px * var(--ui-text-scale,1));display:inline-flex;align-items:center;gap:5px}
.fe-ql-imgbar .fe-pbn svg{flex:none;width:13px;height:13px}
.fe-ql-imgstage{flex:1;min-height:0;overflow:auto;display:flex}
.fe-ql-imgsizer{position:relative;margin:auto;flex:none}
.fe-ql-img{position:absolute;left:50%;top:50%;max-width:none;max-height:none;border-radius:4px;transform-origin:center}
.fe-ql-imgwrap .fe-ql-dim{padding:4px 12px;border-top:1px solid var(--bd);text-align:center;flex-shrink:0}
.fe-ql-dim{font-size:calc(11px * var(--ui-text-scale,1));color:var(--dm);font-variant-numeric:tabular-nums}
.fe-ql-pdf{width:100%;height:100%;border:none}
.fe-ql-media-wrap{display:flex;align-items:center;justify-content:center;height:100%;padding:16px}
.fe-ql-media{max-width:100%;max-height:100%;border-radius:4px;background:#000}
.fe-ql-center audio{width:min(480px,90%)}
.fe-ql-font{padding:20px 26px;overflow:auto;line-height:1.5}
.fe-ql-font>div{margin:6px 0;word-break:break-word;border-bottom:1px solid var(--s2);padding-bottom:6px}
.fe-code-wrap{display:flex;font:calc(11.5px * var(--ui-text-scale,1))/1.55 'SF Mono',Menlo,Consolas,monospace;min-height:100%}
.fe-code-gut{padding:10px 8px 14px 12px;text-align:right;color:var(--dm);user-select:none;
  border-right:1px solid var(--bd);background:var(--s2);min-width:34px;flex-shrink:0}
.fe-code{padding:10px 14px 14px;white-space:pre;flex:1}
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
.fe-ql-table{border-collapse:collapse;width:100%;font:calc(11.5px * var(--ui-text-scale,1)) 'SF Mono',Menlo,Consolas,monospace}
.fe-ql-table th{position:sticky;top:0;background:var(--s2);padding:6px 10px;text-align:left;
  border-bottom:1px solid var(--bd);cursor:pointer;white-space:nowrap;color:var(--mt);font-weight:600;z-index:1}
.fe-ql-table th:hover{color:var(--tx)}
.fe-ql-table th.sorted{color:var(--ac)}
.fe-ql-table td{padding:4px 10px;border-bottom:1px solid var(--s2);white-space:nowrap;
  max-width:340px;overflow:hidden;text-overflow:ellipsis}
.fe-ql-table th.num,.fe-ql-table td.num{text-align:right;font-variant-numeric:tabular-nums}
.fe-ql-table tbody tr:hover{background:var(--hover)}
.fe-jt-root,.fe-jl-root{padding:10px 14px;font:calc(11.5px * var(--ui-text-scale,1))/1.6 'SF Mono',Menlo,Consolas,monospace}
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
.fe-jt-badge{color:var(--dm);font-size:calc(10.5px * var(--ui-text-scale,1))}
.fe-jt-row{padding-left:12px}
.fe-jl-line{border-bottom:1px solid var(--s2);padding:2px 0}
.fe-jl-line summary{display:flex;gap:8px;align-items:baseline}
.fe-jl-n{color:var(--dm);min-width:28px;text-align:right;user-select:none;font-size:calc(10.5px * var(--ui-text-scale,1));flex-shrink:0}
.fe-jl-prev{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--mt)}
.fe-jl-line.bad{display:flex;gap:8px;align-items:baseline}
.fe-jl-err{color:#f85149;font-size:calc(10px * var(--ui-text-scale,1));border:1px solid #f8514940;border-radius:3px;padding:0 4px;flex-shrink:0}
.fe-md{padding:14px 22px 20px;font-size:calc(13px * var(--ui-text-scale,1));line-height:1.65;max-width:760px}
.fe-md h1{font-size:calc(19px * var(--ui-text-scale,1));border-bottom:1px solid var(--bd);padding-bottom:6px;margin:16px 0 10px}
.fe-md h2{font-size:calc(16px * var(--ui-text-scale,1));border-bottom:1px solid var(--bd);padding-bottom:4px;margin:14px 0 8px}
.fe-md h3{font-size:calc(14px * var(--ui-text-scale,1));margin:12px 0 6px}
.fe-md h4,.fe-md h5,.fe-md h6{font-size:calc(13px * var(--ui-text-scale,1));margin:10px 0 5px}
.fe-md p{margin:7px 0}
.fe-md code{background:var(--s2);border:1px solid var(--bd);padding:0 5px;border-radius:4px;
  font:calc(11.5px * var(--ui-text-scale,1)) 'SF Mono',Menlo,Consolas,monospace}
.fe-md-code{margin:10px 0;border:1px solid var(--bd);border-radius:6px;background:var(--s2);overflow:hidden}
.fe-md-code-bar{display:flex;align-items:center;justify-content:space-between;padding:3px 10px;border-bottom:1px solid var(--bd);background:var(--s1)}
.fe-md-lang{font:600 calc(10.5px * var(--ui-text-scale,1))/1 'SF Mono',Menlo,Consolas,monospace;letter-spacing:.06em;text-transform:uppercase;color:var(--dm)}
.fe-md-copy{background:none;border:1px solid var(--bd);color:var(--mt);cursor:pointer;font-size:calc(10.5px * var(--ui-text-scale,1));padding:1px 7px;border-radius:4px}
.fe-md-copy:hover{border-color:var(--ac);color:var(--ac)}
.fe-md-pre{background:var(--s2);border:1px solid var(--bd);border-radius:6px;padding:10px 12px;
  overflow-x:auto;font:calc(11.5px * var(--ui-text-scale,1))/1.55 'SF Mono',Menlo,Consolas,monospace;margin:10px 0;white-space:pre}
.fe-md-code .fe-md-pre{border:none;border-radius:0;margin:0}
.fe-md-mermaid{margin:10px 0;padding:14px;border:1px solid var(--bd);border-radius:6px;
  background:var(--s1);overflow-x:auto;text-align:center}
.fe-md-mermaid svg{display:block;max-width:100%;height:auto;margin:auto}
.fe-md-mermaid-source[hidden]{display:none}
.fe-md-mermaid-source{margin:8px 0 0;padding:10px;text-align:left;white-space:pre-wrap;
  background:var(--s2);border-radius:4px;font:calc(11.5px * var(--ui-text-scale,1))/1.55 'SF Mono',Menlo,Consolas,monospace}
.fe-md-anchor{margin-left:8px;color:var(--dm);font-weight:400;text-decoration:none;opacity:0;transition:opacity .1s}
.fe-md-anchor::before{content:'#'}
.fe-md h1:hover .fe-md-anchor,.fe-md h2:hover .fe-md-anchor,.fe-md h3:hover .fe-md-anchor,.fe-md h4:hover .fe-md-anchor,.fe-md h5:hover .fe-md-anchor,.fe-md h6:hover .fe-md-anchor{opacity:1}
.fe-md-fm{display:grid;grid-template-columns:max-content 1fr;gap:3px 14px;margin:0 0 18px;padding:10px 14px;background:var(--s2);border:1px solid var(--bd);border-radius:6px;font-size:calc(12.5px * var(--ui-text-scale,1))}
.fe-md-fm dt{color:var(--dm);font-weight:600}
.fe-md-fm dd{margin:0;color:var(--tx)}
.fe-md li.fe-task{list-style:none;margin-left:-20px!important;padding-left:0}
.fe-md li.fe-task input{accent-color:var(--ac);margin-right:6px;vertical-align:-2px}
.fe-md-tablewrap{overflow-x:auto;margin:10px 0}
.fe-md-table tbody tr:nth-child(even){background:var(--s1)}
.fe-md img{display:block;margin:12px auto;cursor:zoom-in}
.fe-md blockquote{border-left:3px solid var(--bd);padding:1px 12px;color:var(--mt);margin:8px 0}
.fe-md blockquote .fe-md{padding:0}
.fe-md ul,.fe-md ol{padding-left:24px;margin:12px 0}
.fe-md li{margin:0 0 12px}
.fe-md li:last-child{margin-bottom:0}
.fe-md a{color:var(--ac);text-decoration:none}
.fe-md a:hover{text-decoration:underline}
.fe-md img{max-width:100%;border-radius:6px}
.fe-md hr{border:none;border-top:1px solid var(--bd);margin:14px 0}
.fe-md-table{border-collapse:collapse;margin:0;font-size:calc(12.5px * var(--ui-text-scale,1))}
.fe-md-table th,.fe-md-table td{border:1px solid var(--bd);padding:5px 11px;text-align:left}
.fe-md-table th{background:var(--s2);font-weight:600}
#fe-ctx,.fe-ctx{position:fixed;z-index:360;background:var(--s1);border:1px solid var(--bd);border-radius:var(--r);
  min-width:180px;box-shadow:0 8px 24px #0009;display:none;padding:4px 0}
.fe-ctx-item{display:flex;align-items:center;gap:8px;padding:6px 12px;color:var(--tx);
  font-size:calc(12px * var(--ui-text-scale,1));cursor:pointer;white-space:nowrap}
.fe-ctx-item:hover{background:var(--hover)}
.fe-ctx-key{margin-left:auto;color:var(--dm);font-size:calc(10px * var(--ui-text-scale,1));padding-left:16px}
.fe-ctx-sep{height:1px;background:var(--bd);margin:4px 0}
#fe-tabs{gap:5px;mask-image:none}
.fe-tab{background:var(--s2);border-color:var(--bd);padding:6px 9px;border-radius:7px 7px 0 0;min-height:29px}
.fe-tab.on{background:var(--bg);border-color:var(--bd);box-shadow:none}
.fe-tab.temp{border-style:dashed}
.fe-tab-ico svg{width:15px;height:16px}
.fe-tab-x,.fe-tab-more{opacity:.6}
.fe-tab:focus-visible,.fe-tab-x:focus-visible,.fe-tab-more:focus-visible{outline:2px solid var(--mt);outline-offset:-2px}
@media (max-width:900px){
  #fe-side{width:clamp(120px,22vw,170px)}
  #fe-toc{width:clamp(120px,22vw,170px)}
  #fe-page .fe-md{padding:20px 18px 60px}
  #fe-fp-bar{flex-wrap:wrap;padding:7px 10px}
  #fe-toolbar{flex-wrap:wrap}
  #fe-count{flex-basis:100%}
  #fe-tb-right{width:100%;flex-wrap:wrap;justify-content:flex-start}
}
@media (max-width:700px){
  #fe-settings-modal .fe-dlg-tab{padding:7px 3px 6px;text-align:center}
  #fe-settings-modal .fe-dlg-tab-main{flex-direction:column;gap:2px}
  #fe-settings-modal .fe-dlg-tab b{font-size:calc(10.5px * var(--ui-text-scale,1))}
  #fe-settings-modal .fe-dlg-tab i{display:none}
}
`;
