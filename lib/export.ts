import { Document, Packer, Paragraph, HeadingLevel } from 'docx';
import { saveAs } from 'file-saver';

export function downloadText(name: string, text: string, mime = 'text/plain') {
  saveAs(new Blob([text], { type: `${mime};charset=utf-8` }), name);
}

export function exportMarkdown(md: string, name = 'prd.md') {
  downloadText(name, md, 'text/markdown');
}

export function exportJson(value: unknown, name = 'prd.json') {
  downloadText(name, JSON.stringify(value, null, 2), 'application/json');
}

export async function exportDocx(md: string, name = 'prd.docx') {
  const children = md.split(/\n+/).filter(Boolean).map((line) => {
    if (line.startsWith('# ')) return new Paragraph({ text: line.slice(2), heading: HeadingLevel.TITLE });
    if (line.startsWith('## ')) return new Paragraph({ text: line.slice(3), heading: HeadingLevel.HEADING_1 });
    if (line.startsWith('### ')) return new Paragraph({ text: line.slice(4), heading: HeadingLevel.HEADING_2 });
    if (line.startsWith('- ')) return new Paragraph({ text: line.slice(2), bullet: { level: 0 } });
    return new Paragraph(line);
  });
  const doc = new Document({ sections: [{ children }] });
  saveAs(await Packer.toBlob(doc), name);
}

export async function exportPdf(element: HTMLElement, name = 'prd.pdf') {
  if (typeof window === 'undefined') throw new Error('PDF export is browser-only.');
  const module = await import('html2pdf.js');
  const html2pdf = module.default;
  await html2pdf().set({
    margin: 0.35,
    filename: name,
    image: { type: 'jpeg', quality: 0.96 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' },
    pagebreak: { mode: ['css', 'legacy'] }
  }).from(element).save();
}
