# Authentication Architecture Overview

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        FASTIFY SERVER                           │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                ┌──────────┴──────────┐
                │                     │
        ┌───────▼────────┐    ┌──────▼────────┐
        │  Auth Routes   │    │ Other Routes  │
        │  /api/auth/*   │    │  /api/*       │
        └────────┬────────┘    └───────────────┘
                 │
         ┌───────▼────────────────────┐
         │  verifyJWT Middleware      │  (Protected routes only)
         │  - Validates Bearer token  │
         │  - Attaches user to req    │
         └───────┬────────────────────┘
                 │
        ┌────────▼─────────────────┐
        │  AuthController           │
        │  - signUp()               │
        │  - signIn()               │
        │  - refresh()              │
        │  - getSession()           │
        │  - logout()               │
        │  - getGoogleOAuthUrl()    │
        │  - handleOAuthCallback()  │
        └────────┬─────────────────┘
                 │
        ┌────────▼──────────────────┐
        │  auth.service.ts (Facade) │
        │  - register()             │
        │  - login()                │
        │  - changePassword()       │
        │  - updateUserMetadata()   │
        │  - getUserById()          │
        └────────┬──────────────────┘
                 │
        ┌────────▼──────────────────────────┐
        │  supabaseAuth.service.ts          │
        │  - register()                     │
        │  - login()                        │
        │  - loginWithOAuth()               │
        │  - refreshToken()                 │
        │  - verifyToken()                  │
        │  - logout()                       │
        │  - updateUserMetadata()           │
        └────────┬───────────────────────────┘
                 │
        ┌────────▼──────────────────────────┐
        │       SUPABASE                    │
        │  ┌────────────────────────────┐   │
        │  │   Auth Service             │   │
        │  │ - User Management          │   │
        │  │ - Password Hashing         │   │
        │  │ - JWT Generation           │   │
        │  │ - Session Management       │   │
        │  └────────────────────────────┘   │
        │  ┌────────────────────────────┐   │
        │  │   PostgreSQL Database      │   │
        │  │ - auth.users               │   │
        │  │ - auth.sessions            │   │
        │  │ - auth.identities          │   │
        │  └────────────────────────────┘   │
        └────────────────────────────────────┘
```

---

## Request Flow Examples

### 1. User Registration

```
POST /api/auth/register
{
  "email": "user@example.com",
  "password": "secure123",
  "firstName": "John"
}
     │
     ▼
┌─────────────────────────────┐
│ AuthController.signUp()     │
│ - Validate input            │
│ - Check required fields     │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│ auth.service.register()     │
│ - Call Supabase auth        │
│ - Map response to User      │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│ supabaseAuth.register()     │
│ - Call Supabase API         │
│ - Handle Supabase response  │
│ - Generate tokens           │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│ SUPABASE                    │
│ - Hash password             │
│ - Create user record        │
│ - Return tokens             │
└──────────┬──────────────────┘
           │
           ▼
HTTP 201 Created
{
  "message": "User created successfully",
  "user": {
    "id": "uuid",
    "email": "user@example.com"
  },
  "session": {
    "access_token": "jwt...",
    "refresh_token": "jwt..."
  }
}
```

---

### 2. Protected Request (with Authorization)

```
GET /api/auth/session
Authorization: Bearer eyJhbGc...
     │
     ▼
┌─────────────────────────────┐
│ verifyJWT Middleware        │
│ - Extract token from header │
│ - Validate Bearer format    │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│ supabaseAuth.verifyToken()  │
│ - Call Supabase to validate │
│ - Extract user info         │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│ SUPABASE                    │
│ - Verify JWT signature      │
│ - Check token expiry        │
│ - Return user data          │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│ req.user = {                │
│   id: "uuid",              │
│   email: "user@example.com" │
│ }                           │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│ AuthController.getSession() │
│ - Access req.user           │
│ - Format response           │
└──────────┬──────────────────┘
           │
           ▼
HTTP 200 OK
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "metadata": {...}
  }
}
```

---

### 3. Token Refresh

```
POST /api/auth/refresh
{
  "refreshToken": "jwt..."
}
     │
     ▼
┌─────────────────────────────┐
│ AuthController.refresh()    │
│ - Validate input            │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│ auth.service.refreshToken() │
│ - Call Supabase refresh     │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│ supabaseAuth.refreshToken() │
│ - Call Supabase API         │
│ - Extract token             │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│ SUPABASE                    │
│ - Validate refresh token    │
│ - Generate new tokens       │
└──────────┬──────────────────┘
           │
           ▼
HTTP 200 OK
{
  "message": "Token refreshed",
  "session": {
    "access_token": "new_jwt...",
    "refresh_token": "new_jwt...",
    "expires_at": 1234567890
  }
}
```

---

## Error Handling Flow

```
User Request
     │
     ▼
┌──────────────────────────────────┐
│ Is input valid?                  │
└──┬──────────────────┬────────────┘
   │ No               │ Yes
   │                  │
   ▼                  ▼
400 Bad Request   Call Service
                     │
                     ▼
              ┌────────────────────────────────┐
              │ Service throws AuthServiceError│
              │ with error code                │
              └────┬────────────────────────┬──┘
                   │                        │
              Success              AuthServiceError
                   │                        │
                   ▼                        ▼
              Return User         Controller catches error
                                           │
                                           ▼
                                  Get status code for error
                                           │
                                           ▼
                                  Return error response
                                  with status code
```

---

## Service Layer Responsibilities

### AuthController (Presentation Layer)

```
Responsibilities:
✓ Parse incoming requests
✓ Validate input format
✓ Call services
✓ Format responses
✓ Return appropriate HTTP status
```

### auth.service.ts (Facade/Adapter Layer)

```
Responsibilities:
✓ Provide domain-specific interface
✓ Delegate to Supabase service
✓ Map Supabase types to domain types
✓ Handle backward compatibility
✓ Provide database access
```

### supabaseAuth.service.ts (Integration Layer)

```
Responsibilities:
✓ Communicate with Supabase API
✓ Handle authentication
✓ Manage sessions and tokens
✓ Provide error handling
✓ Provide data transformation
```

### SUPABASE (Infrastructure Layer)

```
Responsibilities:
✓ User authentication
✓ Password hashing
✓ Token generation
✓ Session management
✓ Email verification
✓ Password recovery
✓ Database operations
```

---

## Data Flow for Token Lifecycle

```
1. User Logs In
   ↓
   supabaseAuth generates: access_token + refresh_token
   ↓
   tokens returned to client

2. Client makes request with access_token
   ↓
   middleware validates token against Supabase
   ↓
   if valid: attach user to request
   if invalid: return 401

3. After token expires
   ↓
   client sends refresh_token
   ↓
   supabaseAuth validates refresh_token against Supabase
   ↓
   new access_token + refresh_token generated
   ↓
   return new tokens to client

4. User Logs Out
   ↓
   supabaseAuth.logout() called
   ↓
   Supabase invalidates all tokens
   ↓
   future requests with old token return 401
```

---

## Error Codes Mapping to HTTP Status

```
Client Error (4xx):
├─ 400 Bad Request
│  ├─ INVALID_INPUT
│  ├─ REGISTRATION_FAILED
│  ├─ OAUTH_URL_FAILED
│  ├─ OAUTH_CALLBACK_FAILED
│  └─ UPDATE_METADATA_FAILED
│
├─ 401 Unauthorized
│  ├─ MISSING_TOKEN
│  ├─ INVALID_TOKEN
│  ├─ TOKEN_VERIFICATION_FAILED
│  ├─ LOGIN_FAILED
│  ├─ NO_USER
│  └─ REFRESH_FAILED

Server Error (5xx):
└─ 500 Internal Server Error
   └─ LOGOUT_FAILED
```

---

## Environment Setup

```
.env file required:
┌─────────────────────────────────┐
│ SUPABASE_URL                    │
│ (e.g., https://*.supabase.co)   │
│                                 │
│ SUPABASE_ANON_KEY               │
│ (e.g., eyJhbGc...)              │
│                                 │
│ OAUTH_REDIRECT_URL (Optional)   │
│ (e.g., http://localhost:3000)   │
└─────────────────────────────────┘

No longer needed:
✗ JWT_SECRET
✗ JWT_REFRESH_SECRET
✗ SALT_ROUNDS
```

---

## Key Takeaways

1. **Layered Architecture**: Clear separation of concerns
2. **Facade Pattern**: auth.service acts as adapter
3. **Single Responsibility**: Each class does one thing
4. **Error Handling**: Consistent error codes across stack
5. **Type Safety**: Full TypeScript coverage
6. **Testability**: Easy to mock at each layer
7. **Maintainability**: Less code, clearer intent
8. **Security**: Supabase best practices

---

**Last Updated**: January 8, 2026
