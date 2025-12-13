// src/middlewares/authMiddleware.js
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const dotenv = require('dotenv');
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

// ✅ Définition des permissions disponibles
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

// ✅ Définition des rôles et leurs permissions par défaut
const ROLE_PERMISSIONS = {
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
  'client': [] // Clients n'ont pas de permissions par défaut
};

// ✅ Middleware de protection des routes (authentification)
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
    req.user = await User.findById(userId).select('-password');
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Utilisateur introuvable' 
      });
    }
    
    // Vérifier le statut actif
    if (req.user.status !== 'actif') {
      return res.status(403).json({ 
        success: false, 
        message: 'Compte non actif. Contactez un administrateur.' 
      });
    }
    
    // Mettre à jour la dernière connexion
    req.user.lastLogin = new Date();
    await req.user.save();
    
    // Ajouter des informations utiles à la requête
    req.user.permissions = req.user.permissions || [];
    req.user.role = req.user.role || 'client';
    
    console.log(`🔐 Utilisateur authentifié: ${req.user.email} (${req.user.role})`);
    
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

// -----------------------------------------------------------
// ✅ MIDDLEWARE SPÉCIFIQUES PAR RÔLE
// -----------------------------------------------------------

// 🔹 Admin uniquement
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

// 🔹 Personnel uniquement (tous sauf client)
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

// -----------------------------------------------------------
// ✅ MIDDLEWARE SPÉCIFIQUES PAR MODULE (basés sur les permissions)
// -----------------------------------------------------------

// 🔹 Gestion des utilisateurs
exports.userManagementAccess = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      success: false, 
      message: 'Authentification requise' 
    });
  }
  
  // Admin a toujours accès
  if (req.user.role === 'admin') {
    return next();
  }
  
  // Vérifier la permission spécifique
  const hasPermission = req.user.permissions.includes(PERMISSIONS.GESTION_UTILISATEURS);
  
  if (hasPermission) {
    console.log(`✅ Accès gestion utilisateurs accordé à: ${req.user.email} (${req.user.role})`);
    return next();
  }
  
  console.log(`⛔ Tentative d'accès gestion utilisateurs par: ${req.user.email} (${req.user.role})`);
  return res.status(403).json({ 
    success: false, 
    message: 'Accès non autorisé à la gestion des utilisateurs' 
  });
};

// 🔹 Gestion des chambres
exports.roomManagementAccess = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      success: false, 
      message: 'Authentification requise' 
    });
  }
  
  // Admin a toujours accès
  if (req.user.role === 'admin') {
    return next();
  }
  
  // Vérifier la permission spécifique
  const hasPermission = req.user.permissions.includes(PERMISSIONS.GESTION_CHAMBRES);
  
  if (hasPermission) {
    console.log(`✅ Accès gestion chambres accordé à: ${req.user.email} (${req.user.role})`);
    return next();
  }
  
  console.log(`⛔ Tentative d'accès gestion chambres par: ${req.user.email} (${req.user.role})`);
  return res.status(403).json({ 
    success: false, 
    message: 'Accès non autorisé à la gestion des chambres' 
  });
};

// 🔹 Gestion des réservations
exports.reservationAccess = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      success: false, 
      message: 'Authentification requise' 
    });
  }
  
  // Admin a toujours accès
  if (req.user.role === 'admin') {
    return next();
  }
  
  // Vérifier la permission spécifique
  const hasPermission = req.user.permissions.includes(PERMISSIONS.GESTION_RESERVATIONS);
  
  if (hasPermission) {
    console.log(`✅ Accès gestion réservations accordé à: ${req.user.email} (${req.user.role})`);
    return next();
  }
  
  console.log(`⛔ Tentative d'accès gestion réservations par: ${req.user.email} (${req.user.role})`);
  return res.status(403).json({ 
    success: false, 
    message: 'Accès non autorisé à la gestion des réservations' 
  });
};

