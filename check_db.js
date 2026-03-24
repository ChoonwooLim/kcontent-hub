const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.downloadedFile.findMany({ take: 10, orderBy: { createdAt: 'desc' } }).then(r => {
  r.forEach(f => console.log(f.id, '|', f.filename, '|', f.filepath, '|', f.size));
  p.$disconnect();
}).catch(e => { console.error(e); p.$disconnect(); });
