# Instructions pour démarrer le serveur

## 1. Créer le fichier .env

Créez un fichier `.env` à la racine du projet avec :

```env
# MongoDB (local)
MONGODB_URI=mongodb://localhost:27017/casting-app

# OU MongoDB Atlas (cloud)
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/casting-app?retryWrites=true&w=majority

# JWT Secret
JWT_SECRET=your-secret-key-change-in-production

# Server Port
PORT=3000
```

## 2. Démarrer MongoDB

### Option A : MongoDB Local
Ouvrez PowerShell **en tant qu'administrateur** et exécutez :
```powershell
net start MongoDB
```

### Option B : MongoDB Atlas (Recommandé si MongoDB n'est pas installé)
1. Créez un compte sur [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Créez un cluster gratuit
3. Obtenez votre URI de connexion
4. Utilisez cette URI dans votre fichier `.env`

## 3. Démarrer le serveur

```bash
npm run start:dev
```

## 4. Accéder à Swagger

Une fois le serveur démarré, ouvrez votre navigateur :
```
http://localhost:3000/api
```

## Erreurs courantes

- **ERR_CONNECTION_REFUSED** : Le serveur n'est pas démarré → Exécutez `npm run start:dev`
- **MongoDB connection error** : MongoDB n'est pas démarré → Démarrez MongoDB ou utilisez MongoDB Atlas
- **Port 3000 already in use** : Le port est occupé → Changez le port dans `.env` ou arrêtez le processus

