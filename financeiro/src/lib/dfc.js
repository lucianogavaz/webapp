function chaveMes(dataISO) {
  return dataISO.slice(0, 7); // YYYY-MM
}

function nomeNaturezaDoTitulo(titulo) {
  const primeiroItem = (titulo.itens || [])[0];
  return primeiroItem?.naturezaLancamento?.nome || 'Sem natureza definida';
}

/**
 * Monta a projeção de Fluxo de Caixa (DFC) a partir dos saldos bancários
 * atuais e dos títulos a pagar/receber em aberto no período.
 */
function montarDFC({ saldosBancarios, titulosAReceber, titulosAPagar, dataInicial, dataFinal }) {
  const saldoAtual = saldosBancarios.reduce((soma, c) => soma + Number(c.valorSaldo || 0), 0);

  const meses = new Map(); // 'YYYY-MM' -> { entradas, saidas }
  const naturezasEntrada = new Map();
  const naturezasSaida = new Map();

  const acumular = (mapaMeses, titulos, tipo) => {
    for (const t of titulos) {
      const saldo = Number(t.valor || 0) - Number(t.valorBaixado || 0);
      if (saldo <= 0.005) continue;

      const mes = chaveMes(t.dataVencimento);
      if (!mapaMeses.has(mes)) mapaMeses.set(mes, { mes, entradas: 0, saidas: 0 });
      mapaMeses.get(mes)[tipo] += saldo;

      const natureza = nomeNaturezaDoTitulo(t);
      const mapaNaturezas = tipo === 'entradas' ? naturezasEntrada : naturezasSaida;
      mapaNaturezas.set(natureza, (mapaNaturezas.get(natureza) || 0) + saldo);
    }
  };

  acumular(meses, titulosAReceber, 'entradas');
  acumular(meses, titulosAPagar, 'saidas');

  const linhasMensais = [...meses.values()].sort((a, b) => a.mes.localeCompare(b.mes));

  let acumulado = saldoAtual;
  const projecao = linhasMensais.map((linha) => {
    const saldoDoMes = linha.entradas - linha.saidas;
    acumulado += saldoDoMes;
    return {
      mes: linha.mes,
      entradas: Number(linha.entradas.toFixed(2)),
      saidas: Number(linha.saidas.toFixed(2)),
      saldoDoMes: Number(saldoDoMes.toFixed(2)),
      saldoAcumulado: Number(acumulado.toFixed(2)),
    };
  });

  const totalEntradas = linhasMensais.reduce((s, l) => s + l.entradas, 0);
  const totalSaidas = linhasMensais.reduce((s, l) => s + l.saidas, 0);

  const paraLista = (mapa) =>
    [...mapa.entries()]
      .map(([nome, valor]) => ({ nome, valor: Number(valor.toFixed(2)) }))
      .sort((a, b) => b.valor - a.valor);

  return {
    periodo: { dataInicial, dataFinal },
    saldoAtual: Number(saldoAtual.toFixed(2)),
    contasBancarias: saldosBancarios.map((c) => ({
      identificador: c.identificador,
      descricao: c.descricao,
      numeroConta: c.numeroConta,
      agencia: c.agencia,
      dataReferencia: c.dataReferencia,
      valorSaldo: Number((c.valorSaldo || 0).toFixed(2)),
    })),
    resumo: {
      totalEntradas: Number(totalEntradas.toFixed(2)),
      totalSaidas: Number(totalSaidas.toFixed(2)),
      resultadoPeriodo: Number((totalEntradas - totalSaidas).toFixed(2)),
      saldoProjetadoFinal: projecao.length ? projecao[projecao.length - 1].saldoAcumulado : saldoAtual,
    },
    projecaoMensal: projecao,
    entradasPorNatureza: paraLista(naturezasEntrada),
    saidasPorNatureza: paraLista(naturezasSaida),
  };
}

module.exports = { montarDFC };
