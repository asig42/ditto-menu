const test = require('node:test');
const assert = require('node:assert/strict');
const {createServer} = require('../server.cjs');
const {validRecords,isAllowedUser,publicRecords} = require('../menu-service.cjs');
const rows = [{id:'food-1',category:'food',state:'public',live:{name:'메뉴',price:'10,000원'},draft:{name:'비공개 수정'}}];
const emails = new Set(['owner@example.com']);
const token = {uid:'owner',email:'owner@example.com',email_verified:true,firebase:{sign_in_provider:'google.com'}};

test('only verified Google accounts in the allowlist are authorized',()=>{
  assert.ok(isAllowedUser(token,emails));
  for(const other of [{...token,email:'stranger@example.com'},{...token,email_verified:false},{...token,firebase:{sign_in_provider:'password'}}]) {
    assert.equal(isAllowedUser(other,emails),false);
  }
});
test('validate state, identity, and contents; omit drafts and hidden menus from public output',()=>{
  assert.ok(validRecords(rows));
  assert.equal(validRecords([...rows,...rows]),false);
  assert.equal(validRecords([{...rows[0],live:{name:''}}]),false);
  assert.equal(validRecords([{...rows[0],state:'hidden',live:undefined}]),false);
  assert.equal(publicRecords([...rows,{...rows[0],id:'hidden',state:'hidden'}]).length,1);
  assert.equal(publicRecords(rows)[0].draft,undefined);
});
test('API enforces auth, rejects stale saves and persists edits atomically',async t=>{
  let data;
  const db = {
    doc:()=>({get:async()=>({exists:!!data,data:()=>data})}),
    runTransaction:async callback=>callback({
      get:async()=>({exists:!!data,data:()=>data}),
      set:(_ref,next)=>{data=next}
    })
  };
  const auth = {verifyIdToken:async value=>{
    if(value === 'invalid') throw Error('invalid');
    return value === 'owner' ? token : {...token,email:'stranger@example.com'};
  }};
  const server = createServer({auth,db,config:{projectId:'test'},emails,seed:rows});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base = 'http://127.0.0.1:' + server.address().port;
  const get = path => fetch(base+path);
  assert.equal((await get('/api/admin/menu')).status,401);
  assert.equal((await fetch(base+'/api/admin/menu',{headers:{Authorization:'Bearer invalid'}})).status,401);
  assert.equal((await fetch(base+'/api/admin/menu',{headers:{Authorization:'Bearer stranger'}})).status,403);
  const publicData = await (await get('/api/menu')).json();
  assert.equal(publicData[0].draft,undefined);
  const save = (revision,records)=>fetch(base+'/api/admin/menu',{method:'PUT',headers:{Authorization:'Bearer owner','Content-Type':'application/json'},body:JSON.stringify({revision,records})});
  assert.equal((await save(0,rows)).status,200);
  assert.equal(data.revision,1);
  assert.equal((await save(0,[{...rows[0],state:'hidden'}])).status,409);
  assert.equal(data.records[0].state,'public');
  assert.equal((await save(1,[{...rows[0],state:'hidden'}])).status,200);
  assert.deepEqual(await (await get('/api/menu')).json(),[]);
  assert.equal((await get('/package.json')).status,404);
  const redirect = await fetch(base+'/admin',{redirect:'manual'});
  assert.equal(redirect.status,308);
  assert.equal(redirect.headers.get('location'),'/admin/');
  const page = await (await get('/admin/')).text();
  assert.match(page,/id="admin" hidden/);
  assert.match(page,/admin-auth.js/);
  assert.match(await (await get('/runtime.js')).text(),/cloud:true/);
});
