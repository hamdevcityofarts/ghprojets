const express = require('express');
const router = express.Router();
const reservationController = require('../controllers/reservationController');
const { protect, admin } = require('../middlewares/authMiddleware');

/**
 * @swagger
 * components:
 *   schemas:
 *     Reservation:
 *       type: object
 *       required:
 *         - chambre
 *         - checkIn
 *         - checkOut
 *         - guests
 *         - totalAmount
 *       properties:
 *         _id:
 *           type: string
 *           description: ID auto-généré de la réservation
 *         client:
 *           type: string
 *           description: ID de l'utilisateur client
 *         chambre:
 *           type: string
 *           description: ID de la chambre réservée
 *         checkIn:
 *           type: string
 *           format: date
 *           description: Date d'arrivée
 *         checkOut:
 *           type: string
 *           format: date
 *           description: Date de départ
 *         nights:
 *           type: number
 *           description: Nombre de nuits
 *         guests:
 *           type: number
 *           description: Nombre total d'invités
 *         adults:
 *           type: number
 *           description: Nombre d'adultes
 *         children:
 *           type: number
 *           description: Nombre d'enfants
 *         totalAmount:
 *           type: number
 *           description: Montant total de la réservation
 *         currency:
 *           type: string
 *           enum: [XAF]
 *           default: XAF
 *         paymentOption:
 *           type: string
 *           enum: [first-night, partial, full]
 *           description: Option de paiement
 *         nightsToPay:
 *           type: number
 *           description: Nombre de nuits à payer
 *         status:
 *           type: string
 *           enum: [pending, pending_payment, confirmed, cancelled, completed, payment_failed, partially_paid]
 *           description: Statut de la réservation
 *         specialRequests:
 *           type: string
 *           description: Demandes spéciales du client
 *         source:
 *           type: string
 *           enum: [website, public_website, admin]
 *           description: Source de la réservation
 *         paiement:
 *           type: object
 *           properties:
 *             amount:
 *               type: number
 *             currency:
 *               type: string
 *             status:
 *               type: string
 *               enum: [pending, paid, failed, refunded]
 *             method:
 *               type: string
 *               enum: [card, cash, transfer, check]
 *         clientInfo:
 *           type: object
 *           properties:
 *             name:
 *               type: string
 *             surname:
 *               type: string
 *             email:
 *               type: string
 *             phone:
 *               type: string
 *       example:
 *         _id: 507f1f77bcf86cd799439011
 *         chambre: 507f1f77bcf86cd799439012
 *         checkIn: 2024-12-01
 *         checkOut: 2024-12-05
 *         nights: 4
 *         guests: 2
 *         adults: 2
 *         children: 0
 *         totalAmount: 120000
 *         currency: XAF
 *         paymentOption: full
 *         nightsToPay: 4
 *         status: confirmed
 *         specialRequests: "Lit bébé si possible"
 *         source: website
 * 
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 * 
 *   parameters:
 *     reservationId:
 *       in: path
 *       name: id
 *       required: true
 *       schema:
 *         type: string
 *       description: ID de la réservation
 * 
 *   responses:
 *     Unauthorized:
 *       description: Token d'authentification manquant ou invalide
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               success:
 *                 type: boolean
 *                 example: false
 *               message:
 *                 type: string
 *                 example: "Non autorisé, aucun token fourni"
 * 
 *     Forbidden:
 *       description: Accès refusé - droits insuffisants
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               success:
 *                 type: boolean
 *                 example: false
 *               message:
 *                 type: string
 *                 example: "Accès refusé. Droits administrateur requis."
 * 
 *     NotFound:
 *       description: Ressource non trouvée
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               success:
 *                 type: boolean
 *                 example: false
 *               message:
 *                 type: string
 *                 example: "Réservation non trouvée"
 */

/**
 * @swagger
 * /api/reservations:
 *   post:
 *     summary: Créer une nouvelle réservation (utilisateur authentifié)
 *     tags: [Reservations]
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
 *                 description: ID de la chambre
 *               checkIn:
 *                 type: string
 *                 format: date
 *                 example: "2024-12-01"
 *               checkOut:
 *                 type: string
 *                 format: date
 *                 example: "2024-12-05"
 *               adults:
 *                 type: number
 *                 default: 1
 *               children:
 *                 type: number
 *                 default: 0
 *               guests:
 *                 type: number
 *               specialRequests:
 *                 type: string
 *               paymentMethod:
 *                 type: string
 *                 enum: [card, cash, transfer, check]
 *                 default: card
 *               paymentOption:
 *                 type: string
 *                 enum: [first-night, partial, full]
 *                 default: full
 *               nightsToPay:
 *                 type: number
 *                 description: Nombre de nuits à payer (pour l'option partial)
 *     responses:
 *       201:
 *         description: Réservation créée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Réservation créée avec succès. Redirection vers le paiement."
 *                 reservation:
 *                   $ref: '#/components/schemas/Reservation'
 *                 payment:
 *                   type: object
 *                   description: Données pour le paiement CyberSource
 *       400:
 *         description: Données invalides ou chambre non disponible
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: Chambre non trouvée
 *       500:
 *         description: Erreur serveur
 */
router.post('/', protect, reservationController.createReservation);

/**
 * @swagger
 * /api/reservations:
 *   get:
 *     summary: Récupérer la liste des réservations
 *     tags: [Reservations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Numéro de page pour la pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Nombre d'éléments par page
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, pending_payment, confirmed, cancelled, completed, payment_failed, partially_paid]
 *         description: Filtrer par statut
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Rechercher par nom client ou numéro de chambre
 *     responses:
 *       200:
 *         description: Liste des réservations récupérée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 count:
 *                   type: number
 *                   example: 5
 *                 reservations:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Reservation'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         description: Erreur serveur
 */
