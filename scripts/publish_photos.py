#!/usr/bin/env python3
"""
One-command photo publish for the repo owner.

Drop photos into "<Property Name>/Raw/" and "<Property Name>/Edited/" in the
Personal Photo Editing Project folder, then run:

    python scripts/publish_photos.py

It pulls the latest site, rebuilds the galleries, commits the result straight
to main, and pushes — live at https://matthewgvc.github.io within a minute.
No branches, no PRs. Any extra arguments (e.g. --force) are passed through to
build_photos.py.
"""
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).parent.parent


def run(*cmd):
    print("+", " ".join(cmd))
    subprocess.run(cmd, cwd=REPO, check=True)


def capture(*cmd) -> str:
    return subprocess.run(
        cmd, cwd=REPO, check=True, capture_output=True, text=True
    ).stdout.strip()


def staged_outside_photos() -> list:
    """Files already staged that are not part of a photo gallery.

    This script commits and pushes to main, which is the live website. A bare
    "git commit" sweeps up whatever else happens to be staged, so anything
    half-finished sitting in the index would go public alongside the photos.
    """
    out = capture("git", "diff", "--cached", "--name-only")
    return [f for f in out.splitlines() if f and not f.startswith("photos/")]


def unpushed_commits() -> list:
    """Commits on local main that origin/main does not have yet.

    "git push origin main" pushes the branch, not just this script's commit,
    so an unrelated commit sitting on main would be published too.
    """
    out = capture("git", "log", "--oneline", "origin/main..HEAD")
    return [c for c in out.splitlines() if c]


def main():
    branch = capture("git", "rev-parse", "--abbrev-ref", "HEAD")
    if branch != "main":
        sys.exit(
            f'You are on branch "{branch}", not main.\n'
            'Run "git checkout main" first, then re-run this script.'
        )

    # Both checks run before any work, so a refusal costs nothing and cannot
    # leave a half-built gallery behind.
    extra = staged_outside_photos()
    if extra:
        listed = "\n".join("    " + f for f in extra[:10])
        more = f"\n    …and {len(extra) - 10} more" if len(extra) > 10 else ""
        sys.exit(
            "There are changes staged that are not photos:\n\n"
            f"{listed}{more}\n\n"
            "This script publishes straight to the live website, so it will not\n"
            'run while something else is waiting to be committed. Run "git reset"\n'
            "to unstage those (it keeps your edits), then re-run this script."
        )

    run("git", "fetch", "origin", "main")
    ahead = unpushed_commits()
    if ahead:
        listed = "\n".join("    " + c for c in ahead[:10])
        more = f"\n    …and {len(ahead) - 10} more" if len(ahead) > 10 else ""
        sys.exit(
            "Your main has commits that are not on GitHub yet:\n\n"
            f"{listed}{more}\n\n"
            "Pushing the photos would publish these to the live website too.\n"
            "Check with Matt about what they are before going further."
        )

    run("git", "pull", "--ff-only", "origin", "main")
    run(sys.executable, str(REPO / "scripts" / "build_photos.py"), *sys.argv[1:])

    if not capture("git", "status", "--porcelain", "photos"):
        print("\nNothing changed — the site already matches your photo folders.")
        return

    # "git add" picks up brand-new galleries, which a path-limited commit on its
    # own would not see; the pathspec on the commit then makes sure nothing but
    # photos goes in, whatever else may have reached the index meanwhile.
    run("git", "add", "photos")
    run("git", "commit", "-m", "photos: update galleries", "--", "photos")
    run("git", "push", "origin", "main")
    print("\nDone — live at https://matthewgvc.github.io/photos/ in about a minute.")


if __name__ == "__main__":
    main()
