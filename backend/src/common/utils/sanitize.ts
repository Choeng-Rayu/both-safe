// Strip ASCII control chars except common whitespace, then trim and clamp.
export function sanitizeText(input?: string | null, max = 2000): string | null {
  if (input == null) return null;
  let out = '';
  const s = String(input);
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    // keep tab(9), LF(10), CR(13); drop other 0x00-0x1F and 0x7F
    if (c === 9 || c === 10 || c === 13) {
      out += s[i];
    } else if (c < 32 || c === 127) {
      continue;
    } else {
      out += s[i];
    }
  }
  out = out.trim();
  if (!out) return null;
  return out.length > max ? out.slice(0, max) : out;
}
