// controllers/paiementController.js - VERSION MISE À JOUR AVEC PAIEMENT PARTIEL
const User = require('../models/userModel');
const bcrypt = require('bcryptjs');

const Payment = require('../models/Payment');
const Reservation = require('../models/reservationModel');
const CybersourceSecure = require('../config/cybersourceSecureAcceptance');

/**
 * 🔹 INITIER UN PAIEMENT - GÉNÈRE LES PARAMÈTRES SIGNÉS
 * Route: POST /api/payments/initiate (Public ou Authentifié)
 */
exports.initiatePayment = async (req, res) => {
  try {
    const { reservationId, clientInfo } = req.body;

    console.log('🔹 Initiation paiement Secure Acceptance:', { reservationId });

    // Validation
    if (!reservationId) {
      return res.status(400).json({
        success: false,
        message: 'ID de réservation requis'
      });
    }

    // Vérifier la réservation
    const reservation = await Reservation.findById(reservationId)
      .populate('chambre')
      .populate('client');

    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: 'Réservation non trouvée'
      });
    }

    // ✅ NOUVEAU : Vérifier que la réservation n'est pas déjà payée ou partiellement payée
    if (reservation.status === 'confirmed' || reservation.status === 'partially_paid') {
      return res.status(400).json({
        success: false,
        message: 'Cette réservation est déjà confirmée ou partiellement payée'
      });
    }

    // Préparer les informations client
    let clientFirstName, clientLastName, clientEmail, clientPhone, clientAddress, clientCity;

    if (reservation.client) {
      // Client connecté
      clientFirstName = reservation.client.surname;
      clientLastName = reservation.client.name;
      clientEmail = reservation.client.email;
      clientPhone = reservation.client.phone || '';
      clientAddress = reservation.client.address || 'N/A';
      clientCity = 'Douala';
    } else if (clientInfo) {
      // Client non connecté (fourni dans la requête)
      clientFirstName = clientInfo.surname;
      clientLastName = clientInfo.name;
      clientEmail = clientInfo.email;
      clientPhone = clientInfo.phone || '';
      clientAddress = 'N/A';
      clientCity = 'Douala';
    } else if (reservation.clientInfo) {
      // Client non connecté (déjà dans la réservation)
      clientFirstName = reservation.clientInfo.surname;
      clientLastName = reservation.clientInfo.name;
      clientEmail = reservation.clientInfo.email;
      clientPhone = reservation.clientInfo.phone || '';
      clientAddress = 'N/A';
      clientCity = 'Douala';
    } else {
      return res.status(400).json({
        success: false,
        message: 'Informations client requises'
      });
    }

    // Données pour Cybersource
    const paymentData = {
      reservationId: reservation._id.toString(),
      amount: reservation.totalAmount,
      currency: 'XAF',
      clientFirstName,
      clientLastName,
      clientEmail,
      clientPhone,
      clientAddress,
      clientCity,
      checkIn: new Date(reservation.checkIn).toISOString().split('T')[0],
      checkOut: new Date(reservation.checkOut).toISOString().split('T')[0],
      roomName: reservation.chambre?.name || 'Chambre',
      nights: reservation.nights || 1,
      // ✅ NOUVEAU : Informations sur l'option de paiement
      paymentOption: reservation.paymentOption,
      nightsToPay: reservation.nightsToPay
    };

    // Vérifier si Cybersource est configuré
    if (!CybersourceSecure.isConfigured()) {
      console.log('⚠️ Mode simulation - Clés CyberSource non configurées');
      
      // Retourner des paramètres de simulation
      const mockParams = CybersourceSecure.generateMockParams(paymentData);
      
      return res.json({
        success: true,
        mockMode: true,
        message: 'Mode simulation activé',
        paymentUrl: null,
        params: mockParams,
        // ✅ NOUVEAU : Informations supplémentaires
        paymentOption: reservation.paymentOption,
        nightsToPay: reservation.nightsToPay,
        totalNights: reservation.nights
      });
    }

    // Générer les paramètres signés pour Cybersource
    const paymentParams = CybersourceSecure.generatePaymentParams(paymentData);
    const paymentUrl = CybersourceSecure.getPaymentUrl();

    console.log('✅ Paramètres de paiement générés');
    console.log('💰 Option de paiement:', reservation.paymentOption);
    console.log('🌙 Nuits à payer:', reservation.nightsToPay, '/', reservation.nights);

    // ✅ NOUVEAU : Déterminer le type de paiement selon l'option
    let paymentType = 'full';
    if (reservation.paymentOption === 'first-night' || reservation.paymentOption === 'partial') {
      paymentType = 'deposit';
    }

    // Créer un enregistrement de paiement en attente
    const payment = await Payment.create({
      reservation: reservationId,
      client: reservation.client?._id || null,
      clientInfo: reservation.client ? null : {
        name: clientLastName,
        surname: clientFirstName,
        email: clientEmail,
        phone: clientPhone
      },
      amount: reservation.totalAmount,
      currency: 'XAF',
      type: paymentType, // ✅ Type dynamique selon l'option
      method: 'card',
      status: 'pending',
      transactionId: paymentParams.transaction_uuid,
      gateway: 'cybersource',
      // ✅ NOUVEAU : Informations supplémentaires pour le suivi
      paymentOption: reservation.paymentOption,
      nightsPaid: reservation.nightsToPay
    });

    console.log('✅ Paiement en attente créé:', payment._id);

    // Retourner les paramètres pour le frontend
    res.json({
      success: true,
      mockMode: false,
      paymentUrl: paymentUrl,
      params: paymentParams,
      paymentId: payment._id,
      // ✅ NOUVEAU : Informations supplémentaires
      paymentOption: reservation.paymentOption,
      nightsToPay: reservation.nightsToPay,
      totalNights: reservation.nights,
      amount: reservation.totalAmount
    });

  } catch (error) {
    console.error('❌ Erreur initiation paiement:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Erreur lors de l\'initiation du paiement'
    });
  }
};

