import fs from 'fs';
import { globSync } from 'glob';

const files = globSync('js/**/*.js');

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  if (content.includes('<<<<<<< HEAD')) {
    const regex = /<<<<<<< HEAD\n([\s\S]*?)=======\n([\s\S]*?)>>>>>>> origin\/main\n/g;
    content = content.replace(regex, '$2');
    fs.writeFileSync(file, content, 'utf8');
    console.log('Fixed conflicts in', file);
  }
}
