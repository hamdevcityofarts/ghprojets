// src/middlewares/authMiddleware.js
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const dotenv = require('dotenv');
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

// ✅ DÉFINITION CENTRALISÉE DES PERMISSIONS
const PERMISSIONS = {
  GESTION_UTILISATEURS: 'gestion_utilisateurs',
  GESTION_CHAMBRES: 'gestion_chambres',
  GESTION_RESERVATIONS: 'gestion_reservations',
  GESTION_CLIENTS: 'gestion_clients',
  ACCES_FINANCES: 'acces_finances',
  RAPPORTS: 'rapports',
  PARAMETRES_SYSTEME: 'parametres_systeme',
  GESTION_MENAGE: 'gestion_menage',
  GESTION_RESTAURANT: 'gestion_restaurant'
};

// ✅ MAPPING DES RÔLES ET PERMISSIONS PAR DÉFAUT
const ROLE_PERMISSIONS_MAP = {
  'admin': [
    PERMISSIONS.GESTION_UTILISATEURS,
    PERMISSIONS.GESTION_CHAMBRES,
    PERMISSIONS.GESTION_RESERVATIONS,
    PERMISSIONS.GESTION_CLIENTS,
    PERMISSIONS.ACCES_FINANCES,
    PERMISSIONS.RAPPORTS,
    PERMISSIONS.PARAMETRES_SYSTEME,
    PERMISSIONS.GESTION_MENAGE,
    PERMISSIONS.GESTION_RESTAURANT
  ],
  'manager': [
    PERMISSIONS.GESTION_CHAMBRES,
    PERMISSIONS.GESTION_RESERVATIONS,
    PERMISSIONS.GESTION_CLIENTS,
    PERMISSIONS.RAPPORTS,
    PERMISSIONS.GESTION_MENAGE,
    PERMISSIONS.GESTION_RESTAURANT
  ],
  'receptionist': [
    PERMISSIONS.GESTION_RESERVATIONS,
    PERMISSIONS.GESTION_CLIENTS
  ],
  'housekeeper': [
    PERMISSIONS.GESTION_MENAGE
  ],
  'supervisor': [
    PERMISSIONS.GESTION_CHAMBRES,
    PERMISSIONS.GESTION_RESERVATIONS,
    PERMISSIONS.GESTION_CLIENTS,
    PERMISSIONS.GESTION_MENAGE,
    PERMISSIONS.GESTION_RESTAURANT
  ],
  'technician': [
    PERMISSIONS.GESTION_CHAMBRES
  ],
  'client': []
};

// ✅ MAPPING DES DÉPARTEMENTS PAR RÔLE
const ROLE_DEPARTMENT_MAP = {
  'admin': 'direction',
  'manager': 'direction',
  'receptionist': 'reception',
  'housekeeper': 'housekeeping',
  'supervisor': 'direction',
  'technician': 'maintenance'
};

// -----------------------------------------------------------
// ✅ MIDDLEWARE D'AUTHENTIFICATION DE BASE
// -----------------------------------------------------------

/**
 * 🔹 Middleware de protection des routes (authentification)
 * Valide le JWT et charge les informations utilisateur
 */
exports.protect = async (req, res, next) => {
  let token;
  
  try {
    // Vérifier le token dans les headers
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'Non autorisé, aucun token fourni' 
      });
    }
    
    // Vérifier et décoder le token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    const userId = decoded.id || decoded.userId;
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        message: 'Token invalide: ID utilisateur manquant' 
      });
    }
    
    // Récupérer l'utilisateur depuis la base de données
    const user = await User.findById(userId).select('-password');
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Utilisateur introuvable' 
      });
    }
    
    // Vérifier le statut actif
    if (user.status !== 'actif') {
      return res.status(403).json({ 
        success: false, 
        message: 'Compte non actif. Contactez un administrateur.' 
      });
    }
    
    // Mettre à jour la dernière connexion
    user.lastLogin = new Date();
    await user.save();
    
    // Ajouter des informations utiles à la requête
    req.user = {
      _id: user._id,
      email: user.email,
      name: user.name,
      surname: user.surname,
      role: user.role || 'client',
      department: user.department,
      permissions: user.permissions || [],
      status: user.status
    };
    
    console.log(`🔐 Utilisateur authentifié: ${user.email} (${user.role}) - Permissions: ${user.permissions?.length || 0}`);
    
    next();
  } catch (err) {
    console.error('❌ Erreur token:', err);
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false, 
        message: 'Token expiré' 
      });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        success: false, 
        message: 'Token invalide' 
      });
    }
    return res.status(401).json({ 
      success: false, 
      message: 'Erreur d\'authentification' 
    });
  }
};

