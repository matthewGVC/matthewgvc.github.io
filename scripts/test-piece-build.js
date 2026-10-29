/* ============================================================
   The helper makes and rebuilds a job's pieces itself (0017; overturns D89,
   D91): the queue (helper/piece-build.js) with a made-up database, the
   folder reads a browser on the desktop may ask for (routes.js /job-tree,
   /job-file and pdf/lay.js readJobFile), and, with a site to load, the real
   thing end to end: the piece's own page laid out in the hidden browser from a
   made-up job folder (pdf/lay.js), then drawn (pdf/render.js).

     BASE=http://localhost:8080 node scripts/test-piece-build.js
     (without BASE, or NO_BROWSER=1, the browser part is skipped)
   Made-up jobs and files only; everything is written under the system temp folder.
   ============================================================ */
'use strict';

const fs = require('fs'), os = require('os'), path = require('path');
const { createBuilder } = require('../helper/piece-build.js');
const { readJobFile, pageUrl } = require('../helper/pdf/lay.js');
const { treeOf } = require('../helper/scan.js');

let pass = 0;
const failures = [];
function check(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; return; }
  failures.push(name + '\n      expected ' + w + '\n      got      ' + g);
}
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
function put(root, rel, buf) {
  const abs = path.join(root, ...rel.split('/'));
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, buf || PNG);
  return abs;
}

/* a database in memory, as the helper's supabase.js client sees it */
function fakeDb(T, o) {
  o = o || {};
  const calls = { rpc: [], updates: [] };
  const match = (row, m) => Object.keys(m || {}).every(k => String(row[k]) === String(m[k]));
  return {
    calls,
    ready: () => true,
    async select(table, m, cols, opts) {
      if (o.missing) throw Object.assign(new Error('GET /rest/v1/' + table + ' failed (404)'), { status: 404 });
      let rows = (T[table] || []).filter(r => match(r, m));
      if (opts && opts.order === 'asked_at.asc') rows = rows.slice().sort((a, b) => (a.asked_at < b.asked_at ? -1 : 1));
      if (opts && opts.limit) rows = rows.slice(0, opts.limit);
      return JSON.parse(JSON.stringify(rows));
    },
    async update(table, m, patch) {
      calls.updates.push([table, m, patch]);
      const rows = (T[table] || []).filter(r => match(r, m));
      rows.forEach(r => Object.assign(r, patch));
      return JSON.parse(JSON.stringify(rows));
    },
    async remove(table, m) {
      const keep = [], gone = [];
      (T[table] || []).forEach(r => (match(r, m) ? gone : keep).push(r));
      T[table] = keep;
      return gone;
    },
    async rpc(name, args) {
      calls.rpc.push([name, JSON.parse(JSON.stringify(args))]);
      if (o.conflict) throw Object.assign(new Error('POST /rest/v1/rpc/save_piece_build failed (400): conflict'), { status: 400 });
      const req = T.piece_requests.find(r => r.id === args.p_request);
      req.status = 'done'; req.result = { name: args.p_output.name };
      return {};
    }
  };
}

