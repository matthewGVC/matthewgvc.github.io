# CLAUDE.md — How to help a GVC teammate work on this project

**You (Claude) are reading this because someone on The GVC Team has this project open and
wants your help changing it.** This file tells you exactly how to get them set up and how to
make changes *safely*. Read the whole thing before you run any commands.

---

## 1. Who you are working with — assume zero git experience

The person you are helping is most likely a **real estate professional, not a software
developer.** Treat that as your default unless they tell you otherwise. That means:

- **They may have never used GitHub, Git, a terminal, or a code editor.** They may not even have
  a GitHub account yet. That is completely fine — your job is to do the technical work *for*
  them and explain things in plain English.
- **Never assume they know jargon.** Don't say "rebase onto origin/main." Say "I'm going to grab
  the latest version of the project before we start, so we don't accidentally undo anyone's
  work." Then run the command yourself.
- **You drive the keyboard.** You have a terminal/shell tool — use it. Don't hand them a list of
  commands to type and hope for the best. Run the commands, read the output, and tell them what
  happened in human terms.
- **When in doubt, ask before you act** — especially anything that could affect other people's
  work or the live website (see §7, the Golden Rules).

---

## 2. What this project is (say this to them if they ask)

- It is **GVC Workspace** — Matt Bloomfield's work + tools site for The GVC Team (Douglas Elliman).
- It is a **plain static website** — just HTML, CSS, and JavaScript files. **There is no build
  step, no installation, nothing to compile.** You change a file, refresh the browser, done.
- The code lives on GitHub at: **https://github.com/matthewGVC/matthewgvc.github.io**
- The **live website** is: **https://matthewgvc.github.io**
- ⚠️ **The live site is published straight from the `main` branch.** The moment a change lands on
  `main`, GitHub puts it on the real, public website within about a minute. This is why we are
  strict about git (§7). **`main` is production. Protect it.**
- The headline tool is the **Showsheet Generator** at `tools/showsheet/index.html` — a
  self-contained listing-sheet maker. If the teammate wants to "redesign the showsheet," that is
  almost always the file they mean. See §6.

---

## 3. Step 0 — Look before you leap (run these first, every new machine)

Before walking anyone through setup, **find out what already exists** so you don't reinstall
things or re-clone a repo they already have. Run these and read the results:

```bash
git --version          # is Git installed?
gh --version           # is the GitHub CLI installed? (we strongly prefer it — see §4)
gh auth status         # are they signed in to GitHub?
git rev-parse --is-inside-work-tree   # are we already inside the project folder?
git remote -v          # if inside a repo, is it the right one? (expect matthewGVC/...)
```

Decide based on what you find:

- **Already inside the repo, signed in, Git works** → skip setup, go to §5 (the work loop).
- **Git/gh missing, or no account, or repo not cloned** → go to §4 (one-time setup).
- **They only want to look at / tinker with the code locally and NOT publish anything** → they do
  **not** need a GitHub account or push access at all. You can clone read-only, run it locally
  (§6), and make changes on their machine. They only need an account + access when they want
  changes to go **live**.

---

## 4. Step 1 — One-time setup (only do the parts that are missing)

Walk them through these in order. Skip any step that §0 showed is already done.

### 4a. Install Git
- **Windows:** run `winget install --id Git.Git -e` in a terminal, or download from
  https://git-scm.com/download/win and click through the installer (defaults are fine).
- **Mac:** run `git --version` — macOS will offer to install the developer tools. Or
  `brew install git` if they have Homebrew.
- Confirm with `git --version`.

### 4b. Install the GitHub CLI (`gh`) — strongly recommended
This makes signing in and sending changes for review painless for a non-technical user.
- **Windows:** `winget install --id GitHub.cli -e`
- **Mac:** `brew install gh`
- Confirm with `gh --version`.

### 4c. Make a GitHub account (only if they want to publish changes)
- If `gh auth status` says they're not logged in and they don't have an account, send them to
  **https://github.com/signup** and have them create a free account. They pick a username,
  email, and password. That's it.
- Tell them their username so they can give it to Matt (next step).

