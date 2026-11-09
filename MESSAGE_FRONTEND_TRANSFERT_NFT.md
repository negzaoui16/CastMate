# 📧 Message pour l'Équipe Frontend

## 🎁 Nouvelle Fonctionnalité : Transfert Automatique des NFTs

Bonjour équipe frontend 👋

Nous avons implémenté le **transfert automatique des NFTs** vers le wallet HashPack des utilisateurs. Voici les informations essentielles :

---

## ✨ Transfert Automatique (Nouveau)

### Comment ça fonctionne ?

Lorsqu'un utilisateur complète un entraînement avec un score >= 70 :

1. **Le NFT est créé** automatiquement sur Hedera Network
2. **Si l'utilisateur a un compte HashPack associé** (`hashpackAccountId`), le NFT est **automatiquement transféré** vers son wallet
3. **Si l'utilisateur n'a pas de compte HashPack**, le NFT reste dans le treasury et peut être transféré manuellement plus tard

### ✅ Avantages

- **Expérience utilisateur améliorée** : L'utilisateur reçoit directement son NFT dans HashPack
- **Pas d'action requise** : Le transfert se fait automatiquement après la création
- **Sécurisé** : Le transfert est effectué côté backend avec les clés sécurisées

---

## 🔄 Workflow Complet

### Scénario 1 : Utilisateur avec HashPack déjà associé

```typescript
// 1. L'utilisateur complète un entraînement
const response = await fetch('/api/training/submit', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    acteurId: '...',
    niveau: 1,
    globalScore: 85,
    emotions: { ... },
    strengths: [...],
    recommendations: [...]
  })
});

const data = await response.json();

// 2. Le NFT est automatiquement transféré si hashpackAccountId existe
// ✅ L'utilisateur peut voir son NFT directement dans HashPack
// ✅ Pas d'action supplémentaire requise
```

### Scénario 2 : Utilisateur sans HashPack (transfert manuel)

```typescript
// 1. L'utilisateur complète un entraînement
const response = await fetch('/api/training/submit', {
  method: 'POST',
  // ... même requête que ci-dessus
});

// 2. Le NFT est créé mais reste dans le treasury
// 3. L'utilisateur doit d'abord associer son compte HashPack
await fetch(`/api/acteur/${acteurId}/hashpack`, {
  method: 'PATCH',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    hashpackAccountId: '0.0.1234567'
  })
});

// 4. Puis transférer manuellement le NFT
await fetch(`/api/training/nft/${nftId}/transfer`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
  }
});
```

---

## 📡 Endpoints Disponibles

### 1. Associer un compte HashPack

**PATCH** `/acteur/:id/hashpack`

**Body** :
```json
{
  "hashpackAccountId": "0.0.1234567"
}
```

**Réponse** :
```json
{
  "id": "acteur123",
  "hashpackAccountId": "0.0.1234567"
}
```

**⚠️ Important** : Le format doit être `0.0.xxxxxxx` (ex: `0.0.1234567`)

---

### 2. Transférer manuellement un NFT (si pas transféré automatiquement)

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

**Note** : Cet endpoint est principalement pour les NFTs créés avant l'implémentation du transfert automatique, ou si le transfert automatique a échoué.

---

### 3. Récupérer les NFTs d'un acteur

**GET** `/training/actor/:acteurId/nfts`

**Réponse** :
```json
[
  {
    "id": "nft123",
    "tokenId": "0.0.1234567",
    "serialNumber": "1",
    "niveau": 1,
    "score": 85,
    "status": "MINTED",
    "imageUrl": "https://...",
    "mintedAt": "2024-01-15T10:30:00.000Z"
  }
]
```

---

## 🎯 Cas d'Usage Recommandés

### Cas 1 : Nouvel utilisateur sans HashPack

```typescript
// 1. L'utilisateur complète un entraînement
const trainingResponse = await fetch('/api/training/submit', { ... });
const { session, nftReward } = await trainingResponse.json();

// 2. Afficher un message : "Félicitations ! Vous avez gagné un NFT !"
// 3. Proposer d'associer HashPack pour recevoir le NFT
if (nftReward && !user.hashpackAccountId) {
  showModal({
    title: "🎁 NFT Gagné !",
    message: "Associez votre wallet HashPack pour recevoir votre NFT",
    action: () => {
      // Rediriger vers la page d'association HashPack
      navigate('/settings/hashpack');
    }
  });
}
```

