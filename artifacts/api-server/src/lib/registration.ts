import { randomInt } from "node:crypto";

export const USERNAME_TAKEN =
  "Username is taken already, please try a different one";

export function isUsernameConflict(error: unknown): boolean {
  // Drizzle wraps the original PostgreSQL error in `cause`.
  let current = error;
  for (
    let depth = 0;
    depth < 5 && current && typeof current === "object";
    depth++
  ) {
    const value = current as {
      code?: string;
      constraint?: string;
      cause?: unknown;
    };
    if (value.code === "23505" && value.constraint === "users_name_unique")
      return true;
    current = value.cause;
  }
  return false;
}

export class VidyaIdUnavailable extends Error {}

export async function createWithAvailableVidyaId<T>(
  role: "student" | "parent" | "tutor",
  insert: (id: string) => Promise<T | undefined>,
): Promise<T> {
  const prefix =
    role === "student" ? "VG-STU-" : role === "parent" ? "VG-PAR-" : "VG-TUT-";
  for (let attempt = 0; attempt < 5; attempt++) {
    const user = await insert(`${prefix}${randomInt(10000, 100000)}`);
    if (user) return user;
  }
  throw new VidyaIdUnavailable("Could not allocate a Vidya ID");
}
