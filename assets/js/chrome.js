/* Injects shared masthead + footer.
   There is no nav: the home page is the index for everything, and the lockup
   is the way back to it. Pages still set data-nav; it is unused but harmless.
   Dereferences document.body at execution — load as a classic script at the end of <body>. */
(function () {
  if (document.querySelector(".masthead")) return;
  const root = document.body.dataset.root || "";

  const mast = document.createElement("header");
  mast.className = "masthead";
  mast.innerHTML = `
    <a class="mast-lockup" href="${root}." aria-label="Matt Bloomfield — GVC Workspace, home">
      <span class="monogram" id="mast-monogram"></span>
    </a>`;
  document.body.prepend(mast);

  // Inline the monogram SVG so motion.js can animate its paths.
  fetch(root + "assets/logos/monogram.svg")
    .then(r => { if (!r.ok) throw new Error(r.status); return r.text(); })
    .then(svg => {
      const slot = document.getElementById("mast-monogram");
      if (slot) { slot.innerHTML = svg; document.dispatchEvent(new Event("monogram-ready")); }
    })
    .catch(err => console.warn("monogram failed to load", err)); // masthead works without the mark

  // Builder tools are full-height apps: the panel and the preview scroll
  // independently and the page itself never does, so they opt out of the footer.
  if (document.body.dataset.foot === "none") return;

  const foot = document.createElement("footer");
  foot.className = "site-foot";
  foot.innerHTML = `
    <span class="left">Matt Bloomfield — The GVC Team, Douglas Elliman</span>
    <span class="right">
      <a href="https://github.com/matthewGVC" target="_blank" rel="noopener">github/matthewGVC</a>
      <a href="https://gvcrealestateteam.com" target="_blank" rel="noopener">gvcrealestateteam.com</a>
    </span>`;
  document.body.append(foot);
})();
