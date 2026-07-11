import { describe, expect, it, vi } from "vitest"
import {
  assertExpectedSupabaseProject,
  createGuardedWriteContext,
  extractSupabaseProjectRef,
} from "@/lib/campfit/v2/programQualityProjectGuard"

describe("programQualityProjectGuard", () => {
  it("extracts only the project ref from an HTTPS Supabase hostname", () => {
    expect(extractSupabaseProjectRef("  HTTPS://ExampleRef.SUPABASE.CO/rest/v1?ignored=yes  ")).toBe("exampleref")
  })

  it("trims the expected ref and requires an exact case-sensitive match", () => {
    expect(assertExpectedSupabaseProject({
      supabaseUrl: "https://projectref.supabase.co",
      expectedProjectRef: "  projectref  ",
    })).toEqual({ projectRef: "projectref" })

    expect(() => assertExpectedSupabaseProject({
      supabaseUrl: "https://projectref.supabase.co",
      expectedProjectRef: "PROJECTREF",
    })).toThrow("Unexpected Supabase project ref")
  })

  it("rejects a missing expected ref, invalid URLs, non-HTTPS URLs, and other domains", () => {
    expect(() => assertExpectedSupabaseProject({
      supabaseUrl: "https://projectref.supabase.co",
      expectedProjectRef: "   ",
    })).toThrow("Expected Supabase project ref is required")
    expect(() => extractSupabaseProjectRef("not-a-url")).toThrow("Invalid Supabase URL")
    expect(() => extractSupabaseProjectRef("http://projectref.supabase.co")).toThrow("Invalid Supabase URL")
    expect(() => extractSupabaseProjectRef("https://projectref.example.com")).toThrow("Invalid Supabase project host")
    expect(() => extractSupabaseProjectRef("https://nested.projectref.supabase.co")).toThrow("Invalid Supabase project host")
  })

  it("does not create a mutation dependency until the project ref passes", () => {
    const createMutationDependency = vi.fn(() => ({ insert: vi.fn() }))

    expect(() => createGuardedWriteContext({
      supabaseUrl: "https://wrongref.supabase.co",
      expectedProjectRef: "expectedref",
      createMutationDependency,
    })).toThrow("Unexpected Supabase project ref")
    expect(createMutationDependency).not.toHaveBeenCalled()

    const context = createGuardedWriteContext({
      supabaseUrl: "https://expectedref.supabase.co",
      expectedProjectRef: "expectedref",
      createMutationDependency,
    })
    expect(context.projectRef).toBe("expectedref")
    expect(context.mutation).toBeDefined()
    expect(createMutationDependency).toHaveBeenCalledTimes(1)
  })

  it("never includes the full URL or credential-like query values in errors", () => {
    const fullUrl = "https://wrongref.supabase.co/rest/v1?apikey=super-secret-service-role-key"

    let message = ""
    try {
      assertExpectedSupabaseProject({ supabaseUrl: fullUrl, expectedProjectRef: "expectedref" })
    } catch (error) {
      message = error instanceof Error ? error.message : String(error)
    }

    expect(message).not.toContain(fullUrl)
    expect(message).not.toContain("super-secret-service-role-key")
    expect(message).not.toContain("apikey")
  })
})
