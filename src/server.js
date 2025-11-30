const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const path = require('path');
const fs = require('fs');

dotenv.config();
const app = express();

/* ----------------------------------------------
   🔎 LOG DES REQUÊTES
------------------------------------------------ */
app.use((req, res, next) => {
  console.log(`🌐 [${new Date().toISOString()}] ${req.method} ${req.path}`);
  if (req.method === 'OPTIONS') {
    console.log('   Origin:', req.headers.origin);
    console.log('   Requested Headers:', req.headers['access-control-request-headers']);
  }
  next();
});

/* ----------------------------------------------
   🌍 CONFIG CORS – VERSION COMPLÈTE MERGÉE
------------------------------------------------ */
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'http://127.0.0.1:5173',
  'https://admin.grandhotelaeroport.site',
  'https://grandhotelaeroport.site',
  
  process.env.FRONTEND_URL
].filter(Boolean);

const corsOptions = {
  origin: function (origin, callback) {
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
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

/* ----------------------------------------------
   📦 BODY PARSER
------------------------------------------------ */
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use((req, res, next) => {
  if (!['GET', 'OPTIONS'].includes(req.method)) {
    console.log('📤 Body reçu:', { method: req.method, path: req.path, bodyKeys: Object.keys(req.body) });
  }
  next();
});

/* ----------------------------------------------
   📁 UPLOADS STATIC
------------------------------------------------ */
const uploadsDir = path.join(__dirname, 'uploads');
const roomsDir = path.join(uploadsDir, 'rooms');

if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
if (!fs.existsSync(roomsDir)) fs.mkdirSync(roomsDir, { recursive: true });

app.use('/uploads', express.static(uploadsDir, {
  setHeaders: (res) => res.setHeader('Access-Control-Allow-Origin', '*')
}));

/* ----------------------------------------------
   📡 ROUTES API
------------------------------------------------ */
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/chambres', require('./routes/chambreRoutes'));
app.use('/api/reservations', require('./routes/reservationRoutes'));
app.use('/api/payments', require('./routes/paiementRoutes'));
app.use('/api/utilisateurs', require('./routes/userRoutes'));
app.use('/api/codepromo', require('./routes/codePromoRoutes'));

/* ----------------------------------------------
   📚 SWAGGER DOCS
------------------------------------------------ */
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'API Grand Hotel Aéroport',
      version: '1.0.0',
      description: 'Documentation de l’API Grand Hotel Aéroport'
    },
    servers: [
      {
        url: process.env.NODE_ENV === 'production'
          ? 'https://api.grandhotelaeroport.site/api'
          : `http://localhost:${process.env.PORT || 5000}/api`,
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }
      }
    }
  },
  apis: [path.join(__dirname, 'routes', '*.js')]
};

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerJsdoc(swaggerOptions)));

/* ----------------------------------------------
   🧪 ROUTE DE TEST
------------------------------------------------ */
app.get('/api/test', (req, res) => {
  res.json({
    message: 'API Grand Hotel Aéroport fonctionne!',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    uploads: {
      directory: uploadsDir,
      exists: fs.existsSync(uploadsDir),
      roomsDirectory: roomsDir,
      roomsExists: fs.existsSync(roomsDir)
    },
    cors: { allowedOrigins }
  });
});

/* ----------------------------------------------
   🏠 ROUTE DE BASE
------------------------------------------------ */
app.get('/', (req, res) => {
  res.json({
    message: 'Bienvenue sur l’API Grand Hotel Aéroport',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      chambres: '/api/chambres',
      reservations: '/api/reservations',
      payments: '/api/payments',
      users: '/api/utilisateurs',
      promo_codes: '/api/codepromo',
      documentation: '/api-docs',
      test: '/api/test'
    }
  });
});

/* ----------------------------------------------
   ❌ ERROR HANDLER GLOBAL
------------------------------------------------ */
app.use((error, req, res, next) => {
  console.error('💥 Erreur globale:', {
    message: error.message,
    url: req.originalUrl,
    origin: req.headers.origin
  });

  if (error.message.includes('CORS')) {
    return res.status(403).json({ success: false, message: 'Accès interdit par CORS' });
  }

  if (error.name === 'ValidationError') {
    return res.status(400).json({ success: false, errors: Object.values(error.errors).map(err => err.message) });
  }

  res.status(error.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Erreur serveur interne' : error.message
  });
});

/* ----------------------------------------------
   ⚠️ ROUTE 404
------------------------------------------------ */
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} non trouvée`
  });
});

/* ----------------------------------------------
   🔌 CONNEXION MONGODB
------------------------------------------------ */
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`✅ MongoDB Connecté: ${conn.connection.host}`);
  } catch (error) {
    console.error('❌ Erreur MongoDB:', error);
    process.exit(1);
  }
};

/* ----------------------------------------------
   🚀 START SERVER
------------------------------------------------ */
const startServer = async () => {
  await connectDB();
  const PORT = process.env.PORT || 5000;

  app.listen(PORT, () => {
    console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
  });
};

startServer();

module.exports = app;
