# Database setup (PostgreSQL + Prisma)

Minimal steps to get the local DB ready.

## 1) Install PostgreSQL
Install PostgreSQL on your system:
- **Windows**: Download from [postgresql.org](https://www.postgresql.org/download/windows/)
- **macOS**: `brew install postgresql` or download installer
- **Linux**: `sudo apt-get install postgresql` (Ubuntu/Debian) or use your package manager

Start PostgreSQL service:
```bash
# Windows: Start from Services or use pg_ctl
# macOS/Linux: 
sudo service postgresql start
# or
brew services start postgresql
```

## 2) Create database
```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE bus_transport;

# Create user (optional, or use default 'postgres')
CREATE USER bususer WITH PASSWORD 'yourpassword';
GRANT ALL PRIVILEGES ON DATABASE bus_transport TO bususer;

# Exit psql
\q
```

## 3) Install dependencies
```bash
npm install
```

## 4) Configure environment
Set `DATABASE_URL` in `.env`:
```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/bus_transport"
```
Replace `postgres`, `password`, and `bus_transport` with your actual values.

## 5) Migrate + seed
```bash
npx prisma generate
npm run db:migrate
npm run db:seed
```

## 6) Inspect data (optional)
```bash
npm run db:studio
```

Models: `Admin`, `Bus`, `Stop`, `AvailabilityLog`  
Database: PostgreSQL (configured via `DATABASE_URL`)

Common ops:
```bash
# Reset database (DANGER - deletes data)
npx prisma migrate reset

# New migration after schema change
npx prisma migrate dev --name <change>
```


