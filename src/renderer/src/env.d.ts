/// <reference types="vite/client" />
import type { RehearseApi } from '../../preload/index'

declare global {
  interface Window {
    rehearse: RehearseApi
  }
}

export {}
