// server.js

const express = require('express');
const cors = require('cors');
const http = require('http');
const compression = require('compression');

const app = express();
const httpAgent = new http.Agent({ keepAlive: true });
// Aumenta o limite para 50MB para acomodar ficheiros DICOM grandes
app.use(express.raw({ type: 'application/dicom', limit: '50mb' }));
app.use(express.json({ limit: '50mb' }));

const PORT = 3000;
const HOST = '0.0.0.0';

const ORTHANC_CONFIG = {
    url: '192.168.0.13',
    port: 8042,
    username: 'admin',
    password: 'admin123'
};

app.use(cors());
app.use(compression());

function createHeaders(payload, contentType = 'application/json') {
    const headers = { 'Content-Type': contentType };
    if (payload) {
        headers['Content-Length'] = Buffer.isBuffer(payload) ? payload.length : Buffer.byteLength(payload);
    }
    const authToken = Buffer.from(`${ORTHANC_CONFIG.username}:${ORTHANC_CONFIG.password}`).toString('base64');
    headers['Authorization'] = `Basic ${authToken}`;
    return headers;
}

function requestOrthanc(options, payload = null) {
    const requestOptionsWithAgent = { ...options, agent: httpAgent };
    return new Promise((resolve, reject) => {
        const req = http.request(requestOptionsWithAgent, (res) => {
            const isBinary = ['application/pdf', 'application/dicom'].includes(res.headers['content-type']);
            const body = [];
            res.on('data', (chunk) => body.push(chunk));
            res.on('end', () => {
                const buffer = Buffer.concat(body);
                if (res.statusCode >= 400) {
                    let message = `Erro do Orthanc: ${res.statusCode}. Resposta: ${buffer.toString()}`;
                    if (res.statusCode === 401) message = 'Credenciais inválidas ou não fornecidas no server.js.';
                    return reject(new Error(message));
                }
                if (isBinary) {
                    resolve({ buffer, headers: res.headers });
                } else {
                    try { resolve(JSON.parse(buffer.toString())); } catch (e) { resolve(buffer.toString()); }
                }
            });
        });
        req.on('error', (e) => reject(new Error(`Não foi possível conectar ao Orthanc: ${e.message}`)));
        if (payload) req.write(payload);
        req.end();
    });
}

// Função genérica para fazer proxy de ficheiros do Orthanc
function proxyOrthancFile(req, res, path) {
    const options = {
        host: ORTHANC_CONFIG.url,
        port: ORTHANC_CONFIG.port,
        path: path,
        method: 'GET',
        headers: createHeaders(),
        agent: httpAgent
    };
    const proxyReq = http.request(options, (proxyRes) => {
        if (proxyRes.statusCode >= 400) {
            return res.status(proxyRes.statusCode).send(`Erro do Orthanc: ${proxyRes.statusCode}`);
        }
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res, { end: true });
    });
    proxyReq.on('error', (e) => res.status(500).send(e.message));
    proxyReq.end();
}

