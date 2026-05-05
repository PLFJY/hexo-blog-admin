export function safeGetLocalStorage(key: string) {
  try {
    if (typeof window === 'undefined') return null
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

export function safeSetLocalStorage(key: string, value: string) {
  try {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(key, value)
  } catch {
    // Some browser privacy modes or extension sandboxes block localStorage.
  }
}

export function safeRemoveLocalStorage(key: string) {
  try {
    if (typeof window === 'undefined') return
    window.localStorage.removeItem(key)
  } catch {
    // Some browser privacy modes or extension sandboxes block localStorage.
  }
}
