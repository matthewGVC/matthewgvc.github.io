/* ============================================================
   PIECE BUILDS — the helper makes and rebuilds a job's pieces itself (0017;
   overturns D89 and D91; docs/piece-helper-design.md).

     const b = createBuilder({ db, driveRoot, siteBase, layPiece, render, driveLink, treeOf, today, now, sleep, log })
     await b.runAll()     works through every waiting request, oldest first, one at a time
     b.poke()             starts runAll now (POST /pieces/run), without waiting for it
     await b.recover()    a request left 'working' by a helper that stopped goes back to waiting
     await b.clean()      finished requests older than 30 days are cleared
     b.start(ms)          recover, then runAll every ms (15 s), clean once a day
     startBuilder(cfg)    the real one, once the helper has its account; poke() reaches it

   One request: claim it (waiting → working, so it is never made twice), read the
   job and the piece's records with the helper's own account, check the job's
   folder (piece.js jobFolderOf: linked, under Shared drives, no paperwork), read
   the folder's tree (scan.js treeOf), let the piece's own page lay it out
   (pdf/lay.js), draw it (pdf/render.js, the same drawing as before), write it into
   the folder (piece.js writePiece: never overwriting, the helper's own older file
   to Archive\), and record it (save_piece_build), which marks the request done.
   Anything that stops it marks the request failed, with the sentence that says why.
   ============================================================ */
'use strict';

const path = require('path');
const { PIECES } = require('./pieces.js');
const { jobFolderOf, writePiece, capped, fail, localDay, RENDER_MS } = require('./piece.js');

const EVERY_MS = 15 * 1000;
const KEEP_DAYS = 30;
const LAY_MS = 2 * 60 * 1000;

