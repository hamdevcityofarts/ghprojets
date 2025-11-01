#!/bin/sh

# Optionnel : Attendre que la base de données soit disponible si elle est un autre conteneur
# (Vous auriez besoin d'outils comme 'wait-for-it.sh' ou d'utiliser docker-compose 'depends_on'
# et 'condition: service_healthy' pour une attente plus robuste.)

echo "Exécution du script de seeding (npm run seed:run)..."
# Exécuter la commande de seeding. Si elle échoue, le conteneur s'arrête.
npm run seed:run

# Lancer la commande principale de l'application (celle qui maintient le conteneur en vie)
echo "Démarrage de l'application..."
exec "$@"
# La ligne 'exec "$@"' lance la commande passée dans CMD du Dockerfile (par exemple, "npm start")