const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {createServer} = require('../server.cjs');
const {validRecords,isAllowedUser,publicRecords} = require('../menu-service.cjs');
const rows = [
  {id:'food-1',category:'food',group:'warm',state:'public',live:{name:'메뉴',price:'10,000원'},draft:{name:'비공개 수정'}},
  {id:'food-2',category:'food',group:'cold',state:'soldout',live:{name:'품절 메뉴',price:'17,000원'}}
];
const emails = new Set(['owner@example.com']);
const token = {uid:'owner',email:'owner@example.com',email_verified:true,firebase:{sign_in_provider:'google.com'}};

test('only verified Google accounts in the allowlist are authorized',()=>{
  assert.ok(isAllowedUser(token,emails));
  for(const other of [{...token,email:'stranger@example.com'},{...token,email_verified:false},{...token,firebase:{sign_in_provider:'password'}}]) {
    assert.equal(isAllowedUser(other,emails),false);
  }
});
test('validate state, identity, food group, and contents; expose public/soldout while omitting drafts and hidden menus',()=>{
  assert.ok(validRecords(rows));
  assert.equal(validRecords([...rows,...rows]),false);
  assert.equal(validRecords([{...rows[0],live:{name:''}}]),false);
  assert.equal(validRecords([{...rows[0],state:'hidden',live:undefined}]),false);
  assert.equal(validRecords([{...rows[0],state:'soldout',live:undefined}]),false);
  assert.equal(validRecords([{...rows[0],group:'invalid'}]),false);
  assert.equal(validRecords([{id:'cocktail-1',category:'cocktail',group:'warm',state:'public',live:{name:'진토닉'}}]),false);
  const pub = publicRecords([...rows,{...rows[0],id:'hidden',state:'hidden'},{id:'draft-1',category:'food',state:'draft',draft:{name:'초안'}}]);
  assert.equal(pub.length,2);
  assert.equal(pub[0].state,'public');
  assert.equal(pub[0].draft,undefined);
  assert.equal(pub[0].group,'warm');
  assert.equal(pub[1].state,'soldout');
});
test('menu-data seed, englishPrice, and storage validation work cleanly',()=>{
  const context = {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../menu-data.js'),'utf8') + '\nthis.exports = {initial, englishPrice, parseStoredRecords};', context);
  const {initial, englishPrice, parseStoredRecords} = context.exports;
  assert.ok(validRecords(initial));
  assert.equal(englishPrice('3~5만 원대'),'₩30,000–50,000');
  assert.equal(englishPrice('12,000원부터'),'From ₩12,000');
  assert.equal(englishPrice('19,000원'),'₩19,000');
  assert.equal(englishPrice('별도 문의'),'Ask staff');
  assert.equal(englishPrice('시가'),'Market price');
  assert.equal(parseStoredRecords('not-json'),null);
  assert.equal(parseStoredRecords('[{"bad":true}]'),null);
  const migrated = parseStoredRecords(JSON.stringify([{id:'food-0',category:'food',state:'public',live:{name:'순살닭튀김',price:'19,000원'}}]));
  assert.equal(migrated[0].group,'warm');
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
  assert.equal(publicData.length,2);
  assert.equal(publicData[0].draft,undefined);
  assert.equal(publicData[1].state,'soldout');
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
  assert.match(page,/href="\.\.\/"/);
  assert.match(await (await get('/runtime.js')).text(),/cloud:true/);
});
