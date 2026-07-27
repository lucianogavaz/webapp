/**
 * Segunda rodada de exploração, focada no plano de contas contábil
 * (dbo.Contas) e nos lançamentos contábeis (dbo.LoteMovimentoContabil),
 * já identificados como as tabelas-chave para BP/DRE contábil.
 *
 * Só lê estrutura/metadados e a lista de contas cadastradas (código e nome
 * da conta, sem nenhum valor financeiro de lançamento real).
 *
 *   cd financeiro
 *   node scripts/explorar-plano-contas.js
 *
 * Saída em financeiro/plano-contas-descoberto.txt (não versionado).
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
    console.error('Faltam variáveis BIMER_DB_* no financeiro/.env.');
    process.exit(1);
  }

  const linhasSaida = [];
  const log = (texto = '') => {
    console.log(texto);
    linhasSaida.push(texto);
  };

  log(`Explorando plano de contas em ${new Date().toISOString()}`);
  log('='.repeat(70));

  log('\n1) Views existentes no banco (candidatas a relatórios prontos tipo DRE/Balanço)');
  const views = await queryLeitura(
    `SELECT TABLE_SCHEMA, TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS ORDER BY TABLE_SCHEMA, TABLE_NAME`
  );
  log(`Total de views no banco: ${views.length}\n`);
  for (const v of views) log(`- ${v.TABLE_SCHEMA}.${v.TABLE_NAME}`);

  log('\n' + '='.repeat(70));
  log('2) Tipos de conta (TpConta) cadastrados em dbo.Contas, com quantidade de contas de cada tipo');
  const tipos = await queryLeitura(
    `SELECT TpConta, COUNT(*) AS Qtde FROM dbo.Contas GROUP BY TpConta ORDER BY TpConta`
  );
  for (const t of tipos) log(`- TpConta='${t.TpConta}' -> ${t.Qtde} contas`);

  log('\n' + '='.repeat(70));
  log('3) Contas de primeiro nível do plano de contas (raiz da hierarquia, sem conta master)');
  log('   (só estrutura: código e nome da conta — nenhum valor de lançamento real)\n');
  const raizes = await queryLeitura(`
    SELECT TOP 80 IdConta, CdClassInterna, CdClassExterna, TpConta, NmConta, StContaOrcamentaria, StContaCaixa
    FROM dbo.Contas
    WHERE IdContaMaster IS NULL
    ORDER BY CdClassInterna
  `);
  for (const r of raizes) {
    log(`- [Id=${r.IdConta}] classe=${r.CdClassInterna ?? '—'} Tp=${r.TpConta ?? '—'} orcamentaria=${r.StContaOrcamentaria ?? '—'} :: ${r.NmConta}`);
  }

  log('\n' + '='.repeat(70));
  log('4) Amostra de contas de nível 2 (filhas diretas de alguma conta raiz) — pra ver o padrão de código');
  const nivel2 = await queryLeitura(`
    SELECT TOP 80 c.IdConta, c.CdClassInterna, c.TpConta, c.NmConta, c.IdContaMaster, m.NmConta AS NmContaMaster
    FROM dbo.Contas c
    INNER JOIN dbo.Contas m ON m.IdConta = c.IdContaMaster
    WHERE m.IdContaMaster IS NULL
    ORDER BY c.CdClassInterna
  `);
  for (const r of nivel2) {
    log(`- [Id=${r.IdConta}] classe=${r.CdClassInterna ?? '—'} Tp=${r.TpConta ?? '—'} :: ${r.NmConta}  (dentro de: ${r.NmContaMaster})`);
  }

  log('\n' + '='.repeat(70));
  log('5) Tabelas contábeis que não couberam no primeiro relatório (itens 81 em diante)');
  const condicoes = TERMOS.map((_, i) => `LOWER(TABLE_NAME) LIKE @t${i}`).join(' OR ');
  const params = Object.fromEntries(TERMOS.map((t, i) => [`t${i}`, `%${t}%`]));
  const todasTabelas = await queryLeitura(
    `SELECT TABLE_SCHEMA, TABLE_NAME, TABLE_TYPE
     FROM INFORMATION_SCHEMA.TABLES
     WHERE ${condicoes}
     ORDER BY TABLE_SCHEMA, TABLE_NAME`,
    params
  );
  const restantes = todasTabelas.slice(80);
  log(`(${restantes.length} tabelas restantes de ${todasTabelas.length} no total)\n`);
  for (const t of restantes) log(`- [${t.TABLE_TYPE}] ${t.TABLE_SCHEMA}.${t.TABLE_NAME}`);

  const arquivoSaida = path.join(__dirname, '..', 'plano-contas-descoberto.txt');
  fs.writeFileSync(arquivoSaida, linhasSaida.join('\n'), 'utf8');
  log(`\nSaída também salva em: ${arquivoSaida}`);

  process.exit(0);
}

main().catch((err) => {
  console.error('Erro ao explorar o plano de contas:', err.message);
  process.exit(1);
});
