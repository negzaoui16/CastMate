# 📧 Message pour l'Équipe Frontend

## ✅ Correction : Format JSON des Rewards NFT

Bonjour équipe frontend 👋

Nous avons **corrigé les erreurs de parsing JSON** sur l'endpoint `POST /training/submit`. Les problèmes identifiés par l'équipe Android ont été résolus.

---

## 🐛 Problèmes corrigés

### 1. Format de `session.nftRewardId`
**Avant** : String (ID uniquement)
```json
{
  "session": {
    "nftRewardId": "nft789"  // ❌ String
  }
}
```

**Maintenant** : Objet (ou `null`)
```json
{
  "session": {
    "nftRewardId": {  // ✅ Objet
      "id": "nft789",
      "_id": "nft789",
      "tokenId": "token123",
      "serialNumber": "001",
      "imageUrl": "https://..."
    }
  }
}
```

### 2. Format de `nftReward.trainingSessionId`
**Avant** : String (ID uniquement)
```json
{
  "nftReward": {
    "trainingSessionId": "session123"  // ❌ String
  }
}
```

**Maintenant** : Objet (ou `null`)
```json
{
  "nftReward": {
    "trainingSessionId": {  // ✅ Objet
      "id": "session123",
      "_id": "session123",
      "niveau": 1,
      "globalScore": 84
    }
  }
}
```

---

## 📋 Format complet de la réponse

### Endpoint : `POST /training/submit`

**Réponse complète** :
```json
{
  "session": {
    "id": "session123",
    "_id": "session123",
    "acteurId": "actor456",
    "niveau": 1,
    "globalScore": 84,
    "emotions": { ... },
    "strengths": [...],
    "recommendations": [...],
    "nftRewarded": true,
    "nftRewardId": {  // ✅ Objet (ou null si pas de NFT)
      "id": "nft789",
      "_id": "nft789",
      "tokenId": "token123",
      "serialNumber": "001",
      "imageUrl": "https://..."
    },
    "completedAt": "2024-01-15T10:30:00.000Z"
  },
  "nftReward": {  // Présent uniquement si score >= 70
    "id": "nft789",
    "_id": "nft789",
    "acteurId": "actor456",
    "trainingSessionId": {  // ✅ Objet (ou null)
      "id": "session123",
      "_id": "session123",
      "niveau": 1,
      "globalScore": 84
    },
    "niveau": 1,
    "score": 84,
    "tokenId": "token123",
    "serialNumber": "001",
    "status": "MINTED"
  }
}
```

---

## 🔄 Impact sur le code frontend

### ✅ Bonne nouvelle
Si vous aviez implémenté des **workarounds** (adaptateurs Gson personnalisés, etc.) pour gérer les strings, vous pouvez maintenant les **retirer** car le format est cohérent.

### 📝 TypeScript / Interfaces

**Interface recommandée** :
```typescript
interface SubmitTrainingResponse {
  session: TrainingSession;
  nftReward?: NFTReward | null;
}

interface TrainingSession {
  id: string;
  _id: string;
  acteurId: string;
  niveau: number;
  globalScore: number;
  emotions: TrainingEmotions;
  strengths: string[];
  recommendations: string[];
  nftRewarded: boolean;
  nftRewardId?: NFTRewardInfo | null;  // ✅ Objet ou null
  completedAt: string;
}

interface NFTRewardInfo {
  id: string;
  _id: string;
  tokenId?: string;
  serialNumber?: string;
  imageUrl?: string;
}

interface NFTReward {
  id: string;
  _id: string;
  acteurId: string;
  trainingSessionId?: TrainingSessionInfo | null;  // ✅ Objet ou null
  niveau: number;
  score: number;
  tokenId: string;
  serialNumber: string;
  status: "PENDING" | "MINTED" | "FAILED";
}

interface TrainingSessionInfo {
  id: string;
  _id: string;
  niveau?: number;
  globalScore?: number;
}
```

---

## ⚠️ Points importants

1. **`nftRewardId` peut être `null`** : Si la session n'a pas de NFT (score < 70), le champ sera `null`
2. **`nftReward` est optionnel** : Présent uniquement si un NFT a été créé (score >= 70)
3. **Format cohérent** : Tous les champs de référence sont maintenant des objets, jamais des strings
4. **Rétrocompatibilité** : Les anciennes réponses avec strings ne seront plus renvoyées

---

## 🧪 Tests recommandés

1. ✅ Tester avec une session **sans NFT** (score < 70) → `nftRewardId` doit être `null`
2. ✅ Tester avec une session **avec NFT** (score >= 70) → `nftRewardId` doit être un objet complet
3. ✅ Vérifier que le parsing JSON fonctionne sans erreurs
4. ✅ Retirer les workarounds temporaires si présents

---

## 🆘 Questions ?

Si vous rencontrez des problèmes ou avez des questions, n'hésitez pas à nous contacter.

**Date de correction** : $(date)  
**Priorité** : ✅ Résolu - Format JSON cohérent et stable

Bonne intégration ! 🚀