// 🔹 Gestion des clients
exports.clientManagementAccess = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      success: false, 
      message: 'Authentification requise' 
    });
  }
  
  // Admin a toujours accès
  if (req.user.role === 'admin') {
    return next();
  }
  
  // Vérifier la permission spécifique
  const hasPermission = req.user.permissions.includes(PERMISSIONS.GESTION_CLIENTS);
  
  if (hasPermission) {
    console.log(`✅ Accès gestion clients accordé à: ${req.user.email} (${req.user.role})`);
    return next();
  }
  
  console.log(`⛔ Tentative d'accès gestion clients par: ${req.user.email} (${req.user.role})`);
  return res.status(403).json({ 
    success: false, 
    message: 'Accès non autorisé à la gestion des clients' 
  });
};

// 🔹 Accès aux finances
exports.financeAccess = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      success: false, 
      message: 'Authentification requise' 
    });
  }
  
  // Admin a toujours accès
  if (req.user.role === 'admin') {
    return next();
  }
  
  // Vérifier la permission spécifique
  const hasPermission = req.user.permissions.includes(PERMISSIONS.ACCES_FINANCES);
  
  if (hasPermission) {
    console.log(`✅ Accès finances accordé à: ${req.user.email} (${req.user.role})`);
    return next();
  }
  
  console.log(`⛔ Tentative d'accès finances par: ${req.user.email} (${req.user.role})`);
  return res.status(403).json({ 
    success: false, 
    message: 'Accès non autorisé aux finances' 
  });
};

// 🔹 Accès aux rapports
exports.reportAccess = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      success: false, 
      message: 'Authentification requise' 
    });
  }
  
  // Admin a toujours accès
  if (req.user.role === 'admin') {
    return next();
  }
  
  // Vérifier la permission spécifique
  const hasPermission = req.user.permissions.includes(PERMISSIONS.RAPPORTS);
  
  if (hasPermission) {
    console.log(`✅ Accès rapports accordé à: ${req.user.email} (${req.user.role})`);
    return next();
  }
  
  console.log(`⛔ Tentative d'accès rapports par: ${req.user.email} (${req.user.role})`);
  return res.status(403).json({ 
    success: false, 
    message: 'Accès non autorisé aux rapports' 
  });
};

// 🔹 Accès aux paramètres système
exports.systemAccess = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      success: false, 
      message: 'Authentification requise' 
    });
  }
  
  // Admin a toujours accès
  if (req.user.role === 'admin') {
    return next();
  }
  
  // Vérifier la permission spécifique
  const hasPermission = req.user.permissions.includes(PERMISSIONS.PARAMETRES_SYSTEME);
  
  if (hasPermission) {
    console.log(`✅ Accès paramètres système accordé à: ${req.user.email} (${req.user.role})`);
    return next();
  }
  
  console.log(`⛔ Tentative d'accès paramètres système par: ${req.user.email} (${req.user.role})`);
  return res.status(403).json({ 
    success: false, 
    message: 'Accès non autorisé aux paramètres système' 
  });
};

// 🔹 Gestion du ménage
exports.housekeepingAccess = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      success: false, 
      message: 'Authentification requise' 
    });
  }
  
  // Admin a toujours accès
  if (req.user.role === 'admin') {
    return next();
  }
  
  // Vérifier la permission spécifique
  const hasPermission = req.user.permissions.includes(PERMISSIONS.GESTION_MENAGE);
  
  if (hasPermission) {
    console.log(`✅ Accès gestion ménage accordé à: ${req.user.email} (${req.user.role})`);
    return next();
  }
  
  console.log(`⛔ Tentative d'accès gestion ménage par: ${req.user.email} (${req.user.role})`);
  return res.status(403).json({ 
    success: false, 
    message: 'Accès non autorisé à la gestion du ménage' 
  });
};

