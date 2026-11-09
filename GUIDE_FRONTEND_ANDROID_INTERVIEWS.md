# 📱 Guide Frontend Android Kotlin - Module Interviews et Agenda

## 📋 Vue d'ensemble

Ce guide décrit comment intégrer les fonctionnalités **Interview** et **Agenda** dans l'application Android Kotlin. Ces fonctionnalités permettent aux agences de proposer des dates d'interview aux acteurs acceptés, et aux acteurs de choisir une date parmi celles proposées.

---

## 🔄 Changements Effectués dans le Backend

### Nouveau Module : Interviews

Un nouveau module `Interviews` a été ajouté au backend avec les fonctionnalités suivantes :

1. **Schéma Interview** : Nouveau modèle MongoDB pour stocker les interviews
2. **6 nouveaux endpoints** pour gérer les interviews
3. **Modification de CastingsController** : Nouvelle route pour accepter un candidat avec dates d'interview

### Structure des Données

#### Interview

```kotlin
data class Interview(
    val id: String,
    val castingId: String,
    val castingTitle: String,
    val acteurId: String,
    val acteurName: String,
    val agenceId: String,
    val agenceName: String,
    val proposedDates: List<ProposedDate>,
    val selectedDate: String? = null,
    val selectedTime: String? = null,
    val status: InterviewStatus, // PENDING, CONFIRMED, CANCELLED
    val createdAt: String,
    val updatedAt: String
)

data class ProposedDate(
    val date: String, // Format: "YYYY-MM-DD"
    val time: String? = null, // Format: "HH:mm"
    val isSelected: Boolean = false
)

enum class InterviewStatus {
    PENDING,
    CONFIRMED,
    CANCELLED
}
```

---

## 🛠️ Configuration Retrofit

### 1. Interface API Interviews

```kotlin
import retrofit2.Response
import retrofit2.http.*

interface InterviewApiService {
    
    // Sélectionner une date d'interview (Acteur)
    @PATCH("interviews/{interviewId}/select-date")
    suspend fun selectInterviewDate(
        @Path("interviewId") interviewId: String,
        @Body request: SelectInterviewDateRequest
    ): Response<InterviewResponse>
    
    // Obtenir les interviews d'un acteur
    @GET("interviews/actor")
    suspend fun getActorInterviews(
        @Query("status") status: String? = null // PENDING, CONFIRMED, CANCELLED
    ): Response<InterviewsListResponse>
    
    // Obtenir les interviews d'une agence
    @GET("interviews/agency")
    suspend fun getAgencyInterviews(
        @Query("status") status: String? = null,
        @Query("castingId") castingId: String? = null
    ): Response<InterviewsListResponse>
    
    // Obtenir une interview par ID
    @GET("interviews/{interviewId}")
    suspend fun getInterviewById(
        @Path("interviewId") interviewId: String
    ): Response<InterviewResponse>
    
    // Annuler une interview
    @PATCH("interviews/{interviewId}/cancel")
    suspend fun cancelInterview(
        @Path("interviewId") interviewId: String
    ): Response<InterviewResponse>
}
```

### 2. Interface API Castings (Modifiée)

```kotlin
interface CastingApiService {
    
    // ... endpoints existants ...
    
    // NOUVEAU : Accepter un candidat avec dates d'interview
    @POST("castings/{castingId}/candidates/{acteurId}/accept-with-interview")
    suspend fun acceptCandidateWithInterview(
        @Path("castingId") castingId: String,
        @Path("acteurId") acteurId: String,
        @Body request: AcceptCandidateWithInterviewRequest
    ): Response<AcceptCandidateWithInterviewResponse>
}
```

---

## 📦 Modèles de Données (Data Classes)

### Request DTOs

