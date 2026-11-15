import { ICONS } from './icons.js';
import { initAudio, sfx, toggleMute, isMuted } from './audio.js';
import { burst, confetti, floatText, setMood } from './fx.js';

const $ = (sel) => document.querySelector(sel);

const OBJECTS = [
  { id: 'door', label: 'Steel Door', name: 'steel door', actions: [['Examine', 'examine the door'], ['Open', 'open the door']] },
  { id: 'clock', label: 'Clock', name: 'clock', actions: [['Examine', 'examine the clock']] },
  { id: 'poster', label: 'Poster', name: 'poster', actions: [['Read', 'read the poster']] },
  { id: 'desk', label: 'Desk', name: 'desk', actions: [['Examine', 'examine the desk']] },
  { id: 'drawer', label: 'Drawer', name: 'drawer', actions: [['Examine', 'examine the drawer'], ['Enter code...', '#keypad'], ['Open', 'open the drawer']] },
  { id: 'bookshelf', label: 'Bookshelf', name: 'bookshelf', actions: [['Examine', 'examine the bookshelf']] },
  { id: 'terminal', label: 'Terminal', name: 'terminal', actions: [['Examine', 'examine the terminal'], ['Enter password...', '#password']] },
  { id: 'vent', label: 'Air Vent', name: 'air vent', actions: [['Examine', 'examine the vent'], ['Open', 'open the vent'], ['Take keycard', 'take the keycard']] },
  { id: 'plant', label: 'Plant', name: 'potted plant', actions: [['Examine', 'examine the plant'], ['Dig in the soil', 'take the rusty key']] },
];

const GOOD_EVENTS = new Set(['unlock', 'reveal', 'item', 'clue', 'escaped']);
const BAD_EVENTS = new Set(['wrong_code', 'locked', 'missing_item', 'red_herring', 'unknown_target', 'timeout']);

const ui = {
  sessionId: null,
  game: null,
  selectedItem: null,
  busy: false,
  skipTyping: false,
  deadline: 0,
  lastTick: null,
  ended: false,
  history: [],
  historyIdx: -1,
};

/* ---------------- API ---------------- */

