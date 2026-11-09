# 🚨 Message URGENT pour l'équipe Frontend Android - Erreur 403 sur POST /castings/{id}/apply

**Date:** 2025-12-14  
**Priorité:** 🔴 URGENT  
**Endpoint:** `POST /castings/{id}/apply`

---

## ✅ Corrections backend effectuées

Le backend a été corrigé avec :

1. **Logs de diagnostic détaillés** à chaque étape :
   - `JwtAuthGuard` : Logs de l'authentification
   - `JwtStrategy` : Logs de l'extraction de l'acteur
   - `RolesGuard` : Logs de la vérification des rôles
   - `CastingsController` : Logs de l'extraction de l'ID

2. **Amélioration de la comparaison des rôles** :
   - Gestion des enums et des strings
   - Normalisation avec trim()
   - Logs détaillés de la comparaison

3. **Extraction robuste de l'ID** avec plusieurs fallbacks

---

## 🔍 Diagnostic immédiat requis

### Étape 1 : Vérifier les logs backend dans Vercel

**Action URGENTE** : Vérifier les logs dans Vercel pour voir exactement où le blocage se produit.

Les logs backend devraient montrer :

#### Si tout fonctionne :
```
[JWT Guard] canActivate appelé: { url: "/castings/.../apply", method: "POST" }
[JWT Guard] Route protégée, vérification JWT...
[JWT Strategy] Recherche acteur avec ID: 690cda42dc65a1a3fc2c6a20
[JWT Strategy] Acteur trouvé: { ... }
[JWT Strategy] Objet utilisateur retourné (ACTEUR): { id: "...", role: "ACTEUR", ... }
[JWT Guard] Authentification réussie: { userRole: "ACTEUR", ... }
[JWT Guard] Utilisateur attaché à la requête: { hasUser: true, ... }

[RolesGuard] Vérification des rôles: {
  requiredRoles: ["ACTEUR"],
  userRole: "ACTEUR",
  ...
}
[RolesGuard] Comparaison rôle: {
  userRole: "ACTEUR",
  requiredRole: "ACTEUR",
  matches: true
}
[RolesGuard] ✅ Accès autorisé pour le rôle: ACTEUR

[CastingsController] Candidature à un casting: { ... }
[CastingsController] ID utilisateur extrait: 690cda42dc65a1a3fc2c6a20
```

#### Si problème dans JwtStrategy :
```
[JWT Strategy] Recherche acteur avec ID: 690cda42dc65a1a3fc2c6a20
[JWT Strategy] ERREUR: Acteur non trouvé pour ID: 690cda42dc65a1a3fc2c6a20
```
→ **Action** : Vérifier que l'acteur existe en base de données

#### Si problème dans RolesGuard :
```
[RolesGuard] Comparaison rôle: {
  userRole: "ACTEUR",
  requiredRole: "ACTEUR",
  matches: false  // ⚠️ Problème ici
}
[RolesGuard] ERREUR: Rôle insuffisant
```
→ **Action** : Vérifier la comparaison des rôles (corrigé dans la dernière version)

#### Si aucun log n'apparaît :
→ **Action** : Vérifier que les logs sont activés dans Vercel

---

## 🧪 Tests à effectuer côté Android

### Test 1 : Vérifier le token avant la requête

