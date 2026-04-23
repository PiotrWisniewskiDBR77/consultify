export type ArtifactStructure = {
  readonly artifactType: string;
  readonly sections: readonly {
    readonly name: string;
    readonly nodeKinds: readonly string[];
  }[];
};

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((v) => stableStringify(v)).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

export function assertFingerprintDeterministic(structure: ArtifactStructure): void {
  if (!structure || typeof structure !== 'object') {
    throw new Error('Structure missing');
  }
  if (!structure.artifactType || !Array.isArray(structure.sections)) {
    throw new Error('Invalid structure');
  }
}

export function computeTemplateFingerprint(structure: ArtifactStructure): string {
  const payload = stableStringify(structure);
  let hash = 2166136261;
  for (let i = 0; i < payload.length; i += 1) {
    hash ^= payload.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const hex = (hash >>> 0).toString(16).padStart(8, '0');
  return `tf_${hex}`;
}