async function api(path, body = {}) {
  const res = await fetch(`/api/v2/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({ error: 'Invalid server response.' }));
  if (!res.ok) throw Object.assign(new Error(data.error || `HTTP ${res.status}`), { status: res.status });
  return data;
}

/* ---------------- Log / typewriter ---------------- */

function addEntry(cls, text = '') {
  const el = document.createElement('div');
  el.className = `entry ${cls}`;
  el.textContent = text;
  $('#log').appendChild(el);
  $('#log').scrollTop = $('#log').scrollHeight;
  return el;
}

function typeOut(el, text) {
  ui.skipTyping = false;
  return new Promise((resolve) => {
    const caret = document.createElement('span');
    caret.className = 'caret';
    const node = document.createTextNode('');
    el.append(node, caret);
    let i = 0;
    const step = () => {
      if (ui.skipTyping) i = text.length;
      else i += 1;
      node.textContent = text.slice(0, i);
      if (i % 3 === 0) sfx.blip();
      $('#log').scrollTop = $('#log').scrollHeight;
      if (i < text.length) setTimeout(step, 14);
      else {
        caret.remove();
        resolve();
      }
    };
    step();
  });
}

function addTrace(el, meta) {
  if (!meta) return;
  const t = document.createElement('span');
  t.className = 'trace';
  const guardWarn = meta.guard !== 'passed' || meta.aiError;
  t.innerHTML =
    `parser: <b>${meta.parser}</b> &middot; narrator: <b>${meta.narrator}</b> &middot; ` +
    `guard: <b class="${guardWarn ? 'warn' : ''}">${meta.guard}${meta.aiError ? ' (AI fallback)' : ''}</b> &middot; ${meta.latencyMs}ms`;
  el.appendChild(t);
}

/* ---------------- Rendering ---------------- */

function renderHotspots() {
  const wrap = $('#hotspots');
  wrap.innerHTML = '';
  for (const obj of OBJECTS) {
    const btn = document.createElement('button');
    btn.className = 'hotspot';
    btn.dataset.id = obj.id;
    btn.innerHTML = `${ICONS[obj.id]}<span>${obj.label}</span><i class="led"></i>`;
    btn.addEventListener('click', (e) => openContext(obj, e));
    wrap.appendChild(btn);
  }
}

function renderState() {
  const g = ui.game;
  if (!g) return;

  $('#progress-bar').style.width = `${g.progress}%`;
  $('#progress-label').textContent = `${g.progress}%`;
  bumpStat('#stat-moves', g.moves);
  bumpStat('#stat-hints', g.hintsUsed);
  bumpStat('#stat-errors', g.wrongAttempts);

  for (const el of document.querySelectorAll('.hotspot')) {
    const s = g.objects[el.dataset.id];
    const led = el.querySelector('.led');
    led.className = 'led' + (s === 'locked' ? ' locked' : ['open', 'unlocked', 'revealed'].includes(s) ? ' open' : '');
    el.classList.toggle('solved', ['open', 'unlocked', 'revealed'].includes(s));
    el.classList.toggle('target-mode', !!ui.selectedItem);
  }

  const inv = $('#inventory');
  inv.innerHTML = '';
  for (let i = 0; i < 6; i++) {
    const item = g.inventory[i];
    const slot = document.createElement('div');
    slot.className = 'slot';
    if (item) {
      slot.classList.add('filled');
      slot.dataset.id = item.id;
      slot.title = item.description;
      slot.innerHTML = `${ICONS[item.id]}<span>${item.name}</span>`;
      if (ui.selectedItem === item.id) slot.classList.add('selected');
      slot.addEventListener('click', () => selectItem(item));
    } else {
      slot.textContent = 'empty';
    }
    inv.appendChild(slot);
  }

  $('#objectives').innerHTML = g.stages
    .map((s, i) => `<li class="${s.done ? 'done' : i === g.stageIndex ? 'current' : ''}">${s.title}</li>`)
    .join('');

  $('#achievements').innerHTML = g.achievements.length
    ? g.achievements.map((a) => `<li>${a.title}<small>${a.description}</small></li>`).join('')
    : '<li class="empty">None yet...</li>';
}

function bumpStat(sel, value) {
  const el = $(sel);
  if (el.textContent !== String(value)) {
    el.textContent = value;
    el.classList.remove('bump');
    void el.offsetWidth;
    el.classList.add('bump');
  }
}

/* ---------------- Interaction ---------------- */

function selectItem(item) {
  sfx.click();
  ui.selectedItem = ui.selectedItem === item.id ? null : item.id;
  if (ui.selectedItem) addEntry('system', `[ ${item.name} selected - click an object to use it ]`);
  renderState();
}

function openContext(obj, e) {
  sfx.click();
  const ctx = $('#ctx');
  ctx.innerHTML = `<h4>${obj.label.toUpperCase()}</h4>`;

  const actions = [...obj.actions];
  if (ui.selectedItem) {
    const item = ui.game.inventory.find((i) => i.id === ui.selectedItem);
    actions.unshift([`Use ${item.name} here`, `use ${item.name} on ${obj.name}`, 'use']);
  }

  for (const [label, cmd, cls] of actions) {
    const b = document.createElement('button');
    b.textContent = label;
    if (cls) b.className = cls;
    b.addEventListener('click', () => {
      closeContext();
      if (cmd === '#keypad') return openKeypad();
      if (cmd === '#password') return openPassword();
      if (cls === 'use') ui.selectedItem = null;
      send(cmd);
    });
    ctx.appendChild(b);
  }

  ctx.classList.remove('hidden');
  const rect = ctx.getBoundingClientRect();
  ctx.style.left = `${Math.min(e.clientX, window.innerWidth - rect.width - 10)}px`;
  ctx.style.top = `${Math.min(e.clientY, window.innerHeight - rect.height - 10)}px`;
}

function closeContext() {
  $('#ctx').classList.add('hidden');
}

async function send(input) {
  if (ui.busy || ui.ended || !input.trim()) return;
  ui.busy = true;
  document.body.classList.add('busy');
  sfx.send();
  addEntry('player', input);
  ui.history.unshift(input);
  ui.historyIdx = -1;

  try {
    const r = await api('action', { sessionId: ui.sessionId, input });
    await handleResult(r);
  } catch (err) {
    sfx.error();
    addEntry('system', err.status === 404 ? 'Session expired. Press restart to begin a new game.' : `Signal lost: ${err.message}`);
  } finally {
    ui.busy = false;
    document.body.classList.remove('busy');
    $('#cmd').focus();
  }
}

async function requestHint() {
  if (ui.busy || ui.ended) return;
  ui.busy = true;
  addEntry('player', 'hint');
  try {
    const r = await api('hint', { sessionId: ui.sessionId });
    await handleResult(r);
  } catch (err) {
    addEntry('system', `Signal lost: ${err.message}`);
  } finally {
    ui.busy = false;
  }
}

async function handleResult(r) {
  const prevInventory = new Set((ui.game?.inventory || []).map((i) => i.id));
  ui.game = r.state;
  syncTimer();

  let cls = 'ai';
  if (r.event === 'hint') cls += ' hint';
  else if (r.event === 'injection_blocked') cls += ' hack';
  else if (GOOD_EVENTS.has(r.event) && r.success) cls += ' good';
  else if (BAD_EVENTS.has(r.event)) cls += ' bad';

  playEffects(r);
  const el = addEntry(cls);
  await typeOut(el, r.narration);
  addTrace(el, r.meta);
  renderState();

  for (const item of r.state.inventory) {
    if (!prevInventory.has(item.id)) {
      const slot = document.querySelector(`.slot[data-id="${item.id}"]`);
      if (slot) {
        slot.classList.add('new');
        const rect = slot.getBoundingClientRect();
        burst(rect.left + rect.width / 2, rect.top + rect.height / 2, { colors: ['#ffb400', '#ffffff', '#00f0ff'], count: 50 });
        floatText(`+ ${item.name}`, rect.left, rect.top);
      }
    }
  }

  r.achievements.forEach((a, i) => setTimeout(() => toast(a), i * 600));

  if (r.state.status === 'escaped') setTimeout(() => showEnd(true), 600);
  if (r.state.status === 'timeout') setTimeout(() => showEnd(false), 400);
}

function playEffects(r) {
  const app = $('#app');
  const target = r.meta?.action?.target;
  const hotspot = target && document.querySelector(`.hotspot[data-id="${target}"]`);

  if (r.event === 'injection_blocked') {
    sfx.alarm();
    flash('hack');
    restartAnim(app, 'glitching');
    setMood('#ff2bd6');
    setTimeout(() => setMood('#00f0ff'), 1500);
  } else if (r.event === 'hint') {
    sfx.hint();
  } else if (r.event === 'escaped') {
    sfx.unlock();
    setTimeout(sfx.victory, 300);
    flash('good');
    confetti();
    setMood('#39ff88');
  } else if (GOOD_EVENTS.has(r.event) && r.success) {
    if (r.event === 'unlock' || r.event === 'reveal') {
      sfx.unlock();
      setTimeout(sfx.success, 200);
      flash('good');
      if (hotspot) {
        restartAnim(hotspot, 'unlocked-anim');
        const rect = hotspot.getBoundingClientRect();
        burst(rect.left + rect.width / 2, rect.top + rect.height / 2, { colors: ['#39ff88', '#00f0ff'], count: 60 });
      }
    } else if (r.event === 'item') sfx.pickup();
    else sfx.success();
  } else if (BAD_EVENTS.has(r.event)) {
    sfx.error();
    if (r.event !== 'unknown_target') {
      flash('bad');
      restartAnim(app, 'shake');
    }
  }
}

function restartAnim(el, cls) {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
  setTimeout(() => el.classList.remove(cls), 900);
}

function flash(kind) {
  const f = $('#flash');
  f.className = '';
  void f.offsetWidth;
  f.className = kind;
}

function toast(a) {
  sfx.achievement();
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = `<small>ACHIEVEMENT UNLOCKED</small><b>${a.title}</b><p>${a.description}</p>`;
  $('#toasts').appendChild(t);
  setTimeout(() => t.remove(), 4200);
}

/* ---------------- Modals ---------------- */

let keypadCode = '';

function openKeypad() {
  keypadCode = '';
  updateKeypad();
  document.activeElement?.blur();
  $('#keypad').classList.remove('hidden');
}

function updateKeypad(err = false) {
  const d = $('#keypad-display');
  d.textContent = err ? 'ERR' : keypadCode.padEnd(4, '_');
  d.classList.toggle('err', err);
}

function pressKey(k) {
  sfx.key();
  if (k === 'C') keypadCode = '';
  else if (k === 'OK') {
    if (keypadCode.length !== 4) {
      sfx.error();
      updateKeypad(true);
      restartAnim($('.keypad-box'), 'shake');
      setTimeout(() => updateKeypad(), 600);
      return;
    }
    const code = keypadCode;
    closeModals();
    send(`enter ${code} on the drawer`);
    return;
  } else if (keypadCode.length < 4) keypadCode += k;
  updateKeypad();
}

function buildKeypad() {
  const grid = $('#keypad-grid');
  for (const k of ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', 'OK']) {
    const b = document.createElement('button');
    b.className = 'key' + (k === 'OK' ? ' ok' : k === 'C' ? ' clr' : '');
    b.textContent = k;
    b.addEventListener('click', () => pressKey(k));
    grid.appendChild(b);
  }
}

function openPassword() {
  $('#password-input').value = '';
  $('#password').classList.remove('hidden');
  setTimeout(() => $('#password-input').focus(), 50);
}

function closeModals() {
  for (const m of document.querySelectorAll('.modal:not(#end)')) m.classList.add('hidden');
}

function showEnd(won) {
  if (ui.ended) return;
  ui.ended = true;
  const g = ui.game;
  const box = $('.end-box');
  box.classList.toggle('lost', !won);
  $('#end-title').textContent = won ? 'ESCAPED' : 'TERMINATED';
  $('#end-title').dataset.text = won ? 'ESCAPED' : 'TERMINATED';
  $('#end-text').textContent = won
    ? 'The lockdown is lifted. ECHO powers down as you step into the night.'
    : 'Time ran out. ECHO seals the lab forever... or until you try again.';
  const used = Math.round((15 * 60 * 1000 - g.timeLeftMs) / 1000);
  $('#end-stats').innerHTML = `
    ${won ? `<div class="score"><span>SCORE</span><b>${g.score}</b></div>` : ''}
    <div><span>TIME</span><b>${Math.floor(used / 60)}:${String(used % 60).padStart(2, '0')}</b></div>
    <div><span>MOVES</span><b>${g.moves}</b></div>
    <div><span>HINTS</span><b>${g.hintsUsed}</b></div>
    <div><span>ERRORS</span><b>${g.wrongAttempts}</b></div>`;
  if (!won) {
    sfx.defeat();
    flash('bad');
    setMood('#ff3355');
  }
  $('#end').classList.remove('hidden');
}

/* ---------------- Timer ---------------- */

function syncTimer() {
  ui.deadline = Date.now() + ui.game.timeLeftMs;
}

function tickTimer() {
  if (!ui.game || ui.ended) return;
  const left = Math.max(0, ui.deadline - Date.now());
  const sec = Math.ceil(left / 1000);
  const el = $('#timer');
  el.textContent = `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
  el.classList.toggle('warn', sec <= 180 && sec > 60);
  el.classList.toggle('danger', sec <= 60);
  if (sec <= 10 && sec !== ui.lastTick && sec > 0) sfx.tick();
  ui.lastTick = sec;
  if (left === 0 && ui.game.status === 'playing') {
    ui.game.status = 'timeout';
    addEntry('ai bad', 'The lights die. ECHO announces: "Time expired. Subject retained."');
    showEnd(false);
  }
}

/* ---------------- Game lifecycle ---------------- */

async function newGame() {
  ui.ended = false;
  ui.selectedItem = null;
  ui.game = null;
  $('#log').innerHTML = '';
  $('#end').classList.add('hidden');
  setMood('#00f0ff');
  sfx.restoreAmbient();

  try {
    const r = await api('new');
    ui.sessionId = r.sessionId;
    ui.game = r.state;
    syncTimer();
    const badge = $('#ai-badge');
    badge.textContent = r.ai.enabled ? 'AI: GEMINI ONLINE' : 'AI: OFFLINE MODE';
    badge.className = 'ai-badge ' + (r.ai.enabled ? 'on' : 'off');
    renderState();
    addEntry('system', '--- LOCKDOWN INITIATED: 15:00 ON THE CLOCK ---');
    await typeOut(addEntry('ai'), r.narration);
    if (!r.ai.enabled) addEntry('system', 'No GEMINI_API_KEY found - running with the built-in narrator. Add a key to .env for AI narration.');
  } catch (err) {
    addEntry('system', `Could not reach the server: ${err.message}`);
  }
  $('#cmd').focus();
}

async function boot() {
  const lines = [
    'ECHO BIOS v4.04 .................. OK',
    'Loading neural core .............. OK',
    'Checking subject vitals .......... ALIVE',
    'Lockdown protocol ................ ACTIVE',
  ];
  let ai = false;
  try {
    ai = (await (await fetch('/api/health')).json()).ai.enabled;
  } catch {}
  lines.push(`Gemini language uplink ........... ${ai ? 'ONLINE' : 'OFFLINE (fallback narrator)'}`);
  lines.push('', 'WARNING: subject is awake.');

  const log = $('#boot-log');
  for (const line of lines) {
    for (const ch of line) {
      log.textContent += ch;
      await new Promise((r) => setTimeout(r, 8));
    }
    log.textContent += '\n';
    await new Promise((r) => setTimeout(r, 120));
  }
  const start = $('#start');
  start.disabled = false;
  start.textContent = 'PRESS START';
}

function bindEvents() {
  $('#start').addEventListener('click', async () => {
    initAudio();
    sfx.boot();
    $('#boot').classList.add('boot-out');
    setTimeout(() => {
      $('#boot').classList.add('hidden');
      $('#app').classList.remove('hidden');
      $('#app').classList.add('boot-in');
      newGame();
    }, 650);
  });

  $('#cmd-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = $('#cmd').value;
    $('#cmd').value = '';
    send(v);
  });

  $('#cmd').addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp' && ui.history.length) {
      ui.historyIdx = Math.min(ui.historyIdx + 1, ui.history.length - 1);
      $('#cmd').value = ui.history[ui.historyIdx];
      e.preventDefault();
    } else if (e.key === 'ArrowDown') {
      ui.historyIdx = Math.max(ui.historyIdx - 1, -1);
      $('#cmd').value = ui.historyIdx >= 0 ? ui.history[ui.historyIdx] : '';
    } else if (e.key.length === 1 && Math.random() < 0.5) sfx.key();
  });

  for (const chip of document.querySelectorAll('.chip[data-cmd]')) {
    chip.addEventListener('click', () => send(chip.dataset.cmd));
  }
  $('#btn-hint').addEventListener('click', requestHint);

  $('#trace').addEventListener('change', (e) => $('#log').classList.toggle('no-trace', !e.target.checked));
  $('#log').addEventListener('click', () => (ui.skipTyping = true));

  const muteBtn = $('#btn-mute');
  const renderMute = () => (muteBtn.innerHTML = isMuted() ? ICONS.sound_off : ICONS.sound_on);
  renderMute();
  muteBtn.addEventListener('click', () => {
    toggleMute();
    renderMute();
  });

  $('#btn-restart').innerHTML = ICONS.restart;
  $('#btn-restart').addEventListener('click', () => {
    restartAnim($('#app'), 'glitching');
    sfx.boot();
    newGame();
  });
  $('#btn-again').addEventListener('click', newGame);

  $('#password-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const pw = $('#password-input').value.replace(/[^a-z0-9]/gi, '');
    closeModals();
    if (pw) send(`type ${pw} into the terminal`);
  });

  for (const b of document.querySelectorAll('[data-close]')) b.addEventListener('click', closeModals);

  document.addEventListener('click', (e) => {
    if (!e.target.closest('#ctx') && !e.target.closest('.hotspot')) closeContext();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeContext();
      closeModals();
      if (ui.selectedItem) {
        ui.selectedItem = null;
        renderState();
      }
    }
    if (!$('#keypad').classList.contains('hidden')) {
      if (/^\d$/.test(e.key)) pressKey(e.key);
      else if (e.key === 'Enter') pressKey('OK');
      else if (e.key === 'Backspace') pressKey('C');
    }
  });

  setInterval(tickTimer, 250);
}

buildKeypad();
renderHotspots();
bindEvents();
boot();
