# Agent Instructions

## Project

This repository contains ANOGRO and CampFit AI.

CampFit v3 is the only active CampFit user experience.
Do not restore or create separate v1 or v2 user interfaces.

The main user entry point is:

- `/campfit`
- `/campfit?demo=1` for the isolated demo catalog

Read `docs/campfit-v3-context.md` before modifying CampFit.

## Working Principles

- Investigate the actual execution path before modifying code.
- Prefer the smallest change that fixes the verified cause.
- Preserve existing architecture unless restructuring is explicitly requested.
- Do not introduce a new dependency without explicit approval.
- Do not perform broad refactors while fixing a localized defect.
- Do not conceal a functional defect with fallback copy or placeholder UI.
- Distinguish verified facts from assumptions in the final report.

## CampFit Conversation Architecture

The intended order is:

1. Parse the user message.
2. Extract and merge facts into conversation state.
3. Determine which questions are complete.
4. Select one next question through the application question planner.
5. Render one short acknowledgement and exactly one planner-owned question.

The LLM may:

- extract structured facts
- produce a short acknowledgement
- suggest a next question key for planner consideration

The LLM must not own the final user-facing next-question text.

Do not render both:

- a question contained in the model acknowledgement
- and the planner question

The final assistant output must contain:

- acknowledgement: normally one sentence, maximum two
- exactly one user-facing question

## Recommendation Integrity

- Preserve hard filters unless the user explicitly approves a policy change.
- Do not invent cities or programs when no catalog candidate matches.
- Do not silently use the demo catalog in production mode.
- `/campfit?demo=1` must retain demo mode through the entire flow.
- When recommendations are empty, diagnose catalog loading and filter counts before changing UI copy.
- Do not modify recommendation weights merely to force non-empty results.

## Demo Catalog

The demo catalog is isolated and must not leak into normal production sessions.

Expected demo assets include:

- 18 programs
- 6 cities

When debugging demo recommendations, trace:

1. query parameter
2. client flow state
3. session persistence
4. recommendation request payload
5. API route
6. catalog selection
7. hard-filter counts
8. ranking
9. API response
10. result rendering

## UI Principles

- Use the current ANOGRO/CampFit visual language.
- Do not reintroduce legacy `CF` branding.
- The AI mark must be a single gradient circle.
- No central white circle, inner white border, letters, or additional inner disc.
- Keep result sections information-dense and readable.
- Avoid oversized cards and decorative empty space.
- Do not expose defensive implementation copy such as “후보를 임의로 만들지 않았어요.”
- Do not show inactive or non-functional CTAs as if they work.

## Provider Stability

Unless explicitly requested, do not change:

- AI provider
- model name
- timeout
- Structured Output fact contract
- provider abstraction

When provider calls already return HTTP 200 and validated output, investigate downstream state and rendering before changing provider code.

## Validation

Run the tests relevant to the modified area first.

For substantial CampFit changes, run as applicable:

- conversation and result integration tests
- `npm run campfit:v3:eval:fallback`
- `npm run campfit:v3:eval:mock`
- `npm run test`
- `npm run typecheck`
- `npm run build`
- `git diff --check`

Do not claim browser verification unless it was actually performed.

## Git Policy

Unless the user explicitly requests otherwise:

- do not stage
- do not commit
- do not push
- do not merge
- preserve unrelated tracked and untracked changes

Before editing, inspect the current branch and working tree.
Do not overwrite another agent's unfinished work.

## Final Report

Report in this order:

1. Root cause
2. Files changed
3. Behavior before and after
4. Tests and browser checks actually performed
5. Remaining uncertainty
6. Git status

Keep the report concrete and concise.
