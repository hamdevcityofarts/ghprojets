const Reservation = require('../models/reservationModel');
const Chambre = require('../models/chambreModel');
const User = require('../models/userModel');
const CodePromo = require('../models/CodePromo');
const crypto = require('crypto');
// Assurez-vous que le chemin et l'exportation sont corrects
const CybersourceSecure = require('../config/cybersourceSecureAcceptance'); 

// -----------------------------------------------------------
// 📚 Fonctions Utilitaires
// -----------------------------------------------------------

/**
 * Prépare les données de paiement nécessaires pour Secure Acceptance.
 * @param {object} reservation - L'objet réservation MongoDB.
 * @param {object | null} user - L'objet utilisateur connecté (si authentifié).
 * @param {object | null} clientInfo - Les informations client si réservation publique (non authentifiée).
 * @returns {object} Les données de paiement formatées.
 */
function preparePaymentData(reservation, user = null, clientInfo = null) {
  // Déterminer la source des informations client
  const source = user || clientInfo || {};

  // ✅ DONNÉES DE BASE
  const basePaymentData = {
    reservationId: reservation._id.toString(),
    amount: reservation.totalAmount,
    currency: 'XAF',
    clientFirstName: source.name,
    clientLastName: source.surname,
    clientEmail: source.email,
    clientPhone: source.phone || '',
    clientAddress: 'Hotel Address',
    clientCity: 'Douala',
    checkIn: new Date(reservation.checkIn).toISOString().split('T')[0],
    checkOut: new Date(reservation.checkOut).toISOString().split('T')[0],
    roomName: reservation.chambre?.name || 'Chambre',
    nights: reservation.nights || 1,
    paymentOption: reservation.paymentOption,
    nightsToPay: reservation.nightsToPay,
    codePromo: reservation.codePromoUtilise,
    reduction: reservation.reductionAppliquee || 0
  };

  // ✅ TENTATIVE DE GÉNÉRATION CYBERSOURCE - AMÉLIORÉE
  try {
    console.log('🔹 Tentative de génération CyberSource...');
    
    // Vérifier si CybersourceSecure est disponible
    if (CybersourceSecure && typeof CybersourceSecure.generatePaymentForm === 'function') {
      console.log('✅ Méthode generatePaymentForm disponible');
      
      const cyberSourceData = CybersourceSecure.generatePaymentForm(basePaymentData);
      
      console.log('🔍 Résultat génération CyberSource:', {
        hasFormData: !!cyberSourceData.form_data,
        hasFormAction: !!cyberSourceData.form_action,
        hasCyberSource: cyberSourceData.hasCyberSource,
        mockMode: cyberSourceData.mockMode || false
      });
      
      if (cyberSourceData.form_data && cyberSourceData.form_action && cyberSourceData.hasCyberSource) {
        console.log('✅ Données CyberSource générées avec succès');
        return {
          ...basePaymentData,
          form_data: cyberSourceData.form_data,
          form_action: cyberSourceData.form_action,
          hasCyberSource: true
        };
      } else {
        console.log('⚠️ Données CyberSource incomplètes, utilisation du fallback');
        console.log('  Raison:', cyberSourceData.mockMode ? 'Mode simulation' : 'Données manquantes');
      }
    } else {
      console.log('❌ Méthode generatePaymentForm non disponible dans CybersourceSecure');
    }
    
    // ✅ FALLBACK - Retourner les données basiques sans CyberSource
    console.log('🔄 Utilisation du fallback de paiement local');
    return {
      ...basePaymentData,
      hasCyberSource: false,
      fallbackReason: 'CyberSource non configuré ou données incomplètes'
    };
    
  } catch (error) {
    console.error('❌ Erreur génération CyberSource:', error);
    // ✅ FALLBACK EN CAS D'ERREUR
    return {
      ...basePaymentData,
      hasCyberSource: false,
      fallbackReason: `Erreur: ${error.message}`
    };
  }
}

// -----------------------------------------------------------
// 👤 Fonctions de Réservation Authentifiées (require auth middleware)
// -----------------------------------------------------------

