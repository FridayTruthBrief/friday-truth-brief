# Friday Truth Brief

Local-preview static site for **Cory Brewer**: an evidence-first Friday briefing of the week’s top political stories—known facts with citations, misrepresentations, and narrative/spin analysis.

UI is **inspired by X’s clean reader UX** (light/dark, compact cards). **Not affiliated with X** or any platform.

> **Current edition** (`data/edition-2026-09-05.json`) is a researched editorial prototype for Labor Day week 2026 (`isDemo: false`). A fictional layout demo remains at `data/edition-2026-09-05-demo.json` and is listed in the Archive. Banner text updates from the edition JSON.

## Open locally

Requires a simple HTTP server (the page loads JSON via `fetch`).

```bash
cd /workspace/friday-truth-brief
python3 -m http.server 8765
```

Then open: [http://127.0.0.1:8765/](http://127.0.0.1:8765/)


## Progressive Web App (PWA)

Installable **once the site is on public HTTPS**. Code is ready locally:

- `manifest.webmanifest` — name “Friday Truth Brief”, short_name “Truth Brief”, theme `#1d9bf0`, background `#000000`, `display: standalone`, `start_url: /`
- `sw.js` — caches HTML/CSS/JS/icons; **network-first** for edition JSON when online, cache fallback offline
- Registered from `js/app.js`; Apple touch / `theme-color` meta on all HTML pages
- Icons under `icons/` (`icon-192.png`, `icon-512.png`, `apple-touch-icon.png`)

### Honest limitations

| Expectation | Reality |
|-------------|---------|
| “Install on my phone from localhost” | **No.** Phones generally cannot Add to Home Screen / Install from your laptop’s `http://127.0.0.1`. |
| Local HTTP for desktop testing | **Yes.** `python3 -m http.server 8765` is enough to test the SW in Chrome DevTools (Application → Service Workers / Manifest). |
| Install on iOS / Android | Needs a **public HTTPS** origin (or trusted tunnel). Then Safari Share → Add to Home Screen, or Chrome Install. |
| App Store / Play Store app | **This is not one.** It is a website that can install as a PWA shortcut after hosting. |

Theme toggle and existing features keep working with or without the service worker.

## Theme

- Header sun/moon toggle sets `data-theme` on `<html>`
- Preference stored in `localStorage` key `ftb-theme` (`light` | `dark`)
- Default: system `prefers-color-scheme` (inline head script avoids flash)

## Sponsored bar (placeholder)

A slim rotating sponsor rail (`#ad-rail`) appears on the homepage (under Methodology) and on story pages (after Narratives, before Ask Grok). Data from `data/ads.json`; UI labeled **Sponsored** / **Placeholder — not live ads**. Rotates every 5s via `initAdRotator()` in `js/app.js`. No payments or live ad network.

## File layout

```
friday-truth-brief/
├── index.html                 # Homepage: methodology + sponsor rail + Top 10
├── story.html                 # Story detail (?id=slug)
├── archive.html               # Past editions
├── css/styles.css             # X-inspired light/dark stylesheet
├── js/app.js                  # Theme toggle, edition loader, ad rotator, SW register
├── data/edition-2026-09-05.json       # current researched edition
├── data/edition-2026-09-05-demo.json  # archived fictional sample
├── data/ads.json              # placeholder sponsor feed for the rotator
├── manifest.webmanifest       # PWA manifest
├── sw.js                      # Service worker (shell + edition cache)
├── icons/                     # PNG icons 192 / 512 + apple-touch
├── PITCH.md                   # One-pager pitch (to X; independent)
├── PITCH-THREAD.txt           # Short X-thread version
├── DEMO-60S.md                # 60s screen-recording script
└── README.md
```

## Data schema

Each Friday edition is a JSON file under `data/`:

```json
{
  "editionDate": "YYYY-MM-DD",
  "title": "...",
  "isDemo": true,
  "methodology": "short paragraph",
  "stories": [{
    "rank": 1,
    "id": "slug",
    "title": "...",
    "summary": "...",
    "tags": ["Congress"],
    "overview": "...",
    "knownFacts": [{
      "claim": "...",
      "evidence": "...",
      "sources": [{"name": "...", "url": "https://example.com/...", "date": "YYYY-MM-DD"}]
    }],
    "misrepresentations": [{
      "outlet": "...",
      "pieceTitle": "...",
      "pieceUrl": "https://example.com/...",
      "claimMade": "...",
      "whyInaccurate": "...",
      "severity": "misleading"
    }],
    "narratives": [{
      "type": "headline",
      "description": "...",
      "example": "...",
      "howItMisleads": "..."
    }]
  }]
}
```

- **severity**: `misleading` | `false` | `omission`
- **narratives.type**: `headline` | `image` | `framing` | `channel_presentation` | `selective_emphasis`
- Use `https://example.com/...` for demo URLs
- Set `isDemo: false` only for genuinely researched editions; the UI hides Demo chips and softens the banner

## Add a new Friday edition

1. Copy `data/edition-2026-09-05.json` to `data/edition-YYYY-MM-DD.json` (use that Friday’s date).
2. Update `editionDate`, `title`, methodology if needed, and all ten stories.
3. Point the app at the new file: in `js/app.js`, set `EDITION_PATH` to the new filename.
4. Append an entry to the `ARCHIVE` array in `js/app.js`.
5. Refresh the browser.

## Tone

Evidence-first, not partisan ranting. Call out spin on any side when the record supports it. Never present synthetic demo stories as live journalism.
