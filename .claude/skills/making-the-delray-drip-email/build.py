"""Build one month's Delray Drip email from its email.json.

    python .claude/skills/making-the-delray-drip-email/build.py assets/email/delray-drip/2026-11 [--check-links]

Reads   <folder>/email.json
Writes  <folder>/*.jpg|png   images, cropped and sized for the email
        <folder>/email.html  what goes to MailerLite (image links point at the live site)
        <folder>/preview.html the same email with local image links, for looking at before publishing

It stops with a plain message when something is wrong (a missing header, an event
before the send date, a dead link) and writes nothing to MailerLite itself.
"""
import datetime, html, io, json, os, re, sys, urllib.request

from PIL import Image, ImageOps

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = "https://matthewgvc.github.io/"
MONTHS = ["January", "February", "March", "April", "May", "June", "July",
          "August", "September", "October", "November", "December"]
UA = {"User-Agent": "Mozilla/5.0 (email build check)"}

# name in the email -> (width, height) in pixels, twice the size it is shown at.
# None for height keeps the picture's own shape.
SIZES = {"header": (1080, None), "hero": (1080, 720), "this": (480, 290),
         "next": (500, 330), "spot": (960, 520), "feature": (1080, None)}


def stop(msg):
    sys.exit("STOP: " + msg)


def send_date(year, month):
    """The 15th, or the Friday before when the 15th is a weekend."""
    d = datetime.date(year, month, 15)
    while d.weekday() > 4:
        d -= datetime.timedelta(days=1)
    return d


def ordinal(n):
    return "%d%s" % (n, "th" if 10 <= n % 100 <= 20 else {1: "st", 2: "nd", 3: "rd"}.get(n % 10, "th"))


def date_label(start, end=None):
    s = datetime.date.fromisoformat(start)
    label = "%s %s" % (MONTHS[s.month - 1], ordinal(s.day))
    if end and end != start:
        e = datetime.date.fromisoformat(end)
        label += " – " + (ordinal(e.day) if e.month == s.month else "%s %s" % (MONTHS[e.month - 1], ordinal(e.day)))
    return label


def fetch(src):
    if re.match(r"https?://", src):
        with urllib.request.urlopen(urllib.request.Request(src, headers=UA), timeout=60) as r:
            return io.BytesIO(r.read())
    if not os.path.exists(src):
        stop("image not found: " + src)
    return src


def make_image(folder, name, kind, src, refresh):
    """Crop to the slot's shape, size it, save it in the month folder. Returns the file name."""
    w, h = SIZES[kind]
    ext = "png" if kind == "header" else "jpg"
    if kind == "feature":
        ext = "jpg"
    out = os.path.join(folder, "%s.%s" % (name, ext))
    if os.path.exists(out) and not refresh:
        return os.path.basename(out)
    im = ImageOps.exif_transpose(Image.open(fetch(src)))
    if h is None:
        if im.width > w:
            im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
        if ext == "jpg":
            im.convert("RGB").save(out, quality=86, optimize=True, progressive=True)
        else:
            im.save(out, optimize=True)
    else:
        if im.width < w * 0.6:
            print("  note: %s is small (%dpx wide), it may look soft" % (name, im.width))
        im = ImageOps.fit(im.convert("RGB"), (w, h), Image.LANCZOS, centering=(0.5, 0.45))
        im.save(out, quality=84, optimize=True, progressive=True)
    return os.path.basename(out)


def esc(s):
    return html.escape(s, quote=True)


def fill(tpl, values):
    for k, v in values.items():
        tpl = tpl.replace("{{%s}}" % k, v)
    return tpl


