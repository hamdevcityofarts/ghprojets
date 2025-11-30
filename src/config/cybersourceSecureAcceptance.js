// config/cybersourceSecureAcceptance.js - VERSION MISE À JOUR AVEC PAIEMENT PARTIEL
const crypto = require('crypto');

class CybersourceSecureAcceptance {
  constructor() {
    // Configuration depuis .env
    this.profileId = process.env.CYBERSOURCE_PROFILE_ID;
    this.accessKey = process.env.CYBERSOURCE_ACCESS_KEY;
    this.secretKey = process.env.CYBERSOURCE_SECRET_KEY;
    
    // URLs selon l'environnement
    this.isProduction = process.env.NODE_ENV === 'production';
    
    // ✅ URL de paiement CyberSource
    /*this.paymentUrl = this.isProduction
      ? 'https://secureacceptance.cybersource.com/pay'
      : 'https://testsecureacceptance.cybersource.com/pay';*/

       this.paymentUrl = 'https://testsecureacceptance.cybersource.com/pay'
     
    
    console.log('🔐 CyberSource Secure Acceptance initialisé');
    console.log('  Mode:', this.isProduction ? 'PRODUCTION' : 'TEST');
    console.log('  Profile ID:', this.profileId ? '✓ Configuré' : '✗ Manquant');
    console.log('  Access Key:', this.accessKey ? '✓ Configuré' : '✗ Manquant');
    console.log('  Secret Key:', this.secretKey ? '✓ Configuré' : '✗ Manquant');
  }

  /**
   * 🔹 GÉNÉRER LES DONNÉES DE FORMULAIRE POUR LE FRONTEND - FONCTION MANQUANTE AJOUTÉE
   */
  generatePaymentForm(paymentData) {
    console.log('🔹 Génération formulaire de paiement pour:', paymentData.reservationId);
    
    try {
      // Valider les données de paiement
      const validation = this.validatePaymentData(paymentData);
      if (!validation.isValid) {
        throw new Error(`Données de paiement invalides: ${validation.errors.join(', ')}`);
      }

      // Vérifier si CyberSource est configuré
      if (!this.isConfigured()) {
        console.log('⚠️ CyberSource non configuré - mode simulation');
        return this.generateMockParams(paymentData);
      }

      // Générer les paramètres signés
      const formData = this.generatePaymentParams(paymentData);
      const formAction = this.getPaymentUrl();

      console.log('✅ Formulaire CyberSource généré avec succès');
      console.log('  URL:', formAction);
      console.log('  Champs:', Object.keys(formData).length);
      console.log('  Montant:', paymentData.amount, paymentData.currency);
      console.log('  Option paiement:', paymentData.paymentOption);

      return {
        form_data: formData,
        form_action: formAction,
        reservationId: paymentData.reservationId,
        amount: paymentData.amount,
        currency: paymentData.currency,
        hasCyberSource: true
      };

    } catch (error) {
      console.error('❌ Erreur génération formulaire:', error);
      
      // Fallback vers le mode simulation
      return this.generateMockParams(paymentData);
    }
  }

