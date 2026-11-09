# 🔧 Corrections Apportées - Erreur 401

## ✅ Améliorations Effectuées

### 1. Logs Détaillés dans `JwtAuthGuard` ✅

**Fichier** : `src/common/guards/jwt-auth.guard.ts`

- ✅ Logs détaillés avec type d'erreur (`TokenExpiredError`, `JsonWebTokenError`, etc.)
- ✅ Vérification de la présence du token
- ✅ Messages d'erreur plus spécifiques selon le type d'erreur
- ✅ Logs de succès pour confirmer l'authentification

### 2. Logs dans `JwtStrategy` ✅

**Fichier** : `src/auth/strategies/jwt.strategy.ts`

- ✅ Log de vérification du secret JWT au démarrage
- ✅ Logs détaillés lors de la validation du payload
- ✅ Logs lors de la recherche de l'agence
- ✅ Logs de l'objet utilisateur retourné

### 3. Logs dans le Controller ✅

**Fichier** : `src/castings/castings.controller.ts`

- ✅ Logs de la requête reçue
- ✅ Vérification de la présence de l'utilisateur
- ✅ Vérification des headers

---

## 🔍 Diagnostic Nécessaire

Avec ces logs, vous devriez maintenant voir dans les logs Vercel :

### Logs Attendus :

1. **Au démarrage** :
```
[JWT Strategy] Initialisé avec secret: PRÉSENT ou MANQUANT
```

2. **Lors d'une requête** :
```
[JWT Guard] Erreur d'authentification: {
  url: '/castings/.../video',
  method: 'GET',
  error: '...',
  infoType: 'TokenExpiredError' | 'JsonWebTokenError' | etc.,
  hasToken: true/false,
  tokenPrefix: 'Bearer ...',
}
```

OU (si succès) :
```
[JWT Strategy] Validation du payload: { sub, type, role, ... }
[JWT Strategy] Recherche agence avec ID: ...
[JWT Strategy] Agence trouvée: { _id, nomAgence, role, ... }
[JWT Guard] Authentification réussie: { userId, userRole, ... }
[VIDEO] Requête reçue: { castingId, acteurId, hasUser, ... }
```

---

## 🐛 Causes Possibles de l'Erreur 401

### 1. Token Non Envoyé ❌
**Symptôme** : `hasToken: false` dans les logs
**Solution** : Vérifier que l'app mobile envoie bien le header `Authorization: Bearer <TOKEN>`

### 2. Token Expiré ⏰
**Symptôme** : `infoType: 'TokenExpiredError'` dans les logs
**Solution** : Se reconnecter pour obtenir un nouveau token

### 3. Secret JWT Incorrect 🔑
**Symptôme** : `infoType: 'JsonWebTokenError'` dans les logs
**Solution** : Vérifier que `JWT_SECRET` dans Vercel correspond au secret utilisé lors du login

### 4. Agence Non Trouvée 👤
**Symptôme** : `[JWT Strategy] ERREUR: Agence non trouvée` dans les logs
**Solution** : Vérifier que l'agence avec l'ID du token existe dans la base de données

### 5. Format du Token Incorrect 📝
**Symptôme** : `infoType: 'JsonWebTokenError'` ou erreur de parsing
**Solution** : Vérifier le format du token JWT

---

## 🔧 Actions à Effectuer

### 1. Vérifier les Logs Vercel

1. Aller dans le dashboard Vercel
2. Ouvrir les logs de la fonction/serverless
3. Chercher les logs `[JWT Guard]`, `[JWT Strategy]`, `[VIDEO]`
4. Identifier le type d'erreur exact

### 2. Vérifier le Token JWT

**Depuis l'app mobile**, vérifier que :
- Le token est bien stocké après le login
- Le token est bien envoyé dans le header `Authorization: Bearer <TOKEN>`
- Le token n'est pas expiré

### 3. Vérifier la Configuration Vercel

**Dans Vercel**, vérifier que :
- La variable d'environnement `JWT_SECRET` est définie
- La valeur correspond au secret utilisé lors du login
- Les variables d'environnement sont bien déployées

### 4. Tester avec curl

```bash
# Remplacer <TOKEN> par un token JWT valide
curl -X GET \
  "https://cast-mate.vercel.app/castings/6928c9f8ca3c4c83d6e8278b/candidates/690cda42dc65a1a3fc2c6a20/video" \
  -H "Authorization: Bearer <TOKEN>" \
  -v
```

---

## 📋 Checklist de Vérification

- [ ] Vérifier les logs Vercel pour identifier le type d'erreur
- [ ] Vérifier que le token est bien envoyé depuis l'app mobile
- [ ] Vérifier que `JWT_SECRET` est défini dans Vercel
- [ ] Vérifier que le token n'est pas expiré
- [ ] Vérifier que l'agence existe dans la base de données
- [ ] Tester avec curl pour isoler le problème

---

## 🎯 Prochaines Étapes

1. **Immédiat** : Vérifier les logs Vercel pour voir les nouveaux logs détaillés
2. **Court terme** : Identifier la cause exacte grâce aux logs
3. **Moyen terme** : Corriger le problème identifié
4. **Long terme** : Retirer les logs de débogage une fois le problème résolu

---

## 📝 Note Importante

Les logs ajoutés sont **temporaires** et doivent être retirés une fois le problème résolu pour des raisons de sécurité et de performance.

---

**Date** : 27 novembre 2025  
**Status** : Logs améliorés - En attente de diagnostic via logs Vercel

