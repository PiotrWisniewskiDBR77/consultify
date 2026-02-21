import { v4 as uuidv4 } from 'uuid';

import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type GapStatus = 'covered' | 'partial' | 'missing' | 'unknown';

export type RecommendationType = 'hire' | 'train' | 'outsource' | 'resequence';

export interface RequirementGap {
  requirementId: string;
  capabilityId: string;
  capabilityName: string;
  categoryName: string | null;
  minLevel: number;
  priority: 'required' | 'nice_to_have';
  headcount: number | null;
  status: GapStatus;
  bestAvailableLevel: number;
  coveredBy: { userId: string; firstName: string; lastName: string; level: number }[];
  recommendation: RecommendationType | null;
}

export interface PersonGap {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  hasProfile: boolean;
  capabilities: { capabilityId: string; capabilityName: string; level: number }[];
  gaps: { capabilityId: string; capabilityName: string; required: number; actual: number }[];
}

export interface InitiativeGapSummary {
  initiativeId: string;
  initiativeName: string;
  totalRequirements: number;
  covered: number;
  partial: number;
  missing: number;
  unknown: number;
  teamSize: number;
  profilesComplete: number;
  requirements: RequirementGap[];
  persons: PersonGap[];
  unknownCoveragePercent: number;
}

export interface CompetencyGapAcrossInitiatives {
  capabilityId: string;
  capabilityName: string;
  categoryName: string | null;
  initiativesMissing: number;
  initiativesPartial: number;
  initiativesCovered: number;
  totalDemand: number;
  totalSupply: number;
}

export interface GapSnapshot {
  id: string;
  organizationId: string;
  initiativeId: string;
  snapshotDate: string;
  totalRequirements: number;
  covered: number;
  partial: number;
  missing: number;
  unknown: number;
  teamSize: number;
  profilesComplete: number;
}

/* ------------------------------------------------------------------ */
/*  Gap computation for a single initiative                            */
/* ------------------------------------------------------------------ */

