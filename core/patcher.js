// ============================================================================
// PoeBaphomet � núcleo de patches para Path of Exile 1 (Bundles2)
// ============================================================================
import { Index } from 'poe-bundle-lib';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const BOM = Buffer.from([0xff, 0xfe]);

// ---------------------------------------------------------------- helpers ---
export function isGameRunning() {
  try {
    for (const name of ['PathOfExileSteam.exe', 'PathOfExile_x64.exe', 'PathOfExile_x64Steam.exe', 'PathOfExile.exe']) {
      const out = execSync(`tasklist /FI "IMAGENAME eq ${name}" /NH`, { encoding: 'utf8', windowsHide: true });
      if (/pathofexile/i.test(out)) return true;
    }
  } catch { /* ignora */ }
  return false;
}
function decodeU16(buf) {
  const hasBom = buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe;
  const start = hasBom ? 2 : 0;
  return { text: buf.subarray(start).toString('utf16le'), hasBom };
}
function encodeU16(text, hasBom = true) {
  const body = Buffer.from(text, 'utf16le');
  return hasBom ? Buffer.concat([BOM, body]) : body;
}

// Caminhos comuns do jogo (PoE1)
const COMMON_PATHS = [
  'C:/Program Files (x86)/Steam/steamapps/common/Path of Exile',
  'C:/Program Files (x86)/Grinding Gear Games/Path of Exile',
  'C:/Program Files/Steam/steamapps/common/Path of Exile',
  'C:/Program Files/Grinding Gear Games/Path of Exile',
  'D:/SteamLibrary/steamapps/common/Path of Exile',
  'D:/Program Files (x86)/Grinding Gear Games/Path of Exile',
];

export function detectGamePath() {
  for (const p of COMMON_PATHS) {
    if (fs.existsSync(path.join(p, 'Bundles2', '_.index.bin'))) return p;
  }
  return null;
}

export function isValidGamePath(p) {
  if (!p) return false;
  return fs.existsSync(path.join(p, 'Bundles2', '_.index.bin'));
}

export function backupExists(p) {
  if (!p) return false;
  return fs.existsSync(path.join(p, 'Bundles2', '_.index.bin.poebaphomet.bak'));
}

// -------------------------------------------------------------- core flow ---
export function applyPatches(gamePath, config, onProgress = () => {}) {
  if (isGameRunning()) {
    throw new Error('O jogo está aberto. Feche o Path of Exile antes de aplicar os patches.');
  }
  const bundles = path.join(gamePath, 'Bundles2');
  const idxPath = path.join(bundles, '_.index.bin');
  if (!fs.existsSync(idxPath)) {
    throw new Error('Índice do jogo não encontrado em: ' + idxPath);
  }
  const bak = idxPath + '.poebaphomet.bak';
  const custom = path.join(bundles, 'LibGGPK3', '0.bundle.bin');

  // SEMPRE parte de um estado limpo: restaura o índice original (se já há backup)
  // e remove qualquer bundle custom órfão, para nunca reutilizar dados defasados.
  if (fs.existsSync(bak)) {
    onProgress('restore', 'Preparando estado limpo (restaurando original)...');
    fs.copyFileSync(bak, idxPath);
  } else {
    fs.copyFileSync(idxPath, bak);
    onProgress('backup', 'Backup do índice original criado.');
  }
  if (fs.existsSync(custom)) {
    try {
      fs.rmSync(custom, { force: true });
    } catch {
      throw new Error('Não foi possível remover o bundle custom (arquivo em uso?). Feche o jogo e tente de novo.');
    }
  }

  onProgress('open', 'Abrindo o índice do jogo (isso pode levar alguns segundos)...');
  const idx = new Index(idxPath, { parsePaths: true });

  const stats = { files: 0 };
  const handlers = buildHandlers(config, stats, onProgress);

  // handlers que percorrem o índice sozinhos (câmera)
  for (const h of handlers) {
    if (h.run) {
      onProgress('patch', `Aplicando: ${h.name}...`);
      h.run(idx);
    }
  }

  // varredura única por arquivo para os demais patches
  onProgress('scan', 'Varrendo os arquivos do jogo...');
  let i = 0;
  const total = idx.Files.size;
  for (const [, fr] of idx.Files) {
    const p = fr.Path;
    if (p) {
      for (const h of handlers) {
        if (h.apply && h.should(p)) h.apply(fr);
      }
    }
    if (++i % 250000 === 0) {
      onProgress('scan', `Varrendo... ${i.toLocaleString('pt-BR')}/${total.toLocaleString('pt-BR')}`, i / total);
    }
  }

  onProgress('save', 'Salvando alterações no bundle...');
  idx.Save();
  idx.Dispose();
  onProgress('done', `Pronto! ${stats.files.toLocaleString('pt-BR')} arquivo(s) alterado(s).`);
  return stats;
}

