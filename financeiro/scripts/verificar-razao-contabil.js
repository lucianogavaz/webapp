/**
 * Verificação final antes de escrever as queries de BP/DRE contábil: existem
 * duas tabelas de lançamento (dbo.MovimentoContabil e
 * dbo.LoteMovimentoContabil) com estrutura quase idêntica. Este script só
 * compara contagens e datas entre as duas (nenhum valor financeiro
 * individual) para decidir qual é o razão contábil "oficial" a consultar,
 * e mostra o conteúdo de dbo.PlanoDeContas (tabela de configuração pequena,
 * sem dados financeiros de clientes).
 *
 *   cd financeiro
 *   node scripts/verificar-razao-contabil.js
 *
 * Saída em financeiro/razao-contabil-verificado.txt (não versionado).
 */
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { queryLeitura, isConfigured } = require('../src/lib/bimerDb');

async function main() {
  if (!isConfigured()) {
    console.error('Faltam variáveis BIMER_DB_* no financeiro/.env.');
    process.exit(1);
  }

  const linhasSaida = [];
  const log = (texto = '') => {
    console.log(texto);
    linhasSaida.push(texto);
  };

  log(`Verificando razão contábil em ${new Date().toISOString()}`);
  log('='.repeat(70));

  for (const tabela of ['dbo.MovimentoContabil', 'dbo.LoteMovimentoContabil']) {
    const [stats] = await queryLeitura(`
      SELECT
        COUNT(*) AS Total,
        SUM(CASE WHEN DtExclusao IS NULL THEN 1 ELSE 0 END) AS TotalNaoExcluidos,
        MIN(DtLancamento) AS DataMinima,
        MAX(DtLancamento) AS DataMaxima
      FROM ${tabela}
    `);
    log(`\n${tabela}`);
    log(`  Total de linhas: ${stats.Total}`);
    log(`  Não excluídas (DtExclusao IS NULL): ${stats.TotalNaoExcluidos}`);
    log(`  Data mínima de lançamento: ${stats.DataMinima}`);
    log(`  Data máxima de lançamento: ${stats.DataMaxima}`);
  }

  log('\n' + '='.repeat(70));
  log('Últimos 30 dias com lançamento em cada tabela (só a contagem por dia, sem valores)');
  for (const tabela of ['dbo.MovimentoContabil', 'dbo.LoteMovimentoContabil']) {
    log(`\n${tabela} — últimos 10 dias com movimento:`);
    const porDia = await queryLeitura(`
      SELECT TOP 10 CAST(DtLancamento AS date) AS Dia, COUNT(*) AS Qtde
      FROM ${tabela}
      WHERE DtExclusao IS NULL
      GROUP BY CAST(DtLancamento AS date)
      ORDER BY Dia DESC
    `);
    for (const d of porDia) log(`  ${d.Dia?.toISOString?.().slice(0, 10) ?? d.Dia} -> ${d.Qtde} lançamentos`);
  }

  log('\n' + '='.repeat(70));
  log('dbo.PlanoDeContas (config do plano de contas — sem dados financeiros)\n');
  const planos = await queryLeitura(`SELECT * FROM dbo.PlanoDeContas`);
  for (const p of planos) {
    log(JSON.stringify(p, null, 2));
  }

  log('\n' + '='.repeat(70));
  log('dbo.PeriodoEmpresa (período fiscal aberto por empresa)\n');
  const periodos = await queryLeitura(`SELECT * FROM dbo.PeriodoEmpresa`);
  for (const p of periodos) {
    log(JSON.stringify(p));
  }

  const arquivoSaida = path.join(__dirname, '..', 'razao-contabil-verificado.txt');
  fs.writeFileSync(arquivoSaida, linhasSaida.join('\n'), 'utf8');
  log(`\nSaída também salva em: ${arquivoSaida}`);

  process.exit(0);
}

main().catch((err) => {
  console.error('Erro ao verificar razão contábil:', err.message);
  process.exit(1);
});
