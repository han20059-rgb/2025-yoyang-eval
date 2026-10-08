import { loadManual } from "../src/lib/manual";
import { confirmSlice, parseEvalCriteria, rolesForCriterion } from "../src/lib/evalCriteria";
import { roles, type RoleId } from "../src/data/duties";

async function main() {
  const data = await loadManual();
  const perRole: Record<string, number> = {};
  for (const r of roles) if (r.id !== "all") perRole[r.id] = 0;
  let criteria = 0;
  let assigned = 0;
  let open = 0;
  const samples: string[] = [];
  for (const i of data.indicators) {
    const items = parseEvalCriteria(i.curr.criteria);
    const method = `${i.curr.method}\n${i.fullSource?.sections.confirm.text || ""}`;
    for (const it of items) {
      criteria += 1;
      const rs = rolesForCriterion(i.id, it.mark, it.text, confirmSlice(method, it.mark));
      if (rs.length) {
        assigned += 1;
        for (const r of rs) perRole[r] += 1;
        if (samples.length < 12) samples.push(`지표 ${i.id} ${it.mark} ${rs.join(",")}`);
      } else open += 1;
    }
  }
  console.log(JSON.stringify({ indicators: data.indicators.length, criteria, assigned, open, perRole, samples }, null, 2));
}

void main();
