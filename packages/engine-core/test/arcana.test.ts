import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { apply, createSession, explain, validateModules, type ModuleDefinition } from "../src/index.js";

const moduleFixture = JSON.parse(readFileSync("examples/arcana-crossroads/module.json", "utf8")) as ModuleDefinition;
const mage = "com.example.arcana/character/mage";
const speed = "org.cyoa.core/value/speed";
const undead = "org.cyoa.core/tag/undead";
const haste = "com.example.arcana/option/haste";
const concentration = "org.cyoa.core/slot/concentration";

test("Arcana fixture supports toggles, slots, rules, traces, and replay", () => {
  const session = createSession([moduleFixture]);
  assert.equal(session.projection.values.get(`${mage}::${speed}`)?.value, 10);

  apply(session, { type: "selectChoice", choiceId: "com.example.arcana/choice/arcane-training", subjectId: mage });
  assert.equal(session.projection.values.get(`${mage}::${speed}`)?.value, 12);
  assert.ok(session.projection.owned.get(mage)?.has(haste));

  apply(session, { type: "assignSlot", optionId: haste, slotId: concentration, subjectId: mage });
  assert.equal(session.projection.slots.get(`${mage}::${concentration}`), haste);
  assert.equal(session.projection.values.get(`${mage}::${speed}`)?.value, 24);
  assert.ok(explain(session.projection, mage, speed).some((line) => line.includes("percentAdd total 1")));

  apply(session, { type: "unassignSlot", slotId: concentration, subjectId: mage });
  assert.equal(session.projection.slots.has(`${mage}::${concentration}`), false);
  assert.equal(session.projection.values.get(`${mage}::${speed}`)?.value, 12);

  apply(session, { type: "assignSlot", optionId: haste, slotId: concentration, subjectId: mage });
  assert.equal(session.projection.values.get(`${mage}::${speed}`)?.value, 24);

  apply(session, { type: "selectChoice", choiceId: "com.example.arcana/choice/grave-touched", subjectId: mage });
  assert.equal(session.projection.tags.get(`${mage}::${undead}`)?.length, 1);

  apply(session, { type: "takeAction", choiceId: "com.example.arcana/choice/claim-crossroads-reward", subjectId: mage });
  assert.equal(session.projection.values.get(`${mage}::org.cyoa.core/value/talent-points`)?.value, 1);

  const replay = createSession([moduleFixture]);
  for (const event of session.events) apply(replay, event.payload as any);
  assert.equal(replay.projection.values.get(`${mage}::${speed}`)?.value, 24);
});

test("engine rejects invalid commands and resolves encounter winners", () => {
  const session = createSession([moduleFixture]);

  const lockedReward = apply(session, { type: "takeAction", choiceId: "com.example.arcana/choice/claim-crossroads-reward", subjectId: mage });
  assert.equal(lockedReward.accepted, false);
  assert.ok(lockedReward.diagnostics.some((diagnostic) => diagnostic.includes("Requirements not met")));
  assert.equal(session.events.length, 0);

  const unownedSlot = apply(session, { type: "assignSlot", optionId: haste, slotId: concentration, subjectId: mage });
  assert.equal(unownedSlot.accepted, false);
  assert.ok(unownedSlot.diagnostics.some((diagnostic) => diagnostic.includes("does not own option")));

  apply(session, { type: "selectChoice", choiceId: "com.example.arcana/choice/arcane-training", subjectId: mage });
  const encounter = apply(session, { type: "resolveEncounter", encounterId: "com.example.arcana/encounter/crossroads-duel", seed: "fixed" });
  assert.equal(encounter.accepted, true);
  assert.equal(encounter.events[0].payload.winner, mage);
  assert.equal(session.projection.tags.get(`${mage}::org.cyoa.core/tag/duel-winner`)?.length, 1);
});


test("module validator catches dangling references before play", () => {
  assert.deepEqual(validateModules([moduleFixture]), { valid: true, diagnostics: [] });

  const broken: ModuleDefinition = structuredClone(moduleFixture);
  broken.choices[0].effects.push({ type: "grantTag", subject: { ref: "self" }, tag: "missing/tag" });

  const validation = validateModules([broken]);
  assert.equal(validation.valid, false);
  assert.ok(validation.diagnostics.some((diagnostic) => diagnostic.message === "Unknown tag missing/tag"));
});


test("projection reports conflicting equal-priority value overrides", () => {
  const fixture: ModuleDefinition = structuredClone(moduleFixture);
  fixture.choices.push({
    id: "com.example.arcana/choice/swift-form",
    title: { default: "Swift Form" },
    mode: "toggle",
    subject: { ref: "self" },
    effects: [{ type: "modifyValue", subject: { ref: "self" }, value: speed, operation: "override", amount: { literal: 20 }, priority: 1 }]
  });
  fixture.choices.push({
    id: "com.example.arcana/choice/slow-form",
    title: { default: "Slow Form" },
    mode: "toggle",
    subject: { ref: "self" },
    effects: [{ type: "modifyValue", subject: { ref: "self" }, value: speed, operation: "override", amount: { literal: 5 }, priority: 1 }]
  });

  const session = createSession([fixture]);
  apply(session, { type: "selectChoice", choiceId: "com.example.arcana/choice/swift-form", subjectId: mage });
  const result = apply(session, { type: "selectChoice", choiceId: "com.example.arcana/choice/slow-form", subjectId: mage });

  assert.equal(result.accepted, true);
  assert.ok(result.diagnostics.some((diagnostic) => diagnostic.includes("Conflicting equal-priority overrides")));
});