(async () => {
  /* ---------- the queue, with everything around it made up ---------- */
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gvc-build-'));
  const JOB = 'GVC - New York/Building Information/100 Example St/4A';
  const jobAbs = path.join(root, ...JOB.split('/'));
  put(jobAbs, 'Photos/Edited/01.jpg'); put(jobAbs, 'Photos/Edited/02.jpg');
  put(jobAbs, 'Floorplan/v2/Plan v2.jpg');
  put(jobAbs, 'Docs/Exclusive - Jane Client.pdf', Buffer.from('%PDF private'));
  const T = {
    properties: [{ id: 'p1', slug: '100-example-st-4a', label: '100 Example St, 4A', market: 'NYC', core: { address: '100 Example St', unit: '4A' }, drive_folder: JOB },
      { id: 'p2', slug: 'no-folder', label: 'No Folder', market: 'NJ', core: { address: '2 Nowhere Ln' } },
      { id: 'p3', slug: 'paper', label: 'Paper', market: 'NJ', core: { address: '3 Paper St' }, drive_folder: 'GVC - New Jersey/Docs/3 Paper St' }],
    pitches: [],
    documents: [{ property_id: 'p1', tool: 'showsheet', version: 4, state: { x: 1 }, output: null, outputs: [] }],
    piece_requests: [
      { id: 'r2', property_id: 'p1', tool: 'brochure', status: 'waiting', asked_at: '2026-10-29T10:05:00Z' },
      { id: 'r1', property_id: 'p1', tool: 'showsheet', status: 'waiting', asked_at: '2026-10-29T10:00:00Z' },
      { id: 'r3', property_id: 'p2', tool: 'showsheet', status: 'waiting', asked_at: '2026-10-29T10:06:00Z' },
      { id: 'r4', property_id: 'p3', tool: 'signage', status: 'waiting', asked_at: '2026-10-29T10:07:00Z' },
      { id: 'r5', property_id: 'p1', tool: 'pitch-map', status: 'waiting', asked_at: '2026-10-29T10:08:00Z' }
    ]
  };
  const db = fakeDb(T);
  const lays = [], renders = [];
  const NOW = new Date('2026-10-29T12:00:00Z');
  const b = createBuilder({
    db, driveRoot: root, siteBase: 'http://localhost:9', today: () => '2026-10-29', now: () => NOW, sleep: async () => {},
    treeOf,
    layPiece: async x => {
      lays.push(x);
      if (x.tool === 'brochure') return { why: 'Drive hasn\'t downloaded 03.jpg on Matt\'s desktop yet.' };
      return { state: { address: '100 Example St', drawn: x.tool }, storable: { kept: true }, builtFrom: { v: 1, via: 'helper', facts: { price: 1 } }, paper: 'a5' };
    },
    render: async x => { renders.push(x); return { pdf: Buffer.from('%PDF-1.4 drawn ' + x.tool), pages: 2 }; },
    driveLink: () => 'https://drive.google.com/file/d/MADE/view'
  });
  const first = await b.runOne();
  check('queue: the oldest waiting request first', first, { done: 'r1', name: 'Showsheet - 100 Example St 4A - 2026-10-29.pdf' });
  check('queue: claimed before it was made (waiting → working, only if still waiting)', db.calls.updates[0], ['piece_requests', { id: 'r1', status: 'waiting' }, { status: 'working', started_at: NOW.toISOString() }]);
  const lay = lays[0];
  check('lay: the job, its records and its folder\'s tree handed to the page', [lay.tool, lay.kind, lay.row.id, lay.docs.length, lay.jobAbs === jobAbs, lay.siteBase],
    ['showsheet', 'listing', 'p1', 1, true, 'http://localhost:9']);
  const names = JSON.stringify(lay.tree);
  check('lay: the tree has the photos and plans, never paperwork', [/01\.jpg/.test(names), /Plan v2\.jpg/.test(names), /Jane Client/.test(names)], [true, true, false]);
  check('render: what the page laid out, on its paper', renders[0], { tool: 'showsheet', state: { address: '100 Example St', drawn: 'showsheet' }, paper: 'a5', siteBase: 'http://localhost:9' });
  check('write: into Marketing\\Showsheet\\, made for it', fs.existsSync(path.join(jobAbs, 'Marketing', 'Showsheet', 'Showsheet - 100 Example St 4A - 2026-10-29.pdf')), true);
  const [rpcName, args] = db.calls.rpc[0] || [];
  check('record: save_piece_build with the request, the version read and what the page keeps', [rpcName, args.p_request, args.p_version, args.p_state, args.p_built_from.via],
    ['save_piece_build', 'r1', 4, { kept: true }, 'helper']);
  check('record: the file as written', [args.p_output.path, args.p_output.name, args.p_output.url, args.p_output.paper, args.p_output.via, args.p_output.madeAt, args.p_archived],
    ['Marketing/Showsheet/Showsheet - 100 Example St 4A - 2026-10-29.pdf', 'Showsheet - 100 Example St 4A - 2026-10-29.pdf', 'https://drive.google.com/file/d/MADE/view', 'a5', 'helper', NOW.toISOString(), null]);
  check('record: the request is done', T.piece_requests.find(r => r.id === 'r1').status, 'done');

  const rest = await b.runAll();
  check('queue: the rest in order', rest.map(r => r.done || r.failed), ['r2', 'r3', 'r4', 'r5']);
  const msg = id => T.piece_requests.find(r => r.id === id);
  check('the page refuses: failed with its sentence, nothing drawn or written', [msg('r2').status, msg('r2').message, renders.length, fs.existsSync(path.join(jobAbs, 'Marketing', 'Brochure'))],
    ['failed', 'Drive hasn\'t downloaded 03.jpg on Matt\'s desktop yet.', 1, false]);
  check('no folder linked: failed before anything is laid out', [msg('r3').status, msg('r3').message, lays.length], ['failed', 'This job has no Drive folder linked.', 2]);
  check('a paperwork folder: refused', [msg('r4').status, msg('r4').message], ['failed', 'The workspace doesn\'t write into that folder.']);
  check('the map is not made here', [msg('r5').status, msg('r5').message], ['failed', 'The helper can\'t make a pitch-map from a job.']);
  check('every failure is dated', ['r2', 'r3', 'r4', 'r5'].every(id => msg(id).finished_at === NOW.toISOString()), true);
  check('nothing left waiting', await b.runOne(), null);

  // a rebuild the same day: never overwrites; the record's own older file goes to Archive
  T.documents[0].output = Object.assign({}, args.p_output, { size: fs.statSync(path.join(jobAbs, 'Marketing', 'Showsheet', args.p_output.name)).size,
    modified: fs.statSync(path.join(jobAbs, 'Marketing', 'Showsheet', args.p_output.name)).mtime.toISOString() });
  T.documents[0].outputs = [T.documents[0].output];
  T.documents[0].version = 5;
  T.piece_requests.push({ id: 'r6', property_id: 'p1', tool: 'showsheet', status: 'waiting', asked_at: '2026-10-29T11:00:00Z' });
  const again = await b.runOne();
  const a2 = db.calls.rpc[db.calls.rpc.length - 1][1];
  check('rebuild: a new file, the older one moved into Archive', [again.name, a2.p_version, a2.p_archived && a2.p_archived.to],
    ['Showsheet - 100 Example St 4A - 2026-10-29 (2).pdf', 5, 'Marketing/Showsheet/Archive/Showsheet - 100 Example St 4A - 2026-10-29.pdf']);

  // the piece saved elsewhere while the helper made it: the file is said, the request failed
  const T2 = JSON.parse(JSON.stringify(T)); T2.piece_requests = [{ id: 'c1', property_id: 'p1', tool: 'showsheet', status: 'waiting', asked_at: '2026-10-29T11:00:00Z' }];
  const db2 = fakeDb(T2, { conflict: true });
  const b2 = createBuilder({ db: db2, driveRoot: root, siteBase: 'x', today: () => '2026-10-29', now: () => NOW, sleep: async () => {}, treeOf,
    layPiece: async () => ({ state: {}, storable: {}, builtFrom: { v: 1 }, paper: 'a5' }), render: async () => ({ pdf: Buffer.from('%PDF'), pages: 1 }), driveLink: () => null });
  await b2.runOne();
  check('conflict: the request fails, naming the file already on Drive', [T2.piece_requests[0].status, T2.piece_requests[0].message],
    ['failed', 'Saved Showsheet - 100 Example St 4A - 2026-10-29.pdf to Drive, but the showsheet was saved somewhere else while the helper made it. Ask again.']);

  // a helper that stopped mid-build: its request waits again; old finished ones are cleared
  const T3 = { piece_requests: [{ id: 'w1', status: 'working' }, { id: 'd1', status: 'done', finished_at: '2026-09-01T00:00:00Z' }, { id: 'd2', status: 'failed', finished_at: '2026-10-28T00:00:00Z' }] };
  const b3 = createBuilder({ db: fakeDb(T3), driveRoot: root, now: () => NOW, treeOf, layPiece: async () => ({}), render: async () => ({}) });
  await b3.recover();
  await b3.clean();
  check('recover and clean', T3.piece_requests.map(r => [r.id, r.status]), [['w1', 'waiting'], ['d2', 'failed']]);
  // before migration 0017 the table isn't there: quiet
  const b4 = createBuilder({ db: fakeDb({}, { missing: true }), driveRoot: root, treeOf, layPiece: async () => ({}), render: async () => ({}), log: m => { throw new Error('logged ' + m); } });
  check('no table yet: nothing done, nothing logged', await b4.runAll(), []);
  check('poke answers at once', b4.poke(), { ok: true });

  /* ---------- the files a page may read ---------- */
  const rd = rel => { try { const f = readJobFile(jobAbs, rel); return [f.type, f.buf.length > 0]; } catch (e) { return [e.status, e.message]; } };
  check('read: a photo', rd('Photos/Edited/01.jpg'), ['image/jpeg', true]);
  check('read: never paperwork', rd('Docs/Exclusive - Jane Client.pdf')[0], 403);
  check('read: never out of the job', rd('../4B/Photos/x.jpg')[0], 400);
  check('read: never a non-picture, even allowed', (put(jobAbs, 'Marketing/notes.txt', Buffer.from('x')), rd('Marketing/notes.txt'))[0], 403);
  check('read: a missing file is said', rd('Photos/Edited/09.jpg'), [404, 'Drive hasn\'t got 09.jpg on this computer.']);
  check('read: a paperwork word in a photo name', (put(jobAbs, 'Photos/Edited/Signed contract.jpg'), rd('Photos/Edited/Signed contract.jpg'))[0], 403);
  check('page addresses', [pageUrl('postcard-sold', 'listing', 'a b', 'http://x/'), pageUrl('seller', 'pitch', 'q', 'http://x')],
    ['http://x/tools/postcard/?listing=a%20b&build=1&card=sold', 'http://x/tools/seller-package/?pitch=q&build=1']);
  const { jobReadRoutes } = require('../helper/routes.js');
  const jr = jobReadRoutes({ driveRoot: root, treeOf });
  const tr = await jr.tree({ folder: JOB });
  check('/job-tree: the scan\'s tree', [tr.ok, /01\.jpg/.test(JSON.stringify(tr.tree)), /Jane Client/.test(JSON.stringify(tr.tree))], [true, true, false]);
  const fr = await jr.file({ folder: JOB, file: 'Photos/Edited/02.jpg' });
  check('/job-file: base64 of the picture', [fr.ok, fr.type, Buffer.from(fr.data, 'base64').equals(PNG)], [true, 'image/jpeg', true]);
  const jrErr = b => jr.file(b).then(() => null, e => e.status);
  check('/job-file refusals', [await jrErr({ folder: 'GVC - New Jersey/Docs/x', file: 'Photos/a.jpg' }), await jrErr({ folder: JOB, file: 'Docs/Exclusive - Jane Client.pdf' }),
    await jrErr({ folder: '../../Windows', file: 'Photos/a.jpg' }), await jrErr({ folder: 'one', file: 'Photos/a.jpg' })], [403, 403, 400, 400]);
  check('/job-tree: a folder that is gone says so', (await jr.tree({ folder: 'GVC - New York/Gone/9 Gone St' })).tree.broken, true);

  /* ---------- end to end: the real pages laid out and drawn in the hidden browser ---------- */
  if (process.env.BASE && !process.env.NO_BROWSER) {
    const { layPiece } = require('../helper/pdf/lay.js');
    const { renderPiece } = require('../helper/pdf/render.js');
    const rec = (value, source) => ({ value, source: source || 'DE', bySource: { [source || 'DE']: value } });
    const row = { id: 'p1', slug: '100-example-st-4a', label: '100 Example St, 4A', kind: 'sale', market: 'NYC', stage: 'Live', version: 7,
      core: { address: '100 Example St', unit: '4A', neighborhood: 'Testville', propertyType: 'Condo', price: 4500000, beds: 3, baths: 2, commonCharges: 2100, taxesMonthly: 1900,
        agentIds: ['john-gasdaska'], buildingFeatures: ['Pre-war'], interiorFeatures: ['South exposure'],
        facts: { price: rec(4500000), beds: rec(3), baths: rec(2), commonCharges: rec(2100), taxesMonthly: rec(1900), buildingFeatures: rec(['Pre-war']), interiorFeatures: rec(['South exposure']) } },
      de: { listingUrl: 'https://www.elliman.com/new-york-city/100-example-st/4a/9001' }, drive_folder: JOB, photo_hero: null, photo_order: [] };
    const saved = { property_id: 'p1', tool: 'showsheet', version: 4, state: { residence: { features: ['Kept wording'] },
      listsFrom: { buildingFeatures: ['Pre-war'], interiorFeatures: ['South exposure'] } }, outputs: [] };   // the lists its wording came from: unchanged
    const tree = treeOf(jobAbs, 4);
    const sheet = await layPiece({ tool: 'showsheet', kind: 'listing', row, docs: [saved], tree, jobAbs, siteBase: process.env.BASE });
    check('e2e showsheet: laid out, nothing missing', sheet.why, undefined);
    check('e2e showsheet: two photos and the plan, inline, from the folder', [sheet.state.photos.length, sheet.state.photos.every(p => /^data:image\//.test(p.src)), /^data:image\//.test(sheet.state.floorplan || ''), sheet.paper],
      [2, true, true, 'a5']);
    check('e2e showsheet: the job\'s facts and the sheet\'s own wording', [sheet.state.address, sheet.state.price, sheet.state.residence.features], ['100 Example St', '$4,500,000', ['Kept wording']]);
    check('e2e showsheet: built_from names the files it printed', [sheet.builtFrom.photos.front.path, sheet.builtFrom.photos.back.path, sheet.builtFrom.floorplan.path, sheet.builtFrom.via],
      ['Photos/Edited/01.jpg', 'Photos/Edited/02.jpg', 'Floorplan/v2/Plan v2.jpg', 'helper']);
    check('e2e showsheet: what is kept has paths, no pictures', [JSON.stringify(sheet.storable).includes('data:'), sheet.storable.photos.map(p => p.path)], [false, ['Photos/Edited/01.jpg', 'Photos/Edited/02.jpg']]);
    const pdf = await renderPiece({ tool: 'showsheet', state: sheet.state, paper: sheet.paper, siteBase: process.env.BASE });
    check('e2e showsheet: drawn as before, two pages', [pdf.pages, pdf.pdf.slice(0, 5).toString()], [2, '%PDF-']);

    const brochure = await layPiece({ tool: 'brochure', kind: 'listing', row, docs: [], tree, jobAbs, siteBase: process.env.BASE });
    check('e2e brochure: photos and the plan from the folder', [brochure.why, brochure.state.images.length, brochure.state.floorplans.length, brochure.builtFrom.tool], [undefined, 2, 1, 'brochure']);
    const sign = await layPiece({ tool: 'signage', kind: 'listing', row: Object.assign({}, row, { market: 'NJ' }), docs: [], tree, jobAbs, siteBase: process.env.BASE });
    check('e2e sign: the job\'s agents and its DE link', [sign.why, sign.state.agents, sign.builtFrom.listingUrl], [undefined, ['john-gasdaska'], 'https://www.elliman.com/new-york-city/100-example-st/4a/9001']);
    // a printed photo that can't be read (Drive's placeholder, a broken file): refused, named
    const JOB2 = 'GVC - New York/Building Information/100 Example St/5B', job2 = path.join(root, ...JOB2.split('/'));
    put(job2, 'Photos/Edited/01.jpg', Buffer.from('not a picture')); put(job2, 'Photos/Edited/02.jpg');
    const missing = await layPiece({ tool: 'showsheet', kind: 'listing', row: Object.assign({}, row, { drive_folder: JOB2 }), docs: [], tree: treeOf(job2, 4), jobAbs: job2, siteBase: process.env.BASE });
    check('e2e: a printed photo that can\'t be read is refused, named', /01\.jpg/.test(missing.why || ''), true);
  } else console.log('  (browser part skipped: set BASE to the local site)');

  fs.rmSync(root, { recursive: true, force: true });
  console.log('\n  ' + pass + ' passed' + (failures.length ? ', ' + failures.length + ' failed' : ''));
  if (failures.length) { console.log('\n  ' + failures.join('\n\n  ') + '\n'); process.exit(1); }
  console.log();
})().catch(e => { console.log('  FAIL ' + (e.stack || e)); process.exit(1); });
