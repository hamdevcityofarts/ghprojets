const Chambre = require('../models/chambreModel');
const { deleteFromCloudinary } = require('../middlewares/uploadMiddleware');

// ✅ CRÉATION - AVEC VALIDATION COMPLÈTE
exports.createChambre = async (req, res) => {
  try {
    console.log('📥 Création chambre - Données reçues:', req.body);

    const { 
      number, 
      name, 
      type, 
      category, 
      capacity, 
      price, 
      size, 
      bedType, 
      status, 
      description, 
      amenities,
      images
    } = req.body;

    // ✅ VALIDATION REQUISE
    if (!number || !name || !type || !capacity || !price) {
      return res.status(400).json({ 
        success: false,
        message: 'Champs requis manquants: number, name, type, capacity, price' 
      });
    }

    // ✅ VÉRIFIER SI LE NUMÉRO EXISTE DÉJÀ
    const existing = await Chambre.findOne({ number });
    if (existing) {
      return res.status(400).json({ 
        success: false,
        message: `Chambre #${number} existe déjà` 
      });
    }

    // 🔒 CRÉER LA CHAMBRE
    const chambre = await Chambre.create({
      number,
      name,
      type,
      category: category || 'standard',
      capacity: parseInt(capacity),
      price: parseFloat(price),
      currency: 'XAF',
      size: size || 0,
      bedType: bedType || 'lit simple',
      status: status || 'disponible',
      description: description || '',
      amenities: Array.isArray(amenities) ? amenities : (amenities ? [amenities] : []),
      images: images || [],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    console.log('✅ Chambre créée:', {
      id: chambre._id,
      number: chambre.number,
      price: chambre.price
    });

    res.status(201).json({
      success: true,
      message: 'Chambre créée avec succès',
      chambre
    });

  } catch (err) {
    console.error('❌ Erreur création chambre:', err.message);
    res.status(500).json({ 
      success: false,
      message: 'Erreur lors de la création de la chambre',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// ✅ RÉCUPÉRATION - TOUTES LES CHAMBRES
exports.getChambres = async (req, res) => {
  try {
    console.log('📤 Récupération des chambres');

    const chambres = await Chambre.find({ isActive: true }).sort({ number: 1 });
    
    console.log(`✅ ${chambres.length} chambre(s) trouvée(s)`);

    res.status(200).json({
      success: true,
      count: chambres.length,
      chambres
    });

  } catch (err) {
    console.error('❌ Erreur récupération chambres:', err.message);
    res.status(500).json({ 
      success: false,
      message: 'Erreur lors de la récupération des chambres',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// ✅ RÉCUPÉRATION - PAR ID
exports.getChambreById = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🔍 Recherche chambre: ${id}`);

    const chambre = await Chambre.findById(id);
    
    if (!chambre) {
      return res.status(404).json({ 
        success: false,
        message: `Chambre avec l'ID ${id} non trouvée` 
      });
    }

    console.log(`✅ Chambre trouvée: #${chambre.number}`);

    res.status(200).json({
      success: true,
      chambre
    });

  } catch (err) {
    console.error('❌ Erreur récupération chambre:', err.message);
    res.status(500).json({ 
      success: false,
      message: 'Erreur lors de la récupération de la chambre',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// ✅ MISE À JOUR - AVEC VALIDATION
exports.updateChambre = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`📝 Mise à jour chambre: ${id}`, req.body);

    const chambre = await Chambre.findById(id);
    
    if (!chambre) {
      return res.status(404).json({ 
        success: false,
        message: `Chambre avec l'ID ${id} non trouvée` 
      });
    }

    // 🔒 NETTOYER LES DONNÉES (supprimer champs indésirables)
    const cleanData = { ...req.body };
    delete cleanData._id;
    delete cleanData.createdAt;
    delete cleanData.__v;

    // ✅ METTRE À JOUR
    const updated = await Chambre.findByIdAndUpdate(
      id,
      { ...cleanData, updatedAt: new Date() },
      { new: true, runValidators: true }
    );

    console.log('✅ Chambre mise à jour:', {
      id: updated._id,
      number: updated.number
    });

    res.status(200).json({
      success: true,
      message: 'Chambre mise à jour avec succès',
      chambre: updated
    });

  } catch (err) {
    console.error('❌ Erreur mise à jour chambre:', err.message);
    res.status(500).json({ 
      success: false,
      message: 'Erreur lors de la mise à jour de la chambre',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// ✅ SUPPRESSION - AVEC NETTOYAGE CLOUDINARY
exports.deleteChambre = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🗑️ Suppression chambre: ${id}`);

    const chambre = await Chambre.findById(id);
    
    if (!chambre) {
      return res.status(404).json({ 
        success: false,
        message: `Chambre avec l'ID ${id} non trouvée` 
      });
    }

    // ✅ SUPPRIMER LES IMAGES DE CLOUDINARY
    if (chambre.images && chambre.images.length > 0) {
      for (const image of chambre.images) {
        try {
          if (image.cloudinaryId) {
            await deleteFromCloudinary(image.url);
            console.log(`✅ Image Cloudinary supprimée: ${image.cloudinaryId}`);
          }
        } catch (error) {
          console.error('⚠️ Erreur suppression Cloudinary:', error.message);
        }
      }
    }

    // ✅ SOFT DELETE (marquer comme inactif)
    chambre.isActive = false;
    chambre.updatedAt = new Date();
    await chambre.save();

    console.log(`✅ Chambre #${chambre.number} supprimée`);

    res.status(200).json({
      success: true,
      message: 'Chambre supprimée avec succès'
    });

  } catch (err) {
    console.error('❌ Erreur suppression chambre:', err.message);
    res.status(500).json({ 
      success: false,
      message: 'Erreur lors de la suppression de la chambre',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// ✅ UPLOAD IMAGE UNIQUE
exports.uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false,
        message: 'Aucun fichier uploadé' 
      });
    }

    const imageUrl = req.file.path;
    const cloudinaryId = req.file.filename;

    console.log('✅ Image uploadée:', { cloudinaryId, url: imageUrl });

    res.status(200).json({
      success: true,
      message: 'Image uploadée avec succès',
      image: {
        url: imageUrl,
        cloudinaryId: cloudinaryId
      }
    });

  } catch (err) {
    console.error('❌ Erreur upload image:', err.message);
    res.status(500).json({ 
      success: false,
      message: 'Erreur lors de l\'upload de l\'image',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// ✅ UPLOAD MULTIPLE
exports.uploadMultipleImages = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ 
        success: false,
        message: 'Aucun fichier uploadé' 
      });
    }

    const uploadedImages = req.files.map(file => ({
      url: file.path,
      cloudinaryId: file.filename
    }));

    console.log(`✅ ${uploadedImages.length} image(s) uploadée(s)`);

    res.status(200).json({
      success: true,
      message: `${req.files.length} image(s) uploadée(s) avec succès`,
      images: uploadedImages
    });

  } catch (err) {
    console.error('❌ Erreur upload multiple:', err.message);
    res.status(500).json({ 
      success: false,
      message: 'Erreur lors de l\'upload des images',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// ✅ SUPPRESSION IMAGE
exports.deleteImage = async (req, res) => {
  try {
    const { filename } = req.params;
    console.log(`🗑️ Suppression image: ${filename}`);

    try {
      await deleteFromCloudinary(`https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/grand-hotel/rooms/${filename}`);
      console.log(`✅ Image Cloudinary supprimée`);
    } catch (error) {
      console.error('⚠️ Erreur Cloudinary:', error.message);
    }

    await Chambre.updateMany(
      { 'images.cloudinaryId': filename },
      { $pull: { images: { cloudinaryId: filename } } }
    );

    res.status(200).json({
      success: true,
      message: 'Image supprimée avec succès'
    });

  } catch (err) {
    console.error('❌ Erreur suppression image:', err.message);
    res.status(500).json({ 
      success: false,
      message: 'Erreur lors de la suppression de l\'image',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};