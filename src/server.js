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

// ✅ MIDDLEWARE DE LOG - AVANT CORS
app.use((req, res, next) => {
  console.log(`🌐 [${new Date().toISOString()}] ${req.method} ${req.path}`);
  if (req.method === 'OPTIONS') {
    console.log('   Origin:', req.headers.origin);
    console.log('   Requested Headers:', req.headers['access-control-request-headers']);
  }
  next();
});

// ✅ CONFIGURATION CORS - PRIORITÉ ABSOLUE
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:5173',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
      'http://127.0.0.1:5173',
      'https://admin.grandhotelaeroport.site',
      'https://grandhotelaeroport.site',
      process.env.FRONTEND_URL // Depuis .env
    ].filter(Boolean);

    // Accepter les requêtes sans origin (Mobile, Desktop, etc.)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`❌ CORS bloqué pour: ${origin}`);
      callback(new Error('CORS non autorisé'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
  optionsSuccessStatus: 200,
  preflightContinue: false
};

// ✅ APPLIQUER CORS AVANT TOUS LES AUTRES MIDDLEWARES
app.use(cors(corsOptions));

// ✅ GESTION MANUELLE DES PREFLIGHT - EN CAS DE BESOIN
app.options('*', cors(corsOptions));

// ✅ BODY PARSERS
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ✅ LOG REQUEST BODY (pour debugging)
app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'OPTIONS') {
    console.log('📤 Body reçu:', {
      method: req.method,
      path: req.path,
      bodyKeys: Object.keys(req.body)
    });
  }
  next();
});

// ✅ ROUTES API
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/chambres', require('./routes/chambreRoutes'));
app.use('/api/reservations', require('./routes/reservationRoutes'));
app.use('/api/payments', require('./routes/paiementRoutes'));
app.use('/api/utilisateurs', require('./routes/userRoutes'));
app.use('/api/codepromo', require('./routes/codePromoRoutes'));

// ✅ CONFIGURATION SWAGGER
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
        url: `http://localhost:${process.env.PORT || 5000}/api`,
        description: 'Serveur de développement',
      },
      {
        url: 'https://api.grandhotelaeroport.site/api',
        description: 'Serveur de production',
      }
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

// ✅ ROUTE DE TEST
app.get('/api/test', (req, res) => {
  res.json({
    message: 'API Grand Hotel fonctionne!',
    timestamp: new Date().toISOString(),
    cors: 'Activé ✅'
  });
});

// ✅ ROUTE RACINE
app.get('/', (req, res) => {
  res.json({
    message: 'Bienvenue sur l\'API Grand Hotel',
    environment: process.env.NODE_ENV || 'development',
    endpoints: {
      auth: '/api/auth',
      chambres: '/api/chambres',
      reservations: '/api/reservations',
      documentation: '/api-docs',
      test: '/api/test'
    }
  });
});

// ✅ GESTION DES ERREURS 404
app.use((req, res) => {
  console.warn(`⚠️ Route non trouvée: ${req.method} ${req.path}`);
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.path} non trouvée`,
    availableEndpoints: {
      chambres: '/api/chambres',
      reservations: '/api/reservations',
      auth: '/api/auth'
    }
  });
});

// ✅ GESTION DES ERREURS GLOBALES
app.use((err, req, res, next) => {
  console.error('❌ Erreur globale:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });

  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Erreur serveur interne',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// ✅ CONNEXION MONGODB ET DÉMARRAGE
const startServer = async () => {
  try {
    // Connexion MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/grandhotel';
    await mongoose.connect(mongoUri);
    console.log('✅ Connecté à MongoDB');

    // Démarrage du serveur
    const PORT = process.env.PORT || 5000;
    const server = app.listen(PORT, () => {
      console.log(`
╔════════════════════════════════════════╗
║   🚀 SERVEUR GRAND HOTEL DÉMARRÉ      ║
╠════════════════════════════════════════╣
║ Port: ${PORT.toString().padEnd(32)} ║
║ Environment: ${(process.env.NODE_ENV || 'development').padEnd(21)} ║
║ CORS: ✅ Activé                        ║
╠════════════════════════════════════════╣
║ 📚 Docs: http://localhost:${PORT}/api-docs   ║
║ 🔐 Test: http://localhost:${PORT}/api/test   ║
╚════════════════════════════════════════╝
      `);
    });

    // Gestion des erreurs de serveur
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} déjà utilisé`);
      } else {
        console.error('❌ Erreur serveur:', err);
      }
      process.exit(1);
    });

  } catch (error) {
    console.error('❌ Erreur démarrage:', error);
    process.exit(1);
  }
};

// Démarrer le serveur
startServer();

// ✅ GESTION SHUTDOWN PROPRE
process.on('SIGTERM', () => {
  console.log('⚠️ SIGTERM reçu, arrêt du serveur...');
  mongoose.disconnect();
  process.exit(0);
});