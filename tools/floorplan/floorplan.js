/* ============================================================================
 * floorplan.js
 * ----------------------------------------------------------------------------
 * Client-side browser port of cubicasa_to_gvc.py.
 *
 * Converts a CubiCasa SVG floorplan into a GVC-branded SVG. Runs entirely in
 * the browser using DOMParser / XMLSerializer / the SVG DOM — no Node, no lxml,
 * no build step.
 *
 * Public API:
 *   window.convertFloorplanSVG(svgText) -> transformed SVG string
 *
 * The function is pure / idempotent on its input string and never touches the
 * host page's DOM (it parses into a detached Document).
 *
 * Each ported function is commented with the name of the Python function it
 * mirrors. The pipeline order in convertFloorplanSVG() matches the Python
 * convert() exactly.
 * ==========================================================================*/
(function () {
  "use strict";

  // ── GVC Brand Config (Python module-level constants) ──────────────────────
  var GVC_NAVY       = "#00273a";
  var GVC_FONT       = "Nunito Sans";
  var WEIGHT_ROOM    = "900";   // Black
  var WEIGHT_DIM     = "300";   // Light
  var STROKE_WALL    = "2";     // Main wall stroke weight (normalized)
  var STROKE_FIXTURE = "1";     // Fixture / interior line stroke weight

  // CubiCasa disclaimer strings to strip (partial match)
  var CUBICASA_STRINGS = [
    "CUBICASA",
    "cubicasa",
    "FLOOR PLAN CREATED BY",
    "MEASUREMENTS DEEMED",
    "EXCLUDED AREAS",
    "sq. ft",
    "TOTAL:",
  ];

  var SVG_NS     = "http://www.w3.org/2000/svg";
  var INKSCAPE_NS = "http://www.inkscape.org/namespaces/inkscape";

  // ── Lightweight progress log (replaces Python print) ──────────────────────
  // Messages are pushed here for optional debugging; nothing is printed.
  if (typeof window !== "undefined" && !window.__floorplanLog) {
    window.__floorplanLog = [];
  }
  function log(msg) {
    if (typeof window !== "undefined" && window.__floorplanLog) {
      window.__floorplanLog.push(msg);
    }
  }

  // ── DOM helper utilities (map Python lxml idioms to the SVG DOM) ───────────

  // Python root.iter() — yields the element and ALL descendant elements.
  // Returns an array (snapshot) so callers can mutate the tree while iterating,
  // matching lxml's behaviour of iterating over a captured order.
  function iterAll(root) {
    var out = [root];
    var kids = root.querySelectorAll("*");
    for (var i = 0; i < kids.length; i++) out.push(kids[i]);
    return out;
  }

  // Python root.iter("{ns}local") — yields self + descendants whose localName
  // matches. localName matching is namespace-agnostic in the SVG DOM, which is
  // exactly what we want for svg:text / svg:g / svg:polygon / svg:tspan.
  function iterByLocal(root, local) {
    var out = [];
    if (root.localName === local) out.push(root);
    var kids = root.querySelectorAll("*");
    for (var i = 0; i < kids.length; i++) {
      if (kids[i].localName === local) out.push(kids[i]);
    }
    return out;
  }

  // Python list(elem) — element children only (not text nodes).
  function childElements(el) {
    return Array.prototype.slice.call(el.children);
  }

  // Python elem.iterancestors() — walk parentNode upward, stopping before the
  // Document node. Returns nearest-first (same order as lxml).
  function iterAncestors(el) {
    var out = [];
    var p = el.parentNode;
    while (p && p.nodeType === 1 /* ELEMENT_NODE */) {
      out.push(p);
      p = p.parentNode;
    }
    return out;
  }

  // Python elem.iterancestors("{ns}g") — ancestors filtered by localName.
  function iterAncestorsByLocal(el, local) {
    return iterAncestors(el).filter(function (a) {
      return a.localName === local;
    });
  }

  // get/set attribute wrappers that treat missing attrs like Python's
  // elem.get(attr) returning None / "" defaults.
  function getAttr(el, name, dflt) {
    var v = el.getAttribute(name);
    if (v === null || v === undefined) return dflt === undefined ? null : dflt;
    return v;
  }

  // Parse a CSS inline style string into an ordered {k:v} object, mirroring the
  // Python loop that splits on ";" then partitions on ":".
  function parseStyle(style) {
    var props = {};
    if (!style) return props;
    var parts = style.split(";");
    for (var i = 0; i < parts.length; i++) {
      var part = parts[i].trim();
      if (part.indexOf(":") === -1) continue;
      var idx = part.indexOf(":");
      var k = part.slice(0, idx).trim();
      var v = part.slice(idx + 1).trim();
      props[k] = v;
    }
    return props;
  }

  // Serialize a props object back to "k: v; k: v" form (insertion order),
  // matching Python's "; ".join(f"{k}: {v}" ...).
  function serializeStyle(props) {
    var out = [];
    for (var k in props) {
      if (Object.prototype.hasOwnProperty.call(props, k)) {
        out.push(k + ": " + props[k]);
      }
    }
    return out.join("; ");
  }

  function createSvgEl(doc, local) {
    return doc.createElementNS(SVG_NS, local);
  }

  // ── Regex: is_dimension_text ──────────────────────────────────────────────
  // Python: re.search(r"\d+'\d*\"?\s*[xX×]\s*\d+'\d*\"?", text)
  var DIM_RE = /\d+'\d*"?\s*[xX×]\s*\d+'\d*"?/;
  function isDimensionText(text) {
    if (text == null) return false;
    return DIM_RE.test(text);
  }

  // ── is_cubicasa_footer ────────────────────────────────────────────────────
  function isCubicasaFooter(text) {
    if (text == null) return false;
    for (var i = 0; i < CUBICASA_STRINGS.length; i++) {
      if (text.indexOf(CUBICASA_STRINGS[i]) !== -1) return true;
    }
    return false;
  }

  // ── remap_color ───────────────────────────────────────────────────────────
  // Map blacks / dark greys to GVC navy. Leave white alone.
  function remapColor(color) {
    if (!color) return color;
    var c = color.trim().toLowerCase();
    if (c === "#000000" || c === "#000" || c === "black" ||
        c === "#828282" || c === "#900" || c === "#990000") {
      return GVC_NAVY;
    }
    return color; // white, none, etc. pass through unchanged
  }

  // ── remap_inline_style ────────────────────────────────────────────────────
  // Process a CSS inline style string, remapping colors and fonts.
  function remapInlineStyle(style) {
    if (!style) return style;
    var props = parseStyle(style);

    // Colors
    var colorProps = ["fill", "stroke", "color"];
    for (var i = 0; i < colorProps.length; i++) {
      var prop = colorProps[i];
      if (Object.prototype.hasOwnProperty.call(props, prop)) {
        props[prop] = remapColor(props[prop]);
      }
    }

    // Font family
    if (Object.prototype.hasOwnProperty.call(props, "font-family")) {
      props["font-family"] = GVC_FONT;
    }

    return serializeStyle(props);
  }

  // ── normalize_viewbox ─────────────────────────────────────────────────────
  // Shift viewBox so it starts at 0 0; compensate with a translate wrapper <g>.
  function normalizeViewbox(root) {
    var vb = getAttr(root, "viewBox");
    if (!vb) return;
    var parts = vb.replace(/,/g, " ").split(/\s+/).filter(function (p) {
      return p.length > 0;
    });
    if (parts.length !== 4) return;
    var minX = parseFloat(parts[0]);
    var minY = parseFloat(parts[1]);
    var width = parseFloat(parts[2]);
    var height = parseFloat(parts[3]);
    if (minX === 0 && minY === 0) return;

    root.setAttribute("viewBox", "0 0 " + fmt4(width) + " " + fmt4(height));

    var children = childElements(root);
    var doc = root.ownerDocument;
    var wrapper = createSvgEl(doc, "g");
    root.appendChild(wrapper); // etree.SubElement appends at end
    wrapper.setAttribute(
      "transform",
      "translate(" + fmt4(-minX) + "," + fmt4(-minY) + ")"
    );
    for (var i = 0; i < children.length; i++) {
      root.removeChild(children[i]);
      wrapper.appendChild(children[i]);
    }
  }

  // ── process_colors ────────────────────────────────────────────────────────
  // Walk every element, remap fill/stroke attributes and inline styles.
  function processColors(root) {
    var els = iterAll(root);
    for (var i = 0; i < els.length; i++) {
      var elem = els[i];
      var attrs = ["fill", "stroke"];
      for (var a = 0; a < attrs.length; a++) {
        var val = getAttr(elem, attrs[a]);
        if (val) elem.setAttribute(attrs[a], remapColor(val));
      }
      var style = getAttr(elem, "style");
      if (style) elem.setAttribute("style", remapInlineStyle(style));
    }
  }

  // ── process_stroke_weights ────────────────────────────────────────────────
  // Normalize stroke-width. Walls (>=1) → STROKE_WALL; fixtures → STROKE_FIXTURE.
  function processStrokeWeights(root) {
    var els = iterAll(root);
    for (var i = 0; i < els.length; i++) {
      var elem = els[i];
      var style = getAttr(elem, "style", "");

      // Parse existing stroke-width from style or attribute.
      var swMatch = /stroke-width:\s*([\d.]+)/.exec(style);
      var swAttr = getAttr(elem, "stroke-width");
      var current = null;
      if (swMatch) {
        current = parseFloat(swMatch[1]);
      } else if (swAttr) {
        current = parseFloat(swAttr);
      }

      if (current === null || isNaN(current)) continue;

      var newSw = current >= 1.0 ? STROKE_WALL : STROKE_FIXTURE;

      if (swMatch) {
        style = style.replace(/stroke-width:\s*[\d.]+/, "stroke-width: " + newSw);
        elem.setAttribute("style", style);
      } else if (swAttr) {
        elem.setAttribute("stroke-width", String(newSw));
      }
    }
  }

  // ── process_text ──────────────────────────────────────────────────────────
  // Replace fonts with Nunito Sans, set weights, uppercase room names / lower x
  // in dimensions, strip CubiCasa footer text nodes.
  function processText(root) {
    var toRemove = []; // {elem, parent}

    var texts = iterByLocal(root, "text");
    for (var t = 0; t < texts.length; t++) {
      var elem = texts[t];
      var raw = (elem.textContentDirect ? elem.textContentDirect() : directText(elem)) || "";
      raw = raw.trim();

      // Collect text from <tspan> children (Python iter over {ns}tspan).
      var tspans = iterByLocal(elem, "tspan");
      // Python: full_text = raw + " ".join(t.text for t in tspans)
      // " ".join of N items inserts N-1 separators; replicate by joining the
      // span texts with single spaces and concatenating directly to raw.
      var joined = [];
      for (var s2 = 0; s2 < tspans.length; s2++) {
        joined.push(directText(tspans[s2]) || "");
      }
      var fullText = raw + joined.join(" ");

      // Strip CubiCasa footer nodes.
      if (isCubicasaFooter(fullText)) {
        var parent = elem.parentNode;
        if (parent && parent.nodeType === 1) {
          toRemove.push({ elem: elem, parent: parent });
        }
        continue;
      }

      var isDim = isDimensionText(fullText);
      var weight = isDim ? WEIGHT_DIM : WEIGHT_ROOM;

      if (!isDim) {
        // Uppercase room name text and tspans.
        var et = directText(elem);
        if (et) setDirectText(elem, et.toUpperCase());
        for (var u = 0; u < tspans.length; u++) {
          var tt = directText(tspans[u]);
          if (tt) setDirectText(tspans[u], tt.toUpperCase());
        }
      } else {
        // Normalize "X"/"×" separator to lowercase "x".
        var ed = directText(elem);
        if (ed) {
          setDirectText(elem, ed.replace(/ X /g, " x ").replace(/ × /g, " x "));
        }
        for (var d = 0; d < tspans.length; d++) {
          var td = directText(tspans[d]);
          if (td) {
            setDirectText(tspans[d], td.replace(/ X /g, " x ").replace(/ × /g, " x "));
          }
        }
      }

      // Apply font-family / weight / fill in inline style.
      var style = getAttr(elem, "style", "");
      var props = parseStyle(style);
      props["font-family"] = GVC_FONT;
      props["font-weight"] = weight;
      props["fill"] = GVC_NAVY;
      elem.setAttribute("style", serializeStyle(props));

      // Standalone attributes for Illustrator compatibility.
      elem.setAttribute("font-family", GVC_FONT);
      elem.setAttribute("font-weight", weight);
    }

    // Remove flagged footer elements.
    for (var r = 0; r < toRemove.length; r++) {
      toRemove[r].parent.removeChild(toRemove[r].elem);
    }
  }

  // ── strip_cubicasa_groups ─────────────────────────────────────────────────
  // Remove empty <g> elements (left after footer text removal) with no text.
  function stripCubicasaGroups(root) {
    var gs = iterByLocal(root, "g");
    for (var i = 0; i < gs.length; i++) {
      var g = gs[i];
      var children = childElements(g);
      if (children.length === 0 && g.parentNode && g.parentNode.nodeType === 1) {
        var textContent = (directText(g) || "").trim();
        if (!textContent) {
          g.parentNode.removeChild(g);
        }
      }
    }
  }

  // ── strip_dimension_markers ───────────────────────────────────────────────
  // Remove small arrow/triangle <polygon> markers at dimension-line ends.
  function stripDimensionMarkers(root) {
    var ARROW_POINT_PATTERNS = [
      "-5,5,0,0,5,5",
      "-5,-5,0,0,-5,5",
      "-5,-5,0,0,5,-5",
      "5,5,0,0,5,-5",
    ];

    var toRemove = [];
    var polys = iterByLocal(root, "polygon");
    for (var i = 0; i < polys.length; i++) {
      var elem = polys[i];
      var points = (getAttr(elem, "points", "") || "").replace(/ /g, "");
      var matched = false;
      for (var p = 0; p < ARROW_POINT_PATTERNS.length; p++) {
        if (points.indexOf(ARROW_POINT_PATTERNS[p]) !== -1) {
          matched = true;
          break;
        }
      }
      if (matched) {
        var parent = elem.parentNode;
        if (parent && parent.nodeType === 1) {
          toRemove.push({ elem: elem, parent: parent });
        }
      }
    }

    for (var r = 0; r < toRemove.length; r++) {
      toRemove[r].parent.removeChild(toRemove[r].elem);
    }

    log("     (removed " + toRemove.length + " dimension markers)");
  }

  // ── strip_pure_white_blocks ───────────────────────────────────────────────
  // Remove every element whose own fill is white AND whose own stroke is
  // effectively invisible.
  function stripPureWhiteBlocks(root) {
    var WHITE = { "#ffffff": 1, "#fff": 1, "white": 1 };
    var INVIS_STRK = { "none": 1, "": 1, "transparent": 1 };

    var toRemove = [];
    var els = iterAll(root);

    for (var i = 0; i < els.length; i++) {
      var elem = els[i];
      var tag = elem.localName || "";
      if (tag === "svg" || tag === "defs" || tag === "style" || tag === "pattern") {
        continue;
      }
      // Skip if inside <defs>.
      var ancestors = iterAncestors(elem);
      var inDefs = false;
      for (var a = 0; a < ancestors.length; a++) {
        if (ancestors[a].localName === "defs") {
          inDefs = true;
          break;
        }
      }
      if (inDefs) continue;

      if (getAttr(elem, "data-gvc") === "text-bg") continue;

      var style = getAttr(elem, "style", "");
      var props = parseStyle(style);

      var ownFill = (props["fill"] || getAttr(elem, "fill", "") || "").toLowerCase().trim();
      var ownStroke = (props["stroke"] || getAttr(elem, "stroke", "") || "").toLowerCase().trim();
      var ownStrokeOp = Object.prototype.hasOwnProperty.call(props, "stroke-opacity")
        ? props["stroke-opacity"]
        : "1";

      if (!(ownFill in WHITE)) continue;

      var strokeInvisible =
        ownStroke in INVIS_STRK ||
        ownStroke in WHITE ||
        ownStrokeOp === "0";

      if (strokeInvisible) {
        var parent = elem.parentNode;
        if (parent && parent.nodeType === 1) {
          toRemove.push({ elem: elem, parent: parent });
        }
      }
    }

    for (var r = 0; r < toRemove.length; r++) {
      // Python wraps remove() in try/except ValueError (element already gone).
      try {
        if (toRemove[r].elem.parentNode === toRemove[r].parent) {
          toRemove[r].parent.removeChild(toRemove[r].elem);
        }
      } catch (e) { /* ignore */ }
    }

    log("     (removed " + toRemove.length + " white-fill no-stroke elements)");
  }

  // ── fix_opening_fills ─────────────────────────────────────────────────────
  // No-op (Python only prints). Door/window opening groups are left untouched.
  function fixOpeningFills(root) {
    log("     (opening fills left as-is — white polygon is the wall gap)");
  }

  // ── fix_stroke_alignment ──────────────────────────────────────────────────
  // For every dark-fill <g>, set stroke="none" to remove outward stroke bleed.
  function fixStrokeAlignment(root) {
    var DARK = { "#000000": 1, "#000": 1, "black": 1, "#00273a": 1 };
    var modified = 0;

    var gs = iterByLocal(root, "g");
    for (var i = 0; i < gs.length; i++) {
      var elem = gs[i];
      var fill = (getAttr(elem, "fill", "") || "").toLowerCase().trim();
      var stroke = (getAttr(elem, "stroke", "") || "").toLowerCase().trim();

      if (fill in DARK && stroke !== "none" && stroke !== "") {
        elem.setAttribute("stroke", "none");
        var style = getAttr(elem, "style", "");
        if (style.indexOf("stroke-width") !== -1) {
          style = style.replace(/stroke-width:\s*[\d.]+/, "stroke-width: 0");
          elem.setAttribute("style", style);
        }
        modified++;
      }
    }

    log("     (removed stroke from " + modified + " dark-fill wall groups)");
  }

  // ── fix_quote_characters ──────────────────────────────────────────────────
  // Replace ASCII ' and " with typographic prime/double-prime, only in strings
  // that look like dimensions.
  function fixQuoteCharacters(text) {
    if (!isDimensionText(text)) return text;
    text = text.replace(/'/g, "′"); // ′ prime
    text = text.replace(/"/g, "″"); // ″ double prime
    return text;
  }

  // ── process_quote_characters ──────────────────────────────────────────────
  // Apply typographic prime/double-prime to all dimension text nodes.
  function processQuoteCharacters(root) {
    var count = 0;
    var texts = iterByLocal(root, "text");
    for (var i = 0; i < texts.length; i++) {
      var elem = texts[i];
      var changed = false;
      var et = directText(elem);
      if (et && isDimensionText(et)) {
        setDirectText(elem, fixQuoteCharacters(et));
        changed = true;
      }
      var tspans = iterByLocal(elem, "tspan");
      for (var s = 0; s < tspans.length; s++) {
        var tt = directText(tspans[s]);
        if (tt && isDimensionText(tt)) {
          setDirectText(tspans[s], fixQuoteCharacters(tt));
          changed = true;
        }
      }
      if (changed) count++;
    }
    log("     (updated " + count + " dimension labels)");
  }

  // ── resolve_transforms ────────────────────────────────────────────────────
  // Walk up the ancestor chain accumulating matrix/translate translations.
  // Returns [tx, ty]. Only handles matrix() and translate() like the Python.
  function resolveTransforms(elem) {
    var tx = 0.0;
    var ty = 0.0;
    var ancestors = iterAncestors(elem); // nearest-first
    ancestors.reverse(); // root-first
    ancestors.push(elem);
    for (var i = 0; i < ancestors.length; i++) {
      var node = ancestors[i];
      var tr = getAttr(node, "transform", "");
      if (!tr) continue;
      var m = /matrix\s*\(([^)]+)\)/.exec(tr);
      if (m) {
        var vals = m[1].split(",").map(function (v) {
          return parseFloat(v.trim());
        });
        if (vals.length === 6) {
          // matrix(a,b,c,d,e,f) — e,f are translation
          tx += vals[4];
          ty += vals[5];
        }
        continue;
      }
      var m2 = /translate\s*\(([^)]+)\)/.exec(tr);
      if (m2) {
        var parts = m2[1].replace(/,/g, " ").split(/\s+/).filter(function (v) {
          return v.length > 0;
        }).map(function (v) {
          return parseFloat(v.trim());
        });
        tx += parts[0];
        ty += parts.length > 1 ? parts[1] : 0;
      }
    }
    return [tx, ty];
  }

  // ── add_text_background_boxes ─────────────────────────────────────────────
  // Insert a white <rect> sibling immediately before each <text>, sized via
  // per-character width estimation tuned for Nunito Sans.
  function addTextBackgroundBoxes(root) {
    var CHAR_RATIO_BOLD = 0.58;  // weight 900 (Black) — wider
    var CHAR_RATIO_LIGHT = 0.50; // weight 300 (Light) — slightly narrower
    var LINE_HEIGHT = 1.15;
    var PAD_X = 2.0;
    var PAD_Y = 1.0;

    var doc = root.ownerDocument;
    var texts = iterByLocal(root, "text");

    for (var i = 0; i < texts.length; i++) {
      var textElem = texts[i];
      var parent = textElem.parentNode;
      if (!parent || parent.nodeType !== 1) continue;

      var style = getAttr(textElem, "style", "");
      var props = parseStyle(style);

      // font-size: first numeric run of the font-size value, default 16.
      var fontSize = 16.0;
      var fsRaw = Object.prototype.hasOwnProperty.call(props, "font-size")
        ? props["font-size"]
        : "16";
      var fsMatch = /[\d.]+/.exec(fsRaw);
      if (fsMatch) {
        var parsed = parseFloat(fsMatch[0]);
        if (!isNaN(parsed)) fontSize = parsed;
      }

      var weight = Object.prototype.hasOwnProperty.call(props, "font-weight")
        ? props["font-weight"]
        : getAttr(textElem, "font-weight", "400");
      var charRatio = weight === "900" ? CHAR_RATIO_BOLD : CHAR_RATIO_LIGHT;

      // Collect visible text content. Python:
      //   (text or "") + "".join(t.text for tspans).strip()
      // Note: .strip() binds to the joined tspan string only.
      var tspans = iterByLocal(textElem, "tspan");
      var spanConcat = "";
      for (var s = 0; s < tspans.length; s++) {
        spanConcat += directText(tspans[s]) || "";
      }
      var textContent = (directText(textElem) || "") + spanConcat.trim();
      var charCount = Math.max(textContent.length, 1);

      var glyphW = charCount * fontSize * charRatio;
      var glyphH = fontSize * LINE_HEIGHT;

      var absT = resolveTransforms(textElem);
      var absTx = absT[0];
      var absTy = absT[1];

      // text x/y attributes (local coords). Python catches ValueError on
      // non-numeric and falls back to 0,0 for BOTH.
      var localX, localY;
      var xRaw = getAttr(textElem, "x", "0");
      var yRaw = getAttr(textElem, "y", "0");
      var px = parseFloatStrict(xRaw);
      var py = parseFloatStrict(yRaw);
      if (px === null || py === null) {
        localX = 0.0;
        localY = 0.0;
      } else {
        localX = px;
        localY = py;
      }

      var absCx = absTx + localX;
      var absBy = absTy + localY;

      var parentAbs = resolveTransforms(parent);
      var parentAbsTx = parentAbs[0];
      var parentAbsTy = parentAbs[1];

      var rectCx = absCx - parentAbsTx;
      var rectBy = absBy - parentAbsTy;

      var rectX = rectCx - glyphW / 2 - PAD_X;
      var rectY = rectBy - glyphH + fontSize * 0.15 - PAD_Y;
      var rectW = glyphW + PAD_X * 2;
      var rectH = glyphH + PAD_Y * 2;

      var rect = createSvgEl(doc, "rect");
      rect.setAttribute("data-gvc", "text-bg");
      rect.setAttribute("x", fmt3(rectX));
      rect.setAttribute("y", fmt3(rectY));
      rect.setAttribute("width", fmt3(rectW));
      rect.setAttribute("height", fmt3(rectH));
      rect.setAttribute("fill", "#ffffff");
      rect.setAttribute("stroke", "none");

      // parent.insert(idx, rect) — insert before the text element.
      parent.insertBefore(rect, textElem);
    }

    log("     (added " + texts.length + " tight background boxes)");
  }

  // ── organize_layers ───────────────────────────────────────────────────────
  // Reorganize SVG into clean named layer groups:
  // Background, Walls, Door Gaps, Doors, Window Gaps, Windows, Fixtures, Text.
  function organizeLayers(root) {
    var ORG_NAVY = "#00273a";
    var WHITE_SET = { "#ffffff": 1, "#fff": 1, "white": 1 };
    var DARK_SET = {};
    DARK_SET[ORG_NAVY] = 1;
    DARK_SET["#000000"] = 1;
    DARK_SET["#000"] = 1;
    DARK_SET["black"] = 1;

    var doc = root.ownerDocument;

    function sp(elem) {
      return parseStyle(getAttr(elem, "style", "") || "");
    }

    function hasTag(elem, name) {
      var all = iterAll(elem);
      for (var i = 0; i < all.length; i++) {
        if (all[i].localName === name) return true;
      }
      return false;
    }

    function isDrawingGroup(elem) {
      var all = iterAll(elem);
      for (var i = 0; i < all.length; i++) {
        var ln = all[i].localName;
        if (ln === "path" || ln === "line" || ln === "polyline" ||
            ln === "circle" || ln === "ellipse" || ln === "rect") {
          return true;
        }
      }
      return false;
    }

    function stampStroke(group, strokeVal) {
      var all = iterAll(group);
      for (var i = 0; i < all.length; i++) {
        var d = all[i];
        var ln = d.localName;
        if (ln === "path" || ln === "line" || ln === "polyline" ||
            ln === "circle" || ln === "ellipse" || ln === "rect") {
          if (!getAttr(d, "stroke")) d.setAttribute("stroke", strokeVal);
        }
      }
    }

    function classify(g) {
      var fill = (getAttr(g, "fill", "") || "").toLowerCase().trim();
      var stroke = (getAttr(g, "stroke", "") || "").toLowerCase().trim();
      var fo = Object.prototype.hasOwnProperty.call(sp(g), "fill-opacity")
        ? sp(g)["fill-opacity"]
        : "1";
      if (fill in DARK_SET) return "walls";
      if (fill in WHITE_SET) {
        if (fo === "0") return "fixtures";
        if (fo === "1" && stroke !== "none" && stroke !== "") {
          return hasTag(g, "path") ? "doors" : "windows";
        }
      }
      return null;
    }

    function makeLayer(label, layerId) {
      var g = createSvgEl(doc, "g");
      g.setAttribute("id", layerId);
      g.setAttribute("inkscape:label", label);
      g.setAttribute("inkscape:groupmode", "layer");
      g.setAttribute("style", "display:inline");
      return g;
    }

    // Find the structural container: the <g> with the most direct <g> children
    // that classify to a known category.
    var bestParent = null;
    var bestCount = 0;
    var allGs = iterByLocal(root, "g");
    for (var gi = 0; gi < allGs.length; gi++) {
      var g = allGs[gi];
      var n = 0;
      var directChildren = childElements(g);
      for (var c = 0; c < directChildren.length; c++) {
        if (directChildren[c].localName === "g" && classify(directChildren[c]) !== null) {
          n++;
        }
      }
      if (n > bestCount) {
        bestCount = n;
        bestParent = g;
      }
    }

    if (bestParent === null || bestCount < 3) {
      log("     (organize_layers: structural container not found -- skipped)");
      return;
    }

    // Find the 0.4756 scale group among ancestors.
    var scaleGroup = null;
    var gAncestors = iterAncestorsByLocal(bestParent, "g");
    for (var ai = 0; ai < gAncestors.length; ai++) {
      if ((getAttr(gAncestors[ai], "transform", "") || "").indexOf("0.4756") !== -1) {
        scaleGroup = gAncestors[ai];
        break;
      }
    }

    // Find the text section: a sibling of the scale group containing <text>.
    var textSection = null;
    if (scaleGroup !== null) {
      var parentOfScale = scaleGroup.parentNode;
      if (parentOfScale && parentOfScale.nodeType === 1) {
        var sibs = childElements(parentOfScale);
        for (var si = 0; si < sibs.length; si++) {
          var sib = sibs[si];
          if (sib !== scaleGroup) {
            if (hasTag(sib, "text")) {
              textSection = sib;
              break;
            }
          }
        }
      }
    }

    // Find the background wrapper: a child of the scale group (not on the
    // ancestor chain of best_parent) containing a white <rect>.
    var bgWrapper = null;
    if (scaleGroup !== null) {
      var ancestorIds = [];
      var bpAncestors = iterAncestors(bestParent);
      for (var bpi = 0; bpi < bpAncestors.length; bpi++) {
        ancestorIds.push(bpAncestors[bpi]);
      }
      var scaleChildren = childElements(scaleGroup);
      for (var sc = 0; sc < scaleChildren.length; sc++) {
        var child = scaleChildren[sc];
        if (ancestorIds.indexOf(child) === -1) {
          var rects = iterByLocal(child, "rect");
          for (var ri = 0; ri < rects.length; ri++) {
            if ((getAttr(rects[ri], "fill", "") || "").toLowerCase() in WHITE_SET) {
              bgWrapper = child;
              break;
            }
          }
        }
        if (bgWrapper !== null) break;
      }
    }

    var buckets = {
      "walls": [],
      "door-gaps": [],
      "doors": [],
      "window-gaps": [],
      "windows": [],
      "fixtures": [],
    };

    var bpChildren = childElements(bestParent);
    for (var bci = 0; bci < bpChildren.length; bci++) {
      var bchild = bpChildren[bci];
      if (bchild.localName !== "g") continue;
      var cat = classify(bchild);
      if (cat === null) continue;
      bestParent.removeChild(bchild);

      if (cat === "doors" || cat === "windows") {
        var parentFill = getAttr(bchild, "fill", "#ffffff");
        var parentStroke = getAttr(bchild, "stroke", ORG_NAVY);
        var parentSw = sp(bchild)["stroke-width"] || getAttr(bchild, "stroke-width", "1");
        var gapElems = [];
        var drawElems = [];

        var subs = childElements(bchild);
        for (var subi = 0; subi < subs.length; subi++) {
          var sub = subs[subi];
          var stag = sub.localName;
          if (stag === "polygon") {
            if (!getAttr(sub, "fill")) sub.setAttribute("fill", parentFill);
            sub.setAttribute("stroke", "none");
            gapElems.push(sub);
          } else if (stag === "g") {
            if (isDrawingGroup(sub)) {
              if (!getAttr(sub, "stroke")) sub.setAttribute("stroke", parentStroke);
              stampStroke(sub, parentStroke);
              var existing = (getAttr(sub, "style", "") || "").trim();
              var swPart = "stroke-width: " + parentSw;
              sub.setAttribute("style", existing ? (swPart + "; " + existing) : swPart);
              drawElems.push(sub);
            } else {
              if (!getAttr(sub, "fill")) sub.setAttribute("fill", parentFill);
              sub.setAttribute("stroke", "none");
              gapElems.push(sub);
            }
          } else if (stag === "line" || stag === "path" || stag === "polyline" ||
                     stag === "circle" || stag === "ellipse" || stag === "rect") {
            if (!getAttr(sub, "stroke")) sub.setAttribute("stroke", parentStroke);
            if (!getAttr(sub, "stroke-width")) sub.setAttribute("stroke-width", parentSw);
            drawElems.push(sub);
          }
        }

        var gapKey = cat === "doors" ? "door-gaps" : "window-gaps";
        pushAll(buckets[gapKey], gapElems);
        pushAll(buckets[cat], drawElems);

      } else if (cat === "walls") {
        // Door/window opening groups nested inside wall groups.
        var dwChildren = [];
        var wsubs = childElements(bchild);
        for (var wsi = 0; wsi < wsubs.length; wsi++) {
          var wsub = wsubs[wsi];
          if (wsub.localName !== "g") continue;
          var subFill = (getAttr(wsub, "fill", "") || "").toLowerCase().trim();
          var subStroke = (getAttr(wsub, "stroke", "") || "").toLowerCase().trim();
          var subFo = Object.prototype.hasOwnProperty.call(sp(wsub), "fill-opacity")
            ? sp(wsub)["fill-opacity"]
            : "1";
          if ((subFill in WHITE_SET) && subStroke !== "none" && subStroke !== "" && subFo === "1") {
            dwChildren.push(wsub);
          }
        }

        for (var dwi = 0; dwi < dwChildren.length; dwi++) {
          var dw = dwChildren[dwi];
          bchild.removeChild(dw);
          var dwFill = getAttr(dw, "fill", "#ffffff");
          var dwStroke = getAttr(dw, "stroke", ORG_NAVY);
          var dwSw = Object.prototype.hasOwnProperty.call(sp(dw), "stroke-width")
            ? sp(dw)["stroke-width"]
            : "1";
          var isDoor = hasTag(dw, "path");

          var dwsubs = childElements(dw);
          for (var dsi = 0; dsi < dwsubs.length; dsi++) {
            var dsub = dwsubs[dsi];
            var dstag = dsub.localName;
            if (dstag === "polygon") {
              if (!getAttr(dsub, "fill")) dsub.setAttribute("fill", dwFill);
              dsub.setAttribute("stroke", "none");
              var gk = isDoor ? "door-gaps" : "window-gaps";
              buckets[gk].push(dsub);
            } else if (dstag === "g") {
              if (isDrawingGroup(dsub)) {
                if (!getAttr(dsub, "stroke")) dsub.setAttribute("stroke", dwStroke);
                stampStroke(dsub, dwStroke);
                var dexisting = (getAttr(dsub, "style", "") || "").trim();
                var dswPart = "stroke-width: " + dwSw;
                dsub.setAttribute("style", dexisting ? (dswPart + "; " + dexisting) : dswPart);
                var drawKey = isDoor ? "doors" : "windows";
                buckets[drawKey].push(dsub);
              } else {
                if (!getAttr(dsub, "fill")) dsub.setAttribute("fill", dwFill);
                dsub.setAttribute("stroke", "none");
                var gk2 = isDoor ? "door-gaps" : "window-gaps";
                buckets[gk2].push(dsub);
              }
            }
          }
        }

        buckets["walls"].push(bchild);

      } else {
        buckets[cat].push(bchild);
      }
    }

    var LAYER_DEFS = [
      ["walls", "Walls", "walls"],
      ["door-gaps", "Door Gaps", "door-gaps"],
      ["doors", "Doors", "doors"],
      ["window-gaps", "Window Gaps", "window-gaps"],
      ["windows", "Windows", "windows"],
      ["fixtures", "Fixtures", "fixtures"],
    ];

    var counts = {};
    for (var ld = 0; ld < LAYER_DEFS.length; ld++) {
      var bucketKey = LAYER_DEFS[ld][0];
      var label = LAYER_DEFS[ld][1];
      var layerId = LAYER_DEFS[ld][2];
      var elems = buckets[bucketKey];
      counts[label] = elems.length;
      if (elems.length === 0) continue;
      var layer = makeLayer(label, layerId);
      for (var ei = 0; ei < elems.length; ei++) {
        layer.appendChild(elems[ei]);
      }
      bestParent.appendChild(layer);
    }

    if (bgWrapper !== null) {
      bgWrapper.setAttribute("id", "background");
      bgWrapper.setAttribute("inkscape:label", "Background");
      bgWrapper.setAttribute("inkscape:groupmode", "layer");
    }

    if (textSection !== null) {
      textSection.setAttribute("id", "text");
      textSection.setAttribute("inkscape:label", "Text");
      textSection.setAttribute("inkscape:groupmode", "layer");
      counts["Text"] = iterByLocal(textSection, "text").length;
      // Move text layer to end so it renders on top.
      var tsParent = textSection.parentNode;
      if (tsParent && tsParent.nodeType === 1) {
        tsParent.removeChild(textSection);
        tsParent.appendChild(textSection);
      }
    }

    var summaryParts = [];
    for (var ck in counts) {
      if (Object.prototype.hasOwnProperty.call(counts, ck) && counts[ck]) {
        summaryParts.push(ck + "=" + counts[ck]);
      }
    }
    log("     (" + summaryParts.join("  ") + ")");
  }

  // ── add_google_fonts_style ────────────────────────────────────────────────
  // Inject a <style> block importing Nunito Sans from Google Fonts.
  function addGoogleFontsStyle(root) {
    var doc = root.ownerDocument;
    var styleEl = createSvgEl(doc, "style");
    styleEl.textContent =
      "@import url('https://fonts.googleapis.com/css2?family=Nunito+Sans:" +
      "wght@300;900&display=swap');\n";
    // root.insert(0, style_el) — prepend as first child.
    if (root.firstChild) {
      root.insertBefore(styleEl, root.firstChild);
    } else {
      root.appendChild(styleEl);
    }
  }

  // ── Direct text helpers ───────────────────────────────────────────────────
  // lxml's elem.text is the text BEFORE the first child element only — not the
  // recursive textContent. We emulate that: read/write the first direct text
  // node of an element (the text that precedes any child element).
  function directText(el) {
    // Concatenate leading text nodes up to the first element child — but lxml's
    // .text is specifically the text immediately after the open tag, before the
    // first child element. We mirror that: the first child node if it is text.
    var node = el.firstChild;
    var txt = "";
    while (node && node.nodeType === 3 /* TEXT_NODE */) {
      txt += node.nodeValue;
      node = node.nextSibling;
      // lxml .text stops at the first element; but adjacent text nodes are
      // rare in parsed SVG. Accumulate contiguous leading text nodes.
    }
    if (node === el.firstChild && (!el.firstChild || el.firstChild.nodeType !== 3)) {
      return null; // no leading text => lxml .text is None
    }
    return txt === "" ? null : txt;
  }

  function setDirectText(el, value) {
    // Replace the leading text node(s) before the first element child with a
    // single text node carrying `value`, preserving child elements.
    var node = el.firstChild;
    // Remove contiguous leading text nodes.
    while (node && node.nodeType === 3) {
      var next = node.nextSibling;
      el.removeChild(node);
      node = next;
    }
    var textNode = el.ownerDocument.createTextNode(value);
    if (el.firstChild) {
      el.insertBefore(textNode, el.firstChild);
    } else {
      el.appendChild(textNode);
    }
  }

  // ── Number formatting helpers (Python f-string precision) ─────────────────
  function fmt4(n) {
    return Number(n).toFixed(4);
  }
  function fmt3(n) {
    return Number(n).toFixed(3);
  }

  // Strict float parse mirroring Python float(): rejects trailing junk.
  // Returns null on failure (so caller can replicate Python's ValueError path).
  function parseFloatStrict(s) {
    if (s === null || s === undefined) return null;
    var str = String(s).trim();
    if (str === "") return null;
    // Python float() accepts ints, decimals, exponents, leading +/-.
    if (!/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(str)) return null;
    var v = parseFloat(str);
    return isNaN(v) ? null : v;
  }

  function pushAll(arr, items) {
    for (var i = 0; i < items.length; i++) arr.push(items[i]);
  }

  // ── convert() pipeline ────────────────────────────────────────────────────
  function convertFloorplanSVG(svgText) {
    // Reset the debug log for this run (keeps the function self-contained).
    if (typeof window !== "undefined") window.__floorplanLog = [];

    var doc = new DOMParser().parseFromString(svgText, "image/svg+xml");
    var root = doc.documentElement;

    // Surface a parse error rather than silently producing garbage.
    if (!root || root.localName === "parsererror" ||
        root.getElementsByTagName("parsererror").length > 0) {
      throw new Error("convertFloorplanSVG: failed to parse SVG input.");
    }

    // Ensure the inkscape namespace is declared on root so prefixed attributes
    // (inkscape:label / inkscape:groupmode) serialize cleanly.
    if (!root.getAttribute("xmlns:inkscape")) {
      root.setAttribute("xmlns:inkscape", INKSCAPE_NS);
    }

    normalizeViewbox(root);
    log("  → ViewBox normalized");

    processColors(root);
    log("  → Colors remapped to GVC palette");

    processStrokeWeights(root);
    log("  → Stroke weights normalized");

    processText(root);
    log("  → Fonts, weights, and text processed");

    stripCubicasaGroups(root);
    log("  → CubiCasa footer stripped");

    stripDimensionMarkers(root);
    log("  → Dimension arrow markers removed");

    stripPureWhiteBlocks(root);
    log("  → Pure white blocks removed");

    fixOpeningFills(root);
    log("  → Door/window opening fills set to none");

    fixStrokeAlignment(root);
    log("  → Stroke alignment fixed (dark fills: stroke removed)");

    processQuoteCharacters(root);
    log("  → Typographic primes applied to dimensions");

    addTextBackgroundBoxes(root);
    log("  → White background boxes added behind text");

    organizeLayers(root);
    log("  → SVG layers organized");

    addGoogleFontsStyle(root);
    log("  → Google Fonts import injected");

    var serialized = new XMLSerializer().serializeToString(doc);
    // Match Python xml_declaration=True.
    return '<?xml version="1.0" encoding="UTF-8"?>\n' + serialized;
  }

  // Expose exactly one global.
  if (typeof window !== "undefined") {
    window.convertFloorplanSVG = convertFloorplanSVG;
  }
})();
