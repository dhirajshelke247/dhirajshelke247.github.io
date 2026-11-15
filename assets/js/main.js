(() => {
  'use strict';

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const root = document.documentElement;
  const body = document.body;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canHover = matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ---------- Small helpers ---------- */
  $$('[data-year]').forEach(el => { el.textContent = new Date().getFullYear(); });

  const isMac = /Mac|iPhone|iPad/i.test((navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || navigator.userAgent);
  $$('[data-kbd-mod]').forEach(k => { k.textContent = isMac ? '⌘K' : 'Ctrl K'; });

  const toastEl = $('#toast');
  let toastTimer;
  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2200);
  }

  /* ---------- Email (assembled here so simple scrapers can't read it from the HTML) ---------- */
  const email = body.dataset.emailUser && body.dataset.emailDomain
    ? `${body.dataset.emailUser}@${body.dataset.emailDomain}` : '';
  $$('[data-email-text]').forEach(el => { if (email) el.textContent = email; });

  async function copyEmail() {
    if (!email) return;
    try {
      await navigator.clipboard.writeText(email);
      toast('Email copied to clipboard');
    } catch (e) {
      window.location.href = `mailto:${email}`;
    }
  }
  $$('[data-copy-email]').forEach(btn => btn.addEventListener('click', copyEmail));

  /* ---------- Theme ---------- */
  const themeBtn = $('#theme-toggle');
  const metaTheme = $('meta[name="theme-color"]');
  function syncThemeUI(t) {
    if (metaTheme) metaTheme.setAttribute('content', t === 'light' ? '#f7f7f5' : '#09090b');
    if (themeBtn) themeBtn.setAttribute('aria-label', t === 'light' ? 'Switch to dark theme' : 'Switch to light theme');
  }
  function setTheme(t) {
    root.setAttribute('data-theme', t);
    try { localStorage.setItem('theme', t); } catch (e) { /* storage blocked */ }
    syncThemeUI(t);
  }
  function toggleTheme() {
    const next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    if (!document.startViewTransition || reduced) { setTheme(next); return; }
    const r = themeBtn.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    const end = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    const vt = document.startViewTransition(() => setTheme(next));
    vt.ready.then(() => {
      root.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${end}px at ${x}px ${y}px)`] },
        { duration: 600, easing: 'cubic-bezier(.2,.8,.2,1)', pseudoElement: '::view-transition-new(root)' }
      );
    }).catch(() => {});
  }
  syncThemeUI(root.getAttribute('data-theme'));
  if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

  /* ---------- Hero headline: word-by-word entrance ---------- */
  const title = $('.hero-title');
  if (title) {
    let i = 0;
    [...title.childNodes].forEach(node => {
      if (node.nodeType === Node.TEXT_NODE) {
        const frag = document.createDocumentFragment();
        node.textContent.split(/(\s+)/).forEach(part => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
          const span = document.createElement('span');
          span.className = 'word';
          span.style.setProperty('--i', i++);
          span.textContent = part;
          frag.appendChild(span);
        });
        node.replaceWith(frag);
      } else if (node.nodeType === Node.ELEMENT_NODE && node.tagName !== 'BR') {
        node.classList.add('word');
        node.style.setProperty('--i', i++);
      }
    });
  }

  /* ---------- Reveal on scroll ---------- */
  $$('[data-stagger]').forEach(group => {
    [...group.children].forEach((child, idx) => {
      if (child.classList.contains('reveal')) child.style.setProperty('--d', idx % 4);
    });
  });
  const revealIO = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('in'); revealIO.unobserve(e.target); }
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  $$('.reveal').forEach(el => revealIO.observe(el));

  /* ---------- Count-up numbers ---------- */
  const countIO = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const el = e.target;
      countIO.unobserve(el);
      const end = parseFloat(el.dataset.count);
      if (reduced || document.hidden || Number.isNaN(end)) return;
      const t0 = performance.now();
      const dur = 1400;
      const step = t => {
        const p = Math.min((t - t0) / dur, 1);
        el.textContent = Math.round(end * (1 - Math.pow(1 - p, 4)));
        if (p < 1) requestAnimationFrame(step);
      };
      el.textContent = '0';
      requestAnimationFrame(step);
    });
  }, { threshold: 0.6 });
  $$('[data-count]').forEach(el => countIO.observe(el));

  /* ---------- Local time ---------- */
  const tz = body.dataset.timezone || 'Asia/Kolkata';
  let fmt;
  try { fmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz }); }
  catch (e) { fmt = null; }
  const tick = () => { if (fmt) $$('[data-local-time]').forEach(el => { el.textContent = fmt.format(new Date()); }); };
  tick();
  setInterval(tick, 15000);

  /* ---------- Marquee: duplicate each track for a seamless loop ---------- */
  $$('.marquee').forEach(m => {
    const track = $('.marquee-track', m);
    if (!track) return;
    const clone = track.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    m.appendChild(clone);
  });

  /* ---------- Card spotlight ---------- */
  if (canHover) {
    document.addEventListener('pointermove', e => {
      const card = e.target.closest && e.target.closest('.card');
      if (!card) return;
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${e.clientX - r.left}px`);
      card.style.setProperty('--my', `${e.clientY - r.top}px`);
    }, { passive: true });
  }

  /* ---------- ID card tilt ---------- */
  const idCard = $('#id-card');
  if (idCard && canHover && !reduced) {
    const area = idCard.closest('.hero-visual');
    area.addEventListener('pointermove', e => {
      const r = idCard.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      idCard.style.setProperty('--rx', `${(-py * 10).toFixed(2)}deg`);
      idCard.style.setProperty('--ry', `${(px * 14).toFixed(2)}deg`);
      idCard.style.setProperty('--gx', `${((px + 0.5) * 100).toFixed(1)}%`);
      idCard.style.setProperty('--gy', `${((py + 0.5) * 100).toFixed(1)}%`);
    });
    area.addEventListener('pointerleave', () => {
      idCard.style.setProperty('--rx', '0deg');
      idCard.style.setProperty('--ry', '0deg');
    });
  }

  /* ---------- Nav: active section + sliding indicator ---------- */
  const navLinks = $$('.nav-links a');
  const indicator = $('.nav-indicator');
  function moveIndicator(link) {
    if (!indicator) return;
    if (!link || !link.offsetWidth) { indicator.style.setProperty('--o', 0); return; }
    indicator.style.setProperty('--x', `${link.offsetLeft}px`);
    indicator.style.setProperty('--w', `${link.offsetWidth}px`);
    indicator.style.setProperty('--o', 1);
  }
  const sectionIO = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const hash = `#${e.target.id}`;
      let active = null;
      navLinks.forEach(a => {
        const on = a.getAttribute('href') === hash;
        a.classList.toggle('active', on);
        if (on) { a.setAttribute('aria-current', 'true'); active = a; } else { a.removeAttribute('aria-current'); }
      });
      moveIndicator(active);
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  $$('main section[id]').forEach(s => sectionIO.observe(s));

  /* ---------- Mobile menu ---------- */
  const navWrap = $('.nav-wrap');
  const menuBtn = $('#menu-toggle');
  function setMenu(open) {
    if (!navWrap || !menuBtn) return;
    navWrap.classList.toggle('open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  }
  if (menuBtn) menuBtn.addEventListener('click', () => setMenu(!navWrap.classList.contains('open')));
  const mobileMenu = $('#mobile-menu');
  if (mobileMenu) mobileMenu.addEventListener('click', e => { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('click', e => {
    if (navWrap && navWrap.classList.contains('open') && !navWrap.contains(e.target)) setMenu(false);
  });

  /* ---------- Scroll: progress bar + timeline fill ---------- */
  const progress = $('.progress');
  const timeline = $('.timeline');
  const tlItems = $$('.tl-item');
  let ticking = false;
  function onScroll() {
    ticking = false;
    const max = root.scrollHeight - innerHeight;
    if (progress) progress.style.transform = `scaleX(${max > 0 ? Math.min(scrollY / max, 1) : 0})`;
    if (timeline) {
      const mark = innerHeight * 0.6;
      const r = timeline.getBoundingClientRect();
      const p = Math.min(Math.max((mark - r.top - 30) / Math.max(r.height - 60, 1), 0), 1);
      timeline.style.setProperty('--tl', p.toFixed(4));
      tlItems.forEach(it => it.classList.toggle('lit', it.getBoundingClientRect().top + 34 < mark));
    }
  }
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  addEventListener('resize', () => {
    onScroll();
    moveIndicator(navLinks.find(a => a.classList.contains('active')));
  });
  onScroll();

  /* ---------- Command palette ---------- */
  const dlg = $('#cmdk');
  const input = $('#cmdk-input');
  const list = $('#cmdk-list');
  if (dlg && input && list && typeof dlg.showModal === 'function') {
    const resumeLink = $('[data-resume]');
    const go = hash => {
      const el = $(hash);
      if (el) el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
      history.replaceState(null, '', hash);
    };
    const openLink = url => window.open(url, '_blank', 'noopener');
    const commands = [
      { g: 'Go to', label: 'About', icon: 'user', run: () => go('#about') },
      { g: 'Go to', label: 'Experience', icon: 'briefcase', run: () => go('#experience') },
      { g: 'Go to', label: 'Selected work', icon: 'layers', keys: 'projects', run: () => go('#work') },
      { g: 'Go to', label: 'Skills', icon: 'sparkle', keys: 'tools', run: () => go('#skills') },
      { g: 'Go to', label: 'Education & achievements', icon: 'cap', keys: 'certifications background', run: () => go('#background') },
      { g: 'Go to', label: 'Contact', icon: 'mail', run: () => go('#contact') },
      email && { g: 'Actions', label: 'Copy email address', icon: 'copy', run: copyEmail },
      resumeLink && { g: 'Actions', label: 'Download résumé', icon: 'download', keys: 'resume cv pdf', run: () => resumeLink.click() },
      { g: 'Actions', label: 'Switch theme', icon: 'sun', keys: 'dark light mode', run: toggleTheme },
      body.dataset.linkedin && { g: 'Links', label: 'LinkedIn', icon: 'linkedin', ext: true, run: () => openLink(body.dataset.linkedin) },
      body.dataset.github && { g: 'Links', label: 'GitHub', icon: 'github', ext: true, run: () => openLink(body.dataset.github) },
    ].filter(Boolean);

    let items = commands;
    let sel = 0;
    const icon = id => `<svg class="i" aria-hidden="true"><use href="#i-${id}"/></svg>`;

    function updateSel() {
      $$('.cmdk-item', list).forEach((li, idx) => li.setAttribute('aria-selected', String(idx === sel)));
      const active = $(`#cmdk-${sel}`);
      if (active) { input.setAttribute('aria-activedescendant', active.id); active.scrollIntoView({ block: 'nearest' }); }
      else input.removeAttribute('aria-activedescendant');
    }
    function render() {
      list.innerHTML = '';
      if (!items.length) {
        list.innerHTML = '<li class="cmdk-empty" role="presentation">No results</li>';
        input.removeAttribute('aria-activedescendant');
        return;
      }
      let lastGroup = null;
      items.forEach((c, idx) => {
        if (c.g !== lastGroup) {
          lastGroup = c.g;
          const h = document.createElement('li');
          h.className = 'cmdk-group';
          h.setAttribute('role', 'presentation');
          h.textContent = c.g;
          list.appendChild(h);
        }
        const li = document.createElement('li');
        li.className = 'cmdk-item';
        li.id = `cmdk-${idx}`;
        li.setAttribute('role', 'option');
        li.innerHTML = `${icon(c.icon)}<span></span>${c.ext ? `<span class="hint">${icon('arrow-up-right')}</span>` : ''}`;
        li.querySelector('span').textContent = c.label;
        li.addEventListener('click', () => exec(idx));
        li.addEventListener('pointermove', () => { if (sel !== idx) { sel = idx; updateSel(); } });
        list.appendChild(li);
      });
      updateSel();
    }
    function exec(idx) {
      const c = items[idx];
      if (!c) return;
      closeCmd();
      setTimeout(c.run, 50);
    }
    function openCmd() {
      if (dlg.open) return;
      setMenu(false);
      input.value = '';
      items = commands;
      sel = 0;
      render();
      dlg.showModal();
      input.focus();
    }
    function closeCmd() { if (dlg.open) dlg.close(); }

    const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const score = (c, q) => {
      const label = norm(c.label);
      if (label.startsWith(q)) return 0;
      if (label.split(/[\s&]+/).some(w => w.startsWith(q))) return 1;
      if (norm(c.keys || '').split(/\s+/).some(w => w.startsWith(q))) return 2;
      if (label.includes(q)) return 3;
      if (norm(`${c.g} ${c.keys || ''}`).includes(q)) return 4;
      return -1;
    };
    input.addEventListener('input', () => {
      const q = norm(input.value.trim());
      items = !q ? commands : commands
        .map((c, idx) => ({ c, idx, s: score(c, q) }))
        .filter(x => x.s >= 0)
        .sort((a, b) => a.s - b.s || a.idx - b.idx)
        .map(x => ({ ...x.c, g: 'Results' }));
      sel = 0;
      render();
    });
    input.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!items.length) return;
        sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
        updateSel();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        exec(sel);
      }
    });
    dlg.addEventListener('click', e => { if (e.target === dlg) closeCmd(); });
    $$('[data-cmdk-open]').forEach(b => b.addEventListener('click', openCmd));

    document.addEventListener('keydown', e => {
      const typing = /^(input|textarea|select)$/i.test(document.activeElement && document.activeElement.tagName);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (dlg.open) closeCmd(); else openCmd();
      } else if (e.key === '/' && !dlg.open && !typing) {
        e.preventDefault();
        openCmd();
      } else if (e.key === 'Escape') {
        setMenu(false);
      }
    });
  }
})();
