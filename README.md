# Bus Transport App

A bus transport management system built with Node.js, Express, and Prisma. This application allows users to check bus availability and provides an admin dashboard for managing routes, buses, and admin approvals.

**Live Demo:** [https://bus-transport-project-production.up.railway.app/](https://bus-transport-project-production.up.railway.app/)  
**GitHub Repository:** [https://github.com/Maruthi-Kishore-Nallani/Bus-Transport-Project](https://github.com/Maruthi-Kishore-Nallani/Bus-Transport-Project)

---

## 📋 Prerequisites

Before you begin, ensure you have the following installed:
- **Node.js** (v16 or higher) - [Download](https://nodejs.org/)
- **PostgreSQL** (v12 or higher) - [Download](https://www.postgresql.org/download/)
- **npm** (comes with Node.js)
- **Git** - [Download](https://git-scm.com/downloads)

---

## 🚀 Quick Start Guide

### Step 1: Clone or Setup the Repository

If you're setting up on a new machine:

```bash
# Clone the repository (if you have it on GitHub)
git clone https://github.com/Maruthi-Kishore-Nallani/Bus-Transport-Project.git
cd Bus-Transport-Project

# OR if you already have the folder copied locally, navigate to it
cd path/to/your/project
```

### Step 2: Install Dependencies

```bash
npm install
```

This will install all required packages including Express, Prisma, and other dependencies.

### Step 3: Configure Environment Variables

Create a `.env` file in the root directory (copy from `env.example`):

```bash
# On Windows (PowerShell)
Copy-Item env.example .env

# On macOS/Linux
cp env.example .env
```

Edit the `.env` file with your configuration:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# JWT Secret (generate a strong random string)
ADMIN_JWT_SECRET=change-this-to-a-strong-random-secret

# Database (PostgreSQL)
# Format: postgresql://USER:PASSWORD@HOST:PORT/DATABASE
DATABASE_URL="postgresql://postgres:password@localhost:5432/bus_transport"

# Google Maps API Key (required for geocoding)
GOOGLE_MAPS_API_KEY=your-google-api-key-here
GEOCODE_COUNTRY=IN
GEOCODE_REGION=in

# Search radius for availability checks (in kilometers)
SEARCH_RADIUS_KM=1.5

# Superadmin Credentials (can approve new admins)
MAIN_ADMIN_EMAIL=you@example.com
MAIN_ADMIN_PASSWORD=strong-password

# CORS Configuration (optional for development)
# ALLOWED_ORIGINS=http://localhost:3000
```

**Important Notes:**
- Replace `password` in `DATABASE_URL` with your PostgreSQL password
- Get a Google Maps API key from [Google Cloud Console](https://console.cloud.google.com/)
- Change `MAIN_ADMIN_EMAIL` and `MAIN_ADMIN_PASSWORD` to your preferred superadmin credentials
- Generate a strong `ADMIN_JWT_SECRET` (you can use: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)

### Step 4: Setup PostgreSQL Database

#### 4.1 Install PostgreSQL

- **Windows**: Download and install from [postgresql.org](https://www.postgresql.org/download/windows/)
- **macOS**: `brew install postgresql` or download installer
- **Linux**: `sudo apt-get install postgresql` (Ubuntu/Debian)

#### 4.2 Start PostgreSQL Service

```bash
# Windows: Start from Services or use:
pg_ctl -D "C:\Program Files\PostgreSQL\15\data" start

# macOS/Linux:
sudo service postgresql start
# or
brew services start postgresql
```

#### 4.3 Create Database

```bash
# Connect to PostgreSQL
psql -U postgres

# In PostgreSQL prompt, run:
CREATE DATABASE bus_transport;

# (Optional) Create a dedicated user
CREATE USER bususer WITH PASSWORD 'yourpassword';
GRANT ALL PRIVILEGES ON DATABASE bus_transport TO bususer;

# Exit psql
\q
```

**Note:** Update your `.env` file with the correct database credentials.

### Step 5: Initialize Database

```bash
# Generate Prisma Client
npx prisma generate

# Run database migrations
npm run db:migrate

# Seed the database with initial data
npm run db:seed
```

### Step 6: Run the Application

#### Development Mode (with auto-reload):
```bash
npm run dev
```

#### Production Mode:
```bash
npm start
```

The server will start on `http://localhost:3000` (or the port specified in your `.env` file).

### Step 7: Access the Application

- **User Interface**: Open `http://localhost:3000/page.html` in your browser
- **Admin Login**: Open `http://localhost:3000/admin.html`
- **Admin Signup**: Open `http://localhost:3000/admin-signup.html` (for new admin requests)
- **Admin Dashboard**: Access after logging in through `admin.html`

---

## 📚 Available Scripts

```bash
# Development
npm run dev          # Start development server with nodemon (auto-reload)

# Production
npm start            # Start production server

# Database
npm run db:migrate   # Run database migrations
npm run db:seed      # Seed database with initial data
npm run db:studio    # Open Prisma Studio (database GUI)
```

---

## 🔑 Key API Endpoints

### Public Endpoints
- `POST /api/check-availability` - Check bus availability at a location
- `GET /api/routes` - Get all bus routes
- `GET /api/settings` - Get application settings

### Admin Endpoints (Requires Authentication)
- `POST /api/admin/login` - Admin login
- `GET /api/admin/me` - Get current admin info
- `GET /api/admin/logs` - Get availability logs
- `PUT /api/admin/settings` - Update application settings

### Admin Approval Endpoints
- `POST /api/admin/signup-request` - Request admin access
- `GET /api/admin/requests` - Get pending admin requests (superadmin only)
- `POST /api/admin/requests/:email/approve` - Approve admin request (superadmin only)
- `POST /api/admin/requests/:email/reject` - Reject admin request (superadmin only)

---

## 📁 Project Structure

```
Bus-Transport-Project/
├── prisma/
│   ├── schema.prisma      # Database schema
│   ├── seed.js            # Database seed script
│   └── migrations/        # Database migrations
├── public/
│   ├── page.html          # User interface
│   ├── admin.html         # Admin login page
│   ├── admin-dashboard.html  # Admin dashboard
│   ├── admin-signup.html  # Admin signup request page
│   ├── script.js          # Client-side JavaScript
│   └── styles.css         # Stylesheet
├── server.js              # Express server
├── package.json           # Dependencies and scripts
├── .env                   # Environment variables (create from env.example)
├── env.example            # Environment variables template
└── README.md              # This file
```

---

## 🔧 Troubleshooting

### Database Connection Issues
- Verify PostgreSQL is running: `psql -U postgres -c "SELECT version();"`
- Check `DATABASE_URL` in `.env` matches your PostgreSQL credentials
- Ensure database `bus_transport` exists

### Port Already in Use
- Change `PORT` in `.env` to a different port (e.g., 3001)
- Or stop the process using port 3000

### Prisma Errors
- Run `npx prisma generate` after schema changes
- Run `npm run db:migrate` to apply migrations
- Check Prisma schema syntax in `prisma/schema.prisma`

### Google Maps API Errors
- Verify `GOOGLE_MAPS_API_KEY` is set correctly in `.env`
- Ensure the API key has Geocoding API enabled in Google Cloud Console
- Check API key billing is enabled

---

## 📖 Additional Documentation

- **[DATABASE_SETUP.md](./DATABASE_SETUP.md)** - Detailed database setup guide
- **[PRODUCTION.md](./PRODUCTION.md)** - Production deployment guide
- **[IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)** - Implementation overview

---

## 🚢 GitHub Commands

### Initial Setup (First Time)

```bash
# Initialize git repository (if not already initialized)
git init

# Add remote repository
git remote add origin https://github.com/Maruthi-Kishore-Nallani/Bus-Transport-Project.git

# Verify remote
git remote -v
```

### Daily Workflow

```bash
# Check status of your changes
git status

# Add files to staging
git add .                    # Add all changes
git add filename.js          # Add specific file

# Commit changes
git commit -m "Your commit message describing the changes"

# Push to GitHub
git push origin main         # If your branch is 'main'
git push origin master       # If your branch is 'master'
```

### Branch Management

```bash
# Create and switch to a new branch
git checkout -b feature/your-feature-name

# Switch branches
git checkout main
git checkout feature/your-feature-name

# List all branches
git branch

# Push new branch to GitHub
git push -u origin feature/your-feature-name
```

### Common Git Commands

```bash
# Pull latest changes from GitHub
git pull origin main

# View commit history
git log

# View changes in files
git diff

# Discard local changes (CAREFUL!)
git checkout -- filename.js
git reset --hard HEAD        # Discard ALL uncommitted changes

# Update from remote
git fetch origin
git merge origin/main
```

### Pushing to GitHub (Step by Step)

1. **Check what files have changed:**
   ```bash
   git status
   ```

2. **Add files to staging:**
   ```bash
   git add .
   # Or add specific files:
   git add README.md server.js
   ```

3. **Commit with a descriptive message:**
   ```bash
   git commit -m "Update README with setup instructions and GitHub commands"
   ```

4. **Push to GitHub:**
   ```bash
   git push origin main
   ```

5. **If you get an error about upstream branch:**
   ```bash
   git push -u origin main
   ```

### Handling Merge Conflicts

If you get conflicts when pulling:

```bash
# Pull latest changes
git pull origin main

# If conflicts occur, Git will mark them in files
# Edit the files to resolve conflicts (look for <<<<<<, ======, >>>>>> markers)
# After resolving:

git add .
git commit -m "Resolve merge conflicts"
git push origin main
```

### Useful Git Aliases (Optional)

Add these to your `~/.gitconfig` for shortcuts:

```bash
git config --global alias.st status
git config --global alias.co checkout
git config --global alias.br branch
git config --global alias.cm commit
```

Then you can use: `git st`, `git co`, `git br`, `git cm`

---

## 🔒 Security Notes

- **Never commit `.env` file** - It contains sensitive information
- The `.gitignore` file already excludes `.env` and other sensitive files
- Always use strong passwords for database and admin accounts
- In production, use environment variables or secrets management

---

## 📝 Notes

- Requires a valid Google Maps API key for geocoding/reverse-geocoding
- Data is stored in PostgreSQL (configure via `DATABASE_URL` in `.env`)
- The application uses JWT for admin authentication
- New admins must be approved by the superadmin through the dashboard

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License.

---

## 👤 Author

**Maruthi Kishore Nallani**

- GitHub: [@Maruthi-Kishore-Nallani](https://github.com/Maruthi-Kishore-Nallani)
- Project Link: [https://github.com/Maruthi-Kishore-Nallani/Bus-Transport-Project](https://github.com/Maruthi-Kishore-Nallani/Bus-Transport-Project)
