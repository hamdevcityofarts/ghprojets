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

# Mettre à jour le système et installer les dépendances système pour Puppeteer
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    procps \
    && apt-get update && apt-get install -y \
    chromium \
    chromium-sandbox \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Variables d'environnement pour Puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV CHROME_PATH=/usr/bin/chromium
ENV CHROMIUM_PATH=/usr/bin/chromium

# Créer un répertoire pour les fonts (optionnel mais recommandé)
RUN mkdir -p /usr/share/fonts/truetype \
    && ln -s /usr/share/fonts/truetype /usr/share/fonts/TTF

# Copier les dépendances et le code depuis l'étape de construction
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app .

# Vérifier que Chromium est installé
RUN echo "Vérification de l'installation de Chromium:" \
    && chromium --version || echo "Chromium non trouvé" \
    && which chromium || echo "Chemin Chromium non défini"

COPY entrypoint.sh /usr/local/bin/entrypoint.sh

# Rendre le script exécutable
RUN chmod +x /usr/local/bin/entrypoint.sh

# Exposer le port sur lequel l'application s'exécute (ici 5000)
EXPOSE 5000

# Définir le script comme le point d'entrée du conteneur
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]

# Définir la commande pour démarrer l'application
CMD ["npm", "start"]