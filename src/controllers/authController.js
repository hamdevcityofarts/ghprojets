// src/controllers/authController.js
const User = require('../models/userModel');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '30d';

// Générer un token JWT
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

const getDefaultPermissions = (role) => {
  const permissionsMap = {
    admin: [
      'gestion_utilisateurs',
      'gestion_chambres',
      'gestion_reservations', 
      'gestion_clients',
      'acces_finances',
      'rapports',
      'parametres_systeme',
      'gestion_menage',
      'gestion_restaurant'
    ],
    manager: [
      'gestion_reservations',
      'gestion_clients', 
      'gestion_chambres',
      'rapports',
      'gestion_menage',
      'gestion_restaurant'
    ],
    receptionist: [
      'gestion_reservations',
      'gestion_clients'
    ],
    housekeeper: ['gestion_menage'],
    supervisor: [
      'gestion_reservations',
      'gestion_clients',
      'gestion_menage'
    ],
    technician: [],
    client: []
  };
  return permissionsMap[role] || [];
};

// Register
exports.register = async (req, res) => {
  const { name, surname, email, password, phone, department, role = 'client', hireDate } = req.body;

  try {
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Les champs nom, email et mot de passe sont obligatoires' });
    }

    const normalizedEmail = String(email).toLowerCase().trim();

    const userExists = await User.findOne({ email: normalizedEmail });
    if (userExists) {
      return res.status(400).json({ message: 'Un utilisateur avec cet email existe déjà' });
    }

    let status = 'actif';
    if (role !== 'client') status = 'pending';

    const permissions = getDefaultPermissions(role);

    const user = await User.create({
      name,
      surname,
      email: normalizedEmail,
      password,
      phone,
      department,
      role,
      hireDate: hireDate ? new Date(hireDate) : undefined,
      status,
      permissions,
      memberSince: new Date()
    });

    const token = generateToken(user._id);

    res.status(201).json({
      message: 'Inscription réussie',
      user: {
        id: user._id,
        name: user.name,
        surname: user.surname,
        email: user.email,
        phone: user.phone,
        department: user.department,
        role: user.role,
        status: user.status,
        permissions: user.permissions,
        hireDate: user.hireDate,
        memberSince: user.memberSince
      },
      token
    });
  } catch (error) {
    console.error('Erreur inscription:', error);
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ message: 'Données invalides', errors });
    }
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Un utilisateur avec cet email existe déjà' });
    }
    res.status(500).json({ message: 'Erreur serveur lors de l\'inscription' });
  }
};

// Login - CORRECTION MAJEURE
exports.login = async (req, res) => {
  const { email, password } = req.body;

  try {
    // Validation des entrées
    if (!email || !password) {
      return res.status(400).json({ message: 'L\'email et le mot de passe sont obligatoires' });
    }

    const normalizedEmail = String(email).toLowerCase().trim();

    console.log('🔍 Tentative de connexion:', normalizedEmail);

    // CRITIQUE: select('+password') car password a select: false dans le modèle
    const user = await User.findOne({ email: normalizedEmail }).select('+password');

    if (!user) {
      console.log('❌ Utilisateur non trouvé:', normalizedEmail);
      return res.status(401).json({ message: 'Email ou mot de passe invalide' });
    }

    console.log('✅ Utilisateur trouvé:', user.email);
    console.log('🔐 Mot de passe hashé présent:', !!user.password);

    // Vérification du mot de passe
    const isMatch = await user.matchPassword(password);
    
    console.log('🔑 Résultat matchPassword:', isMatch);

    if (!isMatch) {
      console.log('❌ Mot de passe incorrect');
      return res.status(401).json({ message: 'Email ou mot de passe invalide' });
    }

    // Check status
    if (user.status === 'inactif') {
      return res.status(403).json({ message: 'Votre compte a été désactivé. Contactez l\'administrateur.' });
    }
    if (user.status === 'pending') {
      return res.status(403).json({ message: 'Votre compte est en attente de validation par un administrateur.' });
    }
    if (user.status === 'en_conge') {
      return res.status(403).json({ message: 'Votre compte est actuellement en congé.' });
    }

    // Mise à jour lastLogin
    user.lastLogin = new Date();
    
    // CORRECTION: Marquer password comme non modifié pour éviter re-hashing
    user.password = undefined;
    await User.updateOne({ _id: user._id }, { lastLogin: user.lastLogin });

    const token = generateToken(user._id);

    console.log('✅ Connexion réussie pour:', user.email);

    // Respond without password
    res.json({
      message: 'Connexion réussie',
      user: {
        id: user._id,
        name: user.name,
        surname: user.surname,
        email: user.email,
        phone: user.phone,
        department: user.department,
        role: user.role,
        status: user.status,
        permissions: user.permissions,
        hireDate: user.hireDate,
        lastLogin: user.lastLogin,
        memberSince: user.memberSince
      },
      token
    });
  } catch (error) {
    console.error('❌ Erreur connexion:', error);
    res.status(500).json({ message: 'Erreur serveur lors de la connexion' });
  }
};

// Profile
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');

    if (!user) return res.status(404).json({ message: 'Utilisateur non trouvé' });

    res.json({
      user: {
        id: user._id,
        name: user.name,
        surname: user.surname,
        email: user.email,
        phone: user.phone,
        department: user.department,
        role: user.role,
        status: user.status,
        permissions: user.permissions,
        hireDate: user.hireDate,
        lastLogin: user.lastLogin,
        memberSince: user.memberSince,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });
  } catch (error) {
    console.error('Erreur profil:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// Update profile
exports.updateProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) return res.status(404).json({ message: 'Utilisateur non trouvé' });

    user.name = req.body.name || user.name;
    user.surname = req.body.surname || user.surname;
    user.email = req.body.email ? String(req.body.email).toLowerCase().trim() : user.email;
    user.phone = req.body.phone || user.phone;
    user.department = req.body.department || user.department;

    if (req.body.role || req.body.status) {
      return res.status(403).json({ message: 'Modification du rôle ou du statut non autorisée via cette route' });
    }

    const updatedUser = await user.save();

    res.json({
      message: 'Profil mis à jour avec succès',
      user: {
        id: updatedUser._id,
        name: updatedUser.name,
        surname: updatedUser.surname,
        email: updatedUser.email,
        phone: updatedUser.phone,
        department: updatedUser.department,
        role: updatedUser.role,
        status: updatedUser.status,
        permissions: updatedUser.permissions,
        hireDate: updatedUser.hireDate,
        lastLogin: updatedUser.lastLogin,
        memberSince: updatedUser.memberSince
      }
    });
  } catch (error) {
    console.error('Erreur mise à jour profil:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Un utilisateur avec cet email existe déjà' });
    }
    res.status(500).json({ message: 'Erreur serveur' });
  }
};