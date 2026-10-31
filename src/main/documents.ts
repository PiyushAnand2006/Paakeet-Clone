import { readFile, stat } from 'node:fs/promises'
import { basename, extname } from 'node:path'
import { extractText } from 'unpdf'
import mammoth from 'mammoth'
import type { ImportResult, LibraryKind } from '@shared/types'
import { addLibraryItem } from './store'

export const SUPPORTED_EXTENSIONS = ['pdf', 'docx', 'txt', 'md']
const MAX_BYTES = 15 * 1024 * 1024

async function extract(filePath: string): Promise<string> {
  const ext = extname(filePath).slice(1).toLowerCase()
  const buffer = await readFile(filePath)
  switch (ext) {
    case 'pdf': {
      const { text } = await extractText(new Uint8Array(buffer), { mergePages: true })
      return text
    }
    case 'docx':
      return (await mammoth.extractRawText({ buffer })).value
    case 'txt':
    case 'md':
      return buffer.toString('utf8')
    default:
      throw new Error(`Unsupported file type .${ext}`)
  }
}

/** Collapse the whitespace noise PDF extraction leaves behind, keeping paragraph breaks. */
function tidy(text: string): string {
  return text
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export async function importFiles(kind: LibraryKind, paths: string[]): Promise<ImportResult> {
  const result: ImportResult = { added: [], failed: [] }
  for (const filePath of paths) {
    const fileName = basename(filePath)
    try {
      const { size } = await stat(filePath)
      if (size > MAX_BYTES) throw new Error('File is larger than 15 MB.')
      const text = tidy(await extract(filePath))
      if (text.length < 40) throw new Error('No readable text found (scanned PDFs need OCR first).')
      result.added.push(
        addLibraryItem({
          kind,
          name: fileName.replace(/\.[^.]+$/, ''),
          fileName,
          text,
          sizeBytes: size
        })
      )
    } catch (err) {
      result.failed.push({ fileName, reason: err instanceof Error ? err.message : String(err) })
    }
  }
  return result
}
