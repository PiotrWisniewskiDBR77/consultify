/**
 * permissions — role audytowe i segregacja obowiązków (segregation of duties).
 *
 * DLACZEGO OSOBNY MODUŁ:
 * Dzisiejsze `/api/audit/programs*` chroni wyłącznie `requireOrgAccess()`, więc
 * każdy członek organizacji może utworzyć, zmienić i usunąć program audytowy.
 * Dla audytu to nie jest drobiazg — cała wartość modułu polega na tym, że
 * ustalenia da się obronić. Jeżeli audytowany może sam zatwierdzić własną
 * zgodność albo zamknąć własne ustalenie, raport jest bezwartościowy.
 *
 * Reguły są tutaj DANYMI, nie rozsypanymi warunkami w handlerach — dzięki temu
 * da się je przetestować deny-path po jednym miejscu i pokazać w UI („dlaczego
 * ten przycisk jest niedostępny").
 *
 * Role platformowe (`admin`, `superadmin`) NIE nadpisują ról audytowych przy
 * czynnościach merytorycznych. Administrator organizacji może zarządzać
 * programem, ale nie „staje się" przez to niezależnym audytorem — inaczej
 * segregacja obowiązków byłaby fikcją.
 */

import {
  AuditPermissionError,
  auditAll,
  auditGet,
} from './auditsDb.js';
import type { AuditActor, AuditRole, PackDecisionRules } from './types.js';

// ---------------------------------------------------------------------------
// Katalog czynności
// ---------------------------------------------------------------------------

export const AUDIT_CAPABILITIES = [
  // Library / pakiety
  'pack.read',
  'pack.write',
  'pack.publish',
  'pack.approve_expert',
  'source.write',
  'source.verify',

  // Program
  'program.read',
  'program.create',
  'program.update',
  'program.delete',
  'program.manage_members',
  'program.advance_lifecycle',
  'program.close',

  // Praca merytoryczna
  'criterion.assign',
  'criterion.respond_as_auditee',
  'criterion.perform_test',
  'criterion.conclude',
  'evidence_request.create',
  'evidence.submit',
  'evidence.review',

  // Ustalenia
  'finding.draft',
  'finding.update',
  'finding.review',
  'finding.confirm',
  'finding.send_back',
  'finding.respond_as_management',
  'finding.close',
  'finding.accept_residual_risk',

  // Naprawa i weryfikacja
  'action.propose',
  'action.approve',
  'action.report_implementation',
  'verification.perform',

  // Wyniki
  'output.finalize',
  'report.draft',
  'report.approve',
  'report.publish',
  'proposal.draft',
  'proposal.register',

  // Teresa
  'ai.propose',
  'ai.commit',
] as const;
export type AuditCapability = (typeof AUDIT_CAPABILITIES)[number];

// ---------------------------------------------------------------------------
// Macierz rola → czynności
// ---------------------------------------------------------------------------

const ROLE_CAPABILITIES: Record<AuditRole, AuditCapability[]> = {
  program_owner: [
    'pack.read',
    'program.read',
    'program.create',
    'program.update',
    'program.manage_members',
    'program.advance_lifecycle',
    'program.close',
    'evidence_request.create',
    'finding.accept_residual_risk',
    'report.approve',
    'proposal.draft',
    'proposal.register',
    'ai.propose',
  ],
  lead_auditor: [
    'pack.read',
    'program.read',
    'program.update',
    'program.manage_members',
    'program.advance_lifecycle',
    'program.close',
    'criterion.assign',
    'criterion.perform_test',
    'criterion.conclude',
    'evidence_request.create',
    'evidence.review',
    'finding.draft',
    'finding.update',
    'finding.review',
    'finding.confirm',
    'finding.send_back',
    'finding.close',
    'action.approve',
    'verification.perform',
    'output.finalize',
    'report.draft',
    'report.approve',
    'report.publish',
    'proposal.draft',
    'ai.propose',
    'ai.commit',
  ],
  auditor: [
    'pack.read',
    'program.read',
    'criterion.perform_test',
    'criterion.conclude',
    'evidence_request.create',
    'evidence.review',
    'finding.draft',
    'finding.update',
    'verification.perform',
    'report.draft',
    'proposal.draft',
    'ai.propose',
    'ai.commit',
  ],
  technical_expert: [
    'pack.read',
    'program.read',
    'evidence.review',
    'finding.draft',
    'ai.propose',
  ],
  auditee: [
    'program.read',
    'criterion.respond_as_auditee',
    'evidence.submit',
    'finding.respond_as_management',
    'action.propose',
    'action.report_implementation',
    'ai.propose',
  ],
  evidence_owner: ['program.read', 'evidence.submit', 'ai.propose'],
  reviewer: [
    'program.read',
    'evidence.review',
    'finding.review',
    'finding.confirm',
    'finding.send_back',
    'finding.close',
    'action.approve',
    'verification.perform',
    'report.approve',
  ],
  action_owner: [
    'program.read',
    'action.report_implementation',
    'evidence.submit',
    'ai.propose',
  ],
  administrator: [
    'pack.read',
    'pack.write',
    'source.write',
    'program.read',
    'program.create',
    'program.update',
    'program.delete',
    'program.manage_members',
  ],
  viewer: ['pack.read', 'program.read'],
};

