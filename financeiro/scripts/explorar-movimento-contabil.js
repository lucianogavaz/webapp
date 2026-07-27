/**
 * Terceira rodada de exploração: tabelas específicas encontradas nas rodadas
 * anteriores que parecem centrais para DRE/BP contábil e para o módulo
 * orçamentário (schema Demonstrativo, esp.CO_*, MovimentoContabil "final").
 *
 * Só lê colunas (metadados) e, no final, os grupos de topo do plano de
 * contas (nível 0-1, ex: "1", "1.1", "2", "2.1"...) — não lê nenhum valor
 * de lançamento financeiro real.
 *
 *   cd financeiro
 *   node scripts/explorar-movimento-contabil.js
 *
 * Saída em financeiro/movimento-contabil-descoberto.txt (não versionado).
 */
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { queryLeitura, isConfigured } = require('../src/lib/bimerDb');

const TABELAS = [
  { schema: 'dbo', nome: 'PlanoDeContas' },
  { schema: 'dbo', nome: 'MovimentoContabil' },
  { schema: 'dbo', nome: 'MovimentoContabilCCusto' },
  { schema: 'dbo', nome: 'MovimentoContabilOrigem' },
  { schema: 'Demonstrativo', nome: 'Periodo' },
  { schema: 'Demonstrativo', nome: 'DemonstrativoPeriodo' },
  { schema: 'esp', nome: 'CO_Lancamento' },
  { schema: 'dbo', nome: 'SaldoBancario' },
  { schema: 'dbo', nome: 'PeriodoEmpresa' },
  { schema: 'dbo', nome: 'SubContas' },
  { schema: 'dbo', nome: 'SubContasItem' },
];

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

  log(`Explorando movimento contábil / demonstrativos em ${new Date().toISOString()}`);
  log('='.repeat(70));

  log('\n1) Colunas das tabelas-chave identificadas nas rodadas anteriores\n');
  for (const { schema, nome } of TABELAS) {
    const colunas = await queryLeitura(
      `SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = @schema AND TABLE_NAME = @nome
       ORDER BY ORDINAL_POSITION`,
      { schema, nome }
    );

    if (colunas.length === 0) {
      log(`## ${schema}.${nome}  (NÃO ENCONTRADA — tabela pode não existir com esse nome exato)`);
      log('');
      continue;
    }

    log(`## ${schema}.${nome}`);
    for (const c of colunas) {
      log(`   ${c.COLUMN_NAME} (${c.DATA_TYPE}${c.IS_NULLABLE === 'YES' ? ', nullable' : ''})`);
    }
    log('');
  }

  log('='.repeat(70));
  log('2) Grupos de topo do plano de contas (código com no máximo 1 ponto, ex: "1", "1.1", "2"...)');
  log('   Isso revela a estrutura raiz: Ativo, Passivo, Receita, Despesa etc.\n');
  const grupos = await queryLeitura(`
    SELECT IdConta, CdClassInterna, TpConta, NmConta
    FROM dbo.Contas
    WHERE CdClassInterna IS NOT NULL
      AND LEN(CdClassInterna) - LEN(REPLACE(CdClassInterna, '.', '')) <= 1
    ORDER BY CdClassInterna
  `);
  for (const g of grupos) {
    log(`- [Id=${g.IdConta}] "${g.CdClassInterna}" Tp=${g.TpConta} :: ${g.NmConta}`);
  }

  const arquivoSaida = path.join(__dirname, '..', 'movimento-contabil-descoberto.txt');
  fs.writeFileSync(arquivoSaida, linhasSaida.join('\n'), 'utf8');
  log(`\nSaída também salva em: ${arquivoSaida}`);

  process.exit(0);
}

main().catch((err) => {
  console.error('Erro ao explorar movimento contábil:', err.message);
  process.exit(1);
});
