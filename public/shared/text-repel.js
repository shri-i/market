// Text Repel — vanilla port of Componentry's <TextRepel>. Letters spring away from
// (or toward) the cursor. Usage: <h1 data-text-repel data-radius="120" data-strength="45"
// data-mode="repel|attract">…</h1>. Nested markup like <br> and <span class="italic"> is kept.
(function () {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const DEFAULTS = { radius: 120, strength: 45, mode: 'repel', stiffness: 180, damping: 14, mass: 0.4 };

  function splitLetters(root) {
    const letters = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) if (walker.currentNode.textContent.trim()) nodes.push(walker.currentNode);

    nodes.forEach(node => {
      const frag = document.createDocumentFragment();
      // Keep words together so lines never break mid-word
      node.textContent.replace(/\s+/g, ' ').split(/( )/).forEach(part => {
        if (!part) return;
        if (part === ' ') { frag.appendChild(document.createTextNode(' ')); return; }
        const word = document.createElement('span');
        word.style.cssText = 'display:inline-block;white-space:nowrap';
        [...part].forEach(ch => {
          const s = document.createElement('span');
          s.textContent = ch;
          s.setAttribute('aria-hidden', 'true');
          s.style.cssText = 'display:inline-block;will-change:transform';
          word.appendChild(s);
          letters.push({ el: s, ox: 0, oy: 0, x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0 });
        });
        frag.appendChild(word);
      });
      node.replaceWith(frag);
    });
    return letters;
  }

  function init(root) {
    const opt = {
      ...DEFAULTS,
      ...Object.fromEntries(['radius', 'strength', 'stiffness', 'damping', 'mass']
        .filter(k => root.dataset[k]).map(k => [k, Number(root.dataset[k])])),
      mode: root.dataset.mode || DEFAULTS.mode,
    };
    root.setAttribute('aria-label', root.textContent.replace(/\s+/g, ' ').trim());
    root.style.cursor = 'default';
    root.style.userSelect = 'none';
    const letters = splitLetters(root);
    let mouse = null;
    let running = false;
    let last = 0;

    // Resting centre of each letter relative to the container (transforms excluded)
    const capture = () => {
      const cr = root.getBoundingClientRect();
      letters.forEach(l => {
        const r = l.el.getBoundingClientRect();
        l.ox = r.left - cr.left + r.width / 2 - l.x;
        l.oy = r.top - cr.top + r.height / 2 - l.y;
      });
    };

    const setTargets = () => {
      const dir = opt.mode === 'attract' ? -1 : 1;
      letters.forEach(l => {
        l.tx = l.ty = 0;
        if (!mouse) return;
        const dx = l.ox - mouse.x, dy = l.oy - mouse.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 0 && dist < opt.radius) {
          const force = (1 - dist / opt.radius) ** 2 * opt.strength; // quadratic falloff
          const angle = Math.atan2(dy, dx);
          l.tx = Math.cos(angle) * force * dir;
          l.ty = Math.sin(angle) * force * dir;
        }
      });
    };

    const tick = now => {
      const dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;
      let moving = false;
      // Damped spring per axis, sub-stepped for stability
      for (let i = 0; i < 4; i++) {
        const h = dt / 4;
        letters.forEach(l => {
          const ax = (-opt.stiffness * (l.x - l.tx) - opt.damping * l.vx) / opt.mass;
          const ay = (-opt.stiffness * (l.y - l.ty) - opt.damping * l.vy) / opt.mass;
          l.vx += ax * h; l.vy += ay * h;
          l.x += l.vx * h; l.y += l.vy * h;
        });
      }
      letters.forEach(l => {
        if (Math.abs(l.x - l.tx) > 0.05 || Math.abs(l.y - l.ty) > 0.05 || Math.abs(l.vx) > 0.05 || Math.abs(l.vy) > 0.05) moving = true;
        l.el.style.transform = `translate(${l.x.toFixed(2)}px, ${l.y.toFixed(2)}px) rotate(${(l.x * 0.3).toFixed(2)}deg)`;
      });
      if (moving || mouse) requestAnimationFrame(tick);
      else running = false;
    };

    const kick = () => {
      if (running) return;
      running = true;
      last = performance.now();
      requestAnimationFrame(tick);
    };

    root.addEventListener('pointerenter', capture);
    root.addEventListener('pointermove', e => {
      const r = root.getBoundingClientRect();
      mouse = { x: e.clientX - r.left, y: e.clientY - r.top };
      setTargets();
      kick();
    });
    root.addEventListener('pointerleave', () => {
      mouse = null;
      setTargets();
      kick();
    });
    window.addEventListener('resize', capture);
    requestAnimationFrame(capture);
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-text-repel]').forEach(init);
  });
})();
