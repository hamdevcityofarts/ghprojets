// server.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const path = require('path');
const fs = require('fs');

// Configuration environment
dotenv.config();

const app = express();

// ✅ CONFIGURATION CORS AMÉLIORÉE
const corsOptions = {
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    'http://127.0.0.1:5173',

    // PROD
    'https://backend.grandhotelaeroport.com',
    'https://grandhotelaeroport.com',
    'https://www.grandhotelaeroport.com',
    'https://admin.grandhotelaeroport.com' // ✅ AJOUT CRUCIAL
  ],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ CORRECTION : Utiliser path.join avec '..' pour remonter à la racine
const uploadsDir = path.join(__dirname, '..', 'uploads');
const roomsDir = path.join(uploadsDir, 'rooms');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('✅ Dossier uploads créé:', uploadsDir);
}

if (!fs.existsSync(roomsDir)) {
  fs.mkdirSync(roomsDir, { recursive: true });
  console.log('✅ Dossier uploads/rooms créé:', roomsDir);
}

// ✅ SERVIR LES FICHIERS STATIQUES AVEC EN-TÊTES CORS
app.use('/uploads', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET');
  res.header('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static(path.join(__dirname, '..', 'uploads')));

// Logs pour debugging
app.use((req, res, next) => {
  if (req.path.startsWith('/uploads')) {
    console.log(`📸 Requête image: ${req.method} ${req.path}`);
  }
  next();
});

// Routes API
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/chambres', require('./routes/chambreRoutes'));
app.use('/api/reservations', require('./routes/reservationRoutes'));
app.use('/api/payments', require('./routes/paiementRoutes'));
app.use('/api/utilisateurs', require('./routes/userRoutes'));

// Configuration Swagger
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'API Grand Hotel',
      version: '1.0.0',
      description: 'API pour la gestion de l\'hôtel Grand Hotel',
    },
    servers: [
      {
        // Cette ligne détecte automatiquement si on est en prod ou en local
        url: process.env.NODE_ENV === 'production' 
          ? 'https://backend.grandhotelaeroport.com/api' 
          : `http://localhost:${process.env.PORT || 5000}/api`,
        description: process.env.NODE_ENV === 'production' ? 'Serveur Production' : 'Serveur Local',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        }
      }
    },
  },
  apis: [path.join(__dirname, 'routes', '*.js')],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Route de test
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'API Grand Hotel fonctionne!',
    uploads: {
      directory: uploadsDir,
      exists: fs.existsSync(uploadsDir),
      roomsDirectory: roomsDir,
      roomsExists: fs.existsSync(roomsDir)
    }
  });
});

app.use((req, res, next) => {
  console.log(`🌐 ${new Date().toISOString()} ${req.method} ${req.originalUrl}`);
  next();
});

// Route de base
app.get('/', (req, res) => {
  res.json({ 
    message: 'Bienvenue sur l\'API Grand Hotel',
    endpoints: {
      auth: '/api/auth',
      chambres: '/api/chambres', 
      reservations: '/api/reservations',
      documentation: '/api-docs'
    }
  });
});

// Connexion MongoDB et démarrage
const startServer = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/grandhotel');
    console.log('✅ Connecté à MongoDB');



    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`\n🚀 Serveur démarré sur le port ${PORT}`);
      console.log(`📚 Documentation: http://localhost:${PORT}/api-docs`);
      console.log(`🔐 Test auth: http://localhost:${PORT}/api/auth/login`);
      console.log(`📁 Dossier uploads: ${uploadsDir}`);
      console.log(`📁 Dossier rooms: ${roomsDir}`);
      console.log(`🖼️  Images accessibles via: http://localhost:${PORT}/uploads/rooms/`);
    });

  } catch (error) {
    console.error('❌ Erreur démarrage:', error);
    process.exit(1);
  }
};

startServer();