  /**
   * 🔹 GÉNÉRER LES PARAMÈTRES DE PAIEMENT SIGNÉS - MIS À JOUR
   */
  generatePaymentParams(data) {
    console.log('🔐 Génération paramètres paiement pour réservation:', data.reservationId);
    
    // ✅ URL de callback VERS LE BACKEND (pas le frontend !)
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';
    
    // ✅ NOUVEAU : Description dynamique selon l'option de paiement
    const paymentDescription = this.getPaymentDescription(data);
    
    // Paramètres requis par CyberSource Secure Acceptance
    const params = {
      // Identification
      access_key: this.accessKey,
      profile_id: this.profileId,
      
      // Transaction
      transaction_uuid: `${data.reservationId}-${Date.now()}`,
      signed_date_time: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
      locale: 'fr-FR',
      transaction_type: 'authorization',
      
      // ✅ CORRECTION: Utiliser l'ID COMPLET de la réservation
      reference_number: data.reservationId,
      
      // Montant
      amount: data.amount.toFixed(2),
      currency: data.currency || 'XAF',
      payment_method: 'card',
      
      // ✅ CORRECTION: URLs de callback vers le BACKEND
      override_custom_receipt_page: `${backendUrl}/api/payments/callback`,
      override_custom_cancel_page: `${backendUrl}/api/payments/cancel`,
      
      // Informations client
      bill_to_forename: data.clientFirstName || '',
      bill_to_surname: data.clientLastName || '',
      bill_to_email: data.clientEmail || '',
      bill_to_address_line1: data.clientAddress || 'Hotel Address',
      bill_to_address_city: data.clientCity || 'Douala',
      bill_to_address_country: 'CM',
      
      // ✅ NOUVEAU : Champs personnalisés pour le suivi
      merchant_defined_data1: data.paymentOption || 'full',
      merchant_defined_data2: data.nightsToPay?.toString() || '0',
      merchant_defined_data3: data.nights?.toString() || '0',
      merchant_defined_data4: paymentDescription
    };

    // Champs signés (ordre important pour la signature) - MIS À JOUR
    const signedFieldNames = [
      'access_key',
      'profile_id',
      'transaction_uuid',
      'signed_field_names',
      'unsigned_field_names',
      'signed_date_time',
      'locale',
      'transaction_type',
      'reference_number',
      'amount',
      'currency',
      'payment_method',
      'override_custom_receipt_page',
      'override_custom_cancel_page',
      'bill_to_forename',
      'bill_to_surname',
      'bill_to_email',
      'bill_to_address_line1',
      'bill_to_address_city',
      'bill_to_address_country',
      // ✅ NOUVEAU : Champs personnalisés signés
      'merchant_defined_data1',
      'merchant_defined_data2',
      'merchant_defined_data3',
      'merchant_defined_data4'
    ];

    // Champs non signés
    const unsignedFieldNames = [];

    // Ajouter les listes de champs
    params.signed_field_names = signedFieldNames.join(',');
    params.unsigned_field_names = unsignedFieldNames.join(',');

    // Générer la signature HMAC-SHA256
    params.signature = this.generateSignature(params, signedFieldNames);

    console.log('✅ Paramètres générés avec succès');
    console.log('  Transaction UUID:', params.transaction_uuid);
    console.log('  Reference Number:', params.reference_number);
    console.log('  Amount:', params.amount, params.currency);
    console.log('  Payment Option:', data.paymentOption || 'full');
    console.log('  Nights to Pay:', data.nightsToPay || 'all');
    console.log('  Receipt URL:', params.override_custom_receipt_page);

    return params;
  }

  /**
   * 🔹 NOUVEAU : OBTENIR LA DESCRIPTION DU PAIEMENT
   */
  getPaymentDescription(data) {
    const roomName = data.roomName || 'Chambre';
    const nights = data.nights || 1;
    const nightsToPay = data.nightsToPay || nights;
    const paymentOption = data.paymentOption || 'full';
    
    switch (paymentOption) {
      case 'first-night':
        return `Première nuit - ${roomName} (${nights} nuits totales)`;
        
      case 'partial':
        return `${nightsToPay} nuit(s) sur ${nights} - ${roomName}`;
        
      case 'full':
      default:
        return `Séjour complet - ${roomName} (${nights} nuits)`;
    }
  }

  /**
   * 🔹 GÉNÉRER LA SIGNATURE HMAC-SHA256
   */
  generateSignature(params, signedFields) {
    try {
      console.log('🔏 Génération signature HMAC-SHA256...');
      
      // Construire la chaîne à signer (format CyberSource)
      const dataToSign = signedFields
        .map(field => `${field}=${params[field] || ''}`)
        .join(',');

      console.log('📝 Champs signés:', signedFields.length, 'champs');
      console.log('🔐 Longueur chaîne à signer:', dataToSign.length, 'caractères');

      // Créer le HMAC SHA256
      const signature = crypto
        .createHmac('sha256', this.secretKey)
        .update(dataToSign)
        .digest('base64');

      console.log('✅ Signature générée:', signature.substring(0, 20) + '...');
      
      return signature;
      
    } catch (error) {
      console.error('❌ Erreur génération signature:', error);
      throw new Error(`Erreur génération signature: ${error.message}`);
    }
  }

