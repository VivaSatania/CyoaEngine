import { evaluate, resolveSelector } from "../../expression/src/index.js";
import type { Command, Contribution, DecisionEvent, EffectTemplate, ModuleDefinition, Projection, QualifiedId, Session, SlottableOptionDefinition } from "./types.js";

const key = (subject: QualifiedId, fact: QualifiedId) => `${subject}::${fact}`;
const eventTime = () => new Date(0).toISOString();

export function createSession(modules: ModuleDefinition[]): Session {
  const session: Session = { modules, events: [], projection: emptyProjection(modules) };
  session.projection = project(session);
  return session;
}

export function apply(session: Session, command: Command): { accepted: boolean; events: DecisionEvent[]; projection: Projection; diagnostics: string[] } {
  const definitionId = "choiceId" in command ? command.choiceId : "optionId" in command ? command.optionId : "slotId" in command ? command.slotId : command.encounterId;
  const event: DecisionEvent = { eventId: `evt-${session.events.length + 1}`, schemaVersion: 1, sequence: session.events.length + 1, type: eventType(command), subjectId: "subjectId" in command ? command.subjectId : undefined, definitionId, decisionInstanceId: `${definitionId}:${"subjectId" in command ? command.subjectId : "world"}`, payload: { ...command }, seed: "seed" in command ? command.seed : undefined, recordedAt: eventTime() };
  session.events.push(event);
  session.projection = project(session);
  return { accepted: true, events: [event], projection: session.projection, diagnostics: session.projection.diagnostics };
}

export function explain(projection: Projection, subjectId: QualifiedId, valueId: QualifiedId): string[] {
  return projection.values.get(key(subjectId, valueId))?.trace ?? [`No value ${valueId} for ${subjectId}`];
}

function eventType(command: Command): DecisionEvent["type"] {
  if (command.type === "selectChoice") return "choice.selected";
  if (command.type === "unselectChoice") return "choice.unselected";
  if (command.type === "takeAction") return "action.taken";
  if (command.type === "assignSlot") return "slot.assigned";
  if (command.type === "unassignSlot") return "slot.unassigned";
  return "encounter.resolved";
}

function emptyProjection(modules: ModuleDefinition[]): Projection {
  return { subjects: modules.flatMap((m) => m.subjects), tags: new Map(), values: new Map(), selected: new Map(), owned: new Map(), slots: new Map(), diagnostics: [] };
}

function project(session: Session): Projection {
  const projection = emptyProjection(session.modules);
  calculateValues(session.modules, projection);
  const choices = new Map(session.modules.flatMap((m) => m.choices.map((c) => [c.id, c])));
  const options = new Map(session.modules.flatMap((m) => (m.options ?? []).map((o) => [o.id, o])));
  const selected = new Set<string>();
  const actions: DecisionEvent[] = [];
  const assigned = new Map<string, QualifiedId>();
  for (const event of session.events) {
    const subjectId = event.subjectId ?? "";
    if (event.type === "choice.selected") selected.add(key(subjectId, event.definitionId));
    if (event.type === "choice.unselected") selected.delete(key(subjectId, event.definitionId));
    if (event.type === "action.taken") actions.push(event);
    if (event.type === "slot.assigned") assigned.set(key(subjectId, String(event.payload.slotId)), event.definitionId);
    if (event.type === "slot.unassigned") assigned.delete(key(subjectId, event.definitionId));
    if (event.type === "encounter.resolved") applyEncounterOutcome(projection, event);
  }
  for (const marker of selected) {
    const [subjectId, choiceId] = marker.split("::");
    const choice = choices.get(choiceId);
    if (!choice) continue;
    try {
      if (Boolean(evaluate(choice.requires, { projection, self: subjectId }))) { projection.selected.set(marker, "active"); emitEffects(projection, choice.effects, subjectId, `Choice: ${choice.title.default}`); }
      else projection.selected.set(marker, "suspended");
    } catch (error) { projection.selected.set(marker, "suspended"); projection.diagnostics.push(String(error)); }
  }
  for (const action of actions) {
    const choice = choices.get(action.definitionId);
    if (choice) emitEffects(projection, choice.effects, action.subjectId, `Action: ${choice.title.default}`);
  }
  for (const [slotKey, optionId] of assigned) {
    const [subjectId, slotId] = slotKey.split("::");
    const option = options.get(optionId);
    if (option && owns(projection, subjectId, option)) emitEffects(projection, option.effects, subjectId, `Slot ${slotId}: ${option.title.default}`);
  }
  evaluateRules(session, projection);
  calculateValues(session.modules, projection);
  return projection;
}