/**
 * Czynności dostępne dla członka organizacji bez przypisanej roli audytowej.
 * Świadomie minimalne: kto nie należy do zespołu audytowego, nie widzi cudzych
 * dowodów ani ustaleń.
 *
 * `program.create` jest tu celowo, mimo że reszta czynności programowych
 * wymaga roli. Powód jest strukturalny: ról audytowych udziela się W PROGRAMIE,
 * więc dopóki program nie istnieje, nikt nie może mieć w nim roli — bramkowanie
 * tworzenia rolą audytową zamknęłoby moduł w błędnym kole i zostawiło
 * zakładanie audytów wyłącznie administratorom platformy. Ryzyko jest tu małe:
 * utworzenie programu to zapis roboczy, a twórca staje się jego
 * `program_owner`. Kosztowne czynności — wniosek o zgodności, ustalenie,
 * zatwierdzenie, weryfikacja skuteczności, zamknięcie — pozostają za rolami.
 */
const ORG_MEMBER_CAPABILITIES: AuditCapability[] = ['pack.read', 'program.create'];

/**
 * Czynności, których nie odblokuje żadna rola platformowa — wymagają jawnego
 * przypisania roli audytowej w konkretnym programie.
 */
const PLATFORM_ADMIN_CAPABILITIES: AuditCapability[] = [
  'pack.read',
  'pack.write',
  'source.write',
  'program.read',
  'program.create',
  'program.update',
  'program.delete',
  'program.manage_members',
];

// ---------------------------------------------------------------------------
// Odczyt ról
// ---------------------------------------------------------------------------

export async function getProgramRoles(
  organizationId: string,
  programId: string,
  userId: string,
): Promise<AuditRole[]> {
  const rows = await auditAll<{ member_role: string }>(
    `SELECT member_role FROM audit_program_members
      WHERE organization_id = $1 AND program_id = $2 AND user_id = $3
        AND removed_at IS NULL`,
    [organizationId, programId, userId],
  );
  return rows.map((r) => r.member_role as AuditRole);
}

/**
 * Role platformowe uprawniające do administrowania biblioteką pakietów.
 *
 * `administrator` jest tu obowiązkowo: `mapRoleForAuthenticatedUser` w
 * `auth.middleware.ts` normalizuje `admin` z tokenu właśnie do tej postaci.
 * Sprawdzanie samego `admin` cicho odcinało administratorów organizacji od
 * rejestru źródeł — wyszło dopiero na teście przez realny HTTP, bo testy
 * serwisowe podają `platformRole` wprost i omijają middleware.
 */
const PLATFORM_ADMIN_ROLES = new Set(['admin', 'administrator', 'owner', 'superadmin']);

export function isPlatformAdmin(actor: AuditActor): boolean {
  return PLATFORM_ADMIN_ROLES.has(String(actor.platformRole || '').toLowerCase());
}

export function capabilitiesForRoles(roles: AuditRole[]): Set<AuditCapability> {
  const set = new Set<AuditCapability>(ORG_MEMBER_CAPABILITIES);
  for (const role of roles) {
    for (const cap of ROLE_CAPABILITIES[role] ?? []) set.add(cap);
  }
  return set;
}

export interface ProgramAccess {
  roles: AuditRole[];
  capabilities: Set<AuditCapability>;
  isMember: boolean;
  isPlatformAdmin: boolean;
}

export async function resolveProgramAccess(
  actor: AuditActor,
  programId: string,
): Promise<ProgramAccess> {
  const roles = await getProgramRoles(actor.organizationId, programId, actor.userId);
  const capabilities = capabilitiesForRoles(roles);
  const platformAdmin = isPlatformAdmin(actor);
  if (platformAdmin) {
    for (const cap of PLATFORM_ADMIN_CAPABILITIES) capabilities.add(cap);
  }
  return {
    roles,
    capabilities,
    isMember: roles.length > 0,
    isPlatformAdmin: platformAdmin,
  };
}

export function assertCapability(
  access: ProgramAccess,
  capability: AuditCapability,
  hint?: string,
): void {
  if (!access.capabilities.has(capability)) {
    throw new AuditPermissionError(
      hint ??
        `Ta czynność (${capability}) wymaga roli audytowej, której nie masz w tym programie`,
    );
  }
}

export async function requireCapability(
  actor: AuditActor,
  programId: string,
  capability: AuditCapability,
  hint?: string,
): Promise<ProgramAccess> {
  const access = await resolveProgramAccess(actor, programId);
  assertCapability(access, capability, hint);
  return access;
}

// ---------------------------------------------------------------------------
// Segregacja obowiązków — reguły ponad macierzą ról
// ---------------------------------------------------------------------------

