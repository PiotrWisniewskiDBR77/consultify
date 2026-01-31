# Reports Module – Assessment Source Adapter

## Status: 🔨 W PLANOWANIU

---

## 🎯 Cel

Adapter do ekstrakcji danych z zatwierdzonego assessmentu (DRD, SIRI, ADMA, etc.) i transformacji do ujednoliconego formatu dla Report Builder.

---

## 📋 Obsługiwane frameworki

| Framework | Skala | Osie/Wymiary        | Status                 |
| --------- | ----- | ------------------- | ---------------------- |
| DRD       | 1-7   | 7 osi, 34 obszary   | ✅ Pełna implementacja |
| SIRI      | 0-5   | 3 bloki, 8 wymiarów | ✅ Pełna implementacja |
| ADMA      | 1-5   | 5 filarów           | 🔄 W planowaniu        |
| CMMI      | 1-5   | 3 kategorie         | 🔄 W planowaniu        |
| Lean 4.0  | 1-5   | 3 wymiary           | 🔄 W planowaniu        |

---

## 🔄 Transformacja danych

### Input: Assessment Data

```typescript
interface AssessmentSourceInput {
  // Assessment metadata
  id: string;
  organizationId: string;
  name: string;
  assessmentType: 'DRD' | 'SIRI' | 'ADMA' | 'CMMI' | 'LEAN';
  status: 'APPROVED';

  // Answers
  answersJson: string; // JSON zawierający odpowiedzi

  // Scores
  scoreSummary: string; // JSON z podsumowaniem wyników

  // Context
  contextSnapshot?: string; // JSON z kontekstem firmy

  // Timestamps
  approvedAt: string;
  createdAt: string;

  // Users
  createdBy: string;
  createdByName: string;
  approvedBy: string;
  approvedByName: string;
}
```

### Output: Report Source Data

```typescript
interface ReportSourceData {
  // Source identification
  sourceType: 'ASSESSMENT';
  sourceId: string;
  sourceName: string;
  sourceFramework: string;

  // Company information
  company: {
    name: string;
    industry?: string;
    size?: string;
    description?: string;
    context?: string;
  };

  // Methodology description
  methodology: {
    framework: string;
    frameworkName: string;
    description: string;
    maxLevel: number;
    axes: AxisDefinition[];
  };

  // Assessment data
  data: {
    // Axes with scores
    axes: AxisData[];

    // Overall scores
    scores: {
      overall: number;
      max: number;
      percentage: number;
      highest: { name: string; score: number };
      lowest: { name: string; score: number };
    };

    // Gap analysis
    gaps: GapData[];

    // Identified strengths
    strengths: StrengthItem[];

    // Identified weaknesses
    weaknesses: WeaknessItem[];
  };

  // Metadata
  metadata: {
    assessedAt: string;
    assessedBy: string;
    approvedAt: string;
    approvedBy: string;
    version: number;
  };
}

interface AxisDefinition {
  id: number;
  key: string;
  name: string;
  description: string;
  areaCount: number;
  levelCount: number;
}

interface AxisData {
  id: number;
  key: string;
  name: string;

  // Scores
  score: number;
  maxScore: number;
  percentage: number;

  // Areas breakdown
  areas: AreaData[];

  // Axis-level summary
  summary?: string;
}

interface AreaData {
  id: string;
  name: string;

  // Score
  achievedLevel: number;
  targetLevel?: number;
  maxLevel: number;
  gap: number;

  // Assessment answers
  answer: string; // User's assessment answer/selection
  justification?: string;
  evidence?: string[];
  notes?: Record<string, string>;

  // For report generation
  finding?: string;
  conclusion?: string;
  recommendation?: string;
}

interface GapData {
  axisId: number;
  axisName: string;
  areaId: string;
  areaName: string;
  currentLevel: number;
  targetLevel: number;
  gap: number;
  priority: 'high' | 'medium' | 'low';
}

interface StrengthItem {
  areaId: string;
  areaName: string;
  axisName: string;
  score: number;
  maxScore: number;
  context: string;
}

interface WeaknessItem {
  areaId: string;
  areaName: string;
  axisName: string;
  score: number;
  targetScore?: number;
  gap: number;
  impact: string;
}
```

---

## 🏗️ Implementacja adaptera

### AssessmentSourceAdapter

