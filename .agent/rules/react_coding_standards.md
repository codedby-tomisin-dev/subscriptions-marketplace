---
trigger: always_on
---

# React Coding Standards & Golden Rules

These rules are designed to turn an AI-generated React codebase into a maintainable, scalable, and battle-tested project.

## Important: Always refactor and clean up as you plan and write, to make sure you're maintaining clean code.

## 1. Separate "What" from "How"
**Rule:** Components describe *what* happens. Hooks/services handle *how*.

*   **Components** → JSX + minimal orchestration.
*   **Hooks** → Data fetching, state management, side effects.
*   **Utils/Services** → Pure logic.

**Refactor Trigger:** If a component has `useEffect` + business logic + API calls.

## 2. One Component, One Responsibility
**Rule:** If you need "and" or comments to demarcate or describe it, split it.

**Bad:** `UserDashboard` handles data fetching AND filtering AND rendering.
**Good:**
*   `useUserData`
*   `useUserFilters`
*   `UserDashboardView`

## 3. Adopt a Feature-First Folder Structure
**Rule:** Organize by domain, not file type.

**Prefer:**
```
/features/payments
  ├─ components/
  ├─ hooks/
  ├─ api.ts
  ├─ types.ts
```

**Avoid:** Flat `/components`, `/hooks`, `/services` folders for domain-specific code.

## 4. Make "Smart vs Dumb" Explicit
**Rule:** Containers fetch & prepare data. Views only render.

*   **Containers** (e.g., `UserProfileContainer`): Handle data fetching, state, and passing props.
*   **Views** (e.g., `UserProfileView`): Pure presentational components.

## 5. Centralise Side Effects Ruthlessly
**Rule:** Side effects live in hooks or services — never scattered.

*   API calls, analytics, `localStorage`, feature flags must be encapsulated.
*   **Refactor Trigger:** Seeing `fetch()` or direct `localStorage` calls inside components.

## 6. Create a Single Source of Truth for Types
**Rule:** Types should not drift.

*   Define domain types once.
*   Reuse everywhere.
*   Export from `/types` or feature-level `types.ts`.
*   **Refactor Trigger:** Duplicated interfaces.

## 7. Name Things Like a Human Will Read Them
**Rule:** Rename AI-generated names aggressively.

*   **Bad:** `handleClick2`, `dataResponse`, `ComponentWrapperFinal`
*   **Good:** `submitPayment`, `userSummary`, `BillingLayout`

## 8. Introduce Boundaries Early
**Rule:** Decide what cannot import what.

*   `components/` ❌ importing from `api/`
*   `views/` ❌ importing from `utils/http`

## 9. Delete Code with Zero Mercy
**Rule:** If you don't understand it, delete it and reintroduce intentionally.

*   Remove unused helpers, defensive logic that isn't needed, and half-finished abstractions.

## 10. Write One README Per Feature
**Rule:** If a feature is non-trivial, explain it.

Create a `README.md` in the feature folder answering:
*   What does this feature do?
*   Where is the source of truth?
*   What assumptions does it make?
