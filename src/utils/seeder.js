// src/utils/seeder.js
const User = require('../models/userModel');
const Chambre = require('../models/chambreModel');
const Reservation = require('../models/reservationModel'); // IMPORT AJOUTÉ
const dotenv = require('dotenv');

dotenv.config();

// ==================== CONFIGURATION ADMIN ====================
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@grandhotel.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin123!';
const ADMIN_NAME = 'Super';
const ADMIN_SURNAME = 'Admin';

// ==================== FONCTION SEEDER ADMIN AMÉLIORÉE ====================
const seedAdminUser = async () => {
  try {
    const adminUser = await User.findOne({ email: ADMIN_EMAIL });

    if (adminUser) {
      console.log(`ℹ️  Admin existe déjà: ${ADMIN_EMAIL}`);
      
      // CORRECTION: Vérifier si le mot de passe fonctionne
      const testPassword = await adminUser.matchPassword(ADMIN_PASSWORD);
      if (!testPassword) {
        console.log('⚠️  Mot de passe admin incorrect, réinitialisation...');
        adminUser.password = ADMIN_PASSWORD; // Le pre-save hook va hasher
        await adminUser.save();
        console.log('✅ Mot de passe admin réinitialisé');
      } else {
        console.log('✅ Mot de passe admin valide');
      }
      return;
    }

    // Créer le nouvel admin
    await User.create({
      name: ADMIN_NAME,
      surname: ADMIN_SURNAME,
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD, // Sera hashé automatiquement par le pre-save hook
      phone: '+33 1 23 45 67 89',
      department: 'direction',
      role: 'admin',
      status: 'actif',
      permissions: [
        'gestion_utilisateurs',
        'gestion_chambres',
        'gestion_reservations',
        'gestion_clients',
        'acces_finances',
        'rapports',
        'parametres_systeme',
        'gestion_menage',
        'gestion_restaurant'
      ],
      hireDate: new Date(),
      memberSince: new Date(),
      lastLogin: new Date()
    });
    
    console.log(`✅ Utilisateur Admin créé : ${ADMIN_EMAIL}`);
    console.log(`🔑 Mot de passe : ${ADMIN_PASSWORD}`);
  } catch (error) {
    console.error(`❌ Échec admin : ${error.message}`);
    throw error;
  }
};

// ==================== FONCTION DE NETTOYAGE ====================
const cleanDatabase = async () => {
  try {
    console.log('🧹 Nettoyage de la base de données...');
    
    // Supprimer tous les utilisateurs sauf admin
    const deletedUsers = await User.deleteMany({ 
      email: { $ne: ADMIN_EMAIL } 
    });
    console.log(`✅ ${deletedUsers.deletedCount} utilisateurs supprimés`);
    
    // Supprimer toutes les chambres
    const deletedRooms = await Chambre.deleteMany({});
    console.log(`✅ ${deletedRooms.deletedCount} chambres supprimées`);
    
    // NOUVELLE LIGNE AJOUTÉE : Supprimer toutes les réservations
    const deletedReservations = await Reservation.deleteMany({});
    console.log(`✅ ${deletedReservations.deletedCount} réservations supprimées`);
    
  } catch (error) {
    console.error('❌ Erreur nettoyage:', error.message);
    throw error;
  }
};

// ==================== FONCTION DE RÉINITIALISATION COMPLÈTE ====================
const resetDatabase = async () => {
  try {
    console.log('🔄 RÉINITIALISATION COMPLÈTE DE LA BASE DE DONNÉES');
    console.log('================================================\n');
    
    // 1. Nettoyer
    await cleanDatabase();
    
    // 2. Recréer l'admin avec mot de passe propre
    console.log('\n🔐 Recréation de l\'utilisateur admin...');
    await User.deleteOne({ email: ADMIN_EMAIL }); // Supprimer l'ancien
    await seedAdminUser(); // Créer un nouveau
    
    console.log('\n✅ RÉINITIALISATION TERMINÉE !');
    console.log('================================================');
    console.log(`📧 Email: ${ADMIN_EMAIL}`);
    console.log(`🔑 Mot de passe: ${ADMIN_PASSWORD}`);
    console.log('================================================\n');
    
  } catch (error) {
    console.error('❌ Erreur lors de la réinitialisation:', error.message);
    throw error;
  }
};

// ==================== EXPORTS ====================
module.exports = {
  seedAdminUser,
  cleanDatabase,
  resetDatabase
};

// ==================== EXECUTION DIRECTE ====================
// Si ce fichier est exécuté directement
if (require.main === module) {
  const mongoose = require('mongoose');
  const connectDB = require('../config/db');
  
  const run = async () => {
    try {
      await connectDB();
      await resetDatabase();
      await mongoose.connection.close();
      console.log('✅ Connexion fermée');
      process.exit(0);
    } catch (error) {
      console.error('❌ Erreur:', error);
      process.exit(1);
    }
  };
  
  run();
}