export function restoreOriginal(gamePath, onProgress = () => {}) {
  if (isGameRunning()) {
    throw new Error('O jogo está aberto. Feche o Path of Exile antes de restaurar.');
  }
  const bundles = path.join(gamePath, 'Bundles2');
  const idxPath = path.join(bundles, '_.index.bin');
  const bak = idxPath + '.poebaphomet.bak';
  if (!fs.existsSync(bak)) {
    throw new Error('Nenhum backup encontrado para restaurar.');
  }
  onProgress('restore', 'Restaurando o índice original...');
  fs.copyFileSync(bak, idxPath);
  const custom = path.join(bundles, 'LibGGPK3', '0.bundle.bin');
  if (fs.existsSync(custom)) {
    try {
      fs.rmSync(custom, { force: true });
    } catch {
      throw new Error('Não foi possível remover o bundle custom (arquivo em uso?). Feche o jogo e tente de novo.');
    }
  }
  onProgress('done', 'Jogo restaurado ao estado original.');
}

// -------------------------------------------------- constantes dos patches ---
const CAMERA_FUNCTIONS = [
  'CreateCameraZoomNode', 'ClearCameraZoomNodes', 'CreateCameraLookAtNode',
  'CreateCameraPanNode', 'ClearCameraPanNode', 'ClearCameraPanNodes',
  'SetCustomCameraSpeed', 'RemoveCustomCameraSpeed', 'FaceCamera',
];

const PARTICLES_PATH_PROTECT = [
  'metadata/particles/monster_effects/league_legion/rewardsystem',
  'metadata/particles/monster_effects/league_legion/endgame',
  'metadata/particles/monster_effects/league_delve/general',
  'metadata/particles/monster_effects/atlasexiles/adjudicator',
  'metadata/particles/monster_effects/atlasexiles/adjudicatormonsters',
  'metadata/particles/enviro_effects/act3/blood_temple',
  'metadata/particles/ground_effects_v2/smoke_blind_chimera',
  'metadata/particles/monster_effects/atlasofworldsbosses/chimera',
  'metadata/particles/monster_effects/atlasexiles/orion',
];

const EFFECTS_CLIENT_KEEP = ['ClientAnimationController', 'SoundEvents', 'BoneGroups', 'AnimatedRender', 'SkinMesh'];

const EFFECTS_PATH_PROTECT = [
  'metadata/effects/spells/monsters_effects/league_expedition/dynamic_marker',
  'metadata/effects/spells/monsters_effects/atlasofworldsbosses',
  'metadata/effects/spells/monsters_effects/league_azmeri/guiding_light',
  'metadata/effects/spells/monsters_effects/league_azmeri/monster_fx',
  'metadata/effects/spells/monsters_effects/league_azmeri/resources/affecting_area',
  'metadata/effects/spells/monsters_effects/league_azmeri/resources/feature_room_dust',
  'metadata/effects/spells/monsters_effects/league_azmeri/resources/guiding_light',
  'metadata/effects/spells/monsters_effects/league_azmeri/resources/wisp_doodads',
  'metadata/effects/spells/monsters_effects/league_legion/rewardsystem',
  'metadata/effects/spells/monsters_effects/league_blight/rewardsystem',
  'metadata/effects/spells/monsters_effects/league_archnemesis',
  'metadata/effects/spells/monsters_effects/league_ritual/cold_ritual',
  'metadata/effects/spells/monsters_effects/league_ultimatum/mechanics/fx/arena_limit.pet',
  'metadata/effects/spells/monsters_effects/league_sanctum',
  'metadata/effects/spells/monsters_effects/league_hellscape/mechanics',
  'metadata/effects/spells/monsters_effects/atlasofworldsbosses/maven',
  'metadata/effects/spells/monsters_effects/atlasexiles/adjudicator',
  'metadata/effects/spells/ground_effects/chimera_smoke',
  'metadata/effects/spells/ground_effects/evil',
  'metadata/effects/spells/ground_effects_v2/smoke_blind_chimera',
  'metadata/effects/spells/monsters_effects/atlasofworldsbosses/chimera',
  'metadata/effects/spells/monsters_effects/atlasexiles/orion',
  'metadata/effects/spells/monsters_effects/prophecy_league',
  'metadata/effects/spells/ground_effects/caustic',
  'metadata/effects/spells/ground_effects_v2/caustic_arrow_ground',
  'metadata/effects/spells/ground_effects_v2/desecrated',
  'metadata/effects/spells/ground_effects_v2/desecrated_maligaro',
  'metadata/effects/spells/ground_effects_v2/desecrated_red',
  'metadata/effects/spells/ground_effects_v3/caustic',
];