/**
 * 🔹 CALLBACK APRÈS PAIEMENT - VALIDE ET REDIRIGE VERS LE FRONTEND
 * Route: POST /api/payments/callback
 */
exports.handlePaymentCallback = async (req, res) => {
  try {
    const responseParams = req.body;

    console.log('🔹 Callback paiement reçu');
    
    // Parser et valider la réponse
    const paymentResult = CybersourceSecure.parseResponse(responseParams);
    console.log('✅ Données CyberSource:', paymentResult);
    
    // URL du frontend
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    
    // ❌ CAS 1: PAIEMENT ÉCHOUÉ
    if (!paymentResult.success) {
      console.error('❌ Paiement échoué:', paymentResult.error);
      
      // Mettre à jour le paiement comme échoué
      if (responseParams.req_reference_number) {
        await Payment.findOneAndUpdate(
          { 
            reservation: responseParams.req_reference_number,
            status: 'pending'
          },
          {
            status: 'failed',
            gatewayResponse: paymentResult.rawResponse
          }
        );
      }

      // ✅ REDIRECTION vers page d'erreur frontend
      const errorMessage = encodeURIComponent(paymentResult.error);
      const errorCode = paymentResult.code || 'UNKNOWN';
      
      return res.redirect(
        `${frontendUrl}/payment/result?status=error&message=${errorMessage}&code=${errorCode}`
      );
    }

    console.log('✅ Paiement validé:', paymentResult.transactionId);

    // Récupérer la réservation
    const reservation = await Reservation.findById(paymentResult.reservationId)
      .populate('chambre');

    if (!reservation) {
      console.error('❌ Réservation non trouvée:', paymentResult.reservationId);
      
      const errorMessage = encodeURIComponent('Réservation non trouvée');
      return res.redirect(
        `${frontendUrl}/payment/result?status=error&message=${errorMessage}&code=RESERVATION_NOT_FOUND`
      );
    }

    // Mettre à jour le paiement
    const payment = await Payment.findOneAndUpdate(
      {
        reservation: paymentResult.reservationId,
        status: 'pending'
      },
      {
        status: 'completed',
        transactionId: paymentResult.transactionId,
        gatewayResponse: paymentResult.rawResponse,
        cardBrand: paymentResult.cardType
      },
      { new: true }
    );

    // ✅ NOUVEAU : Déterminer le statut selon l'option de paiement
    let reservationStatus = 'confirmed';
    if (reservation.paymentOption !== 'full') {
      reservationStatus = 'partially_paid';
    }

    // Mettre à jour la réservation
    reservation.status = reservationStatus;
    reservation.paiement = {
      amount: paymentResult.amount,
      currency: paymentResult.currency,
      paidAt: new Date(),
      method: 'card',
      status: 'paid',
      transactionId: paymentResult.transactionId
    };
    reservation.amountPaid = paymentResult.amount;
    await reservation.save();

    console.log('✅ Réservation mise à jour:', reservation._id);
    console.log('💰 Option de paiement:', reservation.paymentOption);
    console.log('🌙 Nuits payées:', reservation.nightsToPay, '/', reservation.nights);
    console.log('💵 Montant payé:', reservation.amountPaid, 'XAF');

    // TODO: Envoyer email de confirmation
    // await sendConfirmationEmail(reservation, payment);

    // ✅ CAS 2: PAIEMENT RÉUSSI - REDIRECTION vers page de succès frontend
    return res.redirect(
      `${frontendUrl}/payment/result?status=success&reservation=${reservation._id}&transaction=${paymentResult.transactionId}&amount=${paymentResult.amount}&paymentOption=${reservation.paymentOption}&nightsPaid=${reservation.nightsToPay}&totalNights=${reservation.nights}`
    );

  } catch (error) {
    console.error('❌ Erreur callback paiement:', error);
    
    // ✅ REDIRECTION vers page d'erreur en cas d'exception
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const errorMessage = encodeURIComponent(error.message || 'Erreur lors du traitement du paiement');
    
    return res.redirect(
      `${frontendUrl}/payment/result?status=error&message=${errorMessage}&code=SERVER_ERROR`
    );
  }
};

