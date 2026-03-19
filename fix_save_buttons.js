const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'src', 'app', '[locale]', 'diagnostics');
const subdirs = [
  "nicotine", "circadian", "alcohol", "systemic-bio-age", 
  "greene-scale", "bio-age", "sarc-f", "score", 
  "ipss", "insomnia", "mini-cog", "mief-5", "energy"
];

for (const sub of subdirs) {
  const fpath = path.join(dir, sub, 'page.tsx');
  if (!fs.existsSync(fpath)) continue;

  console.log(`Processing: ${sub}`);
  let content = fs.readFileSync(fpath, 'utf8');

  // 1. Update handleSave method (Pure setSaveStatus only, avoid non-existent variables)
  const handleSaveRegex = /const (handleSaveResult|handleSave) = async \(\) => \{\s*if \(!isAuthenticated([^]*?)\) return;/;
  if (handleSaveRegex.test(content)) {
      content = content.replace(handleSaveRegex, (match, methodName, condition) => {
          return `const ${methodName} = async () => {
        if (!isAuthenticated) {
            setSaveStatus('error');
            setTimeout(() => setSaveStatus('idle'), 4000);
            return;
        }
        if (!isAuthenticated${condition}) return;`;
      });
  }

  // 2. Safely Remove {isAuthenticated && ( using brace counter
  const guardRegex = /\{isAuthenticated\s*&&\s*\(\s*/g;
  let match;
  while ((match = guardRegex.exec(content)) !== null) {
      const index = match.index;
      console.log(`  Found guard at ${index}`);
      let depth = 2; // { and (
      let i = index + match[0].length; 
      
      while (i < content.length && depth > 0) {
          if (content[i] === '{' || content[i] === '(') depth++;
          if (content[i] === '}' || content[i] === ')') depth--;
          i++;
      }

      if (depth === 0) {
          const matchedBlock = content.substring(index, i);
          const innerContent = matchedBlock.substring(match[0].length, matchedBlock.length - 2); 
          
          const replacement = `<div className="flex flex-col gap-3 w-full">
            ${innerContent}
            {!isAuthenticated && (
                <div className="text-center text-xs text-slate-500 font-medium">
                   <a href="/ru/login" target="_blank" className="text-indigo-600 hover:underline font-bold">Войдите</a>, чтобы результаты сохранились в медархиве
                </div>
            )}
          </div>`;
          
          content = content.substring(0, index) + replacement + content.substring(i);
          console.log(`  Replaced guard block.`);
          guardRegex.lastIndex = index + replacement.length; 
      } else {
          console.log(`  Failed to match closing braces.`);
          break;
      }
  }

  fs.writeFileSync(fpath, content);
  console.log(`  Done: ${sub}\n`);
}
