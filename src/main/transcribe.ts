import type { Settings } from '@shared/types'
import { getSettings, getTranscribeKey } from './store'

function endpoint(settings: Settings): string {
  const base = (settings.transcribeBaseUrl || 'https://api.openai.com/v1').trim().replace(/\/+$/, '')
  return `${base}/audio/transcriptions`
}

function authError(status: number, body: string): Error {
  if (status === 401 || status === 403) return new Error('The transcription endpoint rejected the API key. Check it in Settings.')
  if (status === 404) return new Error('That endpoint has no /audio/transcriptions route. Check the base URL in Settings.')
  if (status === 429) return new Error('The transcription endpoint is rate limiting this key. Wait a moment.')
  return new Error(`The transcription endpoint returned ${status}. ${body.slice(0, 160)}`)
}

/**
 * Transcribes one audio chunk (webm/opus from the live room's "share audio") against an
 * OpenAI-compatible /audio/transcriptions endpoint configured in Settings. The audio and
 * key never touch the renderer: the main process holds both.
 */
export async function transcribeChunk(audio: Uint8Array, language: string): Promise<string> {
  const settings = getSettings()
  const key = getTranscribeKey()
  if (!key) throw new Error('Add a transcription API key in Settings to transcribe shared audio.')

  const form = new FormData()
  const view = new Uint8Array(audio.byteLength)
  view.set(audio)
  form.append('file', new Blob([view], { type: 'audio/webm' }), 'chunk.webm')
  form.append('model', settings.transcribeModel || 'whisper-1')
  form.append('response_format', 'json')
  if (language && language.length === 2) form.append('language', language)

  let response: Response
  try {
    response = await fetch(endpoint(settings), {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
      body: form,
      signal: AbortSignal.timeout(45_000)
    })
  } catch (err) {
    if (err instanceof Error && err.name === 'TimeoutError') {
      throw new Error('The transcription endpoint took too long to respond.')
    }
    throw new Error('Could not reach the transcription endpoint. Check the base URL and your connection.')
  }

  if (!response.ok) throw authError(response.status, await response.text().catch(() => ''))
  const result = (await response.json()) as { text?: string }
  return (result.text ?? '').trim()
}

/** Verifies the configured endpoint and key by listing models. */
export async function testTranscribeKey(): Promise<{ ok: boolean; message: string }> {
  const key = getTranscribeKey()
  if (!key) return { ok: false, message: 'No transcription key saved.' }
  const settings = getSettings()
  const base = (settings.transcribeBaseUrl || 'https://api.openai.com/v1').trim().replace(/\/+$/, '')
  try {
    const response = await fetch(`${base}/models`, {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(15_000)
    })
    if (!response.ok) return { ok: false, message: authError(response.status, await response.text().catch(() => '')).message }
    const models = (await response.json()) as { data?: { id: string }[] }
    const count = Array.isArray(models.data) ? models.data.length : 0
    return { ok: true, message: `Connected. ${count} models available at ${base}.` }
  } catch {
    return { ok: false, message: 'Could not reach the endpoint. Check the base URL and your connection.' }
  }
}
