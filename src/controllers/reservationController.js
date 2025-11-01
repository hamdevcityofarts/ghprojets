const Reservation = require('../models/reservationModel');
const Chambre = require('../models/chambreModel');
const User = require('../models/userModel');
const crypto = require('crypto');
const CybersourceSecure = require('../config/cybersourceSecureAcceptance');

// 🔹 Créer une réservation avec préparation pour Secure Acceptance
exports.createReservation = async (req, res) => {
  try {
    const { 
      chambreId, 
      checkIn, 
      checkOut, 
      guests, 
      adults, 
      children, 
      specialRequests, 
      paymentMethod,
      paymentOption, // ✅ NOUVEAU : Option de paiement
      nightsToPay    // ✅ NOUVEAU : Nuits à payer
    } = req.body;
    
    console.log('📥 Données reçues:', req.body);

    // Vérifier la chambre
    const chambre = await Chambre.findById(chambreId);
    if (!chambre) {
      return res.status(404).json({ 
        success: false,
        message: 'Chambre non trouvée' 
      });
    }

    // Vérifier disponibilité
    const existingReservation = await Reservation.findOne({
      chambre: chambreId,
      status: { $in: ['confirmed', 'pending_payment', 'partially_paid'] },
      $or: [
        { 
          checkIn: { $lt: new Date(checkOut) }, 
          checkOut: { $gt: new Date(checkIn) } 
        }
      ]
    });

    if (existingReservation) {
      return res.status(400).json({
        success: false,
        message: 'Chambre non disponible pour ces dates'
      });
    }

    // Calculer les nuits
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    const nights = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));
    
    // ✅ NOUVEAU : Calcul dynamique du montant selon l'option de paiement
    let totalAmount;
    let calculatedNightsToPay = nightsToPay || nights;
    
    switch (paymentOption) {
      case 'first-night':
        totalAmount = chambre.price; // Première nuit seulement
        calculatedNightsToPay = 1;
        break;
        
      case 'partial':
        // S'assurer que nightsToPay est valide
        const validNightsToPay = Math.min(nightsToPay || 1, nights);
        totalAmount = chambre.price * validNightsToPay;
        calculatedNightsToPay = validNightsToPay;
        break;
        
      case 'full':
      default:
        totalAmount = chambre.price * nights; // Totalité
        calculatedNightsToPay = nights;
        break;
    }

    const reservationData = {
      client: req.user._id,
      chambre: chambreId,
      checkIn: checkInDate,
      checkOut: checkOutDate,
      nights,
      guests: guests || (parseInt(adults || 1) + parseInt(children || 0)),
      adults: parseInt(adults || 1),
      children: parseInt(children || 0),
      specialRequests: specialRequests || '',
      totalAmount,
      currency: 'XAF',
      paymentMethod: paymentMethod || 'card',
      // ✅ NOUVEAUX CHAMPS
      paymentOption: paymentOption || 'full',
      nightsToPay: calculatedNightsToPay,
      amountPaid: totalAmount,
      status: 'pending_payment',
      source: 'website',
      paiement: {
        amount: totalAmount,
        currency: 'XAF',
        method: paymentMethod || 'card',
        status: 'pending',
        gateway: 'cybersource_secure_acceptance'
      }
    };

    console.log('📦 Données réservation:', reservationData);

    const reservation = await Reservation.create(reservationData);

    // Populer pour la réponse
    await reservation.populate('chambre client');

    // 🔹 PRÉPARER LES DONNÉES POUR SECURE ACCEPTANCE
    const paymentData = preparePaymentData(reservation, req.user);

    res.status(201).json({
      success: true,
      message: 'Réservation créée avec succès. Redirection vers le paiement.',
      reservation,
      payment: paymentData
    });

  } catch (error) {
    console.error('❌ Erreur création réservation:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création de la réservation',
      error: error.message
    });
  }
};

