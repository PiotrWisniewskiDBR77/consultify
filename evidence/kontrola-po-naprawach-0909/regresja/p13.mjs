import fs from 'node:fs';
const t=fs.readFileSync('/Users/piotrwisniewski/Developer/consultify-secrets/northwind-konta-STAGING.txt','utf8');
const h=(t.match(/Wspólne hasło do wszystkich kont poniżej \(dostęp pokazowy\): (.+)/)||[])[1].trim();
const API='http://127.0.0.1:4213/api';
const tok=(await (await fetch(`${API}/auth/login`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'james.whitfield@northwind.example',password:h})})).json()).token;
const H={authorization:`Bearer ${tok}`};
// FORMAT / SOURCE — artefakty wyjsciowe
const a=await (await fetch(`${API}/v8/outputs/artifacts?limit=50`,{headers:H})).json();
const arr=Array.isArray(a)?a:(a.data||a.artifacts||a.items||[]);
const bezSzab=arr.filter(x=>x.artifactFamily!=='template');
console.log('artefaktow (bez szablonow):',bezSzab.length,
 '| z exportFormat:',bezSzab.filter(x=>x.exportFormat).length,
 '| z originRuntime:',bezSzab.filter(x=>x.originRuntime).length);
console.log('przyklad:',JSON.stringify(bezSzab[0]?{t:bezSzab[0].titleSnapshot||bezSzab[0].title,f:bezSzab[0].exportFormat,s:bezSzab[0].originRuntime}:null));
// AREA / LEVEL / VARIANCE — inicjatywy
const i=await (await fetch(`${API}/initiatives`,{headers:H})).json();
const ia=Array.isArray(i)?i:(i.data||i.initiatives||[]);
console.log('inicjatyw:',ia.length,'| z area:',ia.filter(x=>x.area).length,'| z axis:',ia.filter(x=>x.axis).length,'| z level:',ia.filter(x=>x.level||x.initiativeLevel).length);
