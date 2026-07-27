/**
 * A Bimer API usa esquemas diferentes para título a pagar (APagarConsultaContrato)
 * e título a receber (AReceberConsultaContrato) — os nomes dos campos não batem
 * entre si (ex: `valor` vs `valorTitulo`, `identificadorPessoa` string vs
 * `pessoa.identificador`, natureza de lançamento no item vs no título). Estas
 * funções convertem os dois formatos para uma forma única e previsível, usada
 * pelo resto do app (aging, DFC, DRE).
 *
 * Formato normalizado:
 * {
 *   identificador, numero, descricao, identificadorPessoa, codigoEmpresa,
 *   dataVencimento, dataExclusao, situacao,
 *   valor,           // valor total do título (bruto)
 *   saldoEmAberto,   // quanto ainda falta pagar/receber
 *   naturezas: [{ nome, valor }],  // decomposição do valor total por natureza de lançamento
 * }
 */

function normalizarAPagar(t) {
  const naturezas = (t.itens || [])
    .filter((i) => i.naturezaLancamento)
    .map((i) => ({ nome: i.naturezaLancamento.nome || 'Sem natureza definida', valor: Number(i.valor || 0) }));

  const valor = Number(t.valor || 0);
  const valorBaixado = Number(t.valorBaixado || 0);

  return {
    tipo: 'pagar',
    identificador: t.identificador,
    numero: t.numero,
    descricao: t.descricao,
    identificadorPessoa: t.identificadorPessoa,
    codigoEmpresa: t.codigoEmpresa,
    dataVencimento: t.dataVencimento,
    dataExclusao: t.dataExclusao,
    situacao: t.situacaoAdministrativa?.nome || null,
    valor,
    saldoEmAberto: Number((valor - valorBaixado).toFixed(2)),
    naturezas: naturezas.length ? naturezas : [{ nome: 'Sem natureza definida', valor }],
  };
}

function normalizarAReceber(t) {
  const valor = Number(t.valorTitulo ?? t.valorOriginal ?? 0);
  const valorBaixado = Number(t.valorBaixado || 0);
  const saldoEmAberto = t.valorEmAberto != null ? Number(t.valorEmAberto) : Number((valor - valorBaixado).toFixed(2));

  return {
    tipo: 'receber',
    identificador: t.identificador,
    numero: t.numeroTitulo,
    descricao: t.descricaoTitulo,
    identificadorPessoa: t.pessoa?.identificador,
    codigoEmpresa: t.empresa?.codigo,
    dataVencimento: t.dataVencimento,
    dataExclusao: t.dataExclusao,
    situacao: t.situacaoAdministrativa?.nome || null,
    valor,
    saldoEmAberto: Number(saldoEmAberto.toFixed(2)),
    naturezas: [{ nome: t.naturezaLancamento?.nome || 'Sem natureza definida', valor }],
  };
}

function normalizarLista(titulos, normalizador) {
  return titulos.filter((t) => !t.dataExclusao).map(normalizador);
}

module.exports = {
  normalizarTitulosAPagar: (titulos) => normalizarLista(titulos, normalizarAPagar),
  normalizarTitulosAReceber: (titulos) => normalizarLista(titulos, normalizarAReceber),
};
