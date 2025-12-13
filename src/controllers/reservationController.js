// src/controllers/reservationController.js
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
// 🔍 Fonctions de Lecture (Lecture) - MODIFIÉ POUR RESPECTER LES PERMISSIONS
// -----------------------------------------------------------

/**
 * 🔹 Récupérer toutes les réservations avec contrôle d'accès basé sur les permissions
 */
exports.getReservations = async (req, res) => {
  try {
    const user = req.user;
    let reservations;

    console.log(`👤 Récupération réservations pour utilisateur:`, {
      id: user._id,
      role: user.role,
      permissions: user.permissions,
      email: user.email
    });

    // ✅ DÉFINITION DES RÔLES AUTORISÉS SELON LE FRONTEND AddUser
    const canViewAllReservations = ['admin', 'manager', 'receptionist', 'supervisor'].includes(user.role);
    const hasReservationPermission = user.permissions.includes('gestion_reservations');
    
    console.log('🔍 Vérification accès:', {
      canViewAllReservations,
      hasReservationPermission,
      roleAutorisé: canViewAllReservations,
      permissionAutorisée: hasReservationPermission
    });

    if (canViewAllReservations && hasReservationPermission) {
      // ✅ PERSONNEL AUTORISÉ: Voir TOUTES les réservations
      console.log(`👁️  ${user.role} visualise TOUTES les réservations (permission accordée)`);
      
      // Construire la requête avec filtres
      let query = Reservation.find();
      
      // Filtre par statut si fourni dans la requête
      if (req.query.status && req.query.status !== 'all') {
        query = query.where('status').equals(req.query.status);
        console.log(`🔍 Filtre statut appliqué: ${req.query.status}`);
      }
      
      // Recherche par nom client, email, téléphone ou numéro de chambre
      if (req.query.search) {
        const searchRegex = new RegExp(req.query.search, 'i');
        console.log(`🔍 Recherche appliquée: "${req.query.search}"`);
        
        // Trouver les chambres correspondant à la recherche
        const chambresTrouvees = await Chambre.find({
          $or: [
            { number: searchRegex },
            { name: searchRegex }
          ]
        }).select('_id');
        
        const chambreIds = chambresTrouvees.map(c => c._id);
        
        query = query.or([
          { 'clientInfo.name': searchRegex },
          { 'clientInfo.surname': searchRegex },
          { 'clientInfo.email': searchRegex },
          { 'clientInfo.phone': { $regex: searchRegex } },
          { chambre: { $in: chambreIds } }
        ]);
      }
      
      // Filtre par date si fourni
      if (req.query.dateFrom) {
        const dateFrom = new Date(req.query.dateFrom);
        query = query.where('checkIn').gte(dateFrom);
        console.log(`📅 Filtre dateFrom: ${req.query.dateFrom}`);
      }
      
      if (req.query.dateTo) {
        const dateTo = new Date(req.query.dateTo);
        query = query.where('checkOut').lte(dateTo);
        console.log(`📅 Filtre dateTo: ${req.query.dateTo}`);
      }
      
      // Pagination
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;
      
      query = query.skip(skip).limit(limit);
      
      // Tri par date de création décroissante (les plus récentes d'abord)
      query = query.sort({ createdAt: -1 });
      
      // Compter le total pour la pagination
      const totalCount = await Reservation.countDocuments(query.getFilter());
      
      // Exécuter la requête avec les populations complètes
      reservations = await query
        .populate({
          path: 'client',
          select: 'name surname email phone',
          match: { role: { $ne: 'client' } } // Exclure les clients standards si nécessaire
        })
        .populate('chambre', 'number name type price currency status')
        .populate('codePromo', 'code description type value');
        
      console.log(`📊 ${reservations.length} réservation(s) trouvée(s) sur ${totalCount} total`);
      
    } else {
      // ❌ ACCÈS REFUSÉ: L'utilisateur n'a pas les permissions nécessaires
      console.log(`⛔ ${user.role} n'a pas accès aux réservations`);
      return res.status(403).json({
        success: false,
        message: 'Accès refusé. Permissions insuffisantes pour visualiser les réservations.'
      });
    }

    // Formater les réservations pour le frontend
    const formattedReservations = reservations.map(reservation => {
      const reservationObj = reservation.toObject();
      
      // S'assurer que le client existe
      if (!reservationObj.client) {
        reservationObj.client = {
          name: reservationObj.clientInfo?.name || 'N/A',
          surname: reservationObj.clientInfo?.surname || 'N/A',
          email: reservationObj.clientInfo?.email || 'N/A',
          phone: reservationObj.clientInfo?.phone || 'N/A'
        };
      }
      
      // Calculer les nuits si manquant
      if (!reservationObj.nuits && reservationObj.nights) {
        reservationObj.nuits = reservationObj.nights;
      }
      
      return reservationObj;
    });

    res.json({
      success: true,
      count: formattedReservations.length,
      reservations: formattedReservations,
      totalCount: formattedReservations.length, // Pour la pagination frontend
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 10,
      hasMore: formattedReservations.length === (parseInt(req.query.limit) || 10)
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
 * 🔹 Récupérer une réservation par ID avec contrôle d'accès basé sur les permissions
 */
exports.getReservationById = async (req, res) => {
  try {
    const reservation = await Reservation.findById(req.params.id)
      .populate('client', 'name surname email phone role permissions')
      .populate('chambre', 'number name type price currency images amenities')
      .populate('codePromo', 'code description type value');

    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: 'Réservation non trouvée'
      });
    }

    const user = req.user;
    const isAdmin = user.role === 'admin';
    const isManager = user.role === 'manager';
    const isReceptionist = user.role === 'receptionist';
    const isSupervisor = user.role === 'supervisor';
    const isOwner = reservation.client && reservation.client._id.equals(user._id);
    
    // Vérifier les permissions basées sur le rôle et les permissions
    const canAccessReservation = isAdmin || isManager || isReceptionist || isSupervisor || isOwner;
    const hasReservationPermission = user.permissions.includes('gestion_reservations');
    
    console.log('🔍 Vérification accès réservation détaillée:', {
      userId: user._id,
      userRole: user.role,
      userPermissions: user.permissions,
      reservationClientId: reservation.client?._id,
      isAdmin,
      isManager,
      isReceptionist,
      isSupervisor,
      isOwner,
      canAccessReservation,
      hasReservationPermission
    });

    if (!canAccessReservation || !hasReservationPermission) {
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
 * 🔹 Récupérer les réservations d'un utilisateur spécifique avec contrôle d'accès
 */
exports.getUserReservations = async (req, res) => {
  try {
    const userId = req.params.userId;
    const user = req.user;
    
    // Vérification des permissions
    const isAdmin = user.role === 'admin';
    const isManager = user.role === 'manager';
    const isReceptionist = user.role === 'receptionist';
    const isSupervisor = user.role === 'supervisor';
    const isRequestingOwnData = user._id.equals(userId);
    
    const canViewUserReservations = isAdmin || isManager || isReceptionist || isSupervisor || isRequestingOwnData;
    const hasClientPermission = user.permissions.includes('gestion_clients');
    
    console.log('🔍 Vérification accès réservations utilisateur:', {
      userId: user._id,
      targetUserId: userId,
      userRole: user.role,
      isAdmin,
      isManager,
      isReceptionist,
      isSupervisor,
      isRequestingOwnData,
      canViewUserReservations,
      hasClientPermission
    });

    if (!canViewUserReservations || !hasClientPermission) {
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
// ✏️ Fonctions de Modification avec Contrôle d'Accès
// -----------------------------------------------------------

/**
 * 🔹 Mettre à jour une réservation avec contrôle d'accès
 */
exports.updateReservation = async (req, res) => {
  try {
    const reservation = await Reservation.findById(req.params.id)
      .populate('client');

    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: 'Réservation non trouvée'
      });
    }

    const user = req.user;
    const isAdmin = user.role === 'admin';
    const isManager = user.role === 'manager';
    const isReceptionist = user.role === 'receptionist';
    const isSupervisor = user.role === 'supervisor';
    const isOwner = reservation.client && reservation.client._id.equals(user._id);
    
    const canUpdateReservation = isAdmin || isManager || isReceptionist || isSupervisor;
    const hasReservationPermission = user.permissions.includes('gestion_reservations');
    
    console.log('🔍 Vérification mise à jour réservation:', {
      userId: user._id,
      userRole: user.role,
      canUpdateReservation,
      hasReservationPermission,
      isOwner
    });

    // Seuls les rôles autorisés peuvent modifier (pas les propriétaires sauf si admin)
    if (!canUpdateReservation || !hasReservationPermission) {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé pour modifier cette réservation'
      });
    }

    // Vérifier les champs autorisés à modifier selon le rôle
    const allowedFields = {};
    const updateData = req.body;
    
    // Admin peut tout modifier
    if (isAdmin) {
      Object.assign(allowedFields, updateData);
    } 
    // Manager peut modifier la plupart des champs sauf paiement
    else if (isManager) {
      const managerAllowedFields = [
        'checkIn', 'checkOut', 'adults', 'children', 
        'specialRequests', 'status', 'chambre'
      ];
      
      managerAllowedFields.forEach(field => {
        if (updateData[field] !== undefined) {
          allowedFields[field] = updateData[field];
        }
      });
    }
    // Réceptionniste peut modifier seulement certains champs
    else if (isReceptionist) {
      const receptionistAllowedFields = [
        'checkIn', 'checkOut', 'adults', 'children', 
        'specialRequests'
      ];
      
      receptionistAllowedFields.forEach(field => {
        if (updateData[field] !== undefined) {
          allowedFields[field] = updateData[field];
        }
      });
    }
    // Superviseur peut modifier comme manager
    else if (isSupervisor) {
      const supervisorAllowedFields = [
        'checkIn', 'checkOut', 'adults', 'children', 
        'specialRequests', 'status'
      ];
      
      supervisorAllowedFields.forEach(field => {
        if (updateData[field] !== undefined) {
          allowedFields[field] = updateData[field];
        }
      });
    }

    const updatedReservation = await Reservation.findByIdAndUpdate(
      req.params.id,
      allowedFields, {
        new: true,
        runValidators: true
      }
    ).populate('client chambre codePromo');

    console.log(`✅ Réservation ${req.params.id} mise à jour par ${user.role}:`, {
      updatedFields: Object.keys(allowedFields),
      user: user.email
    });

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
 * 🔹 Annuler une réservation avec contrôle d'accès
 */
exports.cancelReservation = async (req, res) => {
  try {
    const reservation = await Reservation.findById(req.params.id)
      .populate('client', 'email name role')
      .populate('chambre')
      .populate('codePromo');

    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: 'Réservation non trouvée'
      });
    }

    const user = req.user;
    const isAdmin = user.role === 'admin';
    const isManager = user.role === 'manager';
    const isReceptionist = user.role === 'receptionist';
    const isSupervisor = user.role === 'supervisor';
    const isOwner = reservation.client && reservation.client._id.equals(user._id);
    
    const canCancelReservation = isAdmin || isManager || isReceptionist || isSupervisor || isOwner;
    const hasReservationPermission = user.permissions.includes('gestion_reservations');
    
    console.log('🔍 Vérification annulation réservation:', {
      userId: user._id,
      userRole: user.role,
      canCancelReservation,
      hasReservationPermission,
      isOwner
    });

    if (!canCancelReservation || !hasReservationPermission) {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé pour annuler cette réservation'
      });
    }

    // Vérifier si l'annulation est possible selon le statut
    const cannotCancelStatuses = ['cancelled', 'completed', 'payment_failed'];
    if (cannotCancelStatuses.includes(reservation.status)) {
      return res.status(400).json({
        success: false,
        message: `Impossible d'annuler une réservation avec le statut "${reservation.status}"`
      });
    }

    reservation.status = 'cancelled';
    if (reservation.paiement) {
      reservation.paiement.status = 'refunded';
    }

    await reservation.save();

    console.log(`✅ Réservation ${req.params.id} annulée par ${user.role}`);

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
 * 🔹 Confirmer une réservation avec contrôle d'accès strict
 */
exports.confirmReservation = async (req, res) => {
  try {
    const user = req.user;
    const isAdmin = user.role === 'admin';
    const isManager = user.role === 'manager';
    
    // Seuls admin et manager peuvent confirmer des réservations
    if (!isAdmin && !isManager) {
      return res.status(403).json({ 
        success: false, 
        message: 'Accès non autorisé. Droits administrateur ou manager requis.' 
      });
    }
    
    const reservation = await Reservation.findById(req.params.id);

    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: 'Réservation non trouvée'
      });
    }

    // Vérifier que la réservation peut être confirmée
    if (reservation.status !== 'pending' && reservation.status !== 'pending_payment') {
      return res.status(400).json({
        success: false,
        message: `Impossible de confirmer une réservation avec le statut "${reservation.status}"`
      });
    }

    reservation.status = 'confirmed';
    await reservation.save();

    console.log(`✅ Réservation ${req.params.id} confirmée par ${user.role}`);

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
// 🗑️ Fonctions Administratives avec Contrôle d'Accès Strict
// -----------------------------------------------------------

