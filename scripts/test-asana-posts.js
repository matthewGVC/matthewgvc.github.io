/* ============================================================
   Tests for helper/asana/posts.js and allow.keepPost — the 💬 Social Media
   project's posts, kept through the allowlist and counted per job.

   Plain Node:  node scripts/test-asana-posts.js
   ============================================================ */
'use strict';

const allow = require('../helper/asana/allow.js');
const P = require('../helper/asana/posts.js');

let pass = 0;
const failures = [];
function check(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; return; }
  failures.push(name + '\n      expected ' + w + '\n      got      ' + g);
}

/* ---------- keepPost: only what a count needs ---------- */
const raw = {
  gid: 'p1', name: '555 W59 PHC carousel', completed: true, completed_at: '2026-10-01T15:00:00Z', due_on: '2026-10-01',
  memberships: [{ project: { gid: 'social' }, section: { name: 'Posted/Scheduled' } }],
  custom_fields: [
    { name: '🏡2026 Properties', enum_value: { name: '555 W 59th PHC' } },
    { name: '🏡 2025 Properties', multi_enum_values: [{ name: 'Le Reve' }] },
    { name: 'Post Format', enum_value: { name: 'Carousel' } },
    { name: 'Production Stage', enum_value: { name: 'Completed' } },
    { name: 'Post Link', display_value: 'https://www.instagram.com/p/abc/' },
    { name: 'Likes & Reactions', number_value: 120 },
    { name: 'Hook', display_value: 'secret hook' },
    { name: 'Vendor', enum_value: { name: 'Five7 Media' } }
  ],
  notes: 'never kept'
};
const kept = allow.keepPost(raw, 'social');
check('keepPost: allowlisted keys only', Object.keys(kept), ['gid', 'name', 'completed', 'completedAt', 'dueOn', 'section', 'projectGid', 'tags', 'format', 'stage', 'link']);
check('keepPost: every year\'s property tag', kept.tags, ['555 W 59th PHC', 'Le Reve']);
check('keepPost: format, stage, link', [kept.format, kept.stage, kept.link], ['Carousel', 'Completed', 'https://www.instagram.com/p/abc/']);
check('keepPost: no figures, hooks, vendors or notes', JSON.stringify(kept).match(/120|secret|Five7|never kept/), null);
check('keepPost: a link that isn\'t https is dropped', allow.keepPost({ gid: 'x', custom_fields: [{ name: 'Post Link', display_value: 'javascript:alert(1)' }] }).link, null);
check('keepPost: no tag, no tags', allow.keepPost({ gid: 'y', custom_fields: [] }).tags, []);
check('POST_FIELDS asks for no notes', /notes|html/.test(allow.POST_FIELDS), false);

/* ---------- jobFor: the tag's street, and its unit when it names one ---------- */
const job = (id, address, unit, stage) => ({ id, label: address + (unit ? ', Residence ' + unit : ''), stage: stage === undefined ? 'Live' : stage, units: unit ? [unit] : [], core: { address, unit } });
const props = [
  job('phc', '555 W 59TH ST', 'PHC'), job('2e', '1050 Fifth', '2E'), job('13c', '1050 Park Ave', '13C'),
  job('6', '347 West Broadway', '6'), job('1819', '401 East 89th St', '18/19E'), job('wea', '565 West End Ave', '10E'),
  job('chapel', '40 Chapel Ln'), job('pheasant', '1006 Pheasant Ln'), job('10fl', '52 E4', '10FL'),
  job('a', '200 E 57', '17A'), job('b', '200 E 57', '9B'), job('nostage', '9 Old St', null, null)
];
const to = tag => { const j = P.jobFor(tag, props); return j ? j.id : null; };
check('jobFor: street and unit run together', to('555 W 59th PHC'), 'phc');
check('jobFor: lower-case unit', to('1050 Park Ave 13c'), '13c');
check('jobFor: "Fifth" spelt any way', to('1050 fifth 2E'), '2e');
check('jobFor: another unit in the same building never lands', to('1050 Fifth - 10C'), null);
check('jobFor: "6th Floor" is unit 6', to('347 W Broadway 6th Floor'), '6');
check('jobFor: "10th Floor" is unit 10FL', to('52 E 4th St 10th Floor'), '10fl');
check('jobFor: the line letter left off', to('401 e 89th 18/19'), '1819');
check('jobFor: no unit in the tag, one job on the street', to('565 West End Ave'), 'wea');
check('jobFor: a town after the comma', to('40 chapel lane, Wall'), 'chapel');
check('jobFor: "#204" on a house job with no unit', to('1006 Pheasant Ln #204, Wall NJ'), 'pheasant');
check('jobFor: two jobs on the street, the tag\'s unit picks', [to('200 E 57th St 17A'), to('200 E 57th St 9B')], ['a', 'b']);
check('jobFor: two jobs on the street and no unit: neither', to('200 E 57th St'), null);
check('jobFor: a development name names no job', to('Le Reve'), null);
check('jobFor: a job with no stage is never picked', to('9 Old St'), null);

