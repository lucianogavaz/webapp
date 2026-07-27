const BIMER_API_URL = (process.env.BIMER_API_URL || '').replace(/\/+$/, '');
const USERNAME = process.env.BIMER_USERNAME || '';
const PASSWORD = process.env.BIMER_PASSWORD || '';

let cachedToken = null;
let tokenExpiresAt = 0;

function assertConfigured() {
  if (!BIMER_API_URL || !USERNAME || !PASSWORD) {
    const err = new Error(
      'Bimer API não configurada. Defina BIMER_API_URL, BIMER_USERNAME e BIMER_PASSWORD no .env do financeiro/.'
    );
    err.status = 503;
    throw err;
  }
}

async function fetchToken() {
  assertConfigured();

  const form = new URLSearchParams();
  form.set('username', USERNAME);
  form.set('password', PASSWORD);

  const res = await fetch(`${BIMER_API_URL}/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error(`Falha ao autenticar na Bimer API (HTTP ${res.status}): ${text}`);
    err.status = 502;
    throw err;
  }

  const data = await res.json();
  cachedToken = data.accessToken;
  // renova 60s antes de expirar
  tokenExpiresAt = Date.now() + Math.max((data.expiresIn || 300) - 60, 30) * 1000;
  return cachedToken;
}

async function getToken() {
  if (cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken;
  }
  return fetchToken();
}

/**
 * Faz uma chamada GET autenticada na Bimer API.
 * @param {string} path caminho iniciando com /api/...
 * @param {Record<string,string|number|undefined>} query
 */
async function bimerGet(path, query = {}) {
  assertConfigured();

  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') {
      qs.set(key, value);
    }
  }
  const url = `${BIMER_API_URL}${path}${qs.toString() ? `?${qs.toString()}` : ''}`;

  let token = await getToken();
  let res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });

  if (res.status === 401) {
    // token pode ter expirado antes do previsto: força renovação e tenta 1x
    cachedToken = null;
    token = await getToken();
    res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error(`Bimer API respondeu HTTP ${res.status} em ${path}: ${text}`);
    err.status = res.status >= 400 && res.status < 500 ? res.status : 502;
    throw err;
  }

  return res.json();
}

/**
 * Percorre um endpoint paginado da Bimer API (parâmetros limite/pagina) e
 * concatena `listaObjetos` de todas as páginas, até `maxPaginas` como trava
 * de segurança.
 */
async function bimerGetTodasPaginas(path, query = {}, { limite = 200, maxPaginas = 25 } = {}) {
  const itens = [];
  for (let pagina = 1; pagina <= maxPaginas; pagina += 1) {
    const resposta = await bimerGet(path, { ...query, limite, pagina });
    const lista = resposta?.listaObjetos || [];
    itens.push(...lista);
    if (lista.length < limite) break;
  }
  return itens;
}

module.exports = {
  bimerGet,
  bimerGetTodasPaginas,
  isConfigured: () => Boolean(BIMER_API_URL && USERNAME && PASSWORD),
};
