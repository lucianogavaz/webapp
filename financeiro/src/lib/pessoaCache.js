const { bimerGet } = require('./bimerClient');

const cache = new Map(); // identificador -> nome

async function resolverNomes(identificadores) {
  const unicos = [...new Set(identificadores.filter(Boolean))].filter((id) => !cache.has(id));

  const CONCORRENCIA = 8;
  for (let i = 0; i < unicos.length; i += CONCORRENCIA) {
    const lote = unicos.slice(i, i + CONCORRENCIA);
    await Promise.all(
      lote.map(async (id) => {
        try {
          const resposta = await bimerGet(`/api/pessoas/${id}`);
          const nome = resposta?.listaObjetos?.[0]?.nome;
          cache.set(id, nome || id);
        } catch {
          cache.set(id, id);
        }
      })
    );
  }

  return Object.fromEntries([...cache.entries()]);
}

module.exports = { resolverNomes };
