// src/utils/seeder.js

const User = require('../models/userModel');
const Chambre = require('../models/chambreModel');
const Reservation = require('../models/reservationModel');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const connectDB = require('../config/db');

dotenv.config();

// ================= CONFIG ADMIN =================
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@grandhotel.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin123!';
const ADMIN_NAME = 'Super';
const ADMIN_SURNAME = 'Admin';

// ================= CONSTANTES =================
const roomTypes = [
  { value: 'standard', label: 'Chambre Standard' },
  { value: 'superior', label: 'Chambre Supérieure' },
  { value: 'deluxe', label: 'Chambre Deluxe' },
  { value: 'suite', label: 'Suite' },
  { value: 'family', label: 'Chambre Familiale' },
  { value: 'executive', label: 'Suite Exécutive' },
  { value: 'presidential', label: 'Suite Présidentielle' }
];

const roomCategories = [
  { value: 'single', label: 'Single' },
  { value: 'double', label: 'Double' },
  { value: 'twin', label: 'Twin' },
  { value: 'triple', label: 'Triple' },
  { value: 'quad', label: 'Quadruple' },
  { value: 'family', label: 'Familiale' }
];

const bedTypes = [
  { value: 'single_bed', label: '1 lit simple' },
  { value: 'double_bed', label: '1 lit double' },
  { value: 'twin_beds', label: '2 lits simples' },
  { value: 'double_twin', label: '1 lit double + 1 lit simple' },
  { value: 'king_bed', label: '1 lit king size' },
  { value: 'queen_bed', label: '1 lit queen size' },
  { value: 'sofa_bed', label: 'Canapé-lit' },
  { value: 'bunk_bed', label: 'Lits superposés' }
];

const allAmenities = [
  { id: 'wifi', label: 'WiFi haute vitesse', icon: '📶' },
  { id: 'tv', label: 'TV écran plat', icon: '📺' },
  { id: 'ac', label: 'Climatisation', icon: '❄️' },
  { id: 'heating', label: 'Chauffage', icon: '🔥' },
  { id: 'minibar', label: 'Mini-bar', icon: '🍷' },
  { id: 'safe', label: 'Coffre-fort', icon: '🔒' },
  { id: 'balcony', label: 'Balcon', icon: '🌅' },
  { id: 'view', label: 'Vue mer/montagne', icon: '🏞️' },
  { id: 'room_service', label: 'Room service', icon: '🍽️' },
  { id: 'jacuzzi', label: 'Jacuzzi', icon: '🛁' },
  { id: 'shower', label: 'Douche italienne', icon: '🚿' },
  { id: 'bathrobe', label: 'Peignoirs', icon: '👘' },
  { id: 'slippers', label: 'Chaussons', icon: '🩴' },
  { id: 'desk', label: 'Bureau', icon: '💻' },
  { id: 'sofa', label: 'Canapé', icon: '🛋️' },
  { id: 'kitchenette', label: 'Kitchenette', icon: '🍳' },
  { id: 'tea_coffee', label: 'Thé/Café', icon: '☕' },
  { id: 'iron', label: 'Fer à repasser', icon: '🧺' },
  { id: 'hair_dryer', label: 'Sèche-cheveux', icon: '💇' },
  { id: 'accessible', label: 'Accès handicapé', icon: '♿' }
];

// ================= IMAGES =================
const ROOM_IMAGES = [
  'https://res.cloudinary.com/ddbprltwf/image/upload/v1767786389/grand-hotel/rooms/k5ce0lpzd1nhjg9benc7.jpg',
  'https://res.cloudinary.com/ddbprltwf/image/upload/v1765627648/grand-hotel/rooms/dcom9wejquzxfbjf3yga.jpg',
  'https://res.cloudinary.com/ddbprltwf/image/upload/v1764600019/grand-hotel/rooms/yms7s2iuhecqpdqavcpa.jpg',
  'https://res.cloudinary.com/ddbprltwf/image/upload/v1764598885/grand-hotel/rooms/c700qh3cc1wq1cfxa5gi.jpg',
  'https://res.cloudinary.com/ddbprltwf/image/upload/v1764522123/grand-hotel/rooms/iow9fbbh8uiimmpwm8lx.jpg'
];

const ROOM_CITIES = [
  "Douala","Yaoundé","Abidjan","Dakar","Lagos",
  "Nairobi","Casablanca","Tunis","Cape Town","Accra",
  "Paris","Londres","Rome","Berlin","Madrid"
];

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
  text.toLowerCase().replace(/\s+/g, "-").replace(/[^\w\-]+/g, "");
const randomImages = () => {
  const shuffled = [...ROOM_IMAGES].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.random() > 0.5 ? 4 : 3).map((url, index) => ({
    url,
    public_id: `room_seed_${Date.now()}_${index}`
  }));
};
const randomAmenities = () => {
  const shuffled = [...allAmenities].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.floor(Math.random() * 5) + 3).map(a => a.id);
};

// ================= SEED ADMIN =================
const seedAdminUser = async () => {
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
};

// ================= SEED CHAMBRES =================
const seedRooms = async () => {
  console.log("🏨 Création des chambres...");
  const rooms = [];

  for (let i = 1; i <= 15; i++) {
    const type = random(roomTypes).value;
    const category = random(roomCategories).value;
    const bedType = random(bedTypes).value;
    const city = random(ROOM_CITIES);
    const name = `${type.toUpperCase()} ${city} ${100 + i}`;
    let price = 100 + Math.floor(Math.random() * 200);

    rooms.push({
      name,
      slug: slugify(name),
      description: random(DESCRIPTIONS),
      type,
      category,
      bedType,
      price,
      discountPrice: Math.random() > 0.7 ? price - Math.floor(Math.random() * 30) : null,
      capacity: category === "single" ? 1 : category === "double" ? 2 : category === "family" ? 4 : 2,
      size: Math.floor(Math.random() * 30) + 25,
      floor: Math.floor(Math.random() * 5) + 1,
      number: 100 + i,
      amenities: randomAmenities(),
      rating: (Math.random() * 2 + 3).toFixed(1),
      featured: Math.random() > 0.8,
      status: "disponible",
      images: randomImages()
    });
  }

  await Chambre.insertMany(rooms);
  console.log(`✅ ${rooms.length} chambres créées`);
};

// ================= CLEAN DATABASE =================
const cleanDatabase = async () => {
  console.log("🧹 Nettoyage BDD");
  await Chambre.deleteMany({});
  await Reservation.deleteMany({});
  console.log("✅ Chambres et réservations supprimées");
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
module.exports = { resetDatabase };

// ================= EXECUTION DIRECTE =================
if (require.main === module) {
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