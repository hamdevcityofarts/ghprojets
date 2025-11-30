#!/bin/sh

echo "🚀 Démarrage de l'application Grand Hotel..."

# ✅ CORRECTION : NE PAS EXÉCUTER LE SEEDER AUTOMATIQUEMENT EN PRODUCTION
if [ "$NODE_ENV" = "production" ]; then
    echo "🏢 MODE PRODUCTION DÉTECTÉ"
    echo "🚫 AUCUN SEED AUTOMATIQUE - Les données existantes sont préservées"
    echo "🔍 Vérification simple de l'admin uniquement..."
    
    # Utiliser la commande sécurisée qui ne supprime aucune donnée
    npm run seed:safe || echo "⚠️  Échec vérification admin, continuation..."
else
    echo "💻 MODE DÉVELOPPEMENT - Exécution du seeder complet..."
    npm run seed:run || echo "⚠️  Échec seeder, continuation..."
fi

# Lancer la commande principale de l'application (celle qui maintient le conteneur en vie)
echo "🎯 Démarrage de l'application principale..."
exec "$@"
# La ligne 'exec "$@"' lance la commande passée dans CMD du Dockerfile (par exemple, "npm start")