# Painel Financeiro

App interno do departamento financeiro, integrado à **Bimer Core API** (ERP Alterdata) já instalada no servidor.

## Estrutura

- `src/server.js` — servidor Express que serve o front-end e expõe endpoints internos.
- `src/lib/bimerClient.js` — cliente HTTP para a Bimer API: autentica em `/auth/token` (usuário/senha), guarda o token em memória e renova automaticamente.
- `src/lib/normalizarTitulo.js` — a Bimer API usa esquemas **diferentes** para título a pagar e título a receber (nomes de campo não batem entre si). Este módulo converte os dois para um formato único usado pelo resto do app.
- `src/lib/aging.js`, `src/lib/dfc.js`, `src/lib/dre.js` — regras de agregação (aging list, projeção de fluxo de caixa e DRE gerencial) a partir dos títulos a pagar/receber normalizados, já que a Bimer API não expõe esses relatórios prontos.
- `src/lib/bimerDb.js` — conexão **somente leitura** com o SQL Server do Bimer (usado só para BP/DRE contábil, ver seção própria abaixo). Recusa qualquer query que não comece com `SELECT`/`WITH`.
- `scripts/explorar-schema-contabil.js` — script exploratório para descobrir os nomes de tabelas/colunas contábeis no banco (não lê dados, só metadados).
- `src/routes/*` — endpoints `/api/empresas`, `/api/aging/contas-a-pagar`, `/api/aging/contas-a-receber`, `/api/dfc`, `/api/dre`.
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
| DRE – Demonstrativo do Resultado do Exercício | ✅ Implementada como **DRE Gerencial aproximada** (receitas x despesas por natureza de lançamento, regime de competência via data de vencimento) — **não é a DRE contábil oficial**, ver aviso abaixo |
| BP – Balanço Patrimonial | 🚧 Em desenvolvimento via acesso direto ao SQL Server (ver seção "BP/DRE contábil via banco de dados" abaixo) |
| DRE Multidimensional, Indicadores | 🕒 Placeholder |
| DFC Multidimensional | 🕒 Placeholder — depende de definição dos eixos de análise (centro de custo x natureza x empresa) |
| DRE Orçamentária, Fluxo de Caixa Orçamentário | 🕒 Placeholder — depende de onde o orçamento é cadastrado (a API atual não tem endpoint de orçamento) |
| Visão de PowerBI, Visões de dashboards | 🕒 Placeholder — depende de workspace/relatórios do Power BI a embutir |

## BP/DRE contábil via banco de dados

A API REST do Bimer não expõe plano de contas nem lançamentos contábeis (ver observações abaixo), então BP e a DRE contábil oficial só são possíveis com acesso direto ao SQL Server onde a base do Bimer está instalada.

**Isso exige cuidado**: é o banco de produção do ERP. Use, se possível, um login de banco com permissão **apenas de SELECT** (não o mesmo usuário/senha da aplicação Bimer). Nunca coloque a senha do banco em nenhum arquivo versionado — ela vai só no `financeiro/.env` local, que é ignorado pelo git.

O schema interno do Bimer é proprietário e não documentado publicamente, então o fluxo para ligar essas telas é:

1. Copie `.env.example` para `.env` e preencha `BIMER_DB_SERVER` (IP ou hostname), `BIMER_DB_DATABASE`, `BIMER_DB_USER`, `BIMER_DB_PASSWORD`.
2. Rode o script exploratório, de dentro da rede onde o banco está acessível:
   ```bash
   cd financeiro
   npm run explorar-schema-contabil
   ```
   Ele só lê metadados (`INFORMATION_SCHEMA` — nomes de tabelas/views/colunas), nunca dados financeiros reais. A saída fica em `financeiro/schema-contabil-descoberto.txt` (não versionado).
3. Envie o conteúdo desse arquivo de volta para que as queries reais de BP e DRE contábil sejam escritas em cima das tabelas certas.
4. Toda consulta ao banco passa por `queryLeitura()` em `src/lib/bimerDb.js`, que recusa qualquer coisa que não comece com `SELECT`/`WITH` — proteção contra escrita acidental no ERP.

## Observações importantes sobre a Bimer API

- A API não tem endpoints prontos de DRE/Balanço/DFC, nem grupo de rotas "Contábil" (plano de contas, lançamento contábil, partida dobrada) — confirmado varrendo todos os 252 paths e tags da especificação OpenAPI fornecida. Os relatórios implementados aqui foram calculados a partir de `titulosAPagar`, `titulosAReceber` e `contas-bancarias/.../saldos`.
- **DRE Gerencial ≠ DRE contábil.** A tela de DRE não considera depreciação, provisões, impostos sobre o lucro nem ajustes contábeis — é só receita x despesa financeira por natureza de lançamento. Isso está avisado na própria tela.
- **BP (Balanço Patrimonial) não tem como ser feito com esta API.** Balanço exige ativo/passivo/patrimônio líquido reais, que só existem no módulo contábil do Bimer. Vale confirmar com o suporte Alterdata se existe uma API separada para o módulo contábil.
- `titulosAPagar` (`APagarConsultaContrato`) e `titulosAReceber` (`AReceberConsultaContrato`) têm **esquemas diferentes entre si** (ex: `valor`/`valorBaixado`/`identificadorPessoa` num, `valorTitulo`/`valorEmAberto`/`pessoa.identificador` no outro; natureza de lançamento fica dentro de `itens[]` num e no nível do título no outro). Todo acesso a esses campos deve passar por `normalizarTitulo.js` — não usar os campos brutos da API diretamente.
- A resolução de nome de cliente/fornecedor nas aging lists faz uma chamada por pessoa (`/api/pessoas/{id}`), com cache em memória e concorrência limitada — em bases muito grandes isso pode deixar o primeiro carregamento mais lento.
