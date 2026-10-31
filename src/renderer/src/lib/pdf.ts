const PRINT_CSS = `
  * { box-sizing: border-box; }
  body { font: 10.5pt/1.55 'Segoe UI', system-ui, -apple-system, sans-serif; color: #18181b; margin: 0; }
  h1 { font-size: 20pt; margin: 0 0 4pt; letter-spacing: -0.02em; }
  h2 { font-size: 12pt; margin: 14pt 0 4pt; padding-bottom: 3pt; border-bottom: 1px solid #e4e4e7; }
  h3 { font-size: 10.5pt; margin: 10pt 0 2pt; }
  p, ul, ol { margin: 4pt 0; }
  ul, ol { padding-left: 14pt; }
  li { margin: 1.5pt 0; }
  hr { border: 0; border-top: 1px solid #e4e4e7; margin: 14pt 0; }
  a { color: #15803d; }
  code { font-family: Consolas, monospace; font-size: 9pt; background: #f4f4f5; padding: 0 3px; border-radius: 3px; }
  pre { background: #f4f4f5; padding: 8pt; border-radius: 4px; overflow: hidden; white-space: pre-wrap; }
  pre code { background: none; padding: 0; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #e4e4e7; padding: 3pt 5pt; text-align: left; }
  h1, h2, h3 { break-after: avoid; }
  li, tr { break-inside: avoid; }
`

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

/** Export the rendered contents of `element` as a clean, printable PDF. */
export async function exportElementAsPdf(element: HTMLElement, title: string): Promise<string | null> {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>${PRINT_CSS}</style></head><body>${element.innerHTML}</body></html>`
  return window.rehearse.exportPdf(html, title)
}
