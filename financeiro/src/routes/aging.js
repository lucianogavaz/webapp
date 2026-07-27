const express = require('express');
const { bimerGetTodasPaginas } = require('../lib/bimerClient');
const { montarAgingList } = require('../lib/aging');
const { resolverNomes } = require('../lib/pessoaCache');

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

async function montarResposta(path, req, res, next) {
  try {
    const { dataVencimentoInicial, dataVencimentoFinal, codigoEmpresa } = periodoPadrao(req);

    const titulos = await bimerGetTodasPaginas(path, {
      codigoEmpresa,
      dataVencimentoInicial,
      dataVencimentoFinal,
    });

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

router.get('/contas-a-pagar', (req, res, next) => montarResposta('/api/titulosAPagar', req, res, next));
router.get('/contas-a-receber', (req, res, next) => montarResposta('/api/titulosAReceber', req, res, next));

module.exports = router;
