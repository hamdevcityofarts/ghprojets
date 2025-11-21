// routes/codePromoRoutes.js
const express = require('express');
const router = express.Router();
const codePromoController = require('../controllers/codePromoController');
const { protect, admin } = require('../middlewares/authMiddleware');

// =====================================================
// ⚠️ IMPORTANT: Routes publiques AVANT les paramètres
// =====================================================

// ✅ Routes ADMIN (protégées)
router.post('/', protect, admin, codePromoController.createCodePromo);
router.put('/:id', protect, admin, codePromoController.updateCodePromo);
router.delete('/:id', protect, admin, codePromoController.deleteCodePromo);

// ✅ Routes PUBLIQUES - Avant :id pour éviter les conflits
router.get('/active', codePromoController.getActivePromos);
router.get('/stats', codePromoController.getStats);
router.post('/verify', codePromoController.verifyCodePromo);

// ✅ Route publique avec paramètre (APRÈS les routes sans paramètre)
router.get('/room/:roomId', codePromoController.getRoomPromos);

// ✅ Récupérer tous les codes promo (Admin)
router.get('/', protect, admin, codePromoController.getCodesPromo);

module.exports = router;