  /**
   * 🔹 VALIDER LA SIGNATURE DE RETOUR - MIS À JOUR
   */
  validateResponseSignature(responseParams) {
    try {
      console.log('🔍 Validation signature de retour...');
      
      if (!responseParams.signed_field_names) {
        console.error('❌ Champ signed_field_names manquant');
        return false;
      }
      
      if (!responseParams.signature) {
        console.error('❌ Signature manquante');
        return false;
      }
      
      const signedFieldNames = responseParams.signed_field_names.split(',');
      const receivedSignature = responseParams.signature;

      console.log('📝 Champs à valider:', signedFieldNames.length);

      // Recalculer la signature
      const calculatedSignature = this.generateSignature(responseParams, signedFieldNames);

      // Comparer les signatures
      const isValid = calculatedSignature === receivedSignature;
      
      if (isValid) {
        console.log('✅ Signature valide');
      } else {
        console.error('❌ Signature invalide');
        console.log('  Reçue:', receivedSignature.substring(0, 20) + '...');
        console.log('  Calculée:', calculatedSignature.substring(0, 20) + '...');
      }
      
      return isValid;
      
    } catch (error) {
      console.error('❌ Erreur validation signature:', error);
      return false;
    }
  }

  /**
   * 🔹 ANALYSER LA RÉPONSE DE CYBERSOURCE - MIS À JOUR
   */
  parseResponse(responseParams) {
    console.log('📥 Parsing réponse CyberSource...');
    console.log('  Decision:', responseParams.decision);
    console.log('  Reason Code:', responseParams.reason_code);
    console.log('  Reference Number:', responseParams.req_reference_number);
    
    // ✅ NOUVEAU : Extraire les données personnalisées
    const paymentOption = responseParams.merchant_defined_data1 || 'full';
    const nightsToPay = parseInt(responseParams.merchant_defined_data2) || 0;
    const totalNights = parseInt(responseParams.merchant_defined_data3) || 0;
    
    console.log('💰 Payment Option:', paymentOption);
    console.log('🌙 Nights to Pay:', nightsToPay);
    console.log('📅 Total Nights:', totalNights);

    // Valider la signature
    const isValid = this.validateResponseSignature(responseParams);

    if (!isValid) {
      return {
        success: false,
        error: 'Signature invalide - données potentiellement falsifiées',
        code: 'INVALID_SIGNATURE'
      };
    }

    const decision = responseParams.decision;
    const reasonCode = responseParams.reason_code;

    // Décisions possibles : ACCEPT, DECLINE, REVIEW, ERROR, CANCEL
    if (decision === 'ACCEPT') {
      return {
        success: true,
        transactionId: responseParams.transaction_id,
        reservationId: responseParams.req_reference_number,
        amount: parseFloat(responseParams.req_amount || responseParams.auth_amount || 0),
        currency: responseParams.req_currency,
        cardType: responseParams.req_card_type || 'unknown',
        authCode: responseParams.auth_code,
        message: 'Paiement accepté',
        // ✅ NOUVEAU : Données personnalisées
        paymentOption: paymentOption,
        nightsToPay: nightsToPay,
        totalNights: totalNights,
        rawResponse: responseParams
      };
    } else if (decision === 'DECLINE') {
      return {
        success: false,
        error: this.getDeclineReason(reasonCode),
        code: reasonCode,
        // ✅ NOUVEAU : Données personnalisées même en cas d'échec
        paymentOption: paymentOption,
        nightsToPay: nightsToPay,
        totalNights: totalNights,
        rawResponse: responseParams
      };
    } else if (decision === 'CANCEL') {
      return {
        success: false,
        error: 'Paiement annulé par l\'utilisateur',
        code: 'CANCELLED',
        // ✅ NOUVEAU : Données personnalisées même en cas d'annulation
        paymentOption: paymentOption,
        nightsToPay: nightsToPay,
        totalNights: totalNights,
        rawResponse: responseParams
      };
    } else {
      return {
        success: false,
        error: `Erreur lors du traitement: ${decision}`,
        code: reasonCode || 'UNKNOWN',
        // ✅ NOUVEAU : Données personnalisées même en cas d'erreur
        paymentOption: paymentOption,
        nightsToPay: nightsToPay,
        totalNights: totalNights,
        rawResponse: responseParams
      };
    }
  }

