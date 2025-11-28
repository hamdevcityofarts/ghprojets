const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const path = require('path');
const fs = require('fs');
const { corsMiddleware } = require('./config/cors'); // ✅ IMPORT DU NOUVEAU CORS

// Configuration environment
dotenv.config();

const app = express();

<<<<<<< HEAD
// ✅ MIDDLEWARE DE LOG - AVANT CORS
app.use((req, res, next) => {
  console.log(`🌐 [${new Date().toISOString()}] ${req.method} ${req.path}`);
  if (req.method === 'OPTIONS') {
    console.log('   Origin:', req.headers.origin);
    console.log('   Requested Headers:', req.headers['access-control-request-headers']);
=======
// ✅ MIDDLEWARE CORS PERSONNALISÉ (DOIT ÊTRE EN PREMIER)
app.use(corsMiddleware);

// ✅ BODY PARSER (APRÈS CORS)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ✅ ROUTE HEALTH CHECK (TRÈS IMPORTANT POUR LES TESTS)
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    message: 'API Grand Hôtel Aéroport is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// ✅ ROUTE SPÉCIALE POUR OPTIONS GLOBAL (fallback)
app.options('*', (req, res) => {
  console.log('🛫 Global OPTIONS handler triggered for:', req.originalUrl);
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 
    'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Auth-Token');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.status(204).send();
});

// Logs pour debugging
app.use((req, res, next) => {
  console.log(`🌐 ${new Date().toISOString()} ${req.method} ${req.originalUrl}`, {
    origin: req.headers.origin,
    'user-agent': req.headers['user-agent']
  });
  
  if (req.path.startsWith('/uploads')) {
    console.log(`📸 Requête image: ${req.method} ${req.path}`);
>>>>>>> 91ba48c4c7e51b4b49ce8cc5ec49c37c7c9c07bd
  }
  next();
});

<<<<<<< HEAD
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
=======
// ✅ ROUTES API (APRÈS LES MIDDLEWARES CORS)
>>>>>>> 91ba48c4c7e51b4b49ce8cc5ec49c37c7c9c07bd
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/chambres', require('./routes/chambreRoutes'));
app.use('/api/reservations', require('./routes/reservationRoutes'));
app.use('/api/payments', require('./routes/paiementRoutes'));
app.use('/api/utilisateurs', require('./routes/userRoutes'));
app.use('/api/codepromo', require('./routes/codePromoRoutes'));

<<<<<<< HEAD
// ✅ CONFIGURATION SWAGGER
=======
// ✅ SERVIR LES FICHIERS STATIQUES (IMAGES)
const uploadsDir = path.join(__dirname, 'uploads');
const roomsDir = path.join(uploadsDir, 'rooms');

// Créer les dossiers s'ils n'existent pas
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
if (!fs.existsSync(roomsDir)) {
  fs.mkdirSync(roomsDir, { recursive: true });
}

app.use('/uploads', express.static(uploadsDir, {
  setHeaders: (res, path) => {
    // ✅ HEADERS CORS POUR LES IMAGES
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
}));

// Configuration Swagger
>>>>>>> 91ba48c4c7e51b4b49ce8cc5ec49c37c7c9c07bd
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'API Grand Hotel Aéroport',
      version: '1.0.0',
      description: 'API pour la gestion de l\'hôtel Grand Hotel Aéroport',
    },
    servers: [
      {
        url: process.env.NODE_ENV === 'production' 
          ? 'https://api.grandhotelaeroport.site/api'
          : `http://localhost:${process.env.PORT || 5000}/api`,
        description: process.env.NODE_ENV === 'production' ? 'Serveur de production' : 'Serveur de développement',
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

<<<<<<< HEAD
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
=======
// ✅ ROUTE DE TEST COMPLÈTE
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'API Grand Hotel Aéroport fonctionne!',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    uploads: {
      directory: uploadsDir,
      exists: fs.existsSync(uploadsDir),
      roomsDirectory: roomsDir,
      roomsExists: fs.existsSync(roomsDir)
    },
    cors: {
      allowedOrigins: [
        'https://admin.grandhotelaeroport.site',
        'https://grandhotelaeroport.site',
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:5173'
      ]
    }
  });
});

