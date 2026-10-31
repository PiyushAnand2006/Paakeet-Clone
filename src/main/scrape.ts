import type { JobPostFields } from '@shared/types'
import { friendlyError, getModelClient } from './ai'

const MAX_BYTES = 1_500_000
const FETCH_TIMEOUT_MS = 15_000

/** Pull the readable text out of a job-posting page: drop scripts, styles and tags. */
function htmlToText(html: string): string {
  const withoutHidden = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|svg|head)[\s\S]*?<\/\1>/gi, ' ')
  const withBreaks = withoutHidden
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr)[^>]*>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
  const text = withBreaks
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;|&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return text.slice(0, 24_000)
}

export async function scrapeJobPost(url: string): Promise<JobPostFields> {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error('That does not look like a URL. Paste the full link, starting with https://')
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only http and https links are supported.')
  }

  let pageText: string
  try {
    const response = await fetch(parsed, {
      redirect: 'follow',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        // Some job boards serve an empty shell without a browser-ish user agent.
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml'
      }
    })
    if (!response.ok) throw new Error(`The site responded with ${response.status}.`)
    const limited = await response.text()
    pageText = htmlToText(limited.slice(0, MAX_BYTES))
  } catch (err) {
    if (err instanceof Error && err.name === 'TimeoutError') {
      throw new Error('The site took too long to respond. Try pasting the description instead.')
    }
    throw new Error('Could not load that page. Check the link, or paste the description instead.')
  }

  if (pageText.length < 200) {
    throw new Error('That page did not contain a readable posting. Paste the job description instead.')
  }

  try {
    const client = getModelClient('claude-haiku-5-5')
    const result = await client.messages.create({
      model: 'claude-haiku-5-5',
      max_tokens: 4000,
      system:
        'You extract structured data from job postings. From the page text, pull the job title, the company name, ' +
        'and the full job description (responsibilities, requirements, nice-to-haves). Company is the employer\'s ' +
        'name as shown in the posting, not the job board. If something is genuinely not present, return an empty ' +
        'string for it. Reply with JSON only.',
      messages: [
        {
          role: 'user',
          content: `Page URL: ${parsed.href}\n\nPage text:\n${pageText}`
        }
      ]
    })
    const block = result.content.find((c) => c.type === 'text')
    const match = block && 'text' in block ? block.text.match(/\{[\s\S]*\}/) : null
    if (!match) throw new Error('No JSON in response')
    const fields = JSON.parse(match[0]) as Partial<JobPostFields>
    return {
      company: typeof fields.company === 'string' ? fields.company : '',
      role: typeof fields.role === 'string' ? fields.role : '',
      jobDescription: typeof fields.jobDescription === 'string' ? fields.jobDescription : ''
    }
  } catch (err) {
    throw new Error(
      `The page loaded but the fields could not be extracted. ${friendlyError(err)} You can paste the description instead.`
    )
  }
}