```typescript
/**
 * AssessmentSourceAdapter
 * Extracts and transforms assessment data for report generation
 */

import { DRD_STRUCTURE, DRD_AXIS_KEY_MAP } from '@/services/drdStructure';
import { SIRI_STRUCTURE } from '@/services/siriStructure';

class AssessmentSourceAdapter implements ISourceAdapter<AssessmentData> {
  sourceType = 'ASSESSMENT' as const;

  /**
   * List all approved assessments available for report creation
   */
  async listAvailableSources(
    organizationId: string,
    filters?: SourceFilters
  ): Promise<SourceListItem[]> {
    const sql = `
      SELECT 
        a.id,
        a.name,
        a.assessment_type,
        a.status,
        a.approved_at,
        a.created_at,
        u.first_name || ' ' || u.last_name as created_by_name
      FROM assessments a
      LEFT JOIN users u ON a.created_by = u.id
      WHERE a.organization_id = ?
        AND a.status = 'APPROVED'
        ${filters?.framework ? 'AND a.assessment_type = ?' : ''}
        ${filters?.search ? 'AND a.name LIKE ?' : ''}
      ORDER BY a.approved_at DESC
      LIMIT 100
    `;

    const params = [organizationId];
    if (filters?.framework) params.push(filters.framework);
    if (filters?.search) params.push(`%${filters.search}%`);

    const rows = await queryAll(sql, params);

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      type: row.assessment_type,
      status: row.status,
      date: row.approved_at,
      createdBy: row.created_by_name,
      metadata: {
        framework: row.assessment_type,
      },
    }));
  }

  /**
   * Get full assessment data for report generation
   */
  async getSourceData(sourceId: string): Promise<AssessmentData> {
    const sql = `
      SELECT 
        a.*,
        o.name as organization_name,
        p.name as project_name,
        uc.first_name || ' ' || uc.last_name as created_by_name,
        ua.first_name || ' ' || ua.last_name as approved_by_name
      FROM assessments a
      LEFT JOIN organizations o ON a.organization_id = o.id
      LEFT JOIN projects p ON a.project_id = p.id
      LEFT JOIN users uc ON a.created_by = uc.id
      LEFT JOIN users ua ON a.approved_by = ua.id
      WHERE a.id = ?
    `;

    const row = await queryOne(sql, [sourceId]);

    if (!row) {
      throw new Error('Assessment not found');
    }

    if (row.status !== 'APPROVED') {
      throw new Error('Assessment is not approved yet');
    }

    return {
      ...row,
      answers: JSON.parse(row.answers_json || '{}'),
      scores: JSON.parse(row.score_summary || '{}'),
      context: JSON.parse(row.context_snapshot || '{}'),
    };
  }

  /**
   * Transform assessment data to unified report format
   */
  transformToReportData(data: AssessmentData): ReportSourceData {
    const framework = data.assessment_type;
    const structure = this.getFrameworkStructure(framework);
    const methodology = this.getMethodologyInfo(framework);

    // Transform axes
    const axes = this.transformAxes(data, structure);

    // Calculate overall scores
    const scores = this.calculateScores(axes, structure);

    // Identify gaps
    const gaps = this.identifyGaps(axes);

    // Identify strengths and weaknesses
    const strengths = this.identifyStrengths(axes, structure);
    const weaknesses = this.identifyWeaknesses(axes, gaps);

    return {
      sourceType: 'ASSESSMENT',
      sourceId: data.id,
      sourceName: data.name,
      sourceFramework: framework,

      company: {
        name: data.organization_name || 'Unknown Company',
        industry: data.context?.company?.industry,
        size: data.context?.company?.size,
        description: data.context?.company?.description,
        context: this.buildCompanyContext(data.context),
      },

      methodology: {
        framework,
        frameworkName: methodology.name,
        description: methodology.description,
        maxLevel: methodology.maxLevel,
        axes: structure.map((axis) => ({
          id: axis.id,
          key: axis.key,
          name: axis.name,
          description: axis.description,
          areaCount: axis.areas.length,
          levelCount: axis.levelCount,
        })),
      },

      data: {
        axes,
        scores,
        gaps,
        strengths,
        weaknesses,
      },

      metadata: {
        assessedAt: data.created_at,
        assessedBy: data.created_by_name,
        approvedAt: data.approved_at,
        approvedBy: data.approved_by_name,
        version: data.version || 1,
      },
    };
  }

  /**
   * Get default report template for this source type
   */
  getDefaultTemplate(): ReportTemplate {
    return ASSESSMENT_REPORT_TEMPLATE;
  }

  // ==========================================
  // PRIVATE HELPERS
  // ==========================================

  private getFrameworkStructure(framework: string): FrameworkStructure[] {
    switch (framework) {
      case 'DRD':
        return DRD_STRUCTURE;
      case 'SIRI':
        return SIRI_STRUCTURE;
      default:
        throw new Error(`Unknown framework: ${framework}`);
    }
  }

  private getMethodologyInfo(framework: string): MethodologyInfo {
    const info: Record<string, MethodologyInfo> = {
      DRD: {
        name: 'Digital Readiness Diagnosis (DRD)',
        description: `DRD to kompleksowa metodologia oceny dojrzałości cyfrowej organizacji. 
