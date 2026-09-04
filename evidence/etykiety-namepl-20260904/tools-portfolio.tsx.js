import { jsx } from "react/jsx-runtime";
import React from "react";
import { DiscoveryToolsHub } from "@/components/Discovery/DiscoveryToolsHub";
import { AppProviders } from "@/providers/AppProviders";
import { Api } from "@/services/api";
const SESSION_ID = "sess-day364-portfolio";
const PORTFOLIO_DATA = {
  context: {
    goal: "Zdecydowa\u0107, czy i jak wej\u015B\u0107 na rynek DACH w tym kwartale.",
    scope: "Segment M\u015AP, oferta wdro\u017Ceniowa, rynek DACH.",
    timeframe: "this-quarter",
    successSignal: "Podpisany pilot referencyjny do ko\u0144ca kwarta\u0142u."
  },
  signals: [],
  items: [
    { id: "i1", text: "Zesp\xF3\u0142 wdro\u017Ceniowy z 40 zamkni\u0119tymi projektami", impact: "high", quadrant: "strengths", proposalStatus: "accepted", evidenceStatus: "confirmed" },
    { id: "i2", text: "Certyfikacja ISO 27001 od 2023", impact: "medium", quadrant: "strengths", proposalStatus: "accepted", evidenceStatus: "confirmed" },
    { id: "i3", text: "Czas wdro\u017Cenia 2\xD7 d\u0142u\u017Cszy ni\u017C u konkurencji", impact: "high", quadrant: "weaknesses", proposalStatus: "accepted", evidenceStatus: "confirmed" },
    { id: "i4", text: "Brak lokalnego zespo\u0142u wsparcia w DACH", impact: "medium", quadrant: "weaknesses", proposalStatus: "accepted", evidenceStatus: "declared" },
    { id: "i5", text: "Popyt w DACH ro\u015Bnie trzeci kwarta\u0142 z rz\u0119du", impact: "high", quadrant: "opportunities", proposalStatus: "accepted", evidenceStatus: "declared" },
    { id: "i6", text: "Program dotacji na cyfryzacj\u0119 M\u015AP w 2026", impact: "medium", quadrant: "opportunities", proposalStatus: "ai-proposed" },
    { id: "i7", text: "Konkurent obni\u017Cy\u0142 cen\u0119 wej\u015Bcia o 30%", impact: "medium", quadrant: "threats", proposalStatus: "accepted", evidenceStatus: "confirmed" },
    { id: "i8", text: "Nowy gracz z USA zapowiedzia\u0142 wej\u015Bcie na rynek PL", impact: "high", quadrant: "threats", proposalStatus: "ai-proposed" }
  ],
  tensions: [
    { id: "t1", title: "Do\u015Bwiadczony zesp\xF3\u0142 \xD7 rosn\u0105cy popyt w DACH", type: "attack", linkedCorrelationIds: [], linkedItemIds: ["i1", "i5"], insight: "Przewaga wdro\u017Ceniowa jest niewykorzystana w otwieraj\u0105cym si\u0119 oknie." },
    { id: "t2", title: "D\u0142ugi czas wdro\u017Cenia \xD7 presja cenowa", type: "protect", linkedCorrelationIds: [], linkedItemIds: ["i3", "i7"], insight: "Wolne wdro\u017Cenie zwi\u0119ksza ekspozycj\u0119 na ta\u0144szego konkurenta." }
  ],
  correlations: [],
  recommendedMoves: [
    { id: "m1", title: "Uruchomi\u0107 pilota referencyjnego w DACH", category: "quick-win", rationale: "Popyt ro\u015Bnie, zdolno\u015B\u0107 wdro\u017Ceniowa wolna.", linkedTensionIds: ["t1"], linkedItemIds: ["i1", "i5"], expectedImpact: "high", estimatedEffort: "medium", firstStep: "Wybra\u0107 klienta pilota\u017Cowego", ownerRole: "Dyrektor sprzeda\u017Cy" }
  ],
  outputCandidates: []
};
const SESSION_ROW = {
  id: SESSION_ID,
  name: "Priorytety portfela 2027",
  toolType: "portfolio-priority",
  tool_type: "portfolio-priority",
  status: "DRAFT",
  category: "strategic",
  completion_percent: 40,
  completionPercent: 40,
  createdAt: "2026-08-10T09:00:00Z",
  updatedAt: "2026-08-13T11:40:00Z",
  answers: PORTFOLIO_DATA,
  inputData: PORTFOLIO_DATA,
  generatedInitiatives: [],
  decisions: [],
  permissions: { canRequestReview: true, canApproveTool: true, canGenerate: true }
};
const USERS = [
  { id: "u1", firstName: "Piotr", lastName: "Wi\u015Bniewski", email: "piotr@dbr77.com", name: "Piotr Wi\u015Bniewski" }
];
let patched = false;
const patchApi = () => {
  if (patched) return;
  patched = true;
  const api = Api;
  api.listToolSessions = async () => [SESSION_ROW];
  api.getToolSession = async () => SESSION_ROW;
  api.updateToolSession = async () => SESSION_ROW;
  api.createToolSession = async () => SESSION_ROW;
  api.getToolGeneratedInitiatives = async () => [];
  api.listAssessmentsLegacy = async () => ({ items: [], total: 0, limit: 100, offset: 0 });
  api.getAssessmentReports = async () => [];
  api.getKnownTools = async () => ({ items: [], total: 0, limit: 50, offset: 0 });
  api.getUsers = async () => USERS;
  api.getInitiativesByStatus = async () => [];
  api.getInitiativeById = async () => null;
  api.getInitiativeTasks = async () => [];
  api.getLinkGraphBacklinks = async () => [];
  api.suggestTools = async () => [];
  api.organizationContextGet = async () => ({ context: null });
  api.get = async () => [];
  api.post = async () => ({});
  api.patch = async () => ({});
  api.delete = async () => ({});
};
const seedOpenSession = () => {
  window.sessionStorage.setItem(
    "moduleHub.openDocuments.tools",
    JSON.stringify({
      openDocuments: [
        {
          id: SESSION_ID,
          name: SESSION_ROW.name,
          type: "tool",
          subType: "portfolio-priority",
          status: "DRAFT"
        }
      ],
      activeDocumentId: SESSION_ID
    })
  );
};
function ToolsPortfolioPrioritySessionWorkspaceScreen() {
  const [ready, setReady] = React.useState(false);
  React.useEffect(() => {
    patchApi();
    seedOpenSession();
    setReady(true);
  }, []);
  if (!ready) return null;
  return /* @__PURE__ */ jsx(AppProviders, { children: /* @__PURE__ */ jsx("div", { className: "h-screen w-screen overflow-hidden bg-c-bg text-c-text", children: /* @__PURE__ */ jsx(DiscoveryToolsHub, { initialTab: "sessions" }) }) });
}
export {
  ToolsPortfolioPrioritySessionWorkspaceScreen as default
};
