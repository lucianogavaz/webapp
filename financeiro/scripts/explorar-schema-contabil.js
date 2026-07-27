/**
 * Script exploratório: NÃO lê nenhum dado financeiro real. Só lista nomes de
 * tabelas/views e colunas do banco do Bimer cujo nome bate com termos
 * contábeis comuns (plano de contas, lançamento, razão, balanço, DRE etc).
 *
 * Rode isto de dentro da rede onde o banco está acessível:
 *
 *   cd financeiro
 *   cp .env.example .env   # se ainda não tiver feito
 *   # preencha BIMER_DB_SERVER / BIMER_DB_DATABASE / BIMER_DB_USER / BIMER_DB_PASSWORD
 *   node scripts/explorar-schema-contabil.js
 *
 * A saída fica em financeiro/schema-contabil-descoberto.txt (não é
 * versionado no git) — copie o conteúdo desse arquivo de volta na conversa
 * para que as queries reais de BP/DRE contábil possam ser escritas.
 */
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { queryLeitura, isConfigured } = require('../src/lib/bimerDb');

const TERMOS = [
  'conta',
  'contabil',
  'plano',
  'lancamento',
  'lancto',
  'razao',
  'balanco',
  'dre',
  'resultado',
  'partida',
  'debito',
  'credito',
  'ccusto',
  'centrocusto',
  'historico',
  'movimento',
  'saldo',
  'exercicio',
  'periodo',
  'grupocontabil',
  'classecontabil',
];

async function main() {
  if (!isConfigured()) {
    console.error(
      'Faltam variáveis BIMER_DB_* no financeiro/.env. Copie .env.example para .env e preencha antes de rodar este script.'
    );
    process.exit(1);
  }

  const linhasSaida = [];
  const log = (texto = '') => {
    console.log(texto);
    linhasSaida.push(texto);
  };

  log(`Explorando schema em ${new Date().toISOString()}`);
  log('='.repeat(70));

  const condicoes = TERMOS.map((_, i) => `LOWER(TABLE_NAME) LIKE @t${i}`).join(' OR ');
  const params = Object.fromEntries(TERMOS.map((t, i) => [`t${i}`, `%${t}%`]));

  const tabelas = await queryLeitura(
    `SELECT TABLE_SCHEMA, TABLE_NAME, TABLE_TYPE
     FROM INFORMATION_SCHEMA.TABLES
     WHERE ${condicoes}
     ORDER BY TABLE_SCHEMA, TABLE_NAME`,
    params
  );

  log(`\nEncontradas ${tabelas.length} tabelas/views com nome relacionado a termos contábeis:\n`);

  const LIMITE = 80;
  const tabelasLimitadas = tabelas.slice(0, LIMITE);
  if (tabelas.length > LIMITE) {
    log(`(mostrando as primeiras ${LIMITE} de ${tabelas.length} — ajuste TERMOS no script se precisar refinar)\n`);
  }

  for (const t of tabelasLimitadas) {
    log(`- [${t.TABLE_TYPE}] ${t.TABLE_SCHEMA}.${t.TABLE_NAME}`);
  }

  log('\n' + '='.repeat(70));
  log('Colunas de cada tabela/view encontrada:\n');

  for (const t of tabelasLimitadas) {
    const colunas = await queryLeitura(
      `SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = @schema AND TABLE_NAME = @nome
       ORDER BY ORDINAL_POSITION`,
      { schema: t.TABLE_SCHEMA, nome: t.TABLE_NAME }
    );

    log(`## ${t.TABLE_SCHEMA}.${t.TABLE_NAME}`);
    for (const c of colunas) {
      log(`   ${c.COLUMN_NAME} (${c.DATA_TYPE}${c.IS_NULLABLE === 'YES' ? ', nullable' : ''})`);
    }
    log('');
  }

  const arquivoSaida = path.join(__dirname, '..', 'schema-contabil-descoberto.txt');
  fs.writeFileSync(arquivoSaida, linhasSaida.join('\n'), 'utf8');
  log(`\nSaída também salva em: ${arquivoSaida}`);

  process.exit(0);
}

main().catch((err) => {
  console.error('Erro ao explorar o schema:', err.message);
  process.exit(1);
});
