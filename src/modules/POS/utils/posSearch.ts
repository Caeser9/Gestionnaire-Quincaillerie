export function extractProductSearchResults(payload: unknown): any[] {
  if (!payload) return []
  if (Array.isArray(payload)) return payload
  if (typeof payload === 'object' && payload !== null && 'data' in payload) {
    // @ts-ignore
    const data = (payload as any).data
    if (Array.isArray(data)) return data
  }
  return []
}
