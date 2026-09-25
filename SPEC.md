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

1. **Deleting is two deliberate steps.** Deleting moves a sheet (and its notes) to `_Trash/`. Quill only removes something for good from Trash, and only when you choose Delete there. Dropbox also keeps its own deleted files and version history for at least 30 days.
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

### Phase 1.5: Notes, comments and selection count (published 2026-09-21)
Checked in Chrome on the Mac with the real Dropbox: adding notes as cards, the paperclip count, the notes file syncing, notes moving to Trash with their sheet, a commented prompt left out of the count and the title, and the selection count. Tests cover reading and writing notes files without disturbing notes you didn't edit.
- Notes for sheets and groups, shown as cards in a panel beside the editor (full screen on iPhone), with the paperclip on sheet cards. Group notes open from the group's ••• menu.
- Comments: `<!-- like this -->` text (for prompts and asides) is faded in the editor and left out of the word count, sheet titles and previews. The toolbar's Comment button (⌘/) wraps or unwraps it. Other Markdown apps hide these too, and exports will leave them out.
- Selection word count: with text selected, the count reads "12 of 1,244 words".
- ⌘L (or Ctrl-L) selects the paragraph the cursor is in; press again to add the next one.
- Notes fold: the arrow beside a note's heading folds it to one line showing its word count. Folding is remembered on each device and never changes the notes file.
- Columns: drag the divider between columns (Library, sheet list, notes) to resize them; double-click a divider to reset it. The button at the top left of the editor steps through all columns → without the Library → just the text. Widths and which columns show are remembered per device.
- iPhone opens on the Library, unless you left in the middle of a sheet, in which case it reopens that sheet.

### Phase 2: Prompts, search and what's new (built 2026-09-22)
- **What's new:** `CHANGELOG.md` is the plain-language log of every update. After an update, each device shows the updates it hasn't seen once; Settings → What's new shows them all. A fresh install shows only the latest. Every publish adds an entry.
- **Prompts:** `_Prompts.md` in the Quill folder, opened from "Prompts" in the Library. One prompt per list line; Quill ticks a prompt and moves it under "## Used" with the date the moment it hands it out, so no device repeats one. Quill seeded it with 230 one-line prompts, then a second batch of 60 with direction (`src/prompts/starter.ts`). A directed prompt is still one list line: `- **Title** — setup. Vibe: … Anchor: … Aim: …`; the Prompts card and the sheet comment show each part on its own line, and directed prompts are handed out before plain ones. new batches added there are merged in once, skipping any already in the file, so deleted or used prompts never return. The ✦ button in a group makes a sheet that starts with a prompt as a comment. The list is only created after Quill has heard from Dropbox, so one device can't overwrite another's.
- **Search** (magnifying glass, ⌥⌘F) across sheets, sheet notes and group notes, every word required, Trash left out. Title matches first. The same key, or Esc, goes back to where you were.
- **Find and replace in a sheet** (⌘F, or ••• → Find and replace): a bar at the top of the sheet highlights every match with a "2 of 5" count; Enter / ⇧Enter step through, Tab goes to Replace, All replaces every match, Aa matches capitals. It can't change sprint-locked text. With no sheet open, ⌘F opens Search.
- **Focus mode** only applies while a sheet is open; with none open (e.g. after deleting it) the sidebars show.
- **All** and **Last 7 Days** in the Library, with each sheet's group shown.
- **Typewriter mode** (••• menu, Mac and iPad) keeps the line you're typing centered.
- Any device now names an "Untitled …" sheet from its first line when you leave it (once), not just the device that made it.

### Phase 3: PDF export (built 2026-09-22)
- ••• → Export PDF… on any sheet. Three styles (`src/export/styles.ts`), Letter paper, fonts bundled with Quill (SIL Open Font License) so they work offline:
  - **Manuscript:** Courier Prime 12 pt, double-spaced, 1" margins; name and contact top left and the word count top right on page 1 (rounded to the nearest hundred by convention, or exact with "Round the word count" turned off); title a third of the way down with "by Name"; header "Surname | Title | N" from page 2; `#` for scene breaks; END at the finish.
  - **Book:** EB Garamond 11.5 pt, justified per paragraph with hyphenation; small-caps title with a thin rule and the author; opening paragraph flush with a small-caps first line, indents after; `⁂` for scene breaks; page numbers bottom centre from page 2.
  - **Essay:** Inter headings over Source Serif 4 11 pt, ragged right, space between paragraphs; big left title with name · date · word count; accent bar on quotes; "N of M" bottom right.
- Paged.js lays out the pages (Safari's own printing can't do page numbers or running headers); Quill starts it itself after the page loads, because its automatic start can miss its moment and wait forever. Paged.js pauses while the window is hidden and carries on when it's shown.
- The sheet's leading heading is the title; otherwise its name is. Comments and notes are never included; HTML typed in a sheet is shown as text, never run.
- Name on exports comes from the Dropbox account until changed; contact details are optional and stored per device only.
- Saving opens the print window (File → Save as PDF). Required on the Mac; iPad is a bonus; iPhone not needed.

