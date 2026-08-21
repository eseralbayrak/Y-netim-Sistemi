const fetch = globalThis.fetch || require('node-fetch');
(async()=>{
  try{
    const base = 'http://localhost:3001';
    const loginRes = await fetch(base+'/api/auth/login', {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({username:'admin', password:'tn6pCG3a_KCStg'})});
    const login = await loginRes.json();
    if(!login.token){ console.error('Login failed', login); process.exit(1); }
    const token = login.token;
    const users = [
      { username: 'depo', password: 'depo1234', role: 'Depo' },
      { username: 'satinalma', password: 'satinalma123', role: 'Satın Alma' },
      { username: 'kalite', password: 'kalite123', role: 'Giriş Kalite' }
    ];
    for(const u of users){
      const res = await fetch(base+'/api/users', {method:'POST', headers:{'content-type':'application/json','authorization':'Bearer '+token}, body: JSON.stringify(u)});
      const body = await res.json();
      console.log('Created/Updated:', u.username, 'status', res.status);
    }
    console.log('Demo users created.');
  }catch(e){ console.error(e); process.exit(1);} 
})();
