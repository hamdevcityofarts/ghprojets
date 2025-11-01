# --- Étape 1: Build/Construction ---
FROM node:lts-alpine AS build

# Définir le répertoire de travail dans le conteneur
WORKDIR /app

# Copier les fichiers package.json et package-lock.json pour installer les dépendances
COPY package*.json ./

# Installer les dépendances de production uniquement pour réduire la taille de l'image
RUN npm install --only=production

# Copier le reste du code source
COPY . .

# Si vous avez un processus de construction spécifique (ex: Babel, TypeScript), décommentez et ajustez:
# RUN npm run build 
# NOTE : Pour une simple application Node.js, cette étape pourrait ne pas être nécessaire.


# --- Étape 2: Production/Exécution ---
FROM node:lts-slim

# Définir le répertoire de travail
WORKDIR /app

# Copier les dépendances et le code depuis l'étape de construction
# Utilisez l'utilisateur 'node' non-root par défaut pour plus de sécurité
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app .

# Exposer le port sur lequel l'application s'exécute (ici 5000)
# Cela documente le port, mais il doit être mappé lors de l'exécution
EXPOSE 5000

# Assurez-vous que votre application est configurée pour écouter sur 0.0.0.0
# pour être accessible en dehors du conteneur.

# Définir la commande pour démarrer l'application
CMD ["npm", "start"] 
# OU, si votre script "start" pointe vers votre fichier principal (ex: server.js):
# CMD ["node", "server.js"]