import { useEffect, useRef } from 'react'
import type { Route } from '@/lib/router'

const PROBE_INTERVAL_MS = 3000
const PROBE_WINDOW_MS = 700
/** RMS above this counts as "someone is talking into the mic". */
const BUSY_THRESHOLD = 0.035

/**
 * Meeting Detect's sensor side. While enabled and no Rehearse session is open, briefly
 * opens the default microphone every few seconds and reports whether sound is arriving.
 * The main process decides what counts as a meeting (sustained streak + cooldown).
 *
 * This is a best-effort signal: on Windows several apps can share a microphone, so
 * loudness is what we have to work with. It is off by default.
 */
export function useMeetingProbe(enabled: boolean, route: Route): void {
  const activeRef = useRef(false)
  const routeRef = useRef(route)
  routeRef.current = route
  activeRef.current = !['practice', 'live', 'toast', 'companion'].includes(route.name)

  useEffect(() => {
    if (!enabled) return
    let stopped = false
    let ctx: AudioContext | null = null

    async function probe(): Promise<boolean> {
      let stream: MediaStream | null = null
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        ctx = ctx ?? new AudioContext()
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 512
        const source = ctx.createMediaStreamSource(stream)
        source.connect(analyser)
        const buf = new Float32Array(analyser.fftSize)
        const deadline = Date.now() + PROBE_WINDOW_MS
        let peak = 0
        while (Date.now() < deadline && !stopped) {
          analyser.getFloatTimeDomainData(buf)
          let sum = 0
          for (const v of buf) sum += v * v
          peak = Math.max(peak, Math.sqrt(sum / buf.length))
          await new Promise((r) => setTimeout(r, 120))
        }
        source.disconnect()
        return peak > BUSY_THRESHOLD
      } catch {
        return false // mic unavailable or permission denied: report quiet rather than nag
      } finally {
        stream?.getTracks().forEach((t) => t.stop())
      }
    }

    const interval = setInterval(() => {
      if (stopped || !activeRef.current) return
      void probe().then((busy) => {
        if (!stopped) void window.rehearse.meeting.reportActivity(busy)
      })
    }, PROBE_INTERVAL_MS)

    return () => {
      stopped = true
      clearInterval(interval)
      void ctx?.close()
    }
  }, [enabled])
}