/**
 * 🔹 Créer une réservation (pour utilisateur connecté) avec préparation pour Secure Acceptance.
 */
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
      paymentOption,
      nightsToPay,
      codePromo
    } = req.body;

    console.log('📥 Données reçues (Auth):', req.body);
    console.log('👤 Utilisateur connecté:', req.user._id);

    const chambre = await Chambre.findById(chambreId);
    if (!chambre) {
      return res.status(404).json({ success: false, message: 'Chambre non trouvée' });
    }

    // --- Vérification de Disponibilité & Calcul des Nuits (Fonctionnalité complète) ---
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    const nights = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));

    const existingReservation = await Reservation.findOne({
      chambre: chambreId,
      status: { $in: ['confirmed', 'pending_payment', 'partially_paid'] },
      $or: [{
        checkIn: { $lt: checkOutDate },
        checkOut: { $gt: checkInDate }
      }]
    });

    if (existingReservation) {
      return res.status(400).json({
        success: false,
        message: 'Chambre non disponible pour ces dates'
      });
    }

    // --- Calcul dynamique du montant selon l'option de paiement ---
    let totalAmount, calculatedNightsToPay;

    switch (paymentOption) {
      case 'first-night':
        totalAmount = chambre.price;
        calculatedNightsToPay = 1;
        break;
      case 'partial':
        const validNightsToPay = Math.min(nightsToPay || 1, nights);
        totalAmount = chambre.price * validNightsToPay;
        calculatedNightsToPay = validNightsToPay;
        break;
      case 'full':
      default:
        totalAmount = chambre.price * nights;
        calculatedNightsToPay = nights;
        break;
    }

    // --- Gestion du code promo ---
    let prixFinal = totalAmount;
    let codePromoApplique = null;
    let reduction = 0;
    let prixOriginal = totalAmount;

    if (codePromo) {
      try {
        const codePromoVerifie = await CodePromo.findOne({
          code: codePromo.toUpperCase(),
          statut: 'actif'
        });

        if (codePromoVerifie && codePromoVerifie.isValid()) {
          if (codePromoVerifie.applicableToAll || codePromoVerifie.chambres.includes(chambreId)) {
            if (nights >= codePromoVerifie.minimumStay) {
              // Assurez-vous que calculateReducedPrice est défini sur le modèle CodePromo
              prixFinal = codePromoVerifie.calculateReducedPrice(totalAmount);
              reduction = totalAmount - prixFinal;
              codePromoApplique = codePromoVerifie._id;

              codePromoVerifie.utilisationActuelle += 1;
              await codePromoVerifie.save();
              console.log('✅ Code promo appliqué:', codePromo);
            }
          }
        }
      } catch (error) {
        console.warn('⚠️ Erreur vérification code promo:', error);
      }
    }

    // --- Création des données de réservation ---
    const reservationData = {
      client: req.user._id, // Utilisateur connecté
      chambre: chambreId,
      checkIn: checkInDate,
      checkOut: checkOutDate,
      nights,
      guests: guests || (parseInt(adults || 1) + parseInt(children || 0)),
      adults: parseInt(adults || 1),
      children: parseInt(children || 0),
      specialRequests: specialRequests || '',
      totalAmount: prixFinal,
      currency: 'XAF',
      paymentMethod: paymentMethod || 'card',
      paymentOption: paymentOption || 'full',
      nightsToPay: calculatedNightsToPay,
      amountPaid: prixFinal,
      status: 'pending_payment',
      source: 'website',
      codePromo: codePromoApplique,
      prixOriginal: prixOriginal,
      reductionAppliquee: reduction,
      codePromoUtilise: codePromo,
      paiement: {
        amount: prixFinal,
        currency: 'XAF',
        method: paymentMethod || 'card',
        status: 'pending',
        gateway: 'cybersource_secure_acceptance'
      }
    };

    const reservation = await Reservation.create(reservationData);
    await reservation.populate('chambre client');

    // Préparer les données pour Secure Acceptance
    const paymentData = preparePaymentData(reservation, req.user);
    
    console.log('🔹 Données paiement préparées:', {
      hasCyberSource: paymentData.hasCyberSource,
      form_data_present: !!paymentData.form_data,
      form_action_present: !!paymentData.form_action,
      fallbackReason: paymentData.fallbackReason || 'Aucun'
    });

    // ✅ MESSAGE ADAPTATIF SELON LA DISPONIBILITÉ CYBERSOURCE
    let message = '';
    if (paymentData.hasCyberSource) {
      message = 'Réservation créée avec succès. Redirection vers le paiement sécurisé.';
    } else {
      message = 'Réservation créée avec succès. Paiement à confirmer.';
      console.log('ℹ️  Fallback activé:', paymentData.fallbackReason);
    }

    res.status(201).json({
      success: true,
      message: message,
      reservation,
      payment: paymentData,
      reduction: reduction > 0 ? { appliquee: true, montant: reduction, code: codePromo } : { appliquee: false }
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

// -----------------------------------------------------------
// 🌍 Nouvelle Fonction de Réservation Publique (Public/Guest) - CORRIGÉE
// -----------------------------------------------------------

/**
 * 🔹 Créer une réservation publique (sans authentification, clientInfo dans le body).
 */
exports.createReservationPublic = async (req, res) => {
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
      paymentOption,
      nightsToPay,
      codePromo,
      clientInfo // Informations client pour les invités
    } = req.body;

    // --- Vérification ClientInfo (Nécessaire pour les réservations publiques) ---
    if (!clientInfo || !clientInfo.email || !clientInfo.name || !clientInfo.surname) {
      return res.status(400).json({ success: false, message: 'Informations client (name, surname, email) requises pour la réservation publique.' });
    }

    console.log('📥 Données reçues (Public):', req.body);
    console.log('👤 Client Invité:', clientInfo.email);

    const chambre = await Chambre.findById(chambreId);
    if (!chambre) {
      return res.status(404).json({ success: false, message: 'Chambre non trouvée' });
    }

    // --- Vérification de Disponibilité & Calcul des Nuits (Identique à la fonction auth) ---
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    const nights = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));

    const existingReservation = await Reservation.findOne({
      chambre: chambreId,
      status: { $in: ['confirmed', 'pending_payment', 'partially_paid'] },
      $or: [{
        checkIn: { $lt: checkOutDate },
        checkOut: { $gt: checkInDate }
      }]
    });

    if (existingReservation) {
      return res.status(400).json({
        success: false,
        message: 'Chambre non disponible pour ces dates'
      });
    }

    // --- Calcul dynamique du montant (Identique à la fonction auth) ---
    let totalAmount, calculatedNightsToPay;
    
    switch (paymentOption) {
      case 'first-night':
        totalAmount = chambre.price;
        calculatedNightsToPay = 1;
        break;
      case 'partial':
        const validNightsToPay = Math.min(nightsToPay || 1, nights);
        totalAmount = chambre.price * validNightsToPay;
        calculatedNightsToPay = validNightsToPay;
        break;
      case 'full':
      default:
        totalAmount = chambre.price * nights;
        calculatedNightsToPay = nights;
        break;
    }

    // --- Gestion du code promo (Identique à la fonction auth) ---
    let prixFinal = totalAmount;
    let codePromoApplique = null;
    let reduction = 0;
    let prixOriginal = totalAmount;

    if (codePromo) {
      try {
        const codePromoVerifie = await CodePromo.findOne({
          code: codePromo.toUpperCase(),
          statut: 'actif'
        });

        if (codePromoVerifie && codePromoVerifie.isValid()) {
          if (codePromoVerifie.applicableToAll || codePromoVerifie.chambres.includes(chambreId)) {
            if (nights >= codePromoVerifie.minimumStay) {
              prixFinal = codePromoVerifie.calculateReducedPrice(totalAmount);
              reduction = totalAmount - prixFinal;
              codePromoApplique = codePromoVerifie._id;

              codePromoVerifie.utilisationActuelle += 1;
              await codePromoVerifie.save();
              console.log('✅ Code promo appliqué (Public):', codePromo);
            }
          }
        }
      } catch (error) {
        console.warn('⚠️ Erreur vérification code promo (Public):', error);
      }
    }
    
    // --- CORRECTION CRITIQUE : Gestion du Client avec rôle VALIDE ---
    let guestUser = await User.findOne({ email: clientInfo.email.toLowerCase() });
    
    if (!guestUser) {
      // CORRECTION : Utiliser 'client' au lieu de 'guest' qui n'est pas dans l'enum
      guestUser = await User.create({
        name: clientInfo.name.trim(),
        surname: clientInfo.surname.trim(),
        email: clientInfo.email.toLowerCase().trim(),
        phone: clientInfo.phone || '',
        password: crypto.randomBytes(10).toString('hex'), // Mot de passe aléatoire
        role: 'client', // ✅ CORRECTION : Utiliser 'client' au lieu de 'guest'
        isTemporary: true // Champ optionnel pour identifier les comptes temporaires
      });
      console.log('👤 Compte client temporaire créé:', guestUser._id, 'avec rôle:', guestUser.role);
    } else {
      console.log('👤 Client existant réutilisé:', guestUser._id, 'avec rôle:', guestUser.role);
    }

    // --- Création des données de réservation ---
    const reservationData = {
      client: guestUser._id, // Utiliser l'ID du compte client temporaire
      chambre: chambreId,
      checkIn: checkInDate,
      checkOut: checkOutDate,
      nights,
      guests: guests || (parseInt(adults || 1) + parseInt(children || 0)),
      adults: parseInt(adults || 1),
      children: parseInt(children || 0),
      specialRequests: specialRequests || '',
      totalAmount: prixFinal,
      currency: 'XAF',
      paymentMethod: paymentMethod || 'card',
      paymentOption: paymentOption || 'full',
      nightsToPay: calculatedNightsToPay,
      amountPaid: prixFinal,
      status: 'pending_payment',
      source: 'public_website', // Source spécifique
      codePromo: codePromoApplique,
      prixOriginal: prixOriginal,
      reductionAppliquee: reduction,
      codePromoUtilise: codePromo,
      paiement: {
        amount: prixFinal,
        currency: 'XAF',
        method: paymentMethod || 'card',
        status: 'pending',
        gateway: 'cybersource_secure_acceptance'
      }
    };

    const reservation = await Reservation.create(reservationData);
    await reservation.populate('chambre client');

    // Préparer les données pour Secure Acceptance (utiliser clientInfo)
    const paymentData = preparePaymentData(reservation, null, clientInfo);
    
    console.log('🔹 Données paiement préparées (Public):', {
      hasCyberSource: paymentData.hasCyberSource,
      form_data_present: !!paymentData.form_data,
      form_action_present: !!paymentData.form_action,
      fallbackReason: paymentData.fallbackReason || 'Aucun'
    });

    // ✅ MESSAGE ADAPTATIF SELON LA DISPONIBILITÉ CYBERSOURCE
    let message = '';
    if (paymentData.hasCyberSource) {
      message = 'Réservation publique créée avec succès. Redirection vers le paiement sécurisé.';
    } else {
      message = 'Réservation publique créée avec succès. Paiement à confirmer.';
      console.log('ℹ️  Fallback activé (Public):', paymentData.fallbackReason);
    }

    res.status(201).json({
      success: true,
      message: message,
      reservation,
      payment: paymentData,
      reduction: reduction > 0 ? { appliquee: true, montant: reduction, code: codePromo } : { appliquee: false }
    });

  } catch (error) {
    console.error('❌ Erreur création réservation publique:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création de la réservation publique',
      error: error.message
    });
  }
};

