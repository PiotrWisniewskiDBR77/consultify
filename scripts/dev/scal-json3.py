import json, subprocess, sys
path = sys.argv[1]
def show(ref):
    return json.loads(subprocess.check_output(['git','show',f'{ref}:{path}']))
base = show(subprocess.check_output(['git','merge-base','HEAD','MERGE_HEAD']).decode().strip())
ours = show('HEAD'); theirs = show('MERGE_HEAD')
stats = {'dodane_theirs':0,'dodane_ours':0,'usuniete_ours':0,'usuniete_theirs':0,'konflikt_ours_wins':0}
def merge(b, o, t):
    if isinstance(o, dict) and isinstance(t, dict):
        b = b if isinstance(b, dict) else {}
        out = {}
        for k in list(o.keys()) + [k for k in t if k not in o]:
            if k in o and k in t:
                out[k] = merge(b.get(k), o[k], t[k])
            elif k in o:  # brak u theirs
                if k in b and b[k] == o[k]:
                    stats['usuniete_theirs'] += 1  # theirs skasował — respektuj
                else:
                    out[k] = o[k]; stats['dodane_ours'] += 1 if k not in b else 0
            else:  # tylko u theirs
                if k in b and b[k] == t[k]:
                    stats['usuniete_ours'] += 1  # my skasowaliśmy — zostaje skasowane
                else:
                    out[k] = t[k]; stats['dodane_theirs'] += 1
        return out
    if o == t: return o
    if b == o: return t
    if b == t: return o
    stats['konflikt_ours_wins'] += 1
    return o
res = merge(base, ours, theirs)
with open(path,'w',encoding='utf-8') as f:
    json.dump(res, f, ensure_ascii=False, indent=2); f.write('\n')
print(path, stats)
