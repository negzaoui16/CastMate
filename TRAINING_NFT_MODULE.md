# 🎯 Module Training + NFT Rewards

## 📋 Vue d'ensemble

Le module Training permet aux acteurs de soumettre leurs sessions d'entraînement et de recevoir automatiquement des NFTs sur Hedera Network lorsqu'ils obtiennent un score >= 70.

## 🏗️ Architecture

```
src/training/
├── training.module.ts          # Module principal
├── training.controller.ts      # Endpoints API
├── training.service.ts         # Logique métier
├── schemas/
│   ├── training-session.schema.ts  # Schéma MongoDB pour les sessions
│   └── nft-reward.schema.ts        # Schéma MongoDB pour les NFTs
├── dto/
│   └── submit-training.dto.ts      # DTO pour soumettre une session
└── nft/
    ├── hedera.service.ts      # Service Hedera Network
    └── nft.service.ts         # Service de gestion des NFTs
```

## 🔧 Configuration

### Variables d'environnement

Ajoutez ces variables dans votre fichier `.env` :

```env
# Hedera Network Configuration
HEDERA_NETWORK=testnet  # ou 'mainnet' pour la production
HEDERA_ACCOUNT_ID=0.0.1234567
HEDERA_PRIVATE_KEY=302e020100300506032b657004220420...
HEDERA_TOKEN_ID=0.0.1234567  # Optionnel, sera créé automatiquement si non défini

# NFT Image Base URL (optionnel)
NFT_IMAGE_BASE_URL=http://localhost:3000
API_BASE_URL=http://localhost:3000
```

### Obtenir des credentials Hedera

**📖 Guide complet** : Voir [HEDERA_CONFIGURATION.md](./HEDERA_CONFIGURATION.md) pour un guide détaillé.

**Mode Mock (Développement)** : Si vous ne configurez pas Hedera, le système fonctionne automatiquement en mode mock (NFTs fictifs, pas de blockchain).

