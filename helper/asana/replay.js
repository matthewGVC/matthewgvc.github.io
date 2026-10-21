/* ============================================================
   ASANA REPLAY — a stand-in for Asana that answers from files, for tests and
   `node helper/asana-sync.js --fixtures <dir>`. It is a fetch() look-alike
   handed to createAsana(), so the real client, paging and allowlist run.

     replayFetch(dir, over?) → async (url) → a Response-like object

   dir holds raw Asana answers named as in helper/fixtures/synthetic/asana/
   (tasks-<projectGid>.json, people-<gid>.json, me.json). over (all optional)
   swaps in data a test built itself:
     tasks     { <projectGid>: [rawTask] }   instead of tasks-<gid>.json
     subtasks  { <taskGid>: [rawSubtask] }   (default: none)
     stories   { <taskGid>: [rawStory] }     (default: none)
     projects  { <projectGid>: { gid, name } }
     status    every request answers this HTTP status (e.g. 401)
     fail      { <projectGid>: status }      that project's task list fails
     failTask  { <taskGid>: status }         that task's subtasks and stories fail
   modified_since is honoured, like Asana: only tasks modified after it.
   ============================================================ */
'use strict';

const fs = require('fs'), path = require('path');

function replayFetch(dir, over) {
  const o = over || {};
  const file = f => { const p = path.join(dir, f); return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null; };
  const res = (body, status) => ({ ok: !status || status < 400, status: status || 200, headers: { get: () => null }, json: async () => body });
  const list = rows => res({ data: rows, next_page: null });

  return async url => {
    if (o.status) return res({ errors: [{ message: 'refused' }] }, o.status);
    const u = new URL(url), q = u.searchParams;
    const p = u.pathname.replace(/^\/api\/1\.0/, '');
    let m;
    if (p === '/users/me') return res(file('me.json') || { data: { name: 'Replay' } });
    const project = (m = p.match(/^\/projects\/(\d+)\/tasks$/)) ? m[1] : (p === '/tasks' ? q.get('project') : null);
    if (project) {
      if (o.fail && o.fail[project]) return res({ errors: [{ message: 'failed' }] }, o.fail[project]);
      const own = o.tasks && o.tasks[project];
      const fromFile = file('tasks-' + project + '.json') || file('people-' + project + '.json');
      let rows = own || (fromFile ? fromFile.data : []);
      const since = q.get('modified_since');
      if (since) rows = rows.filter(r => r.modified_at && r.modified_at > since);
      return list(rows);
    }
    if ((m = p.match(/^\/tasks\/(\d+|[\w-]+)\/(subtasks|stories)$/)) && o.failTask && o.failTask[m[1]]) return res({ errors: [{ message: 'failed' }] }, o.failTask[m[1]]);
    if ((m = p.match(/^\/tasks\/(\d+|[\w-]+)\/subtasks$/))) return list((o.subtasks && o.subtasks[m[1]]) || []);
    if ((m = p.match(/^\/tasks\/(\d+|[\w-]+)\/stories$/))) return list((o.stories && o.stories[m[1]]) || []);
    if ((m = p.match(/^\/projects\/(\d+)$/))) {
      const pr = o.projects && o.projects[m[1]];
      return pr ? res({ data: pr }) : res({ errors: [{ message: 'not found' }] }, 404);
    }
    if ((m = p.match(/^\/portfolios\/(\d+)\/items$/))) return list([]);
    return res({ errors: [{ message: 'not found' }] }, 404);
  };
}

module.exports = { replayFetch };