```kotlin
fun verifyTokenBeforeApply(castingId: String): Boolean {
    val token = tokenManager.getToken()
    if (token == null) {
        Log.e("VERIFY", "❌ Pas de token")
        return false
    }
    
    val payload = decodeJWT(token)
    
    Log.d("VERIFY", "========== VÉRIFICATION TOKEN ==========")
    Log.d("VERIFY", "Token présent: ${token != null}")
    Log.d("VERIFY", "Token length: ${token.length}")
    Log.d("VERIFY", "Payload keys: ${payload?.keys}")
    Log.d("VERIFY", "Sub: ${payload?.get("sub")}")
    Log.d("VERIFY", "Role: ${payload?.get("role")}")
    Log.d("VERIFY", "Type: ${payload?.get("type")}")
    Log.d("VERIFY", "Email: ${payload?.get("email")}")
    Log.d("VERIFY", "========================================")
    
    // Vérifications
    val sub = payload?.get("sub") as? String
    val role = payload?.get("role") as? String
    val type = payload?.get("type") as? String
    
    if (sub != "690cda42dc65a1a3fc2c6a20") {
        Log.e("VERIFY", "❌ PROBLÈME: Sub doit être '690cda42dc65a1a3fc2c6a20', actuel: $sub")
    }
    
    if (role != "ACTEUR") {
        Log.e("VERIFY", "❌ PROBLÈME: Role doit être 'ACTEUR', actuel: $role")
        return false
    }
    
    if (type != "ACTEUR") {
        Log.e("VERIFY", "❌ PROBLÈME: Type doit être 'ACTEUR', actuel: $type")
        return false
    }
    
    Log.d("VERIFY", "✅ Token valide pour postuler")
    return true
}
```

### Test 2 : Tester la requête avec logs détaillés

```kotlin
fun testApplyWithDetailedLogs(castingId: String, videoFile: File?) {
    Log.d("TEST", "========== TEST APPLY ==========")
    
    // 1. Vérifier le token
    val token = tokenManager.getToken()
    Log.d("TEST", "1. Token: ${if (token != null) "PRÉSENT (${token.length} chars)" else "MANQUANT"}")
    
    // 2. Vérifier le payload
    val payload = decodeJWT(token ?: "")
    Log.d("TEST", "2. Payload: role=${payload?.get("role")}, type=${payload?.get("type")}, sub=${payload?.get("sub")}")
    
    // 3. Construire la requête
    val formData = MultipartBody.Builder()
        .setType(MultipartBody.FORM)
        .apply {
            if (videoFile != null) {
                addFormDataPart(
                    "video",
                    videoFile.name,
                    RequestBody.create(MediaType.parse("video/mp4"), videoFile)
                )
                Log.d("TEST", "3. Vidéo ajoutée: ${videoFile.name}")
            } else {
                Log.d("TEST", "3. Pas de vidéo (FormData vide)")
            }
        }
        .build()
    
    val url = "https://cast-mate.vercel.app/castings/$castingId/apply"
    val request = Request.Builder()
        .url(url)
        .post(formData)
        .addHeader("Authorization", "Bearer $token")
        .build()
    
    Log.d("TEST", "4. URL: $url")
    Log.d("TEST", "5. Method: ${request.method}")
    Log.d("TEST", "6. Headers:")
    request.headers.forEach { name, value ->
        Log.d("TEST", "   $name: ${if (name == "Authorization") "Bearer ..." else value}")
    }
    Log.d("TEST", "7. Content-Type: ${request.body?.contentType()}")
    
    // 4. Envoyer la requête
    Log.d("TEST", "8. Envoi de la requête...")
    val response = okHttpClient.newCall(request).execute()
    
    Log.d("TEST", "9. Réponse reçue:")
    Log.d("TEST", "   Code: ${response.code}")
    Log.d("TEST", "   Message: ${response.message}")
    Log.d("TEST", "   Headers:")
    response.headers.forEach { name, value ->
        Log.d("TEST", "     $name: $value")
    }
    
    if (!response.isSuccessful) {
        val errorBody = response.peekBody(Long.MAX_VALUE).string()
        Log.e("TEST", "10. ❌ Erreur body: $errorBody")
    } else {
        val successBody = response.peekBody(Long.MAX_VALUE).string()
        Log.d("TEST", "10. ✅ Succès body: $successBody")
    }
    
    Log.d("TEST", "========================================")
}
```

---

## ⚠️ Points importants

### 1. Message d'erreur Android incorrect

**Le message dans vos logs Android dit :**
```
⚠️ Erreur 403 (Forbidden) - Vérifier le rôle de l'utilisateur (RECRUTEUR ou ADMIN requis)
```

