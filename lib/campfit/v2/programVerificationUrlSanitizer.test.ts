import { describe, expect, it } from "vitest"
import {
  extractAndSanitizeUrls,
  sanitizeEvidenceUrl,
} from "@/lib/campfit/v2/programVerificationUrlSanitizer"

describe("program verification URL sanitizer", () => {
  it("Given HTTP, HTTPS, and www addresses When sanitizing Then protocols and hostnames are canonical", () => {
    expect(sanitizeEvidenceUrl("https://Example.COM/program/")).toBe("https://example.com/program")
    expect(sanitizeEvidenceUrl("http://Example.COM:80/")).toBe("http://example.com")
    expect(sanitizeEvidenceUrl("www.Example.COM/camp/")).toBe("https://www.example.com/camp")
  })

  it("Given credentials, tokens, fragments, and a default port When sanitizing Then sensitive URL parts are removed", () => {
    expect(sanitizeEvidenceUrl("https://user:password@Example.COM:443/path/?token=secret#private"))
      .toBe("https://example.com/path")
    expect(sanitizeEvidenceUrl("https://user:password@/")).toBeNull()
  })

  it("Given URLs inside English and Korean punctuation When extracting Then only clean addresses remain", () => {
    const text = "공식 주소는 (https://Example.com/path/?token=secret#section), 참고는 [www.Example.org/info/]입니다。"

    expect(extractAndSanitizeUrls(text)).toEqual([
      "https://example.com/path",
      "https://www.example.org/info",
    ])
    expect(sanitizeEvidenceUrl("(https://Example.com/path/);：。"))
      .toBe("https://example.com/path")
  })

  it("Given forbidden schemes, email, and phone text When sanitizing Then nothing is extracted", () => {
    const text = [
      "mailto:parent@example.com",
      "ftp://example.com/file",
      "javascript:alert(1)",
      "data:text/plain,secret",
      "file:///tmp/secret",
      "blob:https://example.com/id",
      "parent@www.example.com",
      "+82-10-1234-5678",
    ].join(" ")

    expect(extractAndSanitizeUrls(text)).toEqual([])
    for (const value of ["mailto:a@example.com", "ftp://example.com", "javascript:alert(1)", "data:text/plain,x", "file:///tmp/x", "blob:https://example.com/id"]) {
      expect(sanitizeEvidenceUrl(value)).toBeNull()
    }
  })

  it("Given duplicate HTTP and HTTPS forms When extracting Then HTTPS wins for the same host and path", () => {
    expect(extractAndSanitizeUrls("http://example.com/path https://EXAMPLE.com/path/ http://example.com/path?x=1"))
      .toEqual(["https://example.com/path"])
  })

  it("Given multiple repeated URLs When extracting Then output is unique and stably sorted", () => {
    expect(extractAndSanitizeUrls("https://b.example.com/z https://a.example.com/y https://b.example.com/z#again"))
      .toEqual(["https://a.example.com/y", "https://b.example.com/z"])
  })
})
