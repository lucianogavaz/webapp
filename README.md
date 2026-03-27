# Zavtech DICOM Viewer (Tauri Edition)

Este é um aplicativo de desktop para visualização de estudos DICOM, construído com tecnologias web usando o framework [Tauri](https://tauri.app/).

Este projeto foi criado para testar as capacidades de desenvolvimento assistido por IA.

## Pré-requisitos

Antes de executar o projeto, você precisa garantir que seu ambiente de desenvolvimento esteja configurado corretamente. O Tauri depende de **Rust** para o backend e **Node.js** para o frontend.

A maneira mais confiável de instalar tudo o que é necessário é seguir o guia oficial de pré-requisitos do Tauri, que fornece instruções detalhadas para macOS, Windows e Linux:

> **[Guia Oficial de Pré-requisitos do Tauri](https://tauri.app/v1/guides/getting-started/prerequisites)**

## Executando o Projeto

Após configurar os pré-requisitos, siga os passos abaixo no terminal, a partir da pasta raiz do projeto.

1.  **Instale as dependências do Node.js:**
    Este comando baixa todas as bibliotecas de frontend necessárias.
    ```bash
    npm install
    ```

2.  **Execute a aplicação em modo de desenvolvimento:**
    Este comando compila o backend Rust, inicia o servidor de desenvolvimento do frontend e abre a janela do aplicativo.
    ```bash
    npm run tauri dev
    ```

A aplicação deverá abrir em uma janela nativa no seu desktop. Quaisquer alterações feitas nos arquivos do frontend (HTML, CSS, JS/TS) serão refletidas automaticamente na aplicação.
