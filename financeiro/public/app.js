const MENU = [
  {
    titulo: 'Contábil',
    itens: [
      { chave: 'dre', nome: 'DRE – Demonstrativo do Resultado do Exercício' },
      { chave: 'dre-multi', nome: 'DRE Multidimensional' },
      { chave: 'bp', nome: 'BP – Balanço Patrimonial' },
      { chave: 'indicadores', nome: 'Indicadores Econômicos/Financeiros' },
    ],
  },
  {
    titulo: 'Tesouraria',
    itens: [
      { chave: 'dfc', nome: 'DFC – Fluxo de Caixa', pronto: true },
      { chave: 'dfc-multi', nome: 'DFC – Fluxo de Caixa Multidimensional' },
      { chave: 'aging-pagar', nome: 'Aging List do Contas a Pagar', pronto: true },
      { chave: 'aging-receber', nome: 'Aging List do Contas a Receber (Inadimplência)', pronto: true },
    ],
  },
  {
    titulo: 'Módulo Orçamentário',
    itens: [
      { chave: 'dre-orcamentaria', nome: 'DRE Orçamentária' },
      { chave: 'fluxo-orcamentario', nome: 'Fluxo de Caixa Orçamentário' },
    ],
  },
  {
    titulo: 'Serviços especiais',
    itens: [
      { chave: 'powerbi', nome: 'Visão de PowerBI' },
      { chave: 'dashboards', nome: 'Visões de dashboards' },
    ],
  },
];

const state = {
  viewKey: 'dfc',
  empresa: '',
};

const els = {
  menu: document.getElementById('menu'),
  viewTitle: document.getElementById('viewTitle'),
  content: document.getElementById('content'),
  filtroEmpresa: document.getElementById('filtroEmpresa'),
  filtroDataInicial: document.getElementById('filtroDataInicial'),
  filtroDataFinal: document.getElementById('filtroDataFinal'),
  labelDataInicial: document.getElementById('labelDataInicial'),
  labelDataFinal: document.getElementById('labelDataFinal'),
  btnAtualizar: document.getElementById('btnAtualizar'),
  avisoConfig: document.getElementById('avisoConfig'),
};

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const dataCurta = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '—');
const mesRotulo = (chave) => {
  const [ano, mes] = chave.split('-');
  return new Date(Number(ano), Number(mes) - 1, 1).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
};

function isoParaInput(date) {
  return date.toISOString().slice(0, 10);
}

async function api(path) {
  const res = await fetch(path);
  const dados = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(dados.mensagem || `Erro HTTP ${res.status}`);
  }
  return dados;
}

function achaItemMenu(chave) {
  for (const secao of MENU) {
    const item = secao.itens.find((i) => i.chave === chave);
    if (item) return item;
  }
  return null;
}

function montarMenu() {
  els.menu.innerHTML = '';
  for (const secao of MENU) {
    const titulo = document.createElement('div');
    titulo.className = 'menu-section-title';
    titulo.textContent = secao.titulo;
    els.menu.appendChild(titulo);

    for (const item of secao.itens) {
      const btn = document.createElement('button');
      btn.className = 'menu-item' + (item.chave === state.viewKey ? ' active' : '');
      btn.dataset.chave = item.chave;
      btn.innerHTML = `${item.nome}${item.pronto ? '' : '<span class="badge-em-breve">em breve</span>'}`;
      btn.addEventListener('click', () => selecionarView(item.chave));
      els.menu.appendChild(btn);
    }
  }
}

function selecionarView(chave) {
  state.viewKey = chave;
  document.querySelectorAll('.menu-item').forEach((el) => {
    el.classList.toggle('active', el.dataset.chave === chave);
  });

  const item = achaItemMenu(chave);
  els.viewTitle.textContent = item ? item.nome : chave;

  const usaFiltroPeriodo = chave === 'dfc' || chave === 'aging-pagar' || chave === 'aging-receber';
  els.labelDataInicial.style.display = usaFiltroPeriodo ? '' : 'none';
  els.labelDataFinal.style.display = usaFiltroPeriodo ? '' : 'none';

  if (chave === 'dfc') {
    const hoje = new Date();
    const frente = new Date(hoje);
    frente.setMonth(frente.getMonth() + 6);
    els.filtroDataInicial.value = isoParaInput(hoje);
    els.filtroDataFinal.value = isoParaInput(frente);
  } else if (chave === 'aging-pagar' || chave === 'aging-receber') {
    const hoje = new Date();
    const atras = new Date(hoje);
    atras.setFullYear(atras.getFullYear() - 2);
    els.filtroDataInicial.value = isoParaInput(atras);
    els.filtroDataFinal.value = isoParaInput(hoje);
  }

  carregarView();
}