const COLOR_CONVERSIONS = {
  red: 'rgb(209,46,46)',
  green: 'rgb(74,230,58)',
  blue: 'rgb(14,186,255)',
  yellow: 'rgb(255,204,27)',
  pink: 'rgb(227,158,255)',
};

export const COLORMODS_CATEGORIES = [
  {
    name: 'Mapas (mods perigosos)',
    items: [
      ['map_monsters_reflect_%_physical_damage', 'yellow', true],
      ['map_monsters_reflect_%_elemental_damage', 'green', true],
      ['map_player_cannot_expose', 'red', true],
      ['map_players_no_regeneration_including_es', 'red', true],
      ['map_player_non_curse_aura_effect_+%', 'red', true],
      ['map_monsters_avoid_elemental_ailments_%', 'red', true],
      ['map_monsters_cannot_be_leeched_from', 'red', true],
      ['map_monsters_cannot_be_stunned', 'red', true],
      ['map_additional_player_maximum_resistances_%', 'red', true],
      ['map_monsters_are_hexproof', 'red', true],
      ['map_player_cooldown_speed_+%_final', 'red', true],
      ['map_player_life_and_es_recovery_speed_+%_final', 'red', true],
      ['map_ground_orion_meteor', 'red', true],
      ['map_player_create_enemy_meteor_daemon_on_flask_use_%_chance', 'red', true],
      ['map_uber_drowning_orb_ambush', 'red', true],
      ['map_petrificiation_statue_ambush', 'red', true],
      ['map_exarch_traps', 'red', true],
      ['map_packs_have_uber_tentacle_fiends', 'red', true],
      ['map_uber_map_additional_synthesis_boss', 'red', true],
      ['map_monster_add_x_grasping_vines_on_hit', 'red', true],
      ['map_uber_map_player_damage_cycle', 'red', true],
      ['map_player_death_mark_on_rare_unique_kill_ms', 'red', true],
      ['map_uber_sawblades_ambush', 'red', true],
      ['map_rare_monster_volatile_on_death_%', 'red', true],
      ['map_rare_monsters_shaper_touched', 'red', true],
      ['map_supporter_maven_follower', 'red', true],
      ['map_player_global_defences_+%', 'red', true],
      ['map_monsters_base_block_%', 'red', true],
    ],
  },
  {
    name: 'Baús (Strongboxes)',
    items: [
      ['chest_display_explodes_corpses', 'red', true],
      ['chest_display_explosion', 'red', true],
      ['chest_display_freeze', 'red', true],
      ['chest_display_ice_nova', 'red', true],
      ['chest_spawn_rogue_exiles', 'red', true],
    ],
  },
  {
    name: 'Expedição',
    items: [
      ['all_damage_can_freeze', 'red', true],
      ['apply_petrification_for_X_seconds_on_hit', 'red', true],
      ['base_cold_immunity', 'red', true],
      ['base_fire_immunity', 'red', true],
      ['base_lightning_immunity', 'red', true],
      ['chaos_immunity', 'red', true],
      ['physical_immunity', 'red', true],
      ['cannot_have_life_leeched_from', 'red', true],
      ['cannot_have_mana_leeched_from', 'red', true],
    ],
  },
  {
    name: 'Altares',
    items: [
      ['life_mana_es_recovery_rate_+%_per_endurance_charge', 'red', true],
      ['global_defences_+%_per_frenzy_charge', 'red', true],
      ['critical_strike_multiplier_+_per_power_charge', 'red', true],
      ['random_projectile_direction', 'red', true],
      ['chaos_damage_per_minute_while_affected_by_flask', 'red', true],
      ['create_enemy_meteor_daemon_on_flask_use_%_chance', 'red', true],
      ['drain_x_flask_charges_over_time_on_hit_for_6_seconds', 'red', true],
    ],
  },
  {
    name: 'Recompensas valiosas',
    items: [
      ['map_item_drop_quantity_+%', 'pink', true],
      ['map_item_drop_rarity_+%', 'pink', true],
      ['chance_%_to_drop_additional_divine_orb', 'yellow', true],
      ['map_boss_additional_divine_orb_to_drop', 'yellow', true],
      ['%_chance_to_duplicate_dropped_currency', 'blue', true],
      ['%_chance_to_duplicate_dropped_divination_cards', 'blue', true],
      ['%_chance_to_duplicate_dropped_scarabs', 'blue', true],
      ['%_chance_to_duplicate_dropped_uniques', 'blue', true],
    ],
  },
];

