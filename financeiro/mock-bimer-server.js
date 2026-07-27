// Servidor fake da Bimer API, usado só para testar o financeiro/ localmente.
const express = require('express');
const app = express();
app.use(express.urlencoded({ extended: true }));

app.post('/auth/token', (req, res) => {
  res.json({ accessToken: 'fake-token', tokenType: 'Bearer', expiresIn: 3600, refreshToken: 'r' });
});

app.get('/api/empresas', (req, res) => {
  res.json({ listaObjetos: [{ codigo: 1, nome: 'Empresa Teste LTDA', cpfCnpj: '12345678000195' }], erros: [] });
});

const hoje = new Date();
function addDias(dias) {
  const d = new Date(hoje);
  d.setDate(d.getDate() + dias);
  return d.toISOString();
}

app.get('/api/titulosAPagar', (req, res) => {
  const pagina = Number(req.query.pagina || 1);
  if (pagina > 1) return res.json({ listaObjetos: [], erros: [] });
  res.json({
    listaObjetos: [
      { identificador: 'p1', numero: '001', valor: 1000, valorBaixado: 0, dataVencimento: addDias(-45), identificadorPessoa: 'f1', codigoEmpresa: '1', itens: [{ naturezaLancamento: { nome: 'Fornecedores' } }] },
      { identificador: 'p2', numero: '002', valor: 500, valorBaixado: 0, dataVencimento: addDias(10), identificadorPessoa: 'f2', codigoEmpresa: '1', itens: [{ naturezaLancamento: { nome: 'Aluguel' } }] },
    ],
    erros: [],
  });
});

app.get('/api/titulosAReceber', (req, res) => {
  const pagina = Number(req.query.pagina || 1);
  if (pagina > 1) return res.json({ listaObjetos: [], erros: [] });
  res.json({
    listaObjetos: [
      { identificador: 'r1', numero: '101', valor: 2000, valorBaixado: 500, dataVencimento: addDias(-100), identificadorPessoa: 'c1', codigoEmpresa: '1', itens: [{ naturezaLancamento: { nome: 'Vendas' } }] },
      { identificador: 'r2', numero: '102', valor: 3000, valorBaixado: 0, dataVencimento: addDias(20), identificadorPessoa: 'c2', codigoEmpresa: '1', itens: [{ naturezaLancamento: { nome: 'Serviços' } }] },
    ],
    erros: [],
  });
});

app.get('/api/pessoas/:id', (req, res) => {
  const nomes = { f1: 'Fornecedor Um', f2: 'Fornecedor Dois', c1: 'Cliente Um', c2: 'Cliente Dois' };
  res.json({ listaObjetos: [{ identificador: req.params.id, nome: nomes[req.params.id] || req.params.id }], erros: [] });
});

app.get('/api/contas-bancarias/empresas/:codigoEmpresa/saldos', (req, res) => {
  res.json({
    listaObjetos: [
      { identificador: 'cb1', descricao: 'Banco Principal', numeroConta: '1234-5', agencia: '001', dataReferencia: hoje.toISOString(), valorSaldo: 15000, valorEntrada: 0, valorSaida: 0 },
    ],
    erros: [],
  });
});

app.listen(4000, () => console.log('Mock Bimer API em http://localhost:4000'));
