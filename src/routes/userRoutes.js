// src/routes/userRoutes.js

const express = require('express');
const router = express.Router();
const { protect, admin, gestionUtilisateurs } = require('../middlewares/authMiddleware');
const {
  createUser,
  getUsers,
  getUserById,
  updateUser,
  deleteUser
} = require('../controllers/userController');

/**
 * @swagger
 * tags:
 *   name: Utilisateurs
 *   description: Gestion des utilisateurs (réservé aux administrateurs)
 */

/**
 * @swagger
 * /api/utilisateurs:
 *   post:
 *     summary: Créer un nouvel utilisateur
 *     description: Accessible uniquement aux administrateurs avec permission gestion_utilisateurs
 *     tags: [Utilisateurs]
 *     security:
 *       - bearerAuth: []
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
 *               - role
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Hamed"
 *               surname:
 *                 type: string
 *                 example: "Ndonkou"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "hamed@example.com"
 *               password:
 *                 type: string
 *                 format: password
 *                 example: "MotDePasseFort123!"
 *               role:
 *                 type: string
 *                 enum: [admin, manager, receptionist, housekeeper, supervisor, technician, client]
 *                 example: "receptionist"
 *               phone:
 *                 type: string
 *                 example: "+33 1 23 45 67 89"
 *               department:
 *                 type: string
 *                 enum: [direction, reception, housekeeping, restaurant, maintenance, other]
 *                 example: "reception"
 *               status:
 *                 type: string
 *                 enum: [actif, inactif, en_conge, pending]
 *                 example: "actif"
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: "Permissions optionnelles (seront appliquées par défaut selon le rôle si non fourni)"
 *                 example: ["gestion_reservations", "gestion_clients"]
 *     responses:
 *       201:
 *         description: Utilisateur créé avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                 name:
 *                   type: string
 *                 email:
 *                   type: string
 *                 role:
 *                   type: string
 *                 permissions:
 *                   type: array
 *       400:
 *         description: Erreur de validation ou email déjà utilisé
 *       401:
 *         description: Non autorisé
 *       403:
 *         description: Accès refusé - Permission manquante
 *
 *   get:
 *     summary: Récupérer tous les utilisateurs
 *     description: Liste tous les utilisateurs de la plateforme (réservé aux administrateurs avec permission gestion_utilisateurs)
 *     tags: [Utilisateurs]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des utilisateurs récupérée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id:
 *                     type: string
 *                     example: "66fd2a89a43b0cd9e3d2a345"
 *                   name:
 *                     type: string
 *                     example: "Jean"
 *                   surname:
 *                     type: string
 *                     example: "Dupont"
 *                   email:
 *                     type: string
 *                     example: "jean.dupont@example.com"
 *                   role:
 *                     type: string
 *                     example: "receptionist"
 *                   department:
 *                     type: string
 *                     example: "reception"
 *                   status:
 *                     type: string
 *                     example: "actif"
 *                   permissions:
 *                     type: array
 *                     items:
 *                       type: string
 *       401:
 *         description: Non autorisé
 *       403:
 *         description: Accès refusé - Permission manquante
 */

/**
 * @swagger
 * /api/utilisateurs/{id}:
 *   get:
 *     summary: Récupérer un utilisateur par ID
 *     description: Permet de consulter les informations d'un utilisateur spécifique
 *     tags: [Utilisateurs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de l'utilisateur à récupérer
 *     responses:
 *       200:
 *         description: Informations de l'utilisateur récupérées avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                 name:
 *                   type: string
 *                 email:
 *                   type: string
 *                 role:
 *                   type: string
 *                 permissions:
 *                   type: array
 *       401:
 *         description: Non autorisé
 *       403:
 *         description: Accès refusé - Permission manquante
 *       404:
 *         description: Utilisateur introuvable
 *
 *   put:
 *     summary: Mettre à jour un utilisateur
 *     description: Permet de modifier les informations d'un utilisateur existant
 *     tags: [Utilisateurs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de l'utilisateur à mettre à jour
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               surname:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               role:
 *                 type: string
 *                 enum: [admin, manager, receptionist, housekeeper, supervisor, technician, client]
 *               phone:
 *                 type: string
 *               department:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [actif, inactif, en_conge, pending]
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *               password:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: Utilisateur mis à jour avec succès
 *       400:
 *         description: Données invalides
 *       401:
 *         description: Non autorisé
 *       403:
 *         description: Accès refusé - Permission manquante
 *       404:
 *         description: Utilisateur non trouvé
 *
 *   delete:
 *     summary: Supprimer un utilisateur
 *     description: Supprime définitivement un utilisateur de la base de données
 *     tags: [Utilisateurs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de l'utilisateur à supprimer
 *     responses:
 *       200:
 *         description: Utilisateur supprimé avec succès
 *       401:
 *         description: Non autorisé
 *       403:
 *         description: Accès refusé - Permission manquante
 *       404:
 *         description: Utilisateur introuvable
 */

// ✅ Routes avec middleware de permissions
// Chaîne de middlewares: protect (authentification) -> gestionUtilisateurs (vérification permission)

router.route('/')
  .post(protect, gestionUtilisateurs, createUser)
  .get(protect, gestionUtilisateurs, getUsers);

router.route('/:id')
  .get(protect, gestionUtilisateurs, getUserById)
  .put(protect, gestionUtilisateurs, updateUser)
  .delete(protect, gestionUtilisateurs, deleteUser);

module.exports = router;