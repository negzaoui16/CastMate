# 📱 Message pour l'équipe Frontend Android - Fix 403 sur POST /castings/{id}/apply

**Date:** 2025-12-14  
**Sujet:** Correction du problème 403 Forbidden lors de la candidature à un casting

---

## ✅ Problème résolu

Le backend a été corrigé pour résoudre les erreurs **HTTP 403 (Forbidden)** lors de la candidature d'un acteur à un casting via `POST /castings/{id}/apply`.

---

## 🔧 Changements backend

### 1. Amélioration de l'extraction de l'ID utilisateur

- ✅ **Extraction robuste** : L'ID est maintenant extrait avec plusieurs fallbacks (`id`, `_id`, `sub`)
- ✅ **Logs de diagnostic** : Des logs détaillés ont été ajoutés pour identifier rapidement les problèmes
- ✅ **Gestion d'erreur** : Si l'ID ne peut pas être extrait, une exception explicite est lancée

### 2. Logs de diagnostic

Le backend génère maintenant des logs détaillés pour chaque candidature :
- Informations sur l'utilisateur authentifié
- Extraction de l'ID utilisateur
- Vérification des permissions
- Détails sur le casting

Ces logs sont disponibles dans Vercel et permettront de diagnostiquer rapidement tout problème restant.

---

## 🧪 Tests à effectuer

### Test 1 : Candidature avec vidéo

**Scénario** : Un acteur authentifié postule à un casting avec une vidéo d'audition

**Code à tester** :
```kotlin
// Préparer la requête
val formData = MultipartBody.Builder()
    .setType(MultipartBody.FORM)
    .addFormDataPart("video", "video.mp4", 
        RequestBody.create(MediaType.parse("video/mp4"), videoFile))
    .addFormDataPart("aiFeedback", JSON.stringify(aiFeedback))
    .build()

// Envoyer la requête
val request = Request.Builder()
    .url("https://cast-mate.vercel.app/castings/$castingId/apply")
    .post(formData)
    .addHeader("Authorization", "Bearer $token")
    .build()

val response = okHttpClient.newCall(request).execute()
```

**Résultat attendu** : ✅ 200 OK avec confirmation de candidature

---

### Test 2 : Candidature sans vidéo

**Scénario** : Un acteur authentifié postule à un casting sans vidéo

**Code à tester** :
```kotlin
// Body vide (FormData vide)
val formData = MultipartBody.Builder()
    .setType(MultipartBody.FORM)
    .build()

val request = Request.Builder()
    .url("https://cast-mate.vercel.app/castings/$castingId/apply")
    .post(formData)
    .addHeader("Authorization", "Bearer $token")
    .build()

val response = okHttpClient.newCall(request).execute()
```

**Résultat attendu** : ✅ 200 OK avec confirmation de candidature

---

## 🔍 Vérification des logs

Si vous rencontrez encore des problèmes, vérifiez les logs backend dans Vercel. Les logs incluent maintenant :

```
[JWT Strategy] Recherche acteur avec ID: 690cda42dc65a1a3fc2c6a20
[JWT Strategy] Acteur trouvé: { ... }
[JWT Strategy] Objet utilisateur retourné (ACTEUR): { id: "...", role: "ACTEUR", ... }

[RolesGuard] Vérification des rôles: {
  requiredRoles: ["ACTEUR"],
  userRole: "ACTEUR",
  ...
}
[RolesGuard] ✅ Accès autorisé pour le rôle: ACTEUR

[CastingsController] Candidature à un casting: {
  castingId: "...",
  userId: "690cda42dc65a1a3fc2c6a20",
  ...
}
[CastingsController] ID utilisateur extrait: 690cda42dc65a1a3fc2c6a20
```

Ces logs permettront d'identifier rapidement où le problème se situe.

---

## ⚠️ Points importants

### 1. Authentification requise

**Toutes les requêtes vers `/castings/{id}/apply` nécessitent un token JWT valide avec le rôle ACTEUR.**

Assurez-vous que votre intercepteur ajoute bien le header :
```kotlin
.addHeader("Authorization", "Bearer $token")
```

### 2. Format de la requête

Les requêtes doivent être au format `multipart/form-data` :
- `video` : Fichier vidéo (optionnel)
- `aiFeedback` : JSON string (optionnel)

Même sans vidéo, envoyez un FormData vide :
```kotlin
val formData = MultipartBody.Builder()
    .setType(MultipartBody.FORM)
    .build()
```

### 3. Gestion des erreurs

Si vous recevez encore une erreur 403 :

1. **Vérifier le token** : S'assurer que le token est valide et non expiré
2. **Vérifier le rôle** : S'assurer que le token contient `role=ACTEUR`
3. **Vérifier les logs backend** : Les logs indiqueront exactement pourquoi l'accès est refusé

---

## 📋 Checklist de test

- [ ] Candidature avec vidéo fonctionne correctement
- [ ] Candidature sans vidéo fonctionne correctement
- [ ] Pas d'erreur 403 dans les logs Android
- [ ] Le token JWT contient bien `role=ACTEUR` et `type=ACTEUR`
- [ ] La réponse contient une confirmation de candidature

---

## 🐛 Si le problème persiste

Si vous recevez encore des erreurs 403 après ces corrections :

1. **Vérifier les logs Android** :
   ```kotlin
   Log.d("APPLY", "Token info: role=${payload.role}, type=${payload.type}")
   Log.d("APPLY", "User ID: ${user?.id || user?._id}")
   ```

2. **Vérifier les logs backend** dans Vercel :
   - Chercher les logs `[JWT Strategy]`, `[RolesGuard]`, et `[CastingsController]`
   - Vérifier que `hasUser: true`
   - Vérifier que `userRole: "ACTEUR"`
   - Vérifier que l'ID est correctement extrait

3. **Tester avec Postman/Insomnia** :
   - Faire une requête manuelle avec le même token
   - Vérifier si le problème vient du backend ou du client Android

4. **Contacter l'équipe backend** avec :
   - Les logs Android complets
   - Les logs backend (si disponibles)
   - L'ID du casting concerné
   - Le token JWT (pour test côté backend)

---

## 📞 Support

Si vous avez besoin d'aide ou si le problème persiste :

1. Vérifier les logs backend dans Vercel
2. Partager les logs Android complets
3. Indiquer l'ID du casting concerné
4. Indiquer si c'est avec ou sans vidéo

---

## ✅ Résumé

- ✅ Le backend a été corrigé avec extraction robuste de l'ID et logs détaillés
- ✅ Les acteurs peuvent maintenant postuler aux castings
- ✅ Les logs permettront de diagnostiquer rapidement tout problème restant
- ✅ Tester avec les scénarios ci-dessus et vérifier les logs si problème

**Merci de tester et de nous faire un retour !** 🙏