router.get('/', protect, reservationController.getReservations);

/**
 * @swagger
 * /api/reservations/{id}:
 *   get:
 *     summary: Récupérer une réservation par son ID
 *     tags: [Reservations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/reservationId'
 *     responses:
 *       200:
 *         description: Réservation récupérée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 reservation:
 *                   $ref: '#/components/schemas/Reservation'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Accès non autorisé à cette réservation
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         description: Erreur serveur
 */
router.get('/:id', protect, reservationController.getReservationById);

/**
 * @swagger
 * /api/reservations/{id}:
 *   put:
 *     summary: Mettre à jour une réservation
 *     tags: [Reservations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/reservationId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               checkIn:
 *                 type: string
 *                 format: date
 *               checkOut:
 *                 type: string
 *                 format: date
 *               adults:
 *                 type: number
 *               children:
 *                 type: number
 *               specialRequests:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [pending, pending_payment, confirmed, cancelled, completed, payment_failed, partially_paid]
 *     responses:
 *       200:
 *         description: Réservation mise à jour avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Réservation mise à jour avec succès"
 *                 reservation:
 *                   $ref: '#/components/schemas/Reservation'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Accès non autorisé
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         description: Erreur serveur
 */
router.put('/:id', protect, reservationController.updateReservation);

/**
 * @swagger
 * /api/reservations/{id}/cancel:
 *   put:
 *     summary: Annuler une réservation
 *     tags: [Reservations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/reservationId'
 *     responses:
 *       200:
 *         description: Réservation annulée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Réservation annulée avec succès"
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Accès non autorisé
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         description: Erreur serveur
 */
router.put('/:id/cancel', protect, reservationController.cancelReservation);

/**
 * @swagger
 * /api/reservations/{id}/confirm:
 *   put:
 *     summary: Confirmer une réservation (admin uniquement)
 *     tags: [Reservations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/reservationId'
 *     responses:
 *       200:
 *         description: Réservation confirmée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Réservation confirmée avec succès"
 *                 reservation:
 *                   $ref: '#/components/schemas/Reservation'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         description: Erreur serveur
 */
router.put('/:id/confirm', protect, admin, reservationController.confirmReservation);

/**
 * @swagger
 * /api/reservations/{id}:
 *   delete:
 *     summary: Supprimer définitivement une réservation (admin uniquement)
 *     tags: [Reservations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/reservationId'
 *     responses:
 *       200:
 *         description: Réservation supprimée définitivement avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Réservation supprimée définitivement avec succès"
 *       400:
 *         description: Impossible de supprimer une réservation avec ce statut
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Impossible de supprimer une réservation avec le statut 'confirmed'. Vous pouvez seulement l'annuler."
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         description: Erreur serveur
 */
router.delete('/:id', protect, admin, reservationController.deleteReservation);

/**
 * @swagger
 * /api/reservations/public:
 *   post:
 *     summary: Créer une réservation publique (sans authentification)
 *     tags: [Reservations]
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
 *               adults:
 *                 type: number
 *                 default: 1
 *               children:
 *                 type: number
 *                 default: 0
 *               guests:
 *                 type: number
 *               specialRequests:
 *                 type: string
 *               paymentMethod:
 *                 type: string
 *                 enum: [card, cash, transfer, check]
 *                 default: card
 *               paymentOption:
 *                 type: string
 *                 enum: [first-night, partial, full]
 *                 default: full
 *               nightsToPay:
 *                 type: number
 *               clientInfo:
 *                 type: object
 *                 required:
 *                   - name
 *                   - surname
 *                   - email
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
 *         description: Réservation publique créée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Réservation créée avec succès. Redirection vers le paiement."
 *                 reservation:
 *                   $ref: '#/components/schemas/Reservation'
 *                 payment:
 *                   type: object
 *                   description: Données pour le paiement CyberSource
 *       400:
 *         description: Données manquantes ou chambre non disponible
 *       404:
 *         description: Chambre non trouvée
 *       500:
 *         description: Erreur serveur
 */
router.post('/public', reservationController.createReservationPublic);

/**
 * @swagger
 * /api/reservations/payment/callback:
 *   post:
 *     summary: Callback pour le retour de paiement CyberSource
 *     tags: [Reservations]
 *     requestBody:
 *       required: true
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             properties:
 *               req_reference_number:
 *                 type: string
 *                 description: Référence de la réservation (format RES-{id})
 *               decision:
 *                 type: string
 *                 enum: [ACCEPT, DECLINE, ERROR, CANCEL, REVIEW]
 *                 description: Décision du paiement
 *               reason_code:
 *                 type: string
 *                 description: Code raison de la décision
 *               auth_amount:
 *                 type: string
 *                 description: Montant autorisé
 *               req_currency:
 *                 type: string
 *                 description: Devise
 *               transaction_id:
 *                 type: string
 *                 description: ID de transaction CyberSource
 *               auth_code:
 *                 type: string
 *                 description: Code d'autorisation
 *               message:
 *                 type: string
 *                 description: Message d'erreur (si échec)
 *     responses:
 *       302:
 *         description: Redirection vers la page de succès ou d'erreur
 *       500:
 *         description: Erreur lors du traitement du callback
 */
router.post('/payment/callback', reservationController.paymentCallback);

/**
 * @swagger
 * /api/reservations/{id}/annuler:
 *   put:
 *     summary: Annuler une réservation (version française)
 *     tags: [Reservations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/reservationId'
 *     responses:
 *       200:
 *         description: Réservation annulée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Réservation annulée avec succès"
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Accès non autorisé
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         description: Erreur serveur
 */
router.put('/:id/annuler', protect, reservationController.cancelReservation);

module.exports = router;