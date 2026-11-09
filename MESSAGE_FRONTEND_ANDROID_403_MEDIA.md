# 📱 Message pour l'équipe Frontend Android - Fix 403 sur les médias

**Date:** 2025-12-14  
**Sujet:** Correction du problème 403 Forbidden sur les requêtes de médias (photo de profil, galerie, CV)

---

## ✅ Problème résolu

Le backend a été corrigé pour résoudre les erreurs **HTTP 403 (Forbidden)** lors du chargement des images de profil, galerie et CV via les URLs `/media/{fileId}`.

**IMPORTANT :** Tous les médias des acteurs (photo de profil, galerie, CV) sont maintenant **PUBLICS** et accessibles **SANS authentification**.

---

## 🔧 Changements backend

### 1. Amélioration de la logique d'autorisation

- ✅ **Médias des acteurs publics** : Tous les médias des acteurs (photo, galerie, CV) sont maintenant accessibles publiquement, sans authentification
- ✅ **Normalisation des IDs** : Les IDs sont maintenant normalisés (trim) pour éviter les problèmes de format
- ✅ **Logs de diagnostic** : Des logs détaillés ont été ajoutés pour identifier rapidement les problèmes
- ✅ **Meilleure gestion des erreurs** : Les messages d'erreur sont plus explicites
- ✅ **Cache public activé** : Cache de 1 an pour les médias des acteurs (amélioration des performances)

### 2. Logs de diagnostic

Le backend génère maintenant des logs détaillés pour chaque requête de média :
- Informations sur l'utilisateur authentifié
- Comparaison des IDs (ownerId vs requesterId)
- Détails sur le fichier demandé

Ces logs sont disponibles dans Vercel et permettront de diagnostiquer rapidement tout problème restant.

---

## 🧪 Tests à effectuer

### Test 1 : Photo de profil

**Scénario** : Charger la photo de profil de l'acteur connecté

**Code à tester** :
```kotlin
// Récupérer le profil de l'acteur
val acteur = apiService.getActeur(acteurId)

// Charger la photo de profil (PAS BESOIN DE TOKEN !)
val photoFileId = acteur.media?.photoFileId
val photoUrl = "https://cast-mate.vercel.app/media/$photoFileId"

// Avec Coil - Pas besoin d'intercepteur d'authentification
imageView.load(photoUrl) {
    placeholder(R.drawable.placeholder_profile)
    error(R.drawable.error_profile)
}
```

**Résultat attendu** : ✅ Image chargée avec succès (200 OK)

---

### Test 2 : Galerie de photos

**Scénario** : Charger les photos de la galerie de l'acteur

**Code à tester** :
```kotlin
// Récupérer le profil
val acteur = apiService.getActeur(acteurId)

// Charger chaque photo de la galerie (PAS BESOIN DE TOKEN !)
acteur.media?.gallery?.forEach { photo ->
    val galleryUrl = "https://cast-mate.vercel.app/media/${photo.fileId}"
    
    // Afficher dans un RecyclerView ou GridView - Pas besoin d'authentification
    imageView.load(galleryUrl) {
        placeholder(R.drawable.placeholder_gallery)
        error(R.drawable.error_image)
    }
}
```

**Résultat attendu** : ✅ Toutes les images de la galerie chargées avec succès

---

### Test 3 : CV (PDF)

**Scénario** : Télécharger le CV de l'acteur

**Code à tester** :
```kotlin
val documentFileId = acteur.media?.documentFileId
if (documentFileId != null) {
    val cvUrl = "https://cast-mate.vercel.app/media/$documentFileId"
    
    // Télécharger le PDF (PAS BESOIN DE TOKEN !)
    val response = okHttpClient.newCall(
        Request.Builder()
            .url(cvUrl)
            // Pas besoin d'ajouter le header Authorization
            .build()
    ).execute()
    
    if (response.isSuccessful) {
        // Sauvegarder le fichier
        val file = File(context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), "cv.pdf")
        response.body?.byteStream()?.use { input ->
            file.outputStream().use { output ->
                input.copyTo(output)
            }
        }
        // Ouvrir le PDF
        openPdfFile(file)
    }
}
```