export const DEFAULT_COLORMODS = COLORMODS_CATEGORIES.flatMap((c) => c.items);

// --------------------------------------------- parser leve de blocos { } ----
function skipSyntax(text, i) {
  const c = text[i];
  if (c === '"') {
    for (let j = i + 1; j < text.length; j++) {
      if (text[j] === '\\' && j + 1 < text.length) { j++; continue; }
      if (text[j] === '"') return j + 1;
    }
    return text.length;
  }
  if (c === '/' && i + 1 < text.length && text[i + 1] === '/') {
    const nl = text.indexOf('\n', i + 2);
    return nl < 0 ? text.length : nl + 1;
  }
  if (c === '/' && i + 1 < text.length && text[i + 1] === '*') {
    const end = text.indexOf('*/', i + 2);
    return end < 0 ? text.length : end + 2;
  }
  if (c === '[') {
    let depth = 1;
    let j = i + 1;
    while (j < text.length && depth > 0) {
      const cj = text[j];
      if (cj === '"' || (cj === '/' && j + 1 < text.length && (text[j + 1] === '/' || text[j + 1] === '*'))) {
        j = skipSyntax(text, j);
        continue;
      }
      if (cj === '[') depth++;
      else if (cj === ']') depth--;
      j++;
    }
    return j;
  }
  return i + 1;
}

function findMatchingBrace(text, openIndex) {
  let depth = 1;
  let i = openIndex + 1;
  while (i < text.length) {
    const c = text[i];
    if (c === '"' || c === '[' || (c === '/' && i + 1 < text.length && (text[i + 1] === '/' || text[i + 1] === '*'))) {
      i = skipSyntax(text, i);
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return i;
    }
    i++;
  }
  return -1;
}

function findNextSubBlock(text, from) {
  let i = from;
  while (i < text.length) {
    const c = text[i];
    if (c === '"' || c === '[' || (c === '/' && i + 1 < text.length && (text[i + 1] === '/' || text[i + 1] === '*'))) {
      i = skipSyntax(text, i);
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i + 1;
      while (j < text.length && /[A-Za-z0-9_]/.test(text[j])) j++;
      let k = j;
      while (k < text.length && /\s/.test(text[k])) k++;
      if (k < text.length && text[k] === '{') {
        return { nameStart: i, name: text.slice(i, j), openBrace: k };
      }
      i = j;
      continue;
    }
    i++;
  }
  return null;
}

function stripClientBlocks(data, keepSet) {
  let pos = 0;
  let clientOpen = -1;
  let clientClose = -1;
  while (true) {
    const sub = findNextSubBlock(data, pos);
    if (!sub) break;
    if (sub.name === 'client') {
      clientOpen = sub.openBrace;
      clientClose = findMatchingBrace(data, clientOpen);
      break;
    }
    const close = findMatchingBrace(data, sub.openBrace);
    if (close < 0) break;
    pos = close + 1;
  }
  if (clientOpen < 0 || clientClose < 0) return data;

  const body = data.slice(clientOpen + 1, clientClose);
  let result = '';
  let p = 0;
  while (p < body.length) {
    const sub = findNextSubBlock(body, p);
    if (!sub) { result += body.slice(p); break; }
    const close = findMatchingBrace(body, sub.openBrace);
    if (close < 0) { result += body.slice(p); break; }
    const end = close + 1;
    result += body.slice(p, sub.nameStart);
    if (keepSet.includes(sub.name)) {
      result += body.slice(sub.nameStart, end);
    }
    p = end;
  }
  return data.slice(0, clientOpen + 1) + result + data.slice(clientClose);
}

