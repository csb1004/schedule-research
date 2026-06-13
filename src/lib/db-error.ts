export function isDatabaseConnectionError(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : "";

  return /connection (terminated|closed)|database.*connect|ECONNREFUSED/i.test(
    message,
  );
}

