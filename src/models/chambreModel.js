const mongoose = require('mongoose');

const imageSchema = new mongoose.Schema({
  url: {
    type: String,
    required: true
  },
  cloudinaryId: {
    type: String,
    default: ''
  },
  alt: {
    type: String,
    default: ''
  },
  isPrimary: {
    type: Boolean,
    default: false
  },
  order: {
    type: Number,
    default: 0
  }
});

const chambreSchema = new mongoose.Schema({
  number: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    required: true,
    enum: ['standard', 'superior', 'deluxe', 'suite', 'family', 'executive', 'presidential']
  },
  category: {
    type: String,
    required: true,
    enum: ['single', 'double', 'twin', 'triple', 'quad', 'family']
  },
  capacity: {
    type: Number,
    required: true,
    min: 1,
    max: 10
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: 'XAF',
    enum: ['XAF']
  },
  size: {
    type: String,
    default: ''
  },
  bedType: {
    type: String,
    required: true,
    enum: ['single_bed', 'double_bed', 'twin_beds', 'double_twin', 'king_bed', 'queen_bed', 'sofa_bed', 'bunk_bed']
  },
  status: {
    type: String,
    required: true,
    enum: ['disponible', 'occupée', 'maintenance', 'nettoyage'],
    default: 'disponible'
  },
  description: {
    type: String,
    default: ''
  },
  amenities: [{
    type: String
  }],
  images: [imageSchema],
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  strict: true // 🔒 EMPÊCHE L'AJOUT DE CHAMPS NON DÉFINIS (discountedPrice, etc.)
});

// 🔒 MIDDLEWARE PRE-SAVE : GARANTIR QUE LE PRIX N'EST JAMAIS MODIFIÉ
chambreSchema.pre('save', function(next) {
  // Si le prix existe, on s'assure qu'il est positif
  if (this.price !== undefined && this.price < 0) {
    this.price = 0;
  }
  
  // ✅ Supprimer tout champ de réduction s'il existe (au cas où)
  if (this.discountedPrice !== undefined) {
    delete this.discountedPrice;
  }
  if (this.discountPercentage !== undefined) {
    delete this.discountPercentage;
  }
  if (this.hasDiscount !== undefined) {
    delete this.hasDiscount;
  }
  if (this.applyDiscount !== undefined) {
    delete this.applyDiscount;
  }
  if (this.originalPrice !== undefined) {
    delete this.originalPrice;
  }
  
  console.log('💾 [Modèle] Sauvegarde chambre avec prix exact:', this.price);
  next();
});

// 🔒 MIDDLEWARE PRE-UPDATE : GARANTIR QUE LE PRIX N'EST JAMAIS MODIFIÉ
chambreSchema.pre('findOneAndUpdate', function(next) {
  const update = this.getUpdate();
  
  // Supprimer les champs de réduction de l'update
  if (update.$set) {
    delete update.$set.discountedPrice;
    delete update.$set.discountPercentage;
    delete update.$set.hasDiscount;
    delete update.$set.applyDiscount;
    delete update.$set.originalPrice;
  }
  
  console.log('🔄 [Modèle] Mise à jour chambre sans réduction');
  next();
});

module.exports = mongoose.model('Chambre', chambreSchema);