### Phase 4: Writing flow and safety nets (built 2026-09-22)
1. **Hotkeys:** ⌘/ with nothing selected comments out the whole paragraph; a keyboard shortcuts list (••• → Keyboard shortcuts); ⌥⌘N starts a new sheet in the Inbox from anywhere.
2. **Quick capture (⌘⇧J):** a small box pops up anywhere in Quill; Return adds the text to the bottom of a "Quick Notes" sheet in the Inbox under the date and time, and you're back where you were. (For a truly system-wide shortcut, Apple's Shortcuts app can append to the same Dropbox file.)
3. **Rewind snapshots:** when a sheet is opened in a new session, a copy is kept on the device; the last 20 per sheet are listed under ••• → Earlier versions with a preview and Restore. Restoring snapshots the current text first.
4. **Folding:** an arrow beside each heading (except the sheet's title on its first line) folds its section away; remembered per device.
5. **Pin a note:** any note card can be pinned; it shows as a slim, read-only, foldable strip at the bottom of the writing area. The pin is saved in the notes file, so every device shows it.
6. **Sprint mode:** everything before the sentence being typed is locked (no clicking or arrowing back into it; backspace stops at the sentence start; the lock only moves forward) and fades, an optional timer (10/15/25 min) and a count of words written in the sprint. Esc or the same shortcut ends it.
7. **Delete permanently:** a Delete button on items in the Trash view, with a confirmation. Quill only ever deletes from Trash, and only when you choose Delete; Dropbox keeps deleted files for 30 more days.

### Phase 5: Cuts and reading aloud (built 2026-09-24)
1. **Set aside (⌘⇧X, or ••• → Set aside):** moves the selection, or the paragraph the cursor is in, out of the sheet and into a cuts file beside it (`The Lighthouse.cuts.md`), newest first under a "## date and time" heading. Hidden from the Library, it follows the sheet when it's renamed or trashed, and it never touches the clipboard. ••• → Cuts lists them with word counts; "Put back here" drops one in at the cursor as its own paragraph and takes it off the list; Delete asks first.
2. **Read to me (••• → Read to me):** the device's own voice (the browser's speech synthesis, offline, no account) reads from the cursor, or just the selection. Comments and Markdown symbols are left unsaid, the text is read in sentence-sized pieces (some browsers give up on long ones), and a bar shows "3 of 12" with Pause and Stop. Esc stops; leaving the sheet stops. The menu item is hidden where the browser can't speak.

### Next up
- Try Quill on real devices: iPhone keyboard toolbar, swipe back, a real two-device conflict, the final Save as PDF step, installing on the iPad.

### Ongoing
- Seasonal themes: **Halloween built 2026-09-25**, deliberately left out of `CHANGELOG.md` until release day so no "What's new" pop-up gives it away. It runs October 15 to November 1 (`SEASONS` in `src/app/season.ts`; change `from` to `[10, 1]` for an October 1 start). Settings → Seasonal look: "When it's time" (the default), "Show me now" (any day, for a look), "Off", and "Not this year" while one is showing. Most of it lands on the frame: deep aubergine sidebars, a still candlelight glow at the top of each, a cobweb masked into the Library's top corner, pumpkin accents and a small 🎃 beside "Library". The writing area only warms a shade (a hint of candle in the paper), which bends the original "never the writing area" rule on purpose, for the mood; nothing anywhere moves, flickers or animates. More seasons go in the same list.

  Release day: paste this at the top of `CHANGELOG.md`, with the date it goes live.

  ```
  ## Oct 15 · 🎃 Quill puts on a costume

  - 🕯️ **Quill is dressed for Halloween.** The Library and the sheet list have gone candle-lit and pumpkin-dark for the rest of October. Your writing area is untouched: same paper, same ink, not a cobweb on your words.
  - 🦇 **Nothing moves, nothing flickers, nothing jumps out at you.** It's a change of light, not a haunted house.
  - 👻 **Not in the mood?** Settings → Seasonal look → "Not this year" puts the costume away until next October, and "Off" retires seasons for good. "Show me now" brings it back any day of the year.
  - 🕸️ It packs itself away on November 1. Happy Halloween — go write something that makes the reader check the locks.
  ```
- More PDF styles, added one at a time.

### Future ideas
- Reordering sections: move a `##` section up or down (e.g. ⌥⌘↑/↓), ideally with sections folded.
- Smart paste: strip invisible characters and odd spacing, turn "•" bullets into "- " (curly quotes left alone).
- Auto-delete Trash items after 60 days (would need the trash date stored where every device can see it, e.g. `_Trash/2026-09-22/…`).
- Font choices, text size and line spacing (the current look is staying for now).
- Word goals for each sheet, with a progress ring.
- A "Writing music" button that opens a chosen playlist in the Spotify or Music app. (A player inside Quill was ruled out: Spotify's web player doesn't work on iPhone or iPad, and Apple Music's needs a $99/year developer membership.)

### Maybe someday
Copy as HTML or formatted text, tags (`#tag` style), side-by-side conflict comparison, favorites, images in sheets, custom icons per group, revision mode.

Source sheets: research or source documents nested under a sheet in the sheet list (Alex sketched them as Source 1, 2, 3 hanging below the sheet card). Likely stored as a folder like `The Backroom of the Shop (sources)/` next to the sheet. Deferred on 2026-09-21: try sources as folding notes in a resizable notes panel first; build this if long research needs the full editor.

## Working on Quill

- `npm install` once, then `npm run dev` runs the test copy at http://localhost:5173/.
- Every publish adds a plain-language entry at the top of `CHANGELOG.md`; that's what the "What's new" pop-up shows.
- `npm test` runs the automatic checks. `npm run build` makes the published files (GitHub does this on every push).
- `npm run icons` rebuilds the home-screen icons in `public/icons/` from `design/quill-icon-square.svg` (Alex's icon, as a full square; the original rounded version and its PNGs are also in `design/`). It needs Google Chrome installed.

Where things live: `src/sync/engine.ts` is the sync engine (all the safety rules), `src/sync/dropboxRemote.ts` talks to Dropbox, `src/library/tree.ts` turns files into the Library, `src/editor/` is the editor and formatting commands, `src/ui/` is the screens.
