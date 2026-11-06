/* ============================================================
   WEEKLY REPORT — the Sunday email (overhaul step 3, docs/overhaul-plan.md).

     node helper/weekly-report.js --preview [--market NJ] [--date 2026-11-08]
       reads the jobs and writes exports/weekly-report-<date>[-<market>].html.
     node helper/weekly-report.js --send
       sends this week's email now, from Matt's Google account (helper/mail/).

   The helper sends it itself on Sundays at 18:00 (schedule.js) once its
   Gmail sign-in is saved (helper/mail/sign-in.js). It goes to weeklyTo in the
   helper's config, Matt alone until he adds the team (11-03).

     sendWeekly({ cfg, client, mail, today? }) → { to, subject, id }
     lastSent(cfg) → when the last one went (weekly-sent.json in the helper's home)

     build({ properties, pitches, devProjects, changes, documents }, { today, market })
       → { subject, html, counts }   pure: no fetch, no file, no clock

   One email: a navy head with the four figures (live, in contract, closed
   this week, errors open), then, each section only when it has something:
     For Monday (the agenda, by rules), Deal dates (the next two weeks),
     New developments, What changed this week, Marketing.
   A deal date is in one place only, Deal dates: the agenda doesn't repeat it.
   Bosses get every market; an ops manager's edition is one market. Our own
   purchases (side 'buy') stay out, and a Lead (a deal at Pitch) is not a listing. No budget
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

/* the email's colours: the five GVC colours plus the site's soft ink, rule and danger (tokens.css); an email can't
   read tokens, so they are written out here once */
const C = { navy: '#00273A', sky: '#53C7DC', cyan: '#00A1C4', bone: '#E5E5E5', paper: '#EFEDE8', white: '#FFFFFF',
  soft: '#33525F', rule: '#D3D4D0', danger: '#8C3A2B' };
const SERIF = "Georgia,'Times New Roman',serif", SANS = 'Arial,Helvetica,sans-serif';

