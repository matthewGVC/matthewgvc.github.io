/* ============================================================
   WEEKLY REPORT — the Sunday email (overhaul step 3, docs/overhaul-plan.md).

     node helper/weekly-report.js --preview [--market NJ] [--date 2026-11-08]
       reads the jobs and writes exports/weekly-report-<date>[-<market>].html.
     node helper/weekly-report.js --send
       sends this week's email now, from helper@gvcrealestateteam.com.

   The helper sends it itself on Sundays at 18:00 (schedule.js) once its
   Gmail sign-in is saved (helper/mail/sign-in.js). It goes to weeklyTo in the
   helper's config, Matt alone until he adds the team (11-03).

     sendWeekly({ cfg, client, mail, today? }) → { to, subject, id }
     lastSent(cfg) → when the last one went (weekly-sent.json in the helper's home)

     build({ properties, pitches, devProjects, changes, documents }, { today, market })
       → { subject, html, counts }   pure: no fetch, no file, no clock

   One email, in this order, each section only when it has something:
     For Monday (the agenda, by rules), The numbers, Closing soon,
     New developments, What changed this week, Marketing.
   Bosses get every market; an ops manager's edition is one market. No budget
   figures, and no client names (D2): job names are addresses, and notes are
   the team's own change-log lines.
   ============================================================ */
'use strict';

const W = require('../assets/js/workspace-data.js');
const B = require('../assets/js/dev-build.js');
const WORDS = require('../assets/js/words.js');
const MK = require('../assets/js/markets.js');

const SITE = 'https://matthewgvc.github.io/workspace/';
const DEAL_KEYS = ['acceptedOfferOn', 'contractOn', 'boardPackageOn', 'boardInterviewOn', 'boardApprovedOn', 'ccOn', 'closedOn'];
// the Errors checks that are a talking point, not a typo: a deal or an exclusive needing a decision
const AGENDA_CHECKS = ['M21', 'M9', 'M27', 'M15', 'M28'];