async function carregarEmpresas() {
  try {
    const dados = await api('/api/empresas');
    const empresas = dados.listaObjetos || [];
    els.filtroEmpresa.innerHTML = empresas
      .map((e) => `<option value="${e.codigo}">${e.codigo} — ${e.nome || ''}</option>`)
      .join('');
    if (empresas.length) {
      state.empresa = empresas[0].codigo;
    }
  } catch (err) {
    els.filtroEmpresa.innerHTML = '<option value="">—</option>';
  }
}

async function verificarStatus() {
  try {
    const status = await api('/api/status');
    els.avisoConfig.hidden = Boolean(status.bimerConfigurado);
    return status.bimerConfigurado;
  } catch {
    els.avisoConfig.hidden = false;
    return false;
  }
}

function estadoCarregando() {
  els.content.innerHTML = '<div class="estado-mensagem">Carregando dados da Bimer API…</div>';
}

function estadoErro(mensagem) {
  els.content.innerHTML = `<div class="estado-mensagem erro">Não foi possível carregar os dados.<br>${mensagem}</div>`;
}

function kpiCard(label, valor, classe = '') {
  return `<div class="kpi-card"><div class="kpi-label">${label}</div><div class="kpi-value ${classe}">${valor}</div></div>`;
}

function renderPlaceholder(nome) {
  els.content.innerHTML = `
    <div class="placeholder">
      <h2>${nome}</h2>
      <p>Esta tela ainda não foi implementada nesta primeira versão do painel.<br>
      Assim que a regra de negócio for definida, ela será conectada à Bimer API.</p>
    </div>`;
}

function tagFaixa(chaveFaixa) {
  if (chaveFaixa === 'aVencer') return '<span class="tag ok">Em dia</span>';
  if (chaveFaixa === 'd1a30') return '<span class="tag atencao">Atenção</span>';
  return '<span class="tag critico">Crítico</span>';
}

async function renderAging(tipo) {
  estadoCarregando();
  const params = new URLSearchParams({
    codigoEmpresa: state.empresa,
    dataVencimentoInicial: els.filtroDataInicial.value,
    dataVencimentoFinal: els.filtroDataFinal.value,
  });

  try {
    const dados = await api(`/api/aging/${tipo}?${params.toString()}`);

    const faixasHtml = dados.faixas
      .map((f) => {
        const classeFaixa = f.chave === 'aVencer' ? 'faixa-avencer' : 'faixa-atrasada';
        return `
          <div class="faixa-linha ${classeFaixa}">
            <div>${f.rotulo}</div>
            <div class="faixa-bar-track"><div class="faixa-bar-fill" style="width:${f.percentual}%"></div></div>
            <div class="faixa-valor">${moeda.format(f.total)}</div>
            <div class="faixa-pct">${f.percentual}%</div>
          </div>`;
      })
      .join('');

    const linhasTabela = dados.titulos
      .slice(0, 300)
      .map(
        (t) => `
        <tr>
          <td>${t.pessoa}</td>
          <td>${t.numero || '—'}</td>
          <td>${dataCurta(t.dataVencimento)}</td>
          <td class="num">${t.diasEmAtraso}</td>
          <td>${tagFaixa(t.faixa)}</td>
          <td class="num">${moeda.format(t.saldo)}</td>
        </tr>`
      )
      .join('');

    els.content.innerHTML = `
      <div class="kpi-row">
        ${kpiCard('Saldo em aberto', moeda.format(dados.totalGeral))}
        ${kpiCard('Títulos em aberto', dados.quantidadeTitulos)}
        ${kpiCard('Vencidos acima de 90 dias', moeda.format(dados.faixas.find((f) => f.chave === 'd90mais')?.total || 0), 'negativo')}
      </div>

      <div class="panel">
        <h2>Distribuição por faixa de vencimento</h2>
        ${faixasHtml}
      </div>

      <div class="panel">
        <h2>Títulos (mostrando até 300 de ${dados.quantidadeTitulos})</h2>
        <table>
          <thead>
            <tr><th>Cliente/Fornecedor</th><th>Número</th><th>Vencimento</th><th class="num">Dias</th><th>Situação</th><th class="num">Saldo</th></tr>
          </thead>
          <tbody>${linhasTabela || '<tr><td colspan="6">Nenhum título em aberto no período.</td></tr>'}</tbody>
        </table>
      </div>`;
  } catch (err) {
    estadoErro(err.message);
  }
}

