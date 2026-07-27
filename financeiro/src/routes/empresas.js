const express = require('express');
const { bimerGet } = require('../lib/bimerClient');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const empresas = await bimerGet('/api/empresas');
    res.json(empresas);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
