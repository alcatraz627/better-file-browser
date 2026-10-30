// A rendered document as a Word file (.docx). It reads the clean HTML of a
// markdown page (headings, paragraphs, lists, tables, code, quotes, rules and
// pictures) and writes the matching Word parts, so the file opens in Word,
// Pages, LibreOffice and Google Docs with real headings, lists and tables
// rather than one block of pasted text.
//
// Pictures must already be data URLs (PNG or JPEG) with width and height
// attributes; the export step draws diagrams and loads images before calling.
import { zip } from './zip';

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const R_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

const x = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');

// Syntax colours for code, the light theme's, keyed by token class.
const TOKEN_COLOR: Record<string, string> = {
  'tok-str': '0A7D33', 'tok-kw': 'CF222E', 'tok-type': '1B7C83', 'tok-builtin': '953800', 'tok-lit': '8250DF', 'tok-num': '9A6700',
  'tok-var': '8250DF', 'tok-deco': '9A6700', 'tok-fn': '8250DF', 'tok-regex': '116329', 'tok-key': '0550AE', 'tok-section': '8250DF',
  'tok-add': '1A7F37', 'tok-del': 'CF222E', 'tok-cmt': '57606A',
};

interface Fmt { b?: boolean; i?: boolean; s?: boolean; code?: boolean; color?: string; link?: string }

class Writer {
  body: string[] = [];
  rels: string[] = [];
  media: { name: string; data: Uint8Array }[] = [];
  private relN = 0;
  private picN = 0;

  rel(type: string, target: string, external = false): string {
    const id = `rId${100 + ++this.relN}`;
    this.rels.push(`<Relationship Id="${id}" Type="${R_NS}/${type}" Target="${x(target)}"${external ? ' TargetMode="External"' : ''}/>`);
    return id;
  }

  /** The runs for an element's inline content. */
  runs(node: Node, f: Fmt = {}): string {
    let out = '';
    for (const n of node.childNodes) {
      if (n.nodeType === Node.TEXT_NODE) { out += this.run(n.textContent ?? '', f); continue; }
      if (!(n instanceof HTMLElement) || n.hidden) continue;
      const t = n.tagName;
      if (t === 'BR') { out += '<w:r><w:br/></w:r>'; continue; }
      if (t === 'IMG') { out += this.picture(n as HTMLImageElement); continue; }
      if (t === 'INPUT' && (n as HTMLInputElement).type === 'checkbox') { out += this.run((n as HTMLInputElement).checked ? '☑ ' : '☐ ', f); continue; }
      const tok = [...n.classList].find(c => TOKEN_COLOR[c]);
      const g: Fmt = {
        ...f,
        b: f.b || t === 'STRONG' || t === 'B',
        i: f.i || t === 'EM' || t === 'I' || n.classList.contains('tok-cmt'),
        s: f.s || t === 'DEL' || t === 'S',
        code: f.code || t === 'CODE',
        color: tok ? TOKEN_COLOR[tok] : f.color,
      };
      if (t === 'A' && (n as HTMLAnchorElement).href && !f.link) {
        const href = (n as HTMLAnchorElement).getAttribute('href') ?? '';
        if (href.startsWith('#')) { out += this.runs(n, g); continue; }
        const id = this.rel('hyperlink', (n as HTMLAnchorElement).href, true);
        out += `<w:hyperlink r:id="${id}">${this.runs(n, { ...g, link: href })}</w:hyperlink>`;
        continue;
      }
      out += this.runs(n, g);
    }
    return out;
  }

  run(text: string, f: Fmt): string {
    if (!text) return '';
    const pr = [
      f.b && '<w:b/>', f.i && '<w:i/>', f.s && '<w:strike/>',
      f.code && '<w:rFonts w:ascii="Menlo" w:hAnsi="Menlo" w:cs="Menlo"/>',
      f.code && !f.color && !f.link && '<w:shd w:val="clear" w:color="auto" w:fill="F0F2F4"/>',
      f.link ? '<w:color w:val="0B5F5C"/><w:u w:val="single"/>' : f.color && `<w:color w:val="${f.color}"/>`,
      f.code && '<w:sz w:val="19"/>',
    ].filter(Boolean).join('');
    // Tabs and line breaks inside a run become Word's own.
    return text.split('\n').map((line, k) => (k ? '<w:r><w:br/></w:r>' : '') + `<w:r>${pr ? `<w:rPr>${pr}</w:rPr>` : ''}<w:t xml:space="preserve">${x(line)}</w:t></w:r>`).join('');
  }

