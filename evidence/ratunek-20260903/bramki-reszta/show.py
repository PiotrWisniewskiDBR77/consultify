import json,sys,re
t=open(sys.argv[1]).read()
i=t.rindex('\n{\n  "roles"')+1
d=json.loads(t[i:])
keys=sys.argv[2] if len(sys.argv)>2 else 'positions'
print(json.dumps(d.get('positions'),indent=2,ensure_ascii=False))
print("VERDICT:", json.dumps(d.get('verdict'),ensure_ascii=False))
if len(sys.argv)>2:
    flt=sys.argv[2]
    print(json.dumps({k:v for k,v in d.get('observations',{}).items() if flt in k},indent=2,ensure_ascii=False))
