const express = require('express');
const { bimerGet, bimerGetTodasPaginas } = require('../lib/bimerClient');
const { montarDFC } = require('../lib/dfc');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const codigoEmpresa = req.query.codigoEmpresa || process.env.BIMER_CODIGO_EMPRESA_PADRAO;
    if (!codigoEmpresa) {
      return res.status(400).json({ mensagem: 'Informe codigoEmpresa.' });
    }

    const hoje = new Date();
    const seisMesesFrente = new Date(hoje);
    seisMesesFrente.setMonth(seisMesesFrente.getMonth() + 6);

    const dataInicial = req.query.dataInicial || hoje.toISOString().slice(0, 10);
    const dataFinal = req.query.dataFinal || seisMesesFrente.toISOString().slice(0, 10);

    const [saldosResp, titulosAReceber, titulosAPagar] = await Promise.all([
      bimerGet(`/api/contas-bancarias/empresas/${codigoEmpresa}/saldos`),
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

    const dfc = montarDFC({
      saldosBancarios: saldosResp?.listaObjetos || [],
      titulosAReceber,
      titulosAPagar,
      dataInicial,
      dataFinal,
    });

    res.json({ codigoEmpresa, ...dfc });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
