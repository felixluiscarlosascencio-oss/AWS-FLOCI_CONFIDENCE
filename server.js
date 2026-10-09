require('dotenv').config()
const express = require('express')
const multer = require('multer')
const path = require('path')

// Cliente que gestiona los servicios de AWS Textract
const { TextractClient, DetectDocumentTextCommand } = require('@aws-sdk/client-textract')

// Configuración del mockup (aws-sdk-client-mock)
const { mockClient } = require("aws-sdk-client-mock")
const textractMock = mockClient(TextractClient)

// Definir la respuesta personalizada para Textract (DetectDocumentText)
textractMock.on(DetectDocumentTextCommand).resolves({
  Blocks: [
    { BlockType: 'LINE', Text: 'flocy - 99.9%' }
  ]
})
// Fin del mockup

const app = express()
const port = process.env.PORT || 3000

// Iniciar el servicio de Textract (apunta a Floci en local)
const textractClient = new TextractClient({
  region: process.env.AWS_REGION || 'us-east-1',
  endpoint: process.env.AWS_ENDPOINT_URL || 'http://localhost:4566',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test'
  }
})

// Configuración de multer: solo archivos PDF y máx. 5 MB (5 * 1024 * 1024 bytes)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true)
    } else {
      cb(new Error('Solo se permiten archivos PDF.'))
    }
  }
})

// Servir archivos estáticos (.html)
app.use(express.static(path.join(__dirname, 'public')))
app.use(express.json())

// Ruta para procesar el archivo PDF
app.post('/api/analizar', (req, res, next) => {
  upload.single('documento')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ success: false, error: 'El archivo supera el límite de 5 MB' })
      }
      return res.status(400).json({ success: false, error: err.message })
    }
    next()
  })
}, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No adjuntó un archivo PDF válido' })
    }

    // El buffer del PDF subido
    const pdfBuffer = req.file.buffer

    // Parámetros para DetectDocumentText
    const params = {
      Document: {
        Bytes: pdfBuffer
      }
    }

    // Instanciar y enviar el comando de Textract
    const command = new DetectDocumentTextCommand(params)
    const response = await textractClient.send(command)

    // Filtrar los bloques de tipo Línea o Palabra
    const lineasTexto = response.Blocks
      ? response.Blocks.filter(b => b.BlockType === 'LINE' || b.BlockType === 'WORD').map(b => b.Text)
      : []

    // Enviar la respuesta al front
    res.json({
      success: true,
      texto: lineasTexto
    })
  } catch (error) {
    console.error('Error en el servicio AWS Textract:', error)
    res.status(500).json({
      success: false,
      error: 'No se concretó el análisis en AWS Textract',
      details: error.message
    })
  }
})

// Iniciamos el servidor web
app.listen(port, () => {
  console.log(`Servidor ejecutándose en http://localhost:${port}`)
})