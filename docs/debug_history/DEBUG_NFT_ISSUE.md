# 🐛 Debug : NFT Non Créé

## Problème
Le NFT n'est pas créé malgré un score de 88 (>= 70).

## Causes Possibles

### 1. Hedera Non Configuré (Mode Mock)
Si Hedera n'est pas configuré dans `.env`, le système fonctionne en mode mock.
**Solution** : Même en mode mock, un NFT devrait être créé. Vérifiez les logs.

### 2. Erreur lors de la Création
Une erreur peut se produire lors de :
- La création du NFT mock
- L'enregistrement en base de données (contrainte unique sur tokenId)
- La mise à jour de la session

## Vérifications

### 1. Vérifier les Logs du Serveur
Cherchez dans les logs :
```
[TrainingService] Error creating NFT reward: ...
```

### 2. Vérifier la Configuration Hedera
```bash
# Vérifier si Hedera est configuré
Get-Content .env | Select-String -Pattern "HEDERA"
```

Si vide, Hedera n'est pas configuré → Mode Mock

### 3. Tester à Nouveau
Après les corrections, testez à nouveau avec :
```bash
curl -X POST http://localhost:3000/training/submit \
  -H "Authorization: Bearer VOTRE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "acteurId": "690b84f3159b39cd4e919140",
    "niveau": 1,
    "globalScore": 88,
    "emotions": {
      "detected": ["joie", "enthousiasme"],
      "coherence": 90,
      "intensity": 85
    },
    "strengths": ["Excellent contact visuel"],
    "recommendations": ["Amplifier les émotions"]
  }'
```

## Corrections Appliquées

1. ✅ TokenId unique pour chaque NFT mock (au lieu de toujours `'MOCK_TOKEN_ID'`)
2. ✅ Suppression de la contrainte `unique: true` sur `tokenId` dans le schéma
3. ✅ Amélioration des logs d'erreur pour mieux diagnostiquer

## Prochaines Étapes

1. **Redémarrez le serveur** pour appliquer les corrections
2. **Testez à nouveau** avec la même requête
3. **Vérifiez les logs** pour voir si une erreur se produit
4. **Si ça ne marche toujours pas**, partagez les logs d'erreur

