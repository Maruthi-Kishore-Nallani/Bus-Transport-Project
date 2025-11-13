# Database Setup Guide (PostgreSQL + Prisma)

Complete guide to set up and manage the PostgreSQL database for the Bus Transport Project.

---

## 📋 Prerequisites

- PostgreSQL installed on your system
- Node.js and npm installed
- Project dependencies installed (`npm install`)

---

## 1️⃣ Install PostgreSQL

### Windows
1. Download PostgreSQL installer from [postgresql.org/download/windows/](https://www.postgresql.org/download/windows/)
2. Run the installer and follow the setup wizard
3. Remember the password you set for the `postgres` user
4. PostgreSQL will be installed as a Windows service

### macOS
```bash
# Using Homebrew (recommended)
brew install postgresql@15
brew services start postgresql@15

# OR download installer from postgresql.org/download/macosx/
```

### Linux (Ubuntu/Debian)
```bash
sudo apt-get update
sudo apt-get install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### Verify Installation
```bash
# Check PostgreSQL version
psql --version

# On Windows, you might need to add PostgreSQL to PATH
# Or use: "C:\Program Files\PostgreSQL\15\bin\psql.exe" --version
```

---

## 2️⃣ Start PostgreSQL Service

### Windows
- **Method 1**: Open Services (Win + R → `services.msc`) → Find "postgresql-x64-15" → Start
- **Method 2**: Command Prompt (as Administrator):
  ```cmd
  net start postgresql-x64-15
  ```
- **Method 3**: Using pg_ctl:
  ```cmd
  pg_ctl -D "C:\Program Files\PostgreSQL\15\data" start
  ```

### macOS
```bash
# Using Homebrew
brew services start postgresql@15

# OR using launchctl
pg_ctl -D /usr/local/var/postgres start
```

### Linux
```bash
sudo service postgresql start
# OR
sudo systemctl start postgresql
```

### Verify Service is Running
```bash
# Windows
psql -U postgres -c "SELECT version();"

# macOS/Linux
sudo -u postgres psql -c "SELECT version();"
```

---

## 3️⃣ Create Database and User

### Connect to PostgreSQL

**Windows:**
```bash
psql -U postgres
# Enter the password you set during installation
```

**macOS/Linux:**
```bash
sudo -u postgres psql
# OR
psql -U postgres
```

### Create Database

Once connected to PostgreSQL, run:

```sql
-- Create the database
CREATE DATABASE bus_transport;

-- Verify database was created
\l
```

### Create Dedicated User (Optional but Recommended)

```sql
-- Create a new user
CREATE USER bususer WITH PASSWORD 'your_secure_password_here';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE bus_transport TO bususer;

-- Grant schema privileges (PostgreSQL 15+)
\c bus_transport
GRANT ALL ON SCHEMA public TO bususer;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO bususer;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO bususer;

-- Exit psql
\q
```

**Note:** If you skip creating a dedicated user, you can use the default `postgres` user.

---

## 4️⃣ Configure Environment Variables

Create or edit your `.env` file in the project root:

```env
# Database Connection String
# Format: postgresql://USER:PASSWORD@HOST:PORT/DATABASE

# Using default postgres user:
DATABASE_URL="postgresql://postgres:your_password@localhost:5432/bus_transport"

# OR using dedicated user:
DATABASE_URL="postgresql://bususer:your_secure_password_here@localhost:5432/bus_transport"
```

**Important:**
- Replace `your_password` with your actual PostgreSQL password
- Default port is `5432` (change if you use a different port)
- Use quotes around the connection string
- On Windows, you might need to escape special characters in the password

### Test Database Connection

```bash
# Test connection using psql
psql "postgresql://postgres:your_password@localhost:5432/bus_transport"

# If connection works, you'll see the PostgreSQL prompt
# Type \q to exit
```

---

## 5️⃣ Install Project Dependencies

Make sure you're in the project directory:

```bash
npm install
```

This installs Prisma and other required packages.

---

## 6️⃣ Generate Prisma Client

```bash
npx prisma generate
```

This command:
- Reads `prisma/schema.prisma`
- Generates the Prisma Client based on your schema
- Creates TypeScript types for your database models

---

## 7️⃣ Run Database Migrations

```bash
npm run db:migrate
```

This command:
- Creates all database tables based on your Prisma schema
- Applies migrations from `prisma/migrations/`
- Creates tables: `Admin`, `Bus`, `Stop`, `AvailabilityLog`

**If you get an error:**
- Check that PostgreSQL is running
- Verify `DATABASE_URL` in `.env` is correct
- Ensure the database `bus_transport` exists
- Check that the user has proper permissions

---

## 8️⃣ Seed the Database

```bash
npm run db:seed
```

This command:
- Populates the database with initial/sample data
- Creates the superadmin account (from `MAIN_ADMIN_EMAIL` and `MAIN_ADMIN_PASSWORD` in `.env`)
- Adds sample buses, stops, and routes

**Note:** Make sure `MAIN_ADMIN_EMAIL` and `MAIN_ADMIN_PASSWORD` are set in your `.env` file before running seed.

---

## 9️⃣ Verify Database Setup

### Option 1: Using Prisma Studio (Recommended)

```bash
npm run db:studio
```

This opens a web interface at `http://localhost:5555` where you can:
- View all tables and data
- Edit records
- Add new records
- Delete records

### Option 2: Using psql

```bash
psql "postgresql://postgres:your_password@localhost:5432/bus_transport"

# List all tables
\dt

# View Admins table
SELECT * FROM "Admin";

# View Buses table
SELECT * FROM "Bus";

# View Stops table
SELECT * FROM "Stop";

# Exit
\q
```

---

## 📊 Database Models

The database contains the following models:

- **Admin**: Admin users (email, password hash, isSuperAdmin flag)
- **Bus**: Bus information (name, route, capacity, etc.)
- **Stop**: Bus stop locations (name, latitude, longitude)
- **AvailabilityLog**: Logs of availability checks (timestamp, location, results)

---

## 🔧 Common Database Operations

### Reset Database (⚠️ WARNING: Deletes all data)

```bash
npx prisma migrate reset
```

This will:
- Drop the database
- Recreate it
- Run all migrations
- Run the seed script

**Use with caution!** This deletes all your data.

### Create a New Migration

After modifying `prisma/schema.prisma`:

```bash
npx prisma migrate dev --name describe_your_changes
```

Example:
```bash
npx prisma migrate dev --name add_bus_status_field
```

### View Migration History

```bash
# List all migrations
ls prisma/migrations/

# View migration SQL
cat prisma/migrations/[migration_name]/migration.sql
```

### Update Database Schema

1. Edit `prisma/schema.prisma`
2. Generate Prisma Client: `npx prisma generate`
3. Create migration: `npx prisma migrate dev --name your_change_name`
4. The migration will be applied automatically

### Manual Database Backup

```bash
# Backup database
pg_dump -U postgres bus_transport > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore database
psql -U postgres bus_transport < backup_20240101_120000.sql
```

---

## 🐛 Troubleshooting

### Error: "database does not exist"
- Create the database: `CREATE DATABASE bus_transport;`
- Verify in `.env`: `DATABASE_URL` points to the correct database name

### Error: "password authentication failed"
- Check your PostgreSQL password in `.env`
- Reset PostgreSQL password if needed:
  ```sql
  ALTER USER postgres WITH PASSWORD 'new_password';
  ```

### Error: "connection refused"
- Verify PostgreSQL service is running
- Check if PostgreSQL is listening on port 5432:
  ```bash
  # Windows
  netstat -an | findstr 5432
  
  # macOS/Linux
  netstat -an | grep 5432
  ```

### Error: "permission denied"
- Grant proper permissions to your database user
- Or use the `postgres` superuser for development

### Error: "relation does not exist"
- Run migrations: `npm run db:migrate`
- Check if migrations were applied: `npx prisma migrate status`

### Prisma Client Out of Sync
- Regenerate Prisma Client: `npx prisma generate`
- Restart your development server

---

## 📝 Additional Resources

- [Prisma Documentation](https://www.prisma.io/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Prisma Migrate Guide](https://www.prisma.io/docs/concepts/components/prisma-migrate)

---

## ✅ Setup Checklist

- [ ] PostgreSQL installed
- [ ] PostgreSQL service running
- [ ] Database `bus_transport` created
- [ ] Database user created (or using `postgres` user)
- [ ] `.env` file configured with correct `DATABASE_URL`
- [ ] Project dependencies installed (`npm install`)
- [ ] Prisma Client generated (`npx prisma generate`)
- [ ] Migrations applied (`npm run db:migrate`)
- [ ] Database seeded (`npm run db:seed`)
- [ ] Verified data in Prisma Studio or psql


