// controllers/codePromoController.js
const CodePromo = require('../models/CodePromo');
const Chambre = require('../models/chambreModel');

// =============================================
// MÉTHODES ADMIN (Protégées)
// =============================================

exports.createCodePromo = async (req, res) => {
  try {
    const {
      code,
      description,
      type,
      value,
      chambres,
      applicableToAll,
      dateDebut,
      dateFin,
      utilisationMax,
      minimumStay
    } = req.body;

    const existingCode = await CodePromo.findOne({ code: code.toUpperCase() });
    if (existingCode) {
      return res.status(400).json({
        success: false,
        message: 'Ce code promo existe déjà'
      });
    }

    if (new Date(dateDebut) >= new Date(dateFin)) {
      return res.status(400).json({
        success: false,
        message: 'La date de fin doit être après la date de début'
      });
    }

    const codePromo = await CodePromo.create({
      code: code.toUpperCase(),
      description,
      type,
      value,
      chambres: applicableToAll ? [] : chambres,
      applicableToAll,
      dateDebut: new Date(dateDebut),
      dateFin: new Date(dateFin),
      utilisationMax,
      minimumStay: minimumStay || 1,
      statut: 'actif',
      createdBy: req.user._id
    });

    await codePromo.populate('chambres', 'name number price');

    res.status(201).json({
      success: true,
      message: 'Code promo créé avec succès',
      codePromo
    });

  } catch (error) {
    console.error('❌ Erreur création code promo:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création du code promo',
      error: error.message
    });
  }
};

exports.getCodesPromo = async (req, res) => {
  try {
    const codesPromo = await CodePromo.find()
      .populate('chambres', 'name number price')
      .populate('createdBy', 'name surname')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: codesPromo.length,
      codesPromo
    });

  } catch (error) {
    console.error('❌ Erreur récupération codes promo:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des codes promo',
      error: error.message
    });
  }
};

exports.updateCodePromo = async (req, res) => {
  try {
    const codePromo = await CodePromo.findById(req.params.id);

    if (!codePromo) {
      return res.status(404).json({
        success: false,
        message: 'Code promo non trouvé'
      });
    }

    const updatedCodePromo = await CodePromo.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('chambres', 'name number price').populate('createdBy', 'name surname');

    res.json({
      success: true,
      message: 'Code promo mis à jour avec succès',
      codePromo: updatedCodePromo
    });

  } catch (error) {
    console.error('❌ Erreur mise à jour code promo:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du code promo',
      error: error.message
    });
  }
};

exports.deleteCodePromo = async (req, res) => {
  try {
    const codePromo = await CodePromo.findById(req.params.id);

    if (!codePromo) {
      return res.status(404).json({
        success: false,
        message: 'Code promo non trouvé'
      });
    }

    await CodePromo.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Code promo supprimé avec succès'
    });

  } catch (error) {
    console.error('❌ Erreur suppression code promo:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression du code promo',
      error: error.message
    });
  }
};

exports.getStats = async (req, res) => {
  try {
    const stats = await CodePromo.aggregate([
      {
        $group: {
          _id: null,
          totalCodes: { $sum: 1 },
          codesActifs: {
            $sum: { $cond: [{ $eq: ['$statut', 'actif'] }, 1, 0] }
          },
          totalUtilisations: { $sum: '$utilisationActuelle' },
          utilisationMoyenne: { $avg: '$utilisationActuelle' }
        }
      }
    ]);

    const now = new Date();
    const codesExpires = await CodePromo.countDocuments({
      dateFin: { $lt: now }
    });

    res.json({
      success: true,
      stats: {
        totalCodes: stats[0]?.totalCodes || 0,
        codesActifs: stats[0]?.codesActifs || 0,
        totalUtilisations: stats[0]?.totalUtilisations || 0,
        utilisationMoyenne: stats[0]?.utilisationMoyenne || 0,
        codesExpires
      }
    });

  } catch (error) {
    console.error('❌ Erreur statistiques codes promo:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des statistiques',
      error: error.message
    });
  }
};

