/* ============================================================
   Tests for assets/js/folder-health.js — what a job folder holds and what
   is wrong with it (spec S16). Made-up folders only; paperwork must never
   be named in the result.

   Plain Node:  node scripts/test-folder-health.js
   ============================================================ */
'use strict';

const H = require('../assets/js/folder-health.js');

let pass = 0;
const failures = [];
function check(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; return; }
  failures.push(name + '\n      expected ' + w + '\n      got      ' + g);
}

const f = (name, modified) => ({ name, kind: 'file', size: 10, modified });
const d = (name, children) => ({ name, kind: 'directory', children: children || [] });
const codes = (r) => r.notes.map((n) => n.code);
const NYC = { market: 'NYC', driveRoot: 'GVC - New York' };

/* a healthy old NYC folder: nothing wrong */
let tree = d('1 Example St 4A', [
  f('Details 1 Example St.docx', '2026-09-01T10:00:00Z'),
  d('Floorplan', [f('Floorplan - 1 Example St.pdf', '2026-09-02T10:00:00Z')]),
  d('Photos', [d('Edited', [f('a.jpg', '2026-09-03T10:00:00Z'), f('b.jpg', '2026-09-03T10:00:00Z')]), d('Raw', [f('r1.jpg'), f('r2.jpg'), f('r3.jpg')]), d('Staged', [f('s.jpg')]), d('Print', [f('p.jpg')]), d('Web', [f('w.jpg'), f('w2.jpg')])]),
  d('Marketing', [d('Showsheet', [f('Showsheet - 1 Example St.pdf', '2026-09-14T10:00:00Z')])])
]);
let r = H.health(tree, NYC);
check('healthy: no notes', r.notes, []);
check('photo counts', r.counts.photos, { edited: 2, staged: 1, print: 1, web: 2, raw: 3 });
check('details doc', r.detailsDoc && r.detailsDoc.name, 'Details 1 Example St.docx');
check('showsheet found under new name', r.pieces.showsheet.map((p) => p.path), ['Marketing/Showsheet/Showsheet - 1 Example St.pdf']);
check('floorplan found', r.pieces.floorplan.length, 1);
check('edited photos are the photos piece', r.pieces.photos.length, 2);
check('no pieces elsewhere', [r.pieces.brochure, r.pieces.video, r.pieces.signage].map((a) => a.length), [0, 0, 0]);

/* old NYC name: ShowSheet\ with two PDFs side by side */
tree = d('x', [
  f('details.docx'), d('Floorplan', [f('fp.pdf')]), d('Photos', [d('Edited', [f('a.jpg')])]),
  d('ShowSheet', [f('Showsheet A.pdf', '2026-09-02T10:00:00Z'), f('Showsheet B.pdf', '2026-09-14T10:00:00Z'), d('Archive', [f('Old.pdf', '2026-08-01T10:00:00Z')])])
]);
r = H.health(tree, NYC);
check('twoCurrent only', codes(r), ['twoCurrent']);
check('twoCurrent names the dates', /2 Sep and 14 Sep/.test(r.notes[0].text) && /ShowSheet\\/.test(r.notes[0].text), true);
check('archived marked', r.pieces.showsheet.map((p) => [p.name, p.archived]).sort(), [['Old.pdf', true], ['Showsheet A.pdf', false], ['Showsheet B.pdf', false]]);

/* one current plus an archived one is fine */
tree = d('x', [f('details.docx'), d('Floorplan', [f('fp.pdf')]), d('Photos', [d('Edited', [f('a.jpg')])]),
  d('Marketing', [d('Showsheet', [f('now.pdf'), d('Archive', [f('then.pdf')])])])]);
check('one current + archive: healthy', codes(H.health(tree, NYC)), []);

/* a piece file loose at the top */
tree = d('x', [f('details.docx'), f('Showsheet - 1 Example St.pdf', '2026-09-14T10:00:00Z'), d('Floorplan', [f('fp.pdf')]), d('Photos', [d('Edited', [f('a.jpg')])])]);
r = H.health(tree, NYC);
check('pieceAtTop', codes(r), ['pieceAtTop']);
check('pieceAtTop is not loose', r.counts.looseTop, 0);
check('pieceAtTop file still found', r.pieces.showsheet.map((p) => p.path), ['Showsheet - 1 Example St.pdf']);

/* two folders for one thing */
tree = d('x', [f('details.docx'), d('Floorplan', [f('a.pdf')]), d('Floor Plans', [f('b.pdf')]), d('Photos', [d('Edited', [f('a.jpg')])])]);
r = H.health(tree, NYC);
check('twoFolders', codes(r), ['twoFolders']);
check('twoFolders text', r.notes[0].text, 'Floorplan\\ and Floor Plans\\ both hold floorplans. The standard has one folder for it.');

