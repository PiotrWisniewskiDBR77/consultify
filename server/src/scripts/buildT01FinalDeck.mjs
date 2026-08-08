import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const factsPath = process.argv[2];
const outputPath = process.argv[3];
if (!factsPath || !outputPath) throw new Error("Usage: buildT01FinalDeck.mjs facts.json output.pptx");
const facts = JSON.parse(await fs.readFile(factsPath, "utf8"));
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object")
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  return value;
}
const canonical = JSON.stringify(stable(facts));
const digest = crypto.createHash("sha256").update(canonical).digest("hex");
const deck = Presentation.create({ slideSize: { width: 1280, height: 720 } });
const INK = "#000000";
const PANEL = "#EDEDED";
const ACCENT = "#3D8DFF";
const LIGHT = "#D0EDFA";

function text(slide, name, value, left, top, width, height, fontSize = 24, bold = false, color = INK) {
  const box = slide.shapes.add({
    geometry: "textbox",
    name,
    position: { left, top, width, height },
    fill: "none",
    line: { style: "solid", fill: "none", width: 0 },
  });
  box.text = String(value);
  box.text.style = {
    fontSize,
    bold,
    color,
    typeface: "Helvetica Neue",
    autoFit: "shrinkText",
  };
  return box;
}

function title(slide, value, page) {
  text(slide, `title-${page}`, value, 41, 36, 1197, 100, 47, true);
  text(slide, `page-${page}`, String(page), 1184, 660, 55, 24, 14, false);
}

function notes(slide) {
  slide.speakerNotes.textFrame.setText(`[Sources]\n- ${factsPath}\n- factsDigest: ${digest}`);
}

function panel(slide, name, left, top, width, height) {
  return slide.shapes.add({
    geometry: "rect",
    name,
    position: { left, top, width, height },
    fill: PANEL,
    line: { style: "solid", fill: "none", width: 0 },
  });
}

{
  const slide = deck.slides.add();
  text(slide, "cover-kicker", "CONSULTIFY · TERESA + AGENT", 41, 41, 700, 50, 26, false);
  text(slide, "cover-title", "Transformacja\nod mandatu do trwałej wartości", 41, 174, 1000, 290, 68, true);
  text(slide, "cover-subtitle", `${facts.transformationCaseId} · ${facts.status}`, 41, 520, 900, 72, 24, false);
  notes(slide);
}

{
  const slide = deck.slides.add();
  title(slide, "Agent dowiózł proces, nie tylko dokument", 2);
  text(slide, "claim", facts.executiveConclusion, 41, 190, 1050, 235, 42, false);
  text(slide, "guardrail", "Każdy materialny zapis i przejście pozostały za akceptacją człowieka.", 41, 520, 900, 70, 24, true, ACCENT);
  notes(slide);
}

{
  const slide = deck.slides.add();
  title(slide, "Jeden Case zachował ciągłość przez 14 etapów", 3);
  slide.shapes.add({
    geometry: "straightConnector1",
    name: "timeline-line",
    position: { left: 42, top: 352, width: 1190, height: 0 },
    fill: "none",
    line: { style: "solid", fill: INK, width: 2 },
  });
  const groups = [
    ["01–04", "Mandat · Ideas\nInterviews · DRD"],
    ["05–08", "Synteza · Initiative\nFinance/KPI · GO"],
    ["09–11", "Mobilization\nExecution · Delivery"],
    ["12–14", "Benefits · Sustainability\nFinal outputs"],
  ];
  groups.forEach(([label, body], index) => {
    const x = 42 + index * 297;
    slide.shapes.add({ geometry: "ellipse", name: `timeline-dot-${index}`, position: { left: x, top: 344, width: 16, height: 16 }, fill: index === 3 ? ACCENT : INK, line: { style: "solid", fill: "none", width: 0 } });
    text(slide, `timeline-label-${index}`, label, x, 280, 150, 42, 22, true);
    text(slide, `timeline-body-${index}`, body, x, 395, 255, 120, 23, false);
  });
  notes(slide);
}

{
  const slide = deck.slides.add();
  title(slide, "Proces pozostawił trwałe rekordy w modułach Consultify", 4);
  const stats = [
    [facts.outputs.ideas, "idei"],
    [facts.outputs.interviewAssignments, "interview"],
    [facts.outputs.initiatives, "Initiative"],
    [facts.outputs.tasks, "zadania"],
    [facts.outputs.milestones, "milestones"],
    [facts.outputs.verifiedBenefitMeasurements, "pomiary"],
  ];
  stats.forEach(([value, label], index) => {
    const col = index % 3;
    const row = Math.floor(index / 3);
    const x = 41 + col * 411;
    const y = 180 + row * 220;
    panel(slide, `stat-panel-${index}`, x, y, 375, 180);
    text(slide, `stat-value-${index}`, value, x + 28, y + 24, 310, 82, 54, true, index === 5 ? ACCENT : INK);
    text(slide, `stat-label-${index}`, label, x + 28, y + 112, 310, 38, 22, false);
  });
  notes(slide);
}