// =============================================
// MÉTHODES PUBLIQUES (Accessibles sans auth)
// =============================================

exports.verifyCodePromo = async (req, res) => {
  try {
    const { code, chambreId, checkin, checkout, nights = 1 } = req.body;

    if (!code || !chambreId) {
      return res.status(400).json({
        success: false,
        message: 'Code promo et ID chambre requis'
      });
    }

    const codePromo = await CodePromo.findOne({ 
      code: code.toUpperCase() 
    }).populate('chambres');

    if (!codePromo) {
      return res.status(404).json({
        success: false,
        message: 'Code promo non trouvé'
      });
    }

    const now = new Date();
    const startDate = new Date(codePromo.dateDebut);
    const endDate = new Date(codePromo.dateFin);

    // ✅ MODIFICATION : Ne plus vérifier la date de début au moment de la saisie
    // On permet la vérification même si la promo commence dans le futur

    if (codePromo.statut !== 'actif') {
      return res.status(400).json({
        success: false,
        message: 'Ce code promo n\'est pas actif'
      });
    }

    // ✅ Vérifier seulement si la promo n'est pas expirée
    if (now > endDate) {
      return res.status(400).json({
        success: false,
        message: 'Ce code promo a expiré'
      });
    }

    if (codePromo.utilisationActuelle >= codePromo.utilisationMax) {
      return res.status(400).json({
        success: false,
        message: 'Ce code promo a atteint sa limite d\'utilisation'
      });
    }

    if (nights < codePromo.minimumStay) {
      return res.status(400).json({
        success: false,
        message: `Ce code nécessite un séjour minimum de ${codePromo.minimumStay} nuit(s)`
      });
    }

    // ✅ Vérifier l'application à la chambre
    const chambre = await Chambre.findById(chambreId);
    if (!chambre) {
      return res.status(404).json({
        success: false,
        message: 'Chambre non trouvée'
      });
    }

    const appliesToAll = codePromo.applicableToAll === true;
    const appliesToRoom = codePromo.chambres?.some(ch => ch._id.toString() === chambreId);

    if (!appliesToAll && !appliesToRoom) {
      return res.status(400).json({
        success: false,
        message: 'Ce code promo ne s\'applique pas à cette chambre'
      });
    }

    // ✅ NOUVEAU : Vérifier si des dates sont fournies pour validation temporelle
    let isValidForDates = true;
    let dateValidationMessage = '';

    if (checkin && checkout) {
      const checkInDate = new Date(checkin);
      const checkOutDate = new Date(checkout);
      
      // Vérifier si les dates de réservation sont dans la période du code promo
      if (checkInDate < startDate || checkOutDate > endDate) {
        isValidForDates = false;
        dateValidationMessage = `Ce code promo est valide uniquement pour des réservations comprises entre le ${startDate.toLocaleDateString('fr-FR')} et le ${endDate.toLocaleDateString('fr-FR')}`;
      }
    }

    // ✅ Calculer la réduction
    const prixReduit = codePromo.calculateReducedPrice(chambre.price);
    const economie = chambre.price - prixReduit;

    res.json({
      success: true,
      codePromo: {
        _id: codePromo._id,
        code: codePromo.code,
        description: codePromo.description,
        type: codePromo.type,
        value: codePromo.value,
        prixOriginal: chambre.price,
        prixReduit: prixReduit,
        economie: economie,
        minimumStay: codePromo.minimumStay,
        utilisationActuelle: codePromo.utilisationActuelle,
        utilisationMax: codePromo.utilisationMax,
        dateDebut: codePromo.dateDebut,
        dateFin: codePromo.dateFin,
        isValidForDates: isValidForDates,
        dateValidationMessage: dateValidationMessage
      }
    });

  } catch (error) {
    console.error('❌ Erreur vérification code promo:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la vérification du code promo',
      error: error.message
    });
  }
};