export async function computeInitiativeGap(
  orgId: string,
  initiativeId: string
): Promise<InitiativeGapSummary> {
  const initiative: any = await dbGet(
    `SELECT id, title, project_id FROM initiatives WHERE id = $1 AND organization_id = $2`,
    [initiativeId, orgId]
  );
  const initiativeName = initiative?.title || 'Unknown Initiative';
  const projectId = initiative?.project_id;

  const requirements: any[] = await dbAll(
    `SELECT cr.*, c.name AS capability_name, cc.name AS category_name
     FROM capability_requirements cr
     JOIN capabilities c ON c.id = cr.capability_id
     LEFT JOIN competency_categories cc ON cc.id = c.category_id
     WHERE cr.organization_id = $1 AND cr.initiative_id = $2
     ORDER BY cr.priority DESC, c.name`,
    [orgId, initiativeId]
  );

  let teamMembers: any[] = [];
  if (projectId) {
    teamMembers = await dbAll(
      `SELECT pm.user_id, u.first_name, u.last_name, u.email
       FROM project_members pm
       JOIN users u ON u.id = pm.user_id
       WHERE pm.project_id = $1`,
      [projectId]
    );
  }

  if (teamMembers.length === 0) {
    teamMembers = await dbAll(
      `SELECT ir.user_id, u.first_name, u.last_name, u.email
       FROM initiative_resources ir
       JOIN users u ON u.id = ir.user_id
       WHERE ir.initiative_id = $1 AND ir.user_id IS NOT NULL`,
      [initiativeId]
    );
  }

  const memberUserIds = teamMembers.map((m: any) => m.user_id);

  const capIds = requirements.map((r: any) => r.capability_id);
  let userCaps: any[] = [];
  if (memberUserIds.length > 0 && capIds.length > 0) {
    const userPh = memberUserIds.map((_: any, i: number) => `$${i + 2}`).join(',');
    userCaps = await dbAll(
      `SELECT uc.user_id, uc.capability_id, uc.level
       FROM user_capabilities uc
       WHERE uc.organization_id = $1 AND uc.user_id IN (${userPh})`,
      [orgId, ...memberUserIds]
    );
  }

  const userCapMap: Record<string, Record<string, number>> = {};
  for (const uc of userCaps) {
    if (!userCapMap[uc.user_id]) userCapMap[uc.user_id] = {};
    userCapMap[uc.user_id][uc.capability_id] = uc.level;
  }

  const profilesComplete = memberUserIds.filter(
    (uid: string) => userCapMap[uid] && Object.keys(userCapMap[uid]).length > 0
  ).length;

  const requirementGaps: RequirementGap[] = [];
  let covered = 0,
    partial = 0,
    missing = 0,
    unknown = 0;

  for (const req of requirements) {
    const coveredBy: RequirementGap['coveredBy'] = [];
    let bestLevel = 0;

    for (const member of teamMembers) {
      const userLevel = userCapMap[member.user_id]?.[req.capability_id] ?? 0;
      if (userLevel > 0) {
        coveredBy.push({
          userId: member.user_id,
          firstName: member.first_name,
          lastName: member.last_name,
          level: userLevel,
        });
        if (userLevel > bestLevel) bestLevel = userLevel;
      }
    }

    let status: GapStatus;
    let recommendation: RecommendationType | null = null;

    if (profilesComplete === 0 && memberUserIds.length > 0) {
      status = 'unknown';
      unknown++;
    } else if (coveredBy.length === 0) {
      status = 'missing';
      missing++;
      recommendation = req.priority === 'required' ? 'hire' : 'train';
    } else if (bestLevel >= req.min_level) {
      const headcount = req.headcount ?? 1;
      const qualifiedCount = coveredBy.filter((c) => c.level >= req.min_level).length;
      if (qualifiedCount >= headcount) {
        status = 'covered';
        covered++;
      } else {
        status = 'partial';
        partial++;
        recommendation = 'train';
      }
    } else {
      status = 'partial';
      partial++;
      const levelGap = req.min_level - bestLevel;
      recommendation = levelGap <= 1 ? 'train' : levelGap <= 2 ? 'outsource' : 'hire';
    }

    requirementGaps.push({
      requirementId: req.id,
      capabilityId: req.capability_id,
      capabilityName: req.capability_name,
      categoryName: req.category_name,
      minLevel: req.min_level,
      priority: req.priority,
      headcount: req.headcount != null ? Number(req.headcount) : null,
      status,
      bestAvailableLevel: bestLevel,
      coveredBy,
      recommendation,
    });
  }

  const persons: PersonGap[] = teamMembers.map((m: any) => {
    const caps = userCapMap[m.user_id] || {};
    const capabilities = Object.entries(caps).map(([capId, level]) => {
      const req = requirements.find((r: any) => r.capability_id === capId);
      return {
        capabilityId: capId,
        capabilityName: req?.capability_name || capId,
        level: level as number,
      };
    });

    const gaps: PersonGap['gaps'] = [];
    for (const req of requirements) {
      const actual = caps[req.capability_id] ?? 0;
      if (actual < req.min_level) {
        gaps.push({
          capabilityId: req.capability_id,
          capabilityName: req.capability_name,
          required: req.min_level,
          actual,
        });
      }
    }

    return {
      userId: m.user_id,
      firstName: m.first_name || '',
      lastName: m.last_name || '',
      email: m.email || '',
      hasProfile: Object.keys(caps).length > 0,
      capabilities,
      gaps,
    };
  });

  const unknownCoveragePercent =
    teamMembers.length > 0
      ? Math.round(((teamMembers.length - profilesComplete) / teamMembers.length) * 100)
      : 0;

  return {
    initiativeId,
    initiativeName,
    totalRequirements: requirements.length,
    covered,
    partial,
    missing,
    unknown,
    teamSize: teamMembers.length,
    profilesComplete,
    requirements: requirementGaps,
    persons,
    unknownCoveragePercent,
  };
}

/* ------------------------------------------------------------------ */
/*  Gap by competency (across all initiatives)                         */
/* ------------------------------------------------------------------ */

