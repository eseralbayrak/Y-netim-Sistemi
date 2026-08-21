const fs = require('fs');
(async()=>{
  try{
    const res = await fetch('http://localhost:3001/api/backup');
    const json = await res.json();
    fs.writeFileSync('server/data/backup-export.json', JSON.stringify(json, null, 2));
    console.log('Backup saved to server/data/backup-export.json');
  }catch(e){ console.error(e); process.exit(1);} 
})();
