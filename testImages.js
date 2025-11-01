// testImages.js - À placer à la racine du backend
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const Chambre = require('./src/models/chambreModel');

const testImages = async () => {
  try {
    console.log('🔍 TEST DES IMAGES\n');
    console.log('==========================================\n');

    // Connexion à MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/grandhotel');
    console.log('✅ Connecté à MongoDB\n');

    // Récupérer toutes les chambres
    const chambres = await Chambre.find({ isActive: true });
    console.log(`📊 ${chambres.length} chambre(s) trouvée(s)\n`);

    // Vérifier le dossier uploads
    const uploadsDir = path.join(__dirname, 'uploads', 'rooms');
    const uploadsExists = fs.existsSync(uploadsDir);
    
    console.log(`📁 Dossier uploads/rooms existe: ${uploadsExists ? '✅ OUI' : '❌ NON'}`);
    
    if (uploadsExists) {
      const files = fs.readdirSync(uploadsDir);
      console.log(`📸 ${files.length} fichier(s) dans uploads/rooms\n`);
      
      if (files.length > 0) {
        console.log('Fichiers trouvés:');
        files.forEach(file => console.log(`  - ${file}`));
        console.log('');
      }
    }

    // Analyser chaque chambre
    chambres.forEach((chambre, index) => {
      console.log(`\n📌 Chambre ${index + 1}: ${chambre.name} (${chambre.number})`);
      console.log(`   ID: ${chambre._id}`);
      console.log(`   Prix: €${chambre.price}`);
      console.log(`   Images: ${chambre.images?.length || 0}`);
      
      if (chambre.images && chambre.images.length > 0) {
        chambre.images.forEach((img, imgIndex) => {
          console.log(`   ${imgIndex + 1}. ${img.isPrimary ? '⭐' : '  '} ${img.url}`);
          
          // Vérifier si l'image existe physiquement
          if (img.url.includes('localhost')) {
            const filename = img.url.split('/').pop();
            const imagePath = path.join(uploadsDir, filename);
            const exists = fs.existsSync(imagePath);
            console.log(`      Fichier existe: ${exists ? '✅' : '❌'}`);
          } else {
            console.log(`      URL externe (Unsplash)`);
          }
        });
      } else {
        console.log('   ⚠️  Aucune image associée');
      }
    });

    console.log('\n==========================================');
    console.log('✅ Test terminé');
    
    await mongoose.connection.close();
    process.exit(0);

  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
};

testImages();