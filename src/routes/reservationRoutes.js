const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middlewares/authMiddleware');
const {
  createReservation,
  getReservations,
  getReservationById,
  updateReservation,
  cancelReservation,
  confirmReservation,
  createReservationPublic // ✅ AJOUTER CET IMPORT
} = require('../controllers/reservationController');

/**
 * @swagger
 * tags:
 *   name: Réservations
 *   description: Gestion des réservations
 */

/**
 * @swagger
 * /api/reservations:
 *   get:
 *     summary: Obtenir toutes les réservations
 *     tags: [Réservations]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des réservations
 *       401:
 *         description: Non autorisé
 */
router.get('/', protect, getReservations);

/**
 * @swagger
 * /api/reservations:
 *   post:
 *     summary: Créer une nouvelle réservation
 *     tags: [Réservations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - chambreId
 *               - checkIn
 *               - checkOut
 *             properties:
 *               chambreId:
 *                 type: string
 *               checkIn:
 *                 type: string
 *                 format: date
 *               checkOut:
 *                 type: string
 *                 format: date
 *               guests:
 *                 type: number
 *               specialRequests:
 *                 type: string
 *               adults:
 *                 type: number
 *               children:
 *                 type: number
 *     responses:
 *       201:
 *         description: Réservation créée
 *       400:
 *         description: Données invalides
 */
router.post('/', protect, createReservation);

/**
 * @swagger
 * /api/reservations/{id}:
 *   get:
 *     summary: Obtenir une réservation par ID
 *     tags: [Réservations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *     responses:
 *       200:
 *         description: Réservation trouvée
 *       404:
 *         description: Réservation non trouvée
 */
router.get('/:id', protect, getReservationById);

/**
 * @swagger
 * /api/reservations/{id}:
 *   put:
 *     summary: Modifier une réservation
 *     tags: [Réservations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Réservation modifiée
 *       404:
 *         description: Réservation non trouvée
 */
router.put('/:id', protect, updateReservation);

/**
 * @swagger
 * /api/reservations/{id}/annuler:
 *   put:
 *     summary: Annuler une réservation
 *     tags: [Réservations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *     responses:
 *       200:
 *         description: Réservation annulée
 *       404:
 *         description: Réservation non trouvée
 */
router.put('/:id/annuler', protect, cancelReservation);

/**
 * @swagger
 * /api/reservations/{id}/cancel:
 *   put:
 *     summary: Annuler une réservation (alias anglais)
 *     tags: [Réservations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *     responses:
 *       200:
 *         description: Réservation annulée
 *       404:
 *         description: Réservation non trouvée
 */
router.put('/:id/cancel', protect, cancelReservation);

// routes/reservationRoutes.js - AJOUTER CETTE ROUTE
/**
 * @swagger
 * /api/reservations/public:
 *   post:
 *     summary: Créer une réservation publique (sans authentification)
 *     tags: [Réservations]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - chambreId
 *               - checkIn
 *               - checkOut
 *               - clientInfo
 *             properties:
 *               chambreId:
 *                 type: string
 *               checkIn:
 *                 type: string
 *                 format: date
 *               checkOut:
 *                 type: string
 *                 format: date
 *               guests:
 *                 type: number
 *               specialRequests:
 *                 type: string
 *               adults:
 *                 type: number
 *               children:
 *                 type: number
 *               clientInfo:
 *                 type: object
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
 *       201:
 *         description: Réservation créée
 *       400:
 *         description: Données invalides
 */
router.post('/public', createReservationPublic); // À créer dans le controller


module.exports = router;