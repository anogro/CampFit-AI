const HTTP_PREFIX = /^https?:\/\//i
const WWW_PREFIX = /^www\./i
const URL_CANDIDATE = /(?<![A-Za-z0-9_@])(?:https?:\/\/|www\.)[^\s<>"'“”‘’)\]}。！？，、；]+/giu
const LEADING_BOUNDARY = /^[\s([\{"'“”‘’<]+/u
const TRAILING_PUNCTUATION = new Set([".", ",", ";", ":", "!", "?", "。", "！", "？", "，", "、", "；", "：", "…", "\"", "'", "“", "”", "‘", "’", "》", "〉"])

export function sanitizeEvidenceUrl(rawUrl: string): string | null {
  const stripped = stripBoundaryPunctuation(rawUrl)
  const candidate = WWW_PREFIX.test(stripped) ? `https://${stripped}` : stripped
  if (!HTTP_PREFIX.test(candidate)) return null

  let parsed: URL
  try {
    parsed = new URL(candidate)
  } catch {
    return null
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null
  if (parsed.hostname.length === 0 || /\s/u.test(parsed.hostname)) return null

  parsed.username = ""
  parsed.password = ""
  parsed.search = ""
  parsed.hash = ""
  if ((parsed.protocol === "http:" && parsed.port === "80") || (parsed.protocol === "https:" && parsed.port === "443")) {
    parsed.port = ""
  }

  const hostname = parsed.hostname.toLowerCase()
  const authority = parsed.port.length > 0 ? `${hostname}:${parsed.port}` : hostname
  const pathname = parsed.pathname.replace(/\/+$/u, "")
  return `${parsed.protocol}//${authority}${pathname}`
}

export function extractAndSanitizeUrls(text: string): string[] {
  const canonicalByLocation = new Map<string, string>()
  for (const match of text.matchAll(URL_CANDIDATE)) {
    if (isEmbeddedInAnotherScheme(text, match.index ?? 0)) continue
    const sanitized = sanitizeEvidenceUrl(match[0])
    if (sanitized === null) continue

    const locationKey = sanitized.replace(/^https?:\/\//u, "")
    const existing = canonicalByLocation.get(locationKey)
    if (existing === undefined || (existing.startsWith("http://") && sanitized.startsWith("https://"))) {
      canonicalByLocation.set(locationKey, sanitized)
    }
  }
  return [...canonicalByLocation.values()].sort(compareCodeUnits)
}

function stripBoundaryPunctuation(value: string): string {
  let candidate = value.trim().replace(LEADING_BOUNDARY, "")
  let changed = true
  while (changed && candidate.length > 0) {
    changed = false
    const finalCharacter = candidate.at(-1)
    if (finalCharacter !== undefined && TRAILING_PUNCTUATION.has(finalCharacter)) {
      candidate = candidate.slice(0, -1)
      changed = true
      continue
    }
    if (finalCharacter !== undefined && isUnmatchedClosingBoundary(candidate, finalCharacter)) {
      candidate = candidate.slice(0, -1)
      changed = true
    }
  }
  return candidate
}

function isUnmatchedClosingBoundary(value: string, finalCharacter: string): boolean {
  const openingByClosing: Readonly<Record<string, string>> = { ")": "(", "]": "[", "}": "{", ">": "<" }
  const opening = openingByClosing[finalCharacter]
  if (opening === undefined) return false
  return occurrences(value, finalCharacter) > occurrences(value, opening)
}

function occurrences(value: string, character: string): number {
  return [...value].filter((candidate) => candidate === character).length
}

function isEmbeddedInAnotherScheme(text: string, index: number): boolean {
  return /[a-z][a-z0-9+.-]*:$/iu.test(text.slice(Math.max(0, index - 16), index))
}

function compareCodeUnits(left: string, right: string): number {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}
