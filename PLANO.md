# PoeBaphomet — Plano de próximos passos

> **Regra combinada:** só executar cada passo quando o usuário autorizar explicitamente.

## Passo 2 — Publicar no GitHub (AGUARDANDO autorização)

Estratégia combinada:
- **Código no repositório** + **binário como asset de uma Release**.
- Criar `.gitignore` com `node_modules/`, `dist/`, `build/` (e afins).
- Não commitar `node_modules` nem `dist`.
- O `PoeBaphomet.exe` vai anexado como asset de uma **GitHub Release** (não versionado no repo).
- Ressalvas a tratar na hora:
  - `libs/oo2core.dll` é biblioteca proprietária (Oodle/RAD Game Tools) — publicar com aviso no README ou instruir a baixar de poe-bundle-lib.
  - Verificar que não há nada de "Rodrigo"/pessoal nos arquivos (já verificado: zero ocorrências).

## Passo 3 — Marcadores de monstros no minimapa (AGUARDANDO autorização)

Feature do PoeSmoother ("MinimapIcons"/monster markers): mostrar ícone de monstros
(raros/únicos/etc.) direto no minimapa do canto.

O que já se sabe (pesquisa + RE):
- O jogo JÁ tem os ícones de monstro em `data/minimapicons.datc64` ("Monster Icons /15":
  RareMonsterAlive, BestiaryRareMonster, RogueExile, etc.).
- Mecanismo de marcador: objeto `.ot` com `MinimapIcon { icon = N }` + `ShowMinimapIcon()`/`HideMinimapIcon()`.
- Receita do PoeSmoother (extraída do binário): injetar um `StateMachine` no `character.ot`
  que usa `EnemiesNearbyTracker` + `SpawnObject('...psraremonstermarker')` por monstro.

Falta resolver (pesquisa antes de implementar — NÃO chutar):
1. **Decodificar `data/minimapicons.datc64`** — entender as 699 linhas de 34 bytes + os ~34 KB
   de dados extras (nomes dos ícones), e como `icon = N` (número) / `icon = "Nome"` mapeiam
   pras linhas, pra apontar pro ícone certo de monstro.
2. **Criar arquivos novos no índice** — a lib atual só substitui arquivos existentes; os
   marcadores são arquivos novos (`psraremonstermarker.ot` etc.). Estender o core pra isso.

Ordem sugerida: primeiro o item 1 (decodificação, é pesquisa concreta), depois item 2 + injeção.

## Pendência técnica (bug do "offset exceeds uncompressed size")

- Erro: `offset 448454 exceeds uncompressed size 446446` = índice e bundle fora de sincronia
  (apply anterior gravou errado: jogo aberto ou bundle órfão reutilizado).
- Correção definitiva a fazer: **"Apply" sempre começar do estado limpo** (restaurar o original
  internamente antes de aplicar), evitando reutilizar bundle defasado.
