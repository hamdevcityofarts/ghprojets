const express = require('express');
const router = express.Router();
const { upload, handleUploadErrors } = require('../middlewares/uploadMiddleware');
const { 
  createChambre, 
  getChambres, 
  getChambreById, 
  updateChambre, 
  deleteChambre,
  uploadImage,
  uploadMultipleImages,
  deleteImage
} = require('../controllers/chambreControllers');
const { protect, restrictTo, optionalAuth } = require('../middlewares/authMiddleware');

/**
 * @swagger
 * /api/chambres:
 *   get:
 *     summary: Récupérer toutes les chambres
 *     tags: [Chambres]
 *     responses:
 *       200:
 *         description: Liste des chambres
 */
router.get('/', optionalAuth, getChambres);

/**
 * @swagger
 * /api/chambres/{id}:
 *   get:
 *     summary: Récupérer une chambre par ID
 *     tags: [Chambres]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Détails de la chambre
 *       404:
 *         description: Chambre non trouvée
 */
router.get('/:id', optionalAuth, getChambreById);

/**
 * @swagger
 * /api/chambres:
 *   post:
 *     summary: Créer une nouvelle chambre (Admin)
 *     tags: [Chambres]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - number
 *               - name
 *               - type
 *               - price
 *               - capacity
 *     responses:
 *       201:
 *         description: Chambre créée
 *       401:
 *         description: Non authentifié
 *       403:
 *         description: Droits insuffisants
 */
router.post(
  '/', 
  protect, 
  restrictTo('admin'), 
  createChambre
);

/**
 * @swagger
 * /api/chambres/{id}:
 *   put:
 *     summary: Mettre à jour une chambre (Admin)
 *     tags: [Chambres]
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
 *         description: Chambre mise à jour
 */
router.put(
  '/:id', 
  protect, 
  restrictTo('admin'), 
  updateChambre
);

/**
 * @swagger
 * /api/chambres/{id}:
 *   delete:
 *     summary: Supprimer une chambre (Admin)
 *     tags: [Chambres]
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
 *         description: Chambre supprimée
 */
router.delete(
  '/:id', 
  protect, 
  restrictTo('admin'), 
  deleteChambre
);

// ✅ ROUTES D'UPLOAD
/**
 * @swagger
 * /api/chambres/upload/image:
 *   post:
 *     summary: Upload une image (Admin)
 *     tags: [Chambres]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Image uploadée
 */
router.post(
  '/upload/image', 
  protect, 
  restrictTo('admin'), 
  upload.single('image'),
  handleUploadErrors, 
  uploadImage
);

router.post(
  '/upload/images', 
  protect, 
  restrictTo('admin'), 
  upload.array('images', 10),
  handleUploadErrors, 
  uploadMultipleImages
);

router.delete(
  '/images/:filename', 
  protect, 
  restrictTo('admin'), 
  deleteImage
);

module.exports = router;