// 🔹 Gestion du restaurant
exports.restaurantAccess = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      success: false, 
      message: 'Authentification requise' 
    });
  }
  
  // Admin a toujours accès
  if (req.user.role === 'admin') {
    return next();
  }
  
  // Vérifier la permission spécifique
  const hasPermission = req.user.permissions.includes(PERMISSIONS.GESTION_RESTAURANT);
  
  if (hasPermission) {
    console.log(`✅ Accès gestion restaurant accordé à: ${req.user.email} (${req.user.role})`);
    return next();
  }
  
  console.log(`⛔ Tentative d'accès gestion restaurant par: ${req.user.email} (${req.user.role})`);
  return res.status(403).json({ 
    success: false, 
    message: 'Accès non autorisé à la gestion du restaurant' 
  });
};

// -----------------------------------------------------------
// ✅ MIDDLEWARE GÉNÉRIQUES POUR LES PERMISSIONS
// -----------------------------------------------------------

// 🔹 Middleware requireRole (compatible avec votre code existant)
exports.requireRole = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      success: false, 
      message: 'Non authentifié' 
    });
  }
  
  if (roles.includes(req.user.role)) {
    console.log(`✅ Rôle requis satisfait: ${req.user.role} parmi ${roles.join(', ')}`);
    return next();
  }
  
  console.log(`⛔ Rôle requis non satisfait: ${req.user.role} n'est pas parmi ${roles.join(', ')}`);
  return res.status(403).json({ 
    success: false, 
    message: `Accès réservé aux rôles: ${roles.join(', ')}` 
  });
};

// 🔹 Middleware requirePermission (votre version existante)
exports.requirePermission = (...permissions) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      success: false, 
      message: 'Non authentifié' 
    });
  }
  
  // Admin a toutes les permissions
  if (req.user.role === 'admin') {
    console.log(`✅ Admin - Toutes permissions accordées`);
    return next();
  }
  
  // Vérifier si l'utilisateur a toutes les permissions requises
  const hasAll = permissions.every(p => req.user.permissions.includes(p));
  
  if (hasAll) {
    console.log(`✅ Permissions satisfaites: ${permissions.join(', ')}`);
    return next();
  }
  
  console.log(`⛔ Permissions manquantes: ${permissions.join(', ')}`);
  return res.status(403).json({ 
    success: false, 
    message: `Permission(s) requise(s): ${permissions.join(', ')}` 
  });
};

// 🔹 Middleware restrictTo (pour compatibilité avec chambreRoutes.js)
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
// ✅ FONCTIONS UTILITAIRES POUR LES PERMISSIONS
// -----------------------------------------------------------

// 🔹 Vérifier si un utilisateur a une permission spécifique
exports.hasPermission = (user, ...permissions) => {
  if (!user) return false;
  
  // Admin a toutes les permissions
  if (user.role === 'admin') return true;
  
  // Vérifier chaque permission
  return permissions.every(p => user.permissions.includes(p));
};

// 🔹 Vérifier si un utilisateur a un rôle spécifique
exports.hasRole = (user, ...roles) => {
  if (!user) return false;
  return roles.includes(user.role);
};

// 🔹 Obtenir les permissions par défaut pour un rôle
exports.getDefaultPermissionsForRole = (role) => {
  return ROLE_PERMISSIONS[role] || [];
};

// 🔹 Vérifier si un utilisateur peut accéder à un module spécifique
exports.canAccessModule = (user, module) => {
  if (!user) return false;
  
  // Admin peut tout faire
  if (user.role === 'admin') return true;
  
  // Mapper les modules aux permissions
  const modulePermissions = {
    'users': PERMISSIONS.GESTION_UTILISATEURS,
    'rooms': PERMISSIONS.GESTION_CHAMBRES,
    'reservations': PERMISSIONS.GESTION_RESERVATIONS,
    'clients': PERMISSIONS.GESTION_CLIENTS,
    'payments': PERMISSIONS.ACCES_FINANCES,
    'reports': PERMISSIONS.RAPPORTS,
    'system': PERMISSIONS.PARAMETRES_SYSTEME,
    'housekeeping': PERMISSIONS.GESTION_MENAGE,
    'restaurant': PERMISSIONS.GESTION_RESTAURANT
  };
  
  const requiredPermission = modulePermissions[module];
  if (!requiredPermission) return false;
  
  return user.permissions.includes(requiredPermission);
};

