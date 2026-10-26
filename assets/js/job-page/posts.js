/* ============================================================
   JOB PAGE: Social posts, inside a listing's Marketing track and on a development's
   page (Matt's notes, 10-22; developments 10-26).

     GVC_JP.posts.html(ctx)    ctx.posts: the job's asana_tasks rows of kind 'post'

   The 💬 Social Media project in Asana, read by the helper on every Asana sync
   (helper/asana/posts.js): a post counts for this job when its "🏡2026 Properties"
   tag names it (a development: its name in the tag). "4 posted · 1 coming": posted is ticked done in Asana, coming is
   still open (GVC_WS.postsOf). Each post: its date, format and name, the name a
   link to the post when Asana holds one (https only).
   ============================================================ */
(function (global) {
  'use strict';
  var JP = global.GVC_JP = global.GVC_JP || {};

  function line(r, ctx) {
    var W = ctx.W, esc = ctx.esc, f = r.fields || {};
    var link = typeof f.link === 'string' && /^https:\/\//.test(f.link) ? f.link : null;
    var name = link ? '<a class="link" href="' + esc(link) + '" target="_blank" rel="noopener">' + esc(r.name) + '</a>' : esc(r.name);
    var when = r.completed_at || r.due_on;
    return '<li><span class="pd">' + (when ? esc(W.fmtDay(when)) : '') + '</span><span class="pn">' + name + '</span>' +
      (f.format ? '<span class="chip">' + esc(f.format) + '</span>' : '') + '</li>';
  }

  function html(ctx) {
    var p = ctx.W.postsOf(ctx.posts || []);
    var head = '<div class="card-h"><div><h2>Social posts</h2></div><span class="soft" id="postsCount">' +
      p.posted.length + ' posted' + (p.coming.length ? ' · ' + p.coming.length + ' coming' : '') + '</span></div>';
    if (!p.posted.length && !p.coming.length) {
      return '<div class="card" id="postsCard">' + head + '<p class="soft">No posts in Asana\'s Social Media project name this listing yet.</p></div>';
    }
    var list = function (rows, title) { return rows.length ? '<h3 class="ph3">' + title + '</h3><ul class="posts">' + rows.map(function (r) { return line(r, ctx); }).join('') + '</ul>' : ''; };
    return '<div class="card" id="postsCard">' + head + list(p.coming, 'Coming') + list(p.posted, 'Posted') + '</div>';
  }

  JP.posts = { html: html };
})(window);
