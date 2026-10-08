import { readFile, writeFile } from "fs/promises";
import { duties } from "../src/data/duties.ts";
import { confirmSlice, parseEvalCriteria, rolesForCriterion, rolesForIndicator } from "../src/lib/evalCriteria.ts";
import type { RoleId } from "../src/data/duties.ts";

async function main() {
  const bundle = JSON.parse(await readFile("src/data/manual.json", "utf8")) as {
    indicators: { id: number; name: string; curr: { criteria: string; method: string } }[];
  };
  let overlay: { indicators?: { id: number; sections?: { confirm?: { text: string } } }[] } = {};
  try {
    overlay = JSON.parse(await readFile("data/manual-store/preview.json", "utf8"));
  } catch {
    overlay = {};
  }
  const oldByRole: Record<string, number> = {};
  for (const d of duties) {
    for (const r of d.roles) {
      if (r === "all") continue;
      oldByRole[r] = (oldByRole[r] || 0) + 1;
    }
  }
  const newByRole: Record<string, number> = {};
  const unassigned: { id: number; name: string; mark: string; text: string }[] = [];
  const kept: { id: number; mark: string; roles: RoleId[] }[] = [];
  for (const ind of bundle.indicators) {
    const items = parseEvalCriteria(ind.curr.criteria);
    const confirmFull = `${ind.curr.method}\n${overlay.indicators?.find((x) => x.id === ind.id)?.sections?.confirm?.text || ""}`;
    for (const it of items) {
      const rs = rolesForCriterion(ind.id, it.mark, it.text, confirmSlice(confirmFull, it.mark));
      if (!rs.length) unassigned.push({ id: ind.id, name: ind.name, mark: it.mark, text: it.text.slice(0, 80) });
      else {
        kept.push({ id: ind.id, mark: it.mark, roles: rs });
        for (const r of rs) newByRole[r] = (newByRole[r] || 0) + 1;
      }
    }
  }
  const droppedDuties = duties.filter((d) => {
    const ind = bundle.indicators.find((i) => i.id === d.indicator);
    const allowed = ind ? rolesForIndicator(d.indicator, ind.curr.criteria, ind.curr.method) : [];
    return !d.roles.some((r) => r !== "all" && allowed.includes(r));
  });
  const report = {
    oldDutyRoleCounts: oldByRole,
    newCriterionRoleCounts: newByRole,
    unassignedCount: unassigned.length,
    assignedCriteria: kept.length,
    droppedDuties: droppedDuties.map((d) => ({ title: d.title, indicator: d.indicator, roles: d.roles })),
    sampleUnassigned: unassigned.filter((u) => [3, 12, 9, 20].includes(u.id)),
    i20: kept.filter((k) => k.id === 20),
    i12: kept.filter((k) => k.id === 12),
    i3: kept.filter((k) => k.id === 3),
  };
  await writeFile("data/manual-store/test-runs/assignment-report.json", JSON.stringify({ ...report, unassigned }, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main();
