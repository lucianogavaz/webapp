const FAIXAS = [
  { chave: 'aVencer', rotulo: 'A vencer', min: -Infinity, max: -1 },
  { chave: 'd1a30', rotulo: '1 a 30 dias', min: 0, max: 30 },
  { chave: 'd31a60', rotulo: '31 a 60 dias', min: 31, max: 60 },
  { chave: 'd61a90', rotulo: '61 a 90 dias', min: 61, max: 90 },
  { chave: 'd90mais', rotulo: 'Acima de 90 dias', min: 91, max: Infinity },
];

function diasEmAtraso(dataVencimento, referencia = new Date()) {
  const venc = new Date(dataVencimento);
  const ref = new Date(referencia.toISOString().slice(0, 10));
  const vencSoDia = new Date(venc.toISOString().slice(0, 10));
  return Math.round((ref - vencSoDia) / (1000 * 60 * 60 * 24));
}

function faixaPara(dias) {
  return FAIXAS.find((f) => dias >= f.min && dias <= f.max) || FAIXAS[FAIXAS.length - 1];
}

/**
 * Recebe uma lista de títulos (a pagar ou a receber) no formato da Bimer API
 * e devolve o agrupamento em faixas de vencimento (aging list), considerando
 * apenas o saldo em aberto (valor - valorBaixado).
 */
function montarAgingList(titulos, { nomePessoaPorId = {} } = {}) {
  const hoje = new Date();
  const linhas = [];
  const totalPorFaixa = Object.fromEntries(FAIXAS.map((f) => [f.chave, 0]));

  for (const titulo of titulos) {
    const saldo = Number(titulo.valor || 0) - Number(titulo.valorBaixado || 0);
    if (saldo <= 0.005) continue; // já quitado

    const dias = diasEmAtraso(titulo.dataVencimento, hoje);
    const faixa = faixaPara(dias);
    totalPorFaixa[faixa.chave] += saldo;

    linhas.push({
      identificador: titulo.identificador,
      numero: titulo.numero,
      descricao: titulo.descricao,
      identificadorPessoa: titulo.identificadorPessoa,
      pessoa: nomePessoaPorId[titulo.identificadorPessoa] || titulo.identificadorPessoa || '—',
      codigoEmpresa: titulo.codigoEmpresa,
      dataVencimento: titulo.dataVencimento,
      diasEmAtraso: dias,
      faixa: faixa.chave,
      faixaRotulo: faixa.rotulo,
      valorOriginal: Number(titulo.valor || 0),
      valorBaixado: Number(titulo.valorBaixado || 0),
      saldo,
      situacao: titulo.situacaoAdministrativa?.nome || null,
    });
  }

  linhas.sort((a, b) => b.diasEmAtraso - a.diasEmAtraso);

  const totalGeral = Object.values(totalPorFaixa).reduce((a, b) => a + b, 0);

  return {
    faixas: FAIXAS.map((f) => ({
      chave: f.chave,
      rotulo: f.rotulo,
      total: Number(totalPorFaixa[f.chave].toFixed(2)),
      percentual: totalGeral > 0 ? Number(((totalPorFaixa[f.chave] / totalGeral) * 100).toFixed(1)) : 0,
    })),
    totalGeral: Number(totalGeral.toFixed(2)),
    quantidadeTitulos: linhas.length,
    titulos: linhas,
  };
}

module.exports = { montarAgingList, diasEmAtraso, FAIXAS };