```kotlin
data class AcceptCandidateWithInterviewRequest(
    val proposedDates: List<InterviewDateOption>
)

data class InterviewDateOption(
    val date: String, // Format: "YYYY-MM-DD"
    val time: String? = null // Format: "HH:mm" (optionnel)
)

data class SelectInterviewDateRequest(
    val selectedDate: String, // Format: "YYYY-MM-DD"
    val selectedTime: String? = null // Format: "HH:mm" (optionnel)
)
```

### Response DTOs

```kotlin
data class InterviewResponse(
    val id: String,
    val castingId: String,
    val castingTitle: String,
    val acteurId: String,
    val acteurName: String,
    val agenceId: String,
    val agenceName: String,
    val proposedDates: List<ProposedDateResponse>,
    val selectedDate: String?,
    val selectedTime: String?,
    val status: String,
    val createdAt: String,
    val updatedAt: String
)

data class ProposedDateResponse(
    val date: String,
    val time: String?,
    val isSelected: Boolean
)

data class InterviewsListResponse(
    val interviews: List<InterviewResponse>
)

data class AcceptCandidateWithInterviewResponse(
    val casting: CastingResponse, // Réponse du casting mis à jour
    val interview: InterviewResponse // Nouvelle interview créée
)
```

---

## 🎯 Endpoints Détaillés

### 1. POST `/castings/:id/candidates/:acteurId/accept-with-interview`

**Description** : Accepter un candidat et proposer 3 dates d'interview

**Auth** : Requis (JWT), Rôle: RECRUTEUR ou ADMIN

**Request Body** :
```kotlin
AcceptCandidateWithInterviewRequest(
    proposedDates = listOf(
        InterviewDateOption(date = "2025-12-03", time = "14:00"),
        InterviewDateOption(date = "2025-12-04", time = "14:00"),
        InterviewDateOption(date = "2025-12-05", time = "14:00")
    )
)
```

**Response 200** :
```kotlin
AcceptCandidateWithInterviewResponse(
    casting = CastingResponse(...),
    interview = InterviewResponse(
        id = "...",
        castingId = "...",
        castingTitle = "...",
        status = "PENDING",
        proposedDates = listOf(...)
    )
)
```

**Codes d'erreur** :
- `400` : Dates invalides, moins de 3 dates, dates dans le passé, dates non uniques
- `403` : Vous n'êtes pas propriétaire du casting
- `404` : Casting ou acteur non trouvé
- `409` : Interview déjà créée pour ce candidat

**Exemple d'utilisation Kotlin** :
```kotlin
suspend fun acceptCandidateWithInterview(
    castingId: String,
    acteurId: String,
    dates: List<Pair<String, String?>> // (date, time?)
): Result<AcceptCandidateWithInterviewResponse> {
    return try {
        val request = AcceptCandidateWithInterviewRequest(
            proposedDates = dates.map { (date, time) ->
                InterviewDateOption(date = date, time = time)
            }
        )
        
        val response = castingApiService.acceptCandidateWithInterview(
            castingId = castingId,
            acteurId = acteurId,
            request = request
        )
        
        if (response.isSuccessful && response.body() != null) {
            Result.success(response.body()!!)
        } else {
            Result.failure(Exception("Erreur: ${response.code()} - ${response.message()}"))
        }
    } catch (e: Exception) {
        Result.failure(e)
    }
}
```

---

### 2. PATCH `/interviews/:interviewId/select-date`

**Description** : Sélectionner une date d'interview (Acteur)

**Auth** : Requis (JWT), Rôle: ACTEUR

**Request Body** :
```kotlin
SelectInterviewDateRequest(
    selectedDate = "2025-12-03",
    selectedTime = "14:00" // Optionnel, prendra l'heure de la date proposée si non fourni
)
```

**Response 200** :
```kotlin
InterviewResponse(
    id = "...",
    status = "CONFIRMED",
    selectedDate = "2025-12-03",
    selectedTime = "14:00",
    proposedDates = listOf(
        ProposedDateResponse(date = "2025-12-03", time = "14:00", isSelected = true),
        ProposedDateResponse(date = "2025-12-04", time = "14:00", isSelected = false),
        ProposedDateResponse(date = "2025-12-05", time = "14:00", isSelected = false)
    )
)
```

