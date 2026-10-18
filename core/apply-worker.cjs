// PoeBaphomet — processo de aplicação (utilityProcess do Electron).
// Roda num processo Node separado (não thread), onde o módulo nativo Oodle funciona corretamente.
process.parentPort.on('message', async (e) => {
  const { gamePath, config } = e.data;
  try {
    const { applyPatches } = await import('./patcher.js');
    const stats = applyPatches(gamePath, config, (phase, detail, percent) => {
      process.parentPort.postMessage({ type: 'progress', phase, detail, percent });
    });
    process.parentPort.postMessage({ type: 'done', files: stats.files });
  } catch (err) {
    process.parentPort.postMessage({ type: 'error', message: String((err && err.message) || err) });
  }
});
