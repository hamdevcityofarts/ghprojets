// src/utils/seeder.js

const User = require('../models/userModel');
const Chambre = require('../models/chambreModel');
const Reservation = require('../models/reservationModel');
const dotenv = require('dotenv');

dotenv.config();


// ================= CONFIG ADMIN =================

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@grandhotel.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin123!';
const ADMIN_NAME = 'Super';
const ADMIN_SURNAME = 'Admin';


// ================= IMAGES CLOUDINARY =================

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


// ================= VILLES =================

const ROOM_CITIES = [
"Douala","Yaoundé","Abidjan","Dakar","Lagos",
"Nairobi","Casablanca","Tunis","Cape Town","Accra",
"Paris","Londres","Rome","Berlin","Madrid",
"Amsterdam","Lisbonne","Bruxelles","Genève","Vienne"
];


// ================= DESCRIPTIONS =================

const DESCRIPTIONS = [
"Chambre luxueuse offrant un confort exceptionnel avec vue panoramique.",
"Suite élégante idéale pour un séjour relaxant avec lit king-size.",
"Chambre premium parfaite pour les voyageurs d'affaires.",
"Suite raffinée combinant élégance moderne et confort.",
"Chambre spacieuse avec ambiance chaleureuse et prestations haut de gamme."
];


// ================= UTILITAIRES =================

const random = (arr) => arr[Math.floor(Math.random() * arr.length)];

const slugify = (text) =>
text
  .toLowerCase()
  .replace(/\s+/g, "-")
  .replace(/[^\w\-]+/g, "");

const randomImages = () => {

  const shuffled = [...ROOM_IMAGES].sort(() => 0.5 - Math.random());

  return shuffled
    .slice(0, Math.random() > 0.5 ? 4 : 3)
    .map((url, index) => ({
      url,
      public_id: `room_seed_${Date.now()}_${index}`
    }));

};


// ================= SEED ADMIN =================

const seedAdminUser = async () => {

  try {

    const admin = await User.findOne({ email: ADMIN_EMAIL });

    if (admin) {
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

    console.error("❌ Erreur création admin:", error);

  }

};


// ================= SEED CHAMBRES =================

const seedRooms = async () => {

  try {

    console.log("🏨 Création des chambres...");

    const rooms = [];

    for (let i = 1; i <= 15; i++) {

      const city = random(ROOM_CITIES);
      const roomType = random(["standard", "deluxe", "suite"]);

      const price =
        roomType === "standard"
          ? Math.floor(Math.random() * 60) + 80
          : roomType === "deluxe"
          ? Math.floor(Math.random() * 80) + 140
          : Math.floor(Math.random() * 120) + 220;

      const name = `${roomType.toUpperCase()} ${city}`;

      rooms.push({

        name,

        slug: slugify(name),

        description: random(DESCRIPTIONS),

        type: roomType,

        category: random(["single", "double", "family"]),

        bedType: random(["queen", "king", "double"]),

        price,

        discountPrice:
          Math.random() > 0.7 ? price - Math.floor(Math.random() * 30) : null,

        capacity: Math.floor(Math.random() * 3) + 2,

        size: Math.floor(Math.random() * 30) + 25,

        floor: Math.floor(Math.random() * 5) + 1,

        number: 100 + i,

        amenities: [
          "WiFi",
          "Climatisation",
          "TV écran plat",
          "Mini bar",
          "Salle de bain privée"
        ],

        rating: (Math.random() * 2 + 3).toFixed(1),

        featured: Math.random() > 0.8,

        status: "disponible",

        images: randomImages()

      });

    }

    await Chambre.insertMany(rooms);

    console.log(`✅ ${rooms.length} chambres créées`);

  } catch (error) {

    console.error("❌ Erreur création chambres:", error);

  }

};


// ================= CLEAN DATABASE =================

const cleanDatabase = async () => {

  try {

    console.log("🧹 Nettoyage BDD");

    await Chambre.deleteMany({});
    await Reservation.deleteMany({});

    console.log("✅ Chambres et réservations supprimées");

  } catch (error) {

    console.error("❌ Erreur nettoyage:", error);

  }

};


// ================= RESET DATABASE =================

const resetDatabase = async () => {

  console.log("\n🚀 RESET DATABASE\n");

  await cleanDatabase();

  await seedAdminUser();

  await seedRooms();

  console.log("\n✅ SEED TERMINÉ\n");

};


// ================= EXPORT =================

module.exports = {
  resetDatabase
};


// ================= EXECUTION DIRECTE =================

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