// -----------------------------------------------------------
// 💳 Gestion des Paiements
// -----------------------------------------------------------

/**
 * 🔹 CALLBACK POUR LE RETOUR DE CYBERSOURCE
 */
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
    const reservation = await Reservation.findById(reservationId)
      .populate('chambre')
      .populate('client'); 

    if (!reservation) {
      console.error('❌ Réservation non trouvée:', reservationId);
      return res.redirect(`${process.env.FRONTEND_URL}/payment/error?message=Réservation non trouvée`);
    }

    // Traiter la décision de paiement
    if (decision === 'ACCEPT') {
      // Déterminer le statut selon l'option de paiement
      let reservationStatus = (reservation.paymentOption === 'full') ? 'confirmed' : 'partially_paid';

      reservation.status = reservationStatus;
      reservation.paiement.status = 'paid';
      reservation.paiement.transaction_id = req.body.transaction_id;
      reservation.paiement.auth_code = req.body.auth_code;
      reservation.paiement.paidAt = new Date();

      await reservation.save();

      console.log('✅ Paiement confirmé pour réservation:', reservationId);

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

// -----------------------------------------------------------
// 🔍 Fonctions de Lecture (Lecture)
// -----------------------------------------------------------

/**
 * 🔹 Récupérer toutes les réservations (Admin ou Utilisateur personnel).
 */
exports.getReservations = async (req, res) => {
  try {
    let reservations;

    if (req.user.role === 'admin') {
      // ADMIN: Voir toutes les réservations avec infos client complètes
      reservations = await Reservation.find()
        .populate('client', 'name surname email phone')
        .populate('chambre', 'number name type price currency')
        .populate('codePromo', 'code description');
    } else {
      // UTILISATEUR: Voir uniquement SES réservations
      reservations = await Reservation.find({
          client: req.user._id
        })
        .populate('chambre', 'number name type price currency images')
        .populate('codePromo', 'code description');
    }

    console.log(`📊 ${reservations.length} réservation(s) récupérée(s) pour l'utilisateur:`, req.user._id);

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

/**
 * 🔹 Récupérer une réservation par ID (vérification des permissions Admin/Propriétaire).
 */
exports.getReservationById = async (req, res) => {
  try {
    const reservation = await Reservation.findById(req.params.id)
      .populate('client', 'name surname email phone')
      .populate('chambre', 'number name type price currency images amenities')
      .populate('codePromo', 'code description type value');

    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: 'Réservation non trouvée'
      });
    }

    // Vérifier les permissions: admin OU propriétaire de la réservation
    const isAdmin = req.user.role === 'admin';
    const isOwner = reservation.client && reservation.client._id.equals(req.user._id);

    if (!isAdmin && !isOwner) {
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

/**
 * 🔹 Récupérer les réservations d'un utilisateur spécifique (Admin ou l'utilisateur lui-même).
 */
exports.getUserReservations = async (req, res) => {
  try {
    const userId = req.params.userId;
    
    // Vérification des permissions: admin OU l'utilisateur dont on veut voir les réservations
    if (req.user.role !== 'admin' && !req.user._id.equals(userId)) {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé à ces réservations.'
      });
    }

    const reservations = await Reservation.find({
        client: userId
      })
      .populate('chambre', 'number name type price currency images')
      .populate('codePromo', 'code description')
      .sort({
        createdAt: -1
      });

    res.json({
      success: true,
      count: reservations.length,
      reservations
    });

  } catch (error) {
    console.error('❌ Erreur récupération réservations utilisateur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des réservations',
      error: error.message
    });
  }
};

