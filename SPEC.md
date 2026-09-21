# Quill

A personal writing app in the style of Ulysses, for one person (Alex). It is a front end for a folder of plain Markdown (`.md`) files in Dropbox. It runs as a home-screen web app on iPhone, iPad and Mac.

Status: **approved 2026-09-21.** Next: phase 0 (setup).

## Goals

- Write creative pieces and essays (no books) in plain Markdown that looks good while typing.
- Pick up on any device where the last one left off.
- Own the files. Any other app that opens `.md` files can read them.
- Never lose or overwrite writing.

## Not doing

ePub export, Word export, daily writing goals, a theme editor, drag-to-reorder sheets, native iPhone/Mac apps, accounts, App Store, or any use by other people.

## Writing experience

- Markdown is typed directly. Symbols such as `#` and `**` stay visible but faded, and headings, bold and italic are styled as you type.
- A formatting toolbar and keyboard shortcuts insert the Markdown for you: bold, italic, heading levels, quote, list, link. Shortcuts on Mac and iPad keyboards: ⌘B, ⌘I, ⌘1–⌘3 and similar. On iPhone the toolbar sits just above the on-screen keyboard.
- Focus mode: one shortcut or tap hides everything except the text.
- Live word count, shown when asked for.
- No separate preview. The PDF export shows the finished look.
- Text column about 65–70 characters wide.

## Library

The layout follows Ulysses: **Library → sheet list → editor**.

### How it maps to Dropbox

The app can only reach its own folder, `Dropbox/Apps/Quill Writer/`. ("Quill" was already taken on Dropbox, for both the app name and the folder name, so Dropbox knows it as "Quill Writer". Everywhere else the app is called Quill.)

```
Dropbox/Apps/Quill Writer/
├── Essays/                        ← a group ("book") = a folder
│   ├── _Notes.md                  ← notes for the whole group (hidden from the list)
│   ├── On Walking.md              ← a sheet = a .md file
│   ├── On Walking.notes.md        ← notes for that sheet (hidden from the list)
│   └── Stories/                   ← groups can be nested
│       └── The Lighthouse.md
├── _Trash/                        ← deleted sheets go here, shown as "Trash"
└── _quill/                        ← the app's own files
    ├── settings.json              ← word goals and other app settings
    └── backups/                   ← safety copies (see Safety)
```

### Sheets

- The sheet list shows each sheet as a card: its title in bold, then 2–3 lines of preview text.
- **Title** is the sheet's first line, with any `#` removed, as in Ulysses.
- **File name:** a new sheet starts as `Untitled 2026-09-21 1432.md`. The first time you leave it, the app renames the file once to match the first line. After that the app never renames it on its own. You can rename it by hand. If you later change the first line, the list shows the new title and the file keeps its old name.
- Lists sort by last edited, with a switch to sort by name. For a fixed order, name files "01 …", "02 …".

### Notes

- Each sheet can have one notes file (`<sheet name>.notes.md`), and each group one (`_Notes.md`).
- A notes file holds **as many notes as you like**. Each note starts with its own heading (`## Character ideas`). The app shows each one as a separate card that you can add, edit or delete. In Dropbox it's still one tidy file.
- Notes files are hidden from the sheet list. Sheets that have notes show a paperclip.
- Notes are never included in exports.

## Sync

- **Local first.** Every change is saved on the device immediately, then sent to Dropbox once you pause typing for a couple of seconds.
- **Offline.** You can open, write and create sheets with no signal. Changes are sent when you're back online and the app is open. (iPhone doesn't let web apps sync in the background.)
- **Unsynced indicator.** A small dot shows while changes are still waiting on the device.
- **Checking for changes:** when the app opens, when you switch back to it, and about once a minute while it's open.
- **Never saves over a newer version.** Each save tells Dropbox "only save this if the file is still the version I started from." If it isn't, nothing is overwritten.
- **Conflicts:** when a sheet changed on two devices, both versions are kept. Your device's version is saved as `The Lighthouse (conflict, iPhone, Sep 21).md` next to the original, and a banner on the sheet says a conflicting copy exists. You compare them and move the unwanted one to Trash.

## Safety

