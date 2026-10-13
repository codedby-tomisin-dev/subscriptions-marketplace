---
trigger: always_on
---

[Important: Keep code simple for a mid-level engineer to read and follow]

1. Make the Entry Point Obvious

Rule: There should be exactly one clear way the program starts.
	•	Use main()
	•	Guard with if __name__ == "__main__":
	•	Keep CLI parsing separate from logic

AI loves implicit execution. Humans hate it.

⸻

2. Separate I/O from Business Logic

Rule: Code that talks to the outside world should not think.

Split:
	•	I/O → files, DBs, APIs, CLI, env vars
	•	Logic → pure functions, deterministic behavior

If logic can't be unit-tested without mocks, it's too coupled.

⸻

3. Organise by Domain, Not by File Type

Rule: Group code by what it does, not what it is.

Prefer:

/payments
  ├─ service.py
  ├─ models.py
  ├─ repository.py

Avoid:

/services
/models
/utils

Feature-first Python scales better than "Django-by-accident".

⸻

4. Kill Global State Early

Rule: Globals are liabilities.

AI often introduces:
	•	module-level config
	•	mutable constants
	•	hidden caches

Pass dependencies explicitly. Use constructors. Be boring.

⸻

5. Make Side Effects Loud

Rule: If something mutates state, name it like it does.

Bad:

process_data()

Good:

write_report_to_s3()
update_user_balance()

Silence around side effects is how bugs hide.

⸻

6. Centralise Configuration

Rule: Configuration is not logic.
	•	One config module
	•	Environment-based overrides
	•	No os.getenv() scattered across files

Your future self will thank you during deployment.

⸻

7. Use Types as Guardrails, Not Decoration

Rule: Types exist to constrain behavior.
	•	Type public interfaces first
	•	Don't over-type internals
	•	Use mypy/pyright as a second brain

If types are lying, delete them and re-add honestly.

⸻

8. Name Things for the Reader, Not the Machine

Rule: Rename AI-generated symbols aggressively.

Bad:
	•	data_processor_v2
	•	temp_result
	•	handle_logic

Good:
	•	invoice_reconciler
	•	validated_rows
	•	calculate_interest

Clarity beats cleverness every time.

⸻

9. Delete More Than You Keep

Rule: AI overbuilds by default.

Look for:
	•	unused helpers
	•	defensive checks with no callers
	•	abstractions with one implementation

If it's not earning its keep, it's gone.

⸻

10. Document Decisions, Not Code

Rule: Code explains what. Docs explain why.

Write short notes on:
	•	non-obvious tradeoffs
	•	performance assumptions
	•	constraints you accepted intentionally

Future maintainers don't need poetry — they need context.

Don't write comments about the ticket an item was implemented under.

⸻

Project-specific: Observability (cloud/functions)

See `observability_standards.md` for the full rule — logger/tracing API,
`traced_*` handler decorators, and the PII (keys-not-values) discipline.

⸻

Final Mental Model

Treat AI-generated Python like:

A fast draft written by someone who doesn't own the pager

Your job is to:
	•	impose structure
	•	remove ambiguity
	•	surface intent
	•	reduce surprise
