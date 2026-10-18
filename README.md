# PoeBaphomet 🐐

Ferramenta de patches para **Path of Exile** (Windows). Edita os bundles do jogo
(`Bundles2\_.index.bin`) para aplicar modificações de qualidade de vida.

> **Atenção:** editar arquivos de dados do jogo pode violar os Termos de Serviço.
> Use por sua conta e risco. Um backup do índice original é criado automaticamente.

## Requisitos

- Windows 10/11 (64 bits)
- Path of Exile instalado (Steam ou cliente standalone)

## Como usar

1. Execute `PoeBaphomet.exe` (portable — não precisa instalar).
2. O jogo é detectado automaticamente. Se não for, use **Procurar…** e selecione a
   pasta do Path of Exile (a que contém `Bundles2`).
3. Marque os patches desejados e clique em **Aplicar patches**.
4. Abra o jogo. Para reverter tudo, feche o jogo e clique em **Restaurar original**.

## Patches disponíveis

| Patch | Descrição |
|---|---|
| **Zoom de Câmera** | Afasta a câmera padrão do personagem. Nível configurável (1.0x–10.0x). |
| **Minimapa revelado** | Revela o minimapa inteiro, sem névoa de exploração. |
| **Vida dos monstros** | Mostra a barra de vida dos monstros sempre. |
| **Cores de mods** | Colore modificadores perigosos de itens/mapas (vermelho, amarelo, azul…). |
| **Névoa** | Desativa a névoa padrão. |
| **Partículas de ambiente** | Desativa partículas do ambiente. |
| **Sombras** | Desativa sombras. |
| **Luz** | Desativa efeitos de luz. |
| **Corpos** | Remove corpos de monstros. |
| **Delírio** | Desativa os efeitos do Delírio. |
| **Partículas** | Desativa todas as partículas. |
| **Efeitos** | Desativa todos os efeitos de magias. |

## Estrutura do projeto

```
poebaphomet/
├── main.js            # processo principal (Electron)
├── preload.cjs        # ponte IPC segura
├── core/
│   └── patcher.js     # núcleo: detecção do jogo, patches, backup/restauração
├── libs/
│   └── oo2core.dll    # biblioteca de compressão Oodle (carregada em runtime)
├── renderer/
│   ├── index.html     # interface (pt-BR)
│   ├── style.css
│   └── app.js
├── package.json       # dependências + configuração do empacotamento
└── dist/
    └── PoeBaphomet.exe   # executável final (portable)
```

## Desenvolvimento

```bash
npm install          # instala dependências
npm start            # roda em modo desenvolvimento (Electron)
npm run dist         # gera o PoeBaphomet.exe (electron-builder --win portable)
```

> **Dependência de binário:** o arquivo `libs/oo2core.dll` (compressão Oodle) **não está
> versionado neste repositório** por ser biblioteca proprietária. Para rodar/buildar, baixe-o
> de <https://github.com/sage-z-cn/poe-bundle-lib> (caminho `libs/oo2core.dll`) e coloque em
> `libs/oo2core.dll`.

## Como funciona (resumo técnico)

- O jogo é aberto via índice `Bundles2\_.index.bin` (biblioteca `poe-bundle-lib`,
  compressão Oodle via `oo2core.dll`).
- **Zoom**: injeta em `metadata/characters/character.ot` (após `team = 1`):
  `on_initial_position_set = {ClearCameraZoomNodes(); CreateCameraZoomNode(1000000000.0, 1000000000.0, NÍVEL);}`
  e remove comandos de câmera dos demais `.ot`/`.otc` (overrides de área/boss).
- **Minimapa**: altera `shaders/minimap_blending_pixel.hlsl` (`visibility = 1.0f`).
- **Backup**: cópia do índice em `_.index.bin.poebaphomet.bak` antes da primeira
  aplicação. **Restaurar** copia o backup de volta e remove o bundle custom
  `LibGGPK3\0.bundle.bin`.
- Se o jogo atualizar (Steam), use "Restaurar original" e verifique os arquivos do
  jogo antes de reaplicar.
