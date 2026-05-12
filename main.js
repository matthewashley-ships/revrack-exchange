/* ============================================================
   RevRack Exchange — Main JS
   Auth guards, Airtable API, session management
   ============================================================ */

// ── Config ──────────────────────────────────────────────────
// These values are injected at deploy time via GitHub Actions secrets
// or set manually in config.js (which is gitignored)
const CONFIG = {
  AIRTABLE_BASE_ID: window.RR_AIRTABLE_BASE || 'YOUR_BASE_ID',
  AIRTABLE_TOKEN:   window.RR_AIRTABLE_TOKEN || 'YOUR_PAT_TOKEN',
  AIRTABLE_TABLE:   'Products',
  SESSION_KEY:      'rr_session',
  SESSION_DURATION: 8 * 60 * 60 * 1000, // 8 hours
};

// ── Session helpers ──────────────────────────────────────────
const Session = {
  get() {
    try {
      const raw = sessionStorage.getItem(CONFIG.SESSION_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (Date.now() > s.expires) { this.clear(); return null; }
      return s;
    } catch { return null; }
  },
  set(data) {
    const s = { ...data, expires: Date.now() + CONFIG.SESSION_DURATION };
    sessionStorage.setItem(CONFIG.SESSION_KEY, JSON.stringify(s));
  },
  clear() {
    sessionStorage.removeItem(CONFIG.SESSION_KEY);
  },
  isLoggedIn() { return !!this.get(); },
  role() { return this.get()?.role || null; },
};

// ── Auth guard — call on protected pages ────────────────────
function requireAuth(requiredRole) {
  const session = Session.get();
  if (!session) {
    window.location.href = '/pages/login.html?redirect=' + encodeURIComponent(window.location.pathname);
    return false;
  }
  if (requiredRole && session.role !== requiredRole && session.role !== 'admin') {
    window.location.href = '/pages/unauthorized.html';
    return false;
  }
  return true;
}

// ── Airtable API wrapper ─────────────────────────────────────
const Airtable = {
  baseUrl() {
    return `https://api.airtable.com/v0/${CONFIG.AIRTABLE_BASE_ID}/${CONFIG.AIRTABLE_TABLE}`;
  },
  headers() {
    return {
      'Authorization': `Bearer ${CONFIG.AIRTABLE_TOKEN}`,
      'Content-Type': 'application/json',
    };
  },

  async getProducts(filters = {}) {
    let url = this.baseUrl() + '?sort[0][field]=CreatedAt&sort[0][direction]=desc';
    if (filters.category && filters.category !== 'All') {
      url += `&filterByFormula={Category}="${filters.category}"`;
    }
    if (filters.status) {
      url += `&filterByFormula={Status}="${filters.status}"`;
    }
    const res = await fetch(url, { headers: this.headers() });
    if (!res.ok) throw new Error('Airtable fetch failed: ' + res.status);
    const data = await res.json();
    return data.records.map(r => ({ id: r.id, ...r.fields }));
  },

  async getProduct(id) {
    const res = await fetch(`${this.baseUrl()}/${id}`, { headers: this.headers() });
    if (!res.ok) throw new Error('Product not found');
    const r = await res.json();
    return { id: r.id, ...r.fields };
  },

  async createProduct(fields) {
    const res = await fetch(this.baseUrl(), {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ fields }),
    });
    if (!res.ok) throw new Error('Failed to create listing');
    return res.json();
  },

  async updateProduct(id, fields) {
    const res = await fetch(`${this.baseUrl()}/${id}`, {
      method: 'PATCH',
      headers: this.headers(),
      body: JSON.stringify({ fields }),
    });
    if (!res.ok) throw new Error('Failed to update listing');
    return res.json();
  },

  async submitRFQ(rfqData) {
    const RFQ_TABLE = `https://api.airtable.com/v0/${CONFIG.AIRTABLE_BASE_ID}/RFQs`;
    const res = await fetch(RFQ_TABLE, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ fields: rfqData }),
    });
    if (!res.ok) throw new Error('Failed to submit RFQ');
    return res.json();
  },

  async submitApplication(appData) {
    const APP_TABLE = `https://api.airtable.com/v0/${CONFIG.AIRTABLE_BASE_ID}/Applications`;
    const res = await fetch(APP_TABLE, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ fields: appData }),
    });
    if (!res.ok) throw new Error('Failed to submit application');
    return res.json();
  },
};

