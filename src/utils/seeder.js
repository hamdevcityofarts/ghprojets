// src/utils/seeder.js

const User = require('../models/userModel');
const Chambre = require('../models/chambreModel');
const Reservation = require('../models/reservationModel');
const dotenv = require('dotenv');

dotenv.config();

// ==================== CONFIG ADMIN ====================

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@grandhotel.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin123!';
const ADMIN_NAME = 'Super';
const ADMIN_SURNAME = 'Admin';

// ==================== IMAGES CLOUDINARY ====================

const ROOM_IMAGES = [
'https://res.cloudinary.com/ddbprltwf/image/upload/v1767786389/grand-hotel/rooms/k5ce0lpzd1nhjg9benc7.jpg',
'https://res.cloudinary.com/ddbprltwf/image/upload/v1765627648/grand-hotel/rooms/dcom9wejquzxfbjf3yga.jpg',
'https://res.cloudinary.com/ddbprltwf/image/upload/v1764600019/grand-hotel/rooms/yms7s2iuhecqpdqavcpa.jpg',
'https://res.cloudinary.com/ddbprltwf/image/upload/v1764598885/grand-hotel/rooms/c700qh3cc1wq1cfxa5gi.jpg',
'https://res.cloudinary.com/ddbprltwf/image/upload/v1764522123/grand-hotel/rooms/iow9fbbh8uiimmpwm8lx.jpg',
'https://res.cloudinary.com/ddbprltwf/image/upload/v1764514482/grand-hotel/rooms/wpyxsh1oviwkcfh9cv8t.jpg',
'https://res.cloudinary.com/ddbprltwf/image/upload/v1764514047/grand-hotel/rooms/gn1jyjixe1foud6oyr5n.jpg',
'https://res.cloudinary.com/ddbprltwf/image/upload/v1764512420/grand-hotel/rooms/z2qui4qddskzh2xoonhu.jpg',
'https://res.cloudinary.com/ddbprltwf/image/upload/v1764337774/grand-hotel/rooms/hv5hokdyv36c7yrdykgg.jpg'
];

// ==================== VILLES ====================

const ROOM_CITIES = [
"Douala",
"Yaoundé",
"Abidjan",
"Dakar",
"Lagos",
"Nairobi",
"Casablanca",
"Tunis",
"Cape Town",
"Accra",
"Paris",
"Londres",
"Rome",
"Berlin",
"Madrid",
"Amsterdam",
"Lisbonne",
"Bruxelles",
"Genève",
"Vienne"
];

// ==================== DESCRIPTIONS ====================

const DESCRIPTIONS = [
"Chambre luxueuse offrant un confort exceptionnel avec vue panoramique et décoration moderne.",
"Suite élégante parfaite pour un séjour relaxant avec lit king-size et espace salon.",
"Chambre premium idéale pour les voyageurs d'affaires et les séjours touristiques.",
"Suite raffinée combinant élégance contemporaine et équipements haut de gamme.",
"Chambre spacieuse avec ambiance chaleureuse et prestations de qualité."
];

// ==================== UTILITAIRE ALEATOIRE ====================

const random = (arr) => arr[Math.floor(Math.random() * arr.length)];

const randomImages = () => {
  const shuffled = [...ROOM_IMAGES].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.random() > 0.5 ? 4 : 3);
};

// ==================== SEED ADMIN ====================

const seedAdminUser = async () => {
  try {

    const adminUser = await User.findOne({ email: ADMIN_EMAIL });

    if (adminUser) {
      console.log(`ℹ️ Admin existe déjà: ${ADMIN_EMAIL}`);
      return;
    }

    await User.create({
      name: ADMIN_NAME,
      surname: ADMIN_SURNAME,
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
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

    console.log(`✅ Admin créé : ${ADMIN_EMAIL}`);

  } catch (error) {
    console.error('❌ Erreur création admin', error);
  }
};

// ==================== SEED CHAMBRES ====================

const seedRooms = async () => {

  try {

    console.log("🏨 Création des chambres...");

    const rooms = [];

    for (let i = 1; i <= 15; i++) {

      const city = random(ROOM_CITIES);

      rooms.push({
        name: `Suite ${city}`,
        description: random(DESCRIPTIONS),
        price: Math.floor(Math.random() * 200) + 80,
        capacity: Math.floor(Math.random() * 3) + 2,
        size: Math.floor(Math.random() * 30) + 25,
        amenities: [
          "WiFi",
          "Climatisation",
          "TV écran plat",
          "Mini bar",
          "Salle de bain privée"
        ],
        images: randomImages(),
        status: "disponible",
        number: 100 + i,
        floor: Math.floor(Math.random() * 5) + 1
      });

    }

    await Chambre.insertMany(rooms);

    console.log(`✅ ${rooms.length} chambres créées`);

  } catch (error) {

    console.error("❌ Erreur création chambres", error);

  }

};

// ==================== CLEAN DATABASE ====================

const cleanDatabase = async () => {

  try {

    console.log("🧹 Nettoyage BDD");

    await Chambre.deleteMany({});
    await Reservation.deleteMany({});

    console.log("✅ Chambres et réservations supprimées");

  } catch (error) {

    console.error("❌ Erreur nettoyage", error);

  }

};

// ==================== RESET DATABASE ====================

const resetDatabase = async () => {

  console.log("\n🚀 RESET DATABASE\n");

  await cleanDatabase();

  await seedAdminUser();

  await seedRooms();

  console.log("\n✅ SEED TERMINÉ\n");

};

// ==================== EXPORT ====================

module.exports = {
  resetDatabase
};

// ==================== EXECUTION DIRECTE ====================

if (require.main === module) {

  const mongoose = require('mongoose');
  const connectDB = require('../config/db');

  const run = async () => {

    try {

      await connectDB();

      await resetDatabase();

      await mongoose.connection.close();

      console.log("✅ Connexion fermée");

      process.exit(0);

    } catch (error) {

      console.error(error);

      process.exit(1);

    }

  };

  run();

}