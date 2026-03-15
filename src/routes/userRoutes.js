const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middlewares/authMiddleware');
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
 * /utilisateurs:
 *   post:
 *     summary: Créer un nouvel utilisateur
 *     description: Accessible uniquement aux administrateurs
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
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Hamed"
 *               surname:
 *                 type: string
 *                 example: "Ndonkou"
 *               email:
 *                 type: string
 *                 example: "hamed@example.com"
 *               password:
 *                 type: string
 *                 example: "MotDePasseFort123!"
 *               role:
 *                 type: string
 *                 enum: [admin, manager, receptionist, housekeeper, supervisor, technician, client]
 *                 example: "client"
 *               phone:
 *                 type: string
 *                 example: "+33 1 23 45 67 89"
 *               department:
 *                 type: string
 *                 enum: [direction, reception, housekeeping, restaurant, maintenance, other]
 *               status:
 *                 type: string
 *                 enum: [actif, inactif, en_conge, pending]
 *     responses:
 *       201:
 *         description: Utilisateur créé avec succès
 *       400:
 *         description: Erreur de validation ou email déjà utilisé
 *       401:
 *         description: Non autorisé
 *       403:
 *         description: Accès réservé aux administrateurs
 *
 *   get:
 *     summary: Récupérer tous les utilisateurs
 *     description: Liste tous les utilisateurs de la plateforme (réservé aux administrateurs)
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
 *                     example: "client"
 *                   department:
 *                     type: string
 *                     example: "reception"
 *                   status:
 *                     type: string
 *                     example: "actif"
 *       401:
 *         description: Non autorisé
 *       403:
 *         description: Accès refusé (non admin)
 */

/**
 * @swagger
 * /utilisateurs/{id}:
 *   get:
 *     summary: Récupérer un utilisateur par ID
 *     description: Permet à l'administrateur de consulter les informations d'un utilisateur spécifique
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
 *       401:
 *         description: Non autorisé
 *       403:
 *         description: Accès réservé aux administrateurs
 *       404:
 *         description: Utilisateur introuvable
 *
 *   put:
 *     summary: Mettre à jour un utilisateur
 *     description: Permet à un administrateur de modifier les informations d'un utilisateur existant
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
 *                 example: "Nouveau Prénom"
 *               surname:
 *                 type: string
 *                 example: "Nouveau Nom"
 *               email:
 *                 type: string
 *                 example: "nouveau.email@example.com"
 *               role:
 *                 type: string
 *                 enum: [admin, manager, receptionist, housekeeper, supervisor, technician, client]
 *     responses:
 *       200:
 *         description: Utilisateur mis à jour avec succès
 *       400:
 *         description: Données invalides
 *       401:
 *         description: Non autorisé
 *       404:
 *         description: Utilisateur non trouvé
 *
 *   delete:
 *     summary: Supprimer un utilisateur
 *     description: Supprime définitivement un utilisateur de la base de données (réservé aux administrateurs)
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
 *         description: Accès refusé (non admin)
 *       404:
 *         description: Utilisateur introuvable
 */

// Routes
router.route('/')
  .post(protect, admin, createUser)
  .get(protect, admin, getUsers);

router.route('/:id')
  .get(protect, admin, getUserById)
  .put(protect, admin, updateUser)
  .delete(protect, admin, deleteUser);

module.exports = router;