/**
 * A API REST do Bimer não está instalada neste ambiente (só o aplicativo
 * desktop). Este script busca as tabelas de título a pagar/receber
 * direto no SQL Server, para que DFC/Aging/DRE Gerencial passem a
 * consultar o banco em vez da API REST.
 *
 * Só lê metadados (INFORMATION_SCHEMA), nenhum valor financeiro real.
 *
 *   cd financeiro
 *   node scripts/localizar-titulos.js
 *
 * Saída em financeiro/titulos-localizado.txt (não versionado).
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

  log(`Localizando tabelas de título em ${new Date().toISOString()}`);
  log('='.repeat(70));

  log('\n1) Tabelas/views com "titulo" no nome');
  const tabelas = await queryLeitura(`
    SELECT TABLE_SCHEMA, TABLE_NAME, TABLE_TYPE
    FROM INFORMATION_SCHEMA.TABLES
    WHERE LOWER(TABLE_NAME) LIKE '%titulo%'
    ORDER BY TABLE_SCHEMA, TABLE_NAME
  `);
  for (const t of tabelas) log(`- [${t.TABLE_TYPE}] ${t.TABLE_SCHEMA}.${t.TABLE_NAME}`);

  log('\n' + '='.repeat(70));
  log('2) Colunas de cada uma (estrutura, sem dados)');
  for (const t of tabelas) {
    const colunas = await queryLeitura(
      `SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = @schema AND TABLE_NAME = @nome
       ORDER BY ORDINAL_POSITION`,
      { schema: t.TABLE_SCHEMA, nome: t.TABLE_NAME }
    );
    log(`\n## ${t.TABLE_SCHEMA}.${t.TABLE_NAME}`);
    for (const c of colunas) {
      log(`   ${c.COLUMN_NAME} (${c.DATA_TYPE}${c.IS_NULLABLE === 'YES' ? ', nullable' : ''})`);
    }
  }

  log('\n' + '='.repeat(70));
  log('3) Contagem de linhas por empresa nas tabelas mais prováveis (ATitulo/PTitulo/TituloAReceber/TituloAPagar)');
  const candidatas = tabelas.filter((t) =>
    /titulo/i.test(t.TABLE_NAME) && !/historico|log|item|movimento/i.test(t.TABLE_NAME)
  );
  for (const t of candidatas) {
    try {
      const temEmpresa = await queryLeitura(
        `SELECT COUNT(*) AS Qtde FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=@schema AND TABLE_NAME=@nome AND COLUMN_NAME LIKE '%Empresa%'`,
        { schema: t.TABLE_SCHEMA, nome: t.TABLE_NAME }
      );
      const total = await queryLeitura(`SELECT COUNT(*) AS Total FROM ${t.TABLE_SCHEMA}.${t.TABLE_NAME}`);
      log(`- ${t.TABLE_SCHEMA}.${t.TABLE_NAME}: ${total[0].Total} linhas no total (tem coluna de empresa: ${temEmpresa[0].Qtde > 0 ? 'sim' : 'não'})`);
    } catch (err) {
      log(`- ${t.TABLE_SCHEMA}.${t.TABLE_NAME}: erro ao contar (${err.message})`);
    }
  }

  const arquivoSaida = path.join(__dirname, '..', 'titulos-localizado.txt');
  fs.writeFileSync(arquivoSaida, linhasSaida.join('\n'), 'utf8');
  log(`\nSaída também salva em: ${arquivoSaida}`);

  process.exit(0);
}

main().catch((err) => {
  console.error('Erro ao localizar tabelas de título:', err.message);
  process.exit(1);
});
