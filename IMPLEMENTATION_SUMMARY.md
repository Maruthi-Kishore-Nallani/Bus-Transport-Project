# Implementation Summary

Overview of the Bus Transport Project architecture and components.

---

## 🏗️ Architecture Overview

The Bus Transport Project is a full-stack web application built with:
- **Backend**: Node.js + Express.js
- **Database**: PostgreSQL with Prisma ORM
- **Frontend**: Vanilla HTML, CSS, and JavaScript
- **Authentication**: JWT (JSON Web Tokens)
- **Maps**: Google Maps API for geocoding and location services

---

## 📁 Project Structure

```
Bus-Transport-Project/
├── server.js                    # Main Express server
├── package.json                 # Dependencies and scripts
├── .env                         # Environment variables (not in git)
├── env.example                  # Environment variables template
├── settings.json                # Application settings (editable via admin)
│
├── prisma/
│   ├── schema.prisma           # Database schema definition
│   ├── seed.js                 # Database seeding script
│   ├── migrations/             # Database migration files
│   └── dev.db                  # SQLite dev database (if used)
│
└── public/                      # Static files served by Express
    ├── page.html               # User interface (bus availability checker)
    ├── admin.html              # Admin login page
    ├── admin-dashboard.html    # Admin dashboard (after login)
    ├── admin-signup.html       # Admin signup request page
    ├── script.js               # Client-side JavaScript
    └── styles.css              # Shared stylesheet
```

---

## 🎨 Frontend Components

### User Interface (`page.html`)
- **Purpose**: Public-facing bus availability checker
- **Features**:
  - Location input (address or coordinates)
  - Google Maps integration for location selection
  - Real-time bus availability checking
  - Display of nearby bus stops and routes
  - Responsive design

### Admin Login (`admin.html`)
- **Purpose**: Admin authentication
- **Features**:
  - Email and password login
  - JWT token storage in localStorage
  - Redirect to dashboard on success

### Admin Dashboard (`admin-dashboard.html`)
- **Purpose**: Admin management interface
- **Features**:
  - View availability logs
  - Manage application settings
  - Approve/reject admin signup requests (superadmin only)
  - View system statistics
  - Protected routes (requires authentication)

### Admin Signup (`admin-signup.html`)
- **Purpose**: Request admin access
- **Features**:
  - Submit admin signup request
  - Stores request in `pending_admins.json`
  - Requires superadmin approval

### Shared Resources
- **`script.js`**: Client-side JavaScript for API calls and UI interactions
- **`styles.css`**: Shared stylesheet for consistent design

---

## ⚙️ Backend Components

### Server (`server.js`)
Express.js server providing RESTful API endpoints:

#### Public Endpoints
- `POST /api/check-availability` - Check bus availability at a location
- `GET /api/routes` - Get all bus routes
- `GET /api/settings` - Get application settings

#### Admin Endpoints (Protected)
- `POST /api/admin/login` - Admin authentication
- `GET /api/admin/me` - Get current admin info
- `GET /api/admin/logs` - Get availability logs
- `PUT /api/admin/settings` - Update application settings

#### Admin Approval Endpoints
- `POST /api/admin/signup-request` - Submit admin signup request
- `GET /api/admin/requests` - Get pending requests (superadmin only)
- `POST /api/admin/requests/:email/approve` - Approve request (superadmin only)
- `POST /api/admin/requests/:email/reject` - Reject request (superadmin only)

### Security Features
- JWT-based authentication
- Password hashing with bcryptjs
- Rate limiting on API endpoints
- Input validation and sanitization
- CORS configuration
- Security headers (Helmet)

---

## 🗄️ Database Schema

### Models (Prisma)

#### Admin
- `id`: Unique identifier
- `email`: Admin email (unique)
- `passwordHash`: Hashed password
- `isSuperAdmin`: Boolean flag for superadmin privileges
- `createdAt`: Timestamp

#### Bus
- `id`: Unique identifier
- `name`: Bus name/identifier
- `route`: Route information
- `capacity`: Maximum capacity
- Additional bus-specific fields

#### Stop
- `id`: Unique identifier
- `name`: Stop name
- `latitude`: GPS latitude
- `longitude`: GPS longitude
- Additional stop-specific fields

#### AvailabilityLog
- `id`: Unique identifier
- `timestamp`: When the check was made
- `latitude`: Check location latitude
- `longitude`: Check location longitude
- `results`: JSON data with availability results
- Additional logging fields

### Database Operations
- **ORM**: Prisma Client
- **Migrations**: Prisma Migrate
- **Seeding**: Custom seed script (`prisma/seed.js`)

---

## 🔐 Authentication & Authorization

