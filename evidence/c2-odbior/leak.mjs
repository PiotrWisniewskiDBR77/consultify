import jwt from 'jsonwebtoken';
const orgId='a3e05d4a-5397-419d-b486-8e44366c0063', userId='60887056-371a-4404-b85c-61c920852579';
const token = jwt.sign({ id:userId, userId, email:'p@probe.invalid', organizationId:orgId, organization_id:orgId, role:'OWNER'}, process.env.JWT_SECRET,{algorithm:'HS256',expiresIn:'20m'});
for (const port of [4231,4241]) {
  const r = await fetch(`http://127.0.0.1:${port}/api/initiatives`,{headers:{Authorization:`Bearer ${token}`}});
  const j = await r.json(); const a = j?.data?.items||j?.items||j?.data||j;
  const orgs = {}; for (const x of a) { const o = x.organizationId || x.organization_id || '(brak pola org)'; orgs[o]=(orgs[o]||0)+1; }
  console.log(`${port===4231?'ON ':'OFF'} n=${a.length} orgs=${JSON.stringify(orgs)} klucze=${Object.keys(a[0]||{}).slice(0,10).join(',')}`);
}
