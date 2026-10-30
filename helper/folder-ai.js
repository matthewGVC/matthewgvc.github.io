/* ============================================================
   FOLDER AI — the nightly scan's last try at a job's folder (M18).

   For a job the address matching (folder-link.js suggest) can't place, it
   asks Claude Haiku which Drive folder is most likely the job's, or none,
   with a one-line reason. Folders named for the client ("6A - Brickman"), a
   different town or a nickname are what it is for.

     folderNames(D, row, opts) → ['GVC - New Jersey/New Development/Westwood/House 2', …]
       folder NAMES only, from the job's market places and its New
       Development, up to three levels down. Paperwork folders
       (drive-rules.js) are neither listed nor opened, and South Street
       Development Docs (SSDG) is never read. Folders already linked to
       another job (opts.taken) are left out. No file is ever opened.
     await guess({ ask, row, paths }) → { path, why } | null
       ask(prompt, schema) → the model's JSON; the answer must be one of the
       paths given, else it is no answer.
     makeAsk(cfg) → ask, or null when the config has no anthropicKey (then
       the AI pass is off). The key lives in %USERPROFILE%\.gvc-helper\config.json,
       never in the repo.

   A guess is a suggestion only: scan.js stores it as scan.candidate with
   candidateBy 'ai' and candidateWhy, the Errors page says it is an AI guess,
   and nothing is ever linked by it. Nothing on Drive is written.
   ============================================================ */
'use strict';

const RULES = require('../assets/js/drive-rules.js');

const MODEL = 'claude-haiku-5-5';
const MAX_PATHS = 3000;
const SSDG = /south street development docs/i;

/* where each market's jobs are filed, and how deep to look under each */
const PLACES = {
  NYC: [['GVC - New York/Building Information', 2], ['GVC - New York/New Development', 3]],
  NJ: [['GVC - New Jersey/1. Residential Sales/1. Resale', 2], ['GVC - New Jersey/Rentals', 2], ['GVC - New Jersey/New Development', 3]],
  FL: [['GVC - Florida/Resale', 2], ['GVC - Florida/New Development', 3]]
};

async function folderNames(D, row, opts) {
  const taken = new Set((opts && opts.taken) || []);
  const out = [];
  const dirs = p => D.list(p).then(xs => xs.filter(x => x.kind === 'directory').map(x => x.name), () => []);
  async function walk(p, left) {
    for (const n of await dirs(p)) {
      if (out.length >= MAX_PATHS) return;
      if (n.startsWith('.') || SSDG.test(n) || RULES.isPaperworkFolder(n) || RULES.hasPaperworkWord(n)) continue;
      const q = p + '/' + n;
      if (!taken.has(q)) out.push(q);
      if (left > 1) await walk(q, left - 1);
    }
  }
  for (const [root, depth] of PLACES[row.market] || []) {
    if (SSDG.test(root)) continue;
    await walk(root, depth);
  }
  return out;
}

const SCHEMA = {
  type: 'object',
  properties: {
    folder: { type: 'string', description: 'One path exactly as listed, or an empty string for none.' },
    reason: { type: 'string', description: 'One short line: why this folder, or why none fits.' }
  },
  required: ['folder', 'reason'],
  additionalProperties: false
};

function promptFor(row, paths) {
  const core = row.core || {};
  const job = [
    'Address: ' + (core.address || row.label || ''),
    core.unit ? 'Unit: ' + core.unit : '',
    [core.city, core.state].filter(Boolean).length ? 'Town: ' + [core.city, core.state].filter(Boolean).join(', ') : '',
    'Market: ' + (row.market || ''),
    'Stage: ' + (row.stage || '')
  ].filter(Boolean).join('\n');
  return 'A real estate team files each listing in a Google Drive folder. This listing has no folder linked, and its ' +
    'address did not match any folder name. Folders are sometimes named for the client (a surname), a nickname, a ' +
    'building name, a unit ("House 2", "6A"), or filed under a neighbouring town.\n\n' +
    'The listing:\n' + job + '\n\n' +
    'Pick the ONE folder below that is most likely this listing\'s own folder. Only pick one if the name gives real ' +
    'evidence (the street, the house number, the unit, or a clear nickname for it); a folder for a different address ' +
    'is wrong even if the town matches. If none is likely, answer an empty folder. Give a one-line reason.\n\n' +
    'Folders:\n' + paths.join('\n');
}

async function guess(o) {
  if (!o.paths.length) return null;
  const a = await o.ask(promptFor(o.row, o.paths), SCHEMA);
  const folder = a && typeof a.folder === 'string' ? a.folder.trim() : '';
  const why = a && typeof a.reason === 'string' ? a.reason.trim().replace(/\s+/g, ' ').slice(0, 200) : '';
  if (!folder || o.paths.indexOf(folder) === -1) return null;   // none, or a path it made up
  return { path: folder, why: why || 'No reason given.' };
}

function makeAsk(cfg) {
  if (!cfg || !cfg.anthropicKey) return null;
  let client = null;
  return async function ask(prompt, schema) {
    if (!client) {
      const A = require('@anthropic-ai/sdk');
      client = new (A.default || A)({ apiKey: cfg.anthropicKey });
    }
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 4000,
      output_config: { effort: 'low', format: { type: 'json_schema', schema } },
      messages: [{ role: 'user', content: prompt }]
    });
    if (res.stop_reason === 'refusal') throw new Error('the model declined');
    const text = (res.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
    return JSON.parse(text);
  };
}

module.exports = { folderNames, guess, makeAsk, promptFor, MODEL, PLACES };
