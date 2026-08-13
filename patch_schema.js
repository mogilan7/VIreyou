const fs = require('fs');
let content = fs.readFileSync('prisma/schema.prisma', 'utf8');

content = content.replace(/advice_id    String\?\n\}/, 'advice_id    String?\n\n  @@schema("public")\n}');
fs.writeFileSync('prisma/schema.prisma', content);
