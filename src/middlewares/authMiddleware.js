// src/middlewares/authMiddleware.js
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const dotenv = require('dotenv');
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

// ✅ Middleware de protection des routes
exports.protect = async (req, res, next) => {
  let token;
  
  try {
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    
    if (!token) {
      return res.status(401).json({ success: false, message: 'Non autorisé, aucun token fourni' });
    }
    
    const decoded = jwt.verify(token, JWT_SECRET);
    
    const userId = decoded.id || decoded.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Token invalide: ID utilisateur manquant' });
    }
    
    req.user = await User.findById(userId).select('-password');
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Utilisateur introuvable' });
    }
    
    // Vérifier le statut actif
    if (req.user.status !== 'actif') {
      return res.status(403).json({ success: false, message: 'Compte non actif. Contactez un administrateur.' });
    }
    
    // Mettre à jour lastLogin
    req.user.lastLogin = new Date();
    await req.user.save();
    
    next();
  } catch (err) {
    console.error('Erreur token:', err);
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expiré' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, message: 'Token invalide' });
    }
    return res.status(401).json({ success: false, message: 'Erreur d\'authentification' });
  }
};

// ✅ Middleware admin (compatible avec votre code existant)
exports.admin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') return next();
  return res.status(403).json({ success: false, message: 'Accès réservé aux administrateurs' });
};

// ✅ NOUVELLE FONCTION restrictTo (pour compatibilité avec chambreRoutes.js)
exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Non authentifié'
      });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Accès refusé - Rôle requis: ${roles.join(' ou ')}`
      });
    }
    
    next();
  };
};

// ✅ Middleware requireRole (votre version existante, compatible)
exports.requireRole = (...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ success: false, message: 'Non authentifié' });
  if (roles.includes(req.user.role)) return next();
  return res.status(403).json({ success: false, message: `Accès réservé aux rôles: ${roles.join(', ')}` });
};

// ✅ Middleware requirePermission (votre version existante)
exports.requirePermission = (...permissions) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ success: false, message: 'Non authentifié' });
  const hasAll = permissions.every(p => req.user.permissions.includes(p));
  if (hasAll) return next();
  return res.status(403).json({ success: false, message: `Permission(s) requise(s): ${permissions.join(', ')}` });
};

// ✅ AJOUTER cette fonction à la fin de votre authMiddleware.js existant

/**
 * 🔹 MIDDLEWARE: Authentification optionnelle
 * Extrait le token s'il existe, mais ne bloque pas si absent
 * Utile pour les routes accessibles aux visiteurs ET aux utilisateurs connectés
 */
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
      }
    } catch (error) {
      // Token invalide ou expiré, continuer sans utilisateur
      console.log('⚠️ Token invalide ou expiré:', error.message);
      req.user = null;
    }

    next();
  } catch (error) {
    console.error('❌ Erreur middleware optionalAuth:', error);
    req.user = null;
    next();
  }
};

/**
 * 🔹 MIDDLEWARE: Authentification requise (existant)
 */
exports.protect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Accès non autorisé. Authentification requise.'
      });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select('-password');

      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Utilisateur introuvable'
        });
      }

      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Token invalide ou expiré'
      });
    }
  } catch (error) {
    console.error('❌ Erreur middleware protect:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
};

/**
 * 🔹 MIDDLEWARE: Admin uniquement (existant)
 */
exports.admin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({
      success: false,
      message: 'Accès refusé. Droits administrateur requis.'
    });
  }
};