### Authentication Flow
1. Admin submits credentials via `POST /api/admin/login`
2. Server validates credentials against database
3. Server generates JWT token
4. Client stores token in localStorage
5. Subsequent requests include token in Authorization header

### Authorization Levels
- **Public**: No authentication required
- **Admin**: Requires valid JWT token
- **Superadmin**: Requires JWT token + `isSuperAdmin: true`

### Password Security
- Passwords are hashed using bcryptjs
- Never stored in plain text
- Salt rounds: 10 (configurable)

---

## ⚙️ Configuration

### Environment Variables (`.env`)
- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Environment (development/production)
- `ADMIN_JWT_SECRET`: Secret for JWT signing
- `DATABASE_URL`: PostgreSQL connection string
- `GOOGLE_MAPS_API_KEY`: Google Maps API key
- `MAIN_ADMIN_EMAIL`: Superadmin email
- `MAIN_ADMIN_PASSWORD`: Superadmin password
- `SEARCH_RADIUS_KM`: Search radius for availability checks
- `ALLOWED_ORIGINS`: CORS allowed origins (production)

### Application Settings (`settings.json`)
- Editable via admin dashboard
- Contains application-wide settings
- Persisted to file system
- Examples: search radius, default values, etc.

---

## 🔄 Data Flow

### Bus Availability Check Flow
1. User enters location in `page.html`
2. Client sends `POST /api/check-availability` with coordinates
3. Server geocodes location (if needed)
4. Server queries database for nearby stops
5. Server calculates distances using geolib
6. Server logs the check to `AvailabilityLog`
7. Server returns results to client
8. Client displays results on map

### Admin Approval Flow
1. New admin submits request via `admin-signup.html`
2. Request stored in `pending_admins.json`
3. Superadmin views requests in dashboard
4. Superadmin approves/rejects request
5. If approved, admin account created in database
6. Request removed from `pending_admins.json`

---

## 🚀 Deployment

### Production Environment
- **Platform**: Railway (https://bus-transport-project-production.up.railway.app/)
- **Database**: PostgreSQL (hosted)
- **Environment**: Production mode with security features enabled

### Production Features
- Environment variable validation
- Security headers (Helmet)
- Rate limiting
- CORS restrictions
- Error logging
- Process management

See [PRODUCTION.md](./PRODUCTION.md) for detailed deployment guide.

---

## 📝 Key Features

### User Features
- ✅ Check bus availability by location
- ✅ View nearby bus stops
- ✅ See available routes
- ✅ Interactive map interface

### Admin Features
- ✅ View availability logs
- ✅ Manage application settings
- ✅ Approve/reject admin requests (superadmin)
- ✅ View system statistics

### Technical Features
- ✅ RESTful API design
- ✅ JWT authentication
- ✅ Database migrations
- ✅ Error handling
- ✅ Input validation
- ✅ Rate limiting
- ✅ CORS support
- ✅ Security headers

---

## 🔧 Development Workflow

1. **Setup**: Follow [README.md](./README.md) for initial setup
2. **Database**: Follow [DATABASE_SETUP.md](./DATABASE_SETUP.md) for database setup
3. **Development**: Run `npm run dev` for development server
4. **Testing**: Test endpoints using browser or API client
5. **Deployment**: Follow [PRODUCTION.md](./PRODUCTION.md) for production deployment

---

## 📚 Dependencies

### Production Dependencies
- `express`: Web framework
- `@prisma/client`: Prisma ORM client
- `bcryptjs`: Password hashing
- `jsonwebtoken`: JWT authentication
- `cors`: CORS middleware
- `dotenv`: Environment variable management
- `geolib`: Geographic calculations
- `helmet`: Security headers
- `express-rate-limit`: Rate limiting
- `express-validator`: Input validation

### Development Dependencies
- `nodemon`: Auto-reload development server
- `prisma`: Prisma CLI

---

## 🐛 Known Limitations

- Admin signup requests stored in JSON file (not database)
- Settings stored in JSON file (not database)
- No user registration (only admin accounts)
- No email notifications for admin approvals
- No real-time updates (polling required)

---

## 🔮 Future Enhancements

Potential improvements:
- Move admin requests to database
- Move settings to database
- Add user registration
- Add email notifications
- Implement WebSocket for real-time updates
- Add unit and integration tests
- Add API documentation (Swagger/OpenAPI)
- Add mobile app support
- Add bus tracking in real-time
- Add booking/reservation system

---

## 📖 Additional Documentation

- **[README.md](./README.md)** - Complete setup and usage guide
- **[DATABASE_SETUP.md](./DATABASE_SETUP.md)** - Database setup instructions
- **[PRODUCTION.md](./PRODUCTION.md)** - Production deployment guide

