// teste-simples-orthanc.js

const http = require('http');

// --- CONFIGURAÇÃO ---
// Altere estes valores para corresponderem ao seu ambiente
const ORTHANC_CONFIG = {
    host: '192.168.0.13',
    port: 8042,
    username: 'admin',
    password: 'admin123'
};

// --- PAYLOAD DA CONSULTA ---
// Esta é a consulta para encontrar todos os estudos
const findPayload = JSON.stringify({
    "Level": "Study",
    "Query": {
        "PatientName": "*"
    },
    // Adicionado para garantir que as tags do paciente sejam retornadas
    "Expand": true 
});

// --- OPÇÕES DA REQUISIÇÃO ---
const options = {
    hostname: ORTHANC_CONFIG.host,
    port: ORTHANC_CONFIG.port,
    path: '/tools/find',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(findPayload)
    }
};

// Adiciona autenticação se as credenciais forem fornecidas
if (ORTHANC_CONFIG.username && ORTHANC_CONFIG.password) {
    const auth = 'Basic ' + Buffer.from(ORTHANC_CONFIG.username + ':' + ORTHANC_CONFIG.password).toString('base64');
    options.headers['Authorization'] = auth;
    console.log('[INFO] A usar autenticação.');
}

console.log(`[INFO] A tentar conectar a ${ORTHANC_CONFIG.host}:${ORTHANC_CONFIG.port}...`);

// --- EXECUÇÃO DA REQUISIÇÃO ---
const req = http.request(options, (res) => {
    console.log(`[INFO] Status da Resposta: ${res.statusCode}`);
    
    let data = '';
    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        console.log('\n--- RESPOSTA BRUTA DO ORTHANC ---');
        try {
            const jsonData = JSON.parse(data);
            console.log(JSON.stringify(jsonData, null, 2)); // Imprime o JSON completo para depuração

            // NOVO: Extrai e lista os nomes dos pacientes
            console.log('\n--- NOMES DOS PACIENTES ENCONTRADOS ---');
            if (Array.isArray(jsonData) && jsonData.length > 0) {
                jsonData.forEach((study, index) => {
                    // Acessa o nome do paciente dentro das tags DICOM principais
                    const patientName = study.PatientMainDicomTags?.PatientName || 'Nome não encontrado';
                    console.log(`${index + 1}. ${patientName}`);
                });
            } else {
                console.log('Nenhum paciente encontrado na resposta.');
            }
            
            console.log(`\n[SUCESSO] Consulta realizada! Encontrados ${Array.isArray(jsonData) ? jsonData.length : 0} estudos.`);
        } catch (e) {
            console.log(data); // Se não for JSON, apenas imprime os dados brutos
            console.log('\n[AVISO] A resposta do Orthanc não era um JSON válido.');
        }
        console.log('--------------------------------\n');
    });
});

req.on('error', (e) => {
    console.error(`\n[ERRO] Problema com a requisição: ${e.message}`);
    console.error('[DICA] Verifique o endereço IP, a porta e se a firewall está a bloquear a conexão.');
});

// Envia o payload e finaliza a requisição
req.write(findPayload);
req.end();
