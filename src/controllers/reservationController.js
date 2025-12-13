const Reservation = require('../models/reservationModel');
const Chambre = require('../models/chambreModel');
const User = require('../models/userModel');
const CodePromo = require('../models/CodePromo');
const crypto = require('crypto');
// Assurez-vous que le chemin et l'exportation sont corrects
const CybersourceSecure = require('../config/cybersourceSecureAcceptance'); 
const PDFGenerator = require('../config/receiptGenerator'); // Chemin vers votre générateur

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
      codePromo,
      prixTotal  // ✅ NOUVEAU: Accepte le prixTotal du frontend
    } = req.body;

    console.log('📥 Données reçues (Auth):', {
      ...req.body,
      prixTotalReçu: prixTotal,
      utilisateur: req.user._id
    });

    const chambre = await Chambre.findById(chambreId);
    if (!chambre) {
      return res.status(404).json({ success: false, message: 'Chambre non trouvée' });
    }

    // --- Vérification de Disponibilité & Calcul des Nuits ---
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
    let calculatedAmount, calculatedNightsToPay;

    switch (paymentOption) {
      case 'first-night':
        calculatedAmount = chambre.price;
        calculatedNightsToPay = 1;
        break;
      case 'partial':
        const validNightsToPay = Math.min(nightsToPay || 1, nights);
        calculatedAmount = chambre.price * validNightsToPay;
        calculatedNightsToPay = validNightsToPay;
        break;
      case 'full':
      default:
        calculatedAmount = chambre.price * nights;
        calculatedNightsToPay = nights;
        break;
    }

    // --- Gestion du code promo ---
    let prixFinal = prixTotal || calculatedAmount; // ✅ Utilise prixTotal si fourni
    let codePromoApplique = null;
    let reduction = 0;
    let prixOriginal = calculatedAmount;

    if (codePromo) {
      try {
        const codePromoVerifie = await CodePromo.findOne({
          code: codePromo.toUpperCase(),
          statut: 'actif'
        });

        if (codePromoVerifie && codePromoVerifie.isValid()) {
          if (codePromoVerifie.applicableToAll || codePromoVerifie.chambres.includes(chambreId)) {
            if (nights >= codePromoVerifie.minimumStay) {
              // Calculer la réduction pour le tracking
              const prixAvecPromo = codePromoVerifie.calculateReducedPrice(calculatedAmount);
              reduction = calculatedAmount - prixAvecPromo;
              codePromoApplique = codePromoVerifie._id;

              codePromoVerifie.utilisationActuelle += 1;
              await codePromoVerifie.save();
              
              console.log('✅ Code promo appliqué:', {
                code: codePromo,
                montantOriginal: calculatedAmount,
                reduction,
                prixAvecPromoCalculé: prixAvecPromo,
                prixFinalUtilisé: prixFinal
              });
            }
          }
        }
      } catch (error) {
        console.warn('⚠️ Erreur vérification code promo:', error);
      }
    }

    // ✅ VALIDATION DE SÉCURITÉ: Vérifier que prixTotal est raisonnable
    if (prixTotal) {
      const margeErreur = 0.1; // 10% de marge d'erreur
      const montantMinimum = calculatedAmount * (1 - margeErreur);
      const montantMaximum = calculatedAmount * (1 + margeErreur);
      
      if (prixTotal < montantMinimum || prixTotal > montantMaximum) {
        console.warn('⚠️ Prix reçu du frontend hors plage acceptable:', {
          prixReçu: prixTotal,
          prixCalculé: calculatedAmount,
          minimumAcceptable: montantMinimum,
          maximumAcceptable: montantMaximum
        });
        
        // Si la différence est trop grande, utiliser le prix calculé
        if (Math.abs(prixTotal - calculatedAmount) > calculatedAmount * 0.2) {
          console.log('⚠️ Différence trop importante, utilisation du prix calculé');
          prixFinal = calculatedAmount;
        }
      }
    }

    console.log('💰 Résultat calculs prix:', {
      prixParNuit: chambre.price,
      nuits: nights,
      montantCalculé: calculatedAmount,
      prixFinalUtilisé: prixFinal,
      prixReçuDuFrontend: prixTotal || 'Non fourni',
      codePromo: codePromo || 'Aucun'
    });

    // --- Création des données de réservation ---
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
      totalAmount: Math.round(prixFinal), // ✅ Prix final (avec réduction si applicable)
      currency: 'XAF',
      paymentMethod: paymentMethod || 'card',
      paymentOption: paymentOption || 'full',
      nightsToPay: calculatedNightsToPay,
      amountPaid: Math.round(prixFinal),
      status: 'pending_payment',
      source: 'website',
      codePromo: codePromoApplique,
      prixOriginal: prixOriginal,
      reductionAppliquee: Math.round(reduction),
      codePromoUtilise: codePromo,
      paiement: {
        amount: Math.round(prixFinal), // ✅ Montant à envoyer à Cybersource
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
      montantRéservation: reservation.totalAmount,
      montantCybersource: paymentData.form_data?.amount,
      fallbackReason: paymentData.fallbackReason || 'Aucun'
    });

    // ✅ VÉRIFICATION FINALE: S'assurer que Cybersource reçoit le bon montant
    if (paymentData.form_data && paymentData.form_data.amount) {
      const montantCybersource = parseFloat(paymentData.form_data.amount);
      if (Math.abs(montantCybersource - reservation.totalAmount) > 1) {
        console.error('❌ ERREUR: Montant Cybersource incorrect! Correction...');
        paymentData.form_data.amount = reservation.totalAmount.toString();
        console.log('✅ Correction appliquée:', paymentData.form_data.amount);
      }
    }

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
      reduction: reduction > 0 ? { 
        appliquee: true, 
        montant: Math.round(reduction), 
        code: codePromo,
        prixOriginal: prixOriginal,
        prixFinal: Math.round(prixFinal)
      } : { appliquee: false }
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
      clientInfo,
      prixTotal  // ✅ CRITIQUE: Prix final envoyé par le frontend
    } = req.body;

    // --- Vérification ClientInfo (Nécessaire pour les réservations publiques) ---
    if (!clientInfo || !clientInfo.email || !clientInfo.name || !clientInfo.surname) {
      return res.status(400).json({ 
        success: false, 
        message: 'Informations client (name, surname, email) requises pour la réservation publique.' 
      });
    }

    console.log('📥 Données reçues (Public):', {
      chambreId,
      checkIn,
      checkOut,
      paymentOption,
      nightsToPay,
      codePromo,
      prixTotalReçu: prixTotal,
      clientEmail: clientInfo.email
    });

    const chambre = await Chambre.findById(chambreId);
    if (!chambre) {
      return res.status(404).json({ success: false, message: 'Chambre non trouvée' });
    }

    // --- Vérification de Disponibilité & Calcul des Nuits ---
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

    // --- Calcul dynamique du montant pour validation ---
    let calculatedAmount, calculatedNightsToPay;
    
    switch (paymentOption) {
      case 'first-night':
        calculatedAmount = chambre.price;
        calculatedNightsToPay = 1;
        break;
      case 'partial':
        const validNightsToPay = Math.min(nightsToPay || 1, nights);
        calculatedAmount = chambre.price * validNightsToPay;
        calculatedNightsToPay = validNightsToPay;
        break;
      case 'full':
      default:
        calculatedAmount = chambre.price * nights;
        calculatedNightsToPay = nights;
        break;
    }

    console.log('💰 Calculs backend (validation):', {
      prixParNuit: chambre.price,
      nuits: nights,
      montantCalculéBackend: calculatedAmount,
      prixReçuDuFrontend: prixTotal || 'Non fourni',
      optionPaiement: paymentOption
    });

    // --- Gestion du code promo (pour tracking uniquement) ---
    let prixFinal = prixTotal || calculatedAmount; // ✅ UTILISE LE PRIX DU FRONTEND
    let codePromoApplique = null;
    let reduction = 0;
    let prixOriginal = calculatedAmount;
    let codePromoUtilise = null;

    if (codePromo) {
      try {
        const codePromoVerifie = await CodePromo.findOne({
          code: codePromo.toUpperCase(),
          statut: 'actif'
        });

        if (codePromoVerifie && codePromoVerifie.isValid()) {
          if (codePromoVerifie.applicableToAll || codePromoVerifie.chambres.includes(chambreId)) {
            if (nights >= codePromoVerifie.minimumStay) {
              // Calculer la réduction pour le tracking
              if (codePromoVerifie.type === 'percentage') {
                reduction = (calculatedAmount * codePromoVerifie.value) / 100;
              } else if (codePromoVerifie.type === 'fixed') {
                reduction = Math.min(codePromoVerifie.value, calculatedAmount);
              }
              
              codePromoApplique = codePromoVerifie._id;
              codePromoUtilise = codePromo.toUpperCase();

              // Incrémenter l'utilisation
              codePromoVerifie.utilisationActuelle += 1;
              await codePromoVerifie.save();

              console.log('✅ Code promo validé (Public):', {
                code: codePromo,
                type: codePromoVerifie.type,
                valeur: codePromoVerifie.value,
                reductionCalculée: reduction,
                montantOriginal: calculatedAmount,
                montantAvecPromoCalculé: calculatedAmount - reduction,
                prixFinalUtilisé: prixFinal
              });
            }
          }
        } else {
          console.log('⚠️ Code promo non valide ou expiré:', codePromo);
        }
      } catch (error) {
        console.warn('⚠️ Erreur vérification code promo (Public):', error);
      }
    }

    // ✅ VALIDATION DE SÉCURITÉ: Vérifier que prixTotal est raisonnable
    if (prixTotal) {
      const margeErreur = 0.15; // 15% de marge d'erreur
      const montantMinimum = calculatedAmount * (1 - margeErreur);
      const montantMaximum = calculatedAmount * (1 + margeErreur);
      
      if (prixTotal < montantMinimum || prixTotal > montantMaximum) {
        console.warn('⚠️ Prix reçu du frontend hors plage acceptable (Public):', {
          prixReçu: prixTotal,
          prixCalculé: calculatedAmount,
          minimumAcceptable: Math.round(montantMinimum),
          maximumAcceptable: Math.round(montantMaximum),
          différence: Math.round(Math.abs(prixTotal - calculatedAmount))
        });
        
        // Si la différence est trop grande (>20%), utiliser le prix calculé
        if (Math.abs(prixTotal - calculatedAmount) > calculatedAmount * 0.2) {
          console.log('⚠️ Différence trop importante, utilisation du prix calculé (Public)');
          prixFinal = Math.round(calculatedAmount);
        } else {
          // Sinon, utiliser le prix du frontend mais avec un warning
          prixFinal = Math.round(prixTotal);
        }
      } else {
        prixFinal = Math.round(prixTotal);
      }
    } else {
      // Si pas de prixTotal fourni, utiliser le prix calculé
      prixFinal = Math.round(calculatedAmount);
    }

    console.log('✅ Prix final déterminé (Public):', {
      prixFinal,
      source: prixTotal ? 'Frontend' : 'Backend',
      codePromo: codePromoUtilise || 'Aucun'
    });
    
    // --- CORRECTION CRITIQUE : Gestion du Client avec rôle VALIDE ---
    let guestUser = await User.findOne({ email: clientInfo.email.toLowerCase() });
    
    if (!guestUser) {
      guestUser = await User.create({
        name: clientInfo.name.trim(),
        surname: clientInfo.surname.trim(),
        email: clientInfo.email.toLowerCase().trim(),
        phone: clientInfo.phone || '',
        password: crypto.randomBytes(10).toString('hex'),
        role: 'client',
        isTemporary: true
      });
      console.log('👤 Compte client temporaire créé:', guestUser._id, 'avec rôle:', guestUser.role);
    } else {
      console.log('👤 Client existant réutilisé:', guestUser._id, 'avec rôle:', guestUser.role);
    }

    // --- Création des données de réservation ---
    const reservationData = {
      client: guestUser._id,
      chambre: chambreId,
      checkIn: checkInDate,
      checkOut: checkOutDate,
      nights,
      guests: guests || (parseInt(adults || 1) + parseInt(children || 0)),
      adults: parseInt(adults || 1),
      children: parseInt(children || 0),
      specialRequests: specialRequests || '',
      totalAmount: prixFinal, // ✅ PRIX FINAL DÉTERMINÉ
      currency: 'XAF',
      paymentMethod: paymentMethod || 'card',
      paymentOption: paymentOption || 'full',
      nightsToPay: calculatedNightsToPay,
      amountPaid: prixFinal,
      status: 'pending_payment',
      source: 'public_website',
      codePromo: codePromoApplique,
      prixOriginal: prixOriginal,
      reductionAppliquee: Math.round(reduction),
      codePromoUtilise: codePromoUtilise,
      paiement: {
        amount: prixFinal, // ✅ MÊME MONTANT POUR CYBERSOURCE
        currency: 'XAF',
        method: paymentMethod || 'card',
        status: 'pending',
        gateway: 'cybersource_secure_acceptance'
      }
    };

    const reservation = await Reservation.create(reservationData);
    await reservation.populate('chambre client');

    // Préparer les données pour Secure Acceptance
    const paymentData = preparePaymentData(reservation, null, clientInfo);
    
    console.log('🔹 Données paiement préparées (Public):', {
      hasCyberSource: paymentData.hasCyberSource,
      montantRéservation: reservation.totalAmount,
      montantCybersource: paymentData.form_data?.amount,
      fallbackReason: paymentData.fallbackReason || 'Aucun',
      codePromo: codePromoUtilise || 'Aucun'
    });

    // ✅ VÉRIFICATION CRITIQUE: S'assurer que Cybersource reçoit exactement le bon montant
    if (paymentData.form_data && paymentData.form_data.amount) {
      const montantCybersource = parseFloat(paymentData.form_data.amount);
      const montantRéservation = reservation.totalAmount;
      
      if (Math.abs(montantCybersource - montantRéservation) > 1) {
        console.error('❌ ERREUR CRITIQUE: Montant Cybersource incorrect!', {
          montantRéservation,
          montantCybersource,
          différence: Math.abs(montantCybersource - montantRéservation)
        });
        
        // Correction forcée
        paymentData.form_data.amount = montantRéservation.toString();
        console.log('✅ Correction appliquée (Public):', paymentData.form_data.amount);
      } else {
        console.log('✅ Montant Cybersource correct:', paymentData.form_data.amount);
      }
    }

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
      reduction: reduction > 0 ? { 
        appliquee: true, 
        montant: Math.round(reduction), 
        code: codePromoUtilise,
        prixOriginal: prixOriginal,
        prixFinal: prixFinal
      } : { appliquee: false }
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
      console.log('💰 Montant payé:', auth_amount, req_currency);
      console.log('🎟️ Code promo utilisé:', reservation.codePromoUtilise || 'AUCUN');

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

    // Vérifier si la réservation peut être supprimée
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
/**
 * 🔹 Générer un reçu PDF pour une réservation
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

    // Générer le HTML du reçu
    const receiptHtml = generateReceiptHTML(reservation);
    
    // Vérifier si le client demande un PDF
    const acceptHeader = req.headers.accept || '';
    const wantsPDF = acceptHeader.includes('application/pdf') || req.query.format === 'pdf';
    
    if (wantsPDF) {
      try {
        console.log('📄 Tentative de génération PDF avec Puppeteer...');
        
        // Générer le PDF
        const pdfBuffer = await PDFGenerator.generatePDF(receiptHtml);
        
        // Configurer les headers pour le PDF
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="receipt-${reservation._id}.pdf"`);
        
        // Envoyer le PDF
        return res.send(pdfBuffer);
        
      } catch (pdfError) {
        console.error('❌ Erreur génération PDF, fallback vers HTML:', pdfError);
        // Fallback vers HTML en cas d'erreur
        return sendHTMLReceipt(res, receiptHtml, reservation._id);
      }
    } else {
      // Retourner le HTML par défaut
      return sendHTMLReceipt(res, receiptHtml, reservation._id);
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

// Fonction helper pour envoyer le HTML
function sendHTMLReceipt(res, html, reservationId) {
  res.setHeader('Content-Type', 'text/html');
  res.setHeader('Content-Disposition', `inline; filename="receipt-${reservationId}.html"`);
  res.send(html);
}

// Fonction helper pour générer le HTML
function generateReceiptHTML(reservation) {
  // Copiez ici tout le code HTML de la fonction précédente
  // ...
  return htmlContent;
}

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