# Auth

Passwordless sign-in with Firebase email links.

- **Flow:** `SignInDialog` emails a link (`sendSignInLink`) whose URL is `/auth/complete?next=<path>`. Opening it runs `useCompleteSignIn`, which signs in and returns to `next`.
- **Source of truth:** Firebase Auth. `AuthProvider` listens with `onIdTokenChanged` and exposes `user`, `isAdmin`, `isLoading`, `openSignIn` and `signOut` via `useAuth()`.
- **Admins** carry a `role: "admin"` custom claim, set with `cloud/functions/scripts/grant_admin.py`. A claim granted after sign-in shows up on the next token refresh; `refreshClaims()` forces one.
- **Assumptions:** the email the link was sent to is kept in localStorage (`storage.ts`) so the link can be completed without asking again. If it's missing (another device), the completion page asks for it.
- `isAdmin` only shapes the UI. Real protection is the Firestore rules and `traced_call(require_admin=True)` on the server.