// 🔹 CRÉER UNE RÉSERVATION PUBLIQUE avec Secure Acceptance - MIS À JOUR
exports.createReservationPublic = async (req, res) => {
  try {
    const {
      chambreId,
      checkIn,
      checkOut,
      adults,
      children,
      guests,
      specialRequests,
      paymentMethod,
      clientInfo,
      paymentOption, // ✅ NOUVEAU : Option de paiement
      nightsToPay    // ✅ NOUVEAU : Nuits à payer
    } = req.body;

    console.log('🔹 Création réservation publique:', { 
      chambreId, 
      clientInfo,
      paymentOption,
      nightsToPay 
    });

    // Validation des données requises
    if (!chambreId || !checkIn || !checkOut || !clientInfo) {
      return res.status(400).json({
        success: false,
        message: 'Données manquantes: chambreId, checkIn, checkOut et clientInfo sont requis'
      });
    }

    if (!clientInfo.name || !clientInfo.surname || !clientInfo.email) {
      return res.status(400).json({
        success: false,
        message: 'Informations client incomplètes: nom, prénom et email sont requis'
      });
    }

    // Vérifier si la chambre existe
    const chambre = await Chambre.findById(chambreId);
    if (!chambre) {
      return res.status(404).json({
        success: false,
        message: 'Chambre non trouvée'
      });
    }

    // Vérifier la disponibilité
    const existingReservation = await Reservation.findOne({
      chambre: chambreId,
      $or: [
        {
          checkIn: { $lte: new Date(checkOut) },
          checkOut: { $gte: new Date(checkIn) }
        }
      ],
      status: { $in: ['pending_payment', 'confirmed', 'partially_paid'] }
    });

    if (existingReservation) {
      return res.status(400).json({
        success: false,
        message: 'Chambre non disponible pour ces dates'
      });
    }

    // Calculer les nuits
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    const calculatedNights = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));
    
    // ✅ NOUVEAU : Calcul dynamique du montant selon l'option de paiement
    let calculatedTotalAmount;
    let calculatedNightsToPay = nightsToPay || calculatedNights;
    
    switch (paymentOption) {
      case 'first-night':
        calculatedTotalAmount = chambre.price; // Première nuit seulement
        calculatedNightsToPay = 1;
        break;
        
      case 'partial':
        // S'assurer que nightsToPay est valide
        const validNightsToPay = Math.min(nightsToPay || 1, calculatedNights);
        calculatedTotalAmount = chambre.price * validNightsToPay;
        calculatedNightsToPay = validNightsToPay;
        break;
        
      case 'full':
      default:
        calculatedTotalAmount = chambre.price * calculatedNights; // Totalité
        calculatedNightsToPay = calculatedNights;
        break;
    }

    // Créer la réservation publique
    const reservationData = {
      chambre: chambreId,
      checkIn: checkInDate,
      checkOut: checkOutDate,
      adults: adults || 1,
      children: children || 0,
      guests: guests || (parseInt(adults || 1) + parseInt(children || 0)),
      specialRequests: specialRequests || '',
      totalAmount: calculatedTotalAmount,
      currency: 'XAF',
      nights: calculatedNights,
      // ✅ NOUVEAUX CHAMPS
      paymentOption: paymentOption || 'full',
      nightsToPay: calculatedNightsToPay,
      amountPaid: calculatedTotalAmount,
      status: 'pending_payment',
      paymentMethod: paymentMethod || 'card',
      clientInfo: clientInfo,
      source: 'public_website',
      paiement: {
        amount: calculatedTotalAmount,
        currency: 'XAF',
        method: paymentMethod || 'card',
        status: 'pending',
        gateway: 'cybersource_secure_acceptance'
      }
    };

    console.log('📦 Données réservation publique:', reservationData);

    const reservation = await Reservation.create(reservationData);
    await reservation.populate('chambre');

    console.log('✅ Réservation publique créée:', reservation._id);

    // ✅ UTILISER LE SERVICE CYBERSOURCE AU LIEU DE LA FONCTION LOCALE
    const paymentData = preparePaymentData(reservation, null, clientInfo);
    
    // Vérifier si CyberSource est configuré
    if (!CybersourceSecure.isConfigured()) {
      console.log('⚠️ Mode simulation - Clés CyberSource non configurées');
      
      const mockParams = CybersourceSecure.generateMockParams(paymentData);
      
      return res.status(201).json({
        success: true,
        message: 'Réservation créée - Mode simulation',
        reservation,
        payment: {
          mockMode: true,
          ...mockParams
        }
      });
    }

    // Générer les paramètres signés
    const paymentParams = CybersourceSecure.generatePaymentParams(paymentData);
    const paymentUrl = CybersourceSecure.getPaymentUrl();

    res.status(201).json({
      success: true,
      message: 'Réservation créée avec succès. Redirection vers le paiement.',
      reservation,
      payment: {
        form_action: paymentUrl,
        form_data: paymentParams
      }
    });

  } catch (error) {
    console.error('❌ Erreur création réservation publique:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création de la réservation',
      error: error.message
    });
  }
};