// -----------------------------------------------------------
// ✏️ Fonctions de Modification (Admin/Propriétaire)
// -----------------------------------------------------------

/**
 * 🔹 Mettre à jour une réservation (Admin ou Proprio).
 */
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
      req.body, {
        new: true,
        runValidators: true
      }
    ).populate('client chambre codePromo');

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

/**
 * 🔹 Annuler une réservation (Admin ou Proprio).
 */
exports.cancelReservation = async (req, res) => {
  try {
    const reservation = await Reservation.findById(req.params.id)
      .populate('client', 'email name')
      .populate('chambre')
      .populate('codePromo');

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
      reservation.paiement.status = 'refunded'; // Simuler un remboursement
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

/**
 * 🔹 Confirmer une réservation (Admin uniquement).
 */
exports.confirmReservation = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Accès non autorisé. Admin requis.' });
    }
    
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

// -----------------------------------------------------------
// 🗑️ Fonctions Administratives
// -----------------------------------------------------------

/**
 * ✅ Supprimer définitivement une réservation (Admin uniquement, avec protection de statut).
 */
exports.deleteReservation = async (req, res) => {
  try {
    const reservation = await Reservation.findById(req.params.id);

    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: 'Réservation non trouvée'
      });
    }

    // Vérifier les permissions (admin uniquement)
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé. Droits administrateur requis pour supprimer une réservation.'
      });
    }

    // Vérifier si la réservation peut être supprimée (protection contre la suppression de réservations actives)
    const protectedStatuses = ['confirmed', 'completed', 'partially_paid'];
    if (protectedStatuses.includes(reservation.status)) {
      return res.status(400).json({
        success: false,
        message: `Impossible de supprimer une réservation avec le statut "${reservation.status}". Vous pouvez seulement l'annuler.`
      });
    }

    // Supprimer la réservation
    await Reservation.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Réservation supprimée définitivement avec succès'
    });

  } catch (error) {
    console.error('❌ Erreur suppression réservation:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression de la réservation',
      error: error.message
    });
  }
};

