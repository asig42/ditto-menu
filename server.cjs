const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {validRecords,isAllowedUser,publicRecords} = require('./menu-service.cjs');

function createServer({auth,db,config,emails,seed,root = path.join(__dirname,'dist')}) {
  const reference = db.doc('ditto/menu');
  function send(response,status,value) {
    response.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
    response.end(JSON.stringify(value));
  }
  return http.createServer(async (request,response) => {
    response.setHeader('X-Content-Type-Options','nosniff');
    response.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
    const url = new URL(request.url,'http://localhost');
    try {
      if (url.pathname === '/api/config' && request.method === 'GET') return send(response,200,config);
      if (url.pathname === '/api/menu' && request.method === 'GET') {
        const snapshot = await reference.get();
        return send(response,200,publicRecords(snapshot.exists ? snapshot.data().records : seed));
      }
      if (url.pathname === '/api/admin/menu') {
        let token;
        try {
          const bearer = /^Bearer (.+)$/.exec(request.headers.authorization || '');
          if (!bearer) return send(response,401,{error:'로그인이 필요합니다.'});
          token = await auth.verifyIdToken(bearer[1],true);
        } catch { return send(response,401,{error:'로그인이 만료되었습니다. 다시 로그인해 주세요.'}); }
        if (!isAllowedUser(token,emails)) return send(response,403,{error:'접근이 허용되지 않은 계정입니다.'});
        if (request.method === 'GET') {
          const snapshot = await reference.get();
          return send(response,200,snapshot.exists ? snapshot.data() : {records:seed,revision:0});
        }
        if (request.method === 'PUT') {
          let body = '';
          for await (const chunk of request) {
            body += chunk.toString();
            if (Buffer.byteLength(body) > 800000) return send(response,413,{error:'저장할 메뉴가 너무 많습니다.'});
          }
          let data;
          try { data = JSON.parse(body); }
          catch { return send(response,400,{error:'잘못된 저장 형식입니다.'}); }
          if (!Number.isSafeInteger(data.revision) || data.revision < 0 || !validRecords(data.records)) {
            return send(response,400,{error:'메뉴 내용을 확인해 주세요.'});
          }
          const revision = await db.runTransaction(async transaction => {
            const snapshot = await transaction.get(reference);
            const current = snapshot.exists ? snapshot.data().revision : 0;
            if (current !== data.revision) {
              const conflict = new Error('다른 관리자가 변경했습니다. 내용을 복사한 뒤 새로고침해 주세요.');
              conflict.status = 409;
              throw conflict;
            }
            transaction.set(reference,{records:data.records,revision:current + 1,updatedBy:token.uid,updatedAt:new Date().toISOString()});
            return current + 1;
          });
          return send(response,200,{revision});
        }
        return send(response,405,{error:'지원하지 않는 요청입니다.'});
      }
      if (url.pathname.startsWith('/api/')) return send(response,404,{error:'찾을 수 없습니다.'});
      if (!['GET','HEAD'].includes(request.method)) return send(response,405,{error:'지원하지 않는 요청입니다.'});
      if (url.pathname === '/admin') { response.writeHead(308,{Location:'/admin/'}).end(); return; }
      const publicFiles = new Set(['index.html','base.css','ditto-logo.png','menu-data.js','menu.js','runtime.js',
        'admin/index.html','admin/admin.css','admin/admin.js','admin/admin-auth.js']);
      const file = url.pathname === '/' ? 'index.html' : url.pathname === '/admin/' ? 'admin/index.html' : url.pathname.slice(1);
      if (!publicFiles.has(file)) return send(response,404,{error:'찾을 수 없습니다.'});
      const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png'};
      const bytes = await fs.promises.readFile(path.join(root,file));
      response.writeHead(200,{'Content-Type':types[path.extname(file)],'Cache-Control':'no-cache'});
      response.end(request.method === 'HEAD' ? undefined : bytes);
    } catch(error) {
      console.error(error.code || error.status || error.name);
      send(response,error.status || 503,{error:error.status === 409 ? error.message : '서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.'});
    }
  });
}
if (require.main === module) {
  const config = {
    projectId:process.env.FIREBASE_PROJECT_ID,
    apiKey:process.env.FIREBASE_API_KEY,
    authDomain:process.env.FIREBASE_AUTH_DOMAIN,
    appId:process.env.FIREBASE_APP_ID
  };
  const emails = new Set((process.env.ADMIN_EMAILS || '').split(',').map(email=>email.trim().toLowerCase()).filter(Boolean));
  if (Object.values(config).some(value=>!value) || !emails.size) throw new Error('Firebase 설정과 ADMIN_EMAILS를 지정해 주세요.');
  const {initializeApp,applicationDefault} = require('firebase-admin/app');
  const {getAuth} = require('firebase-admin/auth');
  const {getFirestore} = require('firebase-admin/firestore');
  initializeApp({credential:applicationDefault(),projectId:config.projectId});
  const seed = vm.runInNewContext(fs.readFileSync(path.join(__dirname,'menu-data.js'),'utf8') + '\ninitial');
  createServer({auth:getAuth(),db:getFirestore(),config,emails,seed})
    .listen(Number(process.env.PORT || 8080),'0.0.0.0',()=>console.log('DITTO server started'));
}
module.exports = {createServer};
