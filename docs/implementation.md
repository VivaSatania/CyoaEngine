# Phase 0 implementation spike

This repository now contains a narrow TypeScript implementation of **Arcana at the Crossroads**, matching the first spike recommended by the design document.

Implemented pieces:

- a strict TypeScript project with pure packages under `packages/`;
- a typed domain model for modules, subjects, tags, values, effects, choices, rules, slots, events, sessions, and projections;
- a constrained expression evaluator with selectors, boolean predicates, comparisons, arithmetic, and value/tag reads;
- an engine that records intent events, rejects invalid commands before mutating history, rebuilds projections, preserves toggle unselect semantics, separates owned options from assigned slots, evaluates rules, resolves the first deterministic encounter slice, reports conflicting equal-priority value overrides, and emits value traces;
- a JSON fixture for the mage, bandit, Haste, undead tagging, a growth reward, and a default duel definition;
- a minimal `cyoa validate` CLI that loads module JSON and reports semantic validation diagnostics;
- Node tests that exercise the vertical slice, replay behavior, command rejection, encounter outcome projection, override-conflict diagnostics, and CLI validation.

The implementation is deliberately small and data-first. It is a foundation for the CLI, schemas, player, and builder described in later phases.

## Recommended next steps

1. **Make the validator a stronger package gate.** Add JSON Schema Draft 2020-12 checks, subject-kind applicability checks for effects and expressions, and validation for ambiguous selectors before runtime commands can be accepted.
2. **Finish value-pipeline semantics.** Move decimal arithmetic behind a deterministic numeric helper, formalize equal-priority override handling as a hard semantic error at validation/pack time when statically knowable, and expand trace entries into structured objects instead of strings.
3. **Model slot capacity explicitly.** Introduce slot instance IDs or indexed slot assignments so `SlotTypeDefinition.capacity` can support multiple equipped options instead of the current one-option-per-slot-type spike behavior.
4. **Broaden deterministic encounter resolution.** Replace the hard-coded duel score with data-authored encounter formulas, deterministic random streams, and outcome effects that preserve provenance.
5. **Add save/load and replay fixtures.** Serialize sessions and projections, then add golden replay tests that verify stable projections from a locked module set and decision history.
6. **Prepare player/builder integration.** Expose stable query helpers for eligibility, traces, available commands, and diagnostics so a web UI can consume the engine without duplicating rules.