**Codes d'erreur** :
- `400` : Date non proposée, date invalide, statut incorrect
- `403` : Vous n'êtes pas l'acteur concerné
- `404` : Interview non trouvée

**Exemple d'utilisation Kotlin** :
```kotlin
suspend fun selectInterviewDate(
    interviewId: String,
    date: String,
    time: String? = null
): Result<InterviewResponse> {
    return try {
        val request = SelectInterviewDateRequest(
            selectedDate = date,
            selectedTime = time
        )
        
        val response = interviewApiService.selectInterviewDate(
            interviewId = interviewId,
            request = request
        )
        
        if (response.isSuccessful && response.body() != null) {
            Result.success(response.body()!!)
        } else {
            Result.failure(Exception("Erreur: ${response.code()}"))
        }
    } catch (e: Exception) {
        Result.failure(e)
    }
}
```

---

### 3. GET `/interviews/actor`

**Description** : Obtenir toutes les interviews d'un acteur

**Auth** : Requis (JWT), Rôle: ACTEUR

**Query Parameters** :
- `status` (optionnel) : `PENDING`, `CONFIRMED`, ou `CANCELLED`

**Response 200** :
```kotlin
InterviewsListResponse(
    interviews = listOf(
        InterviewResponse(...),
        InterviewResponse(...)
    )
)
```

**Exemple d'utilisation Kotlin** :
```kotlin
suspend fun getActorInterviews(
    status: InterviewStatus? = null
): Result<List<InterviewResponse>> {
    return try {
        val response = interviewApiService.getActorInterviews(
            status = status?.name
        )
        
        if (response.isSuccessful && response.body() != null) {
            Result.success(response.body()!!.interviews)
        } else {
            Result.failure(Exception("Erreur: ${response.code()}"))
        }
    } catch (e: Exception) {
        Result.failure(e)
    }
}
```

---

### 4. GET `/interviews/agency`

**Description** : Obtenir toutes les interviews d'une agence

**Auth** : Requis (JWT), Rôle: RECRUTEUR ou ADMIN

**Query Parameters** :
- `status` (optionnel) : `PENDING`, `CONFIRMED`, ou `CANCELLED`
- `castingId` (optionnel) : Filtrer par ID de casting

**Response 200** :
```kotlin
InterviewsListResponse(
    interviews = listOf(...)
)
```

**Exemple d'utilisation Kotlin** :
```kotlin
suspend fun getAgencyInterviews(
    status: InterviewStatus? = null,
    castingId: String? = null
): Result<List<InterviewResponse>> {
    return try {
        val response = interviewApiService.getAgencyInterviews(
            status = status?.name,
            castingId = castingId
        )
        
        if (response.isSuccessful && response.body() != null) {
            Result.success(response.body()!!.interviews)
        } else {
            Result.failure(Exception("Erreur: ${response.code()}"))
        }
    } catch (e: Exception) {
        Result.failure(e)
    }
}
```

---

### 5. GET `/interviews/:interviewId`

**Description** : Obtenir les détails d'une interview spécifique

**Auth** : Requis (JWT), Doit être l'acteur concerné ou l'agence propriétaire

**Response 200** :
```kotlin
InterviewResponse(...)
```

**Codes d'erreur** :
- `403` : Vous n'êtes pas autorisé à voir cette interview
- `404` : Interview non trouvée

**Exemple d'utilisation Kotlin** :
```kotlin
suspend fun getInterviewById(interviewId: String): Result<InterviewResponse> {
    return try {
        val response = interviewApiService.getInterviewById(interviewId)
        
        if (response.isSuccessful && response.body() != null) {
            Result.success(response.body()!!)
        } else {
            Result.failure(Exception("Erreur: ${response.code()}"))
        }
    } catch (e: Exception) {
        Result.failure(e)
    }
}
```

