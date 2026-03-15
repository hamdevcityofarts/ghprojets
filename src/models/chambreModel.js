const mongoose = require('mongoose');

const imageSchema = new mongoose.Schema({
  url: {
    type: String,
    required: true
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
  timestamps: true
});

module.exports = mongoose.model('Chambre', chambreSchema);