/**
 * 🔹 Authentification OPTIONNELLE (utilisé pour les routes publiques)
 * Si token valide, charge l'utilisateur, sinon continue sans utilisateur
 */
exports.optionalAuth = async (req, res, next) => {
  let token;
  
  try {
    // Vérifier si un token est présent
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    
    // Si pas de token, continuer sans utilisateur
    if (!token) {
      req.user = null;
      console.log('🔓 Accès sans authentification');
      return next();
    }
    
    // Vérifier le token
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      
      const userId = decoded.id || decoded.userId;
      if (!userId) {
        req.user = null;
        return next();
      }
      
      // Récupérer l'utilisateur
      const user = await User.findById(userId).select('-password');
      
      if (!user) {
        req.user = null;
      } else {
        // Vérifier le statut actif
        if (user.status !== 'actif') {
          req.user = null;
          console.log('⚠️ Utilisateur non actif détecté dans optionalAuth');
        } else {
          req.user = {
            _id: user._id,
            email: user.email,
            name: user.name,
            surname: user.surname,
            role: user.role || 'client',
            department: user.department,
            permissions: user.permissions || [],
            status: user.status
          };
          console.log(`🔐 Utilisateur authentifié optionnel: ${user.email} (${user.role})`);
        }
      }
    } catch (error) {
      // Token invalide ou expiré, continuer sans utilisateur
      console.log('⚠️ Token invalide ou expiré dans optionalAuth');
      req.user = null;
    }
    
    next();
  } catch (error) {
    console.error('❌ Erreur middleware optionalAuth:', error);
    req.user = null;
    next();
  }
};

// -----------------------------------------------------------
// ✅ MIDDLEWARE PAR RÔLE
// -----------------------------------------------------------

/**
 * 🔹 Admin uniquement
 */
exports.admin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      success: false, 
      message: 'Authentification requise' 
    });
  }
  
  if (req.user.role === 'admin') {
    console.log(`✅ Accès admin accordé à: ${req.user.email}`);
    return next();
  }
  
  console.log(`⛔ Tentative d'accès admin par: ${req.user.email} (${req.user.role})`);
  return res.status(403).json({ 
    success: false, 
    message: 'Accès réservé aux administrateurs' 
  });
};

/**
 * 🔹 Personnel uniquement (tous sauf client)
 */
exports.staff = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      success: false, 
      message: 'Authentification requise' 
    });
  }
  
  const staffRoles = ['admin', 'manager', 'receptionist', 'housekeeper', 'supervisor', 'technician'];
  if (staffRoles.includes(req.user.role)) {
    console.log(`✅ Accès personnel accordé à: ${req.user.email} (${req.user.role})`);
    return next();
  }
  
  console.log(`⛔ Tentative d'accès personnel par: ${req.user.email} (${req.user.role})`);
  return res.status(403).json({ 
    success: false, 
    message: 'Accès réservé au personnel' 
  });
};

/**
 * 🔹 Générique restrictTo (compatible avec code existant)
 */
exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Non authentifié'
      });
    }
    
    if (!roles.includes(req.user.role)) {
      console.log(`⛔ Rôle non autorisé: ${req.user.role} (requis: ${roles.join(' ou ')})`);
      return res.status(403).json({
        success: false,
        message: `Accès refusé - Rôle requis: ${roles.join(' ou ')}`
      });
    }
    
    console.log(`✅ Rôle autorisé: ${req.user.role}`);
    next();
  };
};

// -----------------------------------------------------------
// ✅ MIDDLEWARE DE PERMISSIONS PAR MODULE
// -----------------------------------------------------------

/**
 * 🔹 PERMISSION: GESTION_UTILISATEURS
 */
exports.gestionUtilisateurs = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      success: false, 
      message: 'Authentification requise' 
    });
  }
  
  if (req.user.role === 'admin') {
    console.log(`✅ Accès gestion_utilisateurs accordé à: ${req.user.email} (admin bypass)`);
    return next();
  }
  
  const hasPermission = req.user.permissions.includes(PERMISSIONS.GESTION_UTILISATEURS);
  
  if (hasPermission) {
    console.log(`✅ Accès gestion_utilisateurs accordé à: ${req.user.email} (permission)`);
    return next();
  }
  
  console.log(`⛔ Accès gestion_utilisateurs refusé à: ${req.user.email}`);
  return res.status(403).json({ 
    success: false, 
    message: 'Accès non autorisé - Permission requise: gestion_utilisateurs' 
  });
};

/**
 * 🔹 PERMISSION: GESTION_CHAMBRES
 */
