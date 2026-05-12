# RevRack Exchange

Private invite-only marketplace for institutional AI hardware transactions.

## Tech stack

- **Frontend**: Vanilla HTML/CSS/JS — no build step, deploys directly to GitHub Pages
- **Database / inventory**: Airtable (REST API via Personal Access Token)
- **Auth**: Session-based with Airtable `Members` table (upgrade path to any JWT auth provider)
- **Hosting**: GitHub Pages (free, fast, custom domain ready)
- **CI/CD**: GitHub Actions injects secrets at deploy time

---

## Repository structure

```
revrack-exchange/
├── index.html                    ← Public landing page
├── assets/
│   ├── css/main.css              ← All styles
│   ├── js/main.js                ← Auth, Airtable API, helpers
│   ├── js/config.js              ← Auto-generated at deploy (gitignored)
│   └── img/
│       └── favicon.svg
├── pages/
│   ├── login.html                ← Sign in (email + 2FA)
│   ├── apply.html                ← Invite request form
│   ├── buyer.html                ← Buyer portal (auth required)
│   ├── seller.html               ← Seller portal (auth required)
│   ├── admin.html                ← Admin portal (admin role required)
│   ├── product.html              ← Product detail page
│   ├── my-rfqs.html              ← Buyer RFQ history
│   ├── profile.html              ← Member profile & NDA docs
│   ├── privacy.html
│   ├── terms.html
│   └── security.html
├── api/
│   └── webhooks.md               ← Webhook docs for email triggers
└── .github/
    └── workflows/
        └── deploy.yml            ← GitHub Actions deploy pipeline
```

---

## Setup guide

### 1. Clone and push to GitHub

```bash
git init
git add .
git commit -m "Initial RevRack Exchange"
git remote add origin https://github.com/YOUR_USERNAME/revrack-exchange.git
git push -u origin main
```

### 2. Create the Airtable base

Create a new base called **RevRack Exchange** with these tables:

#### `Products` table
| Field | Type | Notes |
|-------|------|-------|
| Name | Single line text | |
| Category | Single select | GPU, Rack, Networking, Storage |
| Condition | Single select | New, Refurb, Used |
| Quantity | Number | |
| UnitPrice | Currency | USD |
| TotalValue | Formula | `{Quantity} * {UnitPrice}` |
| Location | Single line text | City, State |
| Status | Single select | Available, Low stock, Pending Review, Pending, Sold, Rejected |
| SellerEmail | Email | |
| SellerCompany | Single line text | |
| Notes | Long text | |
| CreatedAt | Created time | |

#### `Applications` table
| Field | Type |
|-------|------|
| Name | Single line text |
| Email | Email |
| Company | Single line text |
| Title | Single line text |
| Role | Single select: Buyer, Seller, Both |
| DealSize | Single select |
| Message | Long text |
| Referral | Single line text |
| Status | Single select: Pending, Approved, Rejected |
| NDAAccepted | Checkbox |
| SubmittedAt | Created time |
| ApprovedAt | Date |
| ApprovedBy | Single line text |

#### `Members` table
| Field | Type |
|-------|------|
| Name | Single line text |
| Email | Email |
| Company | Single line text |
| Role | Single select: buyer, seller, admin |
| Status | Single select: Active, Suspended |
| PasswordHash | Single line text | (use bcrypt via backend) |
| JoinedAt | Created time |

#### `RFQs` table
| Field | Type |
|-------|------|
| ProductID | Single line text |
| BuyerEmail | Email |
| BuyerCompany | Single line text |
| Quantity | Number |
| TargetPrice | Currency |
| Notes | Long text |
| Status | Single select: Submitted, Responded, Closed |
| SubmittedAt | Created time |

### 3. Get your Airtable credentials

1. Go to https://airtable.com/create/tokens
2. Create a Personal Access Token with scopes: `data.records:read`, `data.records:write`
3. Copy your **Base ID** from the URL: `airtable.com/BASE_ID/...`

### 4. Add GitHub secrets

In your repo: **Settings → Secrets and variables → Actions → New repository secret**

| Secret name | Value |
|-------------|-------|
| `AIRTABLE_BASE_ID` | Your base ID (starts with `app...`) |
| `AIRTABLE_PAT_TOKEN` | Your Personal Access Token |

### 5. Enable GitHub Pages

1. Go to **Settings → Pages**
2. Source: **GitHub Actions**
3. Push to `main` — it will deploy automatically

### 6. Set up custom domain (optional)

1. In GitHub Pages settings, add your custom domain: `exchange.revrack.ai`
2. Add a CNAME record in your DNS: `exchange.revrack.ai → YOUR_USERNAME.github.io`
3. Enable **Enforce HTTPS**

---

## Authentication upgrade path

The current auth uses Airtable as a user store (good for MVP, NOT for production passwords).

**Recommended upgrade: JWT-based auth provider**

```js
// In main.js, replace fetchMember() with:
const { data, error } = await authProvider.signInWithPassword({ email, password })
```

A dedicated auth provider gives you: proper password hashing, JWT tokens, magic links, 2FA, and row-level security.

---

## Email notifications

When an application is approved (admin clicks Approve), trigger an invite email using:
- **Airtable Automations** → "When record updated" → Send email
- **Make.com** webhook watching the Applications table
- **Resend** or **SendGrid** via a Cloudflare Worker

---

## Security checklist

- [ ] Airtable PAT token stored in GitHub secrets only (never in code)
- [ ] `config.js` in `.gitignore`
- [ ] `noindex, nofollow` on all portal pages
- [ ] HTTPS enforced on GitHub Pages
- [ ] Session expires after 8 hours
- [ ] Role-based access enforced client-side (upgrade to server-side with a dedicated auth provider)
- [ ] NDA accepted on application
- [ ] Audit log for admin actions (wire to Airtable `AuditLog` table)

---

## Local development

Since this is a static site, just open `index.html` in a browser. For Airtable to work locally:

```bash
# Create a local config file (gitignored)
cat > assets/js/config.js << 'EOF'
window.RR_AIRTABLE_BASE  = "YOUR_BASE_ID";
window.RR_AIRTABLE_TOKEN = "YOUR_PAT_TOKEN";
EOF
```

Then add to `.gitignore`:
```
assets/js/config.js
```

Serve locally with:
```bash
npx serve .
# or
python3 -m http.server 8080
```

---

## Contact

exchange@revrack.ai · security@revrack.ai
