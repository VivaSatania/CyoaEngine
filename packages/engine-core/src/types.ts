export type QualifiedId = `${string}/${string}` | string;
export type SubjectKind = "character" | "party" | "world" | "location" | "faction" | "session";

export interface LocalizedText { default: string }
export interface SubjectDefinition {
  id: QualifiedId;
  kind: SubjectKind;
  displayName: LocalizedText;
  controller: "player" | "engine" | "shared";
  ownerModuleId: string;
}
export interface TagDefinition { id: QualifiedId; label: LocalizedText; appliesTo: SubjectKind[] }
export interface ValueDefinition {
  id: QualifiedId; label: LocalizedText; appliesTo: SubjectKind[];
  default: string; precision?: number; minimum?: string; maximum?: string;
}
export type ModifierOperation = "baseAdd" | "flatAdd" | "percentAdd" | "multiplier" | "override" | "minimum" | "maximum";
export type SubjectSelector = { ref: "self" | "party" | "world" } | { id: QualifiedId } | { kind: SubjectKind; controller?: "player" | "engine" | "shared" };
export type Expression =
  | { literal: string | number | boolean }
  | { op: "hasTag"; subject: SubjectSelector; tag: QualifiedId }
  | { op: "value"; subject: SubjectSelector; value: QualifiedId }
  | { op: "not"; expr: Expression }
  | { op: "and" | "or"; args: Expression[] }
  | { op: "eq" | "gt" | "gte" | "lt" | "lte" | "add" | "sub" | "mul" | "div"; args: [Expression, Expression] };
export type EffectTemplate =
  | { type: "grantTag"; subject: SubjectSelector; tag: QualifiedId }
  | { type: "modifyValue"; subject: SubjectSelector; value: QualifiedId; operation: ModifierOperation; amount: Expression; priority?: number }
  | { type: "ownOption"; subject: SubjectSelector; option: QualifiedId }
  | { type: "unlockChoice"; subject: SubjectSelector; choice: QualifiedId };
export interface ChoiceDefinition { id: QualifiedId; title: LocalizedText; mode: "toggle" | "action"; subject: SubjectSelector; requires?: Expression; effects: EffectTemplate[] }
export interface RuleDefinition { id: QualifiedId; when: Expression; forEach?: SubjectSelector; outputs: EffectTemplate[]; presentation: "hidden" | "trace-only" | "visible" }
export interface SlotTypeDefinition { id: QualifiedId; label: LocalizedText; capacity: number; accepts: QualifiedId[] }
export interface SlottableOptionDefinition { id: QualifiedId; title: LocalizedText; requiredSlot: QualifiedId; effects: EffectTemplate[] }
export interface EncounterDefinition { id: QualifiedId; title: LocalizedText; actor: SubjectSelector; opponent: SubjectSelector; rounds?: number }
export interface ModuleDefinition {
  id: string; version: string; title: string;
  subjects: SubjectDefinition[]; tags: TagDefinition[]; values: ValueDefinition[];
  choices: ChoiceDefinition[]; rules: RuleDefinition[]; slots?: SlotTypeDefinition[];
  options?: SlottableOptionDefinition[]; encounters?: EncounterDefinition[];
}
export interface DecisionEvent { eventId: string; schemaVersion: 1; sequence: number; type: "choice.selected" | "choice.unselected" | "action.taken" | "slot.assigned" | "slot.unassigned" | "encounter.resolved"; subjectId?: QualifiedId; definitionId: QualifiedId; decisionInstanceId: string; payload: Record<string, unknown>; seed?: string; recordedAt: string }
export interface Contribution { key: string; subjectId: QualifiedId; source: string; tagId?: QualifiedId; valueId?: QualifiedId; operation?: ModifierOperation; amount?: number; priority?: number }
export interface Projection { subjects: SubjectDefinition[]; tags: Map<string, Contribution[]>; values: Map<string, { value: number; trace: string[] }>; selected: Map<string, "active" | "suspended">; owned: Map<string, Set<QualifiedId>>; slots: Map<string, QualifiedId>; diagnostics: string[] }
export interface Session { modules: ModuleDefinition[]; events: DecisionEvent[]; projection: Projection }
export type Command = { type: "selectChoice" | "unselectChoice" | "takeAction"; choiceId: QualifiedId; subjectId: QualifiedId } | { type: "assignSlot"; optionId: QualifiedId; slotId: QualifiedId; subjectId: QualifiedId } | { type: "unassignSlot"; slotId: QualifiedId; subjectId: QualifiedId } | { type: "resolveEncounter"; encounterId: QualifiedId; seed?: string };
export type ValidationSeverity = "error" | "warning";
export interface ValidationDiagnostic { severity: ValidationSeverity; path: string; message: string }
export interface ValidationResult { valid: boolean; diagnostics: ValidationDiagnostic[] }