**Mode Testnet (Tests)** :
1. Créez un compte sur [Hedera Portal](https://portal.hedera.com/)
2. Créez un compte testnet (gratuit)
3. Récupérez votre Account ID et Private Key
4. Ajoutez-les dans votre `.env`

**⚠️ Important** : En production, utilisez `mainnet` et sécurisez bien votre clé privée !

## 📡 Endpoints API

### 1. Soumettre une session d'entraînement

**POST** `/training/submit`

**Headers** :
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

**Body** :
```json
{
  "acteurId": "507f1f77bcf86cd799439011",
  "niveau": 1,
  "globalScore": 88,
  "emotions": {
    "detected": ["joie", "enthousiasme"],
    "coherence": 90,
    "intensity": 85
  },
  "strengths": [
    "Excellent contact visuel avec la caméra",
    "Émotions authentiques et naturelles",
    "Voix claire et bien projetée"
  ],
  "recommendations": [
    "Essayer d'amplifier encore plus les émotions fortes",
    "Varier davantage le rythme de parole"
  ]
}
```

**Réponse** (si score >= 70) :
```json
{
  "session": {
    "id": "507f1f77bcf86cd799439011",
    "acteurId": "507f1f77bcf86cd799439012",
    "niveau": 1,
    "globalScore": 88,
    "emotions": {
      "detected": ["joie", "enthousiasme"],
      "coherence": 90,
      "intensity": 85
    },
    "strengths": ["..."],
    "recommendations": ["..."],
    "nftRewarded": true,
    "completedAt": "2024-01-15T10:30:00.000Z"
  },
  "nftReward": {
    "id": "507f1f77bcf86cd799439013",
    "tokenId": "0.0.1234567",
    "serialNumber": "1",
    "transactionId": "0.0.1234567@1234567890.123456789",
    "imageUrl": "http://localhost:3000/training/nft-images/1.png",
    "metadataUrl": "https://hashscan.io/testnet/token/0.0.1234567?serial=1",
    "status": "MINTED",
    "mintedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

### 2. Récupérer les sessions d'un acteur

**GET** `/training/actor/:acteurId/sessions`

**Headers** :
```
Authorization: Bearer <JWT_TOKEN>
```

**Réponse** :
```json
[
  {
    "id": "...",
    "acteurId": "...",
    "niveau": 1,
    "globalScore": 88,
    "nftRewarded": true,
    "nftRewardId": "...",
    "completedAt": "..."
  }
]
```

### 3. Récupérer les NFTs d'un acteur

**GET** `/training/actor/:acteurId/nfts`

**Headers** :
```
Authorization: Bearer <JWT_TOKEN>
```

**Réponse** :
```json
[
  {
    "id": "...",
    "acteurId": "...",
    "niveau": 1,
    "score": 88,
    "tokenId": "0.0.1234567",
    "serialNumber": "1",
    "imageUrl": "http://localhost:3000/training/nft-images/1.png",
    "status": "MINTED"
  }
]
```

### 4. Récupérer une session par ID

**GET** `/training/session/:sessionId`

### 5. Enregistrer l'adresse HashPack

**PATCH** `/acteur/:id/hashpack`

**Headers** :
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

**Body** :
```json
{
  "hashpackAccountId": "0.0.7654321"
}
```

### 6. Initier le transfert d'un NFT vers HashPack

**POST** `/training/nft/:nftId/transfer`

**Headers** :
```
Authorization: Bearer <JWT_TOKEN>
```

**Réponse** :
```json
{
  "transactionData": {
    "tokenId": "0.0.1234567",
    "serialNumber": "1",
    "recipientAccountId": "0.0.7654321",
    "treasuryAccountId": "0.0.1234567"
  },
  "message": "Utilisez ces données dans HashPack pour créer et signer la transaction de transfert"
}
```

### 7. Récupérer l'image NFT (Public)

**GET** `/training/nft-images/:niveau.png`

**Exemple** : `GET /training/nft-images/1.png`

## 🖼️ Images NFT

Les images NFT sont stockées dans le dossier `public/nft-images/` à la racine du projet :
- `public/nft-images/1.png` - Image pour le niveau 1
- `public/nft-images/2.png` - Image pour le niveau 2
- `public/nft-images/3.png` - Image pour le niveau 3
- etc.

Les images sont servies via l'endpoint `/training/nft-images/:niveau.png`

**Note** : Le dossier `public/` est la convention standard pour les fichiers statiques dans les applications NestJS.

## 🔄 Workflow complet

1. **L'acteur complète un entraînement** avec un score >= 70
2. **Le frontend envoie les résultats** via `POST /training/submit`
3. **Le backend crée automatiquement** :
   - Une session d'entraînement dans MongoDB
   - Un NFT sur Hedera Network (si score >= 70)
   - Un enregistrement NFT dans MongoDB
4. **L'acteur peut consulter ses NFTs** via `GET /training/actor/:acteurId/nfts`
5. **L'acteur enregistre son adresse HashPack** via `PATCH /acteur/:id/hashpack`
6. **L'acteur initie le transfert** via `POST /training/nft/:nftId/transfer`
7. **Le frontend utilise HashPack** pour signer et transférer le NFT

## 🧪 Mode Développement (sans Hedera)

Si Hedera n'est pas configuré, le système fonctionne en mode "mock" :
- Les NFTs sont créés avec des IDs mock (`MOCK_TOKEN_ID`, etc.)
- Les sessions sont toujours enregistrées
- Les NFTs mock peuvent être consultés normalement

## 📝 Notes importantes

1. **Score minimum** : Un NFT n'est créé que si `globalScore >= 70`
2. **Un NFT par niveau** : Chaque niveau a sa propre image NFT
3. **Hedera Network** : En développement, utilisez `testnet`. En production, utilisez `mainnet`
4. **Sécurité** : Ne commitez jamais votre `HEDERA_PRIVATE_KEY` dans Git
5. **Images** : Les images NFT doivent être au format PNG et nommées `{niveau}.png`

## 🐛 Dépannage

### Erreur "Hedera is not configured"
- Vérifiez que `HEDERA_ACCOUNT_ID` et `HEDERA_PRIVATE_KEY` sont définis dans `.env`
- Le système fonctionnera en mode mock si non configuré

### Erreur "NFT image not found"
- Vérifiez que le fichier `public/nft-images/{niveau}.png` existe
- Vérifiez les permissions du dossier

### Erreur lors du minting NFT
- Vérifiez votre solde Hedera (il faut des HBAR pour les transactions)
- Vérifiez que votre compte a les permissions nécessaires
- Consultez les logs pour plus de détails

## 📚 Documentation supplémentaire

- **[HEDERA_CONFIGURATION.md](./HEDERA_CONFIGURATION.md)** - Guide complet de configuration Hedera
- [Hedera SDK Documentation](https://docs.hedera.com/hedera/sdks-and-apis/sdks)
- [HashPack Wallet](https://www.hashpack.app/)
- [Hedera Portal](https://portal.hedera.com/)

