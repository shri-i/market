// Connects the static pages to the FastAPI backend: products, bag, wishlist,
// newsletter and the prototype "login" (just a name kept in localStorage).
(function () {
  const USER_KEY = 'atelier_user';

  const Store = {
    user() {
      try {
        const saved = JSON.parse(localStorage.getItem(USER_KEY));
        if (saved && saved.id) return saved;
      } catch (e) { /* storage unavailable */ }
      const guest = { id: 'guest-' + Math.random().toString(36).slice(2, 8), name: 'Guest', guest: true };
      Store.saveUser(guest);
      return guest;
    },
    saveUser(u) {
      try { localStorage.setItem(USER_KEY, JSON.stringify(u)); } catch (e) { /* ignore */ }
    },
    signIn(name, email) {
      Store.saveUser({ id: (email || name).toLowerCase(), name, email });
    },
    signOut() {
      try { localStorage.removeItem(USER_KEY); } catch (e) { /* ignore */ }
    },
    async api(path, options = {}) {
      const res = await fetch('/api' + path, {
        headers: { 'Content-Type': 'application/json' },
        ...options,
        body: options.body ? JSON.stringify(options.body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || 'Request failed');
      return data;
    },
    money: n => '$' + Number(n).toLocaleString('en-US'),
    notify: text => (window.atelierNotify ? window.atelierNotify(text) : alert(text)),
  };
  window.AtelierStore = Store;

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function productCard(p, saved) {
    const badgeColor = p.badge === 'New' ? 'bg-primary text-on-primary' : 'bg-secondary text-on-secondary';
    return `
<div class="product-card group flex flex-col bg-surface rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300" data-id="${p.id}">
  <div class="relative aspect-[3/4] bg-surface-container overflow-hidden">
    ${p.badge ? `<span class="absolute top-4 left-4 z-10 px-2.5 py-1 rounded ${badgeColor} font-label-sm text-[9px] uppercase tracking-widest font-semibold">${esc(p.badge)}</span>` : ''}
    <img class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" alt="${esc(p.name)}" src="${esc(p.image)}"/>
    <button aria-label="Save to Wishlist" data-id="${p.id}" class="wishlist-btn absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-surface/80 backdrop-blur-md flex items-center justify-center ${saved ? 'text-error' : 'text-on-surface'} hover:text-error transition-all shadow-sm">
      <span class="material-symbols-outlined text-[18px]" style="font-variation-settings: 'FILL' ${saved ? 1 : 0};">favorite</span>
    </button>
    <button data-id="${p.id}" class="add-to-bag-btn absolute bottom-0 left-0 right-0 bg-primary text-on-primary py-3.5 px-4 font-label-sm text-label-sm uppercase tracking-[0.16em] flex items-center justify-center gap-2 translate-y-full group-hover:translate-y-0 transition-transform duration-300 hover:bg-secondary" ${p.stock > 0 ? '' : 'disabled'}>
      <span class="material-symbols-outlined text-[18px]">shopping_bag</span>
      <span>${p.stock > 0 ? 'Add to Bag' : 'Sold Out'}</span>
    </button>
  </div>
  <div class="p-6 flex flex-col flex-1">
    <div class="flex items-center justify-between mb-2">
      <span class="font-label-sm text-label-sm uppercase tracking-[0.2em] text-secondary font-semibold">${esc(p.designer)}</span>
      <span class="font-label-sm text-[10px] uppercase text-on-surface-variant">${esc(p.category)}</span>
    </div>
    <h4 class="font-title-md text-title-md text-primary mb-1">${esc(p.name)}</h4>
    <p class="font-body-md text-body-md text-on-surface font-semibold mb-3">${Store.money(p.price)}</p>
    <span class="mt-auto pt-3 border-t border-outline-variant/20 font-label-sm text-[10px] uppercase text-on-surface-variant">${p.stock > 0 ? p.stock + ' in stock' : 'Sold out'}</span>
  </div>
</div>`;
  }
  Store.productCard = productCard;

  async function renderGrid(grid, query, emptyText) {
    if (!grid) return;
    try {
      const [products, wishlist] = await Promise.all([
        Store.api('/products' + query),
        Store.api('/wishlist?user=' + encodeURIComponent(Store.user().id)),
      ]);
      const saved = new Set(wishlist.map(w => w.product.id));
      grid.innerHTML = products.length
        ? products.map(p => productCard(p, saved.has(p.id))).join('')
        : `<p class="col-span-full text-center font-body-md text-on-surface-variant py-12">${emptyText}</p>`;
      if (window.atelierReveal) window.atelierReveal(grid.children);
    } catch (e) {
      console.warn('Backend unavailable, keeping static cards', e);
    }
  }

  async function refreshBagBadge() {
    const link = document.querySelector('a[data-path="cart"][aria-label]');
    if (!link) return;
    try {
      const cart = await Store.api('/cart?user=' + encodeURIComponent(Store.user().id));
      const badge = link.querySelector('span:last-child');
      if (badge) badge.textContent = cart.count;
      const preview = link.nextElementSibling;
      if (!preview) return;
      const [title, total] = preview.querySelectorAll('.border-b span');
      if (title) title.textContent = `Bag Preview (${cart.count})`;
      if (total) total.textContent = Store.money(cart.total);
      const row = preview.querySelector('.flex.gap-space-sm');
      if (row) {
        const first = cart.items[0];
        row.innerHTML = first
          ? `<img src="${esc(first.product.image)}" class="w-12 h-14 object-cover"/><div class="flex-1 min-w-0"><p class="font-label-sm text-label-sm uppercase truncate text-on-surface font-semibold">${esc(first.product.designer)}</p><p class="font-body-sm text-body-sm text-on-surface-variant truncate">${esc(first.product.name)}</p><p class="font-label-sm text-label-sm text-on-surface">Qty: ${first.qty}${cart.items.length > 1 ? ` · +${cart.items.length - 1} more` : ''}</p></div>`
          : '<p class="font-body-sm text-body-sm text-on-surface-variant">Your bag is empty.</p>';
      }
    } catch (e) { /* backend offline */ }
  }
  Store.refreshBagBadge = refreshBagBadge;

  function showSignedInUser() {
    const u = Store.user();
    const join = document.querySelector('a[data-path="join"]');
    if (u.guest || !join) return;
    const box = join.parentElement;
    box.innerHTML = `<span class="text-on-surface py-1">Hi, ${esc(u.name.split(' ')[0])}</span><span class="text-outline-variant">/</span><a href="#" class="text-on-surface-variant hover:text-on-surface transition-colors py-1" id="sign-out">Sign Out</a>`;
    document.getElementById('sign-out').addEventListener('click', e => {
      e.preventDefault();
      e.stopImmediatePropagation();
      Store.signOut();
      location.reload();
    });
  }

  // Delegated product actions (capture phase so the old static-card handlers don't double-fire)
  document.addEventListener('click', async e => {
    const wish = e.target.closest('.wishlist-btn[data-id]');
    const bag = e.target.closest('.add-to-bag-btn[data-id]');
    if (!wish && !bag) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const user = Store.user().id;
    try {
      if (wish) {
        const { saved } = await Store.api('/wishlist/toggle', { method: 'POST', body: { user, product_id: +wish.dataset.id } });
        wish.classList.toggle('text-error', saved);
        wish.classList.toggle('text-on-surface', !saved);
        wish.querySelector('.material-symbols-outlined').style.fontVariationSettings = `'FILL' ${saved ? 1 : 0}`;
        Store.notify(saved ? 'Saved to your private wishlist' : 'Removed from your wishlist');
        document.dispatchEvent(new CustomEvent('atelier:wishlist'));
      } else {
        await Store.api('/cart', { method: 'POST', body: { user, product_id: +bag.dataset.id, qty: 1 } });
        const name = bag.closest('.product-card')?.querySelector('h4')?.textContent || 'Piece';
        Store.notify(`Added "${name}" to your shopping bag`);
        refreshBagBadge();
      }
    } catch (err) {
      Store.notify(err.message);
    }
  }, true);

  // Newsletter forms (capture phase: runs before the page's own handler clears the input)
  document.addEventListener('submit', e => {
    const input = e.target.querySelector('input[type="email"]');
    if (!input || !input.value || (e.target.id !== 'newsletter-form' && !e.target.closest('footer'))) return;
    Store.api('/newsletter', { method: 'POST', body: { email: input.value } }).catch(() => {});
    if (e.target.closest('footer')) {
      e.preventDefault();
      input.value = '';
      Store.notify('Welcome to the Atelier Circle. Check your inbox.');
    }
  }, true);

  document.addEventListener('DOMContentLoaded', () => {
    const page = document.body.dataset.page;

    if (page === 'home') {
      renderGrid(document.getElementById('product-carousel'), '?trending=true', 'No trending pieces yet.');
      renderGrid(document.getElementById('new-arrivals-grid'), '?new=true', 'No new arrivals yet.');
      showSignedInUser();
      refreshBagBadge();

      // Header search → results replace the Trending grid
      const search = document.querySelector('header input[type="search"]');
      if (search) {
        search.addEventListener('keydown', e => {
          if (e.key !== 'Enter') return;
          const q = search.value.trim();
          const heading = document.querySelector('#trending h2');
          if (heading) heading.textContent = q ? `Results for “${q}”` : 'Trending Now';
          renderGrid(document.getElementById('product-carousel'),
            q ? '?q=' + encodeURIComponent(q) : '?trending=true', 'No pieces match your search.');
          document.getElementById('trending').scrollIntoView({ behavior: 'smooth' });
        });
      }
    }

    if (page === 'sign-in') {
      document.getElementById('auth-form').addEventListener('submit', () => {
        const email = document.getElementById('email').value.trim();
        const name = email.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        Store.signIn(name, email);
        const welcome = document.querySelector('#demo-notification .font-body-sm');
        if (welcome) welcome.textContent = `Welcome back, ${name.split(' ')[0]}`;
      });
    }

    if (page === 'register') {
      document.getElementById('atelier-register-form').addEventListener('submit', () => {
        Store.signIn(document.getElementById('reg-fullname').value.trim() || 'Member',
          document.getElementById('reg-email').value.trim());
      });
    }
  });
})();
