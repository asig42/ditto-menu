const fs = require('node:fs');
const path = require('node:path');

function buildTarget(outDir, {cloud}) {
  fs.mkdirSync(path.join(outDir, 'admin'), {recursive: true});
  for (const file of ['index.html', 'base.css', 'ditto-logo.png', 'menu-data.js', 'menu.js']) {
    fs.copyFileSync(file, path.join(outDir, file));
  }
  const adminAssets = cloud ? ['admin.css', 'admin.js', 'admin-auth.js'] : ['admin.css', 'admin.js'];
  for (const file of adminAssets) {
    fs.copyFileSync(file, path.join(outDir, 'admin', file));
  }
  let html = fs.readFileSync('admin.html', 'utf8')
    .replace('href="base.css"', 'href="../base.css"')
    .replace('src="ditto-logo.png"', 'src="../ditto-logo.png"')
    .replace('src="menu-data.js"', 'src="../menu-data.js"')
    .replace('src="runtime.js"', 'src="../runtime.js"')
    .replace('href="./"', 'href="../"');
  if (!cloud) {
    html = html.replace(/\n?<script type="module" src="admin-auth\.js"><\/script>/, '');
  }
  fs.writeFileSync(path.join(outDir, 'admin', 'index.html'), html);
  fs.writeFileSync(path.join(outDir, 'runtime.js'), `window.dittoRuntime = {cloud:${cloud}};\n`);
}

const args = new Set(process.argv.slice(2));
if (args.has('--docs')) {
  buildTarget('docs', {cloud: false});
  console.log('Static preview assets built in docs/');
} else {
  buildTarget('dist', {cloud: true});
  console.log('Cloud Run web assets built in dist/');
}
