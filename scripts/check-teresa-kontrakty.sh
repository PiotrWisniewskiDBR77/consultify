#!/usr/bin/env bash
set -euo pipefail

fail() { printf 'TERESA-CONTRACT FAIL: %s\n' "$1" >&2; exit 1; }

grep -q 'teresaEntry?:' src/components/standard/ArtifactRightPanel.tsx || fail 'ArtifactRightPanel lacks teresaEntry prop'
grep -q '<TeresaEntryButton' src/components/standard/ArtifactRightPanel.tsx || fail 'ArtifactRightPanel does not render TeresaEntryButton'
entry_count=$(grep -R "teresaEntry=" src/components --include='*.tsx' | grep -v __tests__ | wc -l | tr -d ' ')
[ "$entry_count" -ge 13 ] || fail "only ${entry_count}/13 live ArtifactRightPanel Teresa entries"
dead_count=$({ grep -R -E '<AIActionSlot|<AIConsultantPanel' src --include='*.tsx' || true; } | { grep -v __tests__ || true; } | wc -l | tr -d ' ')
[ "$dead_count" -eq 0 ] || fail "${dead_count} dead AI surfaces remain"
[ ! -e src/utils/canvas/canvasMutationRisk.ts ] || fail 'silent Teresa auto-apply rule remains'
preview_count=$(grep -R '<TeresaPreviewPanel' src --include='*.tsx' | grep -v __tests__ | wc -l | tr -d ' ')
[ "$preview_count" -ge 1 ] || fail 'MethodWorkspaceShell does not render TeresaPreviewPanel'

node --input-type=module <<'NODE'
import fs from 'node:fs';
const actions = fs.readFileSync('src/components/DiscoveryTools/toolAiActions.ts', 'utf8');
const prompts = fs.readFileSync('src/hooks/discovery/toolAi/systemPrompts.ts', 'utf8');
const block = actions.match(/TOOLS_WITH_APPLY_HANDLER[^[]*\[([\s\S]*?)\]\)/)?.[1] || '';
const types = [...block.matchAll(/'([^']+)'/g)].map((match) => match[1]);
if (types.length < 12) throw new Error(`tool denominator too small: ${types.length}`);
const missing = types.filter((type) => !prompts.includes(`'${type}':`));
if (missing.length) throw new Error(`missing Teresa tool contracts: ${missing.join(', ')}`);
console.log(`TERESA-CONTRACT tools ${types.length}/${types.length}`);
NODE

printf 'TERESA-CONTRACT PASS entries=%s preview=%s dead=0\n' "$entry_count" "$preview_count"
