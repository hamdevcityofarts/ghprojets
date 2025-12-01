// src/routes/paiementRoutes.js - VERSION CORRIGÉE AVEC CALLBACK PUBLIC
const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middlewares/authMiddleware');
const {
  initiatePayment,
  handlePaymentCallback,
  handlePaymentCancel,
  handleMockCallback,
  getPayments,
  getPaymentById,
  getPaymentStats
} = require('../controllers/paiementController');

/**
 * @swagger
 * tags:
 *   name: Paiements Secure Acceptance
 *   description: Gestion des paiements via CyberSource Hosted Checkout
 */

/**
 * ===================================================
 * ROUTES PUBLIQUES - INITIATION PAIEMENT
 * ===================================================
 */

/**
 * @swagger
 * /api/payments/initiate:
 *   post:
 *     summary: Initier un paiement Secure Acceptance
 *     description: Génère les paramètres signés pour rediriger vers la page de paiement CyberSource
 *     tags: [Paiements Secure Acceptance]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reservationId
 *             properties:
 *               reservationId:
 *                 type: string
 *                 description: ID de la réservation
 *               clientInfo:
 *                 type: object
 *                 description: Infos client (si non authentifié)
 *     responses:
 *       200:
 *         description: Paramètres de paiement générés
 */
router.post('/initiate', initiatePayment);

/**
 * ===================================================
 * ROUTES DE CALLBACK - RETOUR CYBERSOURCE (PUBLIC)
 * ===================================================
 * 
 * ⚠️ IMPORTANT: Ces routes DOIVENT être publiques (pas d'authentification)
 * car CyberSource ne peut pas envoyer de token Bearer.
 * La sécurité est assurée par la validation de la signature HMAC.
 */

/**
 * @swagger
 * /api/payments/callback:
 *   post:
 *     summary: Callback après paiement CyberSource (PUBLIC)
 *     description: Reçoit et valide la réponse de CyberSource après paiement. Route PUBLIQUE, sécurisée par signature HMAC.
 *     tags: [Paiements Secure Acceptance]
 *     requestBody:
 *       required: true
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             description: Paramètres retournés par CyberSource (incluant signature)
 *     responses:
 *       200:
 *         description: Paiement traité avec succès
 *       400:
 *         description: Signature invalide ou paramètres manquants
 */
router.post('/callback', handlePaymentCallback);

/**
 * @swagger
 * /api/payments/cancel:
 *   post:
 *     summary: Callback annulation paiement (PUBLIC)
 *     description: Appelé quand l'utilisateur annule le paiement. Route PUBLIQUE.
 *     tags: [Paiements Secure Acceptance]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reservationId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Annulation enregistrée
 */
router.post('/cancel', handlePaymentCancel);

/**
 * ===================================================
 * ROUTE DE SIMULATION (Développement)
 * ===================================================
 */

/**
 * @swagger
 * /api/payments/mock-callback:
 *   get:
 *     summary: Callback simulé (mode développement - PUBLIC)
 *     description: Simule un retour de CyberSource sans clés API
 *     tags: [Paiements Secure Acceptance]
 *     parameters:
 *       - in: query
 *         name: reservationId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         required: true
 *         schema:
 *           type: string
 *           enum: [success, declined, cancelled]
 *     responses:
 *       200:
 *         description: Simulation traitée
 */
router.get('/mock-callback', handleMockCallback);

/**
 * ===================================================
 * ROUTES ADMINISTRATIVES (PROTÉGÉES)
 * ===================================================
 */

/**
 * @swagger
 * /api/payments:
 *   get:
 *     summary: Obtenir tous les paiements (Admin)
 *     tags: [Paiements Secure Acceptance]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des paiements
 *       401:
 *         description: Non authentifié
 *       403:
 *         description: Accès réservé aux administrateurs
 */
router.get('/', protect, admin, getPayments);

/**
 * @swagger
 * /api/payments/stats:
 *   get:
 *     summary: Statistiques des paiements (Admin)
 *     tags: [Paiements Secure Acceptance]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Statistiques
 *       401:
 *         description: Non authentifié
 *       403:
 *         description: Accès réservé aux administrateurs
 */
router.get('/stats', protect, admin, getPaymentStats);

/**
 * @swagger
 * /api/payments/{id}:
 *   get:
 *     summary: Obtenir un paiement par ID
 *     tags: [Paiements Secure Acceptance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Détails du paiement
 *       401:
 *         description: Non authentifié
 */
router.get('/:id', protect, getPaymentById);

module.exports = router;