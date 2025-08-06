// diagnostico.js

const http = require('http');

// --- POR FAVOR, VERIFIQUE E CONFIRME ESTES DADOS ---
const ORTHANC_CONFIG = {
    host: '192.168.0.13',
    port: 8042,
    username: 'admin', // Verifique se este é o utilizador correto do seu orthanc.json
    password: 'admin123' // Verifique se esta é a senha correta do seu orthanc.json
};
// ----------------------------------------------------

console.log('--- Iniciando Teste de Diagnóstico ---');
console.log(`A tentar conectar a: http://${ORTHANC_CONFIG.host}:${ORTHANC_CONFIG.port}`);

const authToken = Buffer.from(`${ORTHANC_CONFIG.username}:${ORTHANC_CONFIG.password}`).toString('base64');

const options = {
    hostname: ORTHANC_CONFIG.host,
    port: ORTHANC_CONFIG.port,
    path: '/system', // Endpoint de teste do Orthanc
    method: 'GET',
    headers: {
        'Authorization': `Basic ${authToken}`
    }
};

const req = http.request(options, (res) => {
    console.log(`\n[RESPOSTA DO SERVIDOR] Código de Status: ${res.statusCode}`);

    if (res.statusCode === 200) {
        console.log('\n[SUCESSO!] A autenticação com o Orthanc funcionou perfeitamente.');
        console.log('Isto significa que as credenciais estão corretas e a rede está a funcionar.');
        console.log('Se o login ainda falha na aplicação, o problema está na comunicação entre o index.html e o server.js.');
    } else if (res.statusCode === 401) {
        console.error('\n[ERRO DE AUTENTICAÇÃO!] O Orthanc recusou as credenciais.');
        console.error('Por favor, verifique se o utilizador e a senha no ficheiro "diagnostico.js" são exatamente os mesmos que estão no seu ficheiro "orthanc.json".');
    } else {
        console.error(`\n[ERRO INESPERADO] O Orthanc respondeu com o código ${res.statusCode}.`);
    }

    res.on('data', (chunk) => {
        // Apenas para consumir a resposta
    });
    res.on('end', () => {
        console.log('\n--- Fim do Teste ---');
    });
});

req.on('error', (e) => {
    console.error(`\n[ERRO DE CONEXÃO!] Não foi possível conectar ao servidor Orthanc.`);
    console.error(`Detalhes do erro: ${e.message}`);
    console.error('\nPor favor, verifique:');
    console.error('1. Se o endereço IP do Orthanc está correto.');
    console.error('2. Se o Orthanc está a ser executado.');
    console.error('3. Se uma firewall não está a bloquear a porta 8042.');
    console.error('\n--- Fim do Teste ---');
});

req.end();
