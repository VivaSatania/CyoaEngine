import type { Expression, Projection, QualifiedId, SubjectDefinition, SubjectSelector } from "../../engine-core/src/types.js";

export interface EvalContext { projection: Projection; self?: QualifiedId }
export function resolveSelector(selector: SubjectSelector, context: EvalContext): SubjectDefinition[] {
  if ("id" in selector) return context.projection.subjects.filter((s) => s.id === selector.id);
  if ("ref" in selector) {
    if (selector.ref === "self" && context.self) return context.projection.subjects.filter((s) => s.id === context.self);
    return context.projection.subjects.filter((s) => s.kind === selector.ref);
  }
  return context.projection.subjects.filter((s) => s.kind === selector.kind && (!selector.controller || s.controller === selector.controller));
}
export function oneSubject(selector: SubjectSelector, context: EvalContext): QualifiedId {
  const matches = resolveSelector(selector, context);
  if (matches.length !== 1) throw new Error(`Selector resolved to ${matches.length} subjects`);
  return matches[0].id;
}
export function evaluate(expr: Expression | undefined, context: EvalContext): string | number | boolean {
  if (!expr) return true;
  if ("literal" in expr) return expr.literal;
  switch (expr.op) {
    case "hasTag": return (context.projection.tags.get(`${oneSubject(expr.subject, context)}::${expr.tag}`)?.length ?? 0) > 0;
    case "value": return context.projection.values.get(`${oneSubject(expr.subject, context)}::${expr.value}`)?.value ?? 0;
    case "not": return !Boolean(evaluate(expr.expr, context));
    case "and": return expr.args.every((arg) => Boolean(evaluate(arg, context)));
    case "or": return expr.args.some((arg) => Boolean(evaluate(arg, context)));
    default: {
      const [left, right] = expr.args.map((arg) => Number(evaluate(arg, context)));
      if (expr.op === "eq") return left === right;
      if (expr.op === "gt") return left > right;
      if (expr.op === "gte") return left >= right;
      if (expr.op === "lt") return left < right;
      if (expr.op === "lte") return left <= right;
      if (expr.op === "add") return left + right;
      if (expr.op === "sub") return left - right;
      if (expr.op === "mul") return left * right;
      if (right === 0) throw new Error("Division by zero");
      return left / right;
    }
  }
}
