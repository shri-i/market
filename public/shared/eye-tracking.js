// Eye Tracking — vanilla port of Componentry's <EyeTracking>. Eyes follow the cursor,
// blink, dilate with proximity and drift when idle.
// Usage: <div data-eye-tracking data-size="120" data-gap="40" data-count="2"
//          data-variant="realistic|cartoon|minimal|cyber" data-iris="#4A6741"
//          data-iris-secondary="#6B8F62" data-pupil="#0a0a0a" data-sclera="#F5F0EB"
//          data-range="0.7" data-blink="4000"></div>
(function () {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const eyes = [];
  let running = false;

  const track = (x, y) => { mouse.x = x; mouse.y = y; };
  window.addEventListener('mousemove', e => track(e.clientX, e.clientY), { passive: true });
  window.addEventListener('touchmove', e => e.touches[0] && track(e.touches[0].clientX, e.touches[0].clientY), { passive: true });

  // Idle micro-movements when the cursor hasn't moved for a while
  let lastX = mouse.x, lastY = mouse.y, idleTimer = null;
  setInterval(() => {
    const idle = mouse.x === lastX && mouse.y === lastY;
    if (idle && !idleTimer && !reduceMotion) {
      idleTimer = setInterval(() => {
        const cx = mouse.x, cy = mouse.y;
        mouse.x = cx + (Math.random() - 0.5) * 30;
        mouse.y = cy + (Math.random() - 0.5) * 30;
        setTimeout(() => { mouse.x = cx; mouse.y = cy; lastX = cx; lastY = cy; }, 500);
      }, 2000);
    } else if (!idle && idleTimer) {
      clearInterval(idleTimer);
      idleTimer = null;
    }
    lastX = mouse.x; lastY = mouse.y;
  }, 3000);

  function el(tag, style, parent) {
    const node = document.createElement(tag);
    Object.assign(node.style, style);
    if (parent) parent.appendChild(node);
    return node;
  }

  function buildEye(o) {
    const w = o.size, h = o.size * (o.variant === 'cartoon' ? 1 : 0.85);
    const iris = o.size * 0.45, pupil = iris * 0.5;
    const cyber = o.variant === 'cyber';

    const eye = el('div', {
      position: 'relative', overflow: 'hidden', width: w + 'px', height: h + 'px', borderRadius: '50%',
      background: o.variant === 'realistic'
        ? `radial-gradient(circle at 35% 35%, ${o.sclera} 0%, ${o.sclera}ee 60%, ${o.sclera}cc 100%)`
        : cyber ? 'radial-gradient(circle at 50% 50%, #0a0a1a 0%, #111128 100%)' : o.sclera,
      boxShadow: {
        realistic: 'inset 0 2px 8px rgba(0,0,0,0.15), inset 0 -1px 4px rgba(0,0,0,0.05), 0 4px 20px rgba(0,0,0,0.1)',
        cyber: 'inset 0 0 30px rgba(0,200,255,0.1), 0 0 20px rgba(0,200,255,0.15)',
        cartoon: 'inset 0 4px 12px rgba(0,0,0,0.1), 0 6px 24px rgba(0,0,0,0.15)',
        minimal: '0 2px 10px rgba(0,0,0,0.1)',
      }[o.variant],
      border: cyber ? '1px solid rgba(6,182,212,0.3)' : 'none',
      transition: 'transform 0.1s ease-in-out',
    });
    eye.setAttribute('aria-hidden', 'true');

    if (o.variant === 'realistic') {
      const veins = el('div', { position: 'absolute', inset: '0', overflow: 'hidden', borderRadius: '50%', opacity: '0.07' }, eye);
      for (let i = 0; i < 6; i++) el('div', {
        position: 'absolute', background: '#ef4444', width: '1px', height: o.size * 0.4 + 'px',
        left: 20 + i * 12 + '%', top: 10 + (i % 3) * 15 + '%', transform: `rotate(${-30 + i * 20}deg)`,
        opacity: String(0.3 + Math.random() * 0.4),
      }, veins);
    }

    const irisEl = el('div', {
      position: 'absolute', width: iris + 'px', height: iris + 'px', borderRadius: '50%',
      left: w / 2 - iris / 2 + 'px', top: h / 2 - iris / 2 + 'px', willChange: 'transform',
      background: cyber
        ? `conic-gradient(from 0deg, ${o.iris}, ${o.iris2}, ${o.iris})`
        : `radial-gradient(circle at 40% 40%, ${o.iris2}, ${o.iris} 60%, ${o.iris}dd 100%)`,
      boxShadow: o.variant === 'realistic' ? 'inset 0 2px 6px rgba(0,0,0,0.3), 0 0 0 1px rgba(0,0,0,0.1)'
        : cyber ? `0 0 15px ${o.iris}66, inset 0 0 10px ${o.iris}33` : 'inset 0 1px 4px rgba(0,0,0,0.2)',
    }, eye);

    let detail = null;
    if (o.irisDetail) {
      detail = el('div', { position: 'absolute', inset: '0', borderRadius: '50%', overflow: 'hidden' }, irisEl);
      const spoke = (deg, bg, opacity) => el('div', {
        position: 'absolute', left: '50%', top: '50%', transformOrigin: 'left', width: iris * 0.45 + 'px',
        height: '1px', background: bg, transform: `rotate(${deg}deg)`, opacity: String(opacity),
      }, detail);
      if (cyber) {
        el('div', { position: 'absolute', inset: '15%', borderRadius: '50%', border: `1px dashed ${o.iris}`, opacity: '0.4' }, detail);
        el('div', { position: 'absolute', inset: '30%', borderRadius: '50%', border: `1px solid ${o.iris2}`, opacity: '0.3' }, detail);
        for (let i = 0; i < 8; i++) spoke(i * 45, o.iris, 0.25);
      } else {
        for (let i = 0; i < 24; i++) spoke(i * 15, `linear-gradient(to right, transparent 20%, ${o.iris}44 50%, transparent 80%)`, 0.3 + (i % 3) * 0.15);
        el('div', { position: 'absolute', inset: '20%', borderRadius: '50%', border: `1px solid ${o.iris}33` }, detail);
      }
    }

    const pupilEl = el('div', {
      position: 'absolute', borderRadius: '50%', width: pupil + 'px', height: pupil + 'px',
      left: iris / 2 - pupil / 2 + 'px', top: iris / 2 - pupil / 2 + 'px',
      background: cyber ? `radial-gradient(circle, ${o.pupil} 40%, transparent 100%)` : o.pupil,
      boxShadow: cyber ? `0 0 10px ${o.iris}88` : 'none', transition: 'transform 0.3s ease-out',
    }, irisEl);

    if (o.reflection) {
      el('div', {
        position: 'absolute', borderRadius: '50%', width: pupil * 0.35 + 'px', height: pupil * 0.35 + 'px',
        left: iris * 0.3 + 'px', top: iris * 0.25 + 'px', filter: 'blur(0.5px)',
        background: cyber ? 'radial-gradient(circle, rgba(0,255,255,0.9), transparent)'
          : 'radial-gradient(circle, rgba(255,255,255,0.95), rgba(255,255,255,0.6))',
      }, irisEl);
      el('div', {
        position: 'absolute', borderRadius: '50%', width: pupil * 0.15 + 'px', height: pupil * 0.15 + 'px',
        left: iris * 0.58 + 'px', top: iris * 0.6 + 'px', background: cyber ? 'rgba(0,255,255,0.5)' : 'rgba(255,255,255,0.7)',
      }, irisEl);
    }

    if (o.eyelids && o.variant !== 'minimal') {
      el('div', {
        position: 'absolute', left: '0', right: '0', top: '0', height: h * 0.35 + 'px', pointerEvents: 'none', borderRadius: '50% 50% 0 0',
        background: cyber ? 'linear-gradient(to bottom, rgba(0,10,30,0.6) 0%, transparent 100%)' : 'linear-gradient(to bottom, rgba(0,0,0,0.08) 0%, transparent 100%)',
      }, eye);
      el('div', {
        position: 'absolute', left: '0', right: '0', bottom: '0', height: h * 0.2 + 'px', pointerEvents: 'none', borderRadius: '0 0 50% 50%',
        background: cyber ? 'linear-gradient(to top, rgba(0,10,30,0.4) 0%, transparent 100%)' : 'linear-gradient(to top, rgba(0,0,0,0.04) 0%, transparent 100%)',
      }, eye);
    }

    if (cyber && !reduceMotion) {
      const scan = el('div', { position: 'absolute', left: '0', right: '0', height: '2px', pointerEvents: 'none', background: `linear-gradient(to right, transparent, ${o.iris}44, transparent)` }, eye);
      scan.animate([{ top: '0px' }, { top: h + 'px' }, { top: '0px' }], { duration: 3000, iterations: Infinity });
    }

    if (o.blink > 0) {
      const blink = () => {
        eye.style.transform = 'scaleY(0.05)';
        setTimeout(() => { eye.style.transform = 'scaleY(1)'; }, 150);
      };
      setTimeout(() => { blink(); setInterval(blink, o.blink + Math.random() * 1000); }, Math.random() * 200);
    }

    return {
      eye, irisEl, pupilEl, detail, o,
      maxOffset: (o.size / 2 - iris / 2) * o.range,
      x: 0, y: 0, vx: 0, vy: 0, visible: true,
    };
  }

  // Spring constants from the original (stiffness 300, damping 25, mass 0.5)
  const K = 300, C = 25, M = 0.5;
  let last = 0;
  function tick(now) {
    const dt = Math.min((now - last) / 1000, 1 / 30);
    last = now;
    eyes.forEach(e => {
      if (!e.visible) return;
      const r = e.eye.getBoundingClientRect();
      const dx = mouse.x - (r.left + r.width / 2);
      const dy = mouse.y - (r.top + r.height / 2);
      const dist = Math.hypot(dx, dy);
      const angle = Math.atan2(dy, dx);
      const offset = (Math.min(dist, e.maxOffset * 3) / (e.maxOffset * 3)) * e.maxOffset;
      const tx = Math.cos(angle) * offset, ty = Math.sin(angle) * offset;
      for (let i = 0; i < 4; i++) {
        const h = dt / 4;
        e.vx += ((-K * (e.x - tx) - C * e.vx) / M) * h;
        e.vy += ((-K * (e.y - ty) - C * e.vy) / M) * h;
        e.x += e.vx * h; e.y += e.vy * h;
      }
      e.irisEl.style.transform = `translate(${e.x.toFixed(2)}px, ${e.y.toFixed(2)}px)`;
      if (e.detail) e.detail.style.transform = `rotate(${((e.x / e.maxOffset) * 15).toFixed(2)}deg)`;
      if (e.o.reactive) {
        const scale = dist < 200 ? 1.3 - (dist / 200) * 0.3 : 0.85 + (Math.min(dist, 800) / 800) * 0.15;
        e.pupilEl.style.transform = `scale(${scale.toFixed(3)})`;
      }
    });
    if (eyes.some(e => e.visible)) requestAnimationFrame(tick);
    else running = false;
  }
  function start() {
    if (running) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(tick);
  }

  function init(root) {
    const d = root.dataset;
    const variant = d.variant || 'realistic';
    const cyber = variant === 'cyber';
    const o = {
      size: Number(d.size) || 120,
      gap: Number(d.gap ?? 40),
      count: Number(d.count) || 2,
      variant,
      iris: d.iris || (cyber ? '#00d4ff' : '#4A6741'),
      iris2: d.irisSecondary || (cyber ? '#0088ff' : '#6B8F62'),
      pupil: d.pupil || (cyber ? '#001122' : '#0a0a0a'),
      sclera: d.sclera || (cyber ? '#0a0a1a' : '#F5F0EB'),
      range: Number(d.range ?? 0.7),
      blink: reduceMotion ? 0 : Number(d.blink ?? 4000),
      reflection: d.reflection !== 'false',
      irisDetail: d.irisDetail !== 'false',
      reactive: d.reactive !== 'false',
      eyelids: d.eyelids !== 'false',
    };
    Object.assign(root.style, { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: o.gap + 'px' });
    const group = [];
    for (let i = 0; i < o.count; i++) {
      const e = buildEye(o);
      root.appendChild(e.eye);
      group.push(e);
      eyes.push(e);
    }
    // Only animate while on screen
    new IntersectionObserver(([entry]) => {
      group.forEach(e => { e.visible = entry.isIntersecting; });
      if (entry.isIntersecting) start();
    }).observe(root);
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-eye-tracking]').forEach(init);
  });
})();