  /**
   * 🔹 RAISONS DE REFUS
   */
  getDeclineReason(reasonCode) {
    const reasons = {
      '100': 'Transaction réussie',
      '102': 'Carte refusée - vérifiez avec votre banque',
      '200': 'Fonds insuffisants',
      '201': 'Carte expirée',
      '202': 'Carte signalée comme perdue ou volée',
      '203': 'Carte invalide',
      '204': 'Montant de transaction dépassé',
      '205': 'Carte non acceptée',
      '207': 'Code CVV invalide',
      '208': 'Carte inactive',
      '210': 'Limite de crédit dépassée',
      '221': 'Transaction annulée',
      '230': 'Transaction refusée par la banque',
      '231': 'Numéro de carte invalide',
      '234': 'Problème technique - réessayez',
      '400': 'Fraude détectée',
      '520': 'Informations manquantes'
    };

    return reasons[reasonCode] || `Transaction refusée (Code: ${reasonCode})`;
  }

  /**
   * 🔹 OBTENIR L'URL DE PAIEMENT
   */
  getPaymentUrl() {
    return this.paymentUrl;
  }

  /**
   * 🔹 VÉRIFIER SI CONFIGURÉ
   */
  isConfigured() {
    const configured = !!(this.profileId && this.accessKey && this.secretKey);
    console.log('🔍 CyberSource configuré:', configured ? 'OUI' : 'NON');
    return configured;
  }

  /**
   * 🔹 GÉNÉRER DES PARAMÈTRES DE SIMULATION (sans clés) - MIS À JOUR
   */
  generateMockParams(data) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    
    // ✅ NOUVEAU : Description selon l'option de paiement
    const paymentDescription = this.getPaymentDescription(data);
    
    return {
      mockMode: true,
      reservationId: data.reservationId,
      amount: data.amount,
      currency: data.currency || 'XAF',
      clientEmail: data.clientEmail,
      clientName: `${data.clientFirstName} ${data.clientLastName}`,
      paymentOption: data.paymentOption || 'full',
      nightsToPay: data.nightsToPay || data.nights || 1,
      totalNights: data.nights || 1,
      paymentDescription: paymentDescription,
      redirectUrl: `${frontendUrl}/payment/mock-callback?reservation=${data.reservationId}&amount=${data.amount}&status=success&paymentOption=${data.paymentOption || 'full'}&nightsToPay=${data.nightsToPay || data.nights || 1}`
    };
  }

  /**
   * 🔹 NOUVEAU : VALIDER LES DONNÉES DE PAIEMENT
   */
  validatePaymentData(data) {
    const errors = [];
    
    if (!data.reservationId) {
      errors.push('ID de réservation manquant');
    }
    
    if (!data.amount || data.amount <= 0) {
      errors.push('Montant invalide');
    }
    
    if (!data.currency) {
      errors.push('Devise manquante');
    }
    
    if (!data.clientEmail) {
      errors.push('Email client manquant');
    }
    
    // ✅ NOUVEAU : Validation des options de paiement
    const validPaymentOptions = ['first-night', 'partial', 'full'];
    if (data.paymentOption && !validPaymentOptions.includes(data.paymentOption)) {
      errors.push('Option de paiement invalide');
    }
    
    if (data.nightsToPay && (data.nightsToPay < 1 || data.nightsToPay > (data.nights || 365))) {
      errors.push('Nombre de nuits à payer invalide');
    }
    
    return {
      isValid: errors.length === 0,
      errors: errors
    };
  }

  /**
   * 🔹 NOUVEAU : FORMATER LES DONNÉES POUR LE LOG
   */
  formatPaymentLog(data) {
    return {
      reservationId: data.reservationId,
      amount: data.amount,
      currency: data.currency,
      paymentOption: data.paymentOption || 'full',
      nightsToPay: data.nightsToPay || 'all',
      totalNights: data.nights || 'unknown',
      clientEmail: data.clientEmail ? `${data.clientEmail.substring(0, 3)}...` : 'unknown',
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = new CybersourceSecureAcceptance();