---

### 6. PATCH `/interviews/:interviewId/cancel`

**Description** : Annuler une interview

**Auth** : Requis (JWT), Doit être l'acteur concerné ou l'agence propriétaire

**Response 200** :
```kotlin
InterviewResponse(
    status = "CANCELLED"
)
```

**Codes d'erreur** :
- `400` : Interview déjà annulée
- `403` : Vous n'êtes pas autorisé à annuler cette interview
- `404` : Interview non trouvée

**Exemple d'utilisation Kotlin** :
```kotlin
suspend fun cancelInterview(interviewId: String): Result<InterviewResponse> {
    return try {
        val response = interviewApiService.cancelInterview(interviewId)
        
        if (response.isSuccessful && response.body() != null) {
            Result.success(response.body()!!)
        } else {
            Result.failure(Exception("Erreur: ${response.code()}"))
        }
    } catch (e: Exception) {
        Result.failure(e)
    }
}
```

---

## 🔐 Gestion de l'Authentification

Tous les endpoints nécessitent un token JWT. Assurez-vous d'inclure le header Authorization :

```kotlin
// Dans votre interceptor Retrofit
class AuthInterceptor(private val tokenManager: TokenManager) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request().newBuilder()
            .addHeader("Authorization", "Bearer ${tokenManager.getToken()}")
            .build()
        return chain.proceed(request)
    }
}
```

---

## 📱 Exemples d'Utilisation Complets

### Scénario 1 : Agence accepte un candidat avec dates d'interview

```kotlin
class CastingViewModel(
    private val castingApiService: CastingApiService
) : ViewModel() {
    
    fun acceptCandidateWithInterview(
        castingId: String,
        acteurId: String,
        dates: List<Pair<String, String?>> // List<Pair<date, time?>>
    ) {
        viewModelScope.launch {
            try {
                val request = AcceptCandidateWithInterviewRequest(
                    proposedDates = dates.map { (date, time) ->
                        InterviewDateOption(date = date, time = time)
                    }
                )
                
                val response = castingApiService.acceptCandidateWithInterview(
                    castingId = castingId,
                    acteurId = acteurId,
                    request = request
                )
                
                if (response.isSuccessful) {
                    val result = response.body()!!
                    // Mettre à jour l'UI avec le casting et l'interview créée
                    _uiState.value = UiState.Success(result)
                } else {
                    // Gérer l'erreur
                    _uiState.value = UiState.Error("Erreur: ${response.code()}")
                }
            } catch (e: Exception) {
                _uiState.value = UiState.Error(e.message ?: "Erreur inconnue")
            }
        }
    }
}
```

### Scénario 2 : Acteur sélectionne une date d'interview

```kotlin
class InterviewViewModel(
    private val interviewApiService: InterviewApiService
) : ViewModel() {
    
    fun selectDate(interviewId: String, date: String, time: String? = null) {
        viewModelScope.launch {
            try {
                val request = SelectInterviewDateRequest(
                    selectedDate = date,
                    selectedTime = time
                )
                
                val response = interviewApiService.selectInterviewDate(
                    interviewId = interviewId,
                    request = request
                )
                
                if (response.isSuccessful) {
                    val interview = response.body()!!
                    // Mettre à jour l'UI
                    _uiState.value = UiState.Success(interview)
                } else {
                    _uiState.value = UiState.Error("Erreur: ${response.code()}")
                }
            } catch (e: Exception) {
                _uiState.value = UiState.Error(e.message ?: "Erreur inconnue")
            }
        }
    }
}
```

### Scénario 3 : Afficher l'agenda d'un acteur