/**
 * ✅ Statistiques des codes promo utilisés (Admin uniquement).
 */
exports.getPromoCodeStats = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé. Droits administrateur requis.'
      });
    }

    const stats = await Reservation.aggregate([
      {
        $match: {
          codePromoUtilise: { $exists: true, $ne: null }
        }
      },
      {
        $group: {
          _id: '$codePromoUtilise',
          count: {
            $sum: 1
          },
          totalReduction: {
            $sum: '$reductionAppliquee'
          },
          totalRevenue: {
            $sum: '$totalAmount'
          }
        }
      },
      {
        $sort: {
          count: -1
        }
      }
    ]);

    res.json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('❌ Erreur statistiques codes promo:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des statistiques',
      error: error.message
    });
  }
};


// -----------------------------------------------------------
// 🧾 FONCTIONS DE REÇU
// -----------------------------------------------------------

/**
 * 🔹 Générer un reçu HTML pour une réservation
 */
exports.generateReceipt = async (req, res) => {
  try {
    const reservation = await Reservation.findById(req.params.id)
      .populate('client', 'name surname email phone')
      .populate('chambre', 'number name type price amenities')
      .populate('codePromo', 'code description value type');

    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: 'Réservation non trouvée'
      });
    }

    // Vérifier les permissions
    const isAdmin = req.user.role === 'admin';
    const isOwner = reservation.client && reservation.client._id.equals(req.user._id);

    if (!isAdmin && !isOwner) {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé à ce reçu'
      });
    }

    // Formater les dates
    const formatDate = (date) => {
      return new Date(date).toLocaleDateString('fr-FR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    };

    const formatDateTime = (date) => {
      return new Date(date).toLocaleString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    };

    // Formater le prix
    const formatPrice = (price) => {
      return new Intl.NumberFormat('fr-FR').format(price) + ' FCFA';
    };

    // Déterminer le statut en français
    const getStatusLabel = (status) => {
      const statusMap = {
        'confirmed': 'Confirmée',
        'pending_payment': 'En attente de paiement',
        'partially_paid': 'Partiellement payée',
        'cancelled': 'Annulée',
        'completed': 'Terminée',
        'payment_failed': 'Paiement échoué',
        'pending': 'En attente'
      };
      return statusMap[status] || status;
    };

    // Déterminer l'option de paiement en français
    const getPaymentOptionLabel = (option) => {
      const optionsMap = {
        'first-night': 'Première nuit',
        'partial': 'Paiement partiel',
        'full': 'Paiement complet'
      };
      return optionsMap[option] || option;
    };

    // Créer le contenu HTML du reçu
    const receiptHtml = `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reçu Réservation ${reservation._id}</title>
        <style>
          /* Styles optimisés pour impression */
          @media print {
            body { margin: 0; padding: 20px; }
            .no-print { display: none !important; }
            .page-break { page-break-before: always; }
          }
          
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f9f9f9;
          }
          
          .receipt-container {
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            padding: 30px;
            position: relative;
          }
          
          .header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid #3498db;
          }
          
          .hotel-name {
            color: #2c3e50;
            font-size: 28px;
            font-weight: bold;
            margin-bottom: 5px;
          }
          
          .hotel-subtitle {
            color: #7f8c8d;
            font-size: 14px;
            margin-bottom: 10px;
          }
          
          .receipt-title {
            color: #3498db;
            font-size: 20px;
            font-weight: bold;
            margin: 15px 0;
          }
          
          .section {
            margin: 25px 0;
          }
          
          .section-title {
            color: #2c3e50;
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 15px;
            padding-bottom: 8px;
            border-bottom: 1px solid #ecf0f1;
          }
          
          .info-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin: 15px 0;
          }
          
          .info-item {
            margin-bottom: 12px;
          }
          
          .info-label {
            color: #7f8c8d;
            font-size: 13px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 4px;
          }
          
          .info-value {
            color: #2c3e50;
            font-size: 15px;
            font-weight: 500;
          }
          
          .status-badge {
            display: inline-block;
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
            text-transform: uppercase;
          }
          
          .status-confirmed { background: #d4edda; color: #155724; }
          .status-pending { background: #fff3cd; color: #856404; }
          .status-cancelled { background: #f8d7da; color: #721c24; }
          
          .price-table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
          }
          
          .price-table th {
            background: #f8f9fa;
            padding: 12px 15px;
            text-align: left;
            font-weight: 600;
            color: #495057;
            border-bottom: 2px solid #dee2e6;
          }
          
          .price-table td {
            padding: 12px 15px;
            border-bottom: 1px solid #dee2e6;
          }
          
          .price-table tr.total-row {
            background: #f8f9fa;
            font-weight: bold;
          }
          
          .price-table .amount {
            text-align: right;
            font-family: 'Courier New', monospace;
          }
          
          .total-section {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 6px;
            margin: 30px 0;
            border-left: 4px solid #28a745;
          }
          
          .total-amount {
            font-size: 24px;
            font-weight: bold;
            color: #28a745;
            text-align: right;
          }
          
          .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #ecf0f1;
            font-size: 12px;
            color: #95a5a6;
            text-align: center;
          }
          
          .contact-info {
            margin-top: 10px;
            font-size: 11px;
          }
          
          .reference {
            font-family: 'Courier New', monospace;
            background: #f8f9fa;
            padding: 5px 10px;
            border-radius: 4px;
            font-size: 13px;
            display: inline-block;
          }
          
          .print-btn {
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 10px 20px;
            background: #3498db;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-weight: bold;
            z-index: 1000;
          }
          
          .print-btn:hover {
            background: #2980b9;
          }
          
          .watermark {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-45deg);
            font-size: 100px;
            color: rgba(0,0,0,0.05);
            font-weight: bold;
            pointer-events: none;
            user-select: none;
            z-index: -1;
          }
        </style>
      </head>
      <body>
        <button class="print-btn no-print" onclick="window.print()">🖨️ Imprimer le reçu</button>
        
        <div class="receipt-container">
          <div class="watermark">HOTEL NOGA</div>
          
          <div class="header">
            <div class="hotel-name">HOTEL NOGA</div>
            <div class="hotel-subtitle">Douala, Cameroun • contact@hotelnoga.com • +237 XXX XXX XXX</div>
            <div class="receipt-title">REÇU DE RÉSERVATION</div>
            <div>Émis le ${formatDateTime(new Date())}</div>
            <div class="reference">Référence: ${reservation._id}</div>
          </div>
          
          <!-- Informations client -->
          <div class="section">
            <div class="section-title">Informations client</div>
            <div class="info-grid">
              <div class="info-item">
                <div class="info-label">Nom complet</div>
                <div class="info-value">${reservation.client?.name || reservation.clientInfo?.name} ${reservation.client?.surname || reservation.clientInfo?.surname}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Email</div>
                <div class="info-value">${reservation.client?.email || reservation.clientInfo?.email}</div>
              </div>
              ${reservation.client?.phone || reservation.clientInfo?.phone ? `
              <div class="info-item">
                <div class="info-label">Téléphone</div>
                <div class="info-value">${reservation.client?.phone || reservation.clientInfo?.phone}</div>
              </div>
              ` : ''}
              <div class="info-item">
                <div class="info-label">Statut de la réservation</div>
                <div class="info-value">
                  <span class="status-badge status-${reservation.status}">${getStatusLabel(reservation.status)}</span>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Détails du séjour -->
          <div class="section">
            <div class="section-title">Détails du séjour</div>
            <div class="info-grid">
              <div class="info-item">
                <div class="info-label">Chambre</div>
                <div class="info-value">${reservation.chambre?.name || 'Chambre'} (${reservation.chambre?.type || 'Standard'})</div>
              </div>
              <div class="info-item">
                <div class="info-label">Date d'arrivée</div>
                <div class="info-value">${formatDate(reservation.checkIn)} • À partir de 14h00</div>
              </div>
              <div class="info-item">
                <div class="info-label">Date de départ</div>
                <div class="info-value">${formatDate(reservation.checkOut)} • Avant 12h00</div>
              </div>
              <div class="info-item">
                <div class="info-label">Durée du séjour</div>
                <div class="info-value">${reservation.nights} nuit(s)</div>
              </div>
              <div class="info-item">
                <div class="info-label">Nombre de personnes</div>
                <div class="info-value">${reservation.guests} personne(s) (${reservation.adults} adulte(s), ${reservation.children} enfant(s))</div>
              </div>
              <div class="info-item">
                <div class="info-label">Option de paiement</div>
                <div class="info-value">${getPaymentOptionLabel(reservation.paymentOption)}</div>
              </div>
            </div>
            
            ${reservation.specialRequests ? `
            <div class="info-item" style="margin-top: 15px;">
              <div class="info-label">Demandes spéciales</div>
              <div class="info-value" style="font-style: italic;">"${reservation.specialRequests}"</div>
            </div>
            ` : ''}
          </div>
          
          <!-- Détails financiers -->
          <div class="section">
            <div class="section-title">Détails financiers</div>
            
            <table class="price-table">
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Quantité</th>
                  <th>Prix unitaire</th>
                  <th class="amount">Total</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Séjour - ${reservation.nights} nuit(s)</td>
                  <td>${reservation.nights}</td>
                  <td>${formatPrice(reservation.chambre?.price || (reservation.totalAmount / reservation.nights))}</td>
                  <td class="amount">${formatPrice(reservation.nights * (reservation.chambre?.price || (reservation.totalAmount / reservation.nights)))}</td>
                </tr>
                
                ${reservation.codePromoUtilise && reservation.reductionAppliquee > 0 ? `
                <tr style="color: #28a745;">
                  <td colspan="3">Réduction - Code promo: <strong>${reservation.codePromoUtilise}</strong></td>
                  <td class="amount">-${formatPrice(reservation.reductionAppliquee)}</td>
                </tr>
                ` : ''}
                
                <tr class="total-row">
                  <td colspan="3"><strong>TOTAL À PAYER</strong></td>
                  <td class="amount"><strong>${formatPrice(reservation.totalAmount)}</strong></td>
                </tr>
              </tbody>
            </table>
            
            ${reservation.paiement?.paidAt ? `
            <div class="info-item" style="margin-top: 15px;">
              <div class="info-label">Date du paiement</div>
              <div class="info-value">${formatDateTime(reservation.paiement.paidAt)}</div>
            </div>
            ` : ''}
            
            ${reservation.paiement?.transactionId ? `
            <div class="info-item">
              <div class="info-label">Référence de transaction</div>
              <div class="info-value reference">${reservation.paiement.transactionId}</div>
            </div>
            ` : ''}
          </div>
          
          <!-- Section total -->
          <div class="total-section">
            <div class="total-amount">TOTAL: ${formatPrice(reservation.totalAmount)}</div>
            <div style="text-align: right; color: #6c757d; font-size: 14px; margin-top: 10px;">
              Taxes et frais de service inclus
            </div>
          </div>
          
          <!-- Informations de paiement -->
          <div class="section">
            <div class="section-title">Informations de paiement</div>
            <div class="info-grid">
              <div class="info-item">
                <div class="info-label">Méthode de paiement</div>
                <div class="info-value">${reservation.paymentMethod === 'card' ? 'Carte bancaire' : 
                  reservation.paymentMethod === 'cash' ? 'Espèces' : 
                  reservation.paymentMethod === 'transfer' ? 'Virement' : 
                  reservation.paymentMethod === 'check' ? 'Chèque' : 'Non spécifiée'}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Statut du paiement</div>
                <div class="info-value">
                  ${reservation.paiement?.status === 'paid' ? '✅ Payé' : 
                    reservation.paiement?.status === 'pending' ? '⏳ En attente' : 
                    reservation.paiement?.status === 'failed' ? '❌ Échoué' : 
                    reservation.paiement?.status === 'refunded' ? '↩️ Remboursé' : 'Non spécifié'}
                </div>
              </div>
              <div class="info-item">
                <div class="info-label">Source de la réservation</div>
                <div class="info-value">${reservation.source === 'website' ? 'Site web (utilisateur connecté)' : 
                  reservation.source === 'public_website' ? 'Site web (public)' : 
                  reservation.source === 'admin' ? 'Administration' : 'Non spécifiée'}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Date de création</div>
                <div class="info-value">${reservation.createdAt ? formatDateTime(reservation.createdAt) : 'Non disponible'}</div>
              </div>
            </div>
          </div>
          
          <!-- Footer -->
          <div class="footer">
            <p><strong>HOTEL NOGA</strong> • Douala, Cameroun</p>
            <div class="contact-info">
              <p>📞 +237 XXX XXX XXX • ✉️ contact@hotelnoga.com • 🌐 www.hotelnoga.com</p>
              <p>Ce document fait office de reçu officiel pour la réservation mentionnée ci-dessus.</p>
              <p>Conservez ce reçu et présentez-le à la réception lors de votre arrivée.</p>
              <p>Pour toute question concernant votre réservation, contactez notre service client.</p>
            </div>
            <p style="margin-top: 15px; font-size: 10px; color: #bdc3c7;">
              Reçu généré le ${new Date().toLocaleString('fr-FR')} • ID Réservation: ${reservation._id}
            </p>
          </div>
        </div>
        
        <script>
          // Auto-impression optionnelle
          setTimeout(() => {
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('print') === 'true') {
              window.print();
            }
          }, 1000);
        </script>
      </body>
      </html>
    `;

    // Déterminer le type de réponse
    const acceptHeader = req.headers.accept || '';
    
    if (acceptHeader.includes('application/pdf')) {
      // Si le client demande un PDF (vous pouvez ajouter une génération PDF ici si vous avez puppeteer/pdfkit)
      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Content-Disposition', `inline; filename="receipt-${reservation._id}.html"`);
      res.send(receiptHtml);
    } else if (req.query.format === 'pdf') {
      // Option pour forcer le téléchargement
      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Content-Disposition', `attachment; filename="receipt-${reservation._id}.html"`);
      res.send(receiptHtml);
    } else {
      // Par défaut, retourner HTML
      res.setHeader('Content-Type', 'text/html');
      res.send(receiptHtml);
    }

  } catch (error) {
    console.error('❌ Erreur génération reçu:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la génération du reçu',
      error: error.message
    });
  }
};

