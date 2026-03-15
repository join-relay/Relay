export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL)
}

export function getDatabaseClient(): never {
  throw new Error(
    "Database access is intentionally not wired in Phase A or A.5. Use project.sql as reference only."
  )
}
