# Database setup (SQLite + Prisma)

Minimal steps to get the local DB ready.

## 1) Install
```bash
npm install
```

## 2) Env
Set `DATABASE_URL` in `.env`:
```env
DATABASE_URL="file:./prisma/dev.db"
```

## 3) Migrate + seed
```bash
npx prisma generate
npm run db:migrate
npm run db:seed
```

## 4) Inspect data (optional)
```bash
npm run db:studio
```

Models: `Admin`, `Bus`, `Stop`, `AvailabilityLog`  
Data file: `prisma/dev.db`

Common ops:
```bash
# Reset database (DANGER - deletes data)
npx prisma migrate reset

# New migration after schema change
npx prisma migrate dev --name <change>
```


