const Chambre = require('../models/chambreModel');
const { deleteFromCloudinary } = require('../middlewares/uploadMiddleware');

// ✅ CRÉATION CORRIGÉE - URLs CLOUDINARY
exports.createChambre = async (req, res) => {
  try {
    console.log('📥 Données reçues:', req.body);
    console.log('📁 Fichiers reçus:', req.files);

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
      amenities 
    } = req.body;

    // ✅ Vérifier si le numéro existe déjà
    const existing = await Chambre.findOne({ number });
    if (existing) {
      return res.status(400).json({ 
        success: false,
        message: 'Une chambre avec ce numéro existe déjà' 
      });
    }

    // ✅ CLOUDINARY: Les fichiers uploadés contiennent déjà les URLs
    let images = [];
    if (req.files && req.files.length > 0) {
      images = req.files.map((file, index) => ({
        url: file.path, // ✅ Cloudinary stocke l'URL dans file.path
        cloudinaryId: file.filename, // ✅ ID Cloudinary pour suppression future
        alt: `${name || 'Chambre'} - Image ${index + 1}`,
        isPrimary: index === 0,
        order: index
      }));
      console.log('🖼️ Images Cloudinary créées:', images);
    }

    // ✅ CRÉER LA CHAMBRE AVEC LES IMAGES
    const chambre = await Chambre.create({
      number,
      name,
      type,
      category,
      capacity: parseInt(capacity),
      price: parseFloat(price),
      currency: 'XAF',
      size,
      bedType,
      status: status || 'disponible',
      description,
      amenities: Array.isArray(amenities) ? amenities : (amenities ? [amenities] : []),
      images: images
    });

    console.log('✅ Chambre créée avec succès (Cloudinary):', {
      id: chambre._id,
      number: chambre.number,
      images: chambre.images.length
    });

    res.status(201).json({
      success: true,
      message: 'Chambre créée avec succès',
      chambre
    });
  } catch (err) {
    console.error('❌ Erreur création chambre:', err);
    res.status(500).json({ 
      success: false,
      message: 'Erreur lors de la création de la chambre',
      error: err.message 
    });
  }
};

// ✅ AUTRES FONCTIONS (inchangées)
exports.getChambres = async (req, res) => {
  try {
    const chambres = await Chambre.find({ isActive: true });
    
    res.json({
      success: true,
      count: chambres.length,
      chambres
    });
  } catch (err) {
    console.error('❌ Erreur récupération chambres:', err);
    res.status(500).json({ 
      success: false,
      message: 'Erreur lors de la récupération des chambres',
      error: err.message 
    });
  }
};

exports.getChambreById = async (req, res) => {
  try {
    const chambre = await Chambre.findById(req.params.id);
    
    if (!chambre) {
      return res.status(404).json({ 
        success: false,
        message: 'Chambre non trouvée' 
      });
    }

    res.json({
      success: true,
      chambre
    });
  } catch (err) {
    console.error('❌ Erreur récupération chambre:', err);
    res.status(500).json({ 
      success: false,
      message: 'Erreur lors de la récupération de la chambre',
      error: err.message 
    });
  }
};

exports.updateChambre = async (req, res) => {
  try {
    const chambre = await Chambre.findById(req.params.id);
    
    if (!chambre) {
      return res.status(404).json({ 
        success: false,
        message: 'Chambre non trouvée' 
      });
    }

    Object.assign(chambre, req.body);
    await chambre.save();

    res.json({
      success: true,
      message: 'Chambre mise à jour avec succès',
      chambre
    });
  } catch (err) {
    console.error('❌ Erreur mise à jour chambre:', err);
    res.status(500).json({ 
      success: false,
      message: 'Erreur lors de la mise à jour de la chambre',
      error: err.message 
    });
  }
};

// ✅ SUPPRESSION MODIFIÉE - CLOUDINARY
exports.deleteChambre = async (req, res) => {
  try {
    const chambre = await Chambre.findById(req.params.id);
    
    if (!chambre) {
      return res.status(404).json({ 
        success: false,
        message: 'Chambre non trouvée' 
      });
    }

    // ✅ SUPPRIMER LES IMAGES DE CLOUDINARY
    if (chambre.images && chambre.images.length > 0) {
      for (const image of chambre.images) {
        try {
          await deleteFromCloudinary(image.url);
          console.log('✅ Image Cloudinary supprimée:', image.cloudinaryId);
        } catch (error) {
          console.error('⚠️ Erreur suppression Cloudinary:', error);
          // Continue même si la suppression échoue
        }
      }
    }

    chambre.isActive = false;
    await chambre.save();

    res.json({
      success: true,
      message: 'Chambre supprimée avec succès'
    });
  } catch (err) {
    console.error('❌ Erreur suppression chambre:', err);
    res.status(500).json({ 
      success: false,
      message: 'Erreur lors de la suppression de la chambre',
      error: err.message 
    });
  }
};

// ✅ UPLOAD UNIQUE MODIFIÉ - CLOUDINARY
exports.uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false,
        message: 'Aucun fichier uploadé' 
      });
    }

    // ✅ Cloudinary retourne l'URL dans req.file.path
    const imageUrl = req.file.path;
    const cloudinaryId = req.file.filename;

    console.log('✅ Image uploadée sur Cloudinary:', {
      cloudinaryId,
      url: imageUrl
    });

    res.json({
      success: true,
      message: 'Image uploadée avec succès',
      image: {
        url: imageUrl,
        cloudinaryId: cloudinaryId
      }
    });
  } catch (err) {
    console.error('❌ Erreur upload image:', err);
    res.status(500).json({ 
      success: false,
      message: 'Erreur lors de l\'upload de l\'image',
      error: err.message 
    });
  }
};

// ✅ UPLOAD MULTIPLE MODIFIÉ - CLOUDINARY
exports.uploadMultipleImages = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ 
        success: false,
        message: 'Aucun fichier uploadé' 
      });
    }

    const uploadedImages = req.files.map(file => ({
      url: file.path, // URL Cloudinary
      cloudinaryId: file.filename
    }));

    console.log('✅ Images uploadées sur Cloudinary:', uploadedImages.length);

    res.json({
      success: true,
      message: `${req.files.length} image(s) uploadée(s) avec succès`,
      images: uploadedImages
    });
  } catch (err) {
    console.error('❌ Erreur upload multiple images:', err);
    res.status(500).json({ 
      success: false,
      message: 'Erreur lors de l\'upload des images',
      error: err.message 
    });
  }
};

// ✅ SUPPRESSION IMAGE MODIFIÉE - CLOUDINARY
exports.deleteImage = async (req, res) => {
  try {
    const { filename } = req.params;

    // ✅ Supprimer de Cloudinary
    try {
      const publicId = `grand-hotel/rooms/${filename}`;
      await deleteFromCloudinary(`https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/${publicId}`);
      console.log(`✅ Image Cloudinary supprimée: ${publicId}`);
    } catch (error) {
      console.error('⚠️ Erreur suppression Cloudinary:', error);
    }

    // ✅ Retirer de la base de données
    await Chambre.updateMany(
      { 'images.cloudinaryId': filename },
      { $pull: { images: { cloudinaryId: filename } } }
    );

    res.json({
      success: true,
      message: 'Image supprimée avec succès'
    });
  } catch (err) {
    console.error('❌ Erreur suppression image:', err);
    res.status(500).json({ 
      success: false,
      message: 'Erreur lors de la suppression de l\'image',
      error: err.message 
    });
  }
};