(() => {
  const STORAGE_KEY = 'name-draw-state-v1';
  const DRAW_DURATION = 5000;
  const ROW_HEIGHT = 82;
  let ambientTimer = null;
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
    selectedList: document.querySelector('#selected-list'),
    listCount: document.querySelector('#list-count'),
    selectedCount: document.querySelector('#selected-count'),
    search: document.querySelector('#search-input'),
    addForm: document.querySelector('#add-form'),
    addInput: document.querySelector('#add-input'),
    clearAll: document.querySelector('#clear-all'),
    groupStatus: document.querySelector('#group-status'),
    reset: document.querySelector('#reset-button'),
    draw: document.querySelector('#draw-button'),
    drawReset: document.querySelector('#draw-reset-button'),
    drawLabel: document.querySelector('#draw-button-label'),
    drawStatus: document.querySelector('#draw-status'),
    drawGroupCount: document.querySelector('#draw-group-count'),
    reel: document.querySelector('#reel'),
    track: document.querySelector('#reel-track'),
    placeholder: document.querySelector('#reel-placeholder'),
    selection: document.querySelector('.selection-window'),
    history: document.querySelector('#history-list'),
    historyCount: document.querySelector('#history-count')
  };

  function initAmbientSky() {
    const sky = document.querySelector('.ambient-sky');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!sky) return;
    const colors = ['#e8edff', '#dce8ff', '#fff1db', '#d9d4ff'];
    const starCount = Math.min(150, Math.max(75, Math.round(window.innerWidth * window.innerHeight / 5000)));

    for (let index = 0; index < starCount; index++) {
      const star = document.createElement('span');
      star.className = `ambient-star${!reducedMotion.matches && Math.random() < 0.35 ? ' twinkle' : ''}`;
      star.style.left = `${Math.random() * 100}%`;
      star.style.top = `${Math.random() * 100}%`;
      star.style.setProperty('--star-color', colors[Math.floor(Math.random() * colors.length)]);
      star.style.setProperty('--star-size', `${1 + Math.random() * 1.25}px`);
      star.style.setProperty('--star-opacity', `${0.25 + Math.random() * 0.5}`);
      star.style.setProperty('--twinkle-time', `${4 + Math.random() * 6}s`);
      sky.append(star);
    }

    const streakColors = ['#ff647c', '#ffb454', '#ffe56d', '#70e6b0', '#69caff', '#a88cff', '#ff79d2'];
    function scheduleStreak() {
      if (document.hidden || reducedMotion.matches) return;
      const streak = document.createElement('span');
      streak.className = 'shooting-star';
      streak.style.left = `${Math.random() * 100}%`;
      streak.style.top = `${Math.random() * 100}%`;
      streak.style.setProperty('--star-color', streakColors[Math.floor(Math.random() * streakColors.length)]);
      const angle = Math.random() * 360;
      const radians = angle * Math.PI / 180;
      const distance = 110 + Math.random() * 230;
      streak.style.setProperty('--star-angle', `${angle}deg`);
      streak.style.setProperty('--star-dx', `${Math.cos(radians) * distance}px`);
      streak.style.setProperty('--star-dy', `${Math.sin(radians) * distance}px`);
      streak.style.setProperty('--star-length', `${55 + Math.random() * 150}px`);
      streak.style.setProperty('--star-width', `${1 + Math.random() * 1.5}px`);
      streak.style.setProperty('--flight-time', `${1.8 + Math.random() * 2.2}s`);
      streak.addEventListener('animationend', () => streak.remove(), { once: true });
      sky.append(streak);
      ambientTimer = window.setTimeout(scheduleStreak, 600 + Math.random() * 1100);
    }

    document.addEventListener('visibilitychange', () => {
      window.clearTimeout(ambientTimer);
      if (!document.hidden && !reducedMotion.matches) scheduleStreak();
    });
    reducedMotion.addEventListener?.('change', () => {
      window.clearTimeout(ambientTimer);
      sky.querySelectorAll('.shooting-star').forEach((streak) => streak.remove());
      if (!reducedMotion.matches && !document.hidden) scheduleStreak();
    });
    scheduleStreak();
  }

  function createPlayer(name, data = {}) {
    return { name, avatar: data.avatar || name, icon: data.icon || fallbackPlayer.icon };
  }

  function updateSelectionPosition() {
    if (!els.reel) return;
    const header = document.querySelector('.draw-topbar');
    const footer = document.querySelector('.draw-bottom');
    if (!header || !footer) return;
    const reelBounds = els.reel.getBoundingClientRect();
    const freeSpaceCenter = (header.getBoundingClientRect().bottom + footer.getBoundingClientRect().top) / 2;
    els.reel.style.setProperty('--selection-center', `${freeSpaceCenter - reelBounds.top}px`);
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
    els.clearAll.disabled = locked;
    els.list.querySelectorAll('.player-card').forEach((button) => { button.disabled = locked; });
    document.querySelectorAll('#selected-list .player-card').forEach((button) => { button.disabled = locked; });
    els.reset.disabled = state.originalGroup === null || state.pendingDraw !== null;
  }

  function updateDrawUI() {
    const activeGroup = state.originalGroup !== null;
    const remaining = activeGroup ? state.remaining.length : selected.size;
    if (els.drawGroupCount) els.drawGroupCount.textContent = String(selected.size);
    if (els.drawReset) els.drawReset.disabled = !activeGroup || state.pendingDraw !== null;
    if (!els.draw) return;
    els.draw.disabled = Boolean(state.pendingDraw) || remaining === 0;
    if (state.pendingDraw) {
      els.drawLabel.textContent = 'Picking…';
    } else if (activeGroup && remaining === 0) {
      els.drawLabel.textContent = 'Everyone has been picked';
    } else {
      els.drawLabel.textContent = state.history.length ? 'Pick next name' : 'Pick a name';
    }
  }

  function updateGroupUI() {
    if (!els.list) return;
    const query = els.search.value.trim().toLocaleLowerCase();
    const availableCount = [...players.values()].filter((player) => !selected.has(player.name) && `${player.name} ${player.avatar}`.toLocaleLowerCase().includes(query)).length;
    els.selectedCount.textContent = `${selected.size} selected`;
    els.listCount.textContent = `${availableCount} available`;
    setGroupControlsLocked(state.originalGroup !== null);
  }

  function makePlayerCard(player, isSelected) {
    const card = document.createElement('button');
    card.type = 'button';
    const wasDrawn = state.history.includes(player.name);
    card.className = `player-card${isSelected ? ' selected' : ''}${wasDrawn ? ' drawn' : ''}`;
    card.setAttribute('aria-label', `${isSelected ? 'Remove' : 'Add'} ${player.name} ${isSelected ? 'from' : 'to'} group`);
    card.disabled = state.originalGroup !== null;

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
    copy.append(name);

    const action = document.createElement('span');
    action.className = 'player-action';
    action.textContent = isSelected ? '−' : '+';
    action.setAttribute('aria-hidden', 'true');
    card.addEventListener('click', () => {
      card.blur();
      togglePlayer(player.name);
    });
    card.append(image, copy, action);
    return card;
  }

  function togglePlayer(name) {
    if (state.originalGroup !== null) return;
    selected.has(name) ? selected.delete(name) : selected.add(name);
    saveState();
    renderPlayers();
  }

  function renderPlayers() {
    if (!els.list) return;
    const query = els.search.value.trim().toLocaleLowerCase();
    const selectedPlayers = [...players.values()].filter((player) => selected.has(player.name));
    const visible = [...players.values()].filter((player) => !selected.has(player.name) && `${player.name} ${player.avatar}`.toLocaleLowerCase().includes(query));
    els.selectedList.replaceChildren();
    els.list.replaceChildren();
    if (!selectedPlayers.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-list selected-empty';
      empty.textContent = 'No players selected yet. Add names from the library below.';
      els.selectedList.append(empty);
    } else {
      selectedPlayers.forEach((player) => els.selectedList.append(makePlayerCard(player, true)));
    }
    if (!visible.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-list';
      empty.textContent = query ? 'No available players match your search.' : 'Everyone in the library is already selected.';
      els.list.append(empty);
    } else {
      visible.forEach((player) => els.list.append(makePlayerCard(player, false)));
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
      empty.textContent = 'Names you pick will appear here';
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
    names.forEach((player, index) => {
      const row = document.createElement('div');
      row.className = `reel-row${index === winnerIndex ? ' winner-row' : ''}`;
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
    const reelBounds = els.reel.getBoundingClientRect();
    const selectionBounds = els.selection.getBoundingClientRect();
    const centerOffset = selectionBounds.top + selectionBounds.height / 2 - reelBounds.top - ROW_HEIGHT / 2;
    els.track.style.transform = `translateY(${centerOffset}px)`;
    const endAt = state.pendingDraw?.endAt;
    if (endAt === undefined) return;
    void els.track.offsetHeight;
    requestAnimationFrame(() => {
      if (!state.pendingDraw || state.pendingDraw.endAt !== endAt) return;
      const duration = Math.max(0, endAt - Date.now());
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
    els.track.querySelector('.winner-row')?.classList.add('winner-reveal');
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
    updateSelectionPosition();
  }

  function shuffled(names) {
    const result = [...names];
    for (let index = result.length - 1; index > 0; index--) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
    }
    return result;
  }

  function startAnimation(winnerName) {
    const winner = players.get(winnerName);
    if (!winner) return;
    const cycle = shuffled(state.remaining);
    const rowCount = Math.max(42, state.remaining.length + 18);
    const winnerIndex = rowCount - 10;
    const winnerOffset = cycle.indexOf(winnerName);
    const startOffset = (winnerOffset - winnerIndex % cycle.length + cycle.length) % cycle.length;
    const rows = Array.from({ length: rowCount }, (_, index) => {
      const name = cycle[(startOffset + index) % cycle.length];
      return players.get(name);
    });
    renderReelRows(rows, winnerIndex);
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
    updateSelectionPosition();
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
      els.drawStatus.textContent = 'Everyone has been picked. Choose Start over to pick from this group again.';
    } else if (state.history.length) {
      els.placeholder.textContent = 'Ready for the next name';
      els.drawStatus.textContent = `${state.history.length} picked · ${state.remaining.length} names left.`;
    } else if (selected.size === 0) {
      els.placeholder.textContent = 'Choose players to get started';
      els.drawStatus.textContent = 'Select players on the group page to start picking.';
    } else {
      els.placeholder.textContent = 'Tap Pick a name to begin';
      els.drawStatus.textContent = `${selected.size} players selected. Ready to pick.`;
    }
    updateSelectionPosition();
  }

  function startOver() {
    if (state.originalGroup === null || state.pendingDraw !== null) return;
    selected = new Set(state.originalGroup);
    state.originalGroup = null;
    state.remaining = [];
    state.history = [];
    state.pendingDraw = null;
    saveState();
    if (els.track) {
      els.track.hidden = true;
      els.track.replaceChildren();
    }
    if (els.placeholder) {
      els.placeholder.hidden = false;
      els.placeholder.textContent = 'Tap Pick a name to begin';
    }
    if (els.drawStatus) els.drawStatus.textContent = 'Group restored. Ready when you are.';
    if (els.history) renderHistory();
    if (els.list) {
      renderPlayers();
      els.groupStatus.textContent = 'Group restored. You can edit it before picking again.';
    }
    updateDrawUI();
    updateSelectionPosition();
  }

  function initGroupPage() {
    renderPlayers();
    if (state.originalGroup !== null) {
      els.groupStatus.textContent = state.pendingDraw
        ? 'A name pick is in progress. Wait for it to finish, then use Start over to edit the group.'
        : 'This group is locked after picking starts. Use Start over to restore it before editing.';
    } else {
      els.groupStatus.textContent = `${selected.size} selected. New players are included automatically.`;
    }

    els.search.addEventListener('input', renderPlayers);
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
    selected = new Set(Array.isArray(saved.selected) ? valid(saved.selected) : []);
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
        els.drawReset.addEventListener('click', startOver);
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

  initAmbientSky();
  window.addEventListener('resize', updateSelectionPosition);
  init();
})();
