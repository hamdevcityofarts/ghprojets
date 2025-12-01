#!/bin/sh

echo "🚀 Démarrage de l'application Grand Hotel..."

# ✅ CORRECTION : NE PAS EXÉCUTER LE SEEDER AUTOMATIQUEMENT EN PRODUCTION
if [ "$NODE_ENV" = "production" ]; then
    echo "🏢 MODE PRODUCTION DÉTECTÉ"
    echo "🚫 AUCUN SEED AUTOMATIQUE - Les données existantes sont préservées"
    echo "🔍 Vérification simple de l'admin uniquement..."
    
    # Utiliser la commande sécurisée qui ne supprime aucune donnée
    npm run seed:safe 2>/dev/null || echo "⚠️  Échec vérification admin, continuation..."
else
    echo "💻 MODE DÉVELOPPEMENT - Exécution du seeder complet..."
    npm run seed:run 2>/dev/null || echo "⚠️  Échec seeder, continuation..."
fi

# ✅ VÉRIFICATION PUPPETEER POUR PDF
echo "📄 Vérification de la génération PDF..."

# Définir les chemins par défaut
CHROME_PATH="/usr/bin/chromium"
export PUPPETEER_EXECUTABLE_PATH="$CHROME_PATH"
export CHROME_PATH="$CHROME_PATH"

if [ -f "$CHROME_PATH" ]; then
    echo "✅ Chromium disponible pour la génération de PDF"
else
    echo "⚠️  Chromium non trouvé - PDF désactivés (mode HTML seulement)"
    # Essayer d'autres chemins
    ALTERNATIVES="/usr/bin/google-chrome-stable /usr/bin/chromium-browser"
    for alt in $ALTERNATIVES; do
        if [ -f "$alt" ]; then
            echo "✅ Alternative trouvée: $alt"
            export PUPPETEER_EXECUTABLE_PATH="$alt"
            export CHROME_PATH="$alt"
            break
        fi
    done
fi

# ✅ PRÉPARATION
echo "📁 Préparation des répertoires..."
mkdir -p /app/logs /app/receipts 2>/dev/null

echo "🎯 Démarrage de l'application principale..."
exec "$@"