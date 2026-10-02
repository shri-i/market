// Shared Atelier Market enhancements: scroll-reveal animations, scroll progress,
// header scroll state and placeholder-link handling. Loaded by every page.
(function () {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canAnimate = !reduceMotion && 'IntersectionObserver' in window && 'animate' in Element.prototype;
  if (canAnimate) document.documentElement.classList.add('js-reveal');

  document.addEventListener('DOMContentLoaded', () => {
    const page = document.body.dataset.page;

    // ---- Placeholder links (pages that don't exist yet) ----
    document.querySelectorAll('a[href="#"]').forEach(a => {
      a.addEventListener('click', e => {
        e.preventDefault();
        notify('This page is coming soon');
      });
    });

    // ---- Header shadow + scroll progress bar ----
    const header = document.querySelector('header.fixed');
    let bar = null;
    if (!reduceMotion) {
      bar = document.createElement('div');
      bar.className = 'atelier-progress';
      document.body.appendChild(bar);
    }
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (bar) bar.style.transform = `scaleX(${max > 0 ? window.scrollY / max : 0})`;
      if (header) header.classList.toggle('is-scrolled', window.scrollY > 12);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    window.atelierReveal = () => {};
    if (!canAnimate) return;

    // ---- Scroll reveal ----
    const targets = [];
    const tag = (el, index = 0) => {
      if (!el || el.dataset.reveal || isDecorative(el)) return;
      el.dataset.reveal = 'pending';
      el.dataset.revealDelay = Math.min(index, 6) * 90;
      targets.push(el);
    };
    const tagAll = (els, stagger = true) => [...els].forEach((el, i) => tag(el, stagger ? i : 0));

    // Walk a container: grids stagger their items, wrappers holding grids/forms are
    // descended into, everything else is revealed as one block.
    const walk = (container, depth = 0) => {
      let i = 0;
      [...container.children].forEach(child => {
        if (isDecorative(child)) return;
        if (child.matches('.grid, form')) {
          tagAll(child.children);
        } else if (depth < 3 && child.querySelector('.grid, form')) {
          walk(child, depth + 1);
        } else {
          tag(child, i++);
        }
      });
    };

    if (page === 'home') {
      document.querySelectorAll('main section').forEach(section => walk(section));
      const footerGrid = document.querySelector('footer .grid');
      if (footerGrid) tagAll(footerGrid.children);
    } else {
      const form = document.querySelector('main form');
      if (form) walk(form.parentElement);
      if (page === 'sign-in') tagAll(document.querySelectorAll('#hero-visual ~ .relative.z-10'));
      if (page === 'register') {
        const editorial = form && form.closest('.grid') && form.closest('.grid').firstElementChild;
        if (editorial) walk(editorial.firstElementChild || editorial);
      }
      if (page === 'forgot-password' && form) {
        let sib = form.parentElement.nextElementSibling;
        for (; sib; sib = sib.nextElementSibling) sib.matches('.grid') ? tagAll(sib.children) : tag(sib);
      }
    }

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        observer.unobserve(el);
        el.animate(
          [
            { opacity: 0, translate: '0 36px', filter: 'blur(4px)' },
            { opacity: 1, translate: '0 0', filter: 'blur(0)' }
          ],
          {
            duration: 900,
            delay: Number(el.dataset.revealDelay) || 0,
            easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
            fill: 'backwards'
          }
        );
        el.dataset.reveal = 'done';
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    targets.forEach(el => observer.observe(el));

    // Lets pages animate content rendered later (e.g. product cards from the API)
    window.atelierReveal = els => {
      targets.length = 0;
      tagAll(els);
      targets.forEach(el => observer.observe(el));
    };
  });

  function isDecorative(el) {
    if (el.matches('script, style, [aria-hidden="true"], .hidden, .pointer-events-none')) return true;
    const pos = getComputedStyle(el).position;
    return pos === 'absolute' || pos === 'fixed';
  }

  window.atelierNotify = notify;

  // Reuse the home page toast when present; otherwise fall back to a lightweight one.
  function notify(text) {
    const toast = document.getElementById('toast');
    const msg = document.getElementById('toast-message');
    if (toast && msg) {
      msg.textContent = text;
      toast.classList.remove('opacity-0', 'pointer-events-none', 'translate-y-4');
      clearTimeout(notify.t);
      notify.t = setTimeout(() => toast.classList.add('opacity-0', 'pointer-events-none', 'translate-y-4'), 2400);
      return;
    }
    let el = document.getElementById('atelier-notify');
    if (!el) {
      el = document.createElement('div');
      el.id = 'atelier-notify';
      el.style.cssText = 'position:fixed;bottom:2rem;left:50%;transform:translateX(-50%);z-index:60;background:#000;color:#fff;padding:.85rem 1.4rem;border-radius:.75rem;font:13px/20px "Plus Jakarta Sans",sans-serif;box-shadow:0 12px 30px rgba(0,0,0,.2);transition:opacity .3s;opacity:0';
      document.body.appendChild(el);
    }
    el.textContent = text;
    el.style.opacity = '1';
    clearTimeout(notify.t);
    notify.t = setTimeout(() => (el.style.opacity = '0'), 2400);
  }
})();
