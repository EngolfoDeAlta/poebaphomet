// ============================================================================
// PoeBaphomet — Marcadores de monstros no minimapa (Passo 3, abordagem v3)
// ============================================================================
// Pesquisa na internet revelou o mecanismo NATIVO do jogo:
//   - A passiva "Detect Evil" (Warden of the Maji) usa a stat `warden_tracker = 1`
//     que dá "Rare and Unique Enemies within 120 metres have Minimap Icons".
//   - Os ícones usados são exatamente WardenTrackerUniqueMonster / WardenTrackerRareMonster
//     (índices 630/631 no data/minimapicons.datc64).
//
// Então a solução correta é simplesmente adicionar `warden_tracker = 1` ao bloco
// Stats do character.ot — o PRÓPRIO motor do jogo desenha os ícones na posição
// certa de cada raro/único. Nada de SpawnObject/SetLocation (que era o que dava
// problema de posição) nem MinimapIcon no monster.ot (que dava buffer underflow).
//
// ⚠️ Limitação (nativa): marca apenas RARO e ÚNICO. O jogo não tem stat nativa
//    equivalente para mágico/normal.
// ============================================================================

// Adiciona `warden_tracker = 1` ao bloco Stats do character.ot (idempotente).
export function transformMonsterMarkers(text) {
  if (text.includes('warden_tracker')) return text; // já patcheado
  const marker = 'is_player = 1\r\n';
  const idx = text.indexOf(marker);
  if (idx === -1) return text;
  return text.slice(0, idx + marker.length) + '\twarden_tracker = 1\r\n' + text.slice(idx + marker.length);
}
