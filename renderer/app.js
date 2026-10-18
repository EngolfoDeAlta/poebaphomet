// PoeBaphomet — lógica da interface (pt-BR)
const api = window.poebaphomet;

const $ = (id) => document.getElementById(id);

const els = {
  gamePath: $('game-path'),
  gameHint: $('game-hint'),
  btnDetect: $('btn-detect'),
  btnBrowse: $('btn-browse'),
  btnApply: $('btn-apply'),
  btnRestore: $('btn-restore'),
  spinner: $('spinner'),
  log: $('log'),
  zoom: $('zoom'),
  zoomLevel: $('zoom-level'),
  zoomNum: $('zoom-num'),
  btnColorMods: $('btn-colormods'),
  colorModsModal: $('colormods-modal'),
  colorModsBody: $('colormods-body'),
  colorModsClose: $('colormods-close'),
  colorModsOk: $('colormods-ok'),
  progressCard: $('progress-card'),
  progressBar: $('progress-bar'),
  progressText: $('progress-text'),
};

const patchIds = [
  'minimap', 'monsterhp', 'colormods', 'fog', 'envparticles', 'shadow',
  'light', 'corpse', 'delirium', 'particles', 'effects',
];

const COLOR_LABELS = {
  red: 'Vermelho',
  green: 'Verde',
  blue: 'Azul',
  yellow: 'Amarelo',
  pink: 'Rosa',
};
const COLOR_ORDER = ['red', 'green', 'blue', 'yellow', 'pink'];

let currentGamePath = null;
let busy = false;
let colorModsCategories = []; // [{name, items: [{name,color,enabled}]}]
let colorModsState = {};      // modName -> {color, enabled}

function log(msg, cls = '') {
  const line = document.createElement('div');
  if (cls) line.className = cls;
  line.textContent = msg;
  els.log.appendChild(line);
  els.log.scrollTop = els.log.scrollHeight;
}

function setBusy(b) {
  busy = b;
  els.btnApply.disabled = b;
  els.btnRestore.disabled = b || !api;
  els.spinner.classList.toggle('hidden', !b);
  if (!b) {
    setTimeout(() => {
      if (!busy) els.progressCard.classList.add('hidden');
    }, 2500);
  }
}

function buildColorModsOptions() {
  const out = [];
  for (const cat of colorModsCategories) {
    for (const item of cat.items) {
      const st = colorModsState[item.name] || { color: item.color, enabled: item.enabled };
      out.push([item.name, st.color, st.enabled]);
    }
  }
  return out;
}

function buildConfig() {
  const cfg = { zoom: els.zoom.checked, zoomLevel: parseFloat(els.zoomNum.value) || 2.4 };
  for (const id of patchIds) cfg[id] = $(id).checked;
  cfg.colormodsOptions = buildColorModsOptions();
  return cfg;
}

function anySelected() {
  const cfg = buildConfig();
  return cfg.zoom || patchIds.some((id) => cfg[id]);
}

function updateGameHint() {
  if (!currentGamePath) {
    els.gameHint.textContent = 'Nenhuma pasta do jogo selecionada.';
    els.btnRestore.disabled = true;
    return;
  }
  api.backupExists(currentGamePath).then((hasBak) => {
    els.btnRestore.disabled = hasBak ? false : true;
    els.gameHint.textContent = hasBak
      ? 'Jogo detectado. Há um backup criado — "Restaurar original" está disponível.'
      : 'Jogo detectado. O backup será criado na primeira aplicação.';
  });
}

async function detect() {
  const p = await api.detectGame();
  if (p) {
    currentGamePath = p;
    els.gamePath.value = p;
    log('Jogo encontrado em: ' + p, 'ok');
  } else {
    log('Não encontrei o jogo automaticamente. Use "Procurar…" para selecionar a pasta.', 'err');
  }
  updateGameHint();
}

async function browse() {
  const p = await api.browseGame();
  if (!p) return;
  const valid = await api.validateGame(p);
  if (!valid) {
    log('A pasta selecionada não contém Bundles2\\_.index.bin.', 'err');
    return;
  }
  currentGamePath = p;
  els.gamePath.value = p;
  log('Pasta do jogo definida: ' + p, 'ok');
  updateGameHint();
}

async function apply() {
  if (busy) return;
  if (!currentGamePath) { log('Selecione a pasta do jogo primeiro.', 'err'); return; }
  if (!anySelected()) { log('Marque pelo menos um patch.', 'err'); return; }
  setBusy(true);
  log('Aplicando patches...');
  const cfg = buildConfig();
  try {
    const res = await api.apply(currentGamePath, cfg);
    if (res.ok) {
      log(`Concluído! ${res.files.toLocaleString('pt-BR')} arquivo(s) alterado(s). Feche e reabra o jogo para ver o efeito.`, 'ok');
    } else {
      log('Erro: ' + res.message, 'err');
    }
  } catch (e) {
    log('Erro inesperado: ' + e, 'err');
  }
  setBusy(false);
  updateGameHint();
}