{
  const slide = deck.slides.add();
  title(slide, "Korzyść roczna osiągnęła 93,3% prognozy", 5);
  slide.charts.add("bar", {
    position: { left: 41, top: 170, width: 710, height: 430 },
    categories: ["Prognoza", "Actual"],
    series: [{ name: "PLN", values: [facts.finance.forecastBenefitAnnual, facts.finance.actualBenefitAnnual], fill: ACCENT }],
    hasLegend: false,
    dataLabels: { showValue: true, position: "outEnd" },
  });
  text(slide, "finance-meaning", "Wartość została zmierzona jako actual — nie wywnioskowana z samego statusu DONE.", 800, 220, 400, 130, 28, true);
  text(slide, "finance-classification", `Klasyfikacja: ${facts.finance.classification}`, 800, 430, 400, 60, 24, false, ACCENT);
  notes(slide);
}

{
  const slide = deck.slides.add();
  title(slide, "KPI utrzymał wynik przez odrębne 31-dniowe okno", 6);
  slide.charts.add("line", {
    position: { left: 41, top: 155, width: 760, height: 455 },
    categories: ["Baseline", "Target / delivery", "Sustainability"],
    series: [
      { name: facts.kpi.name, values: [facts.kpi.baseline, facts.kpi.deliveryActual, facts.kpi.sustainabilityActual], line: { style: "solid", width: 4, fill: ACCENT }, marker: { symbol: "circle", size: 8 } },
    ],
    hasLegend: false,
    dataLabels: { showValue: true, position: "above" },
  });
  panel(slide, "kpi-callout", 850, 280, 350, 230);
  text(slide, "kpi-stat", `${facts.kpi.sustainabilityActual} ${facts.kpi.unit}`, 880, 320, 290, 80, 46, true, ACCENT);
  text(slide, "kpi-body", `Cel: ${facts.kpi.target} ${facts.kpi.unit}\nStatus: ${facts.kpi.status}`, 880, 420, 290, 65, 22, false);
  notes(slide);
}

{
  const slide = deck.slides.add();
  title(slide, "Governance oddzielił dostarczenie, efekt i trwałość", 7);
  const rows = [
    ["Delivery", "Initiative DONE + komplet WBS", "przyjęte"],
    ["Benefits", "owner + actual KPI + actual Finance", facts.governance.effectiveness],
    ["Sustainability", "2 pomiary · ≥30 dni", facts.governance.sustainabilityConclusion],
  ];
  rows.forEach(([stage, gate, result], index) => {
    const y = 180 + index * 140;
    text(slide, `gate-stage-${index}`, stage, 41, y, 250, 50, 27, true);
    text(slide, `gate-rule-${index}`, gate, 330, y, 550, 60, 23, false);
    text(slide, `gate-result-${index}`, result, 930, y, 260, 50, 23, true, ACCENT);
    slide.shapes.add({ geometry: "straightConnector1", name: `gate-line-${index}`, position: { left: 41, top: y + 78, width: 1150, height: 0 }, fill: "none", line: { style: "solid", fill: "#B8BCC4", width: 1 } });
  });
  notes(slide);
}

{
  const slide = deck.slides.add();
  text(slide, "close-kicker", "LOCAL FLOW VERIFIED", 41, 41, 500, 50, 26, false);
  text(slide, "close-title", "Pełny proces przeszedł lokalny pakiet dowodowy", 41, 180, 1100, 160, 54, true);
  text(slide, "close-body", "A05/A06 + realDB + A10 5/5\nDOCX/PPTX: manifest i fizyczny rehash\nNastępna bramka: same-SHA deployment, browser/RBAC i outcome", 41, 400, 1050, 190, 25, false);
  text(slide, "close-digest", `facts ${digest.slice(0, 12)}`, 930, 610, 300, 34, 16, false, ACCENT);
  notes(slide);
}

await fs.mkdir(path.dirname(outputPath), { recursive: true });
const pptx = await PresentationFile.exportPptx(deck);
await pptx.save(outputPath);
console.log(JSON.stringify({ output: outputPath, factsDigest: digest, slides: deck.slides.items.length }));
