export type PartnerAudienceId =
  | 'consulting-owner'
  | 'individual-consultant'
  | 'software-house'
  | 'system-integrator'
  | 'boutique-consultancy'
  | 'financial-institution';

export type CooperationModelId =
  | 'referral'
  | 'co-sell'
  | 'powered-by'
  | 'reseller'
  | 'joint-pursuit';

export interface PartnerAudience {
  id: PartnerAudienceId;
  label: string;
  outcome: string;
  useCase: string;
  recommendedModels: CooperationModelId[];
  partnerContribution: string;
  consultifyContribution: string;
  firstStep: string;
}

export interface CooperationModel {
  id: CooperationModelId;
  label: string;
  bestFor: string;
  partnerContribution: string;
  consultifyContribution: string;
  boundary: string;
}

export interface FirstDealStage {
  id: 'qualify' | 'align' | 'enable' | 'pursuit' | 'pilot' | 'expand';
  label: string;
  owner: string;
  output: string;
  proof: string;
}

/**
 * PAR-OWN-001 publication-safe content.
 *
 * These statements are qualitative program design statements derived from the
 * Partner Motion Playbook and persona corpus. They intentionally contain no
 * commission, tier, payout, SLA or quantified outcome promises. Commercial
 * facts remain governed by AMD-PRT-ECONOMICS-002 and the executed agreement.
 */
export const PARTNER_AUDIENCES: PartnerAudience[] = [
  {
    id: 'consulting-owner',
    label: 'Consulting Owner',
    outcome: 'Extend your firm’s offer without building a separate transformation platform.',
    useCase: 'Package strategy and execution work into a more repeatable client engagement.',
    recommendedModels: ['co-sell', 'powered-by'],
    partnerContribution: 'Client relationship, domain expertise and delivery leadership.',
    consultifyContribution: 'Methodology, structured workspace and deal enablement where approved.',
    firstStep: 'Select one existing account and define a bounded joint opportunity.',
  },
  {
    id: 'individual-consultant',
    label: 'Individual Consultant',
    outcome: 'Add a structured transformation offer to your independent practice.',
    useCase: 'Turn a trusted client conversation into a clearly scoped first engagement.',
    recommendedModels: ['referral', 'co-sell'],
    partnerContribution: 'Trusted introduction, discovery context and client continuity.',
    consultifyContribution: 'Program narrative, working method and agreed pursuit support.',
    firstStep: 'Describe the client situation and choose referral or co-sell for review.',
  },
  {
    id: 'software-house',
    label: 'Software House',
    outcome: 'Connect implementation delivery with an earlier transformation conversation.',
    useCase: 'Explore a broader advisory and execution scope with an existing B2B client.',
    recommendedModels: ['reseller', 'co-sell'],
    partnerContribution: 'Account access, technical delivery and implementation ownership.',
    consultifyContribution: 'Transformation framing, methodology and platform context.',
    firstStep: 'Choose one account where the business need is wider than a technical backlog.',
  },
  {
    id: 'system-integrator',
    label: 'System Integrator',
    outcome: 'Shape a joint pursuit that links enterprise change with implementation scale.',
    useCase: 'Enter the client conversation before the solution is reduced to a technology scope.',
    recommendedModels: ['joint-pursuit', 'co-sell'],
    partnerContribution: 'Enterprise access, integration capability and delivery scale.',
    consultifyContribution: 'Decision framing, transformation method and agreed pursuit assets.',
    firstStep: 'Align on one account, sponsor and decision problem before approaching the client.',
  },
  {
    id: 'boutique-consultancy',
    label: 'Boutique Consultancy',
    outcome: 'Make specialist expertise easier to package into a repeatable client journey.',
    useCase: 'Combine a strong domain position with structured transformation outputs.',
    recommendedModels: ['powered-by', 'co-sell'],
    partnerContribution: 'Specialist expertise, senior delivery and client credibility.',
    consultifyContribution: 'Reusable method, workspace structure and enablement materials.',
    firstStep: 'Select a signature use case and define the client-ready output together.',
  },
  {
    id: 'financial-institution',
    label: 'Financial Institution',
    outcome: 'Explore a transformation support offer for selected portfolio or business clients.',
    useCase: 'Add a structured advisory layer where client capability matters to the relationship.',
    recommendedModels: ['referral', 'joint-pursuit'],
    partnerContribution: 'Approved client access, relationship governance and compliance context.',
    consultifyContribution:
      'Transformation framing and a bounded enablement path subject to review.',
    firstStep: 'Validate compliance, client ownership and the first eligible use case.',
  },
];