/* NJ job on the New York drive */
tree = d('x', [f('details.docx'), d('Floorplan', [f('a.pdf')]), d('Photos', [d('Edited', [f('a.jpg')])])]);
r = H.health(tree, { market: 'NJ', driveRoot: 'GVC - New York' });
check('otherDrive', codes(r), ['otherDrive']);
check('otherDrive text', r.notes[0].text.indexOf('GVC - New York') !== -1 && r.notes[0].text.indexOf('GVC - New Jersey') !== -1, true);
check('right drive: none', codes(H.health(tree, { market: 'NJ', driveRoot: 'GVC - New Jersey' })), []);

/* missing things */
r = H.health(d('x', []), NYC);
check('empty folder', codes(r), ['noDetails', 'noFloorplan', 'noEdited']);
tree = d('x', [f('details.docx'), d('Floorplan', [f('a.pdf')]), d('Photos', [d('Edited', [f('a.jpg')])])]);
check('old folder: no versions note', codes(H.health(tree, NYC)), []);
check('new folder, floorplan with no v1', codes(H.health(tree, Object.assign({ isNew: true }, NYC))), ['noVersions']);
tree = d('x', [f('details.docx'), d('Floorplan', [d('v1', [f('a.pdf')])]), d('Photos', [d('Edited', [f('a.jpg')])])]);
check('new folder with v1', codes(H.health(tree, Object.assign({ isNew: true }, NYC))), []);
tree = d('x', [f('Offer details.docx'), f('notes.txt')]);
check('paper-worded details doc is not a details doc', H.health(tree, NYC).detailsDoc, null);
check('newest details doc wins',
  H.health(d('x', [f('details old.docx', '2026-01-01T00:00:00Z'), f('details new.docx', '2026-05-01T00:00:00Z')]), NYC).detailsDoc.name, 'details new.docx');

/* paperwork never named */
tree = d('x', [f('details.docx'), f('Exclusive - Jane Client.pdf'), f('Offer - John Buyer.pdf'), { name: 'Offers', kind: 'directory', skipped: true }, { name: 'Docs', kind: 'directory', skipped: true },
  d('Floorplan', [f('a.pdf')]), d('Photos', [d('Edited', [f('a.jpg')])])]);
tree.looseCount = 1;
r = H.health(tree, NYC);
check('loose count (nodes + builder count)', r.counts.looseTop, 3);
const dump = JSON.stringify(r);
check('no Jane Client', /Jane Client|John Buyer|Offers|Docs|Exclusive/.test(dump), false);
check('paperwork leaves no notes', codes(r), []);
tree = d('x', [f('Exclusive - Jane Client.pdf'), f('Showsheet Exclusive.pdf')]);
check('paperwork-named top file is never a piece', [H.health(tree, NYC).pieces.showsheet.length, H.health(tree, NYC).counts.looseTop], [0, 2]);
check('exclusive-first file is just loose', H.health(d('x', [f('Exclusive - Showsheet.pdf')]), NYC).counts.looseTop, 1);
check('unknown top folder ignored', H.health(d('x', [d('Random Stuff', [f('a.pdf')])]), NYC).counts.looseTop, 0);

/* a paperwork word mid-name keeps a loose file unnamed */
tree = d('x', [f('Signed Contract Floorplan.pdf'), f('Showsheet - Offer from Buyer.pdf'), f('Floorplan v2.pdf')]);
r = H.health(tree, NYC);
check('mid-name paperwork: counted loose', r.counts.looseTop, 2);
check('mid-name paperwork: never named', /Contract|Offer|Signed/.test(JSON.stringify(r)), false);
check('plain floorplan file still found at top', r.pieces.floorplan.map((p) => p.name), ['Floorplan v2.pdf']);

/* broken link */
check('null tree is broken', codes(H.health(null, NYC)), ['broken']);
check('broken flag', codes(H.health({ broken: true }, NYC)), ['broken']);

/* pieces found under old and new names */
tree = d('x', [
  d('Floor Plans', [f('old.pdf')]), d('Photos', [d('Matt Edits', [f('m.jpg')])]),
  d('Marketing', [d('Brochure', [f('b.pdf')]), d('Postcard', [f('pc.pdf')]), d('Signage', [f('sg.pdf')]), d('Video', [f('v.mp4')]), d('Show Sheet', [f('s.pdf')])])
]);
r = H.health(tree, NYC);
check('old and new names', Object.keys(r.pieces).map((k) => r.pieces[k].length), [1, 1, 1, 1, 1, 1, 1]);

console.log((failures.length ? failures.join('\n') + '\n' : '') + pass + ' passed, ' + failures.length + ' failed');
process.exit(failures.length ? 1 : 0);
