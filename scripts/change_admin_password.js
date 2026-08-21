const fetch = globalThis.fetch || (await import('node-fetch')).default; (async()=>{try{
  const base='http://localhost:3001';
  const login = await fetch(base+'/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:'admin',password:'admin123'})});
  const loginJson = await login.json();
  if(!loginJson.token){console.error('Login failed', loginJson); process.exit(1);}
  const token = loginJson.token;
  const crypto = require('crypto');
  const newPass = crypto.randomBytes(8).toString('base64url');
  const usersRes = await fetch(base+'/api/users',{headers:{authorization:'Bearer '+token}});
  const users = await usersRes.json();
  const admin = users.find(u=>u.username==='admin');
  if(!admin) {console.error('Admin user not found via API'); process.exit(1)}
  const patch = await fetch(base+`/api/users/${admin.id}`,{method:'PATCH',headers:{'content-type':'application/json','authorization':'Bearer '+token},body:JSON.stringify({password:newPass})});
  const patchJson = await patch.json();
  console.log('Changed password for admin. New password: ' + newPass);
  console.log('API response:', patchJson);
}catch(e){console.error(e); process.exit(1);} })();
