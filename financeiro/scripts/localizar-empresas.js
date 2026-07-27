/**
 * Localiza as empresas reais (Golden Comércio, Energy, Golden Exportação)
 * no banco via dbo.EmpresaERP (dbo.Empresa não existe nesta base).
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

  log('\n1) Colunas de dbo.EmpresaERP');
  const colunas = await queryLeitura(`
    SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'EmpresaERP'
    ORDER BY ORDINAL_POSITION
  `);
  for (const c of colunas) log(`   ${c.COLUMN_NAME} (${c.DATA_TYPE}${c.IS_NULLABLE === 'YES' ? ', nullable' : ''})`);

  log('\n' + '='.repeat(70));
  log('2) Todas as empresas cadastradas em dbo.EmpresaERP (dados cadastrais, sem valores financeiros)');
  const empresas = await queryLeitura(`SELECT * FROM dbo.EmpresaERP`);
  for (const e of empresas) log(JSON.stringify(e, null, 2));

  const arquivoSaida = path.join(__dirname, '..', 'empresas-localizado.txt');
  fs.writeFileSync(arquivoSaida, linhasSaida.join('\n'), 'utf8');
  log(`\nSaída também salva em: ${arquivoSaida}`);

  process.exit(0);
}

main().catch((err) => {
  console.error('Erro ao localizar empresas:', err.message);
  process.exit(1);
});