exports.gestionChambres = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      success: false, 
      message: 'Authentification requise' 
    });
  }
  
  if (req.user.role === 'admin') {
    console.log(`✅ Accès gestion_chambres accordé à: ${req.user.email} (admin bypass)`);
    return next();
  }
  
  const hasPermission = req.user.permissions.includes(PERMISSIONS.GESTION_CHAMBRES);
  
  if (hasPermission) {
    console.log(`✅ Accès gestion_chambres accordé à: ${req.user.email} (permission)`);
    return next();
  }
  
  console.log(`⛔ Accès gestion_chambres refusé à: ${req.user.email}`);
  return res.status(403).json({ 
    success: false, 
    message: 'Accès non autorisé - Permission requise: gestion_chambres' 
  });
};

/**
 * 🔹 PERMISSION: GESTION_RESERVATIONS
 */
exports.gestionReservations = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      success: false, 
      message: 'Authentification requise' 
    });
  }
  
  if (req.user.role === 'admin') {
    console.log(`✅ Accès gestion_reservations accordé à: ${req.user.email} (admin bypass)`);
    return next();
  }
  
  const hasPermission = req.user.permissions.includes(PERMISSIONS.GESTION_RESERVATIONS);
  
  if (hasPermission) {
    console.log(`✅ Accès gestion_reservations accordé à: ${req.user.email} (permission)`);
    return next();
  }
  
  console.log(`⛔ Accès gestion_reservations refusé à: ${req.user.email}`);
  return res.status(403).json({ 
    success: false, 
    message: 'Accès non autorisé - Permission requise: gestion_reservations' 
  });
};

/**
 * 🔹 PERMISSION: GESTION_CLIENTS
 */
exports.gestionClients = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      success: false, 
      message: 'Authentification requise' 
    });
  }
  
  if (req.user.role === 'admin') {
    console.log(`✅ Accès gestion_clients accordé à: ${req.user.email} (admin bypass)`);
    return next();
  }
  
  const hasPermission = req.user.permissions.includes(PERMISSIONS.GESTION_CLIENTS);
  
  if (hasPermission) {
    console.log(`✅ Accès gestion_clients accordé à: ${req.user.email} (permission)`);
    return next();
  }
  
  console.log(`⛔ Accès gestion_clients refusé à: ${req.user.email}`);
  return res.status(403).json({ 
    success: false, 
    message: 'Accès non autorisé - Permission requise: gestion_clients' 
  });
};

/**
 * 🔹 PERMISSION: ACCES_FINANCES
 */
exports.acesFinances = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      success: false, 
      message: 'Authentification requise' 
    });
  }
  
  if (req.user.role === 'admin') {
    console.log(`✅ Accès acces_finances accordé à: ${req.user.email} (admin bypass)`);
    return next();
  }
  
  const hasPermission = req.user.permissions.includes(PERMISSIONS.ACCES_FINANCES);
  
  if (hasPermission) {
    console.log(`✅ Accès acces_finances accordé à: ${req.user.email} (permission)`);
    return next();
  }
  
  console.log(`⛔ Accès acces_finances refusé à: ${req.user.email}`);
  return res.status(403).json({ 
    success: false, 
    message: 'Accès non autorisé - Permission requise: acces_finances' 
  });
};

/**
 * 🔹 PERMISSION: RAPPORTS
 */
exports.rapports = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      success: false, 
      message: 'Authentification requise' 
    });
  }
  
  if (req.user.role === 'admin') {
    console.log(`✅ Accès rapports accordé à: ${req.user.email} (admin bypass)`);
    return next();
  }
  
  const hasPermission = req.user.permissions.includes(PERMISSIONS.RAPPORTS);
  
  if (hasPermission) {
    console.log(`✅ Accès rapports accordé à: ${req.user.email} (permission)`);
    return next();
  }
  
  console.log(`⛔ Accès rapports refusé à: ${req.user.email}`);
  return res.status(403).json({ 
    success: false, 
    message: 'Accès non autorisé - Permission requise: rapports' 
  });
};

/**
 * 🔹 PERMISSION: PARAMETRES_SYSTEME
 */
exports.parametresSysteme = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      success: false, 
      message: 'Authentification requise' 
    });
  }
  
  if (req.user.role === 'admin') {
    console.log(`✅ Accès parametres_systeme accordé à: ${req.user.email} (admin bypass)`);
    return next();
  }
  
  const hasPermission = req.user.permissions.includes(PERMISSIONS.PARAMETRES_SYSTEME);
  
  if (hasPermission) {
    console.log(`✅ Accès parametres_systeme accordé à: ${req.user.email} (permission)`);
    return next();
  }
  
  console.log(`⛔ Accès parametres_systeme refusé à: ${req.user.email}`);
  return res.status(403).json({ 
    success: false, 
    message: 'Accès non autorisé - Permission requise: parametres_systeme' 
  });
};

