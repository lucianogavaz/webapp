require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');
const compression = require('compression');

const { isConfigured } = require('./lib/bimerClient');
const empresasRouter = require('./routes/empresas');
const agingRouter = require('./routes/aging');
const dfcRouter = require('./routes/dfc');
const dreRouter = require('./routes/dre');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(compression());
app.use(express.json());

app.get('/api/status', (req, res) => {
  res.json({ ok: true, bimerConfigurado: isConfigured() });
});

app.use('/api/empresas', empresasRouter);
app.use('/api/aging', agingRouter);
app.use('/api/dfc', dfcRouter);
app.use('/api/dre', dreRouter);

app.use(express.static(path.join(__dirname, '..', 'public')));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ mensagem: err.message || 'Erro interno' });
});

app.listen(PORT, () => {
  console.log(`Financeiro rodando em http://localhost:${PORT}`);
  if (!isConfigured()) {
    console.warn(
      'Aviso: BIMER_API_URL/BIMER_USERNAME/BIMER_PASSWORD não configurados. Copie financeiro/.env.example para financeiro/.env e preencha.'
    );
  }
});
