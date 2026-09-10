/* Home-page photo shuffle: picks a random raw/edited pair from photos/pairs.json
   and shows it in a before/after slider. No-ops on pages without the panel. */
(function () {
  const stage = document.getElementById("ph-stage");
  if (!stage) return;

  const root = document.body.dataset.root || "";
  const before = document.getElementById("ph-before");
  const after = document.getElementById("ph-after");
  const clip = document.getElementById("ph-clip");
  const divider = document.getElementById("ph-divider");
  const range = document.getElementById("ph-range");
  const meta = document.getElementById("ph-meta");
  const shuffleBtn = document.getElementById("ph-shuffle");

  let pairs = [];
  let current = -1;

  function setSplit(pct) {
    const v = Math.min(100, Math.max(0, pct));
    clip.style.clipPath = "inset(0 " + (100 - v) + "% 0 0)";
    divider.style.left = v + "%";
  }

  /* Random, but never the photo already on screen — a shuffle button that can
     land on the same image reads as broken. */
  function pickIndex() {
    if (pairs.length < 2) return 0;
    let i = current;
    while (i === current) i = Math.floor(Math.random() * pairs.length);
    return i;
  }

  function show(i) {
    const p = pairs[i];
    current = i;
    before.src = root + "photos/" + p.raw;
    after.src = root + "photos/" + p.edit;
    before.alt = p.property + " — " + p.label + ", raw";
    after.alt = p.property + " — " + p.label + ", edited";
    meta.textContent = p.property;
    range.value = 50;
    setSplit(50);
    stage.hidden = false;
  }

  range.addEventListener("input", () => setSplit(Number(range.value)));

  shuffleBtn.addEventListener("click", () => {
    if (!pairs.length) return;
    show(pickIndex());
  });

  /* Dragging anywhere on the image moves the split, not just the range thumb.
     The range input stays as the real control so keyboard and AT still work. */
  const ba = document.getElementById("ph-ba");
  let dragging = false;
  function splitFromPointer(clientX) {
    const r = ba.getBoundingClientRect();
    if (!r.width) return;
    const pct = ((clientX - r.left) / r.width) * 100;
    range.value = Math.round(Math.min(100, Math.max(0, pct)));
    setSplit(Number(range.value));
  }
  ba.addEventListener("pointerdown", (e) => {
    if (e.target === range) return; // let the native thumb handle itself
    dragging = true;
    ba.setPointerCapture(e.pointerId);
    splitFromPointer(e.clientX);
  });
  ba.addEventListener("pointermove", (e) => { if (dragging) splitFromPointer(e.clientX); });
  ["pointerup", "pointercancel"].forEach((ev) =>
    ba.addEventListener(ev, () => { dragging = false; }));

  fetch(root + "photos/pairs.json")
    .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then((data) => {
      pairs = Array.isArray(data) ? data : [];
      if (!pairs.length) throw new Error("no pairs");
      show(pickIndex());
    })
    .catch((err) => {
      // Panel stays hidden; the "All galleries" link below it still works.
      console.warn("photo shuffle unavailable", err);
      meta.textContent = "";
      shuffleBtn.hidden = true;
    });
})();
