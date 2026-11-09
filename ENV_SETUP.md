# Configuration des variables d'environnement

Créez un fichier `.env` à la racine du projet avec le contenu suivant :

```env
# MongoDB
# Pour MongoDB local :
MONGODB_URI=mongodb://localhost:27017/casting-app

# Pour MongoDB Atlas (cloud) :
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/casting-app?retryWrites=true&w=majority

# JWT Secret
# ⚠️ IMPORTANT : Changez cette clé en production avec une valeur aléatoire forte !
JWT_SECRET=your-secret-key-change-in-production-use-a-strong-random-string

# Port du serveur
PORT=3000

# Hedera Network (pour les NFTs)
# HEDERA_NETWORK=testnet  # ou 'mainnet' pour la production
# HEDERA_ACCOUNT_ID=0.0.1234567
# HEDERA_PRIVATE_KEY=302e020100300506032b657004220420...
# HEDERA_TOKEN_ID=0.0.1234567  # Optionnel, sera créé automatiquement

# NFT Image Base URL (optionnel)
# NFT_IMAGE_BASE_URL=http://localhost:3000

# API Base URL / Production URL (pour les URLs d'images de casting)
# En développement :
# API_BASE_URL=http://localhost:3000
# PRODUCTION_URL=http://localhost:3000

# En production (Vercel) :
# PRODUCTION_URL=https://cast-mate.vercel.app
# API_BASE_URL=https://cast-mate.vercel.app

# CORS (optionnel, pour limiter les origines en production)
# CORS_ORIGIN=http://localhost:3000,https://votre-domaine.com
```

## Instructions

1. Copiez le contenu ci-dessus dans un nouveau fichier nommé `.env`
2. Modifiez les valeurs selon votre configuration
3. **IMPORTANT** : Ne commitez jamais le fichier `.env` dans Git (il est déjà dans `.gitignore`)

## Génération d'un secret JWT sécurisé

Pour générer un secret JWT fort en ligne de commande :

```bash
# Node.js
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Ou utilisez un générateur en ligne
```