// Rota para buscar a lista de estudos
app.get('/api/studies', async (req, res) => {
    // 1. Otimização: Não usar "Expand", que é lento. A busca padrão já traz os tags principais.
    const findPayload = JSON.stringify({
        "Level": "Study",
        "Query": { "PatientName": "*" }
    });
    const options = { host: ORTHANC_CONFIG.url, port: ORTHANC_CONFIG.port, path: '/tools/find', method: 'POST', headers: createHeaders(findPayload) };

    try {
        const studiesFromOrthanc = await requestOrthanc(options, findPayload);
        const studiesArray = Array.isArray(studiesFromOrthanc) ? studiesFromOrthanc : [];

        // 2. Otimização: Verificar a existência de laudo PDF de forma mais eficiente e em paralelo.
        const formattedStudies = await Promise.all(studiesArray.map(async (study) => {
            const hasPdfReportPayload = JSON.stringify({
                "Level": "Series",
                "Query": {
                    "ParentStudy": study.ID,
                    "Modality": "DOC"
                },
                "Limit": 1 // Só precisamos saber se existe, não precisamos de todos.
            });
            const pdfCheckOptions = { host: ORTHANC_CONFIG.url, port: ORTHANC_CONFIG.port, path: '/tools/find', method: 'POST', headers: createHeaders(hasPdfReportPayload) };
            const pdfSeries = await requestOrthanc(pdfCheckOptions, hasPdfReportPayload);

            // Se o Orthanc não retornar PatientMainDicomTags, usamos um objeto vazio para evitar erros
            const patientTags = study.PatientMainDicomTags || {};
            const studyTags = study.MainDicomTags || {};

            return {
                id: study.ID,
                studyInstanceUid: studyTags.StudyInstanceUID,
                patientId: patientTags.PatientID || 'ID Desconhecido',
                patientName: patientTags.PatientName || 'Nome Desconhecido',
                orthancPatientId: study.ParentPatient,
                type: studyTags.StudyDescription || 'Descrição não disponível',
                date: studyTags.StudyDate || 'Data não disponível',
                modality: studyTags.Modality || 'N/A',
                hasPdfReport: pdfSeries.length > 0
            };
        }));

        res.json(formattedStudies);
    } catch (error) {
        console.error('[SERVER ERROR] Falha na rota /api/studies:', error);
        res.status(500).json({ message: `Erro interno no servidor: ${error.message}` });
    }
});

// Rota para buscar os detalhes de um paciente
app.get('/api/patient/:orthancPatientId', async (req, res) => {
    const { orthancPatientId } = req.params;
    const options = { host: ORTHANC_CONFIG.url, port: ORTHANC_CONFIG.port, path: `/patients/${orthancPatientId}?full=true`, method: 'GET', headers: createHeaders() };
    try {
        const patientDetails = await requestOrthanc(options);
        res.json(patientDetails);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Rota para buscar a lista de laudos PDF de um estudo
app.get('/api/study/:studyId/reports', async (req, res) => {
    const { studyId } = req.params;
    const options = { host: ORTHANC_CONFIG.url, port: ORTHANC_CONFIG.port, path: `/studies/${studyId}`, method: 'GET', headers: createHeaders() };
    try {
        const studyDetails = await requestOrthanc(options);
        const pdfSeries = studyDetails.Series.filter(s => s.MainDicomTags && s.MainDicomTags.Modality === 'DOC');
        const reportInstances = pdfSeries.map(s => ({
            id: s.Instances[0].ID,
            date: s.MainDicomTags.SeriesDate,
            time: s.MainDicomTags.SeriesTime
        }));
        res.json(reportInstances);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Rota para fazer proxy do ficheiro PDF de um laudo
app.get('/api/instance/:instanceId/pdf', (req, res) => {
    proxyOrthancFile(req, res, `/instances/${req.params.instanceId}/file`);
});

// Rota para fazer o upload de ficheiros DICOM
app.post('/api/upload', async (req, res) => {
    if (!req.body || req.body.length === 0) {
        return res.status(400).json({ message: 'Nenhum ficheiro recebido.' });
    }

    const options = {
        host: ORTHANC_CONFIG.url,
        port: ORTHANC_CONFIG.port,
        path: '/instances',
        method: 'POST',
        headers: createHeaders(req.body, 'application/dicom')
    };

    try {
        const orthancResponse = await requestOrthanc(options, req.body);
        res.status(200).json({ message: 'Ficheiro DICOM enviado com sucesso!', details: orthancResponse });
    } catch (error) {
        res.status(500).json({ message: `Falha no upload para o Orthanc: ${error.message}` });
    }
});

app.listen(PORT, HOST, () => {
    console.log(`Servidor-ponte para Zavtech Viewer rodando em http://${HOST}:${PORT}`);
});
