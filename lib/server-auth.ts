/**
 * Server-side request authentication for API routes.
 * Clients send the Firebase ID token as `Authorization: Bearer <token>`;
 * routes must trust ONLY the uid decoded here, never one from the body.
 */
import type { NextRequest } from "next/server";
import { getAdminAuth } from "./firebase-admin";

export interface AuthedUser {
  uid: string;
  email?: string;
  name?: string;
}

/** Returns the verified user, or null if the token is missing/invalid. */
export async function verifyRequestAuth(req: NextRequest): Promise<AuthedUser | null> {
  const header = req.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer (.+)$/);
  if (!match) return null;
  try {
    const decoded = await getAdminAuth().verifyIdToken(match[1]);
    return {
      uid: decoded.uid,
      email: decoded.email,
      name: typeof decoded.name === "string" ? decoded.name : undefined,
    };
  } catch {
    return null;
  }
}
