/*
 ============================================================================
  Name        : main.cpp
  Author      : Jules
  Version     : 1.0
  Description : Prova de Conceito (PoC) para leitura de arquivo DICOM com DCMTK
 ============================================================================

  COMO COMPILAR (em um ambiente macOS com DCMTK instalado via Homebrew):

  1. Instale o DCMTK:
     brew install dcmtk

  2. Compile o código:
     clang++ -std=c++11 -o dicom_reader main.cpp -I/usr/local/include -L/usr/local/lib -ldcmdata -lofstd

  3. Execute (você precisará de um arquivo DICOM de exemplo):
     ./dicom_reader /caminho/para/seu/arquivo.dcm

 ============================================================================
*/

#include <iostream>

// Headers principais da DCMTK para manipulação de dados DICOM
#include "dcmtk/dcmdata/dctk.h"
#include "dcmtk/dcmdata/dcfilefo.h"
#include "dcmtk/dcmdata/dcdatset.h"

// Headers para o suporte de codecs (necessário para registrar os codecs)
#include "dcmtk/dcmimgle/dcmimage.h"
#include "dcmtk/dcmjpeg/djdecode.h"  // Suporte a JPEG
#include "dcmtk/dcmjpls/djdecode.h"  // Suporte a JPEG-LS
// Para JP2K, seria necessário o módulo dcmjp2k e seu header correspondente

int main(int argc, char *argv[]) {
    if (argc != 2) {
        std::cerr << "Uso: " << argv[0] << " <caminho_do_arquivo_dicom>" << std::endl;
        return 1;
    }

    const char* dicomFilePath = argv[1];

    // --- Etapa 1: Registrar os codecs de descompressão ---
    // É crucial registrar os codecs que queremos suportar antes de carregar o arquivo.
    // Isso permite que a DCMTK descomprima arquivos que usam JPEG, JPEG-LS, etc.
    DJDecoderRegistration::registerCodecs(); // Registra codecs JPEG
    DJLSDecoderRegistration::registerCodecs(); // Registra codecs JPEG-LS
    // A chamada para o registro do JPEG 2000 seria similar aqui.

    // --- Etapa 2: Carregar o arquivo DICOM ---
    DcmFileFormat fileformat;
    OFCondition status = fileformat.loadFile(dicomFilePath);

    if (!status.good()) {
        std::cerr << "Erro: Nao foi possivel carregar o arquivo DICOM: " << status.text() << std::endl;
        // Não se esqueça de desregistrar os codecs ao sair
        DJDecoderRegistration::cleanup();
        DJLSDecoderRegistration::cleanup();
        return 1;
    }

    std::cout << "Arquivo DICOM carregado com sucesso: " << dicomFilePath << std::endl;
    std::cout << "------------------------------------------" << std::endl;

    // --- Etapa 3: Acessar o Dataset e ler as tags ---
    DcmDataset *dataset = fileformat.getDataset();

    OFString patientName, studyDescription, modality;

    // Tenta ler a tag "Patient's Name" (0010,0010)
    if (dataset->findAndGetOFString(DCM_PatientName, patientName).good()) {
        std::cout << "Nome do Paciente (0010,0010): " << patientName << std::endl;
    } else {
        std::cout << "Nome do Paciente (0010,0010): Nao encontrado." << std::endl;
    }

    // Tenta ler a tag "Study Description" (0008,1030)
    if (dataset->findAndGetOFString(DCM_StudyDescription, studyDescription).good()) {
        std::cout << "Descricao do Estudo (0008,1030): " << studyDescription << std::endl;
    } else {
        std::cout << "Descricao do Estudo (0008,1030): Nao encontrado." << std::endl;
    }

    // Tenta ler a tag "Modality" (0008,0060)
    if (dataset->findAndGetOFString(DCM_Modality, modality).good()) {
        std::cout << "Modalidade (0008,0060): " << modality << std::endl;
    } else {
        std::cout << "Modalidade (0008,0060): Nao encontrado." << std::endl;
    }

    std::cout << "------------------------------------------" << std::endl;
    std::cout << "Prova de Conceito concluida." << std::endl;

    // --- Etapa 4: Limpeza ---
    // Desregistra os codecs para liberar recursos.
    DJDecoderRegistration::cleanup();
    DJLSDecoderRegistration::cleanup();

    return 0;
}