```kotlin
class AgendaViewModel(
    private val interviewApiService: InterviewApiService
) : ViewModel() {
    
    private val _interviews = MutableStateFlow<List<InterviewResponse>>(emptyList())
    val interviews: StateFlow<List<InterviewResponse>> = _interviews.asStateFlow()
    
    fun loadInterviews(status: InterviewStatus? = null) {
        viewModelScope.launch {
            try {
                val response = interviewApiService.getActorInterviews(status = status?.name)
                
                if (response.isSuccessful && response.body() != null) {
                    _interviews.value = response.body()!!.interviews
                } else {
                    // Gérer l'erreur
                }
            } catch (e: Exception) {
                // Gérer l'erreur
            }
        }
    }
    
    // Filtrer par statut
    fun filterByStatus(status: InterviewStatus) {
        viewModelScope.launch {
            loadInterviews(status)
        }
    }
}
```

---

## 🎨 Exemple d'UI avec Jetpack Compose

### Écran de sélection de date d'interview

```kotlin
@Composable
fun SelectInterviewDateScreen(
    interview: InterviewResponse,
    onDateSelected: (String, String?) -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp)
    ) {
        Text(
            text = "Choisissez une date pour votre interview",
            style = MaterialTheme.typography.h5,
            modifier = Modifier.padding(bottom = 16.dp)
        )
        
        Text(
            text = "Casting: ${interview.castingTitle}",
            style = MaterialTheme.typography.body1,
            modifier = Modifier.padding(bottom = 8.dp)
        )
        
        interview.proposedDates.forEach { proposedDate ->
            InterviewDateCard(
                date = proposedDate.date,
                time = proposedDate.time,
                isSelected = proposedDate.isSelected,
                onClick = {
                    onDateSelected(proposedDate.date, proposedDate.time)
                }
            )
        }
    }
}

@Composable
fun InterviewDateCard(
    date: String,
    time: String?,
    isSelected: Boolean,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp)
            .clickable { onClick() },
        border = if (isSelected) {
            BorderStroke(2.dp, Color.Blue)
        } else {
            null
        }
    ) {
        Column(
            modifier = Modifier.padding(16.dp)
        ) {
            Text(
                text = formatDate(date),
                style = MaterialTheme.typography.h6
            )
            time?.let {
                Text(
                    text = "À $it",
                    style = MaterialTheme.typography.body2
                )
            }
        }
    }
}
```

### Écran d'agenda

```kotlin
@Composable
fun AgendaScreen(viewModel: AgendaViewModel = viewModel()) {
    val interviews by viewModel.interviews.collectAsState()
    
    LaunchedEffect(Unit) {
        viewModel.loadInterviews()
    }
    
    Column(modifier = Modifier.fillMaxSize()) {
        // Filtres
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            FilterChip(
                selected = false,
                onClick = { viewModel.loadInterviews() },
                label = { Text("Tous") }
            )
            FilterChip(
                selected = false,
                onClick = { viewModel.filterByStatus(InterviewStatus.PENDING) },
                label = { Text("En attente") }
            )
            FilterChip(
                selected = false,
                onClick = { viewModel.filterByStatus(InterviewStatus.CONFIRMED) },
                label = { Text("Confirmées") }
            )
        }
        
        // Liste des interviews
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            items(interviews) { interview ->
                InterviewCard(interview = interview)
            }
        }
    }
}

@Composable
fun InterviewCard(interview: InterviewResponse) {
    Card(
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(
            modifier = Modifier.padding(16.dp)
        ) {
            Text(
                text = interview.castingTitle,
                style = MaterialTheme.typography.h6
            )
            
            Spacer(modifier = Modifier.height(8.dp))
            
            Text(
                text = "Agence: ${interview.agenceName}",
                style = MaterialTheme.typography.body2
            )
            
            when (interview.status) {
                "PENDING" -> {
                    Text(
                        text = "En attente de votre choix",
                        color = Color.Orange
                    )
                }
                "CONFIRMED" -> {
                    Text(
                        text = "Confirmée: ${interview.selectedDate} à ${interview.selectedTime}",
                        color = Color.Green
                    )
                }
                "CANCELLED" -> {
                    Text(
                        text = "Annulée",
                        color = Color.Red
                    )
                }
            }
        }
    }
}
```

