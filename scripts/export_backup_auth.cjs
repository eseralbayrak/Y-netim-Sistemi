const fs = require('fs');
(async()=>{
  try{
    const loginRes = await fetch('http://localhost:3001/api/auth/login', {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({username:'admin', password:'tn6pCG3a_KCStg'})});
    const login = await loginRes.json();
    if(!login.token){ console.error('Login failed', login); process.exit(1); }
    const token = login.token;
    const res = await fetch('http://localhost:3001/api/backup', {headers: {authorization: 'Bearer '+token}});
    const json = await res.json();
    fs.writeFileSync('server/data/backup-export.json', JSON.stringify(json, null, 2));
    console.log('Authenticated backup saved to server/data/backup-export.json');
  }catch(e){ console.error(e); process.exit(1);} 
})();
