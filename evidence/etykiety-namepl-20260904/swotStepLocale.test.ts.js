import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { GROWTH_PATHS_STEPS, PORTER_STEPS, PORTFOLIO_PRIORITY_STEPS, RISK_UNCERTAINTY_STEPS, SWOT_STEPS } from "@/store/useToolStore";
describe("dynamic SWOT step locale contract", () => {
  it("keeps distinct, complete English and Polish labels for every live step", () => {
    expect(SWOT_STEPS.map(({ id, name, namePl }) => ({ id, name, namePl }))).toEqual([
      { id: "mission", name: "Mission & Context", namePl: "Misja i kontekst" },
      { id: "input", name: "Input & Exploration", namePl: "Materia\u0142y i eksploracja" },
      { id: "swot", name: "SWOT Build", namePl: "Budowa SWOT" },
      { id: "insights", name: "Synthesis & Insights", namePl: "Synteza i napi\u0119cia" },
      { id: "outputs", name: "Outputs & Actions", namePl: "Wyniki i dzia\u0142ania" }
    ]);
    const outputsStep = SWOT_STEPS.find(({ id }) => id === "outputs");
    expect(outputsStep?.namePl).toBe("Wyniki i dzia\u0142ania");
    const documentView = readFileSync(
      path.resolve(process.cwd(), "src/components/DiscoveryTools/ToolDocumentView.tsx"),
      "utf8"
    );
    expect(documentView).toContain("en: step.name");
    expect(documentView).toContain("pl: step.namePl");
    expect(documentView).toContain("? currentStepDef.namePl");
    expect(documentView).not.toContain("pl: isOutputs ? 'Outputs & Actions'");
    expect(documentView).not.toContain("Rezultaty i dzia\u0142ania");
  });
  it("keeps the four live step families aligned with package title.pl by phase id", () => {
    expect(PORTER_STEPS.map(({ id, namePl }) => ({ id, namePl }))).toEqual([
      { id: "mission", namePl: "Misja i kontekst rynku" },
      { id: "input", namePl: "Wej\u015Bcie i eksploracja" },
      { id: "forces", namePl: "Budowa pi\u0119ciu si\u0142" },
      { id: "insights", namePl: "Implikacje strategiczne" },
      { id: "outputs", namePl: "Wyniki i dzia\u0142ania" }
    ]);
    expect(GROWTH_PATHS_STEPS.map(({ id, namePl }) => ({ id, namePl }))).toEqual([
      { id: "mission", namePl: "Misja wzrostu i kontekst" },
      { id: "input", namePl: "Wej\u015Bcie i eksploracja" },
      { id: "options", namePl: "Budowa opcji Ansoffa" },
      { id: "insights", namePl: "Por\xF3wnanie strategiczne" },
      { id: "outputs", namePl: "Wyniki i dzia\u0142ania" }
    ]);
    expect(PORTFOLIO_PRIORITY_STEPS.map(({ id, namePl }) => ({ id, namePl }))).toEqual([
      { id: "mission", namePl: "Misja portfela i kontekst" },
      { id: "input", namePl: "Wej\u015Bcie i eksploracja" },
      { id: "items", namePl: "Elementy portfela i macierz" },
      { id: "insights", namePl: "Trade-offy i priorytety" },
      { id: "outputs", namePl: "Wyniki i dzia\u0142ania" }
    ]);
    expect(RISK_UNCERTAINTY_STEPS.map(({ id, namePl }) => ({ id, namePl }))).toEqual([
      { id: "mission", namePl: "Misja i kontekst" },
      { id: "input", namePl: "Wej\u015Bcie i eksploracja" },
      { id: "assumptions", namePl: "Za\u0142o\u017Cenia i mapa ryzyk" },
      { id: "insights", namePl: "Synteza ryzyka" },
      { id: "outputs", namePl: "Wyniki i dzia\u0142ania" }
    ]);
  });
});