function addDays(d, n) { const t = new Date(d + 'T12:00:00'); t.setDate(t.getDate() + n); return t.toISOString().slice(0, 10); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
function plain(s) { return WORDS.plain(s); }

function build(rows, opts) {
  const today = opts.today, market = opts.market || '', weekAgo = addDays(today, -7), soon = addDays(today, 14), week = addDays(today, 7);
  const all = W.buildJobs({ properties: rows.properties || [], pitches: rows.pitches || [], devProjects: rows.devProjects || [],
    changes: rows.changes || [], documents: rows.documents || [] }, today);
  const jobs = all.filter(j => !j.archived && j.stage !== 'Archived' && (!market || j.market === market));
  const listings = jobs.filter(j => j.type === 'listing' || j.type === 'rental');
  const devs = jobs.filter(j => j.type === 'development');
  const devRow = {}; (rows.devProjects || []).forEach(d => { devRow[d.id] = d; });

  /* deals with a date coming up */
  const upcoming = [];
  listings.forEach(j => (j.dates || []).forEach(d => {
    if (d.planned && DEAL_KEYS.includes(d.key) && d.on <= soon) upcoming.push({ job: j, label: d.label, on: d.on });
  }));
  upcoming.sort((a, b) => a.on < b.on ? -1 : 1);

  /* closed in the last week */
  const closed = listings.filter(j => (j.stage === 'Sold' || j.stage === 'Rented') &&
    (j.dates || []).some(d => d.key === 'closedOn' && !d.planned && d.on >= weekAgo));

  /* developments: late work and what is due */
  const devLines = devs.map(j => {
    const sched = (devRow[j.id] || {}).schedule, items = sched ? B.workItems(sched) : [];
    const late = items.filter(t => B.statusOf(t, today) === 'late'), due = items.filter(t => B.statusOf(t, today) === 'soon');
    return { job: j, done: items.filter(t => t.completed).length, total: items.length, late, due };
  });

  /* the agenda, by rules: late development work, deals this week, deals and exclusives needing a decision, old errors */
  // one line per topic, the jobs named in it, so the list reads as an agenda rather than a log
  const agenda = [];
  devLines.filter(d => d.late.length).forEach(d => agenda.push({ head: d.job, text: d.late.length + ' work item' + (d.late.length === 1 ? '' : 's') + ' past target, the oldest ' + d.late.map(t => t.name).slice(0, 2).join(', ') }));
  const thisWeek = upcoming.filter(u => u.on <= week);
  if (thisWeek.length) agenda.push({ title: 'This week', jobs: thisWeek.map(u => ({ job: u.job, note: u.label.toLowerCase() + ' ' + W.fmtDay(u.on) })) });
  AGENDA_CHECKS.forEach(code => {
    const hit = listings.filter(j => (j.match || []).some(m => m.code === code));
    if (hit.length) agenda.push({ title: WORDS.check(code), jobs: hit.map(j => ({ job: j })) });
  });
  const oldErrors = jobs.reduce((n, j) => n + (j.match || []).filter(m => m.since && m.since <= weekAgo).length, 0);
  if (oldErrors) agenda.push({ text: oldErrors + ' error' + (oldErrors === 1 ? '' : 's') + ' open for more than a week on the Errors page' });

  /* what changed this week, by job */
  // what a boss reads: notes, stage and price moves, deal dates, joining a development; pieces made go under Marketing
  const KEEP = c => !c.field || ['stage', 'price', 'originalPrice', 'dev_project_id', 'milestones'].includes(c.field) || DEAL_KEYS.concat(['listedOn', 'exclusiveOn', 'exclusiveExpiresOn']).includes(c.field);
  const week7 = (rows.changes || []).filter(c => c.at >= weekAgo);
  const changes = W.recentChanges(week7.filter(KEEP), jobs, 200);
  const made = {};
  W.recentChanges(week7.filter(c => /^piece:/.test(c.field || '')), jobs, 200).forEach(c => { made[c.job] = made[c.job] || { href: c.href }; });
  const byJob = {};
  changes.forEach(c => { (byJob[c.job] = byJob[c.job] || { href: c.href, lines: [] }).lines.push(c.title + (c.note ? ': ' + c.note : '')); });

  const stale = listings.filter(j => (j.stalePieces || []).length);
  const s = W.overviewStats(listings);
  const counts = { live: s.live, contract: s.contract, closed: closed.length, upcoming: upcoming.length, agenda: agenda.length, errors: s.mismatches };

  /* the email: inline styles, a plain table, the team's colours */
  const link = j => j ? '<a href="' + esc(SITE + j.href) + '" style="color:#00273a;font-weight:600">' + esc(j.name) + '</a>' : '';
  const sec = (title, body) => body ? '<h2 style="font:400 20px Georgia,serif;color:#00273a;margin:28px 0 8px;border-bottom:1px solid #c9c4b8;padding-bottom:6px">' + esc(title) + '</h2>' + body : '';
  const ul = items => items.length ? '<ul style="margin:0;padding-left:18px">' + items.map(i => '<li style="margin:4px 0">' + i + '</li>').join('') + '</ul>' : '';
  const where = market ? MK.name(market) : 'every market';
  const html = '<!doctype html><html><body style="margin:0;background:#f4f1ea"><div style="max-width:640px;margin:0 auto;padding:24px;font:15px/1.5 Arial,sans-serif;color:#00273a">' +
    '<p style="font:12px Arial;letter-spacing:.12em;text-transform:uppercase;color:#4a5a63;margin:0">The GVC Team · week to ' + esc(W.fmtDay(today)) + '</p>' +
    '<h1 style="font:400 28px Georgia,serif;margin:6px 0 4px">Your week, ' + esc(where) + '</h1>' +
    sec('For Monday', ul(agenda.map(a => a.title ? '<b>' + esc(a.title) + '</b>: ' + a.jobs.map(x => link(x.job) + (x.note ? ' (' + esc(x.note) + ')' : '')).join(', ')
      : (a.head ? link(a.head) + ': ' : '') + esc(a.text)))) +
    sec('The numbers', '<p style="margin:0">' + [s.live + ' live', s.contract + ' in contract', closed.length + ' closed this week', s.mismatches + ' errors open'].join(' · ') + '</p>') +
    sec('Closing soon', ul(upcoming.map(u => esc(W.fmtDay(u.on)) + ': ' + link(u.job) + ', ' + esc(u.label.toLowerCase())))) +
    sec('New developments', ul(devLines.map(d => link(d.job) + ': ' + (d.total ? d.done + ' of ' + d.total + ' work items done' : 'no schedule linked') +
      (d.late.length ? ', <b style="color:#9b2c2c">' + d.late.length + ' past target</b>' : '') + (d.due.length ? ', ' + d.due.length + ' due in 14 days' : '')))) +
    sec('What changed this week', ul(Object.keys(byJob).sort().map(n => '<a href="' + esc(SITE + byJob[n].href) + '" style="color:#00273a;font-weight:600">' + esc(n) + '</a>: ' +
      esc(plain(byJob[n].lines.slice(0, 4).join('; ')) + (byJob[n].lines.length > 4 ? '; and ' + (byJob[n].lines.length - 4) + ' more' : ''))))) +
    sec('Marketing', ul((Object.keys(made).length ? ['<b>Made this week</b>: ' + Object.keys(made).sort().map(n => '<a href="' + esc(SITE + made[n].href) + '" style="color:#00273a;font-weight:600">' + esc(n) + '</a>').join(', ')] : [])
      .concat(stale.map(j => link(j) + ': out of date, ' + esc(j.stalePieces.join(', ')))))) +
    '<p style="margin:32px 0 0;font-size:12px;color:#4a5a63"><a href="' + SITE + '" style="color:#4a5a63">Open the workspace</a> · Questions: reply to Matt</p>' +
    '</div></body></html>';
  return { subject: 'GVC week to ' + W.fmtDay(today) + (market ? ' · ' + MK.name(market) : ''), html, counts };
}

const MATT = 'matthew@gvcrealestateteam.com';
const sentFile = cfg => require('path').join(cfg.home || '', 'weekly-sent.json');
function lastSent(cfg) { try { return new Date(JSON.parse(require('fs').readFileSync(sentFile(cfg), 'utf8')).at); } catch (e) { return null; } }

async function readRows(db) {
  const [properties, pitches, devProjects, changes, documents] = await Promise.all([
    db.select('properties'), db.select('pitches'), db.select('dev_projects'),
    db.select('changes', null, '*', { order: 'at.desc', limit: 2000 }), db.select('documents').catch(() => [])
  ]);
  return { properties: properties.filter(p => p.stage), pitches, devProjects, changes, documents };
}

// every market in one email for now; an ops manager's one-market edition waits on their logins (overhaul step 4b)
async function sendWeekly(o) {
  const to = [].concat(o.cfg.weeklyTo || MATT);
  const r = build(await readRows(o.client), { today: o.today || W.today() });
  const id = await o.mail.send({ to, subject: r.subject, html: r.html });
  require('fs').writeFileSync(sentFile(o.cfg), JSON.stringify({ at: new Date().toISOString(), to, subject: r.subject }));
  return { to, subject: r.subject, id };
}

async function main(argv) {
  const fs = require('fs'), path = require('path');
  const cfg = require('./config.js').loadConfig();
  const db = require('./supabase.js').createClient(cfg);
  if (!db.ready()) { console.log('No helper account yet.'); return; }
  if (argv.includes('--send')) {
    const mail = require('./mail/gmail.js').createMail(cfg);
    if (!mail.ready()) { console.log('No Gmail sign-in yet: run node helper/mail/sign-in.js'); return; }
    const s = await sendWeekly({ cfg, client: db, mail });
    console.log('Sent "' + s.subject + '" to ' + s.to.join(', '));
    return;
  }
  if (!argv.includes('--preview')) { console.log('Use --preview (writes a file) or --send (emails it now).'); return; }
  const arg = k => { const i = argv.indexOf(k); return i !== -1 ? argv[i + 1] : null; };
  const market = arg('--market'), today = arg('--date') || W.today();
  if (market && !MK.get(market)) { console.log('Unknown market ' + market + ': use ' + MK.CODES.join(', ')); return; }
  const r = build(await readRows(db), { today, market });
  const out = path.join(__dirname, '..', 'exports', 'weekly-report-' + today + (market ? '-' + market : '') + '.html');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, r.html);
  console.log(r.subject + '\n' + JSON.stringify(r.counts) + '\nWritten: ' + out);
}

if (require.main === module) main(process.argv.slice(2)).catch(e => { console.error(e.message); process.exit(1); });
module.exports = { build, sendWeekly, lastSent };
