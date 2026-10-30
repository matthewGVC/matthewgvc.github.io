/* ============================================================
   FOLDER AI DRY RUN — what the AI pass would ask for some jobs (D123).

     node helper/folder-ai-dry.js "1000 Nixon" "19 Colt" …
       stubbed: nothing leaves the PC. Prints each job, how many folder
       names would be sent, and the prompt's size.
     node helper/folder-ai-dry.js --ask "1000 Nixon" …
       real: asks Claude Haiku (needs anthropicKey in the config) and prints
       its pick and reason. Only on Matt's OK: folder names can hold client
       surnames, and they go to the AI service.

   Either way it only reads: the jobs from the database, folder names from
   G:. Nothing is stored, linked or written, on Drive or anywhere else.
   ============================================================ */
'use strict';

const AI = require('./folder-ai.js');
const { driveLister } = require('./scan.js');

async function main(argv) {
  const real = argv.includes('--ask');
  const wants = argv.filter(a => a !== '--ask').map(a => a.toLowerCase());
  const cfg = require('./config.js').loadConfig();
  const client = require('./supabase.js').createClient(cfg);
  if (!client.ready()) { console.log('No helper account yet.'); return; }
  const ask = real ? AI.makeAsk(cfg) : async () => ({ folder: '', reason: 'stub: no call made' });
  if (!ask) { console.log('No anthropicKey in the helper config: the AI pass is off.'); return; }
  const rows = await client.select('properties');
  const taken = rows.filter(x => x.drive_folder && x.folder_state !== 'unlinked').map(x => x.drive_folder);
  const D = driveLister('G:\\Shared drives');
  for (const want of wants) {
    const hits = rows.filter(x => [(x.core || {}).address, (x.core || {}).unit, x.label].filter(Boolean).join(' ').toLowerCase().includes(want));
    const r = hits.find(x => !x.drive_folder) || hits[0];   // the unplaced one first
    if (!r) { console.log(want + ': no job found'); continue; }
    const name = [(r.core || {}).address || r.label, (r.core || {}).unit].filter(Boolean).join(' ');
    const paths = await AI.folderNames(D, r, { taken });
    const prompt = AI.promptFor(r, paths);
    const g = await AI.guess({ ask, row: r, paths });
    console.log(name + ' (' + r.market + ', ' + (r.stage || 'no stage') + ', linked: ' + (r.drive_folder ? 'yes' : 'no') + ', candidate now: ' + ((r.scan || {}).candidate || 'none') + ')');
    console.log('  ' + paths.length + ' folder names, prompt about ' + Math.round(prompt.length / 4) + ' tokens');
    console.log('  ' + (real ? 'AI pick: ' : 'stub pick: ') + (g ? g.path + ' (' + g.why + ')' : 'none'));
  }
}

main(process.argv.slice(2)).catch(e => { console.log('Dry run failed: ' + e.message); process.exit(1); });
