const sql = require('mssql');

const DB_SERVER = process.env.BIMER_DB_SERVER || '';
const DB_PORT = process.env.BIMER_DB_PORT ? Number(process.env.BIMER_DB_PORT) : 1433;
const DB_DATABASE = process.env.BIMER_DB_DATABASE || '';
const DB_USER = process.env.BIMER_DB_USER || '';
const DB_PASSWORD = process.env.BIMER_DB_PASSWORD || '';
// SQL Server local/legado normalmente não tem certificado TLS válido configurado.
const DB_ENCRYPT = process.env.BIMER_DB_ENCRYPT === 'true';

let pool = null;

function isConfigured() {
  return Boolean(DB_SERVER && DB_DATABASE && DB_USER && DB_PASSWORD);
}

async function getPool() {
  if (!isConfigured()) {
    const err = new Error(
      'Banco de dados do Bimer não configurado. Defina BIMER_DB_SERVER, BIMER_DB_DATABASE, BIMER_DB_USER e BIMER_DB_PASSWORD no .env do financeiro/.'
    );
    err.status = 503;
    throw err;
  }

  if (pool) return pool;

  pool = new sql.ConnectionPool({
    server: DB_SERVER,
    port: DB_PORT,
    database: DB_DATABASE,
    user: DB_USER,
    password: DB_PASSWORD,
    options: {
      encrypt: DB_ENCRYPT,
      trustServerCertificate: true,
    },
    pool: { max: 5, min: 0, idleTimeoutMillis: 30000 },
    requestTimeout: 30000,
  });

  pool.on('error', (err) => {
    console.error('Erro na pool de conexão com o banco do Bimer:', err.message);
  });

  await pool.connect();
  return pool;
}

/**
 * Executa uma consulta somente leitura no banco do Bimer.
 * Por segurança, este helper recusa qualquer coisa que não comece com SELECT
 * ou WITH (CTE) — este app nunca deve escrever no banco do ERP.
 *
 * @param {string} query
 * @param {Record<string, unknown>} params parâmetros nomeados (usar sempre, nunca concatenar valores na query)
 */
async function queryLeitura(query, params = {}) {
  const inicio = query.trimStart().slice(0, 10).toUpperCase();
  if (!inicio.startsWith('SELECT') && !inicio.startsWith('WITH')) {
    throw new Error('Apenas consultas SELECT são permitidas neste app.');
  }

  const conexao = await getPool();
  const request = conexao.request();
  for (const [nome, valor] of Object.entries(params)) {
    request.input(nome, valor);
  }
  const resultado = await request.query(query);
  return resultado.recordset;
}

module.exports = { queryLeitura, isConfigured };