function owns(projection: Projection, subjectId: string, option: SlottableOptionDefinition) { return projection.owned.get(subjectId)?.has(option.id) ?? false; }
function emitEffects(projection: Projection, effects: EffectTemplate[], self: QualifiedId | undefined, source: string) {
  for (const effect of effects) {
    for (const subject of resolveSelector(effect.subject, { projection, self })) {
      if (effect.type === "grantTag") addTag(projection, { key: `${source}:${subject.id}:${effect.tag}`, subjectId: subject.id, tagId: effect.tag, source });
      if (effect.type === "modifyValue") addValue(projection, { key: `${source}:${subject.id}:${effect.value}:${effect.operation}`, subjectId: subject.id, valueId: effect.value, operation: effect.operation, amount: Number(evaluate(effect.amount, { projection, self: subject.id })), priority: effect.priority, source });
      if (effect.type === "ownOption") { const set = projection.owned.get(subject.id) ?? new Set(); set.add(effect.option); projection.owned.set(subject.id, set); }
      if (effect.type === "unlockChoice") addTag(projection, { key: `${source}:${subject.id}:unlock:${effect.choice}`, subjectId: subject.id, tagId: `unlocked:${effect.choice}`, source });
    }
  }
}
function evaluateRules(session: Session, projection: Projection) {
  for (const rule of session.modules.flatMap((m) => m.rules)) for (const subject of resolveSelector(rule.forEach ?? { kind: "session" }, { projection })) if (Boolean(evaluate(rule.when, { projection, self: subject.id }))) emitEffects(projection, rule.outputs, subject.id, `Rule: ${rule.id}`);
}
function addTag(projection: Projection, contribution: Contribution) { const k = key(contribution.subjectId, contribution.tagId!); projection.tags.set(k, [...(projection.tags.get(k) ?? []), contribution]); }
function addValue(projection: Projection, contribution: Contribution) { const k = key(contribution.subjectId, contribution.valueId!); projection.values.set(k, { value: 0, trace: [...(projection.values.get(k)?.trace ?? []), JSON.stringify(contribution)] }); }
function calculateValues(modules: ModuleDefinition[], projection: Projection) {
  const contributions = [...projection.values.entries()];
  projection.values.clear();
  for (const subject of projection.subjects) for (const def of modules.flatMap((m) => m.values).filter((v) => v.appliesTo.includes(subject.kind))) {
    const raw = contributions.filter(([k]) => k === key(subject.id, def.id)).flatMap(([, v]) => v.trace.filter((t) => t.startsWith("{")).map((t) => JSON.parse(t) as Contribution));
    const overrides = raw.filter((c) => c.operation === "override").sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    let value = overrides[0]?.amount ?? Number(def.default);
    const trace = [`Default base ${def.default}`];
    for (const op of ["baseAdd", "flatAdd"] as const) for (const c of raw.filter((x) => x.operation === op)) { value += c.amount ?? 0; trace.push(`${c.source} (${op}) ${c.amount}`); }
    const percent = raw.filter((c) => c.operation === "percentAdd").reduce((s, c) => s + (c.amount ?? 0), 0); if (percent) { value *= 1 + percent; trace.push(`percentAdd total ${percent}`); }
    for (const c of raw.filter((x) => x.operation === "multiplier")) { value *= c.amount ?? 1; trace.push(`${c.source} multiplier ${c.amount}`); }
    const min = Math.max(Number(def.minimum ?? -Infinity), ...raw.filter((c) => c.operation === "minimum").map((c) => c.amount ?? -Infinity));
    const max = Math.min(Number(def.maximum ?? Infinity), ...raw.filter((c) => c.operation === "maximum").map((c) => c.amount ?? Infinity));
    value = Math.min(max, Math.max(min, value));
    const precision = def.precision ?? 0; value = Number(value.toFixed(precision)); trace.push(`Result ${value}`);
    projection.values.set(key(subject.id, def.id), { value, trace });
  }
}
function applyEncounterOutcome(projection: Projection, event: DecisionEvent) {
  const winner = event.payload.winner as string | undefined; if (winner) addTag(projection, { key: `${event.eventId}:winner`, subjectId: winner, tagId: "org.cyoa.core/tag/duel-winner", source: "Encounter result" });
}
