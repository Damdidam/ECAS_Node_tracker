# EU Login — Node Rotation Tracker

Monitors which EU Login IDP node is currently master. **Zero infrastructure** — everything runs on GitHub.

## How it works

```
GitHub Actions (cron 3x/day)
     │
     ▼
  Fetch https://webgate.ec.europa.eu/cas/
     │
     ▼
  Parse footer: "9.14.7-i068 | 3 ms"
     │                │          │
     │                │          └─ Page generation time
     │                └─ Active node → idt183068
     └─ CAS version
     │
     ▼
  Append to data/rotation-history.json
     │
     ▼
  git commit + push (the JSON IS the database)
     │
     ▼
  GitHub Pages auto-deploys the dashboard
```

**No server. No database. No hosting. Just a GitHub repo.**

## Node mapping

| Footer ID | Hostname    | Label  |
|-----------|-------------|--------|
| `i067`    | idt183067   | IDT067 |
| `i068`    | idt183068   | IDT068 |
| `i069`    | idt183069   | IDT069 |

## Setup

### 1. Create the repo

```bash
git clone https://github.com/<your-username>/ECAS_Node_tracker.git
cd ECAS_Node_tracker
git push -u origin main
```

### 2. Enable GitHub Pages

Go to **Settings → Pages → Source** → select **GitHub Actions**.

### 3. (Optional) Set the EU Login URL

If different from the default, go to **Settings → Secrets and variables → Actions → Variables** and add:

| Name          | Value                                      |
|---------------|--------------------------------------------|
| `EULOGIN_URL` | `https://webgate.ec.europa.eu/cas/`        |

### 4. First poll

Go to **Actions → "Poll EU Login Node"** → **Run workflow** → click **Run**.

### 5. Done

Your dashboard is live at: `https://<your-username>.github.io/ECAS_Node_tracker/`

Polls run automatically Mon–Fri at 07:00, 13:00, 19:00 UTC.

## Project structure

```
ECAS_Node_tracker/
├── .github/workflows/
│   ├── poll.yml          # Cron: fetch EU Login, commit JSON
│   └── deploy.yml        # Auto-deploy dashboard to GitHub Pages
├── scripts/
│   ├── poll.js           # Polling & parsing logic
│   └── seed.js           # Generate demo data for testing
├── public/
│   └── index.html        # Dashboard (single-file, vanilla JS)
├── data/
│   └── rotation-history.json  # The "database" (committed to git)
├── package.json
└── .gitignore
```

## Dashboard features

- **Current status** — active node, CAS version, response time
- **Alert banner** — warning when same node is master > 7 days
- **Timeline** — color-coded grid of the last 21 days
- **Gantt** — visual master periods over time
- **Stats** — master distribution + avg response time per node
- **Log** — full history with failover detection

## Customization

### Change polling schedule

Edit `.github/workflows/poll.yml`:

```yaml
schedule:
  - cron: '0 7,13,19 * * 1-5'   # Weekdays at 07h, 13h, 19h UTC
```

### Change footer parsing

Edit `scripts/poll.js`, function `parseFooter()`. Current regex:

```
/(\d+\.\d+\.\d+(?:\.\d+)?)\s*-\s*(i\d{3})\s*\|\s*(\d+)\s*ms/i
```

### Add a node

Edit `NODE_MAP` in both `scripts/poll.js` and `public/index.html`.

## FAQ

**Q: How much does this cost?**
Nothing. GitHub Actions free tier gives 2,000 min/month. Each poll takes ~30 seconds. At 3 polls/day × 22 workdays = ~33 minutes/month.

**Q: What if the page format changes?**
The poll will log a `PARSE_ERROR`. Adjust the regex in `scripts/poll.js`.

**Q: Can I trigger a manual poll?**
Yes — go to Actions → "Poll EU Login Node" → Run workflow.

**Q: How big will the JSON get?**
At 3 polls/day × 260 workdays/year ≈ 780 records/year ≈ ~150 KB. Negligible.