// ✅ ROUTE DE BASE AMÉLIORÉE
app.get('/', (req, res) => {
  res.json({ 
    message: 'Bienvenue sur l\'API Grand Hotel Aéroport',
    version: '1.0.0',
>>>>>>> 91ba48c4c7e51b4b49ce8cc5ec49c37c7c9c07bd
    environment: process.env.NODE_ENV || 'development',
    endpoints: {
      auth: '/api/auth',
      chambres: '/api/chambres',
      reservations: '/api/reservations',
<<<<<<< HEAD
      documentation: '/api-docs',
      test: '/api/test'
=======
      payments: '/api/payments',
      users: '/api/utilisateurs',
      promo_codes: '/api/codepromo',
      documentation: '/api-docs',
      health: '/health',
      test: '/api/test'
    },
    cors: {
      status: 'activé',
      credentials: 'autorisés'
    }
  });
});

// ✅ GESTIONNAIRE D'ERREURS GLOBAL AMÉLIORÉ
app.use((error, req, res, next) => {
  console.error('💥 Erreur globale:', {
    message: error.message,
    stack: error.stack,
    url: req.originalUrl,
    method: req.method,
    origin: req.headers.origin
  });

  // Erreur CORS
  if (error.message.includes('CORS')) {
    return res.status(403).json({
      success: false,
      message: 'Accès interdit par la politique CORS',
      origin: req.headers.origin
    });
  }

  // Erreur de validation Mongoose
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Erreur de validation des données',
      errors: Object.values(error.errors).map(err => err.message)
    });
  }

  // Erreur CastError (ID invalide)
  if (error.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: 'ID invalide'
    });
  }

  // Erreur générale
  res.status(error.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' 
      ? 'Erreur serveur interne' 
      : error.message,
    ...(process.env.NODE_ENV !== 'production' && { stack: error.stack })
  });
});

// ✅ ROUTE 404 AMÉLIORÉE
app.use('*', (req, res) => {
  console.log('❌ Route non trouvée:', req.originalUrl);
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} non trouvée`,
    availableEndpoints: {
      auth: '/api/auth',
      chambres: '/api/chambres',
      reservations: '/api/reservations',
      documentation: '/api-docs'
>>>>>>> 91ba48c4c7e51b4b49ce8cc5ec49c37c7c9c07bd
    }
  });
});

<<<<<<< HEAD
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
=======
// ✅ CONNEXION MONGODB AVEC GESTION D'ERREURS AMÉLIORÉE
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    
    console.log(`✅ MongoDB Connecté: ${conn.connection.host}`);
    console.log(`📊 Base de données: ${conn.connection.name}`);
    
    // Événements de connexion
    mongoose.connection.on('error', (err) => {
      console.error('❌ Erreur MongoDB:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('🔌 MongoDB déconnecté');
>>>>>>> 91ba48c4c7e51b4b49ce8cc5ec49c37c7c9c07bd
    });

  } catch (error) {
    console.error('❌ Erreur connexion MongoDB:', error);
    console.log('🔧 URI MongoDB utilisé:', process.env.MONGODB_URI ? '✓ Configuré' : '✗ Non configuré');
    process.exit(1);
  }
};

<<<<<<< HEAD
// Démarrer le serveur
startServer();

// ✅ GESTION SHUTDOWN PROPRE
process.on('SIGTERM', () => {
  console.log('⚠️ SIGTERM reçu, arrêt du serveur...');
  mongoose.disconnect();
  process.exit(0);
});
=======
// ✅ DÉMARRAGE DU SERVEUR
const startServer = async () => {
  try {
    console.log('🚀 Démarrage du serveur Grand Hotel Aéroport...');
    console.log(`🌍 Environnement: ${process.env.NODE_ENV || 'development'}`);
    
    await connectDB();

    const PORT = process.env.PORT || 5000;
    const server = app.listen(PORT, () => {
      console.log(`\n🎉 Serveur démarré avec succès!`);
      console.log(`📍 Port: ${PORT}`);
      console.log(`🌐 URL: http://localhost:${PORT}`);
      console.log(`📚 Documentation: http://localhost:${PORT}/api-docs`);
      console.log(`❤️  Health Check: http://localhost:${PORT}/health`);
      console.log(`🔧 Test API: http://localhost:${PORT}/api/test`);
      console.log(`\n✅ Prêt à recevoir des requêtes!`);
    });

    // ✅ GESTION PROPRE DE L'ARRÊT
    process.on('SIGTERM', () => {
      console.log('🛑 Réception SIGTERM, arrêt gracieux...');
      server.close(() => {
        console.log('✅ Serveur arrêté');
        process.exit(0);
      });
    });

  } catch (error) {
    console.error('💥 Erreur critique démarrage:', error);
    process.exit(1);
  }
};

// ✅ DÉMARRAGE
startServer();

module.exports = app;
>>>>>>> 91ba48c4c7e51b4b49ce8cc5ec49c37c7c9c07bd
