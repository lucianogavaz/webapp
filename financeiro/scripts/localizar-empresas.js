/**
 * Localiza as empresas reais (Golden Comércio, Energy, Golden Exportação)
 * no banco: acha a tabela de Empresa, mostra seus dados cadastrais (sem
 * valores financeiros) e o IdPlanoDeContas de cada uma, e confirma a
 * contagem de lançamentos contábeis especificamente para essas empresas.
 *
 *   cd financeiro
 *   node scripts/localizar-empresas.js
 *
 * Saída em financeiro/empresas-localizado.txt (não versionado).
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

  log(`Localizando empresas em ${new Date().toISOString()}`);
  log('='.repeat(70));

  log('\n1) Tabelas com "empresa" no nome (ainda não exploradas)');
  const tabelasEmpresa = await queryLeitura(`
    SELECT TABLE_SCHEMA, TABLE_NAME, TABLE_TYPE
    FROM INFORMATION_SCHEMA.TABLES
    WHERE LOWER(TABLE_NAME) LIKE '%empresa%'
    ORDER BY TABLE_SCHEMA, TABLE_NAME
  `);
  for (const t of tabelasEmpresa) log(`- [${t.TABLE_TYPE}] ${t.TABLE_SCHEMA}.${t.TABLE_NAME}`);

  log('\n' + '='.repeat(70));
  log('2) Colunas de dbo.Empresa (se existir)');
  const colunasEmpresa = await queryLeitura(`
    SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'Empresa'
    ORDER BY ORDINAL_POSITION
  `);
  for (const c of colunasEmpresa) log(`   ${c.COLUMN_NAME} (${c.DATA_TYPE}${c.IS_NULLABLE === 'YES' ? ', nullable' : ''})`);

  log('\n' + '='.repeat(70));
  log('3) Empresas cujo nome bate com Golden / Energy (dados cadastrais, sem valores financeiros)');
  try {
    const empresas = await queryLeitura(`
      SELECT *
      FROM dbo.Empresa
      WHERE NmEmpresa LIKE '%GOLDEN%' OR NmEmpresa LIKE '%ENERGY%'
    `);
    for (const e of empresas) log(JSON.stringify(e, null, 2));
  } catch (err) {
    log(`(erro consultando dbo.Empresa: ${err.message} — ajuste o nome da coluna/tabela conforme o item 1/2 acima)`);
  }

  log('\n' + '='.repeat(70));
  log('4) Contagem de MovimentoContabil e LoteMovimentoContabil, por empresa (todas, não só Golden/Energy)');
  for (const tabela of ['dbo.MovimentoContabil', 'dbo.LoteMovimentoContabil']) {
    log(`\n${tabela} — quantidade de lançamentos por CdEmpresa:`);
    const porEmpresa = await queryLeitura(`
      SELECT CdEmpresa, COUNT(*) AS Qtde
      FROM ${tabela}
      GROUP BY CdEmpresa
      ORDER BY Qtde DESC
    `);
    if (porEmpresa.length === 0) {
      log('  (nenhuma linha em nenhuma empresa)');
    }
    for (const p of porEmpresa) log(`  CdEmpresa=${p.CdEmpresa} -> ${p.Qtde} lançamentos`);
  }

  const arquivoSaida = path.join(__dirname, '..', 'empresas-localizado.txt');
  fs.writeFileSync(arquivoSaida, linhasSaida.join('\n'), 'utf8');
  log(`\nSaída também salva em: ${arquivoSaida}`);

  process.exit(0);
}

main().catch((err) => {
  console.error('Erro ao localizar empresas:', err.message);
  process.exit(1);
});
