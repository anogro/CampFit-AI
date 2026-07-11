export class SupabaseProjectGuardError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "SupabaseProjectGuardError"
  }
}

export function extractSupabaseProjectRef(supabaseUrl: string): string {
  let parsed: URL
  try {
    parsed = new URL(supabaseUrl.trim())
  } catch {
    throw new SupabaseProjectGuardError("Invalid Supabase URL.")
  }

  if (parsed.protocol !== "https:" || parsed.username.length > 0 || parsed.password.length > 0 || parsed.port.length > 0) {
    throw new SupabaseProjectGuardError("Invalid Supabase URL.")
  }

  const hostnameParts = parsed.hostname.split(".")
  const projectRef = hostnameParts[0] ?? ""
  if (
    hostnameParts.length !== 3
    || hostnameParts[1] !== "supabase"
    || hostnameParts[2] !== "co"
    || !/^[a-z0-9-]+$/.test(projectRef)
  ) {
    throw new SupabaseProjectGuardError("Invalid Supabase project host.")
  }

  return projectRef
}

export function assertExpectedSupabaseProject(input: {
  readonly supabaseUrl: string
  readonly expectedProjectRef: string
}): { readonly projectRef: string } {
  const expectedProjectRef = input.expectedProjectRef.trim()
  if (expectedProjectRef.length === 0) {
    throw new SupabaseProjectGuardError("Expected Supabase project ref is required.")
  }

  const projectRef = extractSupabaseProjectRef(input.supabaseUrl)
  if (projectRef !== expectedProjectRef) {
    throw new SupabaseProjectGuardError("Unexpected Supabase project ref.")
  }

  return { projectRef }
}

export function createGuardedWriteContext<T>(input: {
  readonly supabaseUrl: string
  readonly expectedProjectRef: string
  readonly createMutationDependency: () => T
}): { readonly projectRef: string; readonly mutation: T } {
  const { projectRef } = assertExpectedSupabaseProject(input)
  return {
    projectRef,
    mutation: input.createMutationDependency(),
  }
}
