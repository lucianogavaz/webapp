const express = require('express');
const { bimerGetTodasPaginas } = require('../lib/bimerClient');
const { montarDRE } = require('../lib/dre');
const { normalizarTitulosAPagar, normalizarTitulosAReceber } = require('../lib/normalizarTitulo');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const codigoEmpresa = req.query.codigoEmpresa || process.env.BIMER_CODIGO_EMPRESA_PADRAO;
    if (!codigoEmpresa) {
      return res.status(400).json({ mensagem: 'Informe codigoEmpresa.' });
    }

    const hoje = new Date();
    const inicioDoAno = new Date(hoje.getFullYear(), 0, 1);

    const dataInicial = req.query.dataInicial || inicioDoAno.toISOString().slice(0, 10);
    const dataFinal = req.query.dataFinal || hoje.toISOString().slice(0, 10);

    const [titulosAReceberBrutos, titulosAPagarBrutos] = await Promise.all([
      bimerGetTodasPaginas('/api/titulosAReceber', {
        codigoEmpresa,
        dataVencimentoInicial: dataInicial,
        dataVencimentoFinal: dataFinal,
      }),
      bimerGetTodasPaginas('/api/titulosAPagar', {
        codigoEmpresa,
        dataVencimentoInicial: dataInicial,
        dataVencimentoFinal: dataFinal,
      }),
    ]);

    const dre = montarDRE({
      titulosAReceber: normalizarTitulosAReceber(titulosAReceberBrutos),
      titulosAPagar: normalizarTitulosAPagar(titulosAPagarBrutos),
      dataInicial,
      dataFinal,
    });

    res.json({ codigoEmpresa, ...dre });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
