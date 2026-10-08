import { combinedRoles } from "../src/lib/assignmentMerge";
import { encodeStaffTags, parseStaffTags, sitCounts, sitProblemScore, type SitRow } from "../src/lib/situation";
import { assigneeGroups } from "../src/lib/situation";
import { directiveVisible, type EvalDirective } from "../src/lib/directives";

function row(p: Partial<SitRow> & Pick<SitRow, "key">): SitRow {
  return {
    indicatorId: 1,
    name: "t",
    mark: "①",
    text: "x",
    manual: [],
    admin: [],
    combined: [],
    staff: [],
    exclude: [],
    recheckRoles: [],
    assigned: false,
    done: false,
    recheck: false,
    confirm: "",
    ...p,
  };
}

const a = row({
  key: "1:①",
  assigned: true,
  done: false,
  recheck: true,
  combined: [{ role: "nurse", kind: "admin" }],
  staff: [{ id: 101, name: "김간호" }],
});
const b = row({ key: "1:②", assigned: false, done: false });
const c = row({
  key: "2:①",
  indicatorId: 2,
  assigned: true,
  done: true,
  combined: [{ role: "social", kind: "manual" }],
});
const rows = [a, b, c];
const counts = sitCounts(rows);
if (counts.done !== 1 || counts.open !== 2 || counts.unassigned !== 1 || counts.recheck !== 1) {
  throw new Error(`counts ${JSON.stringify(counts)}`);
}
if (counts.done + counts.open !== counts.all) {
  throw new Error("open+done should equal all");
}
if (counts.done + counts.open + counts.unassigned + counts.recheck <= counts.all) {
  throw new Error("must not treat overlapping filters as a partition");
}
const groups = assigneeGroups(rows);
const nurse = groups.find((g) => g.key === "role:nurse");
const staff = groups.find((g) => g.key === "staff:101");
const none = groups.find((g) => g.key === "unassigned");
if (!nurse || nurse.total !== 1 || !staff || staff.total !== 1 || !none || none.total !== 1) {
  throw new Error("assignee groups");
}
if (sitProblemScore(b) > sitProblemScore(a)) throw new Error("unassigned should rank first");
const tags = encodeStaffTags([{ id: 64, name: "한태수" }]);
const parsed = parseStaffTags(tags);
if (parsed[0].id !== 64 || parsed[0].name !== "한태수") throw new Error("staff tags");
const merged = combinedRoles(["nurse"], ["nurse", "social"], []);
if (merged.length !== 2 || merged.filter((x) => x.role === "nurse").length !== 1) throw new Error("overlap roles");
const d: EvalDirective = {
  id: "1",
  indicatorId: 1,
  mark: "①",
  targetRoles: ["nurse"],
  targetStaffIds: [101],
  targetStaffNames: ["김간호"],
  body: "준비",
  due: "",
  authorName: "관리",
  authorId: 1,
  createdAt: "",
  status: "open",
  notes: [],
};
if (!directiveVisible(d, "nurse", 0, false)) throw new Error("role directive");
if (directiveVisible(d, "social", 0, false)) throw new Error("blocked other role");
if (!directiveVisible(d, "social", 0, true)) throw new Error("admin sees all");
console.log("situation-verify-ok", counts);
