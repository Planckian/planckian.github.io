# planckian.github.io

> ### This is the GitHub repo, not the company website.
>
> | | |
> |---|---|
> | **This repo** | <https://planckianq.github.io/> — open-source software, papers and interactive demos |
> | **Company website** | <https://planckian.co> — a separate site, maintained separately |
>
> They are two different properties. Company and product marketing belongs on **planckian.co**;
> this repo is the engineering and research face of **Planckian srl**. Every page here links back
> to planckian.co, and says so in a strip under the header.

A static GitHub Pages site: no build step, no dependencies, no framework. Every `.html` file at
the root is a URL.

---

## Map of the site

### Entry pages

| Page | What it is |
|---|---|
| `index.html` | Homepage — the approach, ArchBuilder, demos, software, contact |
| `architectures.html` | Research hub: the two mechanisms side by side, with the comparison table |
| `papers.html` | All seven papers, with QR codes and blurbs |
| `software.html` | ArchBuilder in detail — the nine tools, the pipeline, install, licence |
| `docs.html` | Documentation index — API references and tutorials |

### Switchable XY · iSWAP routing

| Page | What it is |
|---|---|
| `games.html` | Hub for the five demos below |
| `tutorial.html` | Six-minute written tutorial |
| `swap-from-iswap.html` | 01 · one bond — SWAP from iSWAP and √X |
| `iswap-compiler-line.html` | 02 · a chain — the compiler's chain |
| `global-control-ring.html` | 03 · the ring — the architecture itself |
| `graph-routing.html` | 04 · any lattice — matching-layer routing |
| `lab/viper.html` | 05 · logical qubits — **Viper, passphrase-locked** |

Card 05 is listed on the hub like the others, with a dashed border and a 🔒 PASSPHRASE badge, but
it opens a gate rather than the demo. The demo itself is encrypted — see *The internal pages*.
That means the **existence** of Viper is public while its **content** is not; if even the name
should stay unannounced, remove the card from `games.html` and the three footers, and drop the
counts by one.

### Always-on ZZ · dynamical blockade

| Page | What it is |
|---|---|
| `games-zz.html` | Hub for the two demos below |
| `tutorial-zz.html` | Seven-minute written tutorial |
| `zz-blockade.html` | 01 · two transmons — dynamical blockade, live Schrödinger solve |
| `zz-conveyor.html` | 02 · a driven chain — the blockade conveyor |

### Generated documentation

These directories are **build output** — do not hand-edit them. Regenerate from the source repos
and copy the result in.

| Directory | Source | Built with |
|---|---|---|
| `ArchBuilder/` | `PlanckianQ/Archbuilder` | Sphinx (Furo) |
| `Zhivago/` | `Planckian/Zhivago` | Documenter.jl |

### Shared assets

| Path | What it is |
|---|---|
| `assets/site.css` | Design tokens and page shell for the entry pages |
| `assets/logo.png` | The logo, for pages that link it rather than inlining it |
| `logo.png` | Same image at the old root path, kept so existing links still work |
| `style.css` | Stylesheet for the original 2025 site. Nothing references it any more — safe to delete once you are sure. |

### Sealed and internal

| Path | What it is |
|---|---|
| `lab/upcoming.html` | Upcoming architectures — encrypted, passphrase-gated, linked from nowhere |
| `lab/viper.html` | The Viper demo, encrypted. Linked from `games.html` as card 05 and from `lab/upcoming.html`. |
| `lab/seal.html` | Offline tool for re-sealing either of the two above |
| `hotdesk-booking/` | The office desk-booking tool. Unrelated to the website; see its own README. |

`lab/` and `hotdesk-booking/` are excluded from search engines in `robots.txt`, and the `lab/`
pages also carry `noindex`.

---

## Design

The site has one visual language, defined in `assets/site.css` and mirrored inline in the demo
pages (each demo is a single self-contained file, so it carries its own copy of the tokens):