### 4d. Get permission to push (only if they want to publish changes)
The project belongs to Matt's account (`matthewGVC`). A brand-new account **cannot** push
changes to it until Matt grants access.
- **Have them message Matt:** *"Please add my GitHub username `<their-username>` as a
  collaborator on matthewgvc.github.io."*
- Matt does this once, from the repo's **Settings → Collaborators → Add people**.
- Until that's done, they can still clone and work locally — they just can't publish.

### 4e. Sign in
```bash
gh auth login
```
Choose **GitHub.com → HTTPS → "Login with a web browser"**. It shows a one-time code and opens
the browser; they paste the code and approve. This also configures Git's credentials for them, so
they will never be asked to type a password again.

### 4f. Get the project onto their computer (clone)
Pick a sensible folder first (e.g. their Desktop or Documents), then:
```bash
git clone https://github.com/matthewGVC/matthewgvc.github.io.git
cd matthewgvc.github.io
```
Explain it like this: *"Cloning just means downloading your own personal copy of the project.
Changing it on your computer does nothing to the live website until we deliberately publish."*

### 4g. Confirm it runs (see §6 for how to preview) and you're done with setup.

---

## 5. Step 2 — The work loop (do this EVERY time you make changes)

This is the routine for every editing session. **Follow it in order, every time.** It is what
keeps the live site safe and keeps you from clobbering Matt's work.

1. **Get on `main` and pull the latest.** Never start from stale code.
   ```bash
   git checkout main
   git pull origin main
   ```
   Tell them: *"Grabbing the newest version so we build on top of everyone's latest work."*

2. **Make a branch for this change. Never work directly on `main`.**
   ```bash
   git checkout -b <short-description>
   ```
   Use a clear name: `showsheet-new-colors`, `fix-typo-homepage`, `letter-paper-option`.
   Explain: *"A branch is a safe sandbox copy. Nothing here can affect the live site until it's
   reviewed and merged."*

3. **Make the change.** You (Claude) edit the files. Then **preview locally** (§6) and confirm
   with the teammate that it looks right *before* committing.

4. **Commit in small, clear chunks.** One logical change per commit.
   ```bash
   git add -A
   git commit -m "showsheet: warmer accent palette on the front page"
   ```
   Good messages say *what changed and why*, present tense. No "stuff", "fixes", "asdf".

5. **Push the branch to GitHub.**
   ```bash
   git push -u origin <short-description>
   ```

6. **Open a Pull Request (PR) for Matt to review — do NOT publish it yourself.**
   ```bash
   gh pr create --fill --base main
   ```
   A PR is a "please review and publish this" request. Tell the teammate:
   *"I've sent your change to Matt to review. Once he approves it, it goes live automatically."*
   **Why a PR and not a direct merge:** `main` is the live public site. A second set of eyes
   before publishing is the whole safety net. Unless Matt has *explicitly* told this person they
   may merge to `main` themselves, **stop at the PR and let Matt merge.**

> If Matt *has* said they can publish directly, the only safe way is still: PR → confirm the
> preview looked right → `gh pr merge --squash`. Never push commits straight onto `main`.

---

## 6. Previewing the site locally (so you can SEE changes before publishing)

The site must be viewed through a small local web server — **not** by double-clicking the HTML
file. (Opening it as a `file://` page breaks the Showsheet's sample loader and image handling,
which use `fetch`.)

**You (Claude) start the server yourself** from the project folder. Use whatever is available:
```bash
python -m http.server 8080        # if Python is installed (most common)
# or
npx serve -l 8080                 # if Node.js is installed
```
Then open **http://localhost:8080** in the browser. For the showsheet specifically, open
**http://localhost:8080/tools/showsheet/** and use its on-page **"Load preview — 555 W59th
(sample)"** button to see a fully populated sheet.

If neither Python nor Node is installed and they want to preview, the simplest fix is to install
Python from https://www.python.org/downloads/ (check "Add to PATH" during install).

### Adding a photo gallery — Matt's one-command publish
Matt (the repo owner) publishes new property galleries with a single command — **no branch, no
PR, no account switching.** This owner fast path is the one sanctioned exception to §5/§7, for
Matt only; teammates helping with photos still follow §5.