Składa się z 7 osi transformacji cyfrowej, z których każda jest oceniana w skali 1-7.
Metodologia bazuje na książce "Digital Pathfinder" i została zaprojektowana 
do identyfikacji luk transformacyjnych oraz planowania ścieżki rozwoju.`,
        maxLevel: 7,
      },
      SIRI: {
        name: 'Smart Industry Readiness Index (SIRI)',
        description: `SIRI to framework opracowany przez Singapore EDB do oceny gotowości 
organizacji do Przemysłu 4.0. Składa się z 3 bloków i 8 wymiarów, 
ocenianych w skali 0-5.`,
        maxLevel: 5,
      },
      ADMA: {
        name: 'Advanced Manufacturing Assessment (ADMA)',
        description: `ADMA to metodologia oceny zaawansowania produkcji. 
Składa się z 5 filarów ocenianych w skali 1-5.`,
        maxLevel: 5,
      },
    };

    return (
      info[framework] || {
        name: framework,
        description: `Assessment framework: ${framework}`,
        maxLevel: 5,
      }
    );
  }

  private transformAxes(data: AssessmentData, structure: FrameworkStructure[]): AxisData[] {
    const answers = data.answers?.drd?.areas || data.answers?.siri || {};

    return structure.map((axis) => {
      const areas = axis.areas.map((area) => {
        const areaAnswer = answers[area.id] || {};
        const achievedLevel = Number(areaAnswer.achievedLevel || 0);
        const targetLevel = areaAnswer.targetLevel ? Number(areaAnswer.targetLevel) : undefined;

        return {
          id: area.id,
          name: area.name,
          achievedLevel,
          targetLevel,
          maxLevel: axis.levelCount,
          gap: targetLevel ? targetLevel - achievedLevel : 0,
          answer: this.formatAnswer(achievedLevel, axis.levelCount),
          justification: areaAnswer.justification,
          evidence: areaAnswer.evidence,
          notes: areaAnswer.levelNotes,
        };
      });

      const axisScore = areas.reduce((sum, a) => sum + a.achievedLevel, 0);
      const axisMaxScore = areas.length * axis.levelCount;

      return {
        id: axis.id,
        key: axis.key,
        name: axis.name,
        score: axisScore,
        maxScore: axisMaxScore,
        percentage: axisMaxScore > 0 ? Math.round((axisScore / axisMaxScore) * 100) : 0,
        areas,
      };
    });
  }

  private calculateScores(
    axes: AxisData[],
    structure: FrameworkStructure[]
  ): ReportSourceData['data']['scores'] {
    const overallScore = axes.reduce((sum, ax) => sum + ax.score, 0);
    const overallMax = axes.reduce((sum, ax) => sum + ax.maxScore, 0);

    const sorted = [...axes].sort((a, b) => b.percentage - a.percentage);

    return {
      overall: overallScore,
      max: overallMax,
      percentage: overallMax > 0 ? Math.round((overallScore / overallMax) * 100) : 0,
      highest: {
        name: sorted[0]?.name || '',
        score: sorted[0]?.percentage || 0,
      },
      lowest: {
        name: sorted[sorted.length - 1]?.name || '',
        score: sorted[sorted.length - 1]?.percentage || 0,
      },
    };
  }

  private identifyGaps(axes: AxisData[]): GapData[] {
    const gaps: GapData[] = [];

    for (const axis of axes) {
      for (const area of axis.areas) {
        if (area.gap > 0) {
          gaps.push({
            axisId: axis.id,
            axisName: axis.name,
            areaId: area.id,
            areaName: area.name,
            currentLevel: area.achievedLevel,
            targetLevel: area.targetLevel!,
            gap: area.gap,
            priority: area.gap >= 3 ? 'high' : area.gap >= 2 ? 'medium' : 'low',
          });
        }
      }
    }

    return gaps.sort((a, b) => b.gap - a.gap);
  }

  private identifyStrengths(axes: AxisData[], structure: FrameworkStructure[]): StrengthItem[] {
    const strengths: StrengthItem[] = [];

    for (const axis of axes) {
      for (const area of axis.areas) {
        const axisStructure = structure.find((s) => s.id === axis.id);
        const threshold = (axisStructure?.levelCount || 5) * 0.7; // 70%+ is strength

        if (area.achievedLevel >= threshold) {
          strengths.push({
            areaId: area.id,
            areaName: area.name,
            axisName: axis.name,
            score: area.achievedLevel,
            maxScore: area.maxLevel,
            context: `Osiągnięty poziom ${area.achievedLevel}/${area.maxLevel} w ${area.name}`,
          });
        }
      }
    }

    return strengths.sort((a, b) => b.score / b.maxScore - a.score / a.maxScore);
  }

  private identifyWeaknesses(axes: AxisData[], gaps: GapData[]): WeaknessItem[] {
    const weaknesses: WeaknessItem[] = [];

    // Areas with lowest scores
    for (const axis of axes) {
      for (const area of axis.areas) {
        const percentage = area.achievedLevel / area.maxLevel;

        if (percentage <= 0.3) {
          // 30% or below is weakness
          const gap = gaps.find((g) => g.areaId === area.id);

          weaknesses.push({
            areaId: area.id,
            areaName: area.name,
            axisName: axis.name,
            score: area.achievedLevel,
            targetScore: area.targetLevel,
            gap: gap?.gap || 0,
            impact: `Niski poziom ${area.achievedLevel}/${area.maxLevel} wymaga uwagi`,
          });
        }
      }
    }

    return weaknesses.sort((a, b) => a.score - b.score);
  }

  private formatAnswer(level: number, maxLevel: number): string {
    if (level === 0) return 'Not assessed';
    const percentage = Math.round((level / maxLevel) * 100);
    return `Level ${level}/${maxLevel} (${percentage}%)`;
  }

  private buildCompanyContext(context: any): string {
    if (!context) return '';

    const parts: string[] = [];

    if (context.company?.description) {
      parts.push(context.company.description);
    }

    if (context.challenges?.length) {
      parts.push(`Key challenges: ${context.challenges.join(', ')}`);
    }

    if (context.goals?.length) {
      parts.push(`Strategic goals: ${context.goals.join(', ')}`);
    }

    return parts.join('\n\n');
  }
}

export default AssessmentSourceAdapter;
```