/**
 * ✅ Supprimer définitivement une réservation (Admin uniquement)
 */
exports.deleteReservation = async (req, res) => {
  try {
    const user = req.user;
    
    // Seul l'admin peut supprimer définitivement
    if (user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé. Droits administrateur requis pour supprimer une réservation.'
      });
    }

    const reservation = await Reservation.findById(req.params.id);

    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: 'Réservation non trouvée'
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

    console.log(`🗑️ Réservation ${req.params.id} supprimée définitivement par admin`);

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

// -----------------------------------------------------------
// 🧾 FONCTIONS DE REÇU avec Contrôle d'Accès
// -----------------------------------------------------------

/**
 * 🔹 Générer un reçu HTML pour une réservation
 */
exports.generateReceipt = async (req, res) => {
  try {
    const reservation = await Reservation.findById(req.params.id)
      .populate('client', 'name surname email phone role')
      .populate('chambre', 'number name type price amenities')
      .populate('codePromo', 'code description value type');

    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: 'Réservation non trouvée'
      });
    }

    const user = req.user;
    const isAdmin = user.role === 'admin';
    const isManager = user.role === 'manager';
    const isReceptionist = user.role === 'receptionist';
    const isSupervisor = user.role === 'supervisor';
    const isOwner = reservation.client && reservation.client._id.equals(user._id);
    
    const canViewReceipt = isAdmin || isManager || isReceptionist || isSupervisor || isOwner;
    const hasReservationPermission = user.permissions.includes('gestion_reservations');
    
    if (!canViewReceipt || !hasReservationPermission) {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé à ce reçu'
      });
    }

    // Générer le HTML du reçu (simplifié pour l'exemple)
    const receiptHtml = `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reçu Réservation #${reservation._id}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; }
          .header { text-align: center; margin-bottom: 30px; }
          .hotel-name { font-size: 24px; font-weight: bold; color: #2c3e50; }
          .receipt-title { font-size: 20px; margin-top: 20px; }
          .section { margin: 20px 0; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
          .info-item { margin: 10px 0; }
          .label { font-weight: bold; color: #555; }
          .value { color: #333; }
          .total { font-size: 18px; font-weight: bold; margin-top: 30px; padding-top: 20px; border-top: 2px solid #ddd; }
          .footer { margin-top: 50px; text-align: center; color: #777; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="hotel-name">GRAND HOTEL</div>
          <div class="receipt-title">REÇU DE RÉSERVATION</div>
          <div>N° ${reservation._id}</div>
        </div>
        
        <div class="section">
          <div class="info-grid">
            <div class="info-item">
              <div class="label">Client:</div>
              <div class="value">${reservation.client?.name || reservation.clientInfo?.name} ${reservation.client?.surname || reservation.clientInfo?.surname}</div>
            </div>
            <div class="info-item">
              <div class="label">Email:</div>
              <div class="value">${reservation.client?.email || reservation.clientInfo?.email}</div>
            </div>
            <div class="info-item">
              <div class="label">Chambre:</div>
              <div class="value">${reservation.chambre?.number} - ${reservation.chambre?.name}</div>
            </div>
            <div class="info-item">
              <div class="label">Période:</div>
              <div class="value">${new Date(reservation.checkIn).toLocaleDateString('fr-FR')} au ${new Date(reservation.checkOut).toLocaleDateString('fr-FR')}</div>
            </div>
            <div class="info-item">
              <div class="label">Nuits:</div>
              <div class="value">${reservation.nights || reservation.nuits}</div>
            </div>
            <div class="info-item">
              <div class="label">Statut:</div>
              <div class="value">${reservation.status}</div>
            </div>
          </div>
        </div>
        
        <div class="section">
          <div class="info-item">
            <div class="label">Montant Total:</div>
            <div class="value total">${reservation.totalAmount?.toLocaleString('fr-FR')} FCFA</div>
          </div>
          ${reservation.codePromoUtilise ? `
          <div class="info-item">
            <div class="label">Code Promo:</div>
            <div class="value">${reservation.codePromoUtilise} (Réduction: ${reservation.reductionAppliquee?.toLocaleString('fr-FR')} FCFA)</div>
          </div>
          ` : ''}
        </div>
        
        <div class="footer">
          <div>Reçu généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}</div>
          <div>GRAND HOTEL - Tél: +237 XXX XX XX XX</div>
        </div>
      </body>
      </html>
    `;

    // Vérifier si le client demande un PDF
    const acceptHeader = req.headers.accept || '';
    const wantsPDF = acceptHeader.includes('application/pdf') || req.query.format === 'pdf';
    
    if (wantsPDF && PDFGenerator && typeof PDFGenerator.generatePDF === 'function') {
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
        // Fallback vers HTML
        res.setHeader('Content-Type', 'text/html');
        res.setHeader('Content-Disposition', `inline; filename="receipt-${reservation._id}.html"`);
        return res.send(receiptHtml);
      }
    } else {
      // Retourner le HTML par défaut
      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Content-Disposition', `inline; filename="receipt-${reservation._id}.html"`);
      return res.send(receiptHtml);
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
 * 🔹 Télécharger le reçu en tant que fichier
 */
exports.downloadReceipt = async (req, res) => {
  try {
    const reservation = await Reservation.findById(req.params.id)
      .populate('client', 'name surname email phone role')
      .populate('chambre', 'number name type price amenities')
      .populate('codePromo', 'code description value type');

    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: 'Réservation non trouvée'
      });
    }

    const user = req.user;
    const isAdmin = user.role === 'admin';
    const isManager = user.role === 'manager';
    const isReceptionist = user.role === 'receptionist';
    const isSupervisor = user.role === 'supervisor';
    const isOwner = reservation.client && reservation.client._id.equals(user._id);
    
    const canViewReceipt = isAdmin || isManager || isReceptionist || isSupervisor || isOwner;
    const hasReservationPermission = user.permissions.includes('gestion_reservations');
    
    if (!canViewReceipt || !hasReservationPermission) {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé à ce reçu'
      });
    }

    // Générer le HTML du reçu
    const receiptHtml = `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reçu Réservation #${reservation._id}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; }
          .header { text-align: center; margin-bottom: 30px; }
          .hotel-name { font-size: 24px; font-weight: bold; color: #2c3e50; }
          .receipt-title { font-size: 20px; margin-top: 20px; }
          .section { margin: 20px 0; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
          .info-item { margin: 10px 0; }
          .label { font-weight: bold; color: #555; }
          .value { color: #333; }
          .total { font-size: 18px; font-weight: bold; margin-top: 30px; padding-top: 20px; border-top: 2px solid #ddd; }
          .footer { margin-top: 50px; text-align: center; color: #777; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="hotel-name">GRAND HOTEL</div>
          <div class="receipt-title">REÇU DE RÉSERVATION</div>
          <div>N° ${reservation._id}</div>
        </div>
        
        <div class="section">
          <div class="info-grid">
            <div class="info-item">
              <div class="label">Client:</div>
              <div class="value">${reservation.client?.name || reservation.clientInfo?.name} ${reservation.client?.surname || reservation.clientInfo?.surname}</div>
            </div>
            <div class="info-item">
              <div class="label">Email:</div>
              <div class="value">${reservation.client?.email || reservation.clientInfo?.email}</div>
            </div>
            <div class="info-item">
              <div class="label">Chambre:</div>
              <div class="value">${reservation.chambre?.number} - ${reservation.chambre?.name}</div>
            </div>
            <div class="info-item">
              <div class="label">Période:</div>
              <div class="value">${new Date(reservation.checkIn).toLocaleDateString('fr-FR')} au ${new Date(reservation.checkOut).toLocaleDateString('fr-FR')}</div>
            </div>
            <div class="info-item">
              <div class="label">Nuits:</div>
              <div class="value">${reservation.nights || reservation.nuits}</div>
            </div>
            <div class="info-item">
              <div class="label">Statut:</div>
              <div class="value">${reservation.status}</div>
            </div>
          </div>
        </div>
        
        <div class="section">
          <div class="info-item">
            <div class="label">Montant Total:</div>
            <div class="value total">${reservation.totalAmount?.toLocaleString('fr-FR')} FCFA</div>
          </div>
          ${reservation.codePromoUtilise ? `
          <div class="info-item">
            <div class="label">Code Promo:</div>
            <div class="value">${reservation.codePromoUtilise} (Réduction: ${reservation.reductionAppliquee?.toLocaleString('fr-FR')} FCFA)</div>
          </div>
          ` : ''}
        </div>
        
        <div class="footer">
          <div>Reçu généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}</div>
          <div>GRAND HOTEL - Tél: +237 XXX XX XX XX</div>
        </div>
      </body>
      </html>
    `;

    // Configurer les headers pour le téléchargement
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="receipt-${reservation._id}.html"`);
    
    // Envoyer le fichier
    res.send(receiptHtml);

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
 * 🔹 Obtenir les URLs du reçu
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

    const user = req.user;
    const isAdmin = user.role === 'admin';
    const isManager = user.role === 'manager';
    const isReceptionist = user.role === 'receptionist';
    const isSupervisor = user.role === 'supervisor';
    const isOwner = reservation.client && reservation.client._id.equals(user._id);
    
    const canViewReceipt = isAdmin || isManager || isReceptionist || isSupervisor || isOwner;
    const hasReservationPermission = user.permissions.includes('gestion_reservations');
    
    if (!canViewReceipt || !hasReservationPermission) {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé à ce reçu'
      });
    }

    // Générer les URLs du reçu
    const baseUrl = process.env.API_URL || 'http://localhost:5000';
    const receiptUrl = `${baseUrl}/api/reservations/${req.params.id}/receipt`;
    const downloadUrl = `${baseUrl}/api/reservations/${req.params.id}/receipt/download`;

    res.json({
      success: true,
      receiptUrl,
      downloadUrl,
      reservationId: req.params.id,
      message: 'URLs du reçu générées avec succès'
    });

  } catch (error) {
    console.error('❌ Erreur génération URLs reçu:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la génération des URLs',
      error: error.message
    });
  }
};

// -----------------------------------------------------------
// 📊 STATISTIQUES avec Contrôle d'Accès Strict
// -----------------------------------------------------------

/**
 * ✅ Obtenir les statistiques des réservations (Admin et Manager uniquement)
 */
exports.getReservationStats = async (req, res) => {
  try {
    const user = req.user;
    
    // Seuls admin et manager peuvent voir les statistiques
    if (user.role !== 'admin' && user.role !== 'manager') {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé. Droits administrateur ou manager requis.'
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

/**
 * ✅ Statistiques des codes promo utilisés (Admin et Manager uniquement)
 */
exports.getPromoCodeStats = async (req, res) => {
  try {
    const user = req.user;
    
    // Seuls admin et manager peuvent voir les statistiques des codes promo
    if (user.role !== 'admin' && user.role !== 'manager') {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé. Droits administrateur ou manager requis.'
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

module.exports = exports;