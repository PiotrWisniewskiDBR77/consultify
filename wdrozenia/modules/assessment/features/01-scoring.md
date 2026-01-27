# Assessment – Scoring (Live)

## Status: ✅ ZAIMPLEMENTOWANE

**Frontend:** `src/components/Assessment/tools/DRDForm.tsx`, `SIRIForm.tsx`  
**Backend:** `server/src/controllers/AssessmentController.ts`

---

## 📋 Opis

System live scoring dla różnych frameworków assessment:
- DRD (7 osi, skala 1-7)
- SIRI (3 bloki, 8 wymiarów, skala 0-5)
- ADMA (5 filarów)
- CMMI (3 kategorie, 5 poziomów)
- Lean 4.0 (3 wymiary)

---

## 🎯 DRD Scoring

### 7 Osi Transformacji Cyfrowej

| Oś | Nazwa | Skala |
|----|-------|-------|
| 1 | Cyfrowe Procesy | 1-7 |
| 2 | Cyfrowe Produkty | 1-7 |
| 3 | Cyfrowe Modele Biznesowe | 1-7 |
| 4 | Big Data & Analytics | 1-7 |
| 5 | Kultura Cyfrowa | 1-7 |
| 6 | Cyberbezpieczeństwo | 1-7 |
| 7 | AI & Automatyzacja | 1-7 |

### Obliczanie Score

```typescript
interface DRDScore {
  axes: Record<string, number>;  // 1-7 per axis
  overall: number;               // średnia ważona
  maturityLevel: string;         // Początkujący | Rozwijający | Zaawansowany | Lider
}

const calculateDRDScore = (axes: Record<string, number>): DRDScore => {
  const values = Object.values(axes);
  const overall = values.reduce((sum, v) => sum + v, 0) / values.length;
  
  let maturityLevel: string;
  if (overall < 2.5) maturityLevel = 'Początkujący';
  else if (overall < 4) maturityLevel = 'Rozwijający';
  else if (overall < 5.5) maturityLevel = 'Zaawansowany';
  else maturityLevel = 'Lider';
  
  return { axes, overall, maturityLevel };
};
```

---

## 🎯 SIRI Scoring

### 3 Building Blocks + 8 Dimensions

| Block | Dimensions |
|-------|------------|
| **PROCESS** | Operations, Supply Chain |
| **TECHNOLOGY** | Automation, Connectivity, Intelligence |
| **ORGANIZATION** | Talent, Structure, Strategy |

### Obliczanie Score

```typescript
interface SIRIScore {
  buildingBlocks: Record<string, {
    score: number;
    dimensionScores: Record<string, number>;
  }>;
  overall: number;        // 0-5
  band: number;           // 0-5 (zaokrąglone)
  bandLabel: string;      // Band 0-5 labels
}

const SIRI_BANDS = [
  { min: 0, max: 0.5, label: 'Band 0 - Undefined' },
  { min: 0.5, max: 1.5, label: 'Band 1 - Defined' },
  { min: 1.5, max: 2.5, label: 'Band 2 - Digital' },
  { min: 2.5, max: 3.5, label: 'Band 3 - Integrated' },
  { min: 3.5, max: 4.5, label: 'Band 4 - Advanced' },
  { min: 4.5, max: 5, label: 'Band 5 - Cutting Edge' },
];
```

---

## 🎨 UI - Live Score Display

### DRD Score Card

```tsx
export const DRDScoreCard: React.FC<{ score: DRDScore }> = ({ score }) => {
  return (
    <div className="p-6 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl text-white">
      <div className="text-4xl font-bold">{score.overall.toFixed(1)}</div>
      <div className="text-sm opacity-80">/ 7.0</div>
      <div className="mt-2 text-lg">{score.maturityLevel}</div>
      
      {/* Radar Chart */}
      <div className="mt-4 h-48">
        <ResponsiveContainer>
          <RadarChart data={formatRadarData(score.axes)}>
            <PolarGrid />
            <PolarAngleAxis dataKey="axis" />
            <PolarRadiusAxis domain={[0, 7]} />
            <Radar dataKey="value" fill="#fff" fillOpacity={0.3} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
```

### SIRI Score Card

```tsx
export const SIRIScoreCard: React.FC<{ score: SIRIScore }> = ({ score }) => {
  return (
    <div className="p-6 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl text-white">
      <div className="text-4xl font-bold">{score.overall.toFixed(2)}</div>
      <div className="text-sm opacity-80">/ 5.0</div>
      <div className="mt-2 text-lg">{score.bandLabel}</div>
      
      {/* Building Blocks */}
      <div className="mt-4 space-y-2">
        {Object.entries(score.buildingBlocks).map(([block, data]) => (
          <div key={block} className="flex justify-between">
            <span>{block}</span>
            <span className="font-bold">{data.score.toFixed(2)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
```

---

## 🔧 Backend - Score Calculation

### AssessmentController.ts

```typescript
static async calculateScore(req: Request, res: Response) {
  const { id } = req.params;
  const { framework, answers } = req.body;

  let score;
  switch (framework) {
    case 'DRD':
      score = calculateDRDScore(answers);
      break;
    case 'SIRI':
      score = calculateSIRIScore(answers);
      break;
    case 'ADMA':
      score = calculateADMAScore(answers);
      break;
    case 'CMMI':
      score = calculateCMMIScore(answers);
      break;
    default:
      return res.status(400).json({ error: 'Unknown framework' });
  }

  // Zapisz score do bazy
  await db.run(`
    UPDATE assessments 
    SET score_data = ?, overall_score = ?, updated_at = ?
    WHERE id = ?
  `, [JSON.stringify(score), score.overall, new Date().toISOString(), id]);

  return res.json(score);
}
```

---

## 📊 Gap Analysis

### Obliczanie Gaps

```typescript
interface GapAnalysis {
  dimension: string;
  current: number;
  target: number;
  gap: number;
  priority: 'high' | 'medium' | 'low';
}

const calculateGaps = (current: Record<string, number>, target: Record<string, number>): GapAnalysis[] => {
  return Object.keys(current).map(dim => {
    const gap = target[dim] - current[dim];
    let priority: 'high' | 'medium' | 'low';
    if (gap >= 2) priority = 'high';
    else if (gap >= 1) priority = 'medium';
    else priority = 'low';
    
    return {
      dimension: dim,
      current: current[dim],
      target: target[dim],
      gap,
      priority
    };
  }).sort((a, b) => b.gap - a.gap);
};
```

---

## 🎯 Benchmark Comparison

### MultiFwBenchmarkComparison.tsx

Komponent do porównywania score z benchmarkami branżowymi:
- Percentile ranking
- Industry average comparison
- Regional analysis
- Strengths & Weaknesses

```tsx
// Używa real API - zweryfikowane!
const fetchBenchmarkData = async () => {
  const response = await fetch(
    `/api/benchmark/compare?framework=${framework}&score=${score}&industry=${industry}`
  );
  return response.json();
};
```

---

## ✅ Weryfikacja

- [x] DRD scoring (7 osi, 1-7)
- [x] SIRI scoring (3 bloki, 0-5)
- [x] Live score display
- [x] Radar chart visualization
- [x] Gap analysis
- [x] Benchmark comparison (real API)
- [x] Score persistence w bazie
