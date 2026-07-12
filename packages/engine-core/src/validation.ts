import type { EffectTemplate, Expression, ModuleDefinition, QualifiedId, SubjectSelector, ValidationDiagnostic, ValidationResult } from "./types.js";

type Registry = {
  subjects: Set<QualifiedId>;
  tags: Set<QualifiedId>;
  values: Set<QualifiedId>;
  choices: Set<QualifiedId>;
  slots: Set<QualifiedId>;
  options: Set<QualifiedId>;
  encounters: Set<QualifiedId>;
};

export function validateModules(modules: ModuleDefinition[]): ValidationResult {
  const diagnostics: ValidationDiagnostic[] = [];
  const registry = collectIds(modules, diagnostics);

  modules.forEach((module, moduleIndex) => {
    module.choices.forEach((choice, choiceIndex) => {
      validateSelector(choice.subject, registry, `modules[${moduleIndex}].choices[${choiceIndex}].subject`, diagnostics);
      validateExpression(choice.requires, registry, `modules[${moduleIndex}].choices[${choiceIndex}].requires`, diagnostics);
      validateEffects(choice.effects, registry, `modules[${moduleIndex}].choices[${choiceIndex}].effects`, diagnostics);
    });

    module.rules.forEach((rule, ruleIndex) => {
      validateExpression(rule.when, registry, `modules[${moduleIndex}].rules[${ruleIndex}].when`, diagnostics);
      if (rule.forEach) validateSelector(rule.forEach, registry, `modules[${moduleIndex}].rules[${ruleIndex}].forEach`, diagnostics);
      validateEffects(rule.outputs, registry, `modules[${moduleIndex}].rules[${ruleIndex}].outputs`, diagnostics);
    });

    (module.options ?? []).forEach((option, optionIndex) => {
      if (!registry.slots.has(option.requiredSlot)) error(diagnostics, `modules[${moduleIndex}].options[${optionIndex}].requiredSlot`, `Unknown slot type ${option.requiredSlot}`);
      validateEffects(option.effects, registry, `modules[${moduleIndex}].options[${optionIndex}].effects`, diagnostics);
    });

    (module.slots ?? []).forEach((slot, slotIndex) => {
      if (slot.capacity < 1) error(diagnostics, `modules[${moduleIndex}].slots[${slotIndex}].capacity`, "Slot capacity must be at least 1");
      slot.accepts.forEach((optionId, acceptIndex) => {
        if (!registry.options.has(optionId)) error(diagnostics, `modules[${moduleIndex}].slots[${slotIndex}].accepts[${acceptIndex}]`, `Unknown option ${optionId}`);
      });
    });

    (module.encounters ?? []).forEach((encounter, encounterIndex) => {
      validateSelector(encounter.actor, registry, `modules[${moduleIndex}].encounters[${encounterIndex}].actor`, diagnostics);
      validateSelector(encounter.opponent, registry, `modules[${moduleIndex}].encounters[${encounterIndex}].opponent`, diagnostics);
    });
  });

  return { valid: diagnostics.every((diagnostic) => diagnostic.severity !== "error"), diagnostics };
}

function collectIds(modules: ModuleDefinition[], diagnostics: ValidationDiagnostic[]): Registry {
  const registry: Registry = { subjects: new Set(), tags: new Set(), values: new Set(), choices: new Set(), slots: new Set(), options: new Set(), encounters: new Set() };
  modules.forEach((module, moduleIndex) => {
    add(registry.subjects, module.subjects.map((subject) => subject.id), `modules[${moduleIndex}].subjects`, diagnostics);
    add(registry.tags, module.tags.map((tag) => tag.id), `modules[${moduleIndex}].tags`, diagnostics);
    add(registry.values, module.values.map((value) => value.id), `modules[${moduleIndex}].values`, diagnostics);
    add(registry.choices, module.choices.map((choice) => choice.id), `modules[${moduleIndex}].choices`, diagnostics);
    add(registry.slots, (module.slots ?? []).map((slot) => slot.id), `modules[${moduleIndex}].slots`, diagnostics);
    add(registry.options, (module.options ?? []).map((option) => option.id), `modules[${moduleIndex}].options`, diagnostics);
    add(registry.encounters, (module.encounters ?? []).map((encounter) => encounter.id), `modules[${moduleIndex}].encounters`, diagnostics);
  });
  return registry;
}

function add(set: Set<QualifiedId>, ids: QualifiedId[], path: string, diagnostics: ValidationDiagnostic[]) {
  for (const id of ids) {
    if (set.has(id)) error(diagnostics, path, `Duplicate definition id ${id}`);
    set.add(id);
  }
}

function validateEffects(effects: EffectTemplate[], registry: Registry, path: string, diagnostics: ValidationDiagnostic[]) {
  effects.forEach((effect, effectIndex) => {
    const effectPath = `${path}[${effectIndex}]`;
    validateSelector(effect.subject, registry, `${effectPath}.subject`, diagnostics);
    if (effect.type === "grantTag" && !registry.tags.has(effect.tag)) error(diagnostics, `${effectPath}.tag`, `Unknown tag ${effect.tag}`);
    if (effect.type === "modifyValue") {
      if (!registry.values.has(effect.value)) error(diagnostics, `${effectPath}.value`, `Unknown value ${effect.value}`);
      validateExpression(effect.amount, registry, `${effectPath}.amount`, diagnostics);
    }
    if (effect.type === "ownOption" && !registry.options.has(effect.option)) error(diagnostics, `${effectPath}.option`, `Unknown option ${effect.option}`);
    if (effect.type === "unlockChoice" && !registry.choices.has(effect.choice)) error(diagnostics, `${effectPath}.choice`, `Unknown choice ${effect.choice}`);
  });
}

function validateExpression(expr: Expression | undefined, registry: Registry, path: string, diagnostics: ValidationDiagnostic[]) {
  if (!expr || "literal" in expr) return;
  if (expr.op === "hasTag") {
    validateSelector(expr.subject, registry, `${path}.subject`, diagnostics);
    if (!registry.tags.has(expr.tag)) error(diagnostics, `${path}.tag`, `Unknown tag ${expr.tag}`);
  } else if (expr.op === "value") {
    validateSelector(expr.subject, registry, `${path}.subject`, diagnostics);
    if (!registry.values.has(expr.value)) error(diagnostics, `${path}.value`, `Unknown value ${expr.value}`);
  } else if (expr.op === "not") validateExpression(expr.expr, registry, `${path}.expr`, diagnostics);
  else expr.args.forEach((arg, argIndex) => validateExpression(arg, registry, `${path}.args[${argIndex}]`, diagnostics));
}

function validateSelector(selector: SubjectSelector, registry: Registry, path: string, diagnostics: ValidationDiagnostic[]) {
  if ("id" in selector && !registry.subjects.has(selector.id)) error(diagnostics, path, `Unknown subject ${selector.id}`);
}

function error(diagnostics: ValidationDiagnostic[], path: string, message: string) {
  diagnostics.push({ severity: "error", path, message });
}