exports.getRoomPromos = async (req, res) => {
  try {
    const { roomId } = req.params;

    if (!roomId) {
      return res.status(400).json({
        success: false,
        message: 'ID chambre requis'
      });
    }

    const chambre = await Chambre.findById(roomId);
    if (!chambre) {
      return res.status(404).json({
        success: false,
        message: 'Chambre non trouvée'
      });
    }

    const now = new Date();

    // ✅ MODIFICATION : Afficher toutes les promos non expirées (même futures)
    const codesPromo = await CodePromo.find({
      $or: [
        { applicableToAll: true },
        { chambres: roomId }
      ],
      statut: 'actif',
      dateFin: { $gte: now } // ✅ Seulement le filtre dateFin pour inclure les promos futures
    });

    // ✅ Filtrage supplémentaire en JS pour la sécurité
    const validPromos = codesPromo.filter(promo => {
      const hasUtilisationLeft = promo.utilisationActuelle < promo.utilisationMax;
      return hasUtilisationLeft;
    });

    console.log(`🎯 Promos non expirées trouvées pour chambre ${roomId}: ${validPromos.length}`);

    // ✅ Mapper les données avec statuts et réductions calculées
    const availablePromos = validPromos.map(promo => {
      const isActive = new Date(promo.dateDebut) <= now;
      const prixReduit = promo.calculateReducedPrice(chambre.price);
      const economie = chambre.price - prixReduit;
      const pourcentageEconomie = Math.round((economie / chambre.price) * 100);

      return {
        _id: promo._id,
        code: promo.code,
        description: promo.description,
        type: promo.type,
        value: promo.value,
        prixReduit: prixReduit,
        prixOriginal: chambre.price,
        economie: economie,
        pourcentageEconomie: pourcentageEconomie,
        minimumStay: promo.minimumStay,
        dateDebut: promo.dateDebut,
        dateFin: promo.dateFin,
        utilisationActuelle: promo.utilisationActuelle,
        utilisationMax: promo.utilisationMax,
        status: isActive ? 'active' : 'upcoming'
      };
    });

    // ✅ Trier : promos actives d'abord, puis futures, puis par meilleure réduction
    availablePromos.sort((a, b) => {
      if (a.status === 'active' && b.status !== 'active') return -1;
      if (a.status !== 'active' && b.status === 'active') return 1;
      
      if (a.status === 'active' && b.status === 'active') {
        return b.economie - a.economie;
      }
      
      return new Date(a.dateDebut) - new Date(b.dateDebut);
    });

    const activePromos = availablePromos.filter(p => p.status === 'active').length;
    const upcomingPromos = availablePromos.filter(p => p.status === 'upcoming').length;
    
    console.log(`📊 Détail: ${activePromos} active(s), ${upcomingPromos} à venir`);

    res.json({
      success: true,
      availablePromos: availablePromos,
      stats: {
        total: availablePromos.length,
        active: activePromos,
        upcoming: upcomingPromos
      }
    });

  } catch (error) {
    console.error('❌ Erreur récupération promos chambre:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des promos',
      error: error.message
    });
  }
};

exports.getActivePromos = async (req, res) => {
  try {
    const now = new Date();

    console.log('🔍 Recherche de promos actives à:', now.toISOString());

    const promos = await CodePromo.find({
      statut: 'actif',
      dateDebut: { $lte: now },
      dateFin: { $gte: now }
    })
      .populate('chambres', 'name number price')
      .select('code description type value applicableToAll chambres dateDebut dateFin utilisationActuelle utilisationMax minimumStay')
      .sort({ createdAt: -1 });

    const activePromos = promos.filter(p => p.utilisationActuelle < p.utilisationMax);

    console.log(`🔥 ${activePromos.length} promos actives trouvées`);

    res.status(200).json({
      success: true,
      count: activePromos.length,
      promos: activePromos
    });

  } catch (error) {
    console.error('❌ Erreur récupération promos actives:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération des promos actives',
      error: error.message
    });
  }
};

module.exports = exports;