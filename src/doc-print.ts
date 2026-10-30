// Printing a document. When a file page is printed (the browser's own Print,
// or Export > PDF) the paper gets the document alone: no sidebar, tabs or
// toolbars, the whole length rather than the screenful in view, dark ink on
// white whatever the theme, and diagrams drawn as still pictures. Folded prose
// opens for the print and folds back after it.

/** Dark ink on white, for paper and for exported files, whatever the theme or palette. */
const LIGHT_INK = `--bg:#fff;--s1:#fff;--s2:#f3f5f7;--s3:#e7ebee;--bd:#d6dde2;--bd2:#bcc7ce;--tx:#111;--mt:#4a5a64;--dm:#66757e;
    --ac:#0b5f5c;--tx-on-ac:#fff;--card:#fff;--side:#fff;
    --nc-red:#c92a2a;--nc-orange:#c25e00;--nc-yellow:#9c7400;--nc-green:#237032;--nc-teal:#0a7563;--nc-blue:#1864ab;--nc-purple:#5f3dc4;--nc-pink:#a61e4d;
    --syn-str:#0a7d33;--syn-kw:#cf222e;--syn-type:#1b7c83;--syn-builtin:#953800;--syn-lit:#8250df;--syn-num:#9a6700;--syn-var:#8250df;
    --syn-deco:#9a6700;--syn-fn:#8250df;--syn-regex:#116329;--syn-key:#0550ae;--syn-section:#8250df;--syn-add:#1a7f37;--syn-del:#cf222e`;

/** The print stylesheet, added after the app's own rules. `.fe-ink-light` lends the same ink to an export for a moment. */
export const PRINT_CSS = `
.fe-ink-light,.fe-ink-light *{${LIGHT_INK}}
@media print{
  @page{margin:16mm 14mm}
  /* Every rule below reads these tokens. */
  html:has(#fe.fe-file-page),#fe.fe-file-page,#fe.fe-file-page *{${LIGHT_INK}}
  html:has(#fe.fe-file-page),html:has(#fe.fe-file-page) body{background:#fff!important;height:auto!important;overflow:visible!important}
  /* Only the chain of boxes that holds the page stays, laid out as plain blocks so it runs onto as many sheets as it needs. */
  html:has(#fe.fe-file-page) body > :not(:has(#fe-page)),
  #fe.fe-file-page :not(:has(#fe-page)):not(#fe-page):not(#fe-page *){display:none!important}
  #fe.fe-file-page,#fe.fe-file-page :has(#fe-page),#fe.fe-file-page #fe-page{
    display:block!important;position:static!important;height:auto!important;min-height:0!important;max-height:none!important;
    width:auto!important;max-width:none!important;overflow:visible!important;margin:0!important;padding:0!important;
    border:0!important;border-radius:0!important;box-shadow:none!important;background:none!important;container-type:normal!important;transform:none!important}
  #fe-page .fe-md{max-width:none!important;margin:0!important;padding:0!important;font-size:11pt;line-height:1.5;color:#111}
  #fe-page .fe-md a{color:var(--ac);text-decoration:underline}
  /* Blocks keep together where they can; headings stay with what follows. */
  #fe-page .fe-md :is(h1,h2,h3,h4,h5,h6){break-after:avoid}
  #fe-page .fe-md :is(.fe-md-code,.fe-md-mermaid,blockquote,img,figure,tr){break-inside:avoid}
  #fe-page .fe-md :is(.fe-md-tablewrap,.fe-md-code pre){overflow:visible!important;max-height:none!important}
  #fe-page .fe-md .fe-md-code pre,#fe-page .fe-cl-t{white-space:pre-wrap!important;overflow-wrap:anywhere}
  #fe-page .fe-md-code pre{width:auto!important}
  #fe-page .fe-md table{width:100%!important}
  /* Controls on the page have no use on paper. */
  #fe-page :is(.btn,.fe-md-copy,.fe-md-anchor,.fe-blk-x,.fe-dv-more,.fe-dir-views,.fe-dir-next-more){display:none!important}
  /* State pills, meters and row edges are colour; keep it even with background graphics off. */
  #fe-page,#fe-page *{print-color-adjust:exact;-webkit-print-color-adjust:exact}
  #fe-page .fe-dv-clamp-in{max-height:none!important;-webkit-line-clamp:unset!important;display:block!important;overflow:visible!important}
  /* A diagram prints as its picture alone, at its own size up to the page width. */
  #fe-page .fe-md-mermaid :is(.dl-top,.dl-float,.dl-hint,.dl-toast,.dl-resize,.dl-panel,.dl-raw,.dl-msg){display:none!important}
  #fe-page .fe-md-mermaid :is(.dl,.dl-main,.dl-stage){height:auto!important;min-height:0!important;max-height:none!important;overflow:visible!important;position:static!important;border:0!important;background:none!important;box-shadow:none!important}
  #fe-page .fe-md-mermaid .dl-world{position:static!important;transform:none!important}
  #fe-page .fe-md-mermaid .dl-world > svg{display:block;max-width:100%!important;height:auto!important;margin:0 auto}
  /* Comment marks and hover washes are screen-only. */
  #fe-page [data-cm]::after{display:none!important}
}`;

/** Open folded prose before a print and fold it back after. */
export function initPrint(): void {
  let opened: HTMLElement[] = [];
  addEventListener('beforeprint', () => {
    opened = [...document.querySelectorAll<HTMLElement>('#fe-page .fe-dv-clamp:not(.open)')];
    for (const c of opened) c.classList.add('open');
  });
  addEventListener('afterprint', () => {
    for (const c of opened) c.classList.remove('open');
    opened = [];
  });
}