// --------------------------------------------------- implementação por patch ---
function removeCameraCallsFromLine(line) {
  let out = line;
  for (const fn of CAMERA_FUNCTIONS) {
    let pos = 0;
    while ((pos = out.indexOf(fn, pos)) !== -1) {
      let start = pos;
      while (start > 0 && /[\w.]/.test(out[start - 1])) start--;
      let paren = pos + fn.length;
      while (paren < out.length && /\s/.test(out[paren])) paren++;
      if (out[paren] !== '(') { pos++; continue; }
      let depth = 1;
      let end = paren + 1;
      while (end < out.length && depth > 0) {
        if (out[end] === '(') depth++;
        else if (out[end] === ')') depth--;
        end++;
      }
      out = out.slice(0, start) + out.slice(end);
      if (/^\s*;/.test(out.slice(start))) {
        out = out.slice(0, start) + out.slice(start).replace(/^\s*;/, '');
      }
      pos = start;
    }
  }
  return out;
}

function isDeadLine(line) {
  const t = line.trim();
  if (t === '') return true;
  if (/^\{?\s*\}?$/.test(t)) return true;
  if (/^\w[\w.]*\s*=\s*\{\s*\}?\s*$/.test(t)) return true;
  return false;
}

function patchCamera(idx, config, stats, onProgress) {
  const v = parseFloat(config.zoomLevel) || 2.4;
  const levelStr = (Number.isInteger(v) ? v.toFixed(1) : String(v)).replace(',', '.');
  const injection =
    `\ton_initial_position_set = {ClearCameraZoomNodes(); CreateCameraZoomNode(1000000000.0, 1000000000.0, ${levelStr});}`;

  for (const [, fr] of idx.Files) {
    if (fr.Path === 'metadata/characters/character.ot') {
      const { text, hasBom } = decodeU16(fr.Read());
      const lines = text.split('\r\n');
      const ex = lines.findIndex((l) => l.includes('CreateCameraZoomNode'));
      if (ex !== -1) {
        lines[ex] = injection;
      } else {
        const team = lines.findIndex((l) => l.includes('team = 1'));
        if (team !== -1) lines.splice(team + 1, 0, injection);
      }
      fr.Write(encodeU16(lines.join('\r\n'), hasBom));
      stats.files++;
      break;
    }
  }
  for (const [, fr] of idx.Files) {
    const p = fr.Path;
    if (!p || p === 'metadata/characters/character.ot') continue;
    if (!p.startsWith('metadata/') || !/\.otc?$/.test(p)) continue;
    const raw = fr.Read();
    if (!raw.includes(0)) continue;
    const { text, hasBom } = decodeU16(raw);
    if (!CAMERA_FUNCTIONS.some((f) => text.includes(f))) continue;
    const lines = text.split('\r\n');
    const out = [];
    let changed = false;
    for (const l of lines) {
      if (!CAMERA_FUNCTIONS.some((f) => l.includes(f))) { out.push(l); continue; }
      const cleaned = removeCameraCallsFromLine(l);
      changed = true;
      if (!isDeadLine(cleaned)) out.push(cleaned);
    }
    if (changed) {
      fr.Write(encodeU16(out.join('\r\n'), hasBom));
      stats.files++;
    }
  }
}


// ------------------------------------------------ handlers por arquivo -------
function patchMinimapFile(fr, stats) {
  const raw = fr.Read();
  const isUtf16 = raw.includes(0);
  let text = isUtf16 ? raw.toString('utf16le').replace(/^\uFEFF/, '') : raw.toString('utf8');
  const re = /float\s+visibility\s*=\s*saturate\s*\(\s*walkability_sample\.g\s*\*\s*2\.0f?\s*\)\s*;/;
  const mod = text.replace(re, 'float visibility = 1.0f;');
  if (mod !== text) {
    fr.Write(isUtf16 ? Buffer.from('\uFEFF' + mod, 'utf16le') : Buffer.from(mod, 'utf8'));
    stats.files++;
  }
}