/**
 * 🔹 PERMISSION: GESTION_MENAGE
 */
exports.gestionMenage = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      success: false, 
      message: 'Authentification requise' 
    });
  }
  
  if (req.user.role === 'admin') {
    console.log(`✅ Accès gestion_menage accordé à: ${req.user.email} (admin bypass)`);
    return next();
  }
  
  const hasPermission = req.user.permissions.includes(PERMISSIONS.GESTION_MENAGE);
  
  if (hasPermission) {
    console.log(`✅ Accès gestion_menage accordé à: ${req.user.email} (permission)`);
    return next();
  }
  
  console.log(`⛔ Accès gestion_menage refusé à: ${req.user.email}`);
  return res.status(403).json({ 
    success: false, 
    message: 'Accès non autorisé - Permission requise: gestion_menage' 
  });
};

/**
 * 🔹 PERMISSION: GESTION_RESTAURANT
 */
exports.gestionRestaurant = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      success: false, 
      message: 'Authentification requise' 
    });
  }
  
  if (req.user.role === 'admin') {
    console.log(`✅ Accès gestion_restaurant accordé à: ${req.user.email} (admin bypass)`);
    return next();
  }
  
  const hasPermission = req.user.permissions.includes(PERMISSIONS.GESTION_RESTAURANT);
  
  if (hasPermission) {
    console.log(`✅ Accès gestion_restaurant accordé à: ${req.user.email} (permission)`);
    return next();
  }
  
  console.log(`⛔ Accès gestion_restaurant refusé à: ${req.user.email}`);
  return res.status(403).json({ 
    success: false, 
    message: 'Accès non autorisé - Permission requise: gestion_restaurant' 
  });
};

// -----------------------------------------------------------
// ✅ ALIAS POUR COMPATIBILITÉ
// -----------------------------------------------------------

exports.reservationAccess = exports.gestionReservations;
exports.clientManagementAccess = exports.gestionClients;
exports.roomManagementAccess = exports.gestionChambres;
exports.userManagementAccess = exports.gestionUtilisateurs;
exports.financeAccess = exports.acesFinances;
exports.reportAccess = exports.rapports;
exports.systemAccess = exports.parametresSysteme;
exports.housekeepingAccess = exports.gestionMenage;
exports.restaurantAccess = exports.gestionRestaurant;

// -----------------------------------------------------------
// ✅ UTILITAIRES
// -----------------------------------------------------------

exports.hasPermission = (user, permission) => {
  if (!user) return false;
  if (user.role === 'admin') return true;
  return user.permissions && user.permissions.includes(permission);
};

exports.hasRole = (user, role) => {
  if (!user) return false;
  return user.role === role;
};

exports.getDefaultPermissionsForRole = (role) => {
  return ROLE_PERMISSIONS_MAP[role] || [];
};

exports.generateAccessPolicy = (user) => {
  if (!user) return { allowed: false };
  
  return {
    allowed: true,
    role: user.role,
    department: user.department,
    permissions: user.permissions || [],
    hasGestionUtilisateurs: user.role === 'admin' || user.permissions.includes(PERMISSIONS.GESTION_UTILISATEURS),
    hasGestionChambres: user.role === 'admin' || user.permissions.includes(PERMISSIONS.GESTION_CHAMBRES),
    hasGestionReservations: user.role === 'admin' || user.permissions.includes(PERMISSIONS.GESTION_RESERVATIONS),
    hasGestionClients: user.role === 'admin' || user.permissions.includes(PERMISSIONS.GESTION_CLIENTS),
    hasAcesFinances: user.role === 'admin' || user.permissions.includes(PERMISSIONS.ACCES_FINANCES),
    hasRapports: user.role === 'admin' || user.permissions.includes(PERMISSIONS.RAPPORTS),
    hasParametresSysteme: user.role === 'admin' || user.permissions.includes(PERMISSIONS.PARAMETRES_SYSTEME),
    hasGestionMenage: user.role === 'admin' || user.permissions.includes(PERMISSIONS.GESTION_MENAGE),
    hasGestionRestaurant: user.role === 'admin' || user.permissions.includes(PERMISSIONS.GESTION_RESTAURANT)
  };
};

// -----------------------------------------------------------
// ✅ EXPORT DES CONSTANTES
// -----------------------------------------------------------

exports.PERMISSIONS = PERMISSIONS;
exports.ROLE_PERMISSIONS_MAP = ROLE_PERMISSIONS_MAP;
exports.ROLE_DEPARTMENT_MAP = ROLE_DEPARTMENT_MAP;

module.exports = exports;