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
const { protect, restrictTo } = require('../middlewares/authMiddleware');

// ✅ ROUTES PUBLIQUES (sans authentification)
router.get('/', getChambres);
router.get('/:id', getChambreById);

// ✅ ROUTES PROTÉGÉES (admin seulement)
router.post(
  '/', 
  protect, 
  restrictTo('admin'), 
  upload.array('images', 10), 
  handleUploadErrors, 
  createChambre
);

router.put(
  '/:id', 
  protect, 
  restrictTo('admin'), 
  updateChambre
);

router.delete(
  '/:id', 
  protect, 
  restrictTo('admin'), 
  deleteChambre
);

// ✅ ROUTES D'UPLOAD SUPPLÉMENTAIRES
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