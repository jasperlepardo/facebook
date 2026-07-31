// UTF-8 bytes stored as Latin-1 chars (Facebook export encoding bug) → correct Unicode
function fixMojibake(s: string): string {
  if (!s || !/[\x80-\xFF]/.test(s)) return s
  try {
    const bytes = new Uint8Array([...s].map(c => c.charCodeAt(0)))
    return new TextDecoder('utf-8').decode(bytes)
  } catch { return s }
}

// Facebook Messenger legacy emoji — private-use codepoints → standard Unicode emoji
// Mapped from context analysis of actual message corpus
const MAP: Record<number, string> = {
  // ── Core emotion faces (FE320–FE345) ──────────────────────────────────────
  0xFE322: '😊', // curiosity/soft smile  "nakakacurious"
  0xFE323: '😊', // goodnight smile        "sweet dreams"
  0xFE325: '😊', // gentle smile           standalone
  0xFE327: '😘', // kiss / "ms beautiful"  repeated in romantic greetings
  0xFE32A: '😍', // love-struck            "napanaginipan ko" (dreamt of you)
  0xFE32C: '❤️', // heart                  repeated × 4
  0xFE32D: '😴', // sleepy / goodnight     repeated in "goodnight" messages
  0xFE32F: '🙃', // unsure / mild sass     "ansabe nila?"
  0xFE331: '💪', // determined / striving  "try to improve"
  0xFE332: '🤗', // hug / "sarap hawakan"  repeated in touch context
  0xFE333: '💼', // work                   "werk werk werk"
  0xFE334: '😂', // hard laugh             "wahahahhaha. kaloka"
  0xFE335: '🤗', // hug / happy            "ikaw ang masarap ihug" / "masaya na ako"
  0xFE338: '💕', // love / want to date    "i want to date you. hope we can"
  0xFE33A: '😢', // miss you               "lalo kita namiss hon"
  0xFE33C: '😌', // content / quiet        standalone
  0xFE33D: '😅', // relieved / nervous     alongside happiness emoji
  0xFE33E: '🙏', // hoping / please        "sana nga hon"
  0xFE33F: '🤢', // tummy ache             "sakit ng puson ko"
  0xFE341: '😱', // shocked / scared       "di ah! grabe nanakot pa"
  0xFE344: '🤗', // comfort / cheer up     "please cheer up"
  0xFE345: '🥺', // awww                   "awwww"
  0xFE347: '😢', // sad wait               "wala hon. told you..."
  0xFE354: '😄', // big smile              used near laughter
  0xFE355: '🤣', // rolling laugh          "wahahahhaha. kaloka. suuuure. hahaha"

  // ── Sticker-style emoji (FEB00–FEC20) ────────────────────────────────────
  0xFEB0E: '🎉', // fun place              "ball pit manila is [this]"
  0xFEB0F: '🐱', // cute pet               "omg i want this pet"
  0xFEB13: '💝', // heart ribbon           in heart sequence ❤️ + hearts
  0xFEB14: '💝', // heart ribbon           in heart sequence
  0xFEB15: '💖', // sparkling heart        in heart sequence
  0xFEB16: '💗', // growing heart          in heart sequence
  0xFEB18: '🐶', // dog/pet               with pet emoji
  0xFEB97: '😊', // smile with skin tone   "ahhh ok po"
  0xFEC00: '💕', // pink hearts            "you're my girl"
  0xFEC11: '😲', // surprised              "luh [surprised]"

  // ── Activity / misc (FE5xx) ───────────────────────────────────────────────
  0xFE527: '🎵', // music note             "werk werk werk"
  0xFE538: '💃', // dancing               "werk werk werk"
  0xFE552: '🎶', // music notes            "werk werk werk"

  // ── Rare / one-off ────────────────────────────────────────────────────────
  0xFE822: '😍', // love                  standalone "󾠧󾠧󾠧"
  0xFE827: '😘', // kiss                  standalone "󾠧󾠧󾠧"
}

const PUA_BMP_LO  = 0xE000
const PUA_BMP_HI  = 0xF8FF
const PUA_SUPP_LO = 0xF0000
const PUA_SUPP_HI = 0xFFFFF

export function mapFbEmoji(text: string): string {
  if (!text) return text
  text = fixMojibake(text)
  const chars = [...text] // iterate by codepoint, not UTF-16 unit
  let out = ''
  for (const ch of chars) {
    const cp = ch.codePointAt(0)!
    if ((cp >= PUA_BMP_LO && cp <= PUA_BMP_HI) || (cp >= PUA_SUPP_LO && cp <= PUA_SUPP_HI)) {
      out += MAP[cp] ?? '' // known → emoji, unknown → strip silently
    } else {
      out += ch
    }
  }
  return out
}
