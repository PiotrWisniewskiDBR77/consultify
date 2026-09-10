import jwt from 'jsonwebtoken';
const orgs = [['DBR77','a3e05d4a-5397-419d-b486-8e44366c0063','60887056-371a-4404-b85c-61c920852579'],
              ['TT22TT','3935603f-e81c-4fc3-a154-623394e7cc32','f786e8f3-7a09-4fc1-b6ee-598a211038dc'],
              ['Northwind','468b234c-66c4-54e1-b626-5e0fb3a92f6a', null]];
const out = [];
for (const [name, orgId, userId] of orgs) {
  if (!userId) continue;
  const token = jwt.sign({ id: userId, userId, email:`${userId}@probe.invalid`, organizationId: orgId, organization_id: orgId, role:'OWNER' }, process.env.JWT_SECRET, { algorithm:'HS256', expiresIn:'20m' });
  for (const port of [4231, 4241]) {
    const r = await fetch(`http://127.0.0.1:${port}/api/initiatives`, { headers:{ Authorization:`Bearer ${token}` } });
    let n = null; try { const j = await r.json(); const a = j?.data?.items||j?.items||j?.data||j; n = Array.isArray(a)? a.length : null; } catch {}
    out.push({ org:name, port, flaga: port===4231?'ON':'OFF', status:r.status, liczba:n });
  }
}
console.log(`${process.argv[2]}\t` + out.map(o=>`${o.org}/${o.flaga}=${o.liczba}(${o.status})`).join('  '));