/**
 * 🔹 Télécharger le reçu en PDF (option simplifiée)
 */
exports.downloadReceipt = async (req, res) => {
  try {
    const reservation = await Reservation.findById(req.params.id)
      .populate('client', 'name surname email phone')
      .populate('chambre', 'name type price')
      .populate('codePromo', 'code description');

    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: 'Réservation non trouvée'
      });
    }

    // Vérifier les permissions
    const isAdmin = req.user.role === 'admin';
    const isOwner = reservation.client && reservation.client._id.equals(req.user._id);

    if (!isAdmin && !isOwner) {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé à ce reçu'
      });
    }

    // Créer un nom de fichier
    const clientName = `${reservation.client?.name || reservation.clientInfo?.name}_${reservation.client?.surname || reservation.clientInfo?.surname}`;
    const fileName = `Reçu_${clientName}_${reservation._id}_${new Date(reservation.checkIn).toISOString().split('T')[0]}.html`;
    
    // Forcer le téléchargement
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    
    // Rediriger vers la route de génération avec le paramètre de téléchargement
    return res.redirect(`/api/reservations/${req.params.id}/receipt?format=pdf`);

  } catch (error) {
    console.error('❌ Erreur téléchargement reçu:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du téléchargement du reçu',
      error: error.message
    });
  }
};

