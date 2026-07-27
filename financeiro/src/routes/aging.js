const express = require('express');
const { bimerGetTodasPaginas } = require('../lib/bimerClient');
const { montarAgingList } = require('../lib/aging');
const { resolverNomes } = require('../lib/pessoaCache');
const { normalizarTitulosAPagar, normalizarTitulosAReceber } = require('../lib/normalizarTitulo');

const router = express.Router();

function periodoPadrao(req) {
  const hoje = new Date();
  const doisAnosAtras = new Date(hoje);
  doisAnosAtras.setFullYear(doisAnosAtras.getFullYear() - 2);

  return {
    dataVencimentoInicial: req.query.dataVencimentoInicial || doisAnosAtras.toISOString().slice(0, 10),
    dataVencimentoFinal: req.query.dataVencimentoFinal || hoje.toISOString().slice(0, 10),
    codigoEmpresa: req.query.codigoEmpresa || process.env.BIMER_CODIGO_EMPRESA_PADRAO || undefined,
  };
}

async function montarResposta(path, normalizar, req, res, next) {
  try {
    const { dataVencimentoInicial, dataVencimentoFinal, codigoEmpresa } = periodoPadrao(req);

    const titulosBrutos = await bimerGetTodasPaginas(path, {
      codigoEmpresa,
      dataVencimentoInicial,
      dataVencimentoFinal,
    });
    const titulos = normalizar(titulosBrutos);

    const nomePessoaPorId = await resolverNomes(titulos.map((t) => t.identificadorPessoa));
    const resultado = montarAgingList(titulos, { nomePessoaPorId });

    res.json({
      periodo: { dataVencimentoInicial, dataVencimentoFinal },
      codigoEmpresa: codigoEmpresa || null,
      ...resultado,
    });
  } catch (err) {
    next(err);
  }
}

router.get('/contas-a-pagar', (req, res, next) =>
  montarResposta('/api/titulosAPagar', normalizarTitulosAPagar, req, res, next)
);
router.get('/contas-a-receber', (req, res, next) =>
  montarResposta('/api/titulosAReceber', normalizarTitulosAReceber, req, res, next)
);

module.exports = router;
