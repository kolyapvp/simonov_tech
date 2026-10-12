(() => {
  'use strict';

  const { projects = [], contacts = [] } = window.SITE_DATA || {};
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const PLATFORMS = {
    steam: { label: 'Steam', filter: 'Steam', action: 'Открыть в Steam' },
    vk: { label: 'VK Mini App', filter: 'VK Mini Apps', action: 'Открыть в VK' },
  };
  const platformOf = (key) => PLATFORMS[key] || { label: key, filter: key, action: 'Открыть' };

  const ICONS = {
    arrowUpRight: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9"/></svg>',
    prev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>',
    next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>',
  };

  const esc = (value) =>
    String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  const safeUrl = (url) => (/^(https?:|mailto:|tg:)/i.test(String(url || '')) ? url : '#');

  const imagesOf = (project) => project.images;
  const coverOf = (project) => project.cover || imagesOf(project)[0];
  const paragraphs = (desc) => (Array.isArray(desc) ? desc : desc ? [desc] : []);

  function renderStats() {
    const stats = $('#stats');
    if (!stats) return;
    const items = [{ value: projects.length, label: 'готовых проектов' }];
    for (const key of Object.keys(PLATFORMS)) {
      const count = projects.filter((p) => p.platform === key).length;
      if (count) items.push({ value: count, label: key === 'steam' ? 'игр в Steam' : 'VK Mini Apps' });
    }
    stats.innerHTML = items
      .map((s) => `<div><dt>${esc(s.label)}</dt><dd data-count="${s.value}">0</dd></div>`)
      .join('');
  }

  function animateCounters() {
    const els = $$('[data-count]');
    const run = (el) => {
      const target = Number(el.dataset.count) || 0;
      if (reduceMotion) {
        el.textContent = target;
        return;
      }
      const start = performance.now();
      const dur = 1400;
      const tick = (now) => {
        const t = Math.min(1, (now - start) / dur);
        el.textContent = Math.round(target * (1 - (1 - t) ** 4));
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          run(e.target);
          io.unobserve(e.target);
        }
      });
    });
    els.forEach((el) => io.observe(el));
  }

  function renderMarquee() {
    const track = $('#marquee');
    if (!track) return;
    const words = ['Game Development', 'Steam', 'VK Mini Apps', 'Геймдизайн', 'Прототипы', 'Релизы', 'Simonov Tech'];
    const group = `<div class="marquee__group">${words.map((w) => `<span class="marquee__item">${esc(w)}</span>`).join('')}</div>`;
    track.innerHTML = group + group;
  }

  function renderProjects() {
    const grid = $('#grid');
    if (!grid) return;
    if (!projects.length) {
      grid.innerHTML = '<p class="empty">Скоро здесь появятся проекты.</p>';
      return;
    }
    grid.innerHTML = projects
      .map((p, i) => {
        const tags = (p.genres || []).map((g) => `<li class="tag">${esc(g)}</li>`).join('');
        return `<article class="card" data-reveal style="--d:${(i % 3) * 0.1}s" data-index="${i}" data-platform="${esc(p.platform)}" tabindex="0" role="button" aria-haspopup="dialog" aria-label="${esc(p.title)} — подробнее">
          <div class="card__media">
            <img src="${esc(coverOf(p))}" alt="${esc(p.title)}" loading="lazy" decoding="async">
            <span class="card__open">${ICONS.arrowUpRight}</span>
          </div>
          <div class="card__body">
            <h3 class="card__title">${esc(p.title)}</h3>
            <p class="card__text">${esc(p.short)}</p>
            ${tags ? `<ul class="tags">${tags}</ul>` : ''}
          </div>
        </article>`;
      })
      .join('');

    $$('.card', grid).forEach((card) => {
      const open = () => openProject(projects[Number(card.dataset.index)]);
      card.addEventListener('click', open);
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      });
      if (finePointer && !reduceMotion) attachTilt(card);
    });
  }

  function attachTilt(card) {
    let frame = 0;
    card.addEventListener('pointermove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        card.classList.add('is-tilting');
        card.style.setProperty('--mx', `${x}px`);
        card.style.setProperty('--my', `${y}px`);
        card.style.setProperty('--ry', `${((x / rect.width) - 0.5) * 10}deg`);
        card.style.setProperty('--rx', `${(0.5 - (y / rect.height)) * 8}deg`);
      });
    });
    card.addEventListener('pointerleave', () => {
      cancelAnimationFrame(frame);
      card.classList.remove('is-tilting');
      card.style.setProperty('--rx', '0deg');
      card.style.setProperty('--ry', '0deg');
    });
  }

  function setupFilters() {
    const wrap = $('#filters');
    if (!wrap) return;
    const platforms = Object.keys(PLATFORMS).filter((k) => projects.some((p) => p.platform === k));
    if (platforms.length < 2) {
      wrap.hidden = true;
      return;
    }
    const pill = $('.filters__pill', wrap);
    const options = [{ key: 'all', label: 'Все', count: projects.length }].concat(
      platforms.map((k) => ({ key: k, label: platformOf(k).filter, count: projects.filter((p) => p.platform === k).length })),
    );
    wrap.insertAdjacentHTML(
      'beforeend',
      options
        .map(
          (o, i) =>
            `<button type="button" class="filter${i === 0 ? ' is-active' : ''}" data-filter="${esc(o.key)}" aria-pressed="${i === 0}">${esc(o.label)}<span class="filter__count">${o.count}</span></button>`,
        )
        .join(''),
    );
    const buttons = $$('.filter', wrap);
    const movePill = () => {
      const active = $('.filter.is-active', wrap);
      if (!active) return;
      pill.style.width = `${active.offsetWidth}px`;
      pill.style.transform = `translateX(${active.offsetLeft}px)`;
    };
    buttons.forEach((btn) =>
      btn.addEventListener('click', () => {
        buttons.forEach((b) => {
          b.classList.toggle('is-active', b === btn);
          b.setAttribute('aria-pressed', String(b === btn));
        });
        movePill();
        applyFilter(btn.dataset.filter);
      }),
    );
    movePill();
    addEventListener('resize', movePill);
    document.fonts?.ready.then(movePill);
  }

  function applyFilter(key) {
    let shown = 0;
    $$('#grid .card').forEach((card) => {
      const visible = key === 'all' || card.dataset.platform === key;
      card.hidden = !visible;
      card.classList.remove('is-in');
      if (visible) card.classList.add('is-visible');
      if (visible && !reduceMotion) {
        card.style.setProperty('--i', `${shown * 0.07}s`);
        void card.offsetWidth;
        card.classList.add('is-in');
      }
      if (visible) shown += 1;
    });
  }

  const modal = $('#modal');
  const modalContent = $('#modal-content');
  let gallery = null;

  function openProject(project) {
    if (!project || !modal) return;
    const pf = platformOf(project.platform);
    const imgs = imagesOf(project);
    const many = imgs.length > 1;
    const tags = (project.genres || []).map((g) => `<li class="tag">${esc(g)}</li>`).join('');

    modalContent.innerHTML = `
      <div class="gallery">
        <div class="gallery__stage">
          ${imgs.map((src, i) => `<img class="gallery__img" src="${esc(src)}" alt="${esc(project.title)} — изображение ${i + 1}" decoding="async" draggable="false">`).join('')}
          ${many ? `<button type="button" class="gallery__nav gallery__nav--prev" aria-label="Предыдущее изображение">${ICONS.prev}</button>
          <button type="button" class="gallery__nav gallery__nav--next" aria-label="Следующее изображение">${ICONS.next}</button>
          <span class="gallery__counter"><span data-current>1</span> / ${imgs.length}</span>` : ''}
        </div>
        ${many ? `<div class="gallery__thumbs">${imgs.map((src, i) => `<button type="button" class="thumb" aria-label="Изображение ${i + 1}"><img src="${esc(src)}" alt="" draggable="false"></button>`).join('')}</div>` : ''}
      </div>
      <div class="modal__info">
        <span class="badge badge--${esc(project.platform)}">${esc(pf.label)}</span>
        <h2 class="modal__title" id="modal-title">${esc(project.title)}</h2>
        ${tags ? `<ul class="tags">${tags}</ul>` : ''}
        <div class="modal__desc">${paragraphs(project.description).map((t) => `<p>${esc(t)}</p>`).join('')}</div>
        <dl class="meta">
          <div><dt>Платформа</dt><dd>${esc(pf.label)}</dd></div>
          ${project.genres?.length ? `<div><dt>Жанр</dt><dd>${esc(project.genres.join(', '))}</dd></div>` : ''}
        </dl>
        ${project.link ? `<a class="btn btn--primary" href="${esc(safeUrl(project.link))}" target="_blank" rel="noopener noreferrer">${esc(pf.action)} ${ICONS.arrowUpRight}</a>` : ''}
      </div>`;

    gallery = setupGallery(modalContent);
    modal.classList.remove('is-closing');
    modal.showModal();
    document.documentElement.classList.add('is-locked');
    modalContent.scrollTop = 0;
    $('.modal__info', modalContent).scrollTop = 0;
  }

  function setupGallery(root) {
    const imgs = $$('.gallery__img', root);
    const thumbs = $$('.thumb', root);
    const counter = $('[data-current]', root);
    const stage = $('.gallery__stage', root);
    let index = 0;

    const go = (n) => {
      index = (n + imgs.length) % imgs.length;
      imgs.forEach((img, i) => img.classList.toggle('is-active', i === index));
      thumbs.forEach((t, i) => {
        t.classList.toggle('is-active', i === index);
        t.setAttribute('aria-current', String(i === index));
      });
      const active = thumbs[index];
      if (active) {
        const strip = active.parentElement;
        strip.scrollTo({ left: active.offsetLeft - (strip.clientWidth - active.offsetWidth) / 2, behavior: 'smooth' });
      }
      if (counter) counter.textContent = String(index + 1);
    };

    $('.gallery__nav--prev', root)?.addEventListener('click', () => go(index - 1));
    $('.gallery__nav--next', root)?.addEventListener('click', () => go(index + 1));
    thumbs.forEach((t, i) => t.addEventListener('click', () => go(i)));

    if (imgs.length > 1) {
      let startX = null;
      stage.addEventListener('pointerdown', (e) => {
        if (e.target.closest('button')) return;
        startX = e.clientX;
      });
      stage.addEventListener('pointerup', (e) => {
        if (startX === null) return;
        const dx = e.clientX - startX;
        startX = null;
        if (Math.abs(dx) > 45) go(index + (dx < 0 ? 1 : -1));
      });
      stage.addEventListener('pointercancel', () => {
        startX = null;
      });
    }

    go(0);
    return { prev: () => go(index - 1), next: () => go(index + 1) };
  }

  function closeModal() {
    if (!modal?.open || modal.classList.contains('is-closing')) return;
    const finish = () => {
      modal.classList.remove('is-closing');
      modal.close();
    };
    if (reduceMotion) {
      finish();
      return;
    }
    const box = $('.modal__box', modal);
    const onEnd = (e) => {
      if (e.target !== box) return;
      box.removeEventListener('animationend', onEnd);
      finish();
    };
    box.addEventListener('animationend', onEnd);
    modal.classList.add('is-closing');
  }

  function setupModal() {
    if (!modal) return;
    $('.modal__close', modal).addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
    modal.addEventListener('cancel', (e) => {
      e.preventDefault();
      closeModal();
    });
    modal.addEventListener('close', () => {
      document.documentElement.classList.remove('is-locked');
      gallery = null;
    });
    document.addEventListener('keydown', (e) => {
      if (!modal.open || !gallery) return;
      if (e.key === 'ArrowRight') gallery.next();
      if (e.key === 'ArrowLeft') gallery.prev();
    });
  }

  function renderContacts() {
    const box = $('#contacts');
    if (!box) return;
    box.innerHTML = contacts
      .filter((c) => c && c.url)
      .map((c) => {
        const url = safeUrl(c.url);
        const external = /^https?:/i.test(url);
        return `<a class="contact-link magnetic" href="${esc(url)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${esc(c.label)} ${ICONS.arrowUpRight}</a>`;
      })
      .join('');
  }

  const SCRAMBLE_CHARS = '<>/{}[]=+*#_01$;:';
  function scramble(el, duration = 1100) {
    if (reduceMotion) return;
    const final = el.dataset.final || el.textContent;
    el.dataset.final = final;
    if (el.dataset.busy) return;
    el.dataset.busy = '1';
    const reveal = [...final].map((_, i) => (i / final.length) * duration * 0.65 + Math.random() * duration * 0.35);
    const start = performance.now();
    const tick = (now) => {
      const t = now - start;
      let out = '';
      let done = true;
      [...final].forEach((ch, i) => {
        if (t >= reveal[i] || ch === ' ') out += ch;
        else {
          done = false;
          out += SCRAMBLE_CHARS[(Math.random() * SCRAMBLE_CHARS.length) | 0];
        }
      });
      el.textContent = out;
      if (!done) requestAnimationFrame(tick);
      else delete el.dataset.busy;
    };
    requestAnimationFrame(tick);
  }

  function setupScramble() {
    $$('[data-scramble]').forEach((el, i) => setTimeout(() => scramble(el, 1300), 250 + i * 220));
    $$('[data-scramble-hover]').forEach((el) => {
      el.closest('a')?.addEventListener('mouseenter', () => scramble(el, 600));
    });
  }

  function setupTyping() {
    const el = $('#typed');
    if (!el) return;
    const lines = ['npm run build:game', 'deploy --target steam', 'deploy --target vk-mini-app', 'git commit -m "new level"'];
    if (reduceMotion) {
      el.textContent = lines[0];
      return;
    }
    let line = 0;
    let pos = 0;
    let deleting = false;
    const step = () => {
      const text = lines[line];
      pos += deleting ? -1 : 1;
      el.textContent = text.slice(0, pos);
      let delay = deleting ? 35 : 70 + Math.random() * 60;
      if (!deleting && pos === text.length) {
        deleting = true;
        delay = 1800;
      } else if (deleting && pos === 0) {
        deleting = false;
        line = (line + 1) % lines.length;
        delay = 400;
      }
      setTimeout(step, delay);
    };
    setTimeout(step, 900);
  }

  function setupReveal() {
    const els = $$('[data-reveal]');
    if (reduceMotion || !('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('is-visible'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('is-visible');
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    );
    els.forEach((el) => io.observe(el));
  }

  function setupHeader() {
    const header = $('#header');
    const burger = $('#burger');
    const progress = $('.progress');
    const onScroll = () => {
      header.classList.toggle('is-scrolled', scrollY > 20);
      const max = document.documentElement.scrollHeight - innerHeight;
      progress.style.setProperty('--p', max > 0 ? (scrollY / max).toFixed(4) : 0);
    };
    addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    const setOpen = (open) => {
      header.classList.toggle('is-open', open);
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
      document.documentElement.classList.toggle('is-locked', open);
    };
    burger.addEventListener('click', () => setOpen(!header.classList.contains('is-open')));
    $$('#nav a').forEach((a) => a.addEventListener('click', () => setOpen(false)));
    addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && header.classList.contains('is-open')) setOpen(false);
    });

    const links = $$('#nav a');
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          links.forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === `#${e.target.id}`));
        });
      },
      { rootMargin: '-45% 0px -50% 0px' },
    );
    $$('main section[id]').forEach((s) => io.observe(s));
  }

  function setupPointerEffects() {
    if (!finePointer || reduceMotion) return;
    const glow = $('.cursor-glow');
    let x = innerWidth / 2;
    let y = innerHeight / 2;
    let gx = x;
    let gy = y;
    addEventListener('pointermove', (e) => {
      x = e.clientX;
      y = e.clientY;
    }, { passive: true });
    const loop = () => {
      gx += (x - gx) * 0.12;
      gy += (y - gy) * 0.12;
      glow.style.setProperty('--x', `${gx.toFixed(1)}px`);
      glow.style.setProperty('--y', `${gy.toFixed(1)}px`);
      requestAnimationFrame(loop);
    };
    loop();

    $$('.magnetic').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        el.style.transform = `translate(${dx * 0.25}px, ${dy * 0.35}px)`;
      });
      el.addEventListener('pointerleave', () => {
        el.style.transform = '';
      });
    });
  }

  function setupBackground() {
    const canvas = $('#bg');
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;
    const mouse = { x: -9999, y: -9999 };
    let w = 0;
    let h = 0;
    let points = [];
    let running = true;

    const makePoint = () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35,
      r: Math.random() * 1.5 + 0.5,
      hue: Math.random() < 0.5 ? '167,139,250' : '34,211,238',
    });

    const resize = () => {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      w = innerWidth;
      h = innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const target = Math.min(110, Math.round((w * h) / 14000));
      while (points.length < target) points.push(makePoint());
      points.length = target;
      points.forEach((p) => {
        p.x = Math.min(p.x, w);
        p.y = Math.min(p.y, h);
      });
    };

    const LINK = 130;
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      for (const p of points) {
        if (!reduceMotion) {
          const dx = p.x - mouse.x;
          const dy = p.y - mouse.y;
          const d = Math.hypot(dx, dy);
          if (d < 150 && d > 0) {
            const force = (150 - d) / 150;
            p.x += (dx / d) * force * 2.2;
            p.y += (dy / d) * force * 2.2;
          }
          p.x += p.vx;
          p.y += p.vy;
          if (p.x < -10) p.x = w + 10;
          if (p.x > w + 10) p.x = -10;
          if (p.y < -10) p.y = h + 10;
          if (p.y > h + 10) p.y = -10;
        }
      }
      ctx.lineWidth = 1;
      for (let i = 0; i < points.length; i++) {
        const a = points[i];
        for (let j = i + 1; j < points.length; j++) {
          const b = points[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < LINK * LINK) {
            const alpha = (1 - Math.sqrt(d2) / LINK) * 0.28;
            ctx.strokeStyle = `rgba(139,92,246,${alpha.toFixed(3)})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
        const md = Math.hypot(a.x - mouse.x, a.y - mouse.y);
        if (md < 200) {
          ctx.strokeStyle = `rgba(34,211,238,${((1 - md / 200) * 0.45).toFixed(3)})`;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.stroke();
        }
      }
      for (const p of points) {
        ctx.fillStyle = `rgba(${p.hue},0.9)`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const loop = () => {
      if (!running) return;
      draw();
      requestAnimationFrame(loop);
    };

    resize();
    addEventListener('resize', () => {
      resize();
      if (reduceMotion) draw();
    });
    if (finePointer) {
      addEventListener('pointermove', (e) => {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
      }, { passive: true });
      document.addEventListener('pointerleave', () => {
        mouse.x = -9999;
        mouse.y = -9999;
      });
    }
    if (reduceMotion) {
      draw();
      return;
    }
    document.addEventListener('visibilitychange', () => {
      running = !document.hidden;
      if (running) loop();
    });
    loop();
  }

  renderStats();
  renderMarquee();
  renderProjects();
  renderContacts();
  setupFilters();
  setupModal();
  setupReveal();
  animateCounters();
  setupHeader();
  setupTyping();
  setupScramble();
  setupPointerEffects();
  setupBackground();
  const year = $('#year');
  if (year) year.textContent = new Date().getFullYear();
})();
