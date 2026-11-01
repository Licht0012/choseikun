import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import {DatabaseSync} from 'node:sqlite';
import ts from 'typescript';
import {relative} from 'node:path';
const require = createRequire(import.meta.url);
const cache = new Map();
function load(path, overrides = {}) {
  const filename = new URL(`../${path}`,import.meta.url).pathname;
  if (cache.has(filename)) return cache.get(filename);
  const source = ts.transpileModule(readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  const module = {exports:{}}; cache.set(filename,module.exports);
  runInNewContext(source,{module,exports:module.exports,require:(id)=>{
    if (id in overrides) return overrides[id];
    if (id.startsWith('@/')) return load(id.slice(2)+(id==='@/db'?'/index.ts':'.ts'), overrides);
    if (id.startsWith('.')) return load(relative(new URL('../',import.meta.url).pathname,new URL(id+'.ts',`file://${filename}`).pathname),overrides);
    return require(id);
  },Date,Set,Map,Intl,TextDecoder,TextEncoder,crypto,fetch:(...args)=>fakeFetch(...args),AbortSignal,console,Response,Request,Headers,btoa});
  return module.exports;
}
let fakeFetch;
const rules = load('lib/20261101_monthly-rules.ts');
const makeSlots=(n)=>Array.from({length:n},(_,i)=>({id:String(i),date:`2027-01-${String(i+4).padStart(2,'0')}`,startTime:'10:00',endTime:'12:00',label:'10:00〜12:00',sortOrder:i}));
const responses=(columns)=>rules.MEMBERS.map((name,i)=>({id:String(i),name,comment:'',updatedAt:'v1',availability:Object.fromEntries(columns.map((c,j)=>[String(j),c[i]]).filter(([,v])=>v))}));
test('年またぎ・JST境界・閏年・1/1〜3除外・祝日と土日の重複',()=>{
  assert.equal(rules.targetMonth(new Date('2026-11-15T10:00:00Z')),'2027-01');
  assert.equal(rules.targetMonth(new Date('2026-12-15T10:00:00Z')),'2027-02');
  assert.equal(rules.japanDate(new Date('2026-11-15T09:59:59Z')),'2026-11-15T18:59:59');
  const dates=rules.candidateDates('2027-01',new Set(['2027-01-01','2027-01-10','2027-01-11']));
  assert(!dates.some(d=>d<'2027-01-04')); assert(dates.includes('2027-01-11'));
  assert.equal(dates.filter(d=>d==='2027-01-10').length,1);
  assert(rules.candidateDates('2028-02',new Set(['2028-02-29'])).includes('2028-02-29'));
  assert.equal(rules.TIMES.length,3);
});
test('A:全員○だけ、5○1△除外、時系列',()=>{
  const slots=makeSlots(3);const r=responses([['yes','yes','yes','yes','yes','yes'],['yes','yes','yes','yes','yes','maybe'],['yes','yes','yes','yes','yes','yes']]);
  assert.deepEqual(Array.from(rules.selectCandidates([...slots].reverse(),r),s=>s.id),['0','2']);
  assert(rules.complete(slots,r));
});
test('B:全指定ケース、○数・△数による並び順、件数制限なし',()=>{
  const columns=['yyyyym','yyyynn','yyymmn','ymmmnn','yyynnn','yymnnn','mmmmnn','yyyynn','yyyymn'].map(c=>[...c].map(x=>({y:'yes',m:'maybe',n:'no'})[x]));
  assert.deepEqual(Array.from(rules.selectCandidates(makeSlots(9),responses(columns)),s=>s.id),['0','8','1','7','2','3','6']);
});
test('C/D/E:候補なし、同点時系列、未入力は票にしない・暫定表示',()=>{
  const slots=makeSlots(2),r=responses([['yes','yes','yes'],['yes','yes','yes']]);
  assert.equal(rules.selectCandidates(slots,r).length,0);assert.equal(rules.complete(slots,r),false);
  assert.match(rules.resultText([],true),/暫定結果/);assert.match(rules.resultText([],true),/候補日時がありません/);
  assert.match(rules.resultText([]),/全員の回答が揃いましたが/);
  assert.equal(rules.slotLabel({...slots[0],date:'2027-01-09'}),'01/09(土)10:00〜12:00');
});
test('未確定の将来祝日と壊れたCSVを拒否',()=>{
  assert.throws(()=>rules.parseHolidays('2026/1/1,元日',2027));
  assert.throws(()=>rules.parseHolidays('<html>error</html>',2027));
});
function harness() {
  cache.clear(); const sqlite=new DatabaseSync(':memory:');
  const schema=readFileSync(new URL('../db/index.ts',import.meta.url),'utf8');
  const initial=[...schema.matchAll(/`(CREATE TABLE IF NOT EXISTS[\s\S]*?)`/g)].map(m=>m[1]);
  initial.forEach(sql=>sqlite.exec(sql));
  sqlite.exec(readFileSync(new URL('../drizzle/20261101_monthly-automation.sql',import.meta.url),'utf8'));
  const db={prepare(sql){const stmt=sqlite.prepare(sql); let args=[];return {bind(...values){args=values;return this;},async first(){return stmt.get(...args)||null;},async all(){return {results:stmt.all(...args)};},async run(){return {meta:{changes:Number(stmt.run(...args).changes)}};}};},async batch(stmts){sqlite.exec('BEGIN');try{const result=[];for(const stmt of stmts)result.push(await stmt.run());sqlite.exec('COMMIT');return result;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};
  const env={MONTHLY_ENABLED:'true',MONTHLY_LINE_GROUP_ID:'C'+'a'.repeat(32),PUBLIC_BASE_URL:'https://example.test',LINE_CHANNEL_ACCESS_TOKEN:'test'};
  const overrides={'@/db':{getDb:async()=>db,getBindings:()=>env},'@/lib/security':{digestSecret:async s=>s,randomToken:n=>crypto.randomUUID().replaceAll('-','').slice(0,n)}};
  const automation=load('lib/20261101_monthly-automation.ts',overrides);
  return {sqlite,db,env,automation,overrides};
}
const holidayCsv=Array.from({length:16},(_,i)=>`2027/${Math.floor(i/2)+1}/${i%2+10},holiday`).join('\n');
test('D1統合:生成3時間帯×候補日・6人未入力・重複Cron・15/17/18通知・再試行キー',async()=>{
  const {sqlite,automation}=harness();let pushes=[];
  fakeFetch=async(url,options)=>{if(String(url).includes('cao.go.jp'))return new Response(holidayCsv);pushes.push(JSON.parse(options.body));return new Response('{}');};
  await automation.runMonthly(new Date('2026-11-15T09:59:00Z'));
  assert.equal(sqlite.prepare('SELECT count(*) n FROM events').get().n,0);
  await automation.runMonthly(new Date('2026-11-15T10:00:00Z'));
  await automation.runMonthly(new Date('2026-11-15T10:00:00Z'));
  assert.equal(sqlite.prepare('SELECT count(*) n FROM events').get().n,1);
  assert.equal(sqlite.prepare('SELECT count(*) n FROM responses').get().n,6);
  assert.equal(sqlite.prepare('SELECT count(*) n FROM availability').get().n,0);
  const dates=sqlite.prepare('SELECT count(*) n FROM candidate_dates').get().n;
  assert.equal(sqlite.prepare('SELECT count(*) n FROM slots').get().n,dates*3);
  assert.equal(pushes.length,1);assert.match(pushes[0].messages[0].text,/2027年01月/);assert.match(pushes[0].messages[0].text,/11月18日/);
  await automation.runMonthly(new Date('2026-11-17T10:00:00Z'));
  await automation.runMonthly(new Date('2026-11-18T14:59:00Z'));
  assert.equal(pushes.length,3);assert.match(pushes[1].messages[0].text,/明日/);assert.match(pushes[2].messages[0].text,/暫定結果/);
  const id=sqlite.prepare('SELECT id FROM events').get().id;
  await automation.enqueue(id,'final','final result');let keys=[];let failure=true;
  fakeFetch=async(_url,options)=>{keys.push(options.headers['X-Line-Retry-Key']);if(failure)throw new Error('test network failure');return new Response('{}');};
  await automation.deliverMonthly(new Date('2026-11-18T15:00:00Z'));failure=false;
  await automation.deliverMonthly(new Date('2026-11-18T15:02:00Z'));
  assert.equal(keys.length,2);assert.equal(keys[0],keys[1]);
  assert.equal(sqlite.prepare("SELECT count(*) n FROM monthly_errors WHERE kind='line_send'").get().n,1);
  assert(sqlite.prepare("SELECT sent_at FROM monthly_notifications WHERE kind='final'").get().sent_at);
});
test('D1統合:途中保存・競合拒否・コメント・不正入力・正式通知一度・再編集',async()=>{
  const {sqlite,automation,overrides}=harness();let pushes=0;
  fakeFetch=async(url)=>String(url).includes('cao.go.jp')?new Response(holidayCsv):(pushes++,new Response('{}'));
  await automation.runMonthly(new Date('2026-11-15T10:00:00Z'));
  const {saveMonthlyResponse}=load('lib/20261101_monthly-response.ts',overrides);
  const event=sqlite.prepare('SELECT * FROM events').get();
  const slots=sqlite.prepare('SELECT id FROM slots').all();
  const people=sqlite.prepare('SELECT * FROM responses ORDER BY created_at').all();
  const body=(p,answers=slots)=>({name:p.name,comment:'<script>alert(1)</script>',updatedAt:p.updated_at,availability:answers.map(s=>({slotId:s.id,status:'yes'}))});
  assert.equal((await saveMonthlyResponse(event,body(people[0],slots.slice(0,1)))).status,200);
  assert.equal((await saveMonthlyResponse(event,body(people[0]))).status,409);
  for(const person of people){const latest=sqlite.prepare('SELECT * FROM responses WHERE id=?').get(person.id);assert.equal((await saveMonthlyResponse(event,body(latest))).status,200);}
  assert.equal(sqlite.prepare("SELECT count(*) n FROM monthly_notifications WHERE kind='final'").get().n,1);
  const first=sqlite.prepare('SELECT * FROM responses WHERE id=?').get(people[0].id);
  assert.equal(first.comment,'<script>alert(1)</script>');
  assert.equal((await saveMonthlyResponse(event,{...body(first),comment:'a'.repeat(301)})).status,400);
  assert.equal((await saveMonthlyResponse(event,{...body(first),availability:[{slotId:'foreign',status:'yes'}]})).status,400);
  assert.equal((await saveMonthlyResponse(event,body(first))).status,200);
  assert.equal(pushes,2);
});

test('公式CSV実データ:振替休日・国民の休日・未確定年拒否',()=>{
  const csv=readFileSync(new URL('./fixtures/20261101_official-holidays.csv',import.meta.url),'utf8');
  const holidays=rules.parseHolidays(csv,2027);
  assert(rules.candidateDates('2027-03',holidays).includes('2027-03-22'));
  assert(rules.candidateDates('2026-09',holidays).includes('2026-09-22'));
  assert.throws(()=>rules.parseHolidays(csv,2028));
});

test('D1統合:全員完了ならリマインド・暫定なし、409受理済み、再試行期限停止',async()=>{
  const {sqlite,automation}=harness();let sent=0;
  fakeFetch=async(url)=>String(url).includes('cao.go.jp')?new Response(holidayCsv):(sent++,new Response('{}'));
  await automation.runMonthly(new Date('2026-11-15T10:00:00Z'));
  sqlite.exec("INSERT INTO availability(response_id,slot_id,status) SELECT r.id,s.id,'yes' FROM responses r JOIN slots s ON s.event_id=r.event_id");
  await automation.runMonthly(new Date('2026-11-17T10:00:00Z'));
  await automation.runMonthly(new Date('2026-11-18T14:59:00Z'));
  assert.equal(sent,2);
  assert.equal(sqlite.prepare("SELECT count(*) n FROM monthly_notifications WHERE kind IN ('reminder','provisional')").get().n,0);
  sqlite.exec("UPDATE monthly_notifications SET sent_at=NULL WHERE kind='final'");
  fakeFetch=async()=>new Response('{}',{status:409,headers:{'x-line-accepted-request-id':'accepted'}});
  await automation.deliverMonthly(new Date('2026-11-17T10:01:00Z'));
  assert(sqlite.prepare("SELECT sent_at FROM monthly_notifications WHERE kind='final'").get().sent_at);
  sqlite.exec("UPDATE monthly_notifications SET sent_at=NULL WHERE kind='final'");
  await automation.deliverMonthly(new Date('2026-11-18T10:01:00Z'));
  assert.equal(sqlite.prepare("SELECT blocked FROM monthly_notifications WHERE kind='final'").get().blocked,1);
});

test('D1統合:祝日取得失敗時キャッシュ利用・無効設定で送信なし・Bot退出中は停止',async()=>{
  const {sqlite,automation,env}=harness();
  fakeFetch=async(url)=>String(url).includes('cao.go.jp')?new Response(holidayCsv):new Response('{}');
  await automation.runMonthly(new Date('2026-11-15T10:00:00Z'));
  sqlite.exec("DELETE FROM monthly_notifications; DELETE FROM availability; DELETE FROM responses; DELETE FROM slots; DELETE FROM candidate_dates; DELETE FROM time_options; DELETE FROM monthly_events; DELETE FROM events;");
  fakeFetch=async()=>{throw new Error('holiday offline');};
  env.MONTHLY_LINE_GROUP_ID='C'+'b'.repeat(32);
  await automation.runMonthly(new Date('2026-11-15T10:00:00Z'));
  assert.equal(sqlite.prepare('SELECT count(*) n FROM monthly_events').get().n,1);
  let called=0;fakeFetch=async()=>{called++;return new Response('{}');};
  sqlite.prepare("INSERT INTO monthly_settings(key,value) VALUES ('group_left',?)").run(env.MONTHLY_LINE_GROUP_ID);
  await automation.deliverMonthly(new Date('2026-11-15T10:10:00Z'));assert.equal(called,0);
  env.MONTHLY_ENABLED='false';await automation.runMonthly(new Date('2026-12-15T10:00:00Z'));assert.equal(called,0);
});

test('D1統合:公開APIで期限後編集を拒否・自動生成ページの候補変更禁止',async()=>{
  const {sqlite,automation,overrides}=harness();
  fakeFetch=async(url)=>String(url).includes('cao.go.jp')?new Response(holidayCsv):new Response('{}');
  await automation.runMonthly(new Date('2026-11-15T10:00:00Z'));
  const event=sqlite.prepare('SELECT * FROM events').get();
  sqlite.prepare("UPDATE events SET deadline_date='2000-01-01' WHERE id=?").run(event.id);
  const route=load('app/api/events/[slug]/responses/route.ts',overrides);
  assert.equal((await route.POST(new Request('https://example.test',{method:'POST',body:'{}'}),{params:Promise.resolve({slug:event.slug})})).status,409);
  const editor=load('lib/event-editor.ts',overrides);
  await assert.rejects(editor.updateEventConfiguration(event,{}),/変更できません/);
});

test('React描画:6行・右端コメント・未入力・XSSエスケープ・期限後無効',()=>{
  const react=require('react'),{renderToStaticMarkup}=require('react-dom/server');
  const {MonthlyResponseTable}=load('app/components/20261101_MonthlyResponseTable.tsx');
  const slots=makeSlots(2),people=responses([[],[]]);people[0].comment='<script>alert(1)</script>';
  const html=renderToStaticMarkup(react.createElement(MonthlyResponseTable,{event:{slug:'demo',slots,responses:people,isOpen:false,candidates:[]}}));
  for(const name of rules.MEMBERS)assert(html.includes(name));
  assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>/);
  assert.match(html,/disabled/);assert.match(html,/未入力/);assert.match(html,/回答期限を過ぎています/);
});


test('本番起動と同じスキーマ定義をD1相当の単文で初期化できる',async()=>{
  const {sqlite}=harness();
  const {monthlySchemaStatements}=load('db/20261101_monthly-schema.ts');
  for (const sql of monthlySchemaStatements) {
    assert.match(sql,/^CREATE (TABLE|INDEX)/);
    sqlite.prepare(sql).run();
  }
  assert(sqlite.prepare("SELECT name FROM sqlite_master WHERE name='monthly_events'").get());
});
