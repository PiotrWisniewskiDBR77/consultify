#!/usr/bin/env bash
set -euo pipefail

fail() { printf 'TERESA-CONTRACT FAIL: %s\n' "$1" >&2; exit 1; }

# DEC-419 (właściciel, 06.09.2026, karta Inicjatywy — "po prawej stronie jest
# »Zapytaj Teresę o tę inicjatywę« — to wyrzuć, skoro mamy już pracę z AI"):
# wejście do Teresy z prawego panelu artefaktu/karty jest ZDJĘTE. Jedyne
# wejście = ikona w Menu 1 (`data-testid="menu1-teresa"`, DEC-404). Kontrakt
# odwraca się względem baseline z 06.09: panel = 0 renderów, Menu 1 = 1.
grep -q 'data-testid="menu1-teresa"' src/layouts/MainLayout.tsx || fail 'Menu 1 lacks the single Teresa entry (menu1-teresa)'
panel_button_count=$({ grep -R '<TeresaEntryButton' src --include='*.tsx' || true; } | { grep -v __tests__ || true; } | wc -l | tr -d ' ')
[ "$panel_button_count" -eq 0 ] || fail "${panel_button_count} TeresaEntryButton renders remain outside Menu 1 (DEC-419)"
entry_prop_count=$({ grep -R "teresaEntry=" src/components --include='*.tsx' || true; } | { grep -v __tests__ || true; } | wc -l | tr -d ' ')
[ "$entry_prop_count" -eq 0 ] || fail "${entry_prop_count} live teresaEntry= consumers remain (DEC-419: prop is deprecated/unread)"
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

printf 'TERESA-CONTRACT PASS menu1_entry=1 panel_entries=0 preview=%s dead=0\n' "$preview_count"
