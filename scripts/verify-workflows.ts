import { applyProposal, emptyState, excludeProposal, holdProposal, ingestProposals, restoreWorkflow } from "../src/lib/workflows/engine";
import { seedProposals } from "../src/lib/workflows/seeds";
import { buildReviewPayload } from "../src/lib/ai/review";
import { loadManual } from "../src/lib/manual";
import { sourceAllowed } from "../src/lib/workflows/validate";
import { peelOriginalMethods, uniqueMethods, extractMethods } from "../src/lib/evalCriteria";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

let s = ingestProposals(emptyState("t", "t"), seedProposals()).state;
assert(s.proposals.length === 20, `seed ${s.proposals.length}`);
const again = ingestProposals(s, seedProposals());
assert(again.skipped === 20 && again.added === 0, "dedupe");
s = again.state;
const first = s.proposals[0];
const applied = applyProposal(s, first.id, "tester");
assert(!applied.error, applied.error || "");
s = applied.state;
assert(s.workflows.some((w) => w.id === first.proposed.id && w.status === "approved"), "apply");
const hid = s.workflows[0].history[0]?.id;
assert(hid, "history");
const held = holdProposal(s, "missing", "tester", "이유");
assert(held.error, "missing hold");
const second = s.proposals.find((p) => p.status === "open");
assert(second, "second");
const hold = holdProposal(s, second!.id, "tester", "다음에 다시");
assert(!hold.error, hold.error || "");
s = hold.state;
const third = s.proposals.find((p) => p.status === "open");
const ex = excludeProposal(s, third!.id, "tester", "원문과 다름");
assert(!ex.error, ex.error || "");
s = ex.state;
const restored = restoreWorkflow(s, first.proposed.id, hid, "tester");
assert(!restored.error, restored.error || "");
assert(!restored.state.workflows.some((w) => w.id === first.proposed.id && w.status === "approved"), "restore unpublish");
console.log("ok", { proposals: s.proposals.length, approved: restored.state.workflows.filter((w) => w.status === "approved").length });

const peeledNew = peelOriginalMethods("신체적·정신적 건강상태를 확인한다 기록 신설");
assert(peeledNew.isNew, "신설");
assert(peeledNew.methods.some((m) => m.label === "기록"), "기록 chip");
assert(!peeledNew.body.includes("신설") && !/(^|\s)기록(\s|$)/.test(peeledNew.body), `body ${peeledNew.body}`);
const splitNew = peelOriginalMethods("기록\n신설");
assert(splitNew.isNew && splitNew.methods.some((m) => m.label === "기록") && !splitNew.body, `split ${JSON.stringify(splitNew)}`);
const glued = peelOriginalMethods("기록을 보관한다");
assert(!glued.methods.length, "기록하고 false positive");

