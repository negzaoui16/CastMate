# ⚙️ CastMate — Backend API & DLT Gateway

[![NestJS](https://img.shields.io/badge/NestJS-11.x-E0234E?logo=nestjs&logoColor=white)](https://nestjs.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![MongoDB](https://img.shields.io/badge/MongoDB-Cluster-47A248?logo=mongodb&logoColor=white)](https://www.mongodb.com)
[![Hedera](https://img.shields.io/badge/Hedera-Hashgraph-222222?logo=hedera&logoColor=white)](https://hedera.com)
[![Google Gemini](https://img.shields.io/badge/Gemini%20AI-1.5%20Flash-8E75B2?logo=google&logoColor=white)](https://ai.google.dev/)
[![JWT](https://img.shields.io/badge/Auth-JWT%20RBAC-black?logo=jsonwebtokens)](https://jwt.io)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)

> **CastMate Backend** is the scalable core API gateway for the CastMate casting platform. Built with **NestJS 11** and **TypeScript**, it handles multi-role authentication (`ACTEUR`, `AGENCE`, `ADMIN`), casting lifecycle management, audition scheduling, **Google Gemini 1.5 Flash AI audition evaluation**, and **Hedera Hashgraph Distributed Ledger (DLT)** for verifiable digital casting agreements and certifications.

---

## 🧭 Multi-Branch Architecture

This repository is organized into dedicated branches for clear separation of concerns:

| Branch | Component | Description |
| :--- | :--- | :--- |
| [**`main`**](https://github.com/negzaoui16/CastMate) | **Global Architecture** | System overview, end-to-end Mermaid blueprints, Hedera blockchain & AI pipeline |
| [**`frontend`**](https://github.com/negzaoui16/CastMate/tree/frontend) | **Android Native Client** | Pure Kotlin & Jetpack Compose mobile application with Gemini coaching |
| [**`backend`**](https://github.com/negzaoui16/CastMate/tree/backend) *(this branch)* | **NestJS API Gateway** | Scalable NestJS backend, MongoDB, Hedera DLT contracts & media pipeline |

---

## 🏛️ Modular System Architecture

CastMate Backend follows NestJS modular architecture principles, dividing domains into cohesive, decoupled services:

```mermaid
flowchart TD
    subgraph Client ["📱 Mobile Client (Android Kotlin)"]
        MobileApp["CastMate Mobile App<br/>(Retrofit 2 • JWT)"]
    end

    subgraph Gateway ["🛡️ NestJS API Gateway"]
        AuthMod["Auth Module<br/>(JWT Guards • RBAC)"]
        ActeurMod["Acteur Module<br/>(Profiles • Physical Specs)"]
        AgenceMod["Agence Module<br/>(Company Verification)"]
        CastingMod["Casting Module<br/>(Offers • Applications)"]
        InterviewMod["Interview Module<br/>(Audition Agenda)"]
        TrainingMod["Training Module<br/>(Gemini Video Gateway)"]
        MediaMod["Media Module<br/>(Multer Video/Photo Storage)"]
    end

    subgraph Persistence ["💾 Data Storage"]
        MongoDB[("MongoDB Database<br/>(Mongoose Schemas)")]
    end

    subgraph ExternalServices ["☁️ External Services & Blockchain"]
        GeminiAPI["Google Gemini 1.5 Flash<br/>(Multimodal Video Analysis)"]
        HederaDLT["Hedera Hashgraph<br/>(Consensus & Token Service)"]
    end

    %% Routing
    MobileApp -->|"REST Requests (Bearer Token)"| AuthMod
    AuthMod --> ActeurMod
    AuthMod --> AgenceMod
    AuthMod --> CastingMod
    AuthMod --> InterviewMod
    AuthMod --> TrainingMod
    AuthMod --> MediaMod

    %% Persistence
    ActeurMod --> MongoDB
    AgenceMod --> MongoDB
    CastingMod --> MongoDB
    InterviewMod --> MongoDB

    %% External
    TrainingMod -->|"API Calls"| GeminiAPI
    CastingMod -->|"Smart Verification"| HederaDLT
    ActeurMod -->|"Verifiable Certs"| HederaDLT
```

---

## 📦 Core Modules Breakdown

| Module | Responsibilities | Key Endpoints / Services |
| :--- | :--- | :--- |
| **`auth`** | Multi-role registration & login, password hashing with bcrypt, JWT token generation & verification | `/auth/login`, `/auth/register-actor`, `/auth/register-agency`, `JwtAuthGuard`, `RolesGuard` |
| **`acteur`** | Actor profile CRUD, physical specs (height, eye color, hair), portfolio photos, showreel links | `/acteur/profile`, `/acteur/update`, `/acteur/search` |
| **`agence`** | Casting agency onboarding, business verification, agency dashboard stats | `/agence/profile`, `/agence/verify` |
| **`castings`** | Publishing casting calls, role requirements, actor applications, status workflows | `/castings/create`, `/castings/apply`, `/castings/filter` |
| **`interviews`** | Scheduling audition slots, calendar synchronisation, confirmation notifications | `/interviews/schedule`, `/interviews/my-auditions` |
| **`training`** | Gateway for Google Gemini AI audition performance analysis & feedback generation | `/training/evaluate-video`, `GeminiService` |
| **`media`** | Multipart upload handling for audition videos, actor headshots, and casting assets | `/media/upload-video`, `/media/upload-photo` |
| **`common`** | Shared utilities, Hedera Hashgraph DLT SDK client, global exception filters | `HederaService`, `HttpExceptionFilter` |

---

## ⛓️ Hedera Hashgraph DLT Integration

CastMate leverages **Hedera Hashgraph (Testnet)** to establish trust between independent actors and casting agencies:
* **Verifiable Casting Agreements**: Once an actor is selected, a cryptographic record of the agreement is committed to the Hedera network, creating a tamper-proof timestamp and contract hash.
* **Actor Experience Credentials**: Verified audition completions and role credits can be minted as cryptographic credentials, allowing actors to build a portable, decentralized talent portfolio.

---

## 🛠️ Technology Stack

* **Framework**: NestJS 11.x
* **Language**: TypeScript 5.x
* **Database**: MongoDB with Mongoose ODM
* **DLT / Blockchain**: Hedera Hashgraph JavaScript SDK (`@hashgraph/sdk`)
* **AI Provider**: Google Generative AI (Gemini 1.5 Flash API)
* **Authentication**: Passport.js, `@nestjs/jwt`, `bcrypt`
* **File Uploads**: Multer, stream handling
* **Code Quality**: ESLint, Prettier, Jest

---

## 🚀 Getting Started

### Prerequisites
* **Node.js**: `v20.x` or higher
* **npm**: `v10.x` or higher
* **MongoDB**: Local MongoDB instance or MongoDB Atlas cluster

### Installation & Run
1. **Clone the repository and checkout the backend branch:**
   ```bash
   git clone -b backend https://github.com/negzaoui16/CastMate.git
   cd CastMate
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   ```bash
   cp .env.example .env
   ```
   Open `.env` and fill in your MongoDB URI, JWT Secret, and Hedera credentials:
   ```env
   PORT=3000
   JWT_SECRET=your_jwt_secret_key
   MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/castmate
   HEDERA_NETWORK=testnet
   HEDERA_ACCOUNT_ID=0.0.1234567
   HEDERA_PRIVATE_KEY=0x0000000000000000000000000000000000000000000000000000000000000000
   ```

4. **Start the development server:**
   ```bash
   npm run start:dev
   ```
   The backend API will start on `http://localhost:3000`.

---

## 👤 Author

**Oussama Negzaoui**
* 🎓 Software Engineering Student at **ESPRIT** (Option Mobile, Class of 2027)
* 🎓 Bachelor's Degree in Computer Science from **ISAMM** (Class of 2024)
* 💼 GitHub: [@negzaoui16](https://github.com/negzaoui16)
* 🌐 LinkedIn: [linkedin.com/in/oussamanegzaoui](https://www.linkedin.com/in/oussamanegzaoui/)

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.