// -----------------------------------------------------------
// ✅ MIDDLEWARE AVANCÉS POUR LE CONTRÔLE D'ACCÈS
// -----------------------------------------------------------

// 🔹 Middleware pour vérifier les permissions basées sur le modèle utilisateur
exports.checkPermission = (...requiredPermissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentification requise'
      });
    }

    // Admin a accès à tout
    if (req.user.role === 'admin') {
      console.log(`✅ Admin - Accès accordé à toutes permissions`);
      return next();
    }

    // Vérifier si l'utilisateur a toutes les permissions requises
    const hasAllPermissions = requiredPermissions.every(permission => 
      req.user.permissions.includes(permission)
    );

    if (hasAllPermissions) {
      console.log(`✅ Permissions satisfaites pour: ${requiredPermissions.join(', ')}`);
      return next();
    }

    console.log(`⛔ Permissions insuffisantes. Requis: ${requiredPermissions.join(', ')}`);
    return res.status(403).json({
      success: false,
      message: `Permissions insuffisantes. Requis: ${requiredPermissions.join(', ')}`
    });
  };
};

// 🔹 Middleware pour vérifier les permissions OU le rôle
exports.checkPermissionOrRole = (permissions = [], roles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentification requise'
      });
    }

    // Vérifier si l'utilisateur a le rôle requis
    if (roles.length > 0 && roles.includes(req.user.role)) {
      console.log(`✅ Rôle satisfait: ${req.user.role} parmi ${roles.join(', ')}`);
      return next();
    }

    // Vérifier si l'utilisateur a les permissions requises
    if (permissions.length > 0) {
      const hasAllPermissions = permissions.every(permission => 
        req.user.permissions.includes(permission)
      );

      if (hasAllPermissions) {
        console.log(`✅ Permissions satisfaites: ${permissions.join(', ')}`);
        return next();
      }
    }

    // Aucune condition remplie
    console.log(`⛔ Accès refusé. Rôles autorisés: ${roles.join(', ')}. Permissions requises: ${permissions.join(', ')}`);
    return res.status(403).json({
      success: false,
      message: `Accès refusé. Rôles autorisés: ${roles.join(', ')}. Permissions requises: ${permissions.join(', ')}`
    });
  };
};

// 🔹 Middleware pour vérifier l'accès propriétaire (propriétaire de la ressource OU admin)
exports.checkOwnershipOrAdmin = (resourceOwnerField = 'user') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentification requise'
      });
    }

    // Admin a toujours accès
    if (req.user.role === 'admin') {
      console.log(`✅ Admin - Accès propriétaire accordé`);
      return next();
    }

    // Vérifier si l'utilisateur est le propriétaire de la ressource
    const resourceId = req.params.id;
    const userId = req.user._id;
    
    // Si la ressource appartient à l'utilisateur
    if (req[resourceOwnerField] && req[resourceOwnerField]._id.equals(userId)) {
      console.log(`✅ Utilisateur est propriétaire de la ressource`);
      return next();
    }

    console.log(`⛔ Utilisateur n'est pas propriétaire de la ressource`);
    return res.status(403).json({
      success: false,
      message: 'Accès non autorisé à cette ressource'
    });
  };
};

// -----------------------------------------------------------
// ✅ MIDDLEWARE D'AUTHENTIFICATION OPTIONNELLE
// -----------------------------------------------------------

