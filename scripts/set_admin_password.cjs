const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
(async()=>{
  try{
    const usersPath = path.join(__dirname,'..','server','data','users.json');
    const users = JSON.parse(fs.readFileSync(usersPath,'utf-8'));
    const admin = users.find(u=>u.username==='admin');
    if(!admin){ console.error('No admin user found'); process.exit(1);}    
    const newPass = crypto.randomBytes(10).toString('base64url');
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(String(newPass), salt, 64).toString('hex');
    admin.passwordHash = `${salt}:${hash}`;
    fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
    console.log('Updated admin password for user "admin"');
    console.log('New password:', newPass);
  }catch(e){console.error(e); process.exit(1);} 
})();
