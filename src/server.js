// server.js
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
  }
  next();
});

// ✅ ROUTES API (APRÈS LES MIDDLEWARES CORS)
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/chambres', require('./routes/chambreRoutes'));
app.use('/api/reservations', require('./routes/reservationRoutes'));
app.use('/api/payments', require('./routes/paiementRoutes'));
app.use('/api/utilisateurs', require('./routes/userRoutes'));
app.use('/api/codepromo', require('./routes/codePromoRoutes'));

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
    environment: process.env.NODE_ENV || 'development',
    endpoints: {
      auth: '/api/auth',
      chambres: '/api/chambres', 
      reservations: '/api/reservations',
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
    }
  });
});

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
    });

  } catch (error) {
    console.error('❌ Erreur connexion MongoDB:', error);
    console.log('🔧 URI MongoDB utilisé:', process.env.MONGODB_URI ? '✓ Configuré' : '✗ Non configuré');
    process.exit(1);
  }
};

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