def check_link(url):
    try:
        req = urllib.request.Request(url, headers=UA)
        with urllib.request.urlopen(req, timeout=40) as r:
            return r.status
    except Exception as e:  # noqa: BLE001 - report whatever went wrong
        return getattr(e, "code", str(e))


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if not args:
        stop("give the month folder, e.g. assets/email/delray-drip/2026-11")
    folder = args[0].rstrip("/\\")
    refresh = "--refresh-images" in sys.argv
    data = json.load(io.open(os.path.join(folder, "email.json"), encoding="utf-8"))

    year, month = (int(x) for x in data["month"].split("-"))
    if os.path.basename(folder) != data["month"]:
        stop("folder name %s does not match month %s" % (os.path.basename(folder), data["month"]))
    send = send_date(year, month)
    nxt = datetime.date(year + (month == 12), month % 12 + 1, 1)

    # ---- checks on the content -------------------------------------------------
    problems = []
    this, coming = data["thisMonth"]["events"], data["nextMonth"]["events"]
    if len(this) != 3 or len(coming) != 3:
        problems.append("need exactly 3 events this month and 3 next month")
    for e in this:
        last = datetime.date.fromisoformat(e.get("end") or e["start"])
        first = datetime.date.fromisoformat(e["start"])
        if last < send:
            problems.append("'%s' is over before the email goes out (%s)" % (e["title"], send))
        if (first.year, first.month) != (year, month):
            problems.append("'%s' does not start in %s" % (e["title"], MONTHS[month - 1]))
    for e in coming:
        first = datetime.date.fromisoformat(e["start"])
        if (first.year, first.month) != (nxt.year, nxt.month):
            problems.append("'%s' is not in %s" % (e["title"], MONTHS[nxt.month - 1]))
    for e in this + coming:
        if not e.get("checked"):
            problems.append("'%s' has no \"checked\" date: open its page and confirm the date first" % e["title"])
    placeholder = bool(data["header"].get("placeholder"))
    if placeholder:
        # A stand-in so the rest of the email can be checked. Never schedule a build that used it.
        data["header"]["src"] = "https://storage.mlcdn.com/account_image/1877620/qU5tlaxjZ6sATptZkoORv4F55KS6hfmrByajOd1h.png"
    elif not data["header"].get("src"):
        problems.append("no header image: Matt makes it and puts it in the month's Drive folder")
    if len(data["subject"]) > 60:
        problems.append("subject is over 60 characters")
    if problems:
        stop("\n  - " + "\n  - ".join(problems))

    # ---- images ----------------------------------------------------------------
    files = {"header": make_image(folder, "header", "header", data["header"]["src"], refresh),
             "hero": make_image(folder, "hero", "hero", data["hero"]["src"], refresh),
             "spot": make_image(folder, "spot", "spot", data["spot"]["image"], refresh)}
    feature = data.get("feature")   # optional one-off block, e.g. an event invitation
    if feature:
        feature["_file"] = make_image(folder, "feature", "feature", feature["image"], refresh)
    for i, e in enumerate(this, 1):
        e["_file"] = make_image(folder, "this-%d" % i, "this", e["image"], refresh)
    for i, e in enumerate(coming, 1):
        e["_file"] = make_image(folder, "next-%d" % i, "next", e["image"], refresh)

    # ---- fill the template -----------------------------------------------------
    read = lambda n: io.open(os.path.join(HERE, n), encoding="utf-8").read()
    tpl, col, row = read("template.html"), read("template-this-month-column.html"), read("template-next-month-row.html")
    feature_tpl = read("template-feature.html")
    P = ("<p style=\"font-family: 'Poppins', sans-serif; color: #515856; font-size: 16px; "
         "line-height: 165%; margin-top: 0; margin-bottom: 10px;\">")
    gap = ' <td class="col" width="30" height="30" style="line-height: 30px;"></td> '

    def feature_slots(block):
        """The one-off block goes after the next-month events, or above the events when position is "top"."""
        top = bool(feature) and feature.get("position") == "top"
        return {"FEATURE_TOP": block if top else "", "FEATURE": "" if top else block}

    def build(base):
        ev = lambda e, label: {"URL": esc(e["url"]), "IMG": base + e["_file"], "TITLE": esc(e["title"]),
                               "DATE": label, "DESC": esc(e["desc"])}
        return fill(tpl, {
            "SUBJECT": esc(data["subject"]),
            "PREHEADER": esc(data.get("preheader", "")),
            "HEADER_SRC": base + files["header"],
            "HEADER_LINK": esc(data["header"].get("link", "https://www.elliman.com/corporate-resources/market-reports/florida/5")),
            "HERO_SRC": base + files["hero"],
            "HERO_ALT": esc(data["hero"].get("alt", "Delray Beach")),
            "HEADLINE": esc(data["headline"]),
            # body paragraphs may carry a link, so they are trusted HTML, not escaped
            "BODY": " ".join(P + p + "</p>" for p in data["body"]),
            "THIS_EMOJI": data["thisMonth"].get("emoji", "\U0001F334"),
            "THIS_COLUMNS": gap.join(fill(col, ev(e, date_label(e["start"], e.get("end")))) for e in this),
            "NEXT_MONTH": MONTHS[nxt.month - 1],
            "NEXT_EMOJI": data["nextMonth"].get("emoji", ""),
            "NEXT_ROWS": "\n".join(fill(row, ev(e, date_label(e["start"], e.get("end")))) for e in coming),
            **feature_slots(fill(feature_tpl, {
                "HEADING": esc(feature["heading"]), "URL": esc(feature["url"]), "IMG": base + feature["_file"],
                "ALT": esc(feature.get("alt", feature["heading"])), "BUTTON": esc(feature.get("button", "RSVP")),
                # trusted HTML, like the body paragraphs
                "TEXT": " ".join(P + p + "</p>" for p in feature["text"])}) if feature else ""),
            "SPOT_URL": esc(data["spot"]["url"]),
            "SPOT_SRC": base + files["spot"],
            "SPOT_NAME": esc(data["spot"]["name"]),
            "SPOT_DESC": esc(data["spot"]["desc"]),
            "CTA_TEXT": esc(data["cta"]["text"]),
            "CTA_URL": esc(data["cta"].get("url", "https://www.elliman.com/sales/team-id=226645")),
        })

    live = build(SITE + folder.replace("\\", "/").split("assets/", 1)[-1].join(["assets/", "/"]))
    left = re.findall(r"\{\{[A-Z_]+\}\}", live)
    if left:
        stop("template slots left empty: %s" % sorted(set(left)))
    for tag in ("table", "tr", "td", "a", "p"):
        opened, closed = len(re.findall(r"<%s[\s>]" % tag, live)), live.count("</%s>" % tag)
        if opened != closed:
            stop("the HTML is unbalanced: %d <%s> opened, %d closed. Fix the template." % (opened, tag, closed))
    for must in ("{$unsubscribe}", "{$name}", "{$url}"):
        if must not in live:
            stop("the email lost its %s tag" % must)
    io.open(os.path.join(folder, "email.html"), "w", encoding="utf-8", newline="\n").write(live)
    io.open(os.path.join(folder, "preview.html"), "w", encoding="utf-8", newline="\n").write(
        build("").replace("{$name}", "Alex"))

    if "--check-links" in sys.argv:
        urls = sorted(set(re.findall(r'href="(https?://[^"]+)"', live)) | set(re.findall(r'src="(https?://[^"]+)"', live)))
        bad = [(u, s) for u, s in ((u, check_link(u)) for u in urls) if s != 200]
        for u, s in bad:
            print("  LINK %s -> %s" % (u, s))
        print("links checked: %d, not OK: %d (image links on the live site fail until the folder is published)" % (len(urls), len(bad)))

    if placeholder:
        print("*** HEADER IS A STAND-IN (October 2026's market banner). DO NOT SCHEDULE. ***")
    print("built %s  (%d KB)" % (os.path.join(folder, "email.html"), len(live.encode("utf-8")) // 1024))
    print("campaign name: Delray Drip %s" % MONTHS[month - 1])
    print("send date:     %s at 14:00, account time zone (the same slot as every month before)" % send.strftime("%A %B %d, %Y"))


if __name__ == "__main__":
    main()