// 🔹 Authentification optionnelle (utile pour les routes publiques/privées)
exports.optionalAuth = async (req, res, next) => {
  try {
    let token;

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
      
      // Support pour decoded.id ou decoded.userId
      const userId = decoded.id || decoded.userId;
      
      if (!userId) {
        req.user = null;
        return next();
      }
      
      // Récupérer l'utilisateur
      req.user = await User.findById(userId).select('-password');
      
      if (!req.user) {
        req.user = null;
      } else {
        // Vérifier le statut actif
        if (req.user.status !== 'actif') {
          req.user = null;
          console.log('⚠️ Utilisateur non actif détecté dans optionalAuth');
        } else {
          req.user.permissions = req.user.permissions || [];
          console.log(`🔐 Utilisateur authentifié optionnel: ${req.user.email} (${req.user.role})`);
        }
      }
    } catch (error) {
      // Token invalide ou expiré, continuer sans utilisateur
      console.log('⚠️ Token invalide ou expiré dans optionalAuth:', error.message);
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
// ✅ MIDDLEWARE DE VALIDATION DE DONNÉES UTILISATEUR
// -----------------------------------------------------------

// 🔹 Valider que l'utilisateur a un rôle valide
exports.validateUserRole = (req, res, next) => {
  const validRoles = ['admin', 'manager', 'receptionist', 'housekeeper', 'supervisor', 'technician', 'client'];
  
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentification requise'
    });
  }
  
  if (!validRoles.includes(req.user.role)) {
    console.error(`❌ Rôle utilisateur invalide: ${req.user.role}`);
    return res.status(400).json({
      success: false,
      message: `Rôle utilisateur invalide: ${req.user.role}`
    });
  }
  
  next();
};

// 🔹 Valider que l'utilisateur a des permissions valides
exports.validateUserPermissions = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentification requise'
    });
  }
  
  const validPermissions = Object.values(PERMISSIONS);
  const invalidPermissions = req.user.permissions.filter(p => !validPermissions.includes(p));
  
  if (invalidPermissions.length > 0) {
    console.error(`❌ Permissions utilisateur invalides: ${invalidPermissions.join(', ')}`);
    return res.status(400).json({
      success: false,
      message: `Permissions utilisateur invalides: ${invalidPermissions.join(', ')}`
    });
  }
  
  next();
};

// -----------------------------------------------------------
// ✅ FONCTION POUR GÉNÉRER DES POLITIQUES D'ACCÈS
// -----------------------------------------------------------

// 🔹 Générer une politique d'accès basée sur le rôle et les permissions
exports.generateAccessPolicy = (user) => {
  if (!user) return { allowed: false, reason: 'Non authentifié' };
  
  const policy = {
    allowed: true,
    role: user.role,
    permissions: user.permissions || [],
    modules: {}
  };
  
  // Déterminer quels modules sont accessibles
  const modules = {
    'users': PERMISSIONS.GESTION_UTILISATEURS,
    'rooms': PERMISSIONS.GESTION_CHAMBRES,
    'reservations': PERMISSIONS.GESTION_RESERVATIONS,
    'clients': PERMISSIONS.GESTION_CLIENTS,
    'payments': PERMISSIONS.ACCES_FINANCES,
    'reports': PERMISSIONS.RAPPORTS,
    'system': PERMISSIONS.PARAMETRES_SYSTEME,
    'housekeeping': PERMISSIONS.GESTION_MENAGE,
    'restaurant': PERMISSIONS.GESTION_RESTAURANT
  };
  
  Object.keys(modules).forEach(module => {
    policy.modules[module] = user.role === 'admin' || 
                            user.permissions.includes(modules[module]);
  });
  
  return policy;
};

// -----------------------------------------------------------
// ✅ EXPORT DES CONSTANTES POUR UTILISATION EXTERNE
// -----------------------------------------------------------

exports.PERMISSIONS = PERMISSIONS;
exports.ROLE_PERMISSIONS = ROLE_PERMISSIONS;

module.exports = exports;