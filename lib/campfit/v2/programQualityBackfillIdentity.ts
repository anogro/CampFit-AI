import { createHash } from "node:crypto"

export const PROGRAM_QUALITY_BACKFILL_UUID_NAMESPACE = "cbe01a67-171a-50e5-8713-25610371e2a0"

type BackfillRunIdentityInput = {
  readonly backfillVersion: string
  readonly mapperVersion: string
  readonly programIds: readonly string[]
  readonly legacyVerificationIds: readonly string[]
}

export function evidenceIdForLegacyVerification(legacyVerificationId: string): string {
  return uuidV5(`legacy-program-verification:${requiredToken(legacyVerificationId, "legacyVerificationId")}`)
}

export function metadataObservationId(legacyVerificationId: string, factKey: string): string {
  return uuidV5(
    `legacy-program-verification:${requiredToken(legacyVerificationId, "legacyVerificationId")}:${requiredToken(factKey, "factKey")}`,
  )
}

export function shadowSnapshotId(programId: string, scoringVersionId: string, inputHash: string): string {
  return uuidV5(
    `program-quality-shadow:${requiredToken(programId, "programId")}:${requiredToken(scoringVersionId, "scoringVersionId")}:${requiredToken(inputHash, "inputHash")}`,
  )
}

export function backfillRunId(input: BackfillRunIdentityInput): string {
  const programIds = sortedUniqueTokens(input.programIds, "programIds")
  const verificationIds = sortedUniqueTokens(input.legacyVerificationIds, "legacyVerificationIds")
  const name = [
    "program-quality-backfill",
    requiredToken(input.backfillVersion, "backfillVersion"),
    requiredToken(input.mapperVersion, "mapperVersion"),
    programIds.join(","),
    verificationIds.join(","),
  ].join(":")
  return uuidV5(name)
}

export function stableCanonicalJson(value: unknown): string {
  return canonicalJson(value, new Set<object>())
}

export function qualityInputHash(value: unknown): string {
  return createHash("sha256").update(stableCanonicalJson(value), "utf8").digest("hex")
}

function uuidV5(name: string): string {
  const namespace = uuidBytes(PROGRAM_QUALITY_BACKFILL_UUID_NAMESPACE)
  const digest = createHash("sha1").update(namespace).update(name, "utf8").digest()
  digest[6] = ((digest[6] ?? 0) & 0x0f) | 0x50
  digest[8] = ((digest[8] ?? 0) & 0x3f) | 0x80
  const hex = digest.subarray(0, 16).toString("hex")
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function uuidBytes(uuid: string): Buffer {
  const hex = uuid.replaceAll("-", "")
  if (!/^[0-9a-f]{32}$/i.test(hex)) {
    throw new TypeError("UUID namespace must contain exactly 32 hexadecimal digits.")
  }
  return Buffer.from(hex, "hex")
}

function sortedUniqueTokens(values: readonly string[], fieldName: string): readonly string[] {
  const unique = new Set(values.map((value) => requiredToken(value, fieldName)))
  return [...unique].sort(compareCodeUnits)
}

function requiredToken(value: string, fieldName: string): string {
  const trimmed = value.trim()
  if (trimmed.length === 0) throw new TypeError(`${fieldName} must not contain an empty value.`)
  return trimmed
}

function compareCodeUnits(left: string, right: string): number {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

function canonicalJson(value: unknown, ancestors: Set<object>): string {
  if (value === null) return "null"
  if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value)
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("Canonical JSON does not support non-finite numbers.")
    return JSON.stringify(value)
  }
  if (typeof value !== "object") {
    throw new TypeError(`Canonical JSON does not support values of type ${typeof value}.`)
  }
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) throw new TypeError("Canonical JSON does not support invalid dates.")
    return JSON.stringify(value.toISOString())
  }
  if (ancestors.has(value)) throw new TypeError("Canonical JSON does not support circular references.")

  ancestors.add(value)
  try {
    if (Array.isArray(value)) {
      const items: string[] = []
      for (let index = 0; index < value.length; index += 1) {
        if (!Object.prototype.hasOwnProperty.call(value, index)) {
          throw new TypeError("Canonical JSON does not support sparse arrays.")
        }
        items.push(canonicalJson(value[index], ancestors))
      }
      return `[${items.join(",")}]`
    }

    const prototype = Object.getPrototypeOf(value)
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError("Canonical JSON supports only arrays, dates, and plain objects.")
    }
    if (Object.getOwnPropertySymbols(value).length > 0) {
      throw new TypeError("Canonical JSON does not support symbol keys.")
    }

    const keys = Object.getOwnPropertyNames(value).sort(compareCodeUnits)
    const properties = keys.map((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, key)
      if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
        throw new TypeError("Canonical JSON supports only enumerable data properties.")
      }
      return `${JSON.stringify(key)}:${canonicalJson(descriptor.value, ancestors)}`
    })
    return `{${properties.join(",")}}`
  } finally {
    ancestors.delete(value)
  }
}