function build(rows, opts) {
  const today = opts.today, market = opts.market || '', weekAgo = addDays(today, -7), soon = addDays(today, 14);
  const all = W.buildJobs({ properties: rows.properties || [], pitches: rows.pitches || [], devProjects: rows.devProjects || [],
    changes: rows.changes || [], documents: rows.documents || [] }, today);
  // our own purchases (side 'buy') are never a listing of ours
  const jobs = all.filter(j => !j.archived && j.stage !== 'Archived' && j.side !== 'buy' && (!market || j.market === market));
  const listings = jobs.filter(j => j.type === 'listing' || j.type === 'rental');
  const devs = jobs.filter(j => j.type === 'development');
  const devRow = {}; (rows.devProjects || []).forEach(d => { devRow[d.id] = d; });

  /* deal dates in the next 14 days (a date is planned until its day passes) */
  const upcoming = [];
  listings.forEach(j => (j.dates || []).forEach(d => {
    if (d.planned && DEAL_KEYS.includes(d.key) && d.on <= soon) upcoming.push({ job: j, label: d.label, on: d.on });
  }));
  upcoming.sort((a, b) => a.on < b.on ? -1 : a.on > b.on ? 1 : 0);

  /* closed in the last week */
  const closed = listings.filter(j => (j.stage === 'Sold' || j.stage === 'Rented') &&
    (j.dates || []).some(d => d.key === 'closedOn' && !d.planned && d.on >= weekAgo));

  /* developments: late work (oldest target first) and what is due; the ones with no schedule go on one line */
  const devLines = devs.map(j => {
    const sched = (devRow[j.id] || {}).schedule, items = sched ? B.workItems(sched) : [];
    const late = items.filter(t => B.statusOf(t, today) === 'late').sort((a, b) => a.dueOn < b.dueOn ? -1 : 1);
    return { job: j, done: items.filter(t => t.completed).length, total: items.length, late, due: items.filter(t => B.statusOf(t, today) === 'soon') };
  });
  const scheduled = devLines.filter(d => d.total).sort((a, b) => b.late.length - a.late.length || (a.job.name < b.job.name ? -1 : 1));
  const unscheduled = devLines.filter(d => !d.total);

  /* errors: one count for every job in this edition, and how many are over a week old */
  const errors = jobs.reduce((n, j) => n + (j.match || []).length, 0);
  const oldErrors = jobs.reduce((n, j) => n + (j.match || []).filter(m => m.since && m.since <= weekAgo).length, 0);

  /* the agenda, by rules: what needs a decision on Monday. Deal dates are their own section, not repeated here */
  const agenda = [];
  AGENDA_CHECKS.forEach(code => {
    const hit = listings.filter(j => (j.match || []).some(m => m.code === code));
    if (hit.length) agenda.push({ title: WORDS.check(code), jobs: hit.map(j => ({ job: j })) });
  });
  const lateDevs = scheduled.filter(d => d.late.length);
  if (lateDevs.length) agenda.push({ title: 'Development work past target', jobs: lateDevs.map(d => ({ job: d.job, note: String(d.late.length) })) });
  if (oldErrors) agenda.push({ title: 'Errors open over a week', text: oldErrors + ' of the ' + errors + ' on the Errors page' });

  /* what changed this week, by job */
  // what a boss reads: notes, stage and price moves, deal dates, joining a development; pieces made go under Marketing.
  // A development move shows its title alone: its note is the team's housekeeping, not news
  const KEEP = c => !c.field || ['stage', 'price', 'originalPrice', 'dev_project_id', 'milestones'].includes(c.field) || DEAL_KEYS.concat(['listedOn', 'exclusiveOn', 'exclusiveExpiresOn']).includes(c.field);
  const week7 = (rows.changes || []).filter(c => c.at >= weekAgo);
  const changes = W.recentChanges(week7.filter(KEEP).map(c => c.field === 'dev_project_id' ? Object.assign({}, c, { note: null }) : c), jobs, 200);
  const made = {};
  W.recentChanges(week7.filter(c => /^piece:/.test(c.field || '')), jobs, 200).forEach(c => { made[c.job] = made[c.job] || { href: c.href }; });
  const byJob = {};
  changes.forEach(c => {
    const g = byJob[c.job] = byJob[c.job] || { href: c.href, lines: [] }, line = plain(c.title + (c.note ? ': ' + c.note : ''));
    if (!g.lines.includes(line)) g.lines.push(line);
  });

  const stale = listings.filter(j => (j.stalePieces || []).length);
  const s = W.overviewStats(listings);
  const counts = { live: s.live, contract: s.contract, closed: closed.length, upcoming: upcoming.length, agenda: agenda.length, errors };

  /* the email: tables and inline styles only, so Gmail and Outlook lay it out the same */
  const link = j => j ? '<a href="' + esc(SITE + j.href) + '" style="color:' + C.navy + ';font-weight:bold;text-decoration:none;border-bottom:1px solid ' + C.sky + '">' + esc(j.name) + '</a>' : '';
  const muted = t => '<span style="color:' + C.soft + '">' + t + '</span>';
  const sec = (title, body, note) => body ? '<tr><td style="padding:32px 40px 0">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>' +
    '<td style="font:normal 22px/1.2 ' + SERIF + ';color:' + C.navy + ';padding-bottom:8px;border-bottom:2px solid ' + C.navy + '">' + esc(title) + '</td>' +
    '<td align="right" style="font:11px/1.2 ' + SANS + ';letter-spacing:.08em;text-transform:uppercase;color:' + C.soft + ';padding-bottom:10px;border-bottom:2px solid ' + C.navy + '">' + (note ? esc(note) : '') + '</td>' +
    '</tr></table>' + body + '</td></tr>' : '';
  // a list of rows: a narrow left cell (a date, a count) and the line itself, with hairlines between
  const rowsOf = items => items.length ? '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">' + items.map((i, n) =>
    '<tr><td valign="top" width="' + (i.lead == null ? 0 : 84) + '" style="padding:10px 0;' + (n ? 'border-top:1px solid ' + C.rule + ';' : '') +
    'font:bold 12px/1.5 ' + SANS + ';letter-spacing:.04em;text-transform:uppercase;color:' + C.soft + '">' + (i.lead == null ? '' : i.lead) + '</td>' +
    '<td valign="top" style="padding:10px 0;' + (n ? 'border-top:1px solid ' + C.rule + ';' : '') + 'font:15px/1.5 ' + SANS + ';color:' + C.navy + '">' + i.body + '</td></tr>').join('') + '</table>' : '';
  const bar = (done, total) => {
    const w = Math.max(1, Math.round(done / total * 100));
    return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 2px"><tr>' +
      '<td width="' + w + '%" height="6" style="background:' + C.cyan + ';font-size:0;line-height:0">&nbsp;</td>' +
      (w < 100 ? '<td height="6" style="background:' + C.bone + ';font-size:0;line-height:0">&nbsp;</td>' : '') + '</tr></table>';
  };
  const where = market ? MK.name(market) : 'Every market';
  const figure = (n, label, warn) => '<td width="25%" valign="top" style="padding:16px 0 0">' +
    '<div style="font:normal 34px/1 ' + SERIF + ';color:' + (warn ? C.sky : C.paper) + '">' + n + '</div>' +
    '<div style="font:11px/1.4 ' + SANS + ';letter-spacing:.08em;text-transform:uppercase;color:' + C.sky + ';padding-top:6px">' + label + '</div></td>';

  // the inbox preview line: the week in a phrase, so the email is worth opening before it is opened
  const preview = [upcoming.length ? upcoming.length + ' deal date' + (upcoming.length === 1 ? '' : 's') + ' in the next two weeks' : 'No deal dates in the next two weeks',
    agenda.length ? agenda.length + ' topic' + (agenda.length === 1 ? '' : 's') + ' for Monday' : null, closed.length ? closed.length + ' closed' : null].filter(Boolean).join(' · ');

  const agendaBody = rowsOf(agenda.map(a => ({ body: '<b>' + esc(a.title) + '</b><br>' + (a.text ? muted(esc(a.text)) :
    a.jobs.map(x => link(x.job) + (x.note ? ' ' + muted('(' + esc(x.note) + ')') : '')).join(', ')) })));
  const dealsBody = rowsOf(upcoming.map(u => ({ lead: esc(W.fmtDay(u.on)), body: link(u.job) + ' ' + muted('· ' + esc(u.label)) })));
  const devBody = scheduled.length || unscheduled.length ? rowsOf(scheduled.map(d => ({ body: link(d.job) +
    '<span style="float:right;font:13px ' + SANS + ';color:' + C.soft + '">' + d.done + ' of ' + d.total + ' done</span>' + bar(d.done, d.total) +
    '<span style="font-size:13px;color:' + C.soft + '">' + [d.late.length ? '<b style="color:' + C.danger + '">' + d.late.length + ' past target</b>, oldest ' +
      esc(d.late.slice(0, 2).map(t => t.name.trim() + ' (' + W.fmtDay(t.dueOn) + ')').join(', ')) : null,
    d.due.length ? d.due.length + ' due in the next two weeks' : null, !d.late.length && !d.due.length ? 'nothing due in the next two weeks' : null].filter(Boolean).join(' · ') + '</span>' }))
      .concat(unscheduled.length ? [{ body: '<b>No schedule linked yet</b><br>' + unscheduled.map(d => link(d.job)).join(', ') }] : [])) : '';
  // jobs with the very same change (four houses joining developments) share one row
  const sameText = {};
  Object.keys(byJob).sort().forEach(n => {
    const t = byJob[n].lines.slice(0, 4).join('; ') + (byJob[n].lines.length > 4 ? '; and ' + (byJob[n].lines.length - 4) + ' more' : '');
    (sameText[t] = sameText[t] || []).push(n);
  });
  const jobLink = n => '<a href="' + esc(SITE + byJob[n].href) + '" style="color:' + C.navy + ';font-weight:bold;text-decoration:none;border-bottom:1px solid ' + C.sky + '">' + esc(n) + '</a>';
  const changedBody = rowsOf(Object.keys(sameText).sort((x, y) => sameText[x][0] < sameText[y][0] ? -1 : 1).map(t => ({ body: sameText[t].map(jobLink).join(', ') + '<br>' + muted(esc(t)) })));
  const marketingBody = rowsOf((Object.keys(made).length ? [{ body: '<b>Made this week</b><br>' + Object.keys(made).sort().map(n => link({ href: made[n].href, name: n })).join(', ') }] : [])
    .concat(stale.length ? [{ body: '<b>Out of date</b><br>' + stale.map(j => link(j) + ' ' + muted('(' + esc(j.stalePieces.join(', ')) + ')')).join(', ') }] : []));

  const html = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta name="color-scheme" content="light only"><title>' + esc('Week to ' + W.fmtDay(today)) + '</title></head>' +
    '<body style="margin:0;padding:0;background:' + C.bone + '">' +
    '<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:' + C.bone + '">' + esc(preview) + '</div>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:' + C.bone + '"><tr><td align="center" style="padding:24px 12px">' +
    '<table role="presentation" width="640" cellpadding="0" cellspacing="0" style="width:100%;max-width:640px;background:' + C.paper + '">' +
    /* the navy head: the team, the week, the four figures */
    '<tr><td style="background:' + C.navy + ';padding:28px 40px 28px">' +
    '<div style="font:bold 12px/1 ' + SANS + ';letter-spacing:.24em;text-transform:uppercase;color:' + C.paper + '">The GVC Team</div>' +
    '<div style="height:1px;background:' + C.cyan + ';margin:14px 0 18px;font-size:0;line-height:0">&nbsp;</div>' +
    '<div style="font:12px/1 ' + SANS + ';letter-spacing:.08em;text-transform:uppercase;color:' + C.cyan + '">' + esc(where) + '</div>' +
    '<h1 style="margin:8px 0 0;font:normal 34px/1.15 ' + SERIF + ';color:' + C.paper + '">The week to ' + esc(W.fmtDay(today)) + '</h1>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px"><tr>' +
    figure(s.live, 'Live') + figure(s.contract, 'In contract') + figure(closed.length, 'Closed this week') + figure(errors, 'Errors open', errors > 0) +
    '</tr></table></td></tr>' +
    sec('For Monday', agendaBody, agenda.length ? agenda.length + ' topic' + (agenda.length === 1 ? '' : 's') : '') +
    sec('Deal dates', dealsBody, 'next two weeks') +
    sec('New developments', devBody, devs.length + ' in work') +
    sec('What changed this week', changedBody) +
    sec('Marketing', marketingBody) +
    (agendaBody || dealsBody || devBody || changedBody || marketingBody ? '' : '<tr><td style="padding:32px 40px 0;font:15px/1.5 ' + SANS + ';color:' + C.soft + '">A quiet week: nothing to report.</td></tr>') +
    '<tr><td style="padding:36px 40px 32px"><table role="presentation" cellpadding="0" cellspacing="0"><tr>' +
    '<td style="background:' + C.navy + ';padding:12px 22px"><a href="' + SITE + '" style="font:bold 13px/1 ' + SANS + ';letter-spacing:.06em;text-transform:uppercase;color:' + C.paper + ';text-decoration:none">Open the workspace</a></td>' +
    '</tr></table>' +
    '<p style="margin:18px 0 0;font:12px/1.5 ' + SANS + ';color:' + C.soft + '">Sent every Sunday evening. Questions or something wrong? Reply to this email and it reaches Matt.</p>' +
    '</td></tr></table></td></tr></table></body></html>';
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