/**
 * 🔹 CALLBACK ANNULATION - REDIRIGE VERS LE FRONTEND
 * Route: POST /api/payments/cancel
 */
exports.handlePaymentCancel = async (req, res) => {
  try {
    const responseParams = req.body;
    const reservationId = responseParams.req_reference_number;

    console.log('🔹 Paiement annulé par l\'utilisateur:', reservationId);

    // Mettre à jour le paiement comme annulé
    if (reservationId) {
      await Payment.findOneAndUpdate(
        { 
          reservation: reservationId,
          status: 'pending'
        },
        {
          status: 'failed',
          gatewayResponse: { cancelled: true, ...responseParams }
        }
      );
    }

    // ✅ REDIRECTION vers page d'annulation frontend
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    
    return res.redirect(
      `${frontendUrl}/payment/cancel?reservation=${reservationId || ''}`
    );

  } catch (error) {
    console.error('❌ Erreur annulation:', error);
    
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    return res.redirect(`${frontendUrl}/payment/cancel`);
  }
};

/**
 * 🔹 SIMULATION PAIEMENT (Développement sans clés) - MIS À JOUR
 * Route: POST /api/payments/mock-callback
 */
exports.handleMockCallback = async (req, res) => {
  try {
    const { reservationId, status } = req.query;

    console.log('🔧 Callback simulé:', { reservationId, status });

    if (status !== 'success') {
      return res.json({
        success: false,
        message: 'Paiement simulé refusé',
        code: 'MOCK_DECLINED'
      });
    }

    // Récupérer la réservation
    const reservation = await Reservation.findById(reservationId)
      .populate('chambre');

    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: 'Réservation non trouvée'
      });
    }

    // ✅ NOUVEAU : Déterminer le type de paiement selon l'option
    let paymentType = 'full';
    if (reservation.paymentOption === 'first-night' || reservation.paymentOption === 'partial') {
      paymentType = 'deposit';
    }

    // Créer/mettre à jour le paiement simulé
    const mockTransactionId = `MOCK-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

    const payment = await Payment.findOneAndUpdate(
      { 
        reservation: reservationId,
        status: 'pending'
      },
      {
        status: 'completed',
        transactionId: mockTransactionId,
        gateway: 'mock',
        gatewayResponse: { mockMode: true },
        type: paymentType, // ✅ Type dynamique selon l'option
        paymentOption: reservation.paymentOption,
        nightsPaid: reservation.nightsToPay
      },
      { 
        new: true,
        upsert: true,
        setDefaultsOnInsert: true
      }
    );

    // ✅ NOUVEAU : Déterminer le statut selon l'option de paiement
    let reservationStatus = 'confirmed';
    if (reservation.paymentOption !== 'full') {
      reservationStatus = 'partially_paid';
    }

    // Mettre à jour la réservation
    reservation.status = reservationStatus;
    reservation.paiement = {
      amount: reservation.totalAmount,
      currency: 'XAF',
      paidAt: new Date(),
      method: 'card',
      status: 'paid',
      transactionId: mockTransactionId
    };
    reservation.amountPaid = reservation.totalAmount;
    await reservation.save();

    console.log('✅ Paiement simulé confirmé');
    console.log('💰 Option de paiement:', reservation.paymentOption);
    console.log('🌙 Nuits payées:', reservation.nightsToPay, '/', reservation.nights);

    res.json({
      success: true,
      message: 'Paiement simulé avec succès',
      mockMode: true,
      reservationId: reservation._id,
      transactionId: mockTransactionId,
      // ✅ NOUVEAU : Informations supplémentaires
      paymentOption: reservation.paymentOption,
      nightsPaid: reservation.nightsToPay,
      totalNights: reservation.nights
    });

  } catch (error) {
    console.error('❌ Erreur simulation:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * 🔹 OBTENIR TOUS LES PAIEMENTS (Admin) - MIS À JOUR
 */
exports.getPayments = async (req, res) => {
  try {
    const payments = await Payment.find()
      .populate('reservation')
      .populate('client', 'name surname email')
      .sort({ createdAt: -1 });

    // ✅ NOUVEAU : Ajouter des statistiques sur les types de paiement
    const paymentStats = await Payment.aggregate([
      {
        $match: {
          status: 'completed'
        }
      },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      }
    ]);

    res.json({
      success: true,
      count: payments.length,
      payments,
      // ✅ NOUVEAU : Statistiques par type de paiement
      paymentStats: paymentStats.reduce((acc, stat) => {
        acc[stat._id] = { count: stat.count, totalAmount: stat.totalAmount };
        return acc;
      }, {})
    });
  } catch (error) {
    console.error('❌ Erreur récupération paiements:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des paiements'
    });
  }
};

/**
 * 🔹 OBTENIR UN PAIEMENT PAR ID - MIS À JOUR
 */
exports.getPaymentById = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id)
      .populate('reservation')
      .populate('client', 'name surname email');

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Paiement non trouvé'
      });
    }

    // Vérifier les permissions (admin ou propriétaire)
    const isAdmin = req.user?.role === 'admin';
    const isOwner = payment.client?._id.toString() === req.user?._id.toString();
    
    if (!isAdmin && !isOwner) {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé'
      });
    }

    res.json({
      success: true,
      payment,
      // ✅ NOUVEAU : Informations supplémentaires sur l'option de paiement
      paymentDetails: {
        paymentOption: payment.paymentOption,
        nightsPaid: payment.nightsPaid,
        type: payment.type
      }
    });
  } catch (error) {
    console.error('❌ Erreur récupération paiement:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du paiement'
    });
  }
};

/**
 * 🔹 STATISTIQUES PAIEMENTS (Admin) - MIS À JOUR
 */
exports.getPaymentStats = async (req, res) => {
  try {
    const stats = await Payment.aggregate([
      {
        $match: {
          status: 'completed'
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$amount' },
          totalTransactions: { $sum: 1 },
          averageTransaction: { $avg: '$amount' },
          // ✅ NOUVEAU : Statistiques par type de paiement
          fullPayments: {
            $sum: {
              $cond: [{ $eq: ['$type', 'full'] }, 1, 0]
            }
          },
          depositPayments: {
            $sum: {
              $cond: [{ $eq: ['$type', 'deposit'] }, 1, 0]
            }
          },
          fullRevenue: {
            $sum: {
              $cond: [{ $eq: ['$type', 'full'] }, '$amount', 0]
            }
          },
          depositRevenue: {
            $sum: {
              $cond: [{ $eq: ['$type', 'deposit'] }, '$amount', 0]
            }
          }
        }
      }
    ]);

    const result = stats[0] || { 
      totalRevenue: 0, 
      totalTransactions: 0, 
      averageTransaction: 0,
      fullPayments: 0,
      depositPayments: 0,
      fullRevenue: 0,
      depositRevenue: 0
    };

    res.json({
      success: true,
      stats: result
    });
  } catch (error) {
    console.error('❌ Erreur statistiques:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des statistiques'
    });
  }
};

/**
 * 🔹 NOUVEAU : OBTENIR LES PAIEMENTS PAR RÉSERVATION
 * Route: GET /api/payments/reservation/:reservationId
 */
exports.getPaymentsByReservation = async (req, res) => {
  try {
    const { reservationId } = req.params;

    const payments = await Payment.find({ reservation: reservationId })
      .populate('client', 'name surname email')
      .sort({ createdAt: -1 });

    const reservation = await Reservation.findById(reservationId)
      .populate('chambre');

    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: 'Réservation non trouvée'
      });
    }

    res.json({
      success: true,
      count: payments.length,
      payments,
      reservationDetails: {
        totalNights: reservation.nights,
        nightsToPay: reservation.nightsToPay,
        paymentOption: reservation.paymentOption,
        amountPaid: reservation.amountPaid,
        totalAmount: reservation.totalAmount
      }
    });
  } catch (error) {
    console.error('❌ Erreur récupération paiements par réservation:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des paiements'
    });
  }
};

/**
 * 🔹 CRÉER UN COMPTE CLIENT AUTOMATIQUEMENT
 */
async function createAutoClientAccount(clientInfo, reservationId) {
  try {
    console.log('🔹 Création automatique de compte client:', clientInfo.email);

    // Vérifier si l'utilisateur existe déjà
    const existingUser = await User.findOne({ email: clientInfo.email.toLowerCase() });
    if (existingUser) {
      console.log('✅ Utilisateur existe déjà:', existingUser._id);
      return {
        success: true,
        user: existingUser,
        isNew: false,
        credentials: null
      };
    }

    // Générer un mot de passe sécurisé
    const generatedPassword = Math.random().toString(36).slice(-8) + 'A1!';
    
    // Créer le nouvel utilisateur
    const newUser = await User.create({
      name: clientInfo.name,
      surname: clientInfo.surname,
      email: clientInfo.email.toLowerCase(),
      phone: clientInfo.phone || '',
      password: generatedPassword,
      role: 'client',
      status: 'actif',
      permissions: [],
      memberSince: new Date()
    });

    console.log('✅ Nouveau client créé:', newUser._id);

    return {
      success: true,
      user: newUser,
      isNew: true,
      credentials: {
        email: newUser.email,
        password: generatedPassword,
        userId: newUser._id
      }
    };
  } catch (error) {
    console.error('❌ Erreur création compte automatique:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 🔹 MODIFICATION de handlePaymentCallback pour créer le compte automatiquement
 */
exports.handlePaymentCallback = async (req, res) => {
  try {
    const responseParams = req.body;

    console.log('🔹 Callback paiement reçu');
    
    // Parser et valider la réponse
    const paymentResult = CybersourceSecure.parseResponse(responseParams);
    console.log('✅ Données CyberSource:', paymentResult);
    
    // URL du frontend
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    
    // ❌ CAS 1: PAIEMENT ÉCHOUÉ
    if (!paymentResult.success) {
      console.error('❌ Paiement échoué:', paymentResult.error);
      
      // Mettre à jour le paiement comme échoué
      if (responseParams.req_reference_number) {
        await Payment.findOneAndUpdate(
          { 
            reservation: responseParams.req_reference_number,
            status: 'pending'
          },
          {
            status: 'failed',
            gatewayResponse: paymentResult.rawResponse
          }
        );
      }

      const errorMessage = encodeURIComponent(paymentResult.error);
      const errorCode = paymentResult.code || 'UNKNOWN';
      
      return res.redirect(
        `${frontendUrl}/payment/result?status=error&message=${errorMessage}&code=${errorCode}`
      );
    }

    console.log('✅ Paiement validé:', paymentResult.transactionId);

    // Récupérer la réservation
    const reservation = await Reservation.findById(paymentResult.reservationId)
      .populate('chambre');

    if (!reservation) {
      console.error('❌ Réservation non trouvée:', paymentResult.reservationId);
      
      const errorMessage = encodeURIComponent('Réservation non trouvée');
      return res.redirect(
        `${frontendUrl}/payment/result?status=error&message=${errorMessage}&code=RESERVATION_NOT_FOUND`
      );
    }

    // ✅ NOUVEAU : CRÉATION AUTOMATIQUE DU COMPTE CLIENT
    let autoAccountResult = null;
    let userCredentials = null;

    if (!reservation.client && reservation.clientInfo) {
      console.log('👤 Création automatique de compte pour client non connecté');
      
      autoAccountResult = await createAutoClientAccount(
        reservation.clientInfo, 
        reservation._id
      );

      if (autoAccountResult.success && autoAccountResult.isNew) {
        userCredentials = autoAccountResult.credentials;
        
        // Associer le nouvel utilisateur à la réservation
        reservation.client = autoAccountResult.user._id;
        console.log('✅ Compte client associé à la réservation');
      }
    }

    // Mettre à jour le paiement
    const payment = await Payment.findOneAndUpdate(
      {
        reservation: paymentResult.reservationId,
        status: 'pending'
      },
      {
        status: 'completed',
        transactionId: paymentResult.transactionId,
        gatewayResponse: paymentResult.rawResponse,
        cardBrand: paymentResult.cardType,
        // ✅ Stocker les infos de création automatique
        autoAccountCreated: !!userCredentials,
        autoAccountUserId: userCredentials ? autoAccountResult.user._id : null
      },
      { new: true }
    );

    // Déterminer le statut selon l'option de paiement
    let reservationStatus = 'confirmed';
    if (reservation.paymentOption !== 'full') {
      reservationStatus = 'partially_paid';
    }

    // Mettre à jour la réservation
    reservation.status = reservationStatus;
    reservation.paiement = {
      amount: paymentResult.amount,
      currency: paymentResult.currency,
      paidAt: new Date(),
      method: 'card',
      status: 'paid',
      transactionId: paymentResult.transactionId
    };
    reservation.amountPaid = paymentResult.amount;
    
    await reservation.save();

    console.log('✅ Réservation mise à jour:', reservation._id);
    console.log('💰 Option de paiement:', reservation.paymentOption);
    console.log('🌙 Nuits payées:', reservation.nightsToPay, '/', reservation.nights);

    // ✅ NOUVEAU : Préparer les paramètres de redirection avec les identifiants
    const successParams = new URLSearchParams({
      status: 'success',
      reservation: reservation._id.toString(),
      transaction: paymentResult.transactionId,
      amount: paymentResult.amount,
      paymentOption: reservation.paymentOption,
      nightsPaid: reservation.nightsToPay,
      totalNights: reservation.nights
    });

    // Ajouter les identifiants si nouveau compte créé
    if (userCredentials) {
      successParams.append('autoAccount', 'true');
      successParams.append('clientEmail', userCredentials.email);
      successParams.append('clientPassword', userCredentials.password);
      successParams.append('clientId', userCredentials.userId.toString());
      
      console.log('🔐 Identifiants générés pour:', userCredentials.email);
    }

    // ✅ REDIRECTION vers page de succès avec tous les paramètres
    return res.redirect(
      `${frontendUrl}/payment/result?${successParams.toString()}`
    );

  } catch (error) {
    console.error('❌ Erreur callback paiement:', error);
    
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const errorMessage = encodeURIComponent(error.message || 'Erreur lors du traitement du paiement');
    
    return res.redirect(
      `${frontendUrl}/payment/result?status=error&message=${errorMessage}&code=SERVER_ERROR`
    );
  }
};