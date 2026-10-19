/* ============================================================
   DE CAPTURE — reads the GVC team's listings from Douglas Elliman.

   DE's listing API only answers requests made by its own team page, with a
   short-lived session header the page sets. So the helper loads the team
   page in a hidden browser, borrows that header from the page's own first
   request (never saved anywhere), and fetches every page of four feeds
   from inside the page, one request a second:

     featured     · sale    (listingTypeClass=1)  live, under contract, pending
     featured     · rental  (listingTypeClass=0)
     transactions · sale    (listingTypeClass=1)  sold
     transactions · rental  (listingTypeClass=0)  rented

     const feeds = await captureFeeds({ teamUrl, record: 'helper/fixtures/recorded/2026-10-19' });
     feeds['featured-sale'] → { rows, total, pages, request: { url } }

   Each feed's `total` is DE's own totalCount; checks.js compares it with the
   rows read. With `record`, every raw page is written to that folder
   (gitignored) so tests can replay it. `fromFixtures(dir)` reads one back.
   ============================================================ */
'use strict';

const fs = require('fs'), path = require('path');
require('../config.js');   // points Playwright at the helper's own browser

const API = 'https://core.api.elliman.com/listing/';
const TEAM_ID = '226645';
const PAGE_SIZE = 100;
const FEEDS = {
  'featured-sale':      { kind: 'featured',     cls: 1 },
  'featured-rental':    { kind: 'featured',     cls: 0 },
  'transactions-sale':  { kind: 'transactions', cls: 1 },
  'transactions-rental':{ kind: 'transactions', cls: 0 }
};

function feedUrl(name, page) {
  const f = FEEDS[name];
  const q = 'id=' + TEAM_ID + '&pageNumber=' + page + '&pageSize=' + PAGE_SIZE + '&listingTypeClass=' + f.cls + '&currencyTo=USD';
  return API + f.kind + '/team?' + q + (f.kind === 'featured' ? '&international=false' : '&orderBy=Recent');
}

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

async function captureFeeds(opts) {
  const { chromium } = require('playwright');
  const browser = await chromium.launch({ headless: opts.headless !== false });
  try {
    const page = await browser.newPage();
    let header = null;
    page.on('request', r => {
      if (!header && r.url().indexOf(API) === 0 && r.headers().cookies) header = r.headers().cookies;
    });
    /* The header only lives a few seconds, so it's borrowed again whenever DE
       stops accepting it (it answers 404, not 401). */
    async function borrowHeader() {
      header = null;
      await page.goto(opts.teamUrl, { waitUntil: 'networkidle', timeout: 90000 });
      const t0 = Date.now();
      while (!header && Date.now() - t0 < 45000) await wait(500);
      if (!header) throw new Error('DE\'s team page loaded, but its listings feed was never requested, so nothing could be read.');
    }
    async function get(url) {
      const call = () => page.evaluate(async ([u, h]) => {
        const x = await fetch(u, { headers: { accept: 'application/json', cookies: h } });
        return { status: x.status, text: await x.text() };
      }, [url, header]);
      let r = await call();
      if (r.status === 404) { await borrowHeader(); r = await call(); }
      return r;
    }
    await borrowHeader();

    const out = { capturedAt: new Date().toISOString() };
    for (const name of Object.keys(FEEDS)) {
      const feed = { rows: [], total: null, pages: 0, request: { url: feedUrl(name, 1) } };
      for (let n = 1; ; n++) {
        const url = feedUrl(name, n);
        const r = await get(url);
        if (r.status !== 200) throw new Error(name + ' page ' + n + ': DE answered ' + r.status + '.');
        const json = JSON.parse(r.text);
        if (opts.record) {
          fs.mkdirSync(opts.record, { recursive: true });
          fs.writeFileSync(path.join(opts.record, name + '-p' + n + '.json'), r.text);
        }
        if (feed.total === null) feed.total = json.totalCount;
        const data = json.data || [];
        feed.rows.push.apply(feed.rows, data);
        feed.pages = n;
        await wait(1000);
        if (!data.length || feed.rows.length >= feed.total || data.length < PAGE_SIZE) break;
      }
      out[name] = feed;
    }
    return out;
  } finally {
    await browser.close();
  }
}

/* Replays a recorded (or made-up) folder of <feed>-p<n>.json files. */
function fromFixtures(dir) {
  const out = { capturedAt: 'fixtures:' + dir };
  for (const name of Object.keys(FEEDS)) {
    const feed = { rows: [], total: null, pages: 0, request: { url: feedUrl(name, 1) } };
    for (let n = 1; fs.existsSync(path.join(dir, name + '-p' + n + '.json')); n++) {
      const json = JSON.parse(fs.readFileSync(path.join(dir, name + '-p' + n + '.json'), 'utf8'));
      if (feed.total === null) feed.total = json.totalCount;
      feed.rows.push.apply(feed.rows, json.data || []);
      feed.pages = n;
    }
    if (!feed.pages) throw new Error(name + ' feed not captured (no ' + name + '-p1.json in ' + dir + ').');
    out[name] = feed;
  }
  return out;
}

module.exports = { captureFeeds, fromFixtures, FEEDS, feedUrl };
