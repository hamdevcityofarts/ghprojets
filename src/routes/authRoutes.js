// src/routes/authRoutes.js (AVEC SWAGGER COMPLET)
const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const {
  register,
  login,
  getProfile,
  updateProfile,
  changePassword,
  verifyToken
} = require('../controllers/authController');

/**
 * @swagger
 * tags:
 *   name: Authentification
 *   description: Gestion de l'authentification et des comptes utilisateurs
 */

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Inscription d'un nouvel utilisateur
 *     description: Crée un nouveau compte utilisateur avec le rôle "client" par défaut
 *     tags: [Authentification]
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
 *                 example: "Jean"
 *                 description: Nom de l'utilisateur
 *               surname:
 *                 type: string
 *                 example: "Dupont"
 *                 description: Prénom de l'utilisateur
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "jean.dupont@example.com"
 *                 description: Email unique de l'utilisateur
 *               password:
 *                 type: string
 *                 format: password
 *                 example: "MotDePasse123!"
 *                 description: Mot de passe (minimum 6 caractères)
 *               phone:
 *                 type: string
 *                 example: "+237 6XX XX XX XX"
 *                 description: Numéro de téléphone (optionnel)
 *               role:
 *                 type: string
 *                 enum: [client]
 *                 default: "client"
 *                 description: Rôle de l'utilisateur (uniquement client pour l'inscription publique)
 *     responses:
 *       201:
 *         description: Utilisateur créé avec succès
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
 *                       example: "507f1f77bcf86cd799439011"
 *                     name:
 *                       type: string
 *                       example: "Jean"
 *                     surname:
 *                       type: string
 *                       example: "Dupont"
 *                     email:
 *                       type: string
 *                       example: "jean.dupont@example.com"
 *                     phone:
 *                       type: string
 *                       example: "+237 6XX XX XX XX"
 *                     role:
 *                       type: string
 *                       example: "client"
 *                     status:
 *                       type: string
 *                       example: "actif"
 *                     memberSince:
 *                       type: string
 *                       format: date-time
 *                 token:
 *                   type: string
 *                   description: JWT token d'authentification
 *       400:
 *         description: Erreur de validation ou email déjà utilisé
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Un utilisateur avec cet email existe déjà"
 *       500:
 *         description: Erreur serveur
 */

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Connexion d'un utilisateur
 *     description: Authentifie un utilisateur et retourne un token JWT
 *     tags: [Authentification]
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
 *                 format: email
 *                 example: "jean.dupont@example.com"
 *               password:
 *                 type: string
 *                 format: password
 *                 example: "MotDePasse123!"
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
 *                     name:
 *                       type: string
 *                     surname:
 *                       type: string
 *                     email:
 *                       type: string
 *                     phone:
 *                       type: string
 *                     role:
 *                       type: string
 *                     status:
 *                       type: string
 *                     permissions:
 *                       type: array
 *                       items:
 *                         type: string
 *                     lastLogin:
 *                       type: string
 *                       format: date-time
 *                     memberSince:
 *                       type: string
 *                       format: date-time
 *                 token:
 *                   type: string
 *       401:
 *         description: Identifiants invalides
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Email ou mot de passe invalide"
 *       403:
 *         description: Compte désactivé ou en attente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Votre compte est en attente de validation"
 *       500:
 *         description: Erreur serveur
 */

/**
 * @swagger
 * /auth/profile:
 *   get:
 *     summary: Récupérer le profil utilisateur
 *     description: Retourne les informations du profil de l'utilisateur connecté
 *     tags: [Authentification]
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
 *                     name:
 *                       type: string
 *                     surname:
 *                       type: string
 *                     email:
 *                       type: string
 *                     phone:
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
 *                       format: date-time
 *                     lastLogin:
 *                       type: string
 *                       format: date-time
 *                     memberSince:
 *                       type: string
 *                       format: date-time
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
 *         description: Erreur serveur
 * 
 *   put:
 *     summary: Mettre à jour le profil utilisateur
 *     description: Met à jour les informations personnelles de l'utilisateur connecté
 *     tags: [Authentification]
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
 *                 example: "Nouveau Nom"
 *               surname:
 *                 type: string
 *                 example: "Nouveau Prénom"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "nouvel.email@example.com"
 *               phone:
 *                 type: string
 *                 example: "+237 6YY YY YY YY"
 *               department:
 *                 type: string
 *                 example: "other"
 *     responses:
 *       200:
 *         description: Profil mis à jour avec succès
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
 *                     role:
 *                       type: string
 *                     status:
 *                       type: string
 *                     permissions:
 *                       type: array
 *                       items:
 *                         type: string
 *       400:
 *         description: Données invalides ou email déjà utilisé
 *       401:
 *         description: Non authentifié
 *       403:
 *         description: Tentative de modification du rôle ou statut non autorisée
 *       500:
 *         description: Erreur serveur
 */

/**
 * @swagger
 * /auth/change-password:
 *   put:
 *     summary: Changer le mot de passe
 *     description: Permet à l'utilisateur connecté de modifier son mot de passe
 *     tags: [Authentification]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 format: password
 *                 example: "AncienMotDePasse123!"
 *                 description: Mot de passe actuel
 *               newPassword:
 *                 type: string
 *                 format: password
 *                 example: "NouveauMotDePasse456!"
 *                 description: Nouveau mot de passe (minimum 6 caractères)
 *     responses:
 *       200:
 *         description: Mot de passe modifié avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Mot de passe modifié avec succès"
 *       400:
 *         description: |
 *           Erreurs possibles :
 *           - Champs manquants
 *           - Mot de passe actuel incorrect
 *           - Nouveau mot de passe trop court
 *           - Nouveau mot de passe identique à l'ancien
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Le mot de passe actuel est incorrect"
 *       401:
 *         description: Non authentifié
 *       500:
 *         description: Erreur serveur
 */

/**
 * @swagger
 * /auth/verify:
 *   get:
 *     summary: Vérifier le token JWT
 *     description: Vérifie la validité du token JWT et retourne les informations utilisateur
 *     tags: [Authentification]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Token valide
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
 *                     name:
 *                       type: string
 *                     surname:
 *                       type: string
 *                     email:
 *                       type: string
 *                     phone:
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
 *                       format: date-time
 *                     lastLogin:
 *                       type: string
 *                       format: date-time
 *                     memberSince:
 *                       type: string
 *                       format: date-time
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *       401:
 *         description: Token invalide ou expiré
 *       404:
 *         description: Utilisateur non trouvé
 *       500:
 *         description: Erreur serveur
 */

// Routes publiques
router.post('/register', register);
router.post('/login', login);

// Routes protégées
router.get('/profile', protect, getProfile);
router.put('/profile', protect, updateProfile);
router.put('/change-password', protect, changePassword);
router.get('/verify', protect, verifyToken);

module.exports = router;