```
--bg    #0c0d13    page background
--bg2   #141621    cards
--panel #191c2a    inset surfaces
--line  #2a2e42    borders
--txt   #f2f3f8    body text
--dim   #9aa0b8    secondary text
--brand #f7403a    Planckian red
```

Type is **Space Grotesk** for headings, **Inter** for body, **JetBrains Mono** for labels, IDs and
anything numeric. Accents beyond the brand red: `#a78bfa` violet, `#fbbf24` gold, `#34d399` green,
`#60a5fa` blue.

If you add a page, either link `assets/site.css` (entry pages) or copy the `:root` block from an
existing demo (self-contained interactive pages).

---

## The internal pages

Two pages hold unannounced work:

- **`lab/upcoming.html`** — notes on architectures that are not public yet.
- **`lab/viper.html`** — the whole Viper demo: markup, styles and simulation.

Both are AES-256-CBC ciphertext with an HMAC-SHA256 tag over the ciphertext; both keys are
derived from the passphrase with PBKDF2-SHA256 over 250 000 iterations. The browser decrypts
them client-side.

`upcoming.html` is linked from nowhere. `viper.html` is deliberately different: it is linked from
the public games hub as card 05, so anyone can see that it exists and unlock it with the
passphrase. Only its **content** is sealed, not its name.

> **Passphrase: `Pl4nk14n2027`** — the same one for both pages.

### Changing the passphrase, or editing the content

`lab/seal.html` does one page at a time, so changing the passphrase means doing this twice.

1. Open `lab/seal.html` in a browser — double-click it, no server needed.
2. Get the current plaintext: open the sealed page, unlock it, and use **View Source** (or
   re-seal from a copy you keep outside the repo). Never commit the plaintext.
3. Paste the plaintext and the passphrase, click **Seal**, then **Verify it unseals**.
4. Replace the `SEAL = { … }` object in the target page with what it gives you.

It runs entirely offline and makes no network requests.

**What this does and does not do.** It genuinely stops someone who clones the repository from
reading the content. It is *not* access control — there is no server and no accounts, the
passphrase cannot be revoked for one person, and anyone who has had it keeps it. Treat these as
*"not public yet"*, not as *"confidential"*.

### Unlocking Viper for good

The card and all the counts are already in place, so when the preprint is out this is small:

1. Unseal `lab/viper.html` and save the plaintext as `viper-logical-torus.html` at the root.
2. Repoint its paths — `../assets/` → `assets/`, `../index.html` → `index.html`,
   `../games.html` → `games.html` in the back-link and the footer — and drop its `noindex` meta.
3. In `games.html`, change the card's `href` to `viper-logical-torus.html`, remove the `locked`
   class and the `<span class="lock">` badge, and change "Unlock and play" back to "Tap to play".
   Do the same for the three footer links, which say "Viper (locked)".
4. Delete `lab/viper.html` and its entry in `lab/upcoming.html`.

---

## Working on it

There is nothing to install and nothing to build. `.claude/launch.json` just tells the editor how
to start a local preview server; it is not part of the site and can be deleted.

```bash
# edit a file, then open it
start index.html          # Windows
open index.html           # macOS
```

For the pages that load `assets/site.css` over a relative path, a local server avoids any
file:// surprises:

```bash
python -m http.server 8000
```

`.nojekyll` at the root tells GitHub Pages to serve the files as they are, which is what keeps
the `_static/` and `_sources/` directories inside `ArchBuilder/` working.

### Conventions

- **One file per page.** Interactive demos are fully self-contained — inline CSS, inline SVG,
  inline JS, inline logo. That is deliberate: any one of them can be emailed or opened offline.
- **Entry pages share `assets/site.css`.** They are content, not apps, and they should stay
  consistent.
- **Do not edit `ArchBuilder/` or `Zhivago/`.** They are generated; changes will be overwritten.
- **Root filenames are public URLs.** Renaming or moving one breaks any link already shared.