export const COOPERATION_MODELS: CooperationModel[] = [
  {
    id: 'referral',
    label: 'Referral',
    bestFor: 'A qualified introduction without shared delivery.',
    partnerContribution: 'Identify the opportunity and make the approved introduction.',
    consultifyContribution: 'Qualify the need and own the Consultify sales process.',
    boundary: 'Client ownership and any commercial recognition are defined in the agreement.',
  },
  {
    id: 'co-sell',
    label: 'Co-sell',
    bestFor: 'A joint client conversation with complementary expertise.',
    partnerContribution: 'Lead the relationship and agreed parts of the pursuit or delivery.',
    consultifyContribution: 'Support framing, demonstration and the agreed transformation scope.',
    boundary: 'Roles, pricing and client communication are aligned before the pursuit begins.',
  },
  {
    id: 'powered-by',
    label: 'White-label / Powered-by',
    bestFor: 'A partner-led offer using an agreed Consultify layer.',
    partnerContribution: 'Own the brand, client relationship and delivery team.',
    consultifyContribution: 'Provide the agreed method, platform scope and enablement.',
    boundary: 'Brand, IP, data and permitted claims require written terms before use.',
  },
  {
    id: 'reseller',
    label: 'Reseller',
    bestFor: 'A repeatable offer distributed through an established customer base.',
    partnerContribution: 'Own pipeline development and the agreed implementation scope.',
    consultifyContribution:
      'Provide approved packaging, enablement and product support boundaries.',
    boundary: 'Availability and economics depend on the executed reseller agreement.',
  },
  {
    id: 'joint-pursuit',
    label: 'Strategic / Joint pursuit',
    bestFor: 'A larger account requiring joint positioning and coordinated delivery.',
    partnerContribution: 'Bring executive access, integration capacity and account leadership.',
    consultifyContribution: 'Bring transformation framing, methodology and agreed pursuit support.',
    boundary:
      'Governance, exclusivity and responsibilities are decided opportunity by opportunity.',
  },
];

export const FIRST_DEAL_STAGES: FirstDealStage[] = [
  {
    id: 'qualify',
    label: 'Qualify',
    owner: 'Partner + Consultify',
    output: 'A named account, decision problem and reason to act.',
    proof: 'Both sides agree the opportunity is worth a discovery conversation.',
  },
  {
    id: 'align',
    label: 'Align',
    owner: 'Joint pursuit lead',
    output: 'A one-page responsibility, scope and success definition.',
    proof: 'Client ownership, delivery roles and next meeting are explicit.',
  },
  {
    id: 'enable',
    label: 'Enable',
    owner: 'Consultify program team',
    output: 'Only the approved narrative, use case and working materials.',
    proof: 'The partner can explain the offer without unsupported claims.',
  },
  {
    id: 'pursuit',
    label: 'Pursuit',
    owner: 'Agreed account lead',
    output: 'A coordinated client conversation and qualified opportunity.',
    proof: 'The client confirms a concrete problem and a decision path.',
  },
  {
    id: 'pilot',
    label: 'Pilot',
    owner: 'Agreed delivery lead',
    output: 'A bounded scope, owners, evidence and acceptance conditions.',
    proof: 'The agreed pilot outcome is reviewed against its own criteria.',
  },
  {
    id: 'expand',
    label: 'Expand',
    owner: 'Partner + account owner',
    output: 'A decision to stop, repeat or extend based on evidence.',
    proof: 'Expansion follows verified value, not an assumed success story.',
  },
];

export const PROHIBITED_PARTNER_MARKETING_STRINGS = [
  'Nordic Digital Solutions',
  'TransformACE Consulting',
  '€100',
  '< 4 godziny',
  'up to 20%',
] as const;
