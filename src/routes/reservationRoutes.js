const express = require('express');
const router = express.Router();
const reservationController = require('../controllers/reservationController');
const { protect, admin, reservationAccess } = require('../middlewares/authMiddleware');

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
 *     summary: Récupérer la liste des réservations (avec contrôle d'accès basé sur les permissions)
 *     description: |
 *       Accès contrôlé par les permissions:
 *       - Admin: Toutes les réservations
 *       - Manager: Toutes les réservations
 *       - Receptionist: Toutes les réservations
 *       - Supervisor: Toutes les réservations
 *       - Autres rôles: Accès refusé
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
 *       - in: query
 *         name: dateFrom
 *         schema:
 *           type: string
 *           format: date
 *         description: Filtrer à partir de cette date (YYYY-MM-DD)
 *       - in: query
 *         name: dateTo
 *         schema:
 *           type: string
 *           format: date
 *         description: Filtrer jusqu'à cette date (YYYY-MM-DD)
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
 *       403:
 *         description: Accès refusé - Droits insuffisants
 *       500:
 *         description: Erreur serveur
 */
router.get('/', protect, reservationAccess, reservationController.getReservations);

/**
 * @swagger
 * /api/reservations/stats/overview:
 *   get:
 *     summary: Obtenir les statistiques des réservations (Admin uniquement)
 *     tags: [Reservations]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Statistiques récupérées avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 stats:
 *                   type: object
 *                   properties:
 *                     totals:
 *                       type: object
 *                       properties:
 *                         totalReservations:
 *                           type: number
 *                           example: 150
 *                         confirmedReservations:
 *                           type: number
 *                           example: 120
 *                         cancelledReservations:
 *                           type: number
 *                           example: 15
 *                         pendingReservations:
 *                           type: number
 *                           example: 15
 *                     revenue:
 *                       type: object
 *                       properties:
 *                         totalRevenue:
 *                           type: number
 *                           example: 15000000
 *                         averageRevenue:
 *                           type: number
 *                           example: 100000
 *                     monthlyStats:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: object
 *                             properties:
 *                               year:
 *                                 type: number
 *                               month:
 *                                 type: number
 *                           count:
 *                             type: number
 *                           revenue:
 *                             type: number
 *                     statusStats:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           count:
 *                             type: number
 *                           totalAmount:
 *                             type: number
 *                     topRooms:
 *                       type: array
 *                       items:
 *                         type: object
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         description: Erreur serveur
 */
router.get('/stats/overview', protect, admin, reservationController.getReservationStats);

/**
 * @swagger
 * /api/reservations/stats/promo-codes:
 *   get:
 *     summary: Obtenir les statistiques détaillées des codes promo (Admin uniquement)
 *     tags: [Reservations]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Statistiques codes promo récupérées avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 stats:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                         example: "NOEL2024"
 *                       count:
 *                         type: number
 *                         example: 25
 *                       totalReduction:
 *                         type: number
 *                         example: 500000
 *                       totalRevenue:
 *                         type: number
 *                         example: 2500000
 *                       averageReduction:
 *                         type: number
 *                         example: 20000
 *                       revenuePerCode:
 *                         type: number
 *                         example: 100000
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         description: Erreur serveur
 */
router.get('/stats/promo-codes', protect, admin, reservationController.getPromoCodeStats);

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
router.get('/:id', protect, reservationAccess, reservationController.getReservationById);

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
router.put('/:id', protect, reservationAccess, reservationController.updateReservation);

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
router.put('/:id/cancel', protect, reservationAccess, reservationController.cancelReservation);

/**
 * @swagger
 * /api/reservations/{id}/confirm:
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
router.put('/:id/annuler', protect, reservationAccess, reservationController.cancelReservation);

/**
 * @swagger
 * /api/reservations/user/{userId}:
 *   get:
 *     summary: Récupérer les réservations d'un utilisateur spécifique (admin uniquement)
 *     tags: [Reservations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de l'utilisateur
 *     responses:
 *       200:
 *         description: Réservations de l'utilisateur récupérées avec succès
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
 *                   example: 3
 *                 reservations:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Reservation'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         description: Erreur serveur
 */
router.get('/user/:userId', protect, admin, reservationController.getUserReservations);

/**
 * @swagger
 * /api/reservations/{id}/receipt:
 *   get:
 *     summary: Générer et afficher le reçu HTML d'une réservation
 *     tags: [Reservations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/reservationId'
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [html, pdf]
 *         description: Format du reçu (html par défaut)
 *       - in: query
 *         name: print
 *         schema:
 *           type: boolean
 *         description: Auto-impression du reçu
 *     responses:
 *       200:
 *         description: Reçu HTML généré avec succès
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 *               example: "<html>...contenu du reçu...</html>"
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Accès non autorisé à ce reçu
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         description: Erreur lors de la génération du reçu
 */
router.get('/:id/receipt', protect, reservationAccess, reservationController.generateReceipt);

/**
 * @swagger
 * /api/reservations/{id}/receipt/download:
 *   get:
 *     summary: Télécharger le reçu d'une réservation
 *     tags: [Reservations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/reservationId'
 *     responses:
 *       200:
 *         description: Reçu téléchargé avec succès
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 *               format: binary
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Accès non autorisé à ce reçu
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         description: Erreur lors du téléchargement du reçu
 */
router.get('/:id/receipt/download', protect, reservationAccess, reservationController.downloadReceipt);

/**
 * @swagger
 * /api/reservations/{id}/receipt/url:
 *   get:
 *     summary: Obtenir les URLs du reçu d'une réservation
 *     tags: [Reservations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/reservationId'
 *     responses:
 *       200:
 *         description: URLs du reçu générées avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 receiptUrl:
 *                   type: string
 *                   description: URL pour afficher le reçu
 *                   example: "https://api.example.com/api/reservations/507f1f77bcf86cd799439011/receipt"
 *                 downloadUrl:
 *                   type: string
 *                   description: URL pour télécharger le reçu
 *                   example: "https://api.example.com/api/reservations/507f1f77bcf86cd799439011/receipt/download"
 *                 reservationId:
 *                   type: string
 *                   example: "507f1f77bcf86cd799439011"
 *                 message:
 *                   type: string
 *                   example: "URLs du reçu générées avec succès"
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Accès non autorisé à ce reçu
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         description: Erreur lors de la génération des URLs
 */
router.get('/:id/receipt/url', protect, reservationAccess, reservationController.getReceiptUrl);

module.exports = router;