/**
 * 🔹 Obtenir l'URL du reçu (pour intégration frontend)
 */
exports.getReceiptUrl = async (req, res) => {
  try {
    const reservation = await Reservation.findById(req.params.id);

    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: 'Réservation non trouvée'
      });
    }

    // Vérifier les permissions
    const isAdmin = req.user.role === 'admin';
    const isOwner = reservation.client && reservation.client._id.equals(req.user._id);

    if (!isAdmin && !isOwner) {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé à ce reçu'
      });
    }

    // Retourner l'URL du reçu
    const receiptUrl = `${req.protocol}://${req.get('host')}/api/reservations/${req.params.id}/receipt`;
    const downloadUrl = `${req.protocol}://${req.get('host')}/api/reservations/${req.params.id}/receipt/download`;

    res.json({
      success: true,
      receiptUrl,
      downloadUrl,
      reservationId: reservation._id,
      message: 'URLs du reçu générées avec succès'
    });

  } catch (error) {
    console.error('❌ Erreur génération URL reçu:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la génération de l\'URL du reçu',
      error: error.message
    });
  }
};

// -----------------------------------------------------------
// 📊 NOUVELLES STATISTIQUES
// -----------------------------------------------------------

/**
 * ✅ Obtenir les statistiques des réservations (Admin uniquement)
 */
