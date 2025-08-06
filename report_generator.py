# report_generator.py

from flask import Flask, request, jsonify
import requests
import pydicom
from pydicom.dataset import Dataset, FileMetaDataset
from pydicom.sequence import Sequence
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph
from io import BytesIO
import datetime
import time

# --- CONFIGURAÇÃO ---
ORTHANC_URL = 'http://192.168.0.13:8042'
ORTHANC_AUTH = ('admin', 'admin123')
PYTHON_API_PORT = 5001

app = Flask(__name__)

def create_pdf_in_memory(report_text, patient_name, patient_id):
    """Cria um PDF simples em memória com o texto do laudo."""
    buffer = BytesIO()
    p = canvas.Canvas(buffer, pagesize=letter)
    width, height = letter

    styles = getSampleStyleSheet()
    style = styles['Normal']
    
    p.setFont("Helvetica-Bold", 16)
    p.drawCentredString(width / 2.0, height - 50, "Laudo de Exame - Zavtech")
    
    p.setFont("Helvetica", 12)
    p.drawString(50, height - 100, f"Paciente: {patient_name}")
    p.drawString(50, height - 120, f"ID do Paciente: {patient_id}")
    p.line(50, height - 130, width - 50, height - 130)

    p.setFont("Helvetica-Bold", 14)
    p.drawString(50, height - 160, "Observações Médicas")
    
    report_paragraph = Paragraph(report_text.replace('\n', '<br/>'), style)
    report_paragraph.wrapOn(p, width - 100, height - 200)
    report_paragraph.drawOn(p, 50, height - 180 - report_paragraph.height)

    p.showPage()
    p.save()
    
    buffer.seek(0)
    return buffer.read()

@app.route('/create-report', methods=['POST'])
def create_report():
    data = request.json
    orthanc_patient_id = data.get('orthancPatientId')
    report_text = data.get('reportText')
    patient_name = data.get('patientName')
    patient_id = data.get('patientId')

    if not all([orthanc_patient_id, report_text, patient_name, patient_id]):
        return jsonify({"error": "Dados insuficientes"}), 400

    try:
        # 1. Gerar o PDF
        pdf_bytes = create_pdf_in_memory(report_text, patient_name, patient_id)

        # 2. Criar um ficheiro DICOM para encapsular o PDF
        file_meta = FileMetaDataset()
        file_meta.MediaStorageSOPClassUID = '1.2.840.10008.5.1.4.1.1.104.1'  # Encapsulated PDF Storage
        file_meta.MediaStorageSOPInstanceUID = pydicom.uid.generate_uid()
        file_meta.ImplementationClassUID = pydicom.uid.generate_uid()
        file_meta.TransferSyntaxUID = pydicom.uid.ExplicitVRLittleEndian

        ds = Dataset()
        ds.file_meta = file_meta

        # Informações essenciais do DICOM
        ds.SOPClassUID = file_meta.MediaStorageSOPClassUID
        ds.SOPInstanceUID = file_meta.MediaStorageSOPInstanceUID
        ds.PatientName = patient_name
        ds.PatientID = patient_id
        
        now = datetime.datetime.now()
        ds.StudyDate = now.strftime('%Y%m%d')
        ds.StudyTime = now.strftime('%H%M%S')
        ds.AccessionNumber = ''
        ds.Modality = 'DOC'
        ds.SeriesNumber = "99" # Número de série para laudos
        ds.InstanceNumber = str(int(time.time())) # Número de instância único

        ds.StudyInstanceUID = pydicom.uid.generate_uid()
        ds.SeriesInstanceUID = pydicom.uid.generate_uid()
        
        # Encapsular o PDF
        ds.MIMETypeOfEncapsulatedDocument = 'application/pdf'
        ds.EncapsulatedDocument = pdf_bytes
        
        ds.is_little_endian = True
        ds.is_implicit_VR = False

        # 3. Enviar o ficheiro DICOM para o Orthanc
        dicom_buffer = BytesIO()
        pydicom.dcmwrite(dicom_buffer, ds, write_like_original=False)
        dicom_buffer.seek(0)
        
        headers = {'Content-Type': 'application/dicom'}
        orthanc_instances_url = f"{ORTHANC_URL}/instances"
        
        response = requests.post(orthanc_instances_url, data=dicom_buffer.getvalue(), headers=headers, auth=ORTHANC_AUTH)
        response.raise_for_status()

        return jsonify({"message": "Laudo DICOM PDF criado e salvo no PACS com sucesso!"}), 200

    except Exception as e:
        print(f"Erro: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(port=PYTHON_API_PORT, debug=True)
