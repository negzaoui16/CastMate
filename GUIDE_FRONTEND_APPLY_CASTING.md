# 📱 Guide Frontend - Comment postuler à un casting (POST /castings/{id}/apply)

**Date:** 2025-12-14  
**Status:** ✅ Backend testé et fonctionnel via Swagger

---

## ✅ Confirmation Backend

Le backend fonctionne parfaitement. Les logs montrent :
- ✅ Authentification réussie
- ✅ Vérification des rôles réussie (`ACTEUR` autorisé)
- ✅ ID utilisateur extrait : `690cda42dc65a1a3fc2c6a20`
- ✅ Accès au controller réussi

**Le problème est donc côté Android/Frontend.**

---

## 📋 Spécifications de l'API

### Endpoint
```
POST /castings/{id}/apply
```

### Authentification
```
Authorization: Bearer <JWT_TOKEN>
```

### Rôle requis
- **ACTEUR** uniquement

### Content-Type
```
multipart/form-data
```

### Paramètres

| Paramètre | Type | Requis | Description |
|-----------|------|--------|-------------|
| `id` | string | ✅ Oui | ID du casting (dans l'URL) |
| `video` | File | ❌ Non | Vidéo d'audition (max 50MB, formats: mp4, avi, mov, wmv) |
| `aiFeedback` | string | ❌ Non | Feedback IA au format JSON string |

---

## 🎯 Exemple complet (Kotlin/Android)

### 1. Modèle de données pour AI Feedback

```kotlin
data class AIFeedback(
    val globalScore: Int,
    val emotions: EmotionAnalysis,
    val posture: PostureAnalysis,
    val intonation: IntonationAnalysis,
    val expressivite: ExpressivityAnalysis,
    val recommendations: List<String>,
    val strengths: List<String>,
    val summary: String
)

data class EmotionAnalysis(
    val detected: List<String>,
    val coherence: Int,
    val intensity: Int,
    val comment: String
)

data class PostureAnalysis(
    val score: Int,
    val strengths: List<String>,
    val improvements: List<String>,
    val comment: String
)

data class IntonationAnalysis(
    val score: Int,
    val clarity: Int,
    val rhythm: Int,
    val expressiveness: Int,
    val comment: String
)

data class ExpressivityAnalysis(
    val score: Int,
    val facialExpressions: String,
    val bodyLanguage: String,
    val comment: String
)
```

### 2. Fonction pour postuler avec vidéo

```kotlin
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.RequestBody.Companion.asRequestBody
import com.google.gson.Gson
import java.io.File

suspend fun applyToCasting(
    castingId: String,
    videoFile: File?,
    aiFeedback: AIFeedback?
): Result<CastingApplicationResponse> = withContext(Dispatchers.IO) {
    try {
        // 1. Récupérer le token
        val token = tokenManager.getToken()
        if (token == null) {
            return@withContext Result.failure(Exception("Token manquant"))
        }

        // 2. Construire le FormData
        val formDataBuilder = MultipartBody.Builder()
            .setType(MultipartBody.FORM)

        // 3. Ajouter la vidéo si elle existe
        if (videoFile != null && videoFile.exists()) {
            val mediaType = "video/mp4".toMediaTypeOrNull()
            val requestBody = videoFile.asRequestBody(mediaType)
            formDataBuilder.addFormDataPart(
                "video",
                videoFile.name,
                requestBody
            )
            Log.d("APPLY", "Vidéo ajoutée: ${videoFile.name} (${videoFile.length()} bytes)")
        } else {
            Log.d("APPLY", "Pas de vidéo - FormData vide")
        }

        // 4. Ajouter le feedback IA si il existe
        if (aiFeedback != null) {
            val gson = Gson()
            val aiFeedbackJson = gson.toJson(aiFeedback)
            formDataBuilder.addFormDataPart("aiFeedback", aiFeedbackJson)
            Log.d("APPLY", "AI Feedback ajouté: ${aiFeedbackJson.substring(0, 100)}...")
        }

        val formData = formDataBuilder.build()

        // 5. Construire la requête
        val url = "${ApiConfig.BASE_URL}/castings/$castingId/apply"
        val request = Request.Builder()
            .url(url)
            .post(formData)
            .addHeader("Authorization", "Bearer $token")
            .build()

        Log.d("APPLY", "========== REQUÊTE APPLY ==========")
        Log.d("APPLY", "URL: $url")
        Log.d("APPLY", "Method: POST")
        Log.d("APPLY", "Content-Type: ${formData.contentType()}")
        Log.d("APPLY", "Has video: ${videoFile != null}")
        Log.d("APPLY", "Has AI feedback: ${aiFeedback != null}")
        Log.d("APPLY", "===================================")

        // 6. Envoyer la requête
        val response = okHttpClient.newCall(request).execute()

        Log.d("APPLY", "Response code: ${response.code}")

        if (response.isSuccessful) {
            val responseBody = response.body?.string() ?: "{}"
            val result = gson.fromJson(responseBody, CastingApplicationResponse::class.java)
            Log.d("APPLY", "✅ Candidature envoyée avec succès")
            Result.success(result)
        } else {
            val errorBody = response.body?.string() ?: "Erreur inconnue"
            Log.e("APPLY", "❌ Erreur ${response.code}: $errorBody")
            Result.failure(Exception("Erreur ${response.code}: $errorBody"))
        }
    } catch (e: Exception) {
        Log.e("APPLY", "❌ Exception: ${e.message}", e)
        Result.failure(e)
    }
}

data class CastingApplicationResponse(
    val message: String,
    val candidat: CandidatInfo?
)

data class CandidatInfo(
    val acteurId: String,
    val datePostulation: String,
    val statut: String
)
```

### 3. Fonction pour postuler SANS vidéo

```kotlin
suspend fun applyToCastingWithoutVideo(
    castingId: String,
    aiFeedback: AIFeedback? = null
): Result<CastingApplicationResponse> {
    return applyToCasting(castingId, null, aiFeedback)
}
```

### 4. Utilisation dans un ViewModel

```kotlin
class CastingViewModel(
    private val castingRepository: CastingRepository,
    private val tokenManager: TokenManager
) : ViewModel() {

    private val _applyState = MutableLiveData<ApplyState>()
    val applyState: LiveData<ApplyState> = _applyState

    fun applyToCasting(castingId: String, videoFile: File?, aiFeedback: AIFeedback?) {
        viewModelScope.launch {
            _applyState.value = ApplyState.Loading

            val result = castingRepository.applyToCasting(castingId, videoFile, aiFeedback)

            _applyState.value = if (result.isSuccess) {
                ApplyState.Success(result.getOrNull()!!)
            } else {
                ApplyState.Error(result.exceptionOrNull()?.message ?: "Erreur inconnue")
            }
        }
    }
}

sealed class ApplyState {
    object Idle : ApplyState()
    object Loading : ApplyState()
    data class Success(val response: CastingApplicationResponse) : ApplyState()
    data class Error(val message: String) : ApplyState()
}
```

### 5. Utilisation dans une Activity/Fragment

```kotlin
class CastingDetailsActivity : AppCompatActivity() {

    private lateinit var viewModel: CastingViewModel
    private var selectedVideoFile: File? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setBinding()

        val castingId = intent.getStringExtra("CASTING_ID") ?: return

        // Observer l'état de la candidature
        viewModel.applyState.observe(this) { state ->
            when (state) {
                is ApplyState.Loading -> {
                    showLoading(true)
                }
                is ApplyState.Success -> {
                    showLoading(false)
                    showSuccess("Candidature envoyée avec succès !")
                }
                is ApplyState.Error -> {
                    showLoading(false)
                    showError(state.message)
                }
                else -> {}
            }
        }

        // Bouton pour postuler
        binding.btnApply.setOnClickListener {
            applyToCasting(castingId)
        }

        // Bouton pour sélectionner une vidéo
        binding.btnSelectVideo.setOnClickListener {
            selectVideo()
        }
    }

    private fun applyToCasting(castingId: String) {
        // Option 1 : Avec vidéo et AI feedback
        val aiFeedback = AIFeedback(
            globalScore = 75,
            emotions = EmotionAnalysis(
                detected = listOf("joie", "confiance"),
                coherence = 80,
                intensity = 70,
                comment = "Émotions bien exprimées"
            ),
            posture = PostureAnalysis(
                score = 70,
                strengths = listOf("Bonne posture"),
                improvements = listOf(),
                comment = "Posture correcte"
            ),
            intonation = IntonationAnalysis(
                score = 75,
                clarity = 80,
                rhythm = 70,
                expressiveness = 75,
                comment = "Bonne intonation"
            ),
            expressivite = ExpressivityAnalysis(
                score = 80,
                facialExpressions = "Expressif",
                bodyLanguage = "Naturel",
                comment = "Très bien"
            ),
            recommendations = listOf("Varier le ton"),
            strengths = listOf("Bonne diction", "Présence scénique"),
            summary = "Performance solide avec une bonne maîtrise émotionnelle"
        )

        viewModel.applyToCasting(castingId, selectedVideoFile, aiFeedback)

        // Option 2 : Sans vidéo et sans AI feedback
        // viewModel.applyToCasting(castingId, null, null)
    }

    private fun selectVideo() {
        val intent = Intent(Intent.ACTION_GET_CONTENT)
        intent.type = "video/*"
        videoPickerLauncher.launch(intent)
    }

    private val videoPickerLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == RESULT_OK) {
            result.data?.data?.let { uri ->
                selectedVideoFile = uriToFile(uri)
                binding.tvVideoSelected.text = "Vidéo sélectionnée: ${selectedVideoFile?.name}"
            }
        }
    }

    private fun uriToFile(uri: Uri): File {
        val contentResolver = contentResolver
        val fileName = getFileName(uri)
        val tempFile = File(cacheDir, fileName)
        
        contentResolver.openInputStream(uri)?.use { input ->
            tempFile.outputStream().use { output ->
                input.copyTo(output)
            }
        }
        
        return tempFile
    }

    private fun getFileName(uri: Uri): String {
        var result: String? = null
        if (uri.scheme == "content") {
            val cursor = contentResolver.query(uri, null, null, null, null)
            cursor?.use {
                if (it.moveToFirst()) {
                    val index = it.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                    if (index >= 0) {
                        result = it.getString(index)
                    }
                }
            }
        }
        return result ?: "video_${System.currentTimeMillis()}.mp4"
    }
}
```

---

## 🔧 Configuration OkHttpClient

```kotlin
object ApiConfig {
    const val BASE_URL = "https://cast-mate.vercel.app"
    
    private val loggingInterceptor = HttpLoggingInterceptor().apply {
        level = HttpLoggingInterceptor.Level.BODY
    }
    
    val okHttpClient = OkHttpClient.Builder()
        .addInterceptor(loggingInterceptor)
        .addInterceptor(AuthInterceptor(tokenManager)) // Votre intercepteur
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .build()
}
```

---

## 🧪 Tests à effectuer

### Test 1 : Postuler avec vidéo

```kotlin
@Test
fun testApplyWithVideo() = runBlocking {
    val castingId = "693f0a9897caff2222dc87f1"
    val videoFile = File("/path/to/video.mp4")
    val aiFeedback = AIFeedback(/* ... */)
    
    val result = castingRepository.applyToCasting(castingId, videoFile, aiFeedback)
    
    assertTrue(result.isSuccess)
}
```

### Test 2 : Postuler sans vidéo

```kotlin
@Test
fun testApplyWithoutVideo() = runBlocking {
    val castingId = "693f0a9897caff2222dc87f1"
    
    val result = castingRepository.applyToCasting(castingId, null, null)
    
    assertTrue(result.isSuccess)
}
```

### Test 3 : Postuler sans token (doit échouer)

```kotlin
@Test
fun testApplyWithoutToken() = runBlocking {
    tokenManager.clearToken()
    
    val castingId = "693f0a9897caff2222dc87f1"
    val result = castingRepository.applyToCasting(castingId, null, null)
    
    assertTrue(result.isFailure)
}
```

---

## ⚠️ Points d'attention

### 1. Token JWT

Le token doit contenir :
```json
{
  "sub": "690cda42dc65a1a3fc2c6a20",  // ID de l'acteur
  "role": "ACTEUR",                    // Rôle ACTEUR requis
  "type": "ACTEUR",                    // Type ACTEUR
  "email": "user@user.com",
  "exp": 1766356463                    // Date d'expiration
}
```

### 2. Format de la vidéo

- **Formats acceptés** : mp4, avi, mov, wmv
- **Taille max** : 50 MB
- **Durée max** : 30 secondes (recommandé)

### 3. Format du AI Feedback

Le feedback IA doit être un **JSON string**, pas un objet JSON directement :

```kotlin
// ✅ CORRECT
val aiFeedbackJson = gson.toJson(aiFeedback)
formDataBuilder.addFormDataPart("aiFeedback", aiFeedbackJson)

// ❌ INCORRECT
formDataBuilder.addFormDataPart("aiFeedback", aiFeedback) // Ne pas passer l'objet directement
```

### 4. Content-Type

Le Content-Type doit être `multipart/form-data`. OkHttp le gère automatiquement avec `MultipartBody.Builder()`.

### 5. Headers requis

```
Authorization: Bearer <JWT_TOKEN>
Content-Type: multipart/form-data; boundary=----WebKitFormBoundary...
```

**Ne PAS ajouter manuellement le Content-Type**, OkHttp le fait automatiquement.

---

## 🐛 Problèmes courants et solutions

### Problème 1 : Erreur 403 Forbidden

**Cause** : Token invalide ou rôle incorrect

**Solution** :
```kotlin
// Vérifier le token avant d'envoyer
val payload = decodeJWT(token)
Log.d("DEBUG", "Role: ${payload?.get("role")}")
Log.d("DEBUG", "Type: ${payload?.get("type")}")

if (payload?.get("role") != "ACTEUR") {
    showError("Vous devez être un acteur pour postuler")
    return
}
```

### Problème 2 : Erreur 400 Bad Request

**Cause** : Format de la requête incorrect ou vidéo trop grande

**Solution** :
```kotlin
// Vérifier la taille de la vidéo
if (videoFile.length() > 50 * 1024 * 1024) { // 50 MB
    showError("La vidéo est trop grande (max 50 MB)")
    return
}

// Vérifier le format
val extension = videoFile.extension.lowercase()
if (extension !in listOf("mp4", "avi", "mov", "wmv")) {
    showError("Format vidéo non supporté")
    return
}
```

### Problème 3 : Erreur 404 Not Found

**Cause** : ID du casting incorrect ou casting inexistant

**Solution** :
```kotlin
// Vérifier que l'ID est valide (24 caractères hexadécimaux)
if (!castingId.matches(Regex("^[0-9a-fA-F]{24}$"))) {
    showError("ID du casting invalide")
    return
}
```

### Problème 4 : Erreur 409 Conflict

**Cause** : L'acteur a déjà postulé à ce casting

**Solution** :
```kotlin
if (response.code == 409) {
    showInfo("Vous avez déjà postulé à ce casting")
}
```

### Problème 5 : Timeout

**Cause** : Vidéo trop grande ou connexion lente

**Solution** :
```kotlin
val okHttpClient = OkHttpClient.Builder()
    .connectTimeout(60, TimeUnit.SECONDS)  // Augmenter le timeout
    .readTimeout(60, TimeUnit.SECONDS)
    .writeTimeout(60, TimeUnit.SECONDS)
    .build()
```

---

## 📊 Réponses de l'API

### Succès (200 OK)

```json
{
  "message": "Candidature enregistrée avec succès",
  "candidat": {
    "acteurId": "690cda42dc65a1a3fc2c6a20",
    "datePostulation": "2024-12-14T23:30:00.000Z",
    "statut": "en_attente"
  }
}
```

### Erreur 400 (Bad Request)

```json
{
  "statusCode": 400,
  "message": "Ce casting n'accepte plus de candidatures (date de fin dépassée ou casting fermé manuellement)",
  "error": "Bad Request"
}
```

### Erreur 403 (Forbidden)

```json
{
  "statusCode": 403,
  "message": "Accès refusé. Rôles requis: ACTEUR. Votre rôle: RECRUTEUR",
  "error": "Forbidden"
}
```

### Erreur 404 (Not Found)

```json
{
  "statusCode": 404,
  "message": "Casting non trouvé",
  "error": "Not Found"
}
```

### Erreur 409 (Conflict)

```json
{
  "statusCode": 409,
  "message": "Vous avez déjà postulé à ce casting",
  "error": "Conflict"
}
```

---

## ✅ Checklist de vérification

Avant d'envoyer la requête, vérifier :

- [ ] Le token JWT est valide et non expiré
- [ ] Le token contient `role=ACTEUR` et `type=ACTEUR`
- [ ] L'ID du casting est valide (24 caractères hexadécimaux)
- [ ] La vidéo est au bon format (mp4, avi, mov, wmv)
- [ ] La vidéo fait moins de 50 MB
- [ ] Le Content-Type est `multipart/form-data` (géré automatiquement par OkHttp)
- [ ] Le header `Authorization: Bearer <token>` est présent
- [ ] Le AI Feedback est un JSON string, pas un objet

---

## 📞 Support

Si vous rencontrez des problèmes :

1. **Vérifier les logs Android** pour voir la requête exacte envoyée
2. **Vérifier les logs backend** dans Vercel pour voir l'erreur exacte
3. **Tester dans Swagger** pour confirmer que le backend fonctionne
4. **Comparer la requête Android avec la requête Swagger** pour identifier les différences

---

## 🎯 Résumé

1. **Endpoint** : `POST /castings/{id}/apply`
2. **Authentification** : `Bearer <JWT_TOKEN>` avec `role=ACTEUR`
3. **Content-Type** : `multipart/form-data` (géré automatiquement)
4. **Paramètres** :
   - `video` (optionnel) : Fichier vidéo (max 50 MB)
   - `aiFeedback` (optionnel) : JSON string du feedback IA
5. **Réponse** : JSON avec message de confirmation et infos du candidat

Le backend fonctionne parfaitement. Le problème est probablement dans la façon dont la requête est construite côté Android. Suivez ce guide pour corriger l'implémentation.

**Bon courage !** 🚀