exports.getReservationStats = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé. Droits administrateur requis.'
      });
    }

    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastYear = new Date(now.getFullYear() - 1, now.getMonth(), 1);

    // Statistiques générales
    const totalReservations = await Reservation.countDocuments();
    const confirmedReservations = await Reservation.countDocuments({ status: 'confirmed' });
    const cancelledReservations = await Reservation.countDocuments({ status: 'cancelled' });
    const pendingReservations = await Reservation.countDocuments({ 
      status: { $in: ['pending', 'pending_payment'] } 
    });

    // Revenus
    const revenueResult = await Reservation.aggregate([
      {
        $match: {
          status: { $in: ['confirmed', 'completed', 'partially_paid'] }
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$totalAmount' },
          averageRevenue: { $avg: '$totalAmount' }
        }
      }
    ]);

    // Réservations par mois (derniers 12 mois)
    const monthlyStats = await Reservation.aggregate([
      {
        $match: {
          createdAt: { $gte: lastYear }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 },
          revenue: { $sum: '$totalAmount' }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 }
      },
      {
        $limit: 12
      }
    ]);

    // Réservations par statut
    const statusStats = await Reservation.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' }
        }
      }
    ]);

    // Meilleures chambres
    const topRooms = await Reservation.aggregate([
      {
        $group: {
          _id: '$chambre',
          reservationCount: { $sum: 1 },
          totalRevenue: { $sum: '$totalAmount' }
        }
      },
      {
        $sort: { reservationCount: -1 }
      },
      {
        $limit: 5
      },
      {
        $lookup: {
          from: 'chambres',
          localField: '_id',
          foreignField: '_id',
          as: 'roomInfo'
        }
      },
      {
        $unwind: '$roomInfo'
      }
    ]);

    res.json({
      success: true,
      stats: {
        totals: {
          totalReservations,
          confirmedReservations,
          cancelledReservations,
          pendingReservations
        },
        revenue: revenueResult[0] || { totalRevenue: 0, averageRevenue: 0 },
        monthlyStats,
        statusStats,
        topRooms
      }
    });

  } catch (error) {
    console.error('❌ Erreur statistiques réservations:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des statistiques',
      error: error.message
    });
  }
};