1. Drop the photos into `"<Property Name>/Raw/"` and `"<Property Name>/Edited/"` inside the
   **Personal Photo Editing Project** folder on the Desktop (it sits next to this repo).
2. From this repo run: `python scripts/publish_photos.py`

That script pulls the latest `main`, rebuilds all galleries, commits, and pushes straight to
`main` — live at https://matthewgvc.github.io/photos/ within a minute. To eyeball a gallery
before publishing, run `python scripts/build_photos.py` first, preview via §6's local server,
then run the publish script.

### Redesigning the Showsheet — the most common request
- The entire tool is **one self-contained file:** `tools/showsheet/index.html` (HTML + CSS +
  JavaScript all inside it). Everything you need to restyle it is in that file.
- It outputs a two-sided listing sheet and can print to **A5 or US Letter** (there's a paper-size
  toggle under the preview).
- Typical loop: edit `tools/showsheet/index.html` → refresh `localhost:8080/tools/showsheet/`
  → click "Load preview" → check it → repeat. Then follow §5 to commit and send for review.
- The print layout is a fixed **11in-wide design canvas**; A5 prints it scaled down, Letter prints
  it at full size. If you change page geometry, test **both** paper sizes via the toggle, and use
  the browser's Print dialog → "Save as PDF" to confirm the printed result, not just the screen.

---

## 7. 🚦 Golden Rules — the strict version-control guardrails

These are not optional. They exist because **`main` is the live website for a real business.**

**ALWAYS:**
- ✅ `git pull origin main` **before** you start anything. Stale code causes conflicts and lost work.
- ✅ Do all work on a **branch**, never on `main`.
- ✅ Keep one change = one branch = one PR. Small and focused.
- ✅ Preview locally and get the teammate's OK **before** committing.
- ✅ Write clear commit messages: what changed and why.
- ✅ Send changes via a **Pull Request** and let Matt merge, unless he's explicitly said otherwise.

**NEVER:**
- ❌ **Never `git push` directly to `main`.** That publishes instantly with no review.
- ❌ **Never force-push** (`git push --force` / `-f`). It can erase other people's work permanently.
- ❌ **Never `git reset --hard`, `git rebase`, `git clean -fd`, or delete branches** to "fix" a
  mess unless you are 100% certain — these throw work away. When unsure, **stop**.
- ❌ Never commit passwords, API keys, client personal data, or huge files/photos that aren't
  meant for the site.
- ❌ Never commit broken code to a branch you're about to ask Matt to publish. If the preview
  looks wrong, fix it first.

**IF ANYTHING LOOKS SCARY — STOP.** If Git prints the words *conflict*, *detached HEAD*,
*rejected*, *diverged*, *merge*, or anything you're not certain about: **do not improvise and do
not run destructive commands.** Explain to the teammate in plain words what happened, and tell
them: *"Let's check with Matt before we go further so we don't risk anyone's work."* Then pause.

---

## 8. Plain-English glossary (for explaining to the teammate)

- **Repository / repo** — the project folder, tracked by Git. Your downloaded copy is a "clone."
- **Clone** — your personal copy on your computer. Editing it does nothing to the live site.
- **Branch** — a safe sandbox copy where you make changes without touching the live version.
- **Commit** — a saved snapshot of your changes, with a short note describing them.
- **Push** — upload your committed changes to GitHub.
- **Pull** — download the latest changes from GitHub so you're up to date.
- **Pull Request (PR)** — a "please review and publish my changes" request that Matt approves.
- **`main`** — the official branch. **It is the live website.** Treat it as untouchable except
  through reviewed Pull Requests.

---

## 9. Quick reference — a normal session, start to finish

```bash
# 1. start fresh
git checkout main
git pull origin main

# 2. make a sandbox branch
git checkout -b showsheet-redesign

# 3. (Claude edits files; start a local server and preview)
python -m http.server 8080        # view at http://localhost:8080

# 4. save the work
git add -A
git commit -m "showsheet: refreshed cover layout and typography"

# 5. send it up and request review
git push -u origin showsheet-redesign
gh pr create --fill --base main
# → tell the teammate it's been sent to Matt to review & publish.
```

When the PR is merged by Matt, the change is live at https://matthewgvc.github.io within ~1 min.