/**
 * Audytowany nie może zatwierdzić własnej zgodności.
 *
 * Reguła jest bezwarunkowa: nawet gdy ta sama osoba ma równolegle rolę
 * audytora, nie wolno jej wyciągnąć wniosku dla kryterium, na które sama
 * odpowiadała jako strona audytowana.
 */
export async function assertNotConcludingOwnResponse(
  organizationId: string,
  criterionId: string,
  userId: string,
): Promise<void> {
  const row = await auditGet<{ auditee_responded_by: string | null; assigned_auditee_id: string | null }>(
    `SELECT auditee_responded_by, assigned_auditee_id
       FROM audit_program_criteria
      WHERE organization_id = $1 AND id = $2`,
    [organizationId, criterionId],
  );
  if (!row) return;
  if (row.auditee_responded_by && row.auditee_responded_by === userId) {
    throw new AuditPermissionError(
      'Nie możesz wyciągnąć wniosku audytowego dla kryterium, na które sam odpowiadałeś jako strona audytowana',
    );
  }
}

/**
 * Właściciel ustalenia nie zamyka własnego ustalenia.
 */
export async function assertNotClosingOwnFinding(
  organizationId: string,
  findingId: string,
  userId: string,
): Promise<void> {
  const row = await auditGet<{ owner_user_id: string | null }>(
    `SELECT owner_user_id FROM audit_program_findings
      WHERE organization_id = $1 AND id = $2`,
    [organizationId, findingId],
  );
  if (row?.owner_user_id && row.owner_user_id === userId) {
    throw new AuditPermissionError(
      'Właściciel ustalenia nie może go sam zamknąć — zamknięcie wymaga niezależnej weryfikacji',
    );
  }
}

/**
 * Właściciel działania nie weryfikuje sam skuteczności swojego działania —
 * o ile polityka pakietu wymaga niezależności (domyślnie: wymaga).
 */
export async function assertIndependentVerifier(
  organizationId: string,
  correctiveActionId: string,
  userId: string,
  decisionRules?: PackDecisionRules,
): Promise<void> {
  const requireIndependent = decisionRules?.requireIndependentVerification !== false;
  if (!requireIndependent) return;

  const row = await auditGet<{ owner_user_id: string | null; implemented_by: string | null }>(
    `SELECT owner_user_id, implemented_by FROM audit_corrective_actions
      WHERE organization_id = $1 AND id = $2`,
    [organizationId, correctiveActionId],
  );
  if (!row) return;
  if (row.owner_user_id === userId || row.implemented_by === userId) {
    throw new AuditPermissionError(
      'Weryfikację skuteczności musi wykonać osoba inna niż właściciel lub wykonawca działania',
    );
  }
}

/**
 * Recenzent ustalenia nie może być jego autorem.
 */
export async function assertNotReviewingOwnFinding(
  organizationId: string,
  findingId: string,
  userId: string,
): Promise<void> {
  const row = await auditGet<{ author_id: string | null }>(
    `SELECT author_id FROM audit_program_findings
      WHERE organization_id = $1 AND id = $2`,
    [organizationId, findingId],
  );
  if (row?.author_id && row.author_id === userId) {
    throw new AuditPermissionError(
      'Autor ustalenia nie może być jego recenzentem',
    );
  }
}

/**
 * Akceptacja ryzyka rezydualnego wymaga wskazanej roli (domyślnie: właściciel
 * programu). To jawna decyzja biznesowa, nie skutek uboczny statusu zadania.
 */
export function assertCanAcceptResidualRisk(
  access: ProgramAccess,
  decisionRules?: PackDecisionRules,
): void {
  const allowed = decisionRules?.riskAcceptanceRoles ?? ['program_owner'];
  const has = access.roles.some((r) => allowed.includes(r));
  if (!has) {
    throw new AuditPermissionError(
      `Akceptacja ryzyka rezydualnego wymaga roli: ${allowed.join(', ')}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Granice Teresy
// ---------------------------------------------------------------------------

/**
 * Zbiór czynności, których nie wolno wykonać w imieniu AI — nawet gdy człowiek
 * kliknął „zastosuj". Commit propozycji AI zawsze wykonuje się w kontekście
 * uprawnień CZŁOWIEKA, a te operacje wymagają dodatkowo jego jawnej decyzji w
 * dedykowanym kroku, nie przez akceptację podpowiedzi.
 */
const AI_NEVER_COMMITS: AuditCapability[] = [
  'criterion.conclude',
  'finding.confirm',
  'finding.close',
  'finding.accept_residual_risk',
  'verification.perform',
  'output.finalize',
  'report.approve',
  'report.publish',
  'proposal.register',
];

export function assertAiMayCommit(capability: AuditCapability): void {
  if (AI_NEVER_COMMITS.includes(capability)) {
    throw new AuditPermissionError(
      `Teresa nie może wykonać tej czynności (${capability}) — wymaga jawnej decyzji uprawnionej osoby`,
    );
  }
}

export { AI_NEVER_COMMITS };
