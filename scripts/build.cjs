const fs = require('node:fs');
const path = require('node:path');
fs.mkdirSync('dist/admin', {recursive:true});
for (const file of ['index.html','base.css','ditto-logo.png','menu-data.js','menu.js','runtime.js']) {
  fs.copyFileSync(file, path.join('dist', file));
}
for (const file of ['admin.css','admin.js','admin-auth.js']) {
  fs.copyFileSync(file, path.join('dist/admin', file));
}
const html = fs.readFileSync('admin.html','utf8')
  .replace('href="base.css"', 'href="../base.css"')
  .replace('src="ditto-logo.png"', 'src="../ditto-logo.png"')
  .replace('src="menu-data.js"', 'src="../menu-data.js"')
  .replace('src="runtime.js"', 'src="../runtime.js"');
fs.writeFileSync('dist/admin/index.html',html);
fs.writeFileSync('dist/runtime.js','window.dittoRuntime = {cloud:true};\n');
console.log('Cloud Run web assets built in dist/');