/* ---------- applyPosts: cached as kind post, gone posts lose their job ---------- */
(async () => {
  const writes = [];
  const client = {
    select: async (table, match) => table === 'properties' ? props : [{ gid: 'old', project_gid: 'social' }, { gid: 'p1', project_gid: 'social' }],
    upsert: async (table, rows, key) => { writes.push({ table, rows, key }); }
  };
  const posts = [kept, allow.keepPost({ gid: 'p2', name: 'Le Reve reel', memberships: [{ project: { gid: 'social' }, section: { name: 'In Production' } }],
    custom_fields: [{ name: '🏡2026 Properties', enum_value: { name: 'Le Reve' } }] }, 'social')];
  const r = await P.applyPosts({ client, posts, now: new Date('2026-10-23T12:00:00Z') });
  check('applyPosts: counts', [r.linked, r.unlinked], [1, ['Le Reve']]);
  check('applyPosts: two upserts into asana_tasks on gid', writes.map(w => [w.table, w.key, w.rows.length]), [['asana_tasks', 'gid', 2], ['asana_tasks', 'gid', 1]]);
  check('applyPosts: the post row', writes[0].rows[0], { gid: 'p1', project_gid: 'social', kind: 'post', section: 'Posted/Scheduled', name: '555 W59 PHC carousel',
    fields: { tags: ['555 W 59th PHC', 'Le Reve'], format: 'Carousel', stage: 'Completed', link: 'https://www.instagram.com/p/abc/' },
    due_on: '2026-10-01', completed_at: '2026-10-01T15:00:00Z', last_seen: '2026-10-23T12:00:00.000Z', property_id: 'phc' });
  check('applyPosts: an unlinked post is cached with no job', writes[0].rows[1].property_id, null);
  check('applyPosts: a post gone from the project loses its job', writes[1].rows, [{ gid: 'old', project_gid: 'social', kind: 'post', property_id: null }]);

  let routines = null;
  await P.readPosts({ get: async (path, q) => { routines = q.opt_fields; return [
    { gid: 'r1', name: 'Daily Instagram Engagement', memberships: [{ section: { name: 'Tasks & Routines' } }] },
    { gid: 'r2', name: 'A post', memberships: [{ section: { name: 'Ready to Post' } }] }]; } }, 'social').then(rows => {
    check('readPosts: routines left out', rows.map(x => x.gid), ['r2']);
  });
  check('readPosts: asks with POST_FIELDS', routines, allow.POST_FIELDS);

  if (failures.length) {
    console.log(pass + ' passed, ' + failures.length + ' failed\n');
    failures.forEach(f => console.log('  FAIL ' + f));
    process.exit(1);
  }
  console.log(pass + ' passed');
})().catch(e => { console.log('  FAIL ' + (e.stack || e)); process.exit(1); });