---

## 📊 Przykładowa transformacja DRD

### Input (Assessment Answers)

```json
{
  "drd": {
    "areas": {
      "1A": {
        "achievedLevel": 3,
        "targetLevel": 5,
        "levelNotes": {
          "3": "Podstawowe procesy są zdefiniowane"
        }
      },
      "1B": {
        "achievedLevel": 2,
        "targetLevel": 4
      }
    }
  }
}
```

### Output (Report Source Data - fragment)

```json
{
  "sourceType": "ASSESSMENT",
  "sourceId": "assess-123",
  "sourceFramework": "DRD",

  "methodology": {
    "framework": "DRD",
    "frameworkName": "Digital Readiness Diagnosis (DRD)",
    "maxLevel": 7,
    "axes": [
      {
        "id": 1,
        "key": "processes",
        "name": "Digital Processes",
        "description": "Ocena dojrzałości procesów cyfrowych",
        "areaCount": 9,
        "levelCount": 7
      }
    ]
  },

  "data": {
    "axes": [
      {
        "id": 1,
        "key": "processes",
        "name": "Digital Processes",
        "score": 22,
        "maxScore": 63,
        "percentage": 35,
        "areas": [
          {
            "id": "1A",
            "name": "Process Standardization",
            "achievedLevel": 3,
            "targetLevel": 5,
            "maxLevel": 7,
            "gap": 2,
            "answer": "Level 3/7 (43%)",
            "notes": {
              "3": "Podstawowe procesy są zdefiniowane"
            }
          }
        ]
      }
    ],

    "gaps": [
      {
        "axisId": 1,
        "axisName": "Digital Processes",
        "areaId": "1A",
        "areaName": "Process Standardization",
        "currentLevel": 3,
        "targetLevel": 5,
        "gap": 2,
        "priority": "medium"
      }
    ],

    "strengths": [],

    "weaknesses": [
      {
        "areaId": "1B",
        "areaName": "Process Automation",
        "axisName": "Digital Processes",
        "score": 2,
        "targetScore": 4,
        "gap": 2,
        "impact": "Niski poziom 2/7 wymaga uwagi"
      }
    ]
  }
}
```

---

## 📚 Referencje

- `00-OVERVIEW.md` - Przegląd modułu
- `01-ARCHITECTURE.md` - Architektura
- `backend/01-api-list.md` - Lista API
- `wdrozenia/modules/assessment/11-DRD-METHOD.md` - Metodyka DRD