function createBuilder(o) {
  const db = o.db;
  const root = path.resolve(o.driveRoot);
  const today = o.today || (() => localDay(new Date()));
  const now = o.now || (() => new Date());
  const sleep = o.sleep || (ms => new Promise(r => setTimeout(r, ms)));
  const log = o.log || (() => {});
  let running = null, again = false, timer = null, cleanedOn = null;

  async function oldest() {
    return (await db.select('piece_requests', { status: 'waiting' }, '*', { order: 'asked_at.asc', limit: 1 }))[0] || null;
  }
  async function claim(req) {
    const rows = await db.update('piece_requests', { id: req.id, status: 'waiting' }, { status: 'working', started_at: now().toISOString() });
    return rows.length ? rows[0] : null;
  }
  async function failed(req, msg) {
    try { await db.update('piece_requests', { id: req.id }, { status: 'failed', finished_at: now().toISOString(), message: String(msg || 'It stopped.').slice(0, 500) }); }
    catch (e) { log('piece request ' + req.id + ' could not be marked failed: ' + e.message); }
  }

  async function build(req) {
    const spec = Object.prototype.hasOwnProperty.call(PIECES, req.tool) ? PIECES[req.tool] : null;
    if (!spec || !spec.page) throw fail(400, 'The helper can\'t make a ' + req.tool + ' from a job.');
    const table = req.pitch_id ? 'pitches' : 'properties', col = req.pitch_id ? 'pitch_id' : 'property_id';
    const noun = req.pitch_id ? 'pitch' : 'job';
    if (spec.owners.indexOf(table) === -1) throw fail(400, 'A pitch doesn\'t have a ' + spec.words + '.');
    const row = (await db.select(table, { id: req[col] }, '*'))[0];
    if (!row) throw fail(404, 'The ' + noun + ' isn\'t there any more.');
    const jobAbs = jobFolderOf(row, root, noun);
    const docs = await db.select('documents', { [col]: row.id }, '*');
    const doc = docs.filter(d => d.tool === req.tool)[0] || null;
    const tree = o.treeOf(jobAbs, 4);

    const lay = await capped(o.layPiece({ tool: req.tool, kind: req.pitch_id ? 'pitch' : 'listing', row, docs, tree, jobAbs, siteBase: o.siteBase }),
      o.layMs || LAY_MS, 'The ' + spec.words + ' took too long to lay out. Nothing was saved; ask again.');
    if (!lay || lay.why) throw fail(409, (lay && lay.why) || 'The ' + spec.words + ' couldn\'t be laid out.');
    const r = await capped(o.render({ tool: req.tool, state: lay.state, paper: lay.paper || null, siteBase: o.siteBase }), o.renderMs || RENDER_MS,
      'The ' + spec.words + ' took too long to draw. Nothing was saved; ask again.');
    const w = await writePiece({ jobAbs, spec, row, file: r, doc, today, sleep, driveLink: o.driveLink });
    const output = { path: w.path, name: w.name, size: w.size, modified: w.modified, url: w.url || null, paper: lay.paper || null,
      madeAt: now().toISOString(), via: 'helper' };
    try {
      await db.rpc('save_piece_build', { p_request: req.id, p_version: doc ? doc.version : null, p_state: lay.storable || {},
        p_built_from: lay.builtFrom, p_output: output, p_archived: w.archived || null });
    } catch (e) {
      const why = /conflict/.test(e.message) ? 'the ' + spec.words + ' was saved somewhere else while the helper made it' : 'the ' + noun + ' didn\'t record it';
      throw fail(409, 'Saved ' + w.name + ' to Drive, but ' + why + '. Ask again.');
    }
    return { name: w.name, archived: w.archived };
  }

  async function runOne() {
    const req = await oldest();
    if (!req) return null;
    const mine = await claim(req);
    if (!mine) return { skipped: req.id };
    try {
      const out = await build(mine);
      log('made ' + out.name);
      return { done: mine.id, name: out.name };
    } catch (e) {
      log('piece request ' + mine.id + ' (' + mine.tool + ') failed: ' + e.message);
      await failed(mine, e.message);
      return { failed: mine.id, message: e.message };
    }
  }

  function runAll() {
    if (running) { again = true; return running; }
    running = (async () => {
      const results = [];
      try {
        do {
          again = false;
          for (let i = 0; i < 50; i++) {
            const r = await runOne();
            if (!r) break;
            results.push(r);
          }
        } while (again);
      } catch (e) {
        // the table not there yet (0017 not run), or the database away: quiet until the next round
        if (e.status !== 404) log('piece requests could not be read: ' + e.message);
      } finally { running = null; }
      return results;
    })();
    return running;
  }

  async function recover() {
    try { await db.update('piece_requests', { status: 'working' }, { status: 'waiting', started_at: null }); }
    catch (e) { if (e.status !== 404) log('piece requests could not be recovered: ' + e.message); }
  }
  async function clean() {
    const day = localDay(now());
    if (cleanedOn === day) return;
    cleanedOn = day;
    const before = new Date(now().getTime() - KEEP_DAYS * 24 * 3600 * 1000).toISOString();
    try {
      const old = (await db.select('piece_requests', {}, 'id,status,finished_at')).filter(r => (r.status === 'done' || r.status === 'failed') && r.finished_at && r.finished_at < before);
      for (const r of old) await db.remove('piece_requests', { id: r.id });
    } catch (e) { if (e.status !== 404) log('old piece requests could not be cleared: ' + e.message); }
  }

  return {
    runOne, runAll, recover, clean, build,
    poke() { runAll().catch(() => {}); return { ok: true }; },
    start(ms) {
      recover().then(() => runAll());
      timer = setInterval(() => { runAll(); clean(); }, ms || EVERY_MS);
      return timer;
    },
    stop() { clearInterval(timer); }
  };
}

let current = null;
function startBuilder(cfg) {
  const db = require('./supabase.js').createClient(cfg);
  if (!db.ready()) return null;
  current = createBuilder({
    db,
    driveRoot: 'G:\\Shared drives',
    siteBase: cfg.siteBase,
    layPiece: x => require('./pdf/lay.js').layPiece(x),
    render: x => require('./pdf/render.js').renderPiece(x),
    driveLink: (abs, isFolder) => require('./drive-link.js').driveLink(abs, isFolder),
    treeOf: (abs, depth) => require('./scan.js').treeOf(abs, depth),
    log: m => console.log(new Date().toISOString() + ' ' + m)
  });
  current.start();
  return current;
}
function poke() {
  if (!current) throw fail(503, 'The helper has no account yet, so it can\'t make pieces.');
  return current.poke();
}

module.exports = { createBuilder, startBuilder, poke, EVERY_MS, KEEP_DAYS };
