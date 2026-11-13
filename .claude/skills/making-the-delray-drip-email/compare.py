"""Check that a MailerLite draft holds exactly what build.py made.

    python .claude/skills/making-the-delray-drip-email/compare.py assets/email/delray-drip/2026-11 <saved result file>

create_campaign, update_campaign and get_campaign answer with the whole campaign, which is too big
to show and is saved to a file instead. Give that file here. MailerLite adds link ids and tidies
spacing; the words, links and pictures must be the same, in the same order.
"""
import html, io, json, re, sys


def words(s):
    s = re.sub(r"<(style|head).*?</>", " ", s, flags=re.S)
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", s))).strip()


def main():
    folder, result = sys.argv[1].rstrip("/\\"), sys.argv[2]
    local = io.open(folder + "/email.html", encoding="utf-8").read()
    d = json.load(io.open(result, encoding="utf-8"))
    stored = d["emails"][0]["content"]
    checks = {
        "words": words(stored) == words(local),
        "links": re.findall(r'href="([^"]+)"', stored) == re.findall(r'href="([^"]+)"', local),
        "pictures": re.findall(r'src="([^"]+)"', stored) == re.findall(r'src="([^"]+)"', local),
    }
    for tag in ("table", "tr", "td"):
        checks["<%s> balanced" % tag] = len(re.findall(r"<%s[\s>]" % tag, stored)) == stored.count("</%s>" % tag)
    print("%s | status %s | scheduled for %s (UTC)" % (d.get("name"), d.get("status"), d.get("scheduled_for")))
    for k, ok in checks.items():
        print("  %-18s %s" % (k, "same" if ok else "DIFFERENT"))
    if not all(checks.values()):
        sys.exit("STOP: the draft does not match the build. Load email.html again.")
    print("the draft matches the build")


if __name__ == "__main__":
    main()
