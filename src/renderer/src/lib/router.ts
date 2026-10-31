import { useEffect, useState } from 'react'

export type Route =
  | { name: 'dashboard' }
  | { name: 'new' }
  | { name: 'edit'; id: string }
  | { name: 'practice'; id: string }
  | { name: 'live'; id: string }
  | { name: 'summary'; id: string }
  | { name: 'library' }
  | { name: 'tailor' }
  | { name: 'settings' }
  | { name: 'toast' }
  | { name: 'companion' }
  | { name: 'coach' }

export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  const [first, id, sub] = parts
  switch (first) {
    case 'new':
      return { name: 'new' }
    case 'library':
      return { name: 'library' }
    case 'tailor':
      return { name: 'tailor' }
    case 'settings':
      return { name: 'settings' }
    case 'toast':
      return { name: 'toast' }
    case 'companion':
      return { name: 'companion' }
    case 'coach':
      return { name: 'coach' }
    case 'session':
      if (!id) break
      if (sub === 'edit') return { name: 'edit', id }
      if (sub === 'summary') return { name: 'summary', id }
      if (sub === 'live') return { name: 'live', id }
      return { name: 'practice', id }
  }
  return { name: 'dashboard' }
}

export const href = {
  dashboard: '#/',
  new: '#/new',
  library: '#/library',
  tailor: '#/tailor',
  settings: '#/settings',
  practice: (id: string) => `#/session/${id}`,
  live: (id: string) => `#/session/${id}/live`,
  edit: (id: string) => `#/session/${id}/edit`,
  summary: (id: string) => `#/session/${id}/summary`
}

export function navigate(to: string): void {
  window.location.hash = to
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(window.location.hash))
  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash))
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}