// ✅ FONCTION POUR PRÉPARER LES DONNÉES DE PAIEMENT
function preparePaymentData(reservation, user = null, clientInfo = null) {
  return {
    reservationId: reservation._id.toString(),
    amount: reservation.totalAmount,
    currency: 'XAF',
    clientFirstName: user ? user.name : clientInfo.name,
    clientLastName: user ? user.surname : clientInfo.surname,
    clientEmail: user ? user.email : clientInfo.email,
    clientPhone: user ? user.phone : clientInfo.phone || '',
    clientAddress: 'Hotel Address',
    clientCity: 'Douala',
    checkIn: new Date(reservation.checkIn).toISOString().split('T')[0],
    checkOut: new Date(reservation.checkOut).toISOString().split('T')[0],
    roomName: reservation.chambre?.name || 'Chambre',
    nights: reservation.nights || 1,
    // ✅ NOUVEAU : Informations sur l'option de paiement
    paymentOption: reservation.paymentOption,
    nightsToPay: reservation.nightsToPay
  };
}

// 🔹 CALLBACK POUR LE RETOUR DE CYBERSOURCE
exports.paymentCallback = async (req, res) => {
  try {
    const { req_reference_number, decision, reason_code, auth_amount, req_currency } = req.body;
    
    console.log('🔄 Callback CyberSource reçu:', {
      reference: req_reference_number,
      decision,
      reason_code,
      amount: auth_amount,
      currency: req_currency
    });

    // Extraire l'ID de réservation
    const reservationId = req_reference_number.replace('RES-', '');
    const reservation = await Reservation.findById(reservationId).populate('chambre');

    if (!reservation) {
      console.error('❌ Réservation non trouvée:', reservationId);
      return res.redirect(`${process.env.FRONTEND_URL}/payment/error?message=Réservation non trouvée`);
    }

    // Traiter la décision de paiement
    if (decision === 'ACCEPT') {
      // ✅ NOUVEAU : Déterminer le statut selon l'option de paiement
      let reservationStatus = 'confirmed';
      if (reservation.paymentOption !== 'full') {
        reservationStatus = 'partially_paid';
      }
      
      reservation.status = reservationStatus;
      reservation.paiement.status = 'paid';
      reservation.paiement.transaction_id = req.body.transaction_id;
      reservation.paiement.auth_code = req.body.auth_code;
      reservation.paiement.paidAt = new Date();
      
      await reservation.save();
      
      console.log('✅ Paiement confirmé pour réservation:', reservationId);
      console.log('💰 Option de paiement:', reservation.paymentOption);
      console.log('🌙 Nuits payées:', reservation.nightsToPay, '/', reservation.nights);
      
      return res.redirect(`${process.env.FRONTEND_URL}/payment/success?reservation=${reservationId}`);
    } else {
      reservation.status = 'payment_failed';
      reservation.paiement.status = 'failed';
      reservation.paiement.error_code = reason_code;
      reservation.paiement.error_message = req.body.message || 'Paiement refusé';
      
      await reservation.save();
      
      console.log('❌ Paiement échoué pour réservation:', reservationId);
      
      return res.redirect(`${process.env.FRONTEND_URL}/payment/error?reservation=${reservationId}&code=${reason_code}`);
    }

  } catch (error) {
    console.error('❌ Erreur callback paiement:', error);
    res.redirect(`${process.env.FRONTEND_URL}/payment/error?message=Erreur traitement paiement`);
  }
};

