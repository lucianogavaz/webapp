# Painel Financeiro

App interno do departamento financeiro, integrado à **Bimer Core API** (ERP Alterdata) já instalada no servidor.

## Estrutura

- `src/server.js` — servidor Express que serve o front-end e expõe endpoints internos.
- `src/lib/bimerClient.js` — cliente HTTP para a Bimer API: autentica em `/auth/token` (usuário/senha), guarda o token em memória e renova automaticamente.
- `src/lib/aging.js`, `src/lib/dfc.js` — regras de agregação (aging list e projeção de fluxo de caixa) a partir dos títulos a pagar/receber, já que a Bimer API não expõe esses relatórios prontos.
- `src/routes/*` — endpoints `/api/empresas`, `/api/aging/contas-a-pagar`, `/api/aging/contas-a-receber`, `/api/dfc`.
- `public/` — front-end estático (HTML/CSS/JS puro, sem build step), com o menu Contábil / Tesouraria / Módulo Orçamentário / Serviços especiais.

## Como rodar

```bash
cd financeiro
npm install
cp .env.example .env
# edite .env com a URL da Bimer API e um usuário/senha com permissão de API
npm start
```

Acesse `http://localhost:3001`.

### Testar sem o ERP real (mock)

Para testar a UI sem depender do servidor Bimer, há um mock simples incluído:

```bash
npm run mock:bimer   # sobe uma Bimer API fake em :4000

# em outro terminal:
BIMER_API_URL=http://localhost:4000 BIMER_USERNAME=x BIMER_PASSWORD=x BIMER_CODIGO_EMPRESA_PADRAO=1 npm start
```

## Status das telas

| Tela | Status |
|---|---|
| DFC – Fluxo de Caixa | ✅ Implementada (posição bancária atual + projeção mensal de entradas/saídas a partir dos títulos em aberto) |
| Aging List do Contas a Pagar | ✅ Implementada |
| Aging List do Contas a Receber (Inadimplência) | ✅ Implementada |
| DRE, DRE Multidimensional, BP, Indicadores | 🕒 Placeholder — a Bimer API não expõe contas contábeis/plano de contas prontos; requer definição de origem dos dados (módulo contábil) |
| DFC Multidimensional | 🕒 Placeholder — depende de definição dos eixos de análise (centro de custo x natureza x empresa) |
| DRE Orçamentária, Fluxo de Caixa Orçamentário | 🕒 Placeholder — depende de onde o orçamento é cadastrado (a API atual não tem endpoint de orçamento) |
| Visão de PowerBI, Visões de dashboards | 🕒 Placeholder — depende de workspace/relatórios do Power BI a embutir |

## Observações importantes sobre a Bimer API

- A API não tem endpoints prontos de DRE/Balanço/DFC — os relatórios de Tesouraria implementados aqui foram calculados a partir de `titulosAPagar`, `titulosAReceber` e `contas-bancarias/.../saldos`.
- Para DRE/BP contábil de verdade, é necessário confirmar se o Bimer expõe consulta ao plano de contas contábil / lançamentos contábeis (não presente nesta versão da especificação OpenAPI fornecida). Vale confirmar com o suporte Alterdata se existe essa rota em outra versão da API.
- A resolução de nome de cliente/fornecedor nas aging lists faz uma chamada por pessoa (`/api/pessoas/{id}`), com cache em memória e concorrência limitada — em bases muito grandes isso pode deixar o primeiro carregamento mais lento.