These rules are part of version 1 and are not settings:

1. **Nothing is ever truly deleted.** Deleting moves a sheet (and its notes) to `_Trash/`. Dropbox also keeps its own deleted files and version history for at least 30 days.
2. **No blind overwrites** (see Sync).
3. **Blanking guard.** If a save would shrink a sheet from a lot of text to almost nothing, the old version is first copied to `_quill/backups/`.
4. **Files you didn't edit are never touched.** No renaming, reformatting or rewriting, apart from the one-time rename of a new sheet.
5. **Your own backup.** Settings has "Download everything as .zip".

## Design

- Layout like Ulysses (the look of icons and fonts doesn't need to match):
  - **Mac and iPad landscape:** three columns (Library, sheet list, editor). One shortcut hides the first two.
  - **iPad portrait:** two columns (sheet list, editor), with the Library slid in from the side.
  - **iPhone:** one screen at a time. Tap a group, then a sheet. Swipe back.
- Light and dark themes, following the device setting, with a manual override.
- Writing fonts: 3 choices (a serif, a sans-serif, a typewriter-style font), with adjustable text size and line spacing.

## Tech stack

Each piece in plain language.

| Piece | Choice | What it does and why |
|---|---|---|
| Language | **TypeScript** | JavaScript with built-in checks that catch many mistakes before the app runs. It matters most in the sync code, where bugs could cost writing. |
| Screens | **React** | A widely used toolkit for building screens from reusable parts (sidebar, sheet card, editor). Well documented, easy to maintain. |
| Build tool | **Vite** | Turns the source code into the small set of files the website serves. Also runs the app on your Mac while it's being worked on. |
| Editor | **CodeMirror 6** | A proven text editor component that works on phones. It lets us fade the Markdown symbols and style headings as you type. |
| On-device storage | **IndexedDB** (browser's built-in database) | Keeps a copy of every sheet, plus unsynced changes, on each device. This is what makes offline writing possible. The app asks the browser to treat this storage as permanent. |
| Dropbox connection | **Official Dropbox JavaScript SDK** | Reads, writes, moves and lists files. Login uses Dropbox's secure sign-in for apps without a server (called PKCE), so no password or secret is ever stored in the code. |
| Offline app | **Service worker** (via `vite-plugin-pwa`) | Stores the app itself on the device so it opens without a signal and can be added to the home screen. |
| PDF export | **Print styles + the browser's "Save as PDF"** | Each PDF style is one small design file, so more can be added later. Exporting is meant for the Mac (and iPad if it works there). The iPhone doesn't need to export. |
| Zip backup | **fflate** | A small library that packs all your files into one .zip. |
| Tests | **Vitest** | Automatic checks, mainly for sync and safety: conflicts, offline saves, the blanking guard. Run before every release. |
| Hosting | **GitHub Pages**, published by **GitHub Actions** | Same as MicroHabitGarden: commit, click **Push origin** in GitHub Desktop, and a GitHub robot builds and publishes the site in a minute or two. The code is public; your writing never goes to GitHub. |

## Setup, step by step

Done during phase 0, with Claude guiding each step.

### 1. Register the app with Dropbox ✅ done 2026-09-21

Registered as **Quill Writer**, owned by the Personal account, App folder access, Development status.
- App key: `6k1n5w6asnatzen` (safe to be public; the App secret is not used)
- Permissions: `files.metadata.read`, `files.content.read`, `files.content.write`
- Redirect URIs: `https://johnsonafj.github.io/Quill/`, `http://localhost:5173/`
- Settings page: https://www.dropbox.com/developers/apps/info?app_key=6k1n5w6asnatzen

The original steps, for reference:
1. Go to https://www.dropbox.com/developers/apps and sign in with your Dropbox account.
2. Click **Create app**. Choose **Scoped access**, then **App folder**, and enter the name `Quill` (or the nearest available name). For the owning account, always pick **Personal**, never VIP Magazine.
3. On the **Permissions** tab, tick `files.metadata.read`, `files.content.read` and `files.content.write`, then click **Submit**.
4. On the **Settings** tab, under **Redirect URIs**, add `https://johnsonafj.github.io/Quill/` and the local address used for testing on your Mac.
5. Copy the **App key** and give it to Claude. It's safe to be public. Do **not** share the App secret; it isn't needed.
6. Leave the app in "Development" status. That works indefinitely for your own account.

### 2. Create the code repository and turn on hosting
1. In GitHub Desktop, publish the `Quill` folder as a new public repository named `Quill`.
2. On github.com, open the repository → **Settings** → **Pages**, and set **Source** to **GitHub Actions**.

### 3. Install on each device
- **iPhone and iPad:** open `https://johnsonafj.github.io/Quill/` in Safari → Share → **Add to Home Screen**. Open Quill from the home screen, then tap **Connect Dropbox**. Sign in inside the home-screen app, not in Safari, because they keep separate storage.
- **Mac:** open the address in Safari → **File → Add to Dock**. Open it from the Dock and connect Dropbox.

### 4. Move existing writing in
Drag any existing `.md` files or folders into `Dropbox/Apps/Quill Writer/`. (The folder appears the first time Quill connects.)

## Phases

Each phase ends with something you can use on all three devices.

### Phase 0: Setup (in progress)
Done: Dropbox app registered; project created with a setup-check screen (connect Dropbox, show the account, list the folder, write a test sheet); home-screen icon; automatic publishing to GitHub Pages; first tests.
Sign-in tested on the Mac in Chrome 2026-09-21: connected to the Personal account, wrote and read back `Welcome to Quill.md`, and a second write correctly left it alone.
Published and installed on the Mac and iPhone. iPad still to install.

Dropbox app registered, repository and hosting working, an empty Quill installed on iPhone, iPad and Mac that connects to Dropbox and lists the files in its folder.

### Phase 1: Write everywhere (the first real version) (built, testing on devices)
Built 2026-09-21 and checked in Chrome on the Mac at Mac, iPad-portrait and iPhone sizes: typing, formatting shortcuts, new groups, naming a new sheet from its first line, Trash and Put back, light and dark. 34 automatic tests cover sync and safety (offline edits, conflicts on two devices, blanking guard, Trash never replacing a file). Still to check on real devices: the toolbar above the iPhone keyboard, swipe-back, and a real two-device conflict.

- Library with nested groups, sheet list with title and preview cards, sort by last edited or by name.
- Create, rename and delete sheets and groups. Deleting goes to Trash, and Trash is visible in the Library so sheets can be restored.
- Editor with faded Markdown symbols and styled headings, bold and italic.
- Formatting toolbar (including above the iPhone keyboard) and keyboard shortcuts.
- Word count, focus mode.
- Layouts for Mac, iPad (both orientations) and iPhone.
- Light and dark themes, one good default writing font.
- Full sync: local-first saves, offline writing, change checks, the "only if unchanged" save, conflict copies with a banner, unsynced dot.
- All safety rules, including the .zip download.
- Automatic tests for sync and safety.

### Phase 2: Notes, search and comfort
- Notes for sheets and groups, shown as cards, with the paperclip on sheet cards.
- Search across all sheets.
- "All", "Last 7 Days" and "Trash" views at the top of the Library.
- Per-sheet word goals with a progress ring.
- Typewriter mode (current line stays in the middle of the screen).
- Font choices (3), text size and line spacing.

### Phase 3: PDF export
- Export a sheet to PDF with 2–3 styles and a preview before saving. Required on the Mac. iPad is a bonus, and iPhone isn't needed.

### Ongoing
- More PDF styles, added one at a time.

### Maybe someday
Copy as HTML or formatted text, tags (`#tag` style), side-by-side conflict comparison, favorites, images in sheets, custom icons per group, revision mode.

## Working on Quill

- `npm install` once, then `npm run dev` runs the test copy at http://localhost:5173/.
- `npm test` runs the automatic checks. `npm run build` makes the published files (GitHub does this on every push).
- `npm run icons` redraws the home-screen icons in `public/icons/`.

Where things live: `src/sync/engine.ts` is the sync engine (all the safety rules), `src/sync/dropboxRemote.ts` talks to Dropbox, `src/library/tree.ts` turns files into the Library, `src/editor/` is the editor and formatting commands, `src/ui/` is the screens.