async function checkPayload() {
  const manual = await loadManual();
  const payload = buildReviewPayload(manual.indicators, s, { label: "local-preview", pages: 1 });
  assert(payload.coveredIds.length === 45 && payload.missingIds.length === 0, `coverage ${payload.coveredIds.length} missing ${payload.missingIds.join(",")}`);
  const text = payload.batches.map((b) => b.user).join("\n");
  assert(text.includes("기존 후보"), "candidates header");
  assert(text.includes(first.proposed.name), "seed name in payload");
  assert(text.includes("보류"), "hold notes");
  assert(text.includes("다음에 다시"), "hold reason");
  assert(text.includes("원문과 다름"), "exclude reason");
  assert(text.includes("작성완료일의 다음날까지") || text.includes("작성 완료일의 다음날까지") || text.includes("다음날까지 반영"), "excretion deadline");
  assert(text.includes("중복하는 경우 인정하지 않는다") || text.includes("중복"), "duplicate language");
  assert(text.includes("## 지표 41"), "indicator 41");
  assert(text.includes("## 지표 42"), "indicator 42");
  assert(!text.includes("slice(0, 180)"), "no leftover truncate marker");
  const i28 = text.split("## 지표 28")[1]?.split("## 지표 29")[0] || "";
  assert(i28.includes("확인방법") && i28.length > 400, `i28 packet too short ${i28.length}`);
  const bad: string[] = [];
  for (const p of seedProposals()) {
    for (const src of p.sources) {
      const v = sourceAllowed(src, manual.indicators);
      if (!v.ok) bad.push(`${p.proposed.name} ${src.indicatorId}${src.mark || ""} ${v.reason}`);
    }
  }
  if (bad.length) {
    console.log("source-fail", bad);
    assert(false, `seed quotes ${bad.length}`);
  }
  const i5 = manual.indicators.find((i) => i.id === 5);
  const i6 = manual.indicators.find((i) => i.id === 6);
  const c52 = i5?.fullSource?.criteriaItems.find((c) => c.mark === "②");
  const p52 = peelOriginalMethods(c52?.text || "");
  const m52 = c52?.methods?.length ? extractMethods(c52.methods.join(" ")) : p52.methods;
  assert(m52.some((m) => m.label === "기록"), `5② methods ${m52.map((m) => m.label).join(",")}`);
  assert(p52.isNew || c52?.isNew, "5② 신설");
  assert((p52.body || c52?.text || "").includes("직무스트레스"), `5② body ${p52.body}`);
  const c56 = i5?.fullSource?.criteriaItems.find((c) => c.mark === "⑥");
  const p56 = peelOriginalMethods(c56?.text || "");
  assert((p56.body || c56?.text || "").includes("리프트"), `5⑥ body ${p56.body}`);
  assert(!/^다\.?$/.test((p56.body || "").trim()), "5⑥ leftover 다.");
  const packet5 = text.split("## 지표 5")[1]?.split("## 지표 6")[0] || "";
  assert(packet5.includes("직무스트레스"), "AI packet 5② sentence");
  const emptyBody: string[] = [];
  for (const ind of manual.indicators) {
    for (const it of ind.fullSource?.criteriaItems || []) {
      const body = peelOriginalMethods(it.text).body.replace(/\s+/g, " ").trim();
      const hangul = body.replace(/[^\uac00-\ud7a3]/g, "").length;
      if (!body || hangul < 8 || /^(다|한다|이다)\.?$/.test(body)) emptyBody.push(`${ind.id}${it.mark}`);
    }
  }
  assert(emptyBody.length === 0, `empty criteria ${emptyBody.join(",")}`);
  const m6 = uniqueMethods(
    (i6?.fullSource?.criteriaItems || []).flatMap((c) => (c.methods?.length ? extractMethods(c.methods.join(" ")) : peelOriginalMethods(c.text).methods))
  );
  const labels6 = m6.map((m) => m.label);
  assert(labels6.includes("기록") && labels6.includes("전산") && labels6.includes("면담"), `6 ${labels6.join(",")}`);
  const i20 = manual.indicators.find((i) => i.id === 20);
  const c201 = i20?.fullSource?.criteriaItems.find((c) => c.mark === "①");
  const p201 = peelOriginalMethods(c201?.text || "");
  assert(!p201.body.includes("기록,"), `20① leftover 기록, ${p201.body}`);
  assert(p201.body.includes("생애말기돌봄") && p201.body.includes("호스피스"), `20① body ${p201.body}`);
  const i45 = manual.indicators.find((i) => i.id === 45);
  const c453 = i45?.fullSource?.criteriaItems.find((c) => c.mark === "③");
  const p453 = peelOriginalMethods(c453?.text || "");
  assert(!/기\s+관\s+이/.test(p453.body), `45③ spaced ${p453.body}`);
  assert(p453.body.includes("기관이") && p453.body.includes("본인부담금"), `45③ body ${p453.body}`);
  assert(i45?.name === "서비스 만족도 조사(유선)", `45 name ${i45?.name}`);
  assert(i45?.fullSource?.commonMethods?.includes("유선"), `45 common ${i45?.fullSource?.commonMethods?.join(",")}`);
  assert(i45?.fullSource?.commonMethodNote?.includes("지표 공통"), `45 note ${i45?.fullSource?.commonMethodNote}`);
  assert(c453?.methodScope === "indicator-common", `45③ scope ${c453?.methodScope}`);
  const packet45 = text.split("## 지표 45")[1] || "";
  assert(packet45.includes("평가방법(유선)") || packet45.includes("평가방법공통 유선"), `45 packet method ${packet45.slice(0, 200)}`);
  assert(packet45.includes("지표공통방법"), "45 packet common-method mark");
  const i10 = manual.indicators.find((i) => i.id === 10);
  assert(i10?.name === "낙상예방 환경조성", `10 name ${i10?.name}`);
  const p10 = i10?.fullSource?.filePages || [];
  assert(p10[0] === 52 && p10[p10.length - 1] === 61, `10 pages ${p10[0]}-${p10[p10.length - 1]}`);
  const p45 = i45?.fullSource?.filePages || [];
  assert(p45.length === 1 && p45[0] === 173, `45 pages ${p45.join(",")}`);
  assert(!/청구상담봉사|평가조사표|서비스 만족도보호자/.test(i45?.fullSource?.sections.direction.text || ""), `45 direction ${i45?.fullSource?.sections.direction.text}`);
  const nameMiss: string[] = [];
  const pageMiss: string[] = [];
  for (const ind of manual.indicators) {
    if (!ind.name || ind.name.length < 2 || /합니다/.test(ind.name) || /평가기준/.test(ind.name)) nameMiss.push(`${ind.id}:${ind.name}`);
    const fp = ind.fullSource?.filePages || [];
    if (!fp.length) pageMiss.push(String(ind.id));
  }
  assert(!nameMiss.length, `bad names ${nameMiss.join(" | ")}`);
  assert(!pageMiss.length, `missing pages ${pageMiss.join(",")}`);
  const reviewPages: string[] = [];
  for (const p of seedProposals()) {
    for (const src of p.sources) {
      const v = sourceAllowed(src, manual.indicators);
      if (v.visualCheck) reviewPages.push(`${p.proposed.name} ${src.indicatorId}${src.mark || ""} ${src.filePage || ""}`);
    }
  }
  assert(manual.indicators.every((i) => i.fullSource?.approveStatus === "unapproved"), "approve not bulk-complete");
  assert(manual.indicators.every((i) => i.fullSource?.compareStatus === "not-compared"), "compare not bulk-complete");
  console.log("source-visualCheck", reviewPages.length, reviewPages.slice(0, 8));
  const methodDump = (i5?.fullSource?.sections.methodNote.text || "") + (i6?.fullSource?.sections.methodNote.text || "");
  assert(!/신설/.test(methodDump), `methodNote 신설 ${methodDump}`);
  console.log("payload", { batches: payload.batches.length, chars: text.length, covered: payload.coveredIds.length, i5_2: m52.map((m) => m.label), i6: labels6, i20_1: p201.body.slice(0, 40), i45_3: p453.body.slice(0, 40) });
}

void checkPayload().catch((e) => {
  console.error(e);
  process.exit(1);
});