---

## ✅ Validation des Dates

### Format des Dates

- **Date** : Format ISO 8601 `YYYY-MM-DD` (ex: `2025-12-03`)
- **Heure** : Format 24h `HH:mm` (ex: `14:00`)

### Règles de Validation

1. **AcceptCandidateWithInterview** :
   - Exactement 3 dates requises
   - Toutes les dates doivent être uniques
   - Toutes les dates doivent être dans le futur
   - Si une heure est fournie, la date+heure doit être dans le futur

2. **SelectInterviewDate** :
   - La date sélectionnée doit être parmi les dates proposées
   - L'interview doit avoir le statut `PENDING`

### Exemples de validation côté client

```kotlin
fun validateInterviewDates(dates: List<InterviewDateOption>): ValidationResult {
    // Vérifier qu'il y a exactement 3 dates
    if (dates.size != 3) {
        return ValidationResult.Error("Vous devez proposer exactement 3 dates")
    }
    
    // Vérifier l'unicité des dates
    val uniqueDates = dates.map { it.date }.distinct()
    if (uniqueDates.size != dates.size) {
        return ValidationResult.Error("Les dates doivent être uniques")
    }
    
    // Vérifier que les dates sont dans le futur
    val now = Calendar.getInstance()
    dates.forEach { dateOption ->
        val date = parseDate(dateOption.date)
        if (dateOption.time != null) {
            val dateTime = parseDateTime(dateOption.date, dateOption.time)
            if (dateTime <= now.time) {
                return ValidationResult.Error("La date ${dateOption.date} à ${dateOption.time} doit être dans le futur")
            }
        } else {
            // Sans heure, la date doit être au moins demain
            val tomorrow = Calendar.getInstance().apply {
                add(Calendar.DAY_OF_YEAR, 1)
                set(Calendar.HOUR_OF_DAY, 0)
                set(Calendar.MINUTE, 0)
                set(Calendar.SECOND, 0)
                set(Calendar.MILLISECOND, 0)
            }
            if (date < tomorrow.time) {
                return ValidationResult.Error("La date ${dateOption.date} doit être dans le futur")
            }
        }
    }
    
    return ValidationResult.Success
}
```

---

## 🚨 Gestion des Erreurs

### Codes d'erreur HTTP

| Code | Description | Action suggérée |
|------|-------------|-----------------|
| 400 | Requête invalide (dates invalides, etc.) | Afficher le message d'erreur à l'utilisateur |
| 401 | Non authentifié | Rediriger vers l'écran de connexion |
| 403 | Accès refusé | Afficher un message d'erreur d'autorisation |
| 404 | Ressource non trouvée | Afficher un message "Non trouvé" |
| 409 | Conflit (interview déjà créée) | Informer l'utilisateur du conflit |

### Exemple de gestion d'erreurs

```kotlin
sealed class ApiResult<out T> {
    data class Success<out T>(val data: T) : ApiResult<T>()
    data class Error(val message: String, val code: Int? = null) : ApiResult<Nothing>()
    data class NetworkError(val exception: Exception) : ApiResult<Nothing>()
}

suspend fun <T> safeApiCall(
    apiCall: suspend () -> Response<T>
): ApiResult<T> {
    return try {
        val response = apiCall()
        if (response.isSuccessful && response.body() != null) {
            ApiResult.Success(response.body()!!)
        } else {
            val errorMessage = when (response.code()) {
                400 -> "Requête invalide. Vérifiez les données saisies."
                401 -> "Session expirée. Veuillez vous reconnecter."
                403 -> "Vous n'êtes pas autorisé à effectuer cette action."
                404 -> "Ressource non trouvée."
                409 -> "Un conflit est survenu. L'interview existe déjà."
                else -> "Erreur serveur: ${response.code()}"
            }
            ApiResult.Error(errorMessage, response.code())
        }
    } catch (e: IOException) {
        ApiResult.NetworkError(e)
    } catch (e: Exception) {
        ApiResult.Error("Erreur inattendue: ${e.message}")
    }
}
```