### Cas 2 : Utilisateur avec HashPack déjà associé

```typescript
// 1. L'utilisateur complète un entraînement
const trainingResponse = await fetch('/api/training/submit', { ... });
const { session, nftReward } = await trainingResponse.json();

// 2. Le NFT est automatiquement transféré
// 3. Afficher un message de confirmation
if (nftReward && user.hashpackAccountId) {
  showSuccessMessage({
    title: "🎉 NFT Transféré !",
    message: `Votre NFT a été automatiquement transféré vers votre wallet HashPack (${user.hashpackAccountId})`,
    action: "Voir dans HashPack"
  });
}
```

### Cas 3 : Vérifier si un NFT a été transféré

```typescript
// Récupérer les NFTs de l'utilisateur
const nftsResponse = await fetch(`/api/training/actor/${acteurId}/nfts`, {
  headers: { 'Authorization': `Bearer ${token}` }
});
const nfts = await nftsResponse.json();

// Pour chaque NFT, vérifier s'il est dans le wallet HashPack
// Note: Le backend ne stocke pas l'état de transfert, 
// mais si le NFT a été créé récemment et que l'utilisateur a un hashpackAccountId,
// il a probablement été transféré automatiquement
```

---

## 🔍 Détection du Transfert Automatique

### Comment savoir si un NFT a été transféré automatiquement ?

**Indicateurs** :
1. ✅ L'utilisateur a un `hashpackAccountId` associé
2. ✅ Le NFT a été créé récemment (après l'implémentation du transfert automatique)
3. ✅ Le `status` du NFT est `"MINTED"`
4. ✅ Le `tokenId` ne commence pas par `"MOCK_"` (pas un NFT de développement)

**Note** : Pour vérifier définitivement, vous pouvez interroger la blockchain Hedera via HashScan ou l'API HashPack.

---

## ⚠️ Points Importants

### 1. Format HashPack Account ID
- **Format requis** : `0.0.xxxxxxx` (ex: `0.0.1234567`)
- **Validation** : Le backend valide automatiquement le format
- **Erreur** : Si le format est incorrect, une erreur 400 sera retournée

### 2. NFTs Mock (Développement)
- Les NFTs avec `tokenId` commençant par `"MOCK_"` ne sont **pas transférés automatiquement**
- Ce sont des NFTs de développement/test
- Ils ne peuvent pas être transférés sur la blockchain réelle

### 3. Gestion des Erreurs
- Si le transfert automatique échoue, le NFT est quand même créé
- L'utilisateur peut transférer manuellement plus tard
- Les erreurs sont loggées côté backend mais n'interrompent pas la création du NFT

### 4. Rétrocompatibilité
- Les NFTs créés avant l'implémentation du transfert automatique peuvent être transférés manuellement
- L'endpoint `/training/nft/:nftId/transfer` reste disponible pour les transferts manuels

---

## 📋 Checklist d'Intégration

- [ ] Vérifier si l'utilisateur a un `hashpackAccountId` avant de créer un entraînement
- [ ] Afficher un message approprié selon que le transfert est automatique ou manuel
- [ ] Proposer l'association HashPack si l'utilisateur n'en a pas
- [ ] Gérer les cas d'erreur (transfert échoué, HashPack non associé, etc.)
- [ ] Afficher un feedback visuel lorsque le NFT est transféré
- [ ] Permettre le transfert manuel pour les anciens NFTs

---

## 🧪 Tests Recommandés

1. ✅ Tester avec un utilisateur **avec HashPack** → Vérifier le transfert automatique
2. ✅ Tester avec un utilisateur **sans HashPack** → Vérifier que le NFT est créé mais pas transféré
3. ✅ Tester l'association HashPack puis le transfert manuel
4. ✅ Tester avec un NFT mock → Vérifier qu'il n'est pas transféré
5. ✅ Tester la validation du format HashPack Account ID

---

## 📚 Documentation Complète

Pour plus de détails sur les NFTs et Hedera :
- **Guide NFT** : `TRAINING_NFT_MODULE.md`
- **Configuration Hedera** : `HEDERA_CONFIGURATION.md`

---

## 🆘 Questions ?

Si vous avez des questions ou besoin d'aide pour l'intégration, n'hésitez pas à nous contacter.

**Date d'implémentation** : $(date)  
**Priorité** : ✅ Fonctionnalité active - Transfert automatique opérationnel

Bonne intégration ! 🚀