function envReplace(fr, stats, pairs) {
  const raw = fr.Read();
  if (!raw.includes(0)) return;
  const { text, hasBom } = decodeU16(raw);
  let mod = text;
  for (const [a, b] of pairs) mod = mod.replaceAll(a, b);
  if (mod !== text) {
    fr.Write(encodeU16(mod, hasBom));
    stats.files++;
  }
}

function patchCorpseFile(fr, stats) {
  const { text, hasBom } = decodeU16(fr.Read());
  let mod = text;
  mod = mod.replace('Life\r\n{\r\n}', 'Life\r\n{\r\n\ton_spawned_dead = {RemoveEffects(); DisableRendering();}\r\n\ton_death = {Delay( 1.0, { DisableRendering(); } );}\r\n}');
  mod = mod.replace('slow_animations_go_to_idle = true\r\n}', 'slow_animations_go_to_idle = true\r\n\ton_start_Revive = {RemoveEffects(); EnableRendering();}\r\n}');
  if (mod !== text) {
    fr.Write(encodeU16(mod, hasBom));
    stats.files++;
  }
}

function patchMonsterHPFile(fr, stats) {
  const { text, hasBom } = decodeU16(fr.Read());
  if (text.includes('base_maximum_energy_shield = 1') || text.includes('base_maximum_life = 1')) return;
  const lines = text.split('\r\n');
  const at = lines.findIndex((l) => l.includes('item_drop_slots = 1'));
  if (at !== -1) {
    lines.splice(at + 1, 0, '\tbase_maximum_life = 1', '\tbase_maximum_energy_shield = 1');
    fr.Write(encodeU16(lines.join('\r\n'), hasBom));
    stats.files++;
  }
}

function patchDeliriumFile(fr, stats) {
  const { text, hasBom } = decodeU16(fr.Read());
  let mod = null;
  if (text.includes('Metadata/FmtParent') && !text.includes('AnimatedRender')) {
    mod = 'version 3\nextends "Metadata/FmtParent"';
  } else if (text.includes('Metadata/FmtParent') && text.includes('AnimatedRender')) {
    mod = 'version 3\nextends "Metadata/FmtParent"\n\nclient\n{\n\tAnimatedRender\n\t{\n\t\tcannot_be_disabled = true\n\t}\n}';
  } else if (text.includes('Metadata/Parent')) {
    mod = `version 3
extends "Metadata/Parent"

BaseAnimationEvents
{
}

AnimationController
{
\tmetadata = "Art/Models/Effects/enviro_effects/weather_attachments/generic_rig/weather_rig.amd"
}

client
{
    ClientAnimationController
    {
        skeleton = "Art/Models/Effects/enviro_effects/weather_attachments/generic_rig/weather_rig.ast"
    }

    BoneGroups
    {
        bone_group = "box false aux_box1 aux_box2 aux_box3 "
    }
}`;
  }
  if (mod !== null) {
    fr.Write(encodeU16(mod, hasBom));
    stats.files++;
  }
}

function patchEffectsFile(fr, stats) {
  const { text, hasBom } = decodeU16(fr.Read());
  const mod = stripClientBlocks(text, EFFECTS_CLIENT_KEEP);
  if (mod !== text) {
    fr.Write(encodeU16(mod, hasBom));
    stats.files++;
  }
}

function patchColorModsFile(fr, stats, options) {
  const { text, hasBom } = decodeU16(fr.Read());
  const lines = text.split('\r\n');
  let state = 'readingToDescription';
  let currentAnnotation = null;
  let linesToWrite = 0;
  let changed = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('description')) { state = 'readingDescription'; continue; }
    if (state === 'readingToDescription') continue;
    if (state === 'readingDescription') {
      const parts = line.split(' ');
      if (parts.length < 2) { state = 'readingToDescription'; continue; }
      const modType = parts[1];
      const opt = options.find((o) => o[0] === modType && o[2]);
      const conv = opt ? COLOR_CONVERSIONS[opt[1]] : null;
      if (opt && conv) { currentAnnotation = conv; state = 'readingData'; }
      else { currentAnnotation = null; state = 'readingToDescription'; }
      continue;
    }
    if (state === 'readingData') {
      const first = line.replace(/\t/g, '').split(' ')[0];
      if (/^\d+$/.test(first)) { state = 'writingData'; linesToWrite = parseInt(first, 10); }
      continue;
    }
    if (state === 'writingData') {
      if (line.includes('<')) {
        if (currentAnnotation === null) {
          lines[i] = line.replace(/<.*?>\{\{(.*?)\}\}/g, '$1');
          changed = true;
        } else {
          lines[i] = line.replace(/<.*?>/g, `<${currentAnnotation}>`);
          changed = true;
        }
      } else if (currentAnnotation !== null) {
        lines[i] = line.replace(/".*?"/g, (m) => `"<${currentAnnotation}>{{${m.slice(1, -1)}}}"`);
        changed = true;
      }
      linesToWrite--;
      if (linesToWrite === 0) state = 'readingData';
    }
  }
  if (changed) {
    fr.Write(encodeU16(lines.join('\r\n'), hasBom));
    stats.files++;
  }
}

