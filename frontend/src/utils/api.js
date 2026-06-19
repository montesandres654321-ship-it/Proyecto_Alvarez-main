import usePOSStore from '../store/usePOSStore'

export const apiFetch = async (url, options = {}) => {
  const { token } = usePOSStore.getState()
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...options.headers,
  }
  return fetch(url, { ...options, headers })
}