**Résultat attendu** : ✅ PDF téléchargé et ouvert avec succès

---

## 🔍 Vérification des logs

Si vous rencontrez encore des problèmes, vérifiez les logs backend dans Vercel. Les logs incluent maintenant :

```
[MediaController] Requête fichier: {
  fileId: "...",
  hasUser: true,
  userId: "...",
  userRole: "ACTEUR",
  ...
}

[MediaService] Vérification accès fichier: {
  ownerId: "...",
  requesterId: "...",
  areEqual: true/false,
  ...
}
```

Ces logs permettront d'identifier rapidement où le problème se situe.

---

## ⚠️ Points importants

### 1. Authentification NON requise pour les médias d'acteurs

**Les médias des acteurs (photo de profil, galerie, CV) sont maintenant PUBLICS et accessibles SANS token JWT.**

Vous pouvez charger ces images directement sans authentification :
```kotlin
// ✅ Pas besoin de token pour les médias d'acteurs
val photoUrl = "https://cast-mate.vercel.app/media/$photoFileId"
imageView.load(photoUrl) // Pas besoin d'intercepteur d'authentification
```

**Note :** Les autres fichiers (vidéos d'audition, photos d'agences) nécessitent toujours une authentification.

### 2. Format de l'URL

Les URLs doivent être construites comme suit :
```kotlin
val imageUrl = "https://cast-mate.vercel.app/media/$fileId"
```

**Ne pas** utiliser de chemins relatifs ou construire l'URL différemment.

### 3. Cache public activé

Les médias des acteurs bénéficient maintenant d'un cache public de 1 an, ce qui améliore significativement les performances de chargement.

### 4. Gestion des erreurs

Si vous recevez encore une erreur 403 (ne devrait plus arriver pour les médias d'acteurs) :

1. **Vérifier que c'est bien un média d'acteur** : Les médias d'acteurs sont publics, pas besoin de token
2. **Vérifier l'URL** : S'assurer que l'URL est correcte
3. **Vérifier les logs backend** : Les logs indiqueront exactement pourquoi l'accès est refusé (si problème)

---

## 📋 Checklist de test

- [ ] Photo de profil de l'acteur connecté se charge correctement
- [ ] Photos de la galerie de l'acteur connecté se chargent correctement
- [ ] CV de l'acteur connecté peut être téléchargé
- [ ] Les images s'affichent dans les ImageView avec Coil/Glide
- [ ] Pas d'erreur 403 dans les logs Android
- [ ] Les placeholders s'affichent correctement si pas d'image

---

## 🐛 Si le problème persiste

Si vous recevez encore des erreurs 403 après ces corrections :

1. **Vérifier les logs Android** :
   ```
   Log.d("MEDIA", "URL: $imageUrl")
   Log.d("MEDIA", "Token présent: ${token != null}")
   Log.d("MEDIA", "Token length: ${token?.length}")
   ```

2. **Vérifier les logs backend** dans Vercel :
   - Chercher les logs `[MediaController]` et `[MediaService]`
   - Vérifier que `hasUser: true`
   - Vérifier que `ownerId === requesterId`

3. **Tester avec Postman/Insomnia** :
   - Faire une requête manuelle avec le même token
   - Vérifier si le problème vient du backend ou du client Android

4. **Contacter l'équipe backend** avec :
   - Les logs Android complets
   - Les logs backend (si disponibles)
   - L'URL exacte qui échoue
   - Le fileId concerné

---

## 📞 Support

Si vous avez besoin d'aide ou si le problème persiste :

1. Vérifier les logs backend dans Vercel
2. Partager les logs Android complets
3. Indiquer l'URL exacte qui échoue
4. Indiquer le fileId concerné

---

## ✅ Résumé

- ✅ Le backend a été corrigé avec normalisation des IDs et logs détaillés
- ✅ Les acteurs peuvent maintenant accéder à leurs propres médias
- ✅ Les logs permettront de diagnostiquer rapidement tout problème restant
- ✅ Tester avec les scénarios ci-dessus et vérifier les logs si problème

**Merci de tester et de nous faire un retour !** 🙏