---

## 📝 Checklist d'Intégration

- [ ] Créer les data classes pour les DTOs (Request/Response)
- [ ] Créer l'interface `InterviewApiService` avec Retrofit
- [ ] Créer l'interface `CastingApiService` avec la nouvelle méthode
- [ ] Configurer l'interceptor d'authentification
- [ ] Implémenter les ViewModels pour chaque fonctionnalité
- [ ] Créer les écrans UI (Compose ou XML)
- [ ] Ajouter la validation des dates côté client
- [ ] Implémenter la gestion des erreurs
- [ ] Tester tous les scénarios d'utilisation
- [ ] Gérer le rafraîchissement de la liste après actions
- [ ] Ajouter des indicateurs de chargement
- [ ] Implémenter la pagination si nécessaire (pour les listes longues)

---

## 🔄 Flux Utilisateur Recommandés

### Pour les Agences (RECRUTEUR)

1. **Voir les candidats d'un casting** → Liste des candidats avec statut
2. **Accepter un candidat** → Choisir entre :
   - Accepter simplement (endpoint existant)
   - Accepter avec interview (nouvel endpoint) → Saisir 3 dates
3. **Voir les interviews** → Liste filtrée par statut/casting
4. **Suivre l'évolution** → Voir quand l'acteur a sélectionné une date

### Pour les Acteurs (ACTEUR)

1. **Voir les notifications** → Nouvelles interviews en attente
2. **Consulter l'agenda** → Liste de toutes les interviews
3. **Sélectionner une date** → Choisir parmi les 3 dates proposées
4. **Voir les interviews confirmées** → Dans l'agenda

---

## 📚 Ressources Supplémentaires

### Format de Date en Kotlin

```kotlin
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter

fun parseDate(dateString: String): LocalDate {
    return LocalDate.parse(dateString, DateTimeFormatter.ISO_DATE)
}

fun formatDate(date: LocalDate): String {
    val formatter = DateTimeFormatter.ofPattern("dd MMMM yyyy", Locale.FRENCH)
    return date.format(formatter)
}

fun parseDateTime(dateString: String, timeString: String): LocalDateTime {
    val date = parseDate(dateString)
    val timeParts = timeString.split(":")
    return date.atTime(timeParts[0].toInt(), timeParts[1].toInt())
}
```

### Exemple de Repository Pattern

```kotlin
interface InterviewRepository {
    suspend fun getActorInterviews(status: InterviewStatus?): ApiResult<List<InterviewResponse>>
    suspend fun selectDate(interviewId: String, date: String, time: String?): ApiResult<InterviewResponse>
    suspend fun cancelInterview(interviewId: String): ApiResult<InterviewResponse>
}

class InterviewRepositoryImpl(
    private val apiService: InterviewApiService
) : InterviewRepository {
    
    override suspend fun getActorInterviews(status: InterviewStatus?): ApiResult<List<InterviewResponse>> {
        return safeApiCall {
            apiService.getActorInterviews(status = status?.name)
        }
    }
    
    override suspend fun selectDate(interviewId: String, date: String, time: String?): ApiResult<InterviewResponse> {
        return safeApiCall {
            apiService.selectInterviewDate(
                interviewId = interviewId,
                request = SelectInterviewDateRequest(date, time)
            )
        }
    }
    
    override suspend fun cancelInterview(interviewId: String): ApiResult<InterviewResponse> {
        return safeApiCall {
            apiService.cancelInterview(interviewId)
        }
    }
}
```

---

**Date de création** : 2025-01-27  
**Version** : 1.0  
**Auteur** : Backend Team