**Ce message est INCORRECT** pour l'endpoint `/castings/{id}/apply` qui nécessite le rôle **ACTEUR**, pas RECRUTEUR.

**Action requise** : Corriger le message d'erreur dans votre `AuthInterceptor` ou `ErrorInterceptor` :

```kotlin
// Dans votre ErrorInterceptor ou AuthInterceptor
when {
    request.url.toString().contains("/castings") && 
    request.url.toString().contains("/apply") -> {
        // Candidature - nécessite ACTEUR
        Log.e("ERROR", "⚠️ Erreur 403 (Forbidden) - Vérifier le rôle de l'utilisateur (ACTEUR requis)")
        showError("Seuls les acteurs peuvent postuler à un casting")
    }
    request.url.toString().contains("/castings") && 
    request.method == "POST" && 
    !request.url.toString().contains("/apply") -> {
        // Création - nécessite RECRUTEUR ou ADMIN
        Log.e("ERROR", "⚠️ Erreur 403 (Forbidden) - Vérifier le rôle de l'utilisateur (RECRUTEUR ou ADMIN requis)")
        showError("Seuls les recruteurs peuvent créer des castings")
    }
    else -> {
        Log.e("ERROR", "⚠️ Erreur 403 (Forbidden)")
        showError("Accès refusé")
    }
}
```

### 2. Vérifier les logs backend

**Les logs backend dans Vercel sont CRITIQUES** pour identifier le problème. Sans ces logs, il est impossible de savoir où exactement ça bloque.

**Comment accéder aux logs Vercel :**
1. Aller sur https://vercel.com
2. Sélectionner le projet
3. Aller dans "Deployments"
4. Cliquer sur le dernier déploiement
5. Aller dans "Functions" ou "Logs"
6. Chercher les logs avec `[JWT Guard]`, `[JWT Strategy]`, `[RolesGuard]`, `[CastingsController]`

---

## 📊 Informations de contexte

### Acteur
- **ID** : `690cda42dc65a1a3fc2c6a20`
- **Email** : `user@user.com`
- **Rôle** : `ACTEUR`
- **Type** : `ACTEUR`

### Casting
- **ID** : `693f0a9897caff2222dc87f1`
- Vérifier que ce casting existe et est ouvert

### Token JWT
- **Valide** : Oui (expire dans 165 heures)
- **Contient** : `sub`, `role=ACTEUR`, `type=ACTEUR`, `email`

---

## 🚨 Actions immédiates

1. **Vérifier les logs backend dans Vercel** (URGENT)
2. **Corriger le message d'erreur Android** (dit RECRUTEUR au lieu de ACTEUR)
3. **Tester avec les logs de diagnostic** ci-dessus
4. **Partager les logs backend** avec l'équipe backend si problème persiste

---

## 📞 Si le problème persiste

Fournir à l'équipe backend :

1. **Logs backend complets** depuis Vercel :
   - Tous les logs `[JWT Guard]`
   - Tous les logs `[JWT Strategy]`
   - Tous les logs `[RolesGuard]`
   - Tous les logs `[CastingsController]`

2. **Logs Android complets** :
   - Token décodé complet
   - Tous les headers de la requête
   - Body de la réponse d'erreur

3. **Informations sur le casting** :
   - ID : `693f0a9897caff2222dc87f1`
   - Le casting est-il ouvert ?
   - L'acteur a-t-il déjà postulé ?

---

## ✅ Résumé

- ✅ Le backend a été corrigé avec logs détaillés et amélioration de la comparaison des rôles
- ⚠️ Le message d'erreur Android est incorrect (dit RECRUTEUR au lieu de ACTEUR)
- 🔍 Les logs backend permettront d'identifier rapidement le problème
- 📋 Tester avec les scénarios ci-dessus et vérifier les logs backend

**Le problème est probablement dans la comparaison des rôles ou dans l'extraction de l'utilisateur. Les logs backend indiqueront exactement où ça bloque.**

**Merci de vérifier les logs backend dans Vercel et de nous faire un retour !** 🙏

