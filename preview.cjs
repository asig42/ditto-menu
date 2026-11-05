const http = require('node:http');
const { createReadStream } = require('node:fs');
const { join } = require('node:path');

const assets = new Map([
  ['index.html', 'text/html; charset=utf-8'],
  ['admin.html', 'text/html; charset=utf-8'],
  ['base.css', 'text/css; charset=utf-8'],
  ['admin.css', 'text/css; charset=utf-8'],
  ['menu-data.js', 'text/javascript; charset=utf-8'],
  ['menu.js', 'text/javascript; charset=utf-8'],
  ['admin.js', 'text/javascript; charset=utf-8'],
  ['ditto-logo.png', 'image/png']
]);

http.createServer((request, response) => {
  const path = request.url.split('?')[0];
  if (path === '/admin/') {
    response.writeHead(302, { Location: '/admin' }).end();
    return;
  }
  const file = path === '/' ? 'index.html' : path === '/admin' ? 'admin.html' : path.slice(1);
  const contentType = assets.get(file);
  if (!contentType) {
    response.writeHead(404).end();
    return;
  }
  response.setHeader('Content-Type', contentType);
  createReadStream(join(__dirname, file))
    .on('error', () => response.writeHead(404).end())
    .pipe(response);
}).listen(4173, '127.0.0.1', () => {
  console.log('손님 메뉴  http://127.0.0.1:4173/');
  console.log('메뉴 운영  http://127.0.0.1:4173/admin');
});
