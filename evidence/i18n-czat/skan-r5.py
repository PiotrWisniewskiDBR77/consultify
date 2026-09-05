import re, json, os
ROOT = os.getcwd()
pl = json.load(open(ROOT + '/public/locales/pl/translation.json'))
en = json.load(open(ROOT + '/public/locales/en/translation.json'))
def get(d, path):
    cur = d
    for p in path.split('.'):
        if not isinstance(cur, dict) or p not in cur:
            return None
        cur = cur[p]
    return cur
files = [
    'src/components/AIChat/MessageRenderer.tsx',
    'src/components/AIChat/ArtifactBadge.tsx',
    'src/components/AIChat/ArtifactChip.tsx',
    'src/components/AIChat/CaseIntakeConfirmCard.tsx',
    'src/components/AIChat/ChatTableProposalCard.tsx',
    'src/components/AIChat/CitationList.tsx',
    'src/components/AIChat/ExecutionProposalMessage.tsx',
    'src/components/AIChat/GovernedChatHandoffCard.tsx',
    'src/components/AIChat/GovernedInitiativeHandoffCard.tsx',
    'src/components/AIChat/InlineResponseFeedback.tsx',
    'src/components/AIChat/Messages/InlineThinkingStream.tsx',
    'src/components/AIChat/Messages/ReasoningTrace.tsx',
    'src/components/AIChat/ResearchProgress.tsx',
    'src/components/AIChat/SourcesStrip.tsx',
    'src/components/AIChat/StructuredOutputBlock.tsx',
    'src/components/AIChat/TeresaProposalCard.tsx',
    'src/components/AIChat/ToolStepList.tsx',
    'src/components/AIChat/TrustBadge.tsx',
    'src/components/AIChat/TrustPanel.tsx',
    'src/components/AIChat/ChatCodeBlock.tsx',
]
t_re = re.compile(r"\bt\(\s*(['\"`])([a-zA-Z0-9_.]+)\1\s*,\s*(['\"`])((?:\\.|(?!\3).)*)\3")
missing = 0
for f in files:
    p = os.path.join(ROOT, f)
    if not os.path.exists(p):
        print('BRAK PLIKU', f)
        continue
    text = open(p, encoding='utf-8').read()
    cnt = 0
    for m in t_re.finditer(text):
        key = m.group(2)
        if get(pl, key) is None:
            missing += 1
            cnt += 1
            line = text.count('\n', 0, m.start()) + 1
            print(f'{f}:{line}\t{key}\t{m.group(4)}')
    if cnt:
        print(cnt, f)
print('RAZEM:', missing)
