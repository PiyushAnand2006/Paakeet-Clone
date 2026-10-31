import { useCallback, useEffect, useRef, useState } from 'react'
import type { AiJob } from '@shared/types'

export type StreamStatus = 'idle' | 'streaming' | 'done' | 'error'

/**
 * Runs one streaming AI job at a time. Text accumulates as deltas arrive; starting a new
 * job, or unmounting, cancels the one in flight so tokens are never wasted on a closed view.
 */
export function useAiStream(onDone?: (text: string) => void) {
  const [text, setText] = useState('')
  const [status, setStatus] = useState<StreamStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const requestRef = useRef<string | null>(null)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  useEffect(() => {
    const off = window.rehearse.ai.onEvent((event) => {
      if (event.requestId !== requestRef.current) return
      switch (event.type) {
        case 'delta':
          setText((t) => t + event.text)
          break
        case 'reset':
          setText('')
          break
        case 'done':
          requestRef.current = null
          setText(event.text)
          setStatus('done')
          onDoneRef.current?.(event.text)
          break
        case 'error':
          requestRef.current = null
          setError(event.message)
          setStatus('error')
          break
      }
    })
    return () => {
      off()
      if (requestRef.current) void window.rehearse.ai.cancel(requestRef.current)
    }
  }, [])

  const cancel = useCallback(() => {
    if (requestRef.current) void window.rehearse.ai.cancel(requestRef.current)
    requestRef.current = null
    setStatus((s) => (s === 'streaming' ? 'idle' : s))
  }, [])

  const start = useCallback(async (job: AiJob) => {
    if (requestRef.current) void window.rehearse.ai.cancel(requestRef.current)
    setText('')
    setError(null)
    setStatus('streaming')
    requestRef.current = await window.rehearse.ai.start(job)
  }, [])

  const reset = useCallback(() => {
    cancel()
    setText('')
    setError(null)
    setStatus('idle')
  }, [cancel])

  return { text, status, error, start, cancel, reset }
}
