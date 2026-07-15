import { formatEvaluationReport, runFallbackEvaluation, runLiveEvaluation, runMockEvaluation } from "@/scripts/campfit/v3/counselingEvaluation"

type CliMode = "fallback" | "mock" | "live"

if (process.env["VITEST"] !== "true") await main()

async function main(): Promise<void> {
  const mode = readMode(process.argv.slice(2))
  const json = process.argv.includes("--json")
  const report = mode === "fallback"
    ? await runFallbackEvaluation()
    : mode === "mock"
      ? await runMockEvaluation()
      : await runLiveEvaluation()
  process.stdout.write(`${json ? JSON.stringify(report, null, 2) : formatEvaluationReport(report)}\n`)
  if (mode === "live" && report.live?.status === "FAIL") process.exitCode = 1
}

function readMode(args: readonly string[]): CliMode {
  const value = args.find((arg) => arg.startsWith("--mode="))?.slice("--mode=".length)
  return value === "mock" || value === "live" ? value : "fallback"
}
