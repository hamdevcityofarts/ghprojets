const mongoose = require('mongoose');

// 🔹 Sous-schema Paiement (détail transaction) - COMPLET
const paiementSchema = new mongoose.Schema({
  amount: { type: Number, required: true },
  currency: { type: String, default: 'XAF' },
  paidAt: { type: Date, default: Date.now },
  method: { 
    type: String, 
    enum: ['card', 'cash', 'transfer', 'check'],
    default: 'card' 
  },
  status: { 
    type: String, 
    enum: ['pending', 'paid', 'failed', 'refunded'], 
    default: 'pending' 
  },
  transactionId: { type: String },
  auth_code: { type: String },
  error_code: { type: String },
  error_message: { type: String },
  gateway: { type: String, default: 'cybersource_secure_acceptance' }
});

// 🔹 Schema principal Réservation - MIS À JOUR AVEC CODES PROMO
const reservationSchema = new mongoose.Schema(
  {
    client: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User', 
      required: false
    },
    clientInfo: {
      name: { type: String, required: false },
      surname: { type: String, required: false },
      email: { type: String, required: false },
      phone: { type: String }
    },
    chambre: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'Chambre', 
      required: true 
    },
    checkIn: { type: Date, required: true },
    checkOut: { type: Date, required: true },
    nights: { type: Number, required: true },
    guests: { type: Number, required: true, default: 1 },
    adults: { type: Number, required: true, default: 1 },
    children: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true },
    currency: { type: String, default: 'XAF', enum: ['XAF'] },
    
    // ✅ NOUVEAUX CHAMPS : Options de paiement
    paymentOption: {
      type: String,
      enum: ['first-night', 'partial', 'full'],
      default: 'full'
    },
    nightsToPay: {
      type: Number,
      default: 0
    },
    amountPaid: {
      type: Number,
      default: 0
    },
    
    acompte: { type: Number, default: 0 },
    specialRequests: { type: String, default: '' },
    
    // ✅ STATUTS COMPLETS POUR CYBERSOURCE
    status: {
      type: String,
      enum: ['pending', 'pending_payment', 'confirmed', 'cancelled', 'completed', 'payment_failed', 'partially_paid'],
      default: 'pending'
    },
    
    paymentMethod: {
      type: String,
      enum: ['card', 'cash', 'transfer', 'check'],
      default: 'card'
    },
    paiement: paiementSchema,
    
    // ✅ SOURCE POUR TRACER L'ORIGINE
    source: {
      type: String,
      enum: ['website', 'public_website', 'admin'],
      default: 'website'
    },

    // ✅ NOUVEAUX CHAMPS : Codes promotionnels
    codePromo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CodePromo'
    },
    prixOriginal: {
      type: Number
    },
    reductionAppliquee: {
      type: Number,
      default: 0
    },
    codePromoUtilise: {
      type: String
    }
  },
  { 
    timestamps: true 
  }
);

// Index pour les recherches
reservationSchema.index({ chambre: 1, checkIn: 1, checkOut: 1 });
reservationSchema.index({ status: 1 });
reservationSchema.index({ client: 1 });
reservationSchema.index({ 'clientInfo.email': 1 });
reservationSchema.index({ codePromoUtilise: 1 }); // ✅ Nouvel index pour codes promo

// ✅ METHODE pour calculer les nuits automatiquement
reservationSchema.methods.calculateNights = function() {
  const checkIn = new Date(this.checkIn);
  const checkOut = new Date(this.checkOut);
  const diffTime = checkOut - checkIn;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 1;
};

// ✅ NOUVELLE METHODE : Calculer le montant selon l'option de paiement
reservationSchema.methods.calculateAmountToPay = function(chambrePrice) {
  const totalNights = this.nights;
  const pricePerNight = chambrePrice;
  
  switch (this.paymentOption) {
    case 'first-night':
      return pricePerNight; // Payer seulement la première nuit
      
    case 'partial':
      // Payer un nombre partiel de nuits (entre 1 et totalNights)
      const nightsToPay = Math.min(this.nightsToPay, totalNights);
      return pricePerNight * nightsToPay;
      
    case 'full':
    default:
      // Payer la totalité (comportement actuel)
      return pricePerNight * totalNights;
  }
};

// ✅ NOUVELLE METHODE : Obtenir le nombre de nuits à payer
reservationSchema.methods.getNightsToPay = function() {
  const totalNights = this.nights;
  
  switch (this.paymentOption) {
    case 'first-night':
      return 1;
      
    case 'partial':
      return Math.min(this.nightsToPay, totalNights);
      
    case 'full':
    default:
      return totalNights;
  }
};

// ✅ NOUVELLE METHODE : Appliquer une réduction de code promo
reservationSchema.methods.applyCodePromo = function(codePromoData, prixOriginal) {
  this.codePromo = codePromoData._id;
  this.codePromoUtilise = codePromoData.code;
  this.prixOriginal = prixOriginal;
  this.reductionAppliquee = prixOriginal - codePromoData.prixReduit;
  this.totalAmount = codePromoData.prixReduit;
  
  console.log('💰 Réduction appliquée:', {
    code: codePromoData.code,
    reduction: this.reductionAppliquee,
    prixFinal: this.totalAmount
  });
};

// ✅ MIDDLEWARE pour calcul automatique des nuits avant sauvegarde
reservationSchema.pre('save', function(next) {
  if (this.checkIn && this.checkOut) {
    this.nights = this.calculateNights();
  }
  next();
});

module.exports = mongoose.model('Reservation', reservationSchema);