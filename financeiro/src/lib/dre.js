function chaveMes(dataISO) {
  return dataISO.slice(0, 7); // YYYY-MM
}

const SEM_NATUREZA = 'Não detalhado';

/**
 * Soma um título por natureza de lançamento no mapa informado. A soma dos
 * itens (`t.naturezas`) nem sempre bate exatamente com `t.valor` (o título
 * pode ter itens sem natureza informada, ou desmembramentos de imposto que
 * não vêm como item), então qualquer diferença é reconciliada num bucket
 * "Não detalhado" para que o total por natureza sempre feche com `t.valor`.
 */
function acumularPorNatureza(mapaPorNatureza, titulo) {
  const somaItens = titulo.naturezas.reduce((s, n) => s + n.valor, 0);
  for (const { nome, valor } of titulo.naturezas) {
    mapaPorNatureza.set(nome, (mapaPorNatureza.get(nome) || 0) + valor);
  }
  const diferenca = titulo.valor - somaItens;
  if (Math.abs(diferenca) > 0.005) {
    mapaPorNatureza.set(SEM_NATUREZA, (mapaPorNatureza.get(SEM_NATUREZA) || 0) + diferenca);
  }
}

/**
 * Monta uma DRE Gerencial (aproximada) a partir dos títulos a pagar/receber
 * normalizados, agrupando pelo valor bruto (regime de competência, usando a
 * data de vencimento como proxy) por natureza de lançamento.
 *
 * Importante: isto NÃO é a DRE contábil oficial. A Bimer API (nesta versão)
 * não expõe plano de contas nem lançamentos contábeis, então não há como
 * calcular depreciação, provisões, impostos sobre o lucro ou outros ajustes
 * contábeis. É uma visão gerencial de receitas x despesas financeiras. O
 * valor total do título (`t.valor`) é sempre a fonte de verdade — a quebra
 * por natureza é reconciliada para nunca divergir desse total.
 */
function montarDRE({ titulosAReceber, titulosAPagar, dataInicial, dataFinal }) {
  const receitasPorNatureza = new Map();
  const despesasPorNatureza = new Map();
  const meses = new Map(); // 'YYYY-MM' -> { mes, receitas, despesas }

  const acumular = (titulos, mapaPorNatureza, chaveMesCampo) => {
    for (const t of titulos) {
      const mes = chaveMes(t.dataVencimento);
      if (!meses.has(mes)) meses.set(mes, { mes, receitas: 0, despesas: 0 });
      meses.get(mes)[chaveMesCampo] += t.valor;

      acumularPorNatureza(mapaPorNatureza, t);
    }
  };

  acumular(titulosAReceber, receitasPorNatureza, 'receitas');
  acumular(titulosAPagar, despesasPorNatureza, 'despesas');

  const totalReceitas = titulosAReceber.reduce((s, t) => s + t.valor, 0);
  const totalDespesas = titulosAPagar.reduce((s, t) => s + t.valor, 0);
  const resultado = totalReceitas - totalDespesas;

  const paraLista = (mapa) =>
    [...mapa.entries()]
      .map(([nome, valor]) => ({ nome, valor: Number(valor.toFixed(2)) }))
      .sort((a, b) => b.valor - a.valor);

  const porMes = [...meses.values()]
    .sort((a, b) => a.mes.localeCompare(b.mes))
    .map((m) => ({
      mes: m.mes,
      receitas: Number(m.receitas.toFixed(2)),
      despesas: Number(m.despesas.toFixed(2)),
      resultado: Number((m.receitas - m.despesas).toFixed(2)),
    }));

  return {
    periodo: { dataInicial, dataFinal },
    totalReceitas: Number(totalReceitas.toFixed(2)),
    totalDespesas: Number(totalDespesas.toFixed(2)),
    resultado: Number(resultado.toFixed(2)),
    margemPercentual: totalReceitas > 0 ? Number(((resultado / totalReceitas) * 100).toFixed(1)) : 0,
    receitasPorNatureza: paraLista(receitasPorNatureza),
    despesasPorNatureza: paraLista(despesasPorNatureza),
    porMes,
  };
}

module.exports = { montarDRE };
