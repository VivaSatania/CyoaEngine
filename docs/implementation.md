# Phase 0 implementation spike

This repository now contains a narrow TypeScript implementation of **Arcana at the Crossroads**, matching the first spike recommended by the design document.

Implemented pieces:

- a strict TypeScript project with pure packages under `packages/`;
- a typed domain model for modules, subjects, tags, values, effects, choices, rules, slots, events, sessions, and projections;
- a constrained expression evaluator with selectors, boolean predicates, comparisons, arithmetic, and value/tag reads;
- an engine that records intent events, rejects invalid commands before mutating history, rebuilds projections, preserves toggle unselect semantics, separates owned options from assigned slots, evaluates rules, resolves the first deterministic encounter slice, and emits value traces;
- a JSON fixture for the mage, bandit, Haste, undead tagging, a growth reward, and a default duel definition;
- Node tests that exercise the vertical slice, replay behavior, command rejection, and encounter outcome projection.

The implementation is deliberately small and data-first. It is a foundation for the CLI, schemas, player, and builder described in later phases.
