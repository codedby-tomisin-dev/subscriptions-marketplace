import { FirebaseError } from "firebase/app";
import { httpsCallable } from "firebase/functions";
import { cloudFunctions } from "./firebase";

/** Calls a Cloud Function (`on_call`) by name and returns its result. `timeoutMs` defaults to the SDK's 70s. */
export async function callFunction<Request, Response>(name: string, data: Request, timeoutMs?: number): Promise<Response> {
  const result = await httpsCallable<Request, Response>(cloudFunctions(), name, timeoutMs ? { timeout: timeoutMs } : undefined)(data);
  return result.data;
}

/** A message safe to show the user. Callables send user-facing text for expected failures. */
export function describeError(error: unknown): string {
  if (error instanceof FirebaseError && error.code !== "functions/internal" && error.message) {
    // The SDK can append the HTTP status, e.g. "Admins only. [403]".
    return error.message.replace(/\s*\[\d{3}\]$/, "");
  }
  return "Something went wrong. Please try again.";
}
