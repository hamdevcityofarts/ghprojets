// src/models/userModel.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  surname: { type: String, required: false, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String, required: false, trim: true },

  department: { 
    type: String, 
    enum: ['direction', 'reception', 'housekeeping', 'restaurant', 'maintenance', 'other'],
    required: false 
  },
  role: { 
    type: String, 
    enum: ['admin', 'manager', 'receptionist', 'housekeeper', 'supervisor', 'technician', 'client'],
    default: 'client' 
  },
  hireDate: { type: Date, required: false },

  // CORRECTION CRITIQUE: select: false pour forcer l'utilisation de +password
  password: { type: String, required: true, select: false },

  status: { 
    type: String, 
    enum: ['actif', 'inactif', 'en_conge', 'pending'],
    default: 'actif' 
  },

  permissions: [{
    type: String,
    enum: [
      'gestion_utilisateurs',
      'gestion_chambres', 
      'gestion_reservations',
      'gestion_clients',
      'acces_finances',
      'rapports',
      'parametres_systeme',
      'gestion_menage',
      'gestion_restaurant'
    ]
  }],

  lastLogin: { type: Date, required: false },
  memberSince: { type: Date, default: Date.now }

}, { timestamps: true });

// Hash password avant sauvegarde
userSchema.pre('save', async function (next) {
  // CORRECTION: Ne hasher que si le mot de passe est modifié
  if (!this.isModified('password')) {
    return next();
  }
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Méthode pour comparer les mots de passe
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Virtual pour nom complet
userSchema.virtual('fullName').get(function() {
  return `${this.name || ''} ${this.surname || ''}`.trim();
});

module.exports = mongoose.model('User', userSchema);