/**
 * UTF-8 bytes stored as Latin-1 chars (Facebook export encoding bug) → correct Unicode.
 */
export function fixMojibake(s: string): string {
  if (!s || !/[\x80-\xFF]/.test(s)) return s
  try {
    const bytes = new Uint8Array([...s].map(c => c.charCodeAt(0)))
    return new TextDecoder('utf-8').decode(bytes)
  } catch {
    return s
  }
}
