import fs from 'node:fs';
const t=fs.readFileSync('/Users/piotrwisniewski/Developer/consultify-secrets/northwind-konta-STAGING.txt','utf8');
const h=(t.match(/Wspólne hasło do wszystkich kont poniżej \(dostęp pokazowy\): (.+)/)||[])[1].trim();
const API='http://127.0.0.1:4213/api';
const tok=(await (await fetch(`${API}/auth/login`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'james.whitfield@northwind.example',password:h})})).json()).token;
const H={'content-type':'application/json',authorization:`Bearer ${tok}`};
const wynik=[];
async function proba(nazwa, metoda, sciezka, ciało) {
  const r=await fetch(`${API}${sciezka}`,{method:metoda,headers:H,...(ciało?{body:JSON.stringify(ciało)}:{})});
  const tx=(await r.text()).slice(0,140);
  wynik.push(`${nazwa.padEnd(34)} ${metoda} ${sciezka.padEnd(46)} -> ${r.status}  ${tx.replace(/\s+/g,' ')}`);
  return r.status;
}
// zadanie
const zad=(await (await fetch(`${API}/tasks?limit=200`,{headers:H})).json());
const arr=Array.isArray(zad)?zad:(zad.data||zad.tasks||[]);
const moje=arr.find(x=>String(x.title||'').startsWith('KONTROLA-mtuirqqp'));
console.log('zadan z API:',arr.length,'| moje:',moje?moje.id:'BRAK');
if(moje){ await proba('zadanie EDYCJA','PUT',`/tasks/${moje.id}`,{title:'KONTROLA-mtuirqqp task EDYTOWANE',description:'edycja przez API'});
  await proba('zadanie ODCZYT','GET',`/tasks/${moje.id}`);
  await proba('zadanie USUNIECIE','DELETE',`/tasks/${moje.id}`);
  await proba('zadanie ODCZYT PO','GET',`/tasks/${moje.id}`); }
// decyzja
const dec=(await (await fetch(`${API}/decisions?limit=200`,{headers:H})).json());
const darr=Array.isArray(dec)?dec:(dec.data||dec.decisions||[]);
const md=darr.find(x=>String(x.title||'').startsWith('KONTROLA-mtuirqqp'));
console.log('decyzji z API:',darr.length,'| moja:',md?md.id:'BRAK');
if(md){ await proba('decyzja EDYCJA','PUT',`/decisions/${md.id}`,{title:'KONTROLA-mtuirqqp decision EDYTOWANA'});
  await proba('decyzja USUNIECIE','DELETE',`/decisions/${md.id}`); }
console.log(wynik.join('\n'));
