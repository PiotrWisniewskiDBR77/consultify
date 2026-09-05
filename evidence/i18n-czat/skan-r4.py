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
    'src/components/AIChat/UnifiedChatPanel.tsx',
    'src/components/AIChat/ChatHistorySidebar.tsx',
    'src/components/AIChat/ConversationActions.tsx',
    'src/components/AIChat/MoveToProjectModal.tsx',
    'src/components/SystemHealth.tsx',
]
t_re = re.compile(r"\bt\(\s*(['\"`])([a-zA-Z0-9_.]+)\1\s*,\s*(['\"`])((?:\\.|(?!\3).)*)\3")
missing = 0
for f in files:
    p = os.path.join(ROOT, f)
    text = open(p, encoding='utf-8').read()
    cnt = 0
    for m in t_re.finditer(text):
        key = m.group(2)
        if get(pl, key) is None:
            missing += 1
            cnt += 1
            line = text.count('\n', 0, m.start()) + 1
            print(f'{f}:{line}\t{key}\t{m.group(4)}')
    print(cnt, f)
print('RAZEM:', missing)
