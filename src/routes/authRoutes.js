const express = require('express');
const router = express.Router();
const { register, login, getProfile, updateProfile } = require('../controllers/authController');
const { protect } = require('../middlewares/authMiddleware');

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Gestion de l'authentification des utilisateurs
 */

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Inscrire un nouvel utilisateur
 *     description: Crée un nouvel utilisateur et renvoie ses informations.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - password
 *             properties:
 *               name:
 *                 type: string
 *                 description: Nom de l'utilisateur
 *                 example: Hamed
 *               surname:
 *                 type: string
 *                 description: Prénom de l'utilisateur
 *                 example: Ndonkou
 *               email:
 *                 type: string
 *                 description: Adresse email de l'utilisateur
 *                 example: hamed@example.com
 *               password:
 *                 type: string
 *                 description: Mot de passe de l'utilisateur
 *                 example: password123
 *               phone:
 *                 type: string
 *                 description: Numéro de téléphone
 *                 example: "+33 1 23 45 67 89"
 *               department:
 *                 type: string
 *                 enum: [direction, reception, housekeeping, restaurant, maintenance, other]
 *                 description: Département de l'utilisateur
 *                 example: "reception"
 *               role:
 *                 type: string
 *                 enum: [admin, manager, receptionist, housekeeper, supervisor, technician, client]
 *                 description: Rôle de l'utilisateur
 *                 example: "receptionist"
 *               hireDate:
 *                 type: string
 *                 format: date
 *                 description: Date d'embauche
 *                 example: "2024-01-15"
 *     responses:
 *       201:
 *         description: Utilisateur inscrit avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Inscription réussie"
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: "66fbc1245e8a23a4a0f1c981"
 *                     name:
 *                       type: string
 *                       example: "Hamed"
 *                     surname:
 *                       type: string
 *                       example: "Ndonkou"
 *                     email:
 *                       type: string
 *                       example: "hamed@example.com"
 *                     phone:
 *                       type: string
 *                       example: "+33 1 23 45 67 89"
 *                     department:
 *                       type: string
 *                       example: "reception"
 *                     role:
 *                       type: string
 *                       example: "receptionist"
 *                     status:
 *                       type: string
 *                       example: "pending"
 *                     permissions:
 *                       type: array
 *                       items:
 *                         type: string
 *                     hireDate:
 *                       type: string
 *                       format: date
 *                       example: "2024-01-15"
 *                     memberSince:
 *                       type: string
 *                       format: date
 *                       example: "2024-01-15T10:30:00.000Z"
 *                 token:
 *                   type: string
 *                   example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *       400:
 *         description: Erreur de validation ou utilisateur déjà existant
 *       403:
 *         description: Compte en attente de validation
 *       500:
 *         description: Erreur interne du serveur
 */
router.post('/register', register);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Connecter un utilisateur existant
 *     description: Authentifie un utilisateur et retourne un token JWT avec les informations complètes.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 description: Email de l'utilisateur
 *                 example: hamed@example.com
 *               password:
 *                 type: string
 *                 description: Mot de passe
 *                 example: password123
 *     responses:
 *       200:
 *         description: Connexion réussie
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Connexion réussie"
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: "66fbc1245e8a23a4a0f1c981"
 *                     name:
 *                       type: string
 *                       example: "Hamed"
 *                     surname:
 *                       type: string
 *                       example: "Ndonkou"
 *                     email:
 *                       type: string
 *                       example: "hamed@example.com"
 *                     phone:
 *                       type: string
 *                       example: "+33 1 23 45 67 89"
 *                     department:
 *                       type: string
 *                       example: "reception"
 *                     role:
 *                       type: string
 *                       example: "receptionist"
 *                     status:
 *                       type: string
 *                       example: "actif"
 *                     permissions:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["gestion_reservations", "gestion_clients"]
 *                     hireDate:
 *                       type: string
 *                       format: date
 *                       example: "2024-01-15"
 *                     lastLogin:
 *                       type: string
 *                       format: date-time
 *                       example: "2024-01-20T14:30:00.000Z"
 *                     memberSince:
 *                       type: string
 *                       format: date-time
 *                       example: "2024-01-15T10:30:00.000Z"
 *                 token:
 *                   type: string
 *                   example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *       400:
 *         description: Données manquantes
 *       401:
 *         description: Identifiants invalides
 *       403:
 *         description: Compte désactivé ou en attente de validation
 *       500:
 *         description: Erreur interne du serveur
 */
router.post('/login', login);

/**
 * @swagger
 * /auth/profile:
 *   get:
 *     summary: Obtenir le profil de l'utilisateur connecté
 *     description: Retourne les informations du profil de l'utilisateur authentifié.
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profil récupéré avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: "66fbc1245e8a23a4a0f1c981"
 *                     name:
 *                       type: string
 *                       example: "Hamed"
 *                     surname:
 *                       type: string
 *                       example: "Ndonkou"
 *                     email:
 *                       type: string
 *                       example: "hamed@example.com"
 *                     phone:
 *                       type: string
 *                       example: "+33 1 23 45 67 89"
 *                     department:
 *                       type: string
 *                       example: "reception"
 *                     role:
 *                       type: string
 *                       example: "receptionist"
 *                     status:
 *                       type: string
 *                       example: "actif"
 *                     permissions:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["gestion_reservations", "gestion_clients"]
 *                     hireDate:
 *                       type: string
 *                       format: date
 *                       example: "2024-01-15"
 *                     lastLogin:
 *                       type: string
 *                       format: date-time
 *                       example: "2024-01-20T14:30:00.000Z"
 *                     memberSince:
 *                       type: string
 *                       format: date-time
 *                       example: "2024-01-15T10:30:00.000Z"
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *       401:
 *         description: Non authentifié
 *       404:
 *         description: Utilisateur non trouvé
 *       500:
 *         description: Erreur interne du serveur
 */
router.get('/profile', protect, getProfile);

/**
 * @swagger
 * /auth/profile:
 *   put:
 *     summary: Mettre à jour le profil de l'utilisateur connecté
 *     description: Permet à l'utilisateur de modifier ses informations personnelles.
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Nom de l'utilisateur
 *                 example: "Hamed"
 *               surname:
 *                 type: string
 *                 description: Prénom de l'utilisateur
 *                 example: "Ndonkou"
 *               email:
 *                 type: string
 *                 description: Nouvel email
 *                 example: "nouveau@example.com"
 *               phone:
 *                 type: string
 *                 description: Numéro de téléphone
 *                 example: "+33 1 23 45 67 89"
 *               department:
 *                 type: string
 *                 enum: [direction, reception, housekeeping, restaurant, maintenance, other]
 *                 description: Département
 *                 example: "reception"
 *     responses:
 *       200:
 *         description: "Profil mis à jour avec succès"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Profil mis à jour avec succès"
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     surname:
 *                       type: string
 *                     email:
 *                       type: string
 *                     phone:
 *                       type: string
 *                     department:
 *                       type: string
 *                     role:
 *                       type: string
 *                     status:
 *                       type: string
 *                     permissions:
 *                       type: array
 *                       items:
 *                         type: string
 *                     hireDate:
 *                       type: string
 *                       format: date
 *                     lastLogin:
 *                       type: string
 *                       format: date-time
 *                     memberSince:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Données invalides ou email déjà utilisé
 *       403:
 *         description: Modification non autorisée
 *       401:
 *         description: Non authentifié
 *       500:
 *         description: Erreur interne du serveur
 */
router.put('/profile', protect, updateProfile);

module.exports = router;