// 🔹 Récupérer toutes les réservations
exports.getReservations = async (req, res) => {
  try {
    let reservations;
    
    if (req.user.role === 'admin') {
      reservations = await Reservation.find()
        .populate('client', 'name surname email phone')
        .populate('chambre', 'number name type price currency');
    } else {
      reservations = await Reservation.find({ client: req.user._id })
        .populate('chambre', 'number name type price currency images');
    }

    res.json({
      success: true,
      count: reservations.length,
      reservations
    });

  } catch (error) {
    console.error('❌ Erreur récupération réservations:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des réservations',
      error: error.message
    });
  }
};

// 🔹 Récupérer une réservation par ID
exports.getReservationById = async (req, res) => {
  try {
    const reservation = await Reservation.findById(req.params.id)
      .populate('client', 'name surname email phone')
      .populate('chambre', 'number name type price currency images amenities');

    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: 'Réservation non trouvée'
      });
    }

    // Vérifier les permissions
    if (req.user.role !== 'admin' && reservation.client && !reservation.client._id.equals(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé à cette réservation'
      });
    }

    res.json({
      success: true,
      reservation
    });

  } catch (error) {
    console.error('❌ Erreur récupération réservation:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de la réservation',
      error: error.message
    });
  }
};

// 🔹 Mettre à jour une réservation
exports.updateReservation = async (req, res) => {
  try {
    const reservation = await Reservation.findById(req.params.id);
    
    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: 'Réservation non trouvée'
      });
    }

    // Vérifier les permissions
    if (req.user.role !== 'admin' && reservation.client && !reservation.client.equals(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé'
      });
    }

    const updatedReservation = await Reservation.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('client chambre');

    res.json({
      success: true,
      message: 'Réservation mise à jour avec succès',
      reservation: updatedReservation
    });

  } catch (error) {
    console.error('❌ Erreur mise à jour réservation:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour de la réservation',
      error: error.message
    });
  }
};

// 🔹 Annuler une réservation
exports.cancelReservation = async (req, res) => {
  try {
    const reservation = await Reservation.findById(req.params.id)
      .populate('client', 'email name')
      .populate('chambre');

    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: 'Réservation non trouvée'
      });
    }

    // Vérifier les permissions
    if (req.user.role !== 'admin' && reservation.client && !reservation.client._id.equals(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé'
      });
    }

    reservation.status = 'cancelled';
    if (reservation.paiement) {
      reservation.paiement.status = 'refunded';
    }
    
    await reservation.save();

    res.json({
      success: true,
      message: 'Réservation annulée avec succès'
    });

  } catch (error) {
    console.error('❌ Erreur annulation réservation:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'annulation de la réservation',
      error: error.message
    });
  }
};

// 🔹 Confirmer une réservation (admin)
exports.confirmReservation = async (req, res) => {
  try {
    const reservation = await Reservation.findById(req.params.id);

    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: 'Réservation non trouvée'
      });
    }

    reservation.status = 'confirmed';
    await reservation.save();

    res.json({
      success: true,
      message: 'Réservation confirmée avec succès',
      reservation
    });

  } catch (error) {
    console.error('❌ Erreur confirmation réservation:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la confirmation de la réservation',
      error: error.message
    });
  }
};