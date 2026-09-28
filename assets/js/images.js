/* ============================================================
   IMAGES — reading a dropped photo or floor plan, shared by the Showsheet
   and the Brochure.

   Both tools used to carry their own copy of every function here, identical
   down to the thresholds; a fix made in one never reached the other. The
   Showsheet had even grown a second margin trim of its own, without the
   Brochure's guard against a crop that comes back implausibly tight.

     GVC_IMAGES.fileToImage(file)            → Promise<HTMLImageElement>
     GVC_IMAGES.reencode(img, maxEdge, q, rect) → JPEG data URL
     GVC_IMAGES.floorplanHeaderY(img)        → rows to cut off the top (0 = none)
     GVC_IMAGES.trimRect(img, startY)        → {x, y, w, h} to keep
   ============================================================ */
(function (global) {
  'use strict';

  function fileToImage(file) {
    return new Promise(function (res, rej) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () { URL.revokeObjectURL(url); res(img); };
      img.onerror = function () { URL.revokeObjectURL(url); rej(new Error('Could not read image')); };
      img.src = url;
    });
  }

  /* Redrawn onto a white canvas and saved as JPEG: that flattens transparency,
     turns a CMYK file into RGB, and caps the long edge. rect is a source-pixel
     crop box; omit it for the whole image. */
  function reencode(img, maxEdge, quality, rect) {
    var sx = rect ? rect.x : 0, sy = rect ? rect.y : 0;
    var sw = rect ? rect.w : img.naturalWidth, sh = rect ? rect.h : img.naturalHeight;
    var r = Math.min(1, maxEdge / Math.max(sw, sh));
    var w = Math.round(sw * r), h = Math.round(sh * r);
    var cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    var cx = cv.getContext('2d');
    cx.fillStyle = '#fff'; cx.fillRect(0, 0, w, h);
    cx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
    return cv.toDataURL('image/jpeg', quality);
  }

  /* GVC floorplan exports lead with a full-width navy title band; find the
     white gap right below it. Returns 0 when no band is present (a plan that
     was already cropped). */
  function floorplanHeaderY(img) {
    try {
      var W = img.naturalWidth, H = img.naturalHeight;
      var scanH = Math.floor(H * 0.35);
      var cv = document.createElement('canvas'); cv.width = W; cv.height = scanH;
      var cx = cv.getContext('2d');
      cx.drawImage(img, 0, 0, W, scanH, 0, 0, W, scanH);
      var data = cx.getImageData(0, 0, W, scanH).data;
      var darkFrac = function (y) {
        var dark = 0, n = 0;
        for (var x = 0; x < W; x += 8) {
          var i = (y * W + x) * 4;
          if (.299 * data[i] + .587 * data[i + 1] + .114 * data[i + 2] < 200) dark++;
          n++;
        }
        return dark / n;
      };
      if (darkFrac(2) < .85 || darkFrac(Math.floor(H * 0.015)) < .85) return 0; // no navy band on top
      for (var y = Math.floor(H * 0.02); y < scanH; y += 3) {
        if (darkFrac(y) < .08) return y; // first white row after the band
      }
    } catch (e) {}
    return 0;
  }

  /* Floor-plan exports are mostly white margin, which makes the drawing print
     small inside its frame. Find the bounding box of anything that isn't
     paper-white, keep a hair of margin, and crop to that — from startY down.

     The scan runs on a downsampled copy: a 4000px plan does not need
     per-pixel accuracy to find its own edges, and the full-size read is slow.
     If the box comes back implausibly tight (a stray speck, a blank scan) the
     crop is abandoned and the plan comes through whole. */
  function trimRect(img, startY) {
    var W = img.naturalWidth, y0 = startY || 0, H = img.naturalHeight - y0;
    var whole = { x: 0, y: y0, w: W, h: H };
    if (W < 8 || H < 8) return whole;
    try {
      var s = Math.min(1, 700 / Math.max(W, H));
      var w = Math.max(1, Math.round(W * s)), h = Math.max(1, Math.round(H * s));
      var cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      var cx = cv.getContext('2d', { willReadFrequently: true });
      cx.fillStyle = '#fff'; cx.fillRect(0, 0, w, h);
      cx.drawImage(img, 0, y0, W, H, 0, 0, w, h);
      var d = cx.getImageData(0, 0, w, h).data;
      var minX = w, minY = h, maxX = -1, maxY = -1;
      for (var y = 0; y < h; y++) {
        for (var x = 0; x < w; x++) {
          var i = (y * w + x) * 4;
          if (.299 * d[i] + .587 * d[i + 1] + .114 * d[i + 2] < 242) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
      if (maxX < 0) return whole;                       // nothing but paper
      var pad = Math.round(Math.max(w, h) * .012);
      minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad);
      maxX = Math.min(w - 1, maxX + pad); maxY = Math.min(h - 1, maxY + pad);
      var rx = Math.floor(minX / s), ry = Math.floor(minY / s);
      var rw = Math.min(W - rx, Math.ceil((maxX - minX + 1) / s));
      var rh = Math.min(H - ry, Math.ceil((maxY - minY + 1) / s));
      if (rw < W * .25 || rh < H * .25) return whole;   // too tight to trust
      return { x: rx, y: y0 + ry, w: rw, h: rh };
    } catch (e) { return whole; }
  }

  global.GVC_IMAGES = { fileToImage: fileToImage, reencode: reencode,
                        floorplanHeaderY: floorplanHeaderY, trimRect: trimRect };
})(window);