// --------------------------------------------------- montagem dos handlers ---
function buildHandlers(config, stats, onProgress) {
  const handlers = [];

  if (config.zoom) {
    handlers.push({ name: 'Zoom de Câmera', run: (idx) => patchCamera(idx, config, stats, onProgress) });
  }
  if (config.minimap) {
    handlers.push({ should: (p) => p === 'shaders/minimap_blending_pixel.hlsl', apply: (fr) => patchMinimapFile(fr, stats) });
  }
  if (config.fog) {
    handlers.push({ should: (p) => p.startsWith('metadata/environmentsettings/') && p.endsWith('.env'), apply: (fr) => envReplace(fr, stats, [['"fog"', '"xog"']]) });
  }
  if (config.shadow) {
    handlers.push({ should: (p) => p.startsWith('metadata/environmentsettings/') && p.endsWith('.env'), apply: (fr) => envReplace(fr, stats, [['"shadows_enabled": true', '"shadows_enabled": false']]) });
  }
  if (config.light) {
    handlers.push({
      should: (p) => p.startsWith('metadata/environmentsettings/') && p.endsWith('.env'),
      apply: (fr) => envReplace(fr, stats, [
        ['"directional_light"', '"xirectional_light"'],
        ['"player_light"', '"xlayer_light"'],
        ['"environment_mapping"', '"xnvironment_mapping"'],
        ['"global_illumination"', '"xlobal_illumination"'],
      ]),
    });
  }
  if (config.envparticles) {
    handlers.push({
      should: (p) => p.startsWith('metadata/environmentsettings/') && p.endsWith('.env'),
      apply: (fr) => envReplace(fr, stats, [
        ['"area"', '"xrea"'],
        ['"fog"', '"xog"'],
        ['"screenspace_fog"', '"xcreenspace_fog"'],
        ['"effect_spawner"', '"xffect_spawner"'],
        ['"post_processing"', '"xost_processing"'],
      ]),
    });
  }
  if (config.corpse) {
    handlers.push({ should: (p) => p === 'metadata/monsters/monster.ot', apply: (fr) => patchCorpseFile(fr, stats) });
  }
  if (config.monsterhp) {
    handlers.push({ should: (p) => p === 'metadata/monsters/monster.ot', apply: (fr) => patchMonsterHPFile(fr, stats) });
  }
  if (config.delirium) {
    handlers.push({
      should: (p) => p.startsWith('metadata/effects/environment/league_affliction/') && (p.endsWith('.ao') || p.endsWith('.aoc')),
      apply: (fr) => patchDeliriumFile(fr, stats),
    });
  }
  if (config.particles) {
    handlers.push({
      should: (p) => p.startsWith('metadata/particles/') && (p.endsWith('.pet') || p.endsWith('.trl')) && !PARTICLES_PATH_PROTECT.some((x) => p.startsWith(x)),
      apply: (fr) => { fr.Write(encodeU16('0', true)); stats.files++; },
    });
  }
  if (config.effects) {
    handlers.push({
      should: (p) => p.startsWith('metadata/effects/spells/') && (p.endsWith('.aoc') || p.endsWith('.ao')) && !EFFECTS_PATH_PROTECT.some((x) => p.startsWith(x)),
      apply: (fr) => patchEffectsFile(fr, stats),
    });
  }
  if (config.colormods) {
    const opts = config.colormodsOptions || DEFAULT_COLORMODS;
    handlers.push({ should: (p) => p.startsWith('metadata/statdescriptions/') && p.endsWith('.txt'), apply: (fr) => patchColorModsFile(fr, stats, opts) });
  }

  return handlers;
}
