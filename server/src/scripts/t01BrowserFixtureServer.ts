import express from 'express';

const app = express();
const port = Number(process.env.PORT || 3103);
const caseId = 'tc-t01-i03';
const stages = [
  'mandate', 'discovery', 'initial_ideas', 'interviews', 'drd', 'opportunity_synthesis',
  'initiative_candidates', 'finance_kpi', 'portfolio_decision', 'mobilization', 'execution',
  'delivery', 'benefits', 'sustainability', 'final_outputs',
];
const transformationCase = {
  transformationCaseId: caseId, organizationId: 'org-t01-i03', projectId: null,
  conversationId: 'conversation-t01', contextSnapshotId: 'snapshot-t01', executionRunId: 'run-t01',
  initiatedByUserId: 'user-t01-actor', mandate: 'Prepare transformation plan', desiredOutcomes: [],
  status: 'active', lifecycleStage: 'final_outputs', autonomyLevel: 'A1_prepare', assumptions: [],
  missingInputs: [], activePlanId: 'plan-t01-i03', lineageId: 'lineage-t01-i03', version: 24,
  createdAt: '2026-08-07T12:00:00.000Z', updatedAt: '2026-08-07T17:20:29.000Z',
  activePlan: {
    planId: 'plan-t01-i03', version: 1, status: 'approved', summary: 'Teresa end-to-end transformation plan',
    steps: stages.map((lifecycleStage, stepIndex) => ({
      stepId: `step-${stepIndex}`, stepIndex, lifecycleStage,
      businessPurpose: `Governed ${lifecycleStage} outcome`, moduleTarget: 'Consultify Agent',
      capabilityStatus: 'REAL', inputs: [], outputs: [], ownerRole: 'Transformation Owner',
      dependsOn: stepIndex ? [stages[stepIndex - 1]] : [], approvalClass: 'requires_human_approval',
      blockerReason: null,
    })),
  },
};
const finalRun = {
  runId: '1009831e-f799-428a-b952-0cb8ceaf52e2', transformationCaseId: caseId, caseVersion: 24,
  factsDigest: 'dca5c568bb6319a6de46b53dd9ca59aff8e1a7cf82326f1deb66b577fbf7c223',
  docxSha256: '0b99987900005c9690974c5819f840dd98344488b01a01b05a08d6adf1d8d260',
  pptxSha256: 'e2c92a488d0a132c7be41f75790e1cb3a71cbf111c25c45c2d94f17a86d4aac5',
  generatedAt: '2026-08-07T17:20:29.000Z', idempotentReplay: true,
};

app.use(express.json());
app.get('/api/v8/transformation-cases', (_req, res) => res.json({ data: [transformationCase] }));
app.get(`/api/v8/transformation-cases/${caseId}`, (_req, res) => res.json({ data: transformationCase }));
app.get(`/api/v8/transformation-cases/${caseId}/final-outputs/latest`, (_req, res) => res.json({ data: finalRun }));
app.get(`/api/v8/transformation-cases/${caseId}/final-outputs/:format/download`, (req, res) => {
  const format = String(req.params.format);
  const root = process.env.T01_OUTPUT_DIR;
  if (!root || !['docx', 'pptx'].includes(format)) return res.sendStatus(404);
  return res.download(`${root}/transformation-${format === 'docx' ? 'final-report.docx' : 'steering-deck.pptx'}`);
});
app.all('/api/v8/transformation-cases/*path', (_req, res) => res.status(404).json({ error: 'Fixture endpoint not materialized' }));
app.listen(port, '127.0.0.1', () => process.stdout.write(`T01 browser fixture listening on ${port}\n`));
