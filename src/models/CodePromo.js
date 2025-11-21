// models/CodePromo.js
const mongoose = require('mongoose');

const codePromoSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['percentage', 'fixed'],
    required: true
  },
  value: {
    type: Number,
    required: true,
    min: 0
  },
  chambres: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chambre'
  }],
  applicableToAll: {
    type: Boolean,
    default: false
  },
  dateDebut: {
    type: Date,
    required: true
  },
  dateFin: {
    type: Date,
    required: true
  },
  utilisationMax: {
    type: Number,
    default: 1
  },
  utilisationActuelle: {
    type: Number,
    default: 0
  },
  statut: {
    type: String,
    enum: ['actif', 'inactif', 'expire'],
    default: 'actif'
  },
  minimumStay: {
    type: Number,
    default: 1
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Index pour la recherche
codePromoSchema.index({ code: 1 });
codePromoSchema.index({ dateDebut: 1, dateFin: 1 });
codePromoSchema.index({ statut: 1 });

// Méthode pour vérifier la validité
codePromoSchema.methods.isValid = function() {
  const now = new Date();
  return this.statut === 'actif' && 
         this.dateDebut <= now && 
         this.dateFin >= now && 
         this.utilisationActuelle < this.utilisationMax;
};

// Méthode pour calculer le prix réduit
codePromoSchema.methods.calculateReducedPrice = function(originalPrice) {
  if (this.type === 'percentage') {
    const reduction = (originalPrice * this.value) / 100;
    return Math.max(0, originalPrice - reduction);
  } else {
    return Math.max(0, originalPrice - this.value);
  }
};

module.exports = mongoose.model('CodePromo', codePromoSchema);