// ── Product table renderer ───────────────────────────────────
function renderProductTable(products, containerId, options = {}) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!products.length) {
    container.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:32px;color:#444;">No listings found</td></tr>';
    return;
  }

  container.innerHTML = products.map(p => `
    <tr class="product-row" data-id="${p.id}" style="cursor:pointer">
      <td class="td-name">${escHtml(p.Name || '')}</td>
      <td><span class="badge ${categoryClass(p.Category)}">${escHtml(p.Category || '')}</span></td>
      <td class="mono">${p.Quantity ?? '—'}</td>
      <td class="td-price mono">${formatCurrency(p.UnitPrice)}</td>
      <td class="td-price mono">${formatCurrency(p.TotalValue)}</td>
      <td>${escHtml(p.Condition || '')}</td>
      <td>${escHtml(p.Location || '')}</td>
      <td><span class="status ${statusClass(p.Status)}">${escHtml(p.Status || '')}</span></td>
      ${options.showActions ? `<td><button class="filter-btn rfq-btn" data-id="${p.id}">RFQ</button></td>` : ''}
    </tr>
  `).join('');

  // Row click → product detail
  container.querySelectorAll('.product-row').forEach(row => {
    row.addEventListener('click', (e) => {
      if (e.target.classList.contains('rfq-btn')) return;
      const id = row.dataset.id;
      window.location.href = `/pages/product.html?id=${id}`;
    });
  });

  // RFQ buttons
  if (options.showActions) {
    container.querySelectorAll('.rfq-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        openRFQModal(btn.dataset.id);
      });
    });
  }
}

// ── RFQ modal ────────────────────────────────────────────────
function openRFQModal(productId) {
  const modal = document.getElementById('rfqModal');
  if (!modal) return;
  modal.dataset.productId = productId;
  modal.style.display = 'flex';
}

function closeRFQModal() {
  const modal = document.getElementById('rfqModal');
  if (modal) modal.style.display = 'none';
}

// ── Category / status helpers ────────────────────────────────
function categoryClass(cat) {
  const map = { 'GPU': 'gpu', 'Networking': 'net', 'Rack': 'rack', 'Storage': 'storage' };
  return map[cat] || 'gpu';
}
function statusClass(status) {
  const map = { 'Available': 'avail', 'Low stock': 'low', 'Pending': 'pending', 'Sold': 'low' };
  return map[status] || 'avail';
}

// ── Format helpers ───────────────────────────────────────────
function formatCurrency(val) {
  if (!val && val !== 0) return '—';
  if (val >= 1000000) return '$' + (val / 1000000).toFixed(2) + 'M';
  if (val >= 1000) return '$' + (val / 1000).toFixed(0) + 'K';
  return '$' + Number(val).toLocaleString();
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Filter buttons ───────────────────────────────────────────
function initFilterButtons(onFilter) {
  document.querySelectorAll('.filter-btn[data-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn[data-filter]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      onFilter(btn.dataset.filter);
    });
  });
}

// ── Sign out ─────────────────────────────────────────────────
function signOut() {
  Session.clear();
  window.location.href = '/index.html';
}

// ── Page init ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Sign out links
  document.querySelectorAll('[data-action="signout"]').forEach(el => {
    el.addEventListener('click', signOut);
  });

  // Mobile nav toggle
  const toggle = document.querySelector('.nav-mobile-toggle');
  const navLinks = document.querySelector('.nav-links');
  if (toggle && navLinks) {
    toggle.addEventListener('click', () => navLinks.classList.toggle('open'));
  }

  // Close modal on backdrop click
  document.querySelectorAll('.modal-backdrop').forEach(m => {
    m.addEventListener('click', (e) => {
      if (e.target === m) m.style.display = 'none';
    });
  });
});

// Export for use in page scripts
window.RR = { Session, Airtable, requireAuth, renderProductTable, formatCurrency, initFilterButtons, openRFQModal, closeRFQModal, escHtml };
