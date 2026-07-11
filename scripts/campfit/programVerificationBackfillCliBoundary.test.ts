import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { createProgramVerificationBackfillCliAdapterFromEnvironment } from "@/scripts/campfit/programVerificationBackfillCliAdapter"

const workspaceRoot = process.cwd()

describe("CampFit quality backfill CLI module boundary", () => {
  it("keeps the CLI and its adapter free of Next.js server-only repository imports", () => {
    const combinedCliSource = [
      "scripts/campfit/backfillProgramVerifications.ts",
      "scripts/campfit/programVerificationBackfillCliAdapter.ts",
      "lib/campfit/v2/programVerificationBackfillContracts.ts",
      "lib/campfit/v2/programVerificationBackfillReadCore.ts",
      "lib/campfit/v2/programVerificationBackfill.ts",
    ].map(readWorkspaceFile).join("\n")

    expect(combinedCliSource).not.toContain("programVerificationBackfillRepository")
    expect(combinedCliSource).not.toMatch(/(?:import|require)\s*\(?["']server-only["']/)
    expect(readWorkspaceFile("lib/campfit/v2/programVerificationBackfillRepository.ts"))
      .toContain('import "server-only"')
  })

  it("does not replace the server-only sentinel in the shared Vite config", () => {
    const viteConfig = readWorkspaceFile("vitest.config.ts")

    expect(viteConfig).not.toContain("server-only-node-runtime")
    expect(viteConfig).not.toContain('id === "server-only"')
  })

  it("proves a direct server-only import fails in the plain CLI runtime", async () => {
    await expect(import("server-only")).rejects.toThrow(/cannot be imported|failed to load url server-only/i)
  })

  it("creates only a read adapter when both CLI environment values are present", () => {
    const adapter = createProgramVerificationBackfillCliAdapterFromEnvironment({
      NEXT_PUBLIC_SUPABASE_URL: " https://example.supabase.co ",
      SUPABASE_SERVICE_ROLE_KEY: " test-service-role-key ",
    })

    expect(adapter).not.toBeNull()
    expect(Object.keys(adapter?.readRepository ?? {}).sort()).toEqual([
      "countQualityRowsExact",
      "findExistingDimensionScoresByIds",
      "findExistingEvidenceByIds",
      "findExistingObservationsByIds",
      "findExistingQualitySnapshotsByIds",
      "loadLegacyProgramVerificationsByProgramIds",
      "loadProgramsForBackfill",
    ])
    expect(createProgramVerificationBackfillCliAdapterFromEnvironment({})).toBeNull()
  })

  it("has no application import edge from Next.js source roots into the CLI", () => {
    const applicationFiles = ["app", "components", "lib"]
      .flatMap((directory) => collectTypeScriptFiles(join(workspaceRoot, directory)))
    const importers = applicationFiles.filter((file) => {
      const source = readFileSync(file, "utf8")
      return source.includes("@/scripts/campfit") || source.includes("scripts/campfit/backfillProgramVerifications")
    })

    expect(importers).toEqual([])
  })
})

function readWorkspaceFile(relativePath: string): string {
  return readFileSync(join(workspaceRoot, relativePath), "utf8")
}

function collectTypeScriptFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return collectTypeScriptFiles(path)
    return /\.tsx?$/.test(entry.name) ? [path] : []
  })
}
