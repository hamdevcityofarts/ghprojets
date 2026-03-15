// routes/paiementRoutes.js - NOUVELLE VERSION SECURE ACCEPTANCE
const express = require('express');
const router = express.Router();
const { protect, admin, optionalAuth } = require('../middlewares/authMiddleware');
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
 *                 properties:
 *                   name:
 *                     type: string
 *                   surname:
 *                     type: string
 *                   email:
 *                     type: string
 *                   phone:
 *                     type: string
 *     responses:
 *       200:
 *         description: Paramètres de paiement générés
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 paymentUrl:
 *                   type: string
 *                   description: URL de la page de paiement CyberSource
 *                 params:
 *                   type: object
 *                   description: Paramètres signés à soumettre
 *                 paymentId:
 *                   type: string
 *                   description: ID du paiement créé
 */
router.post('/initiate', initiatePayment);

/**
 * ===================================================
 * ROUTES DE CALLBACK - RETOUR CYBERSOURCE
 * ===================================================
 */

/**
 * @swagger
 * /api/payments/callback:
 *   post:
 *     summary: Callback après paiement CyberSource
 *     description: Reçoit et valide la réponse de CyberSource après paiement
 *     tags: [Paiements Secure Acceptance]
 *     requestBody:
 *       required: true
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             description: Paramètres retournés par CyberSource
 *     responses:
 *       200:
 *         description: Paiement traité
 */
router.post('/callback', handlePaymentCallback);

/**
 * @swagger
 * /api/payments/cancel:
 *   post:
 *     summary: Callback annulation paiement
 *     description: Appelé quand l'utilisateur annule le paiement
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
 *     summary: Callback simulé (mode développement)
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
 * ROUTES ADMINISTRATIVES
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
 */
router.get('/:id', protect, getPaymentById);

module.exports = router;