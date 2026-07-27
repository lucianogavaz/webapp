# Painel Financeiro

App interno do departamento financeiro, integrado à **Bimer Core API** (ERP Alterdata) já instalada no servidor.

## Estrutura

- `src/server.js` — servidor Express que serve o front-end e expõe endpoints internos.
- `src/lib/bimerClient.js` — cliente HTTP para a Bimer API: autentica em `/auth/token` (usuário/senha), guarda o token em memória e renova automaticamente.
- `src/lib/normalizarTitulo.js` — a Bimer API usa esquemas **diferentes** para título a pagar e título a receber (nomes de campo não batem entre si). Este módulo converte os dois para um formato único usado pelo resto do app.
- `src/lib/aging.js`, `src/lib/dfc.js`, `src/lib/dre.js` — regras de agregação (aging list, projeção de fluxo de caixa e DRE gerencial) a partir dos títulos a pagar/receber normalizados, já que a Bimer API não expõe esses relatórios prontos.
- `src/lib/bimerDb.js` — conexão **somente leitura** com o SQL Server do Bimer (usado para explorar o banco, ver seção "BP/DRE contábil via banco de dados" abaixo — hoje bloqueado, ver conclusão). Recusa qualquer query que não comece com `SELECT`/`WITH`.
- `scripts/explorar-*.js`, `scripts/verificar-razao-contabil.js`, `scripts/localizar-empresas.js` — scripts exploratórios usados para mapear o schema contábil do banco (só leem metadados/estrutura, nunca valores financeiros reais). Ver conclusão na seção abaixo — mantidos no repo caso a base de dados certa seja localizada no futuro.
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
| BP – Balanço Patrimonial | ❌ Bloqueada — a base não tem lançamentos contábeis escriturados (ver conclusão abaixo) |
| DRE Multidimensional, Indicadores | 🕒 Placeholder |
| DFC Multidimensional | 🕒 Placeholder — depende de definição dos eixos de análise (centro de custo x natureza x empresa) |
| DRE Orçamentária, Fluxo de Caixa Orçamentário | 🕒 Placeholder — depende de onde o orçamento é cadastrado (a API atual não tem endpoint de orçamento) |
| Visão de PowerBI, Visões de dashboards | 🕒 Placeholder — depende de workspace/relatórios do Power BI a embutir |

## BP/DRE contábil via banco de dados — investigado e bloqueado

A API REST do Bimer não expõe plano de contas nem lançamentos contábeis, então tentamos acesso direto ao SQL Server (`ERP`) onde a base do Bimer está instalada, usando um cliente somente leitura (`src/lib/bimerDb.js`, recusa qualquer query que não comece com `SELECT`/`WITH`) e uma sequência de scripts exploratórios (`scripts/explorar-*.js`).

### O que a investigação encontrou

1. **O banco `ERP` é compartilhado por um escritório de contabilidade com centenas de empresas-cliente** — `dbo.PlanoDeContas` tem 300+ linhas (uma por empresa atendida), a maioria sem relação com a Golden/Energy.
2. **As 3 empresas reais** estão em `dbo.EmpresaERP`:

   | CdEmpresa | Nome | IdPlanoDeContas |
   |---|---|---|
   | 1 | GOLDEN COMERCIO E LOCACAO DE EQUIPAMENTOS MEDICOS | 1 |
   | 2 | ENERGY COMERCIO DE EQUIP. HOSPITALARES EIRELI | 1 |
   | 3 | GOLDEN EXPORTACAO E IMPORTACAO DE EQUIPAMENTOS | 1 |

   As três compartilham o mesmo plano de contas (`IdPlanoDeContas=1`), que existe e está bem estruturado: `dbo.Contas.CdClassInterna` tem os grupos raiz `1=ATIVO`, `2=PASSIVO`, `3=COMPENSACOES`, `4=ENTRADAS E CUSTOS`, `5=DESPESAS`, `6=RECEITAS`.
3. **As tabelas de lançamento contábil (`dbo.MovimentoContabil` e `dbo.LoteMovimentoContabil`) têm ZERO linhas** — não só para Golden/Energy/Golden Exportação, mas para **qualquer** `CdEmpresa` na base inteira.

### Conclusão

O plano de contas existe, mas **não há nenhum lançamento contábil escriturado** para essas empresas nesse banco. Isso não é um problema de query errada — é confirmado por contagem total (`COUNT(*) = 0`) nas duas tabelas de razão contábil, com e sem filtro por empresa.

**BP e DRE contábil oficial não são possíveis a partir desta base de dados, como ela está hoje.** A escrituração contábil da Golden/Energy deve acontecer em outro lugar: outro produto (ex.: um sistema próprio do escritório de contabilidade), outro servidor/banco, ou é feita manualmente fora de qualquer sistema integrado ao Bimer. Antes de investir mais tempo nisso, pergunte para quem cuida da contabilidade dessas empresas onde a escrituração oficial realmente acontece — se não for numa base acessível, não há caminho técnico por aqui.

Os scripts exploratórios (`npm run explorar-schema-contabil`, `explorar-plano-contas`, `explorar-movimento-contabil`, `verificar-razao-contabil`, `localizar-empresas`) continuam no repositório caso a base certa seja localizada no futuro — nesse caso, a estrutura de `dbo.Contas`/`dbo.MovimentoContabil` já mapeada aqui serve de referência.

**Sobre segurança**, se isso for retomado no futuro: é banco de produção, use um login com permissão **apenas de SELECT** se possível, e nunca coloque a senha em arquivo versionado (só no `financeiro/.env` local, ignorado pelo git).

## Observações importantes sobre a Bimer API

- A API não tem endpoints prontos de DRE/Balanço/DFC, nem grupo de rotas "Contábil" (plano de contas, lançamento contábil, partida dobrada) — confirmado varrendo todos os 252 paths e tags da especificação OpenAPI fornecida. Os relatórios implementados aqui foram calculados a partir de `titulosAPagar`, `titulosAReceber` e `contas-bancarias/.../saldos`.
- **DRE Gerencial ≠ DRE contábil.** A tela de DRE não considera depreciação, provisões, impostos sobre o lucro nem ajustes contábeis — é só receita x despesa financeira por natureza de lançamento. Isso está avisado na própria tela.
- **BP (Balanço Patrimonial) não tem como ser feito com esta API.** Balanço exige ativo/passivo/patrimônio líquido reais, que só existem no módulo contábil do Bimer. Vale confirmar com o suporte Alterdata se existe uma API separada para o módulo contábil.
- `titulosAPagar` (`APagarConsultaContrato`) e `titulosAReceber` (`AReceberConsultaContrato`) têm **esquemas diferentes entre si** (ex: `valor`/`valorBaixado`/`identificadorPessoa` num, `valorTitulo`/`valorEmAberto`/`pessoa.identificador` no outro; natureza de lançamento fica dentro de `itens[]` num e no nível do título no outro). Todo acesso a esses campos deve passar por `normalizarTitulo.js` — não usar os campos brutos da API diretamente.
- A resolução de nome de cliente/fornecedor nas aging lists faz uma chamada por pessoa (`/api/pessoas/{id}`), com cache em memória e concorrência limitada — em bases muito grandes isso pode deixar o primeiro carregamento mais lento.
- **Códigos das empresas reais** (confirmados via `dbo.EmpresaERP`, ver seção de BP/DRE acima): `1` = Golden Comércio, `2` = Energy, `3` = Golden Exportação. `BIMER_CODIGO_EMPRESA_PADRAO` no `.env` já usa `1` por padrão.
