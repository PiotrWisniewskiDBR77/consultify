import sys, zipfile, re
from xml.etree import ElementTree as ET
W='{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
path=sys.argv[1]
z=zipfile.ZipFile(path)
root=ET.fromstring(z.read('word/document.xml'))
out=[]
def ptext(p):
    return ''.join(t.text or '' for t in p.iter(W+'t'))
def pstyle(p):
    pr=p.find(W+'pPr')
    if pr is None: return ''
    ps=pr.find(W+'pStyle')
    return ps.get(W+'val') if ps is not None else ''
body=root.find(W+'body')
def walk(el, depth=0):
    for child in el:
        if child.tag==W+'p':
            t=ptext(child)
            s=pstyle(child)
            if t.strip() or s:
                out.append(f"[{s}] {t}" if s else t)
        elif child.tag==W+'tbl':
            out.append('--- TABELA ---')
            for tr in child.findall(W+'tr'):
                cells=[]
                for tc in tr.findall(W+'tc'):
                    cells.append(' '.join(ptext(p) for p in tc.findall(W+'p')).strip())
                out.append(' | '.join(cells))
            out.append('--- /TABELA ---')
        elif child.tag==W+'sdt':
            walk(child, depth)
        else:
            walk(child, depth)
walk(body)
print('\n'.join(out))
