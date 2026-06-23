import { and, eq, inArray } from "drizzle-orm";
import { db, usersTable, parentStudentLinksTable } from "@workspace/db";

// Shared helpers for parent/tutor ↔ student linkage. The
// `parent_student_links` table stores BOTH parent↔student and tutor↔student
// rows in its `parentVidyaId` column (tutor rows additionally carry a batch),
// so the same query works for either linker role.

/** A linked student (or null) for the given parent/tutor account. */
export async function getLinkedStudentFor(
  linkerVidyaId: string,
  studentVidyaId: string,
) {
  const [row] = await db
    .select({
      vidyaId: usersTable.vidyaId,
      name: usersTable.name,
      studentClass: usersTable.studentClass,
      board: usersTable.board,
    })
    .from(parentStudentLinksTable)
    .innerJoin(
      usersTable,
      eq(usersTable.vidyaId, parentStudentLinksTable.studentVidyaId),
    )
    .where(
      and(
        eq(parentStudentLinksTable.parentVidyaId, linkerVidyaId),
        eq(parentStudentLinksTable.studentVidyaId, studentVidyaId),
      ),
    );
  return row ?? null;
}

/** The set of student ids linked to a parent/tutor account. */
export async function linkedStudentIds(linkerVidyaId: string): Promise<string[]> {
  const rows = await db
    .select({ studentVidyaId: parentStudentLinksTable.studentVidyaId })
    .from(parentStudentLinksTable)
    .where(eq(parentStudentLinksTable.parentVidyaId, linkerVidyaId));
  return [...new Set(rows.map((r) => r.studentVidyaId))];
}

/** True iff both accounts are linked to at least one common student. */
export async function sharesStudent(a: string, b: string): Promise<boolean> {
  const aStudents = await linkedStudentIds(a);
  if (aStudents.length === 0) return false;
  const overlap = await db
    .select({ studentVidyaId: parentStudentLinksTable.studentVidyaId })
    .from(parentStudentLinksTable)
    .where(
      and(
        eq(parentStudentLinksTable.parentVidyaId, b),
        inArray(parentStudentLinksTable.studentVidyaId, aStudents),
      ),
    )
    .limit(1);
  return overlap.length > 0;
}

/**
 * The other parent/tutor accounts that share at least one student with the
 * given account, restricted to the opposite portal role (a tutor sees parents,
 * a parent sees tutors), with their display name and role.
 */
export async function messagingContacts(
  vidyaId: string,
  selfRole: "tutor" | "parent",
): Promise<{ vidyaId: string; name: string; role: string }[]> {
  const students = await linkedStudentIds(vidyaId);
  if (students.length === 0) return [];
  const wantRole = selfRole === "tutor" ? "parent" : "tutor";
  const linkRows = await db
    .select({ linker: parentStudentLinksTable.parentVidyaId })
    .from(parentStudentLinksTable)
    .where(inArray(parentStudentLinksTable.studentVidyaId, students));
  const candidates = [
    ...new Set(linkRows.map((r) => r.linker).filter((id) => id !== vidyaId)),
  ];
  if (candidates.length === 0) return [];
  const users = await db
    .select({
      vidyaId: usersTable.vidyaId,
      name: usersTable.name,
      role: usersTable.role,
    })
    .from(usersTable)
    .where(inArray(usersTable.vidyaId, candidates));
  return users.filter((u) => u.role === wantRole);
}