async function renderDFC() {
  estadoCarregando();
  const params = new URLSearchParams({
    codigoEmpresa: state.empresa,
    dataInicial: els.filtroDataInicial.value,
    dataFinal: els.filtroDataFinal.value,
  });

  try {
    const dados = await api(`/api/dfc?${params.toString()}`);

    const contasHtml = dados.contasBancarias
      .map(
        (c) => `
        <tr>
          <td>${c.descricao || '—'}</td>
          <td>${c.numeroConta || '—'}</td>
          <td>${dataCurta(c.dataReferencia)}</td>
          <td class="num">${moeda.format(c.valorSaldo)}</td>
        </tr>`
      )
      .join('');

    const projecaoHtml = dados.projecaoMensal
      .map(
        (p) => `
        <tr>
          <td>${mesRotulo(p.mes)}</td>
          <td class="num">${moeda.format(p.entradas)}</td>
          <td class="num">${moeda.format(p.saidas)}</td>
          <td class="num ${p.saldoDoMes >= 0 ? '' : 'negativo'}">${moeda.format(p.saldoDoMes)}</td>
          <td class="num">${moeda.format(p.saldoAcumulado)}</td>
        </tr>`
      )
      .join('');

    const listaNatureza = (lista) =>
      lista
        .slice(0, 10)
        .map((n) => `<tr><td>${n.nome}</td><td class="num">${moeda.format(n.valor)}</td></tr>`)
        .join('') || '<tr><td colspan="2">Sem lançamentos no período.</td></tr>';

    els.content.innerHTML = `
      <div class="kpi-row">
        ${kpiCard('Saldo atual em caixa/bancos', moeda.format(dados.saldoAtual))}
        ${kpiCard('Saldo projetado ao fim do período', moeda.format(dados.resumo.saldoProjetadoFinal))}
        ${kpiCard('Entradas previstas', moeda.format(dados.resumo.totalEntradas), 'positivo')}
        ${kpiCard('Saídas previstas', moeda.format(dados.resumo.totalSaidas), 'negativo')}
      </div>

      <div class="panel">
        <h2>Saldo por conta bancária</h2>
        <table>
          <thead><tr><th>Conta</th><th>Número</th><th>Referência</th><th class="num">Saldo</th></tr></thead>
          <tbody>${contasHtml || '<tr><td colspan="4">Nenhuma conta bancária encontrada.</td></tr>'}</tbody>
        </table>
      </div>

      <div class="panel">
        <h2>Projeção mensal (títulos em aberto)</h2>
        <table>
          <thead><tr><th>Mês</th><th class="num">Entradas</th><th class="num">Saídas</th><th class="num">Saldo do mês</th><th class="num">Saldo acumulado</th></tr></thead>
          <tbody>${projecaoHtml || '<tr><td colspan="5">Sem títulos em aberto no período.</td></tr>'}</tbody>
        </table>
      </div>

      <div class="panel">
        <h2>Entradas por natureza de lançamento</h2>
        <table><tbody>${listaNatureza(dados.entradasPorNatureza)}</tbody></table>
      </div>

      <div class="panel">
        <h2>Saídas por natureza de lançamento</h2>
        <table><tbody>${listaNatureza(dados.saidasPorNatureza)}</tbody></table>
      </div>`;
  } catch (err) {
    estadoErro(err.message);
  }
}

function carregarView() {
  const chave = state.viewKey;
  if (!state.empresa) {
    els.content.innerHTML = '<div class="estado-mensagem">Selecione uma empresa para continuar.</div>';
    return;
  }
  if (chave === 'dfc') return renderDFC();
  if (chave === 'aging-pagar') return renderAging('contas-a-pagar');
  if (chave === 'aging-receber') return renderAging('contas-a-receber');

  const item = achaItemMenu(chave);
  renderPlaceholder(item ? item.nome : chave);
}

els.filtroEmpresa.addEventListener('change', (e) => {
  state.empresa = e.target.value;
});
els.btnAtualizar.addEventListener('click', () => carregarView());

(async function iniciar() {
  montarMenu();
  await verificarStatus();
  await carregarEmpresas();
  els.filtroEmpresa.value = state.empresa;
  selecionarView(state.viewKey);
})();
