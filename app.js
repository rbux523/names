(() => {
  const STORAGE_KEY = 'name-draw-state-v1';
  const DRAW_DURATION = 5000;
  const ROW_HEIGHT = 62;
  const page = document.body.dataset.page;
  const players = new Map();
  let selected = new Set();
  let fallbackPlayer = { avatar: 'Mickey Mouse', icon: 'SVG/mickey-mouse.svg' };
  let state = {
    selected: [],
    customPlayers: [],
    originalGroup: null,
    remaining: [],
    history: [],
    pendingDraw: null
  };

  const els = {
    error: document.querySelector('#load-error'),
    list: document.querySelector('#player-list'),
    listCount: document.querySelector('#list-count'),
    selectedCount: document.querySelector('#selected-count'),
    search: document.querySelector('#search-input'),
    addForm: document.querySelector('#add-form'),
    addInput: document.querySelector('#add-input'),
    selectAll: document.querySelector('#select-all'),
    clearAll: document.querySelector('#clear-all'),
    groupStatus: document.querySelector('#group-status'),
    reset: document.querySelector('#reset-button'),
    draw: document.querySelector('#draw-button'),
    drawLabel: document.querySelector('#draw-button-label'),
    drawStatus: document.querySelector('#draw-status'),
    drawGroupCount: document.querySelector('#draw-group-count'),
    reel: document.querySelector('#reel'),
    track: document.querySelector('#reel-track'),
    placeholder: document.querySelector('#reel-placeholder'),
    history: document.querySelector('#history-list'),
    historyCount: document.querySelector('#history-count')
  };

  function createPlayer(name, data = {}) {
    return { name, avatar: data.avatar || name, icon: data.icon || fallbackPlayer.icon };
  }

  function readSavedState() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch {
      return {};
    }
  }

  function saveState() {
    state.selected = [...selected];
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // The app remains usable for this page session if browser storage is unavailable.
    }
  }

  function setGroupControlsLocked(locked) {
    if (!els.search) return;
    els.search.disabled = locked;
    els.addInput.disabled = locked;
    els.addForm.querySelector('button').disabled = locked;
    els.selectAll.disabled = locked;
    els.clearAll.disabled = locked;
    els.list.querySelectorAll('input[type="checkbox"]').forEach((input) => { input.disabled = locked; });
    els.reset.disabled = state.originalGroup === null || state.pendingDraw !== null;
  }

  function updateDrawUI() {
    const activeGroup = state.originalGroup !== null;
    const remaining = activeGroup ? state.remaining.length : selected.size;
    if (els.drawGroupCount) els.drawGroupCount.textContent = String(selected.size);
    if (!els.draw) return;
    els.draw.disabled = Boolean(state.pendingDraw) || remaining === 0;
    if (state.pendingDraw) {
      els.drawLabel.textContent = 'Drawing…';
    } else if (activeGroup && remaining === 0) {
      els.drawLabel.textContent = 'Everyone has been picked';
    } else {
      els.drawLabel.textContent = state.history.length ? 'Draw next name' : 'Draw a name';
    }
  }

  function updateGroupUI() {
    if (!els.list) return;
    els.selectedCount.textContent = `${selected.size} selected`;
    els.listCount.textContent = `${players.size} ${players.size === 1 ? 'player' : 'players'}${els.search.value.trim() ? ' found' : ' available'}`;
    setGroupControlsLocked(state.originalGroup !== null);
  }

  function makePlayerCard(player) {
    const label = document.createElement('label');
    const isSelected = selected.has(player.name);
    const wasDrawn = state.history.includes(player.name);
    label.className = `player-card${isSelected ? ' selected' : ''}${wasDrawn ? ' drawn' : ''}`;

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = isSelected;
    checkbox.disabled = state.originalGroup !== null;
    checkbox.setAttribute('aria-label', `Include ${player.name}`);
    checkbox.addEventListener('change', () => {
      checkbox.checked ? selected.add(player.name) : selected.delete(player.name);
      saveState();
      renderPlayers();
    });

    const image = document.createElement('img');
    image.className = 'avatar';
    image.src = player.icon;
    image.alt = '';
    image.loading = 'lazy';
    image.onerror = () => { image.onerror = null; image.src = fallbackPlayer.icon; };

    const copy = document.createElement('span');
    copy.className = 'player-copy';
    const name = document.createElement('span');
    name.className = 'player-name';
    name.textContent = player.name;
    const avatar = document.createElement('span');
    avatar.className = 'player-avatar-name';
    avatar.textContent = player.avatar;
    copy.append(name, avatar);
    label.append(checkbox, image, copy);
    return label;
  }

  function renderPlayers() {
    if (!els.list) return;
    const query = els.search.value.trim().toLocaleLowerCase();
    const visible = [...players.values()].filter((player) => `${player.name} ${player.avatar}`.toLocaleLowerCase().includes(query));
    els.list.replaceChildren();
    if (!visible.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-list';
      empty.textContent = query ? 'No players match your search.' : 'No players yet. Add someone above.';
      els.list.append(empty);
    } else {
      visible.forEach((player) => els.list.append(makePlayerCard(player)));
    }
    updateGroupUI();
  }

  function renderHistory() {
    if (!els.history) return;
    els.history.replaceChildren();
    const drawnNames = state.history || [];
    els.historyCount.textContent = `${drawnNames.length} picked`;
    if (!drawnNames.length) {
      const empty = document.createElement('span');
      empty.className = 'history-empty';
      empty.textContent = 'Names you draw will appear here';
      els.history.append(empty);
      return;
    }
    drawnNames.forEach((name) => {
      const player = players.get(name);
      if (!player) return;
      const chip = document.createElement('span');
      chip.className = 'history-chip';
      const image = document.createElement('img');
      image.src = player.icon;
      image.alt = '';
      image.loading = 'lazy';
      image.onerror = () => { image.onerror = null; image.src = fallbackPlayer.icon; };
      const text = document.createElement('span');
      text.className = 'history-name rainbow-text';
      text.textContent = player.name;
      chip.append(image, text);
      els.history.append(chip);
    });
  }

  function renderReelRows(names, winnerIndex) {
    els.track.replaceChildren();
    const fragment = document.createDocumentFragment();
    names.forEach((player) => {
      const row = document.createElement('div');
      row.className = 'reel-row';
      row.setAttribute('aria-hidden', 'true');
      const image = document.createElement('img');
      image.src = player.icon;
      image.alt = '';
      const text = document.createElement('span');
      text.className = 'rainbow-text';
      text.textContent = player.name;
      row.append(image, text);
      fragment.append(row);
    });
    els.track.append(fragment);
    els.placeholder.hidden = true;
    els.track.hidden = false;
    els.track.style.transition = 'none';
    const centerOffset = (els.reel.clientHeight - ROW_HEIGHT) / 2;
    els.track.style.transform = `translateY(${centerOffset}px)`;
    void els.track.offsetHeight;
    requestAnimationFrame(() => {
      const duration = Math.max(0, state.pendingDraw.endAt - Date.now());
      els.track.style.transition = `transform ${duration}ms cubic-bezier(.08,.72,.12,1)`;
      els.track.style.transform = `translateY(${centerOffset - winnerIndex * ROW_HEIGHT}px)`;
    });
  }

  function finishDraw(winnerName) {
    if (!state.pendingDraw || state.pendingDraw.winnerName !== winnerName) return;
    state.remaining = state.remaining.filter((name) => name !== winnerName);
    if (!state.history.includes(winnerName)) state.history.push(winnerName);
    state.pendingDraw = null;
    saveState();
    const left = state.remaining.length;
    els.drawStatus.replaceChildren();
    if (left === 0) {
      els.drawStatus.textContent = `${winnerName} was the last name! Everyone has been picked.`;
    } else {
      const label = document.createElement('span');
      label.textContent = 'Picked ';
      const name = document.createElement('strong');
      name.className = 'rainbow-text';
      name.textContent = winnerName;
      const rest = document.createTextNode(` · ${left} ${left === 1 ? 'name' : 'names'} left`);
      els.drawStatus.append(label, name, rest);
    }
    renderHistory();
    updateDrawUI();
  }

  function startAnimation(winnerName) {
    const winner = players.get(winnerName);
    if (!winner) return;
    const rows = [];
    for (let i = 0; i < 42; i++) {
      const name = state.remaining[Math.floor(Math.random() * state.remaining.length)];
      rows.push(players.get(name));
    }
    rows.push(winner);
    renderReelRows(rows, rows.length - 1);
    const timeLeft = Math.max(0, state.pendingDraw.endAt - Date.now());
    window.setTimeout(() => finishDraw(winnerName), timeLeft);
  }

  function drawName() {
    if (state.pendingDraw) return;
    if (state.originalGroup === null) {
      state.originalGroup = [...selected];
      state.remaining = [...state.originalGroup];
      state.history = [];
    }
    if (!state.remaining.length) return;
    const winnerName = state.remaining[Math.floor(Math.random() * state.remaining.length)];
    state.pendingDraw = { winnerName, endAt: Date.now() + DRAW_DURATION };
    saveState();
    els.drawStatus.textContent = 'The next name is…';
    updateDrawUI();
    startAnimation(winnerName);
  }

  function showDrawState() {
    renderHistory();
    updateDrawUI();
    if (state.pendingDraw) {
      els.drawStatus.textContent = 'The next name is…';
      startAnimation(state.pendingDraw.winnerName);
    } else if (state.originalGroup !== null && state.remaining.length === 0) {
      els.placeholder.textContent = 'Everyone has been picked';
      els.drawStatus.textContent = 'Everyone has been picked. Choose Start over to draw this group again.';
    } else if (state.history.length) {
      els.placeholder.textContent = 'Ready for the next name';
      els.drawStatus.textContent = `${state.history.length} picked · ${state.remaining.length} names left.`;
    } else {
      els.placeholder.textContent = 'Tap Draw a name to begin';
      els.drawStatus.textContent = `${selected.size} players selected. Ready to draw.`;
    }
  }

  function startOver() {
    if (state.originalGroup === null || state.pendingDraw !== null) return;
    selected = new Set(state.originalGroup);
    state.originalGroup = null;
    state.remaining = [];
    state.history = [];
    state.pendingDraw = null;
    saveState();
    renderPlayers();
    els.groupStatus.textContent = 'Group restored. You can edit it before drawing again.';
  }

  function initGroupPage() {
    renderPlayers();
    if (state.originalGroup !== null) {
      els.groupStatus.textContent = state.pendingDraw
        ? 'A draw is in progress. Wait for it to finish, then use Start over to edit the group.'
        : 'This group is locked after drawing starts. Use Start over to restore it before editing.';
    } else {
      els.groupStatus.textContent = `${selected.size} selected. New players are included automatically.`;
    }

    els.search.addEventListener('input', renderPlayers);
    els.selectAll.addEventListener('click', () => {
      const query = els.search.value.trim().toLocaleLowerCase();
      [...players.values()].filter((player) => `${player.name} ${player.avatar}`.toLocaleLowerCase().includes(query)).forEach((player) => selected.add(player.name));
      saveState();
      renderPlayers();
    });
    els.clearAll.addEventListener('click', () => {
      selected.clear();
      saveState();
      renderPlayers();
    });
    els.addForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const name = els.addInput.value.trim();
      if (!name) { els.addInput.focus(); return; }
      const existing = [...players.keys()].find((playerName) => playerName.toLocaleLowerCase() === name.toLocaleLowerCase());
      if (existing) {
        els.groupStatus.textContent = `${existing} is already in the player list.`;
        els.search.value = existing;
        renderPlayers();
        return;
      }
      const player = createPlayer(name, fallbackPlayer);
      players.set(name, player);
      state.customPlayers.push(player);
      selected.add(name);
      els.addInput.value = '';
      els.search.value = '';
      saveState();
      renderPlayers();
      els.groupStatus.textContent = `${name} added and selected.`;
    });
    els.reset.addEventListener('click', startOver);
  }

  function normalizeSavedState(saved) {
    state.customPlayers = Array.isArray(saved.customPlayers) ? saved.customPlayers : [];
    state.customPlayers.forEach((player) => {
      if (player && typeof player.name === 'string' && !players.has(player.name)) {
        players.set(player.name, createPlayer(player.name, player));
      }
    });
    const valid = (names) => Array.isArray(names) ? [...new Set(names)].filter((name) => players.has(name)) : [];
    selected = new Set(Array.isArray(saved.selected) ? valid(saved.selected) : [...players.keys()]);
    state.selected = [...selected];
    state.originalGroup = Array.isArray(saved.originalGroup) ? valid(saved.originalGroup) : null;
    state.history = valid(saved.history);
    if (state.originalGroup !== null) {
      const drawn = new Set(state.history);
      state.remaining = Array.isArray(saved.remaining)
        ? valid(saved.remaining).filter((name) => state.originalGroup.includes(name) && !drawn.has(name))
        : state.originalGroup.filter((name) => !drawn.has(name));
      state.pendingDraw = saved.pendingDraw && state.remaining.includes(saved.pendingDraw.winnerName)
        ? saved.pendingDraw
        : null;
    } else {
      state.remaining = [];
      state.history = [];
      state.pendingDraw = null;
    }
  }

  async function init() {
    try {
      const response = await fetch('players.json', { cache: 'no-store' });
      if (!response.ok) throw new Error(`Could not load players.json (${response.status}).`);
      const data = await response.json();
      fallbackPlayer = data.fallback || fallbackPlayer;
      Object.entries(data).forEach(([name, player]) => {
        if (name.toLocaleLowerCase() !== 'fallback') players.set(name, createPlayer(name, player || {}));
      });
      normalizeSavedState(readSavedState());
      if (page === 'group') initGroupPage();
      if (page === 'draw') {
        document.querySelector('#draw-button').addEventListener('click', drawName);
        showDrawState();
      }
    } catch (error) {
      if (els.error) {
        els.error.hidden = false;
        els.error.textContent = `${error.message} Open these pages through a local web server so they can load players.json and the SVG icons.`;
      }
      if (els.draw) els.draw.disabled = true;
      if (els.listCount) els.listCount.textContent = 'Could not load players';
    }
  }

  init();
})();