  para(runs: string, pPr = ''): void {
    this.body.push(`<w:p>${pPr ? `<w:pPr>${pPr}</w:pPr>` : ''}${runs}</w:p>`);
  }

  /** A picture from a data URL, scaled to fit the text width. */
  picture(img: HTMLImageElement): string {
    const m = /^data:image\/(png|jpeg);base64,(.*)$/.exec(img.getAttribute('src') ?? '');
    if (!m) return this.run(img.alt ? `[${img.alt}]` : '', { i: true });
    const ext = m[1] === 'jpeg' ? 'jpg' : 'png';
    const name = `image${++this.picN}.${ext}`;
    this.media.push({ name, data: Uint8Array.from(atob(m[2]), c => c.charCodeAt(0)) });
    const id = this.rel('image', `media/${name}`);
    const w0 = Number(img.getAttribute('width')) || 600, h0 = Number(img.getAttribute('height')) || 400;
    // The text width in pixels; a pixel is 9525 EMU at 96 dpi.
    const k = Math.min(1, TEXT_W / 15 / w0);
    const cx = Math.round(w0 * k * 9525), cy = Math.round(h0 * k * 9525);
    const n = this.picN;
    return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${n}" name="Picture ${n}" descr="${x(img.alt || '')}"/>`
      + `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">`
      + `<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${n}" name="${name}"/><pic:cNvPicPr/></pic:nvPicPr>`
      + `<pic:blipFill><a:blip r:embed="${id}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>`
      + `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic>`
      + `</a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
  }

  /** Write each block of a container, in order. */
  blocks(box: Element, ctx: { list?: { ordered: boolean; level: number }; quote?: boolean } = {}): void {
    const quote = ctx.quote ? '<w:pStyle w:val="Quote"/>' : '';
    // Loose inline content between blocks (inside a list item) gathers into one paragraph.
    let loose = '';
    const flush = () => { if (loose.trim()) this.para(loose, quote); loose = ''; };
    for (const n of box.childNodes) {
      if (n.nodeType === Node.TEXT_NODE) { if (n.textContent?.trim()) loose += this.run(n.textContent, {}); continue; }
      if (!(n instanceof HTMLElement) || n.hidden) continue;
      const t = n.tagName;
      if (/^H[1-6]$/.test(t)) { flush(); this.para(this.runs(n), `<w:pStyle w:val="Heading${t[1]}"/>`); continue; }
      if (t === 'P') { flush(); this.para(this.runs(n), quote); continue; }
      if (t === 'UL' || t === 'OL') { flush(); this.list(n, t === 'OL', (ctx.list?.level ?? -1) + 1, ctx.quote); continue; }
      if (t === 'BLOCKQUOTE') { flush(); this.blocks(n, { quote: true }); continue; }
      if (t === 'HR') { flush(); this.para('', '<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="C5D2D8"/></w:pBdr>'); continue; }
      if (t === 'TABLE') { flush(); this.table(n as HTMLTableElement); continue; }
      if (t === 'PRE') { flush(); this.code(n); continue; }
      if (t === 'IMG') { flush(); this.para(this.picture(n as HTMLImageElement), '<w:jc w:val="center"/>'); continue; }
      if (/^(STRONG|EM|B|I|CODE|A|SPAN|DEL|S|BR|INPUT)$/.test(t)) { const s = document.createElement('span'); s.append(n.cloneNode(true)); loose += this.runs(s); continue; }
      flush();
      this.blocks(n, ctx);
    }
    flush();
  }

  list(ul: HTMLElement, ordered: boolean, level: number, quote?: boolean): void {
    const numId = ordered ? 2 : 1;
    for (const li of ul.children) {
      if (li.tagName !== 'LI' || (li as HTMLElement).hidden) continue;
      // The item's own text is its first paragraph; nested lists and blocks follow it.
      const lead = document.createElement('div');
      const rest: Element[] = [];
      for (const c of [...li.childNodes]) {
        if (c instanceof HTMLElement && /^(UL|OL|PRE|TABLE|BLOCKQUOTE|DIV)$/.test(c.tagName)) rest.push(c);
        else if (c instanceof HTMLElement && c.tagName === 'P' && lead.childNodes.length) rest.push(c);
        else lead.append(c.cloneNode(true));
      }
      const p = lead.querySelector(':scope > p');
      this.para(this.runs(p ?? lead), `<w:pStyle w:val="ListParagraph"/><w:numPr><w:ilvl w:val="${Math.min(level, 8)}"/><w:numId w:val="${numId}"/></w:numPr>`);
      for (const c of rest) {
        if (c.tagName === 'UL' || c.tagName === 'OL') this.list(c as HTMLElement, c.tagName === 'OL', level + 1, quote);
        else { const box = document.createElement('div'); box.append(c.cloneNode(true)); this.blocks(box, { list: { ordered, level }, quote }); }
      }
    }
  }

  code(pre: HTMLElement): void {
    const lines = pre.querySelectorAll(':scope > .fe-md-l');
    const rows: Node[] = lines.length ? [...lines] : [pre];
    for (const row of rows) {
      const clone = row.cloneNode(true) as HTMLElement;
      // Each line is its own paragraph; the newline that ends it is not a break.
      const last = clone.lastChild;
      if (last?.nodeType === Node.TEXT_NODE) last.textContent = last.textContent!.replace(/\n$/, '');
      // The Code style sets the font and shading; runs only carry token colours.
      this.para(this.runs(clone) || '<w:r><w:t></w:t></w:r>', '<w:pStyle w:val="Code"/>');
    }
  }

  table(t: HTMLTableElement): void {
    const rows = [...t.rows].filter(r => !r.hidden);
    const cols = Math.max(1, ...rows.map(r => r.cells.length));
    // Columns share the text width by how much they hold, so a short id column stays narrow.
    const need = Array.from({ length: cols }, (_x, k) => Math.min(60, Math.max(4, ...rows.map(r => (r.cells[k]?.textContent ?? '').trim().length))));
    const sum = need.reduce((a, b) => a + b, 0);
    const widths = need.map(n => Math.floor(TEXT_W * n / sum));
    // Borders and width sit on the table itself too, for readers that skip table styles.
    const out = [`<w:tbl><w:tblPr><w:tblStyle w:val="Grid"/><w:tblW w:w="${TEXT_W}" w:type="dxa"/>${BORDERS}<w:tblLayout w:type="fixed"/><w:tblLook w:val="04A0" w:firstRow="1"/></w:tblPr><w:tblGrid>${widths.map(w => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>`];
    rows.forEach(r => {
      const head = r.parentElement?.tagName === 'THEAD';
      out.push(`<w:tr>${head ? '<w:trPr><w:tblHeader/></w:trPr>' : ''}`);
      for (const [k, c] of [...r.cells].entries()) {
        out.push(`<w:tc><w:tcPr><w:tcW w:w="${widths[k]}" w:type="dxa"/>${head ? '<w:shd w:val="clear" w:color="auto" w:fill="EEF2F4"/>' : ''}</w:tcPr><w:p>${this.runs(c, { b: head })}</w:p></w:tc>`);
      }
      for (let k = r.cells.length; k < cols; k++) out.push('<w:tc><w:p/></w:tc>');
      out.push('</w:tr>');
    });
    out.push('</w:tbl>');
    this.body.push(out.join(''));
    // Word needs a paragraph between two tables, and after a table that ends a cell.
    this.para('');
  }
}

/** The width text runs across: a US Letter page less 0.6 inch margins, in twentieths of a point. */
const TEXT_W = 12240 - 2 * 864;

const BORDERS = `<w:tblBorders>${['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(s => `<w:${s} w:val="single" w:sz="4" w:space="0" w:color="D6DDE2"/>`).join('')}</w:tblBorders>`;

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="${W_NS}">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="22"/><w:color w:val="1A1A1A"/></w:rPr></w:rPrDefault>
<w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/></w:rPr></w:style>
${[[1, 36], [2, 30], [3, 26], [4, 23], [5, 22], [6, 22]].map(([n, sz]) => `<w:style w:type="paragraph" w:styleId="Heading${n}"><w:name w:val="heading ${n}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="${n <= 2 ? 360 : 240}" w:after="120"/><w:outlineLvl w:val="${n - 1}"/></w:pPr><w:rPr><w:b/><w:sz w:val="${sz}"/>${n >= 5 ? '<w:color w:val="4A5A64"/>' : ''}</w:rPr></w:style>`).join('\n')}
<w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="60"/><w:contextualSpacing/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/><w:basedOn w:val="Normal"/><w:pPr><w:pBdr><w:left w:val="single" w:sz="18" w:space="8" w:color="C5D2D8"/></w:pBdr><w:ind w:left="240"/></w:pPr><w:rPr><w:color w:val="4A5A64"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Code"><w:name w:val="Code"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/><w:shd w:val="clear" w:color="auto" w:fill="F3F5F7"/><w:ind w:left="120" w:right="120"/></w:pPr><w:rPr><w:rFonts w:ascii="Menlo" w:hAnsi="Menlo" w:cs="Menlo"/><w:sz w:val="19"/></w:rPr></w:style>
<w:style w:type="table" w:styleId="Grid"><w:name w:val="Table Grid"/><w:tblPr>${BORDERS}<w:tblCellMar><w:top w:w="60" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="60" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr><w:pPr><w:spacing w:after="0"/></w:pPr></w:style>
</w:styles>`;

const level = (ordered: boolean, i: number) => {
  const bullets = ['•', '◦', '▪'];
  const fmt = ordered ? ['decimal', 'lowerLetter', 'lowerRoman'][i % 3] : 'bullet';
  const text = ordered ? `%${i + 1}.` : bullets[i % 3];
  return `<w:lvl w:ilvl="${i}"><w:start w:val="1"/><w:numFmt w:val="${fmt}"/><w:lvlText w:val="${text}"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="${360 * (i + 1) + 360}" w:hanging="360"/></w:pPr></w:lvl>`;
};
const NUMBERING = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="${W_NS}">
<w:abstractNum w:abstractNumId="0">${Array.from({ length: 9 }, (_, i) => level(false, i)).join('')}</w:abstractNum>
<w:abstractNum w:abstractNumId="1">${Array.from({ length: 9 }, (_, i) => level(true, i)).join('')}</w:abstractNum>
<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
<w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num>
</w:numbering>`;

/** Write the document held in `root` as a .docx file. */
export function toDocx(root: HTMLElement, title: string): Blob {
  const w = new Writer();
  w.blocks(root);
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="${W_NS}" xmlns:r="${R_NS}" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><w:body>${w.body.join('')}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="864" w:right="864" w:bottom="864" w:left="864" w:header="432" w:footer="432" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const pkg = 'http://schemas.openxmlformats.org/package/2006';
  const ct = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="${pkg}/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpg" ContentType="image/jpeg"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`;
  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="${pkg}/relationships"><Relationship Id="rId1" Type="${R_NS}/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="${pkg}/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`;
  const docRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="${pkg}/relationships"><Relationship Id="rId1" Type="${R_NS}/styles" Target="styles.xml"/><Relationship Id="rId2" Type="${R_NS}/numbering" Target="numbering.xml"/>${w.rels.join('')}</Relationships>`;
  const core = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="${pkg}/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${x(title)}</dc:title><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString().replace(/\.\d+Z$/, 'Z')}</dcterms:created></cp:coreProperties>`;
  return zip([
    { name: '[Content_Types].xml', data: ct },
    { name: '_rels/.rels', data: rootRels },
    { name: 'word/document.xml', data: doc },
    { name: 'word/styles.xml', data: STYLES },
    { name: 'word/numbering.xml', data: NUMBERING },
    { name: 'word/_rels/document.xml.rels', data: docRels },
    { name: 'docProps/core.xml', data: core },
    ...w.media.map(m => ({ name: `word/media/${m.name}`, data: m.data })),
  ], 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
}