async function restore() {
  if (busy) return;
  if (!currentGamePath) { log('Selecione a pasta do jogo primeiro.', 'err'); return; }
  setBusy(true);
  log('Restaurando o original...');
  try {
    const res = await api.restore(currentGamePath);
    if (res.ok) log('Jogo restaurado ao estado original.', 'ok');
    else log('Erro: ' + res.message, 'err');
  } catch (e) {
    log('Erro inesperado: ' + e, 'err');
  }
  setBusy(false);
  updateGameHint();
}

// ---- configuração de cores de mods ----
function loadColorModsState() {
  try {
    const saved = JSON.parse(localStorage.getItem('poebaphomet.colormods') || 'null');
    if (saved && typeof saved === 'object') colorModsState = saved;
  } catch { /* ignora */ }
}

function saveColorModsState() {
  try { localStorage.setItem('poebaphomet.colormods', JSON.stringify(colorModsState)); } catch { /* ignora */ }
}

function renderColorModsModal() {
  const body = els.colorModsBody;
  body.textContent = '';
  for (const cat of colorModsCategories) {
    const title = document.createElement('div');
    title.className = 'cm-category';
    title.textContent = cat.name;
    body.appendChild(title);

    for (const item of cat.items) {
      const st = colorModsState[item.name] || { color: item.color, enabled: item.enabled };
      const row = document.createElement('div');
      row.className = 'cm-row';

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = !!st.enabled;
      cb.addEventListener('change', () => {
        const cur = colorModsState[item.name] || { color: item.color, enabled: item.enabled };
        colorModsState[item.name] = { color: cur.color, enabled: cb.checked };
        saveColorModsState();
      });

      const name = document.createElement('span');
      name.className = 'cm-name';
      name.textContent = item.name;
      name.title = item.name;

      const sel = document.createElement('select');
      for (const c of COLOR_ORDER) {
        const opt = document.createElement('option');
        opt.value = c;
        opt.textContent = COLOR_LABELS[c];
        if (c === st.color) opt.selected = true;
        sel.appendChild(opt);
      }
      sel.addEventListener('change', () => {
        colorModsState[item.name] = { ...colorModsState[item.name], color: sel.value };
        saveColorModsState();
      });

      row.appendChild(cb);
      row.appendChild(name);
      row.appendChild(sel);
      body.appendChild(row);
    }
  }
}

function openColorModsModal() {
  renderColorModsModal();
  els.colorModsModal.classList.remove('hidden');
}

function closeColorModsModal() {
  els.colorModsModal.classList.add('hidden');
}

// zoom: sincroniza slider <-> número; desabilita quando o patch está desmarcado
els.zoom.addEventListener('change', () => {
  els.zoomLevel.disabled = !els.zoom.checked;
  els.zoomNum.disabled = !els.zoom.checked;
});
els.zoomLevel.addEventListener('input', () => { els.zoomNum.value = els.zoomLevel.value; });
els.zoomNum.addEventListener('input', () => { els.zoomLevel.value = els.zoomNum.value; });

els.btnDetect.addEventListener('click', detect);
els.btnBrowse.addEventListener('click', browse);
els.btnApply.addEventListener('click', apply);
els.btnRestore.addEventListener('click', restore);
els.btnColorMods.addEventListener('click', openColorModsModal);
els.colorModsClose.addEventListener('click', closeColorModsModal);
els.colorModsOk.addEventListener('click', closeColorModsModal);
els.colorModsModal.addEventListener('click', (e) => {
  if (e.target === els.colorModsModal) closeColorModsModal();
});

api.onProgress(({ phase, detail, percent }) => {
  // barra de progresso
  if (phase === 'done') {
    els.progressBar.style.width = '100%';
    els.progressText.textContent = detail || 'Concluído.';
    els.progressBar.classList.add('indeterminate', 'finished');
  } else if (percent != null) {
    els.progressCard.classList.remove('hidden');
    els.progressBar.classList.remove('indeterminate', 'finished');
    els.progressBar.style.width = (percent * 100).toFixed(1) + '%';
    els.progressText.textContent = detail || phase;
  } else {
    els.progressCard.classList.remove('hidden');
    els.progressBar.classList.remove('finished');
    els.progressBar.classList.add('indeterminate');
    els.progressText.textContent = detail || phase;
  }
  if (detail) log(detail);
});

// inicial
loadColorModsState();
api.getColorMods().then((cats) => {
  colorModsCategories = cats;
});
detect();
