import {
  changeKindForCriterion,
  changeKindForIndicator,
  criteriaFromIndicator,
  uniqueMethods,
  type ChangeKind,
  type EvalCriterion,
  type MethodDef,
} from "@/lib/evalCriteria";

export type { ChangeKind, EvalCriterion, MethodDef };

export function indicatorEvalMeta(indicator: {
  isNew?: boolean;
  curr: { criteria: string };
  fullSource?: {
    criteriaItems?: { mark: string; text: string; methods?: string[]; isNew?: boolean; isChanged?: boolean; methodScope?: "criterion" | "indicator-common" }[];
    commonMethods?: string[];
  } | null;
}): { items: EvalCriterion[]; methods: MethodDef[]; changeKind: ChangeKind | null } {
  const items = criteriaFromIndicator(indicator);
  return {
    items,
    methods: uniqueMethods(items.flatMap((c) => c.methods)),
    changeKind: changeKindForIndicator(Boolean(indicator.isNew), items),
  };
}

export function criterionEvalMeta(item: EvalCriterion): { methods: MethodDef[]; changeKind: ChangeKind | null } {
  return {
    methods: item.methods,
    changeKind: changeKindForCriterion(item),
  };
}
