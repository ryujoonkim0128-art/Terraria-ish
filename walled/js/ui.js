'use strict';
// DOM overlays: HUD, task list, dialogue, story cards, toasts, touch controls.

const $ = (id) => document.getElementById(id);
const UI = {
  dialogOpen: false, storyOpen: false,
  init() {
    this.el = { hud: $('hud'), tasks: $('tasks'), dlg: $('dialog'), dname: $('dname'), dtext: $('dtext'), dch: $('dchoices'), story: $('story'), stext: $('stext'), toast: $('toast'), title: $('title'), help: $('help'), over: $('over') };
    $('start').addEventListener('click', (e) => { e.stopPropagation(); startGame(); });
    $('restart').addEventListener('click', () => { location.hash = ''; location.reload(); });
    this.el.dlg.addEventListener('pointerdown', (e) => { e.stopPropagation(); if (!e.target.closest('button')) this.advance(0); });
    this.el.story.addEventListener('pointerdown', (e) => { e.stopPropagation(); this.storyNext(); });
    addEventListener('keydown', (e) => {
      if (g.mode === 'title' && ['Enter', ' ', 'e', 'E'].includes(e.key)) { e.preventDefault(); startGame(); return; }
      if (this.storyOpen && ['Enter', ' ', 'e', 'E'].includes(e.key)) { e.preventDefault(); this.storyNext(); }
    });
    this.touch();
    this.help = true;
  },
  hud(show) {
    if (show) this.el.hud.hidden = false, this.el.tasks.hidden = false, this.el.help.hidden = !this.help;
    const h = g.time, hh = Math.floor(h), mm = Math.floor((h - hh) * 60);
    const daysLeft = g.rentDue - g.day;
    const bar = (v, cls) => `<span class="bar ${cls}${v < 22 ? ' low' : ''}"><i style="width:${Math.max(0, v) | 0}%"></i></span>`;
    this.el.hud.innerHTML =
      `<div class="clock"><b>Day ${g.day}</b> ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}</div>` +
      `<div class="money">$${g.coins} <span class="rent${daysLeft <= 0 || (daysLeft === 1 && g.coins < 30) ? ' due' : ''}">rent $30 · ${daysLeft <= 0 ? 'due 6:00' : daysLeft === 1 ? 'tomorrow' : 'in ' + daysLeft + ' days'}${g.strikes ? ' · LAST WARNING' : ''}</span></div>` +
      `<div class="bars"><label>health</label>${bar(g.hp, 'hp')}<label>food</label>${bar(g.food, 'food')}<label>breath</label>${bar(g.stam, 'stam')}</div>`;
  },
  tasks() {
    const rows = [];
    g.jobs.forEach((j, i) => { const t = jobTitle(j); rows.push(`<li class="${i === 0 ? 'on' : ''}"><span>${t.t}</span><em>${t.w}</em></li>`); });
    const lb = w.blds[w.coop.b].letter;
    if (!g.lamDone) {
      const hint = ['ask around', 'ask around', 'somewhere high up', 'one of the roofs', `Block ${lb}, the roof`][g.lamStage];
      rows.push(`<li class="letter"><span>Deliver the letter to Lam Siu-ying</span><em>${hint}</em></li>`);
    } else rows.push(`<li class="letter"><span>Tea on the roof</span><em>Block ${lb}, once a day</em></li>`);
    this.el.tasks.innerHTML = `<h3>Tasks${g.jobs.length > 1 ? ' <small>F to switch</small>' : ''}</h3><ul>${rows.join('')}</ul>`;
  },
  talk(lines, choices, done) {
    this.queue = lines.slice(); this.choices = choices || null; this.done = done || null;
    this.dialogOpen = true; this.el.dlg.hidden = false;
    if (g.focus && g.focus.kind === 'npc') g.talking = g.focus.n;
    this.show();
  },
  show() {
    const l = this.queue[0];
    this.el.dname.textContent = l.name || '';
    this.el.dname.hidden = !l.name;
    this.full = l.text; this.shown = 0;
    this.el.dtext.textContent = '';
    this.el.dch.innerHTML = '';
    clearInterval(this.ti);
    this.ti = setInterval(() => {
      this.shown = Math.min(this.full.length, this.shown + 2);
      this.el.dtext.textContent = this.full.slice(0, this.shown);
      if (this.shown % 6 === 0 && l.name) Sfx.talk();
      if (this.shown >= this.full.length) { clearInterval(this.ti); this.showChoices(); }
    }, 22);
  },
  showChoices() {
    const last = this.queue.length === 1;
    if (last && this.choices) {
      this.el.dch.innerHTML = this.choices.map((c, i) => `<button data-i="${i}"><kbd>${i === 0 ? 'E' : 'Q'}</kbd>${c.label}</button>`).join('');
      this.el.dch.querySelectorAll('button').forEach((b) => b.addEventListener('pointerdown', (e) => { e.stopPropagation(); this.advance(+b.dataset.i); }));
    } else this.el.dch.innerHTML = `<span class="more"><kbd>E</kbd>${last ? 'close' : 'more'}</span>`;
  },
  advance(i) {
    if (!this.dialogOpen) return;
    if (this.shown < this.full.length) { this.shown = this.full.length; this.el.dtext.textContent = this.full; clearInterval(this.ti); this.showChoices(); return; }
    this.queue.shift();
    if (this.queue.length) return this.show();
    const ch = this.choices, done = this.done;
    this.close();
    if (ch && ch[i]) ch[i].fn();
    if (done) done();
  },
  close() { this.dialogOpen = false; this.el.dlg.hidden = true; clearInterval(this.ti); g.talking = null; },
  story(lines, done, auto) {
    this.sq = lines.slice(); this.sdone = done; this.storyOpen = true;
    this.el.story.hidden = false; this.el.story.classList.add('show');
    this.el.story.classList.toggle('auto', !!auto);
    this.storyShow();
    if (auto) { clearTimeout(this.sauto); this.sauto = setTimeout(() => this.storyEnd(), 2600); }
  },
  storyShow() {
    this.el.stext.classList.remove('in'); void this.el.stext.offsetWidth;
    this.el.stext.textContent = this.sq[0]; this.el.stext.classList.add('in');
    this.sAt = performance.now();
  },
  storyNext() {
    if (!this.storyOpen || this.el.story.classList.contains('auto')) return;
    if (performance.now() - this.sAt < 350) return;
    this.sq.shift();
    if (this.sq.length) this.storyShow(); else this.storyEnd();
  },
  storyEnd() {
    this.storyOpen = false; this.el.story.classList.remove('show');
    setTimeout(() => { if (!this.storyOpen) this.el.story.hidden = true; }, 600);
    const d = this.sdone; this.sdone = null; if (d) d();
  },
  title(show) { this.el.title.hidden = !show; },
  over() { this.el.over.hidden = false; this.el.hud.hidden = true; this.el.tasks.hidden = true; },
  mapHide(on) { if (on === this.mapOn) return; this.mapOn = on; for (const k of ['hud', 'tasks', 'toast']) this.el[k].style.visibility = on ? 'hidden' : ''; this.el.help.style.visibility = on ? 'hidden' : ''; },
  toggleHelp() { this.help = !this.help; this.el.help.hidden = !this.help; },
  toast(m) {
    const t = document.createElement('div'); t.className = 't'; t.textContent = m;
    this.el.toast.appendChild(t);
    while (this.el.toast.children.length > 3) this.el.toast.firstChild.remove();
    setTimeout(() => t.classList.add('out'), 4200); setTimeout(() => t.remove(), 5000);
  },
  touch() {
    const pad = $('touch');
    if (!matchMedia('(pointer: coarse)').matches) { pad.hidden = true; return; }
    pad.hidden = false;
    pad.querySelectorAll('[data-k]').forEach((b) => {
      const k = b.dataset.k;
      const on = (e) => { e.preventDefault(); e.stopPropagation(); Sfx.init(); Sfx.resume(); if (!g.keys[k]) g.pressed[k] = true; g.keys[k] = true; if (g.mode === 'title') startGame(); else if (UI.storyOpen) UI.storyNext(); };
      const off = (e) => { e.preventDefault(); g.keys[k] = false; };
      b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('pointerleave', off);
    });
  },
};
function toast(m) { UI.toast(m); }
