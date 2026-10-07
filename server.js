require('dotenv').config()
const express = require('express')
const multer = require('multer')
const path = require('path')

// Cliente que gestiona los servicios de AWS
const { RekognitionClient, DetectLabelsCommand } = require('@aws-sdk/client-rekognition')

//Opcional (considerarse cuando se realice pruebas con FLOCI)
//Configuracion del mockup (dato de prueba personalizado)
const { mockClient } = require ("aws-sdk-client-mock")
const rekognitionMock = mockClient(RekognitionClient)

//Definir la respuesta personalizada
//Cuando el cliente detecte algun evento ,devolvera.... 
rekognitionMock.on(DetectLabelsCommand).resolves({
  Labels: [
    {Name: 'Hombre', Confidence: 99.4},
    {Name: 'Niño', Confidence: 89.4},
    {Name: 'Perro', Confidence: 91.2},
    {Name: 'Mujer', Confidence: 98.2},
  ]
})
//fin de mockup

const app = express()
const port = process.env.PORT || 3000

// Iniciar el servicio de reconocimiento (apunta a Floci en local)
const rekognitionClient = new RekognitionClient({
  region: process.env.AWS_REGION || 'us-east-1',
  endpoint: process.env.AWS_ENDPOINT_URL || 'http://localhost:4566',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
})

// Configuración de multer (subida de imágenes en memoria)
const upload = multer({ storage: multer.memoryStorage() })

// Servir archivos estáticos (.html)
app.use(express.static(path.join(__dirname, 'public')))
app.use(express.json())

// Ruta para procesar la imagen
app.post('/api/analizar', upload.single('imagen'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No adjuntó una imagen válida' })
    }

    // El buffer de la imagen subida
    const imagenBuffer = req.file.buffer

    // Parámetros para detectar etiquetas (machine learning / simulación)
    const params = {
      Image: { Bytes: imagenBuffer },
      MaxLabels: 10,
      MinConfidence: 75
    }

    // Instanciar y enviar el comando de detección
    const command = new DetectLabelsCommand(params)
    const response = await rekognitionClient.send(command)

    // Enviar la respuesta al front como JSON
    res.json({
      success: true,
      labels: response.Labels
    })
  } catch (error) {
    console.error('Error en el servicio AWS:', error)
    res.status(500).json({
      error: 'No se concretó el análisis en AWS Rekognition',
      details: error.message,
      code: error.name
    })
  }
})

// Iniciamos el servidor web
app.listen(port, () => {
  console.log(`Servidor ejecutándose en http://localhost:${port}`)
})