export async function computeGapByCompetency(
  orgId: string
): Promise<CompetencyGapAcrossInitiatives[]> {
  const rows: any[] = await dbAll(
    `SELECT c.id AS capability_id, c.name AS capability_name, cc.name AS category_name,
            cr.initiative_id, cr.min_level, cr.headcount
     FROM capability_requirements cr
     JOIN capabilities c ON c.id = cr.capability_id
     LEFT JOIN competency_categories cc ON cc.id = c.category_id
     WHERE cr.organization_id = $1
     ORDER BY c.name`,
    [orgId]
  );

  const supply: any[] = await dbAll(
    `SELECT uc.capability_id, COUNT(DISTINCT uc.user_id) AS user_count
     FROM user_capabilities uc
     WHERE uc.organization_id = $1
     GROUP BY uc.capability_id`,
    [orgId]
  );
  const supplyMap: Record<string, number> = {};
  for (const s of supply) supplyMap[s.capability_id] = Number(s.user_count);

  const capMap: Record<string, CompetencyGapAcrossInitiatives> = {};
  for (const row of rows) {
    if (!capMap[row.capability_id]) {
      capMap[row.capability_id] = {
        capabilityId: row.capability_id,
        capabilityName: row.capability_name,
        categoryName: row.category_name,
        initiativesMissing: 0,
        initiativesPartial: 0,
        initiativesCovered: 0,
        totalDemand: 0,
        totalSupply: supplyMap[row.capability_id] ?? 0,
      };
    }
    const entry = capMap[row.capability_id];
    const headcount = row.headcount ? Number(row.headcount) : 1;
    entry.totalDemand += headcount;

    const available = supplyMap[row.capability_id] ?? 0;
    if (available === 0) entry.initiativesMissing++;
    else if (available < headcount) entry.initiativesPartial++;
    else entry.initiativesCovered++;
  }

  return Object.values(capMap).sort(
    (a, b) => b.initiativesMissing - a.initiativesMissing || b.totalDemand - a.totalDemand
  );
}

/* ------------------------------------------------------------------ */
/*  Snapshots                                                          */
/* ------------------------------------------------------------------ */

export async function saveSnapshot(
  orgId: string,
  gap: InitiativeGapSummary,
  createdBy?: string
): Promise<GapSnapshot> {
  const id = uuidv4();
  await dbRun(
    `INSERT INTO skills_gap_snapshots
       (id, organization_id, initiative_id, total_requirements, covered, partial, missing, unknown, team_size, profiles_complete, gap_details, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     ON CONFLICT (organization_id, initiative_id, snapshot_date) DO UPDATE SET
       total_requirements = EXCLUDED.total_requirements,
       covered = EXCLUDED.covered,
       partial = EXCLUDED.partial,
       missing = EXCLUDED.missing,
       unknown = EXCLUDED.unknown,
       team_size = EXCLUDED.team_size,
       profiles_complete = EXCLUDED.profiles_complete,
       gap_details = EXCLUDED.gap_details`,
    [
      id,
      orgId,
      gap.initiativeId,
      gap.totalRequirements,
      gap.covered,
      gap.partial,
      gap.missing,
      gap.unknown,
      gap.teamSize,
      gap.profilesComplete,
      JSON.stringify(
        gap.requirements.map((r) => ({
          capabilityId: r.capabilityId,
          status: r.status,
          recommendation: r.recommendation,
        }))
      ),
      createdBy ?? null,
    ]
  );
  const row = await dbGet(`SELECT * FROM skills_gap_snapshots WHERE id = $1`, [id]);
  return mapSnapshot(row);
}

export async function getSnapshots(
  orgId: string,
  initiativeId: string,
  limit = 30
): Promise<GapSnapshot[]> {
  const rows = await dbAll(
    `SELECT * FROM skills_gap_snapshots
     WHERE organization_id = $1 AND initiative_id = $2
     ORDER BY snapshot_date DESC LIMIT $3`,
    [orgId, initiativeId, limit]
  );
  return rows.map(mapSnapshot);
}

function mapSnapshot(row: any): GapSnapshot {
  return {
    id: row.id,
    organizationId: row.organization_id,
    initiativeId: row.initiative_id,
    snapshotDate: row.snapshot_date,
    totalRequirements: row.total_requirements,
    covered: row.covered,
    partial: row.partial,
    missing: row.missing,
    unknown: row.unknown,
    teamSize: row.team_size,
    profilesComplete: row.profiles_complete,
  };
}
