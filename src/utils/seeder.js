// src/utils/seeder.js
const User = require('../models/userModel');
const Chambre = require('../models/chambreModel');
const Reservation = require('../models/reservationModel');
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

// ==================== FONCTION DE NETTOYAGE (DÉSACTIVÉE) ====================
const cleanDatabase = async () => {
  try {
    console.log('🧹 NETTOYAGE DÉSACTIVÉ - Aucune donnée ne sera supprimée');
    console.log('ℹ️  Cette fonction est désactivée en production pour préserver les données');
    
    // ✅ CORRECTION : NE RIEN SUPPRIMER EN PRODUCTION
    if (process.env.NODE_ENV === 'production') {
      console.log('🚫 Mode production: suppression des données désactivée');
      return {
        deletedUsers: 0,
        deletedRooms: 0,
        deletedReservations: 0
      };
    }
    
    // ❌ NE JAMAIS EXÉCUTER EN PRODUCTION
    console.log('⚠️  ATTENTION: Cette opération supprimerait des données en développement uniquement');
    
  } catch (error) {
    console.error('❌ Erreur nettoyage:', error.message);
    throw error;
  }
};

// ==================== FONCTION DE RÉINITIALISATION (SÉCURISÉE) ====================
const resetDatabase = async () => {
  try {
    console.log('🔄 RÉINITIALISATION SÉCURISÉE');
    console.log('================================================\n');
    
    // ✅ CORRECTION : EN PRODUCTION, SEULEMENT CRÉER L'ADMIN SI NÉCESSAIRE
    if (process.env.NODE_ENV === 'production') {
      console.log('🏢 MODE PRODUCTION DÉTECTÉ');
      console.log('🚫 AUCUNE DONNÉE NE SERA SUPPRIMÉE');
      console.log('🔐 Vérification/création de l\'admin uniquement...\n');
      
      await seedAdminUser();
      
      console.log('\n✅ RÉINITIALISATION SÉCURISÉE TERMINÉE !');
      console.log('================================================');
      console.log('📊 Statut: Données préservées, admin vérifié/créé');
      console.log('================================================\n');
      return;
    }
    
    // 🔧 EN DÉVELOPPEMENT UNIQUEMENT : nettoyage complet
    console.log('💻 MODE DÉVELOPPEMENT - Nettoyage complet activé');
    await cleanDatabase();
    await seedAdminUser();
    
    console.log('\n✅ RÉINITIALISATION DÉVELOPPEMENT TERMINÉE !');
    
  } catch (error) {
    console.error('❌ Erreur lors de la réinitialisation:', error.message);
    throw error;
  }
};

// ==================== NOUVELLE FONCTION : VÉRIFICATION SIMPLE ====================
const checkAndCreateAdmin = async () => {
  try {
    console.log('🔍 Vérification de l\'utilisateur admin...');
    await seedAdminUser();
    console.log('✅ Vérification admin terminée');
  } catch (error) {
    console.error('❌ Erreur vérification admin:', error.message);
    throw error;
  }
};

// ==================== EXPORTS ====================
module.exports = {
  seedAdminUser,
  cleanDatabase,
  resetDatabase,
  checkAndCreateAdmin  // ✅ NOUVELLE FONCTION SÉCURISÉE
};

// ==================== EXECUTION DIRECTE ====================
// Si ce fichier est exécuté directement
if (require.main === module) {
  const mongoose = require('mongoose');
  const connectDB = require('../config/db');
  
  const run = async () => {
    try {
      await connectDB();
      
      // ✅ CORRECTION : Utiliser la fonction sécurisée au lieu de resetDatabase
      if (process.env.NODE_ENV === 'production') {
        console.log('🏢 EXÉCUTION EN PRODUCTION');
        await checkAndCreateAdmin();
      } else {
        console.log('💻 EXÉCUTION EN DÉVELOPPEMENT');
        await resetDatabase();
      }
      
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