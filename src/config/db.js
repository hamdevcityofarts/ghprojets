const mongoose = require('mongoose');

/**
 * @description Tente d'établir une connexion à la base de données MongoDB.
 * L'URI de connexion est lue depuis process.env.MONGO_URI.
 */
const connectDB = async () => {
  try {
    // Connexion à MongoDB. Les options de connexion sont maintenant gérées 
    // par défaut par Mongoose. La BD est créée à la première insertion.
    await mongoose.connect(process.env.MONGODB_URI);
    
    console.log('✅ MongoDB connecté avec succès');
  } catch (err) {
    console.error('❌ Erreur de connexion MongoDB :', err.message);
    // Arrêter le processus en cas d'échec critique de connexion
    process.exit(1); 
  }
};

module.exports = connectDB;
