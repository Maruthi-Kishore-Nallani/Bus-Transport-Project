# Running Database Migration on Railway

This guide explains how to run the Prisma migration on Railway to add the `isSuperAdmin` field to the Admin table.

## Method 1: Using Railway CLI (Recommended)

### Step 1: Install Railway CLI

**Windows (PowerShell):**
```powershell
iwr https://railway.app/install.ps1 | iex
```

**macOS/Linux:**
```bash
curl -fsSL https://railway.app/install.sh | sh
```

### Step 2: Login to Railway
```bash
railway login
```

### Step 3: Link to Your Project
```bash
railway link
```
Select your Bus Transport project when prompted.

### Step 4: Run the Migration
```bash
railway run npx prisma migrate deploy
```

Or if you want to create a new migration:
```bash
railway run npx prisma migrate dev --name add_is_super_admin_field
```

---

## Method 2: Using Railway Dashboard (Web Interface)

### Step 1: Go to Railway Dashboard
1. Open [railway.app](https://railway.app)
2. Select your Bus Transport project
3. Click on your service (the one running your Node.js app)

### Step 2: Open the Service Shell
1. Click on the "Deployments" tab
2. Find your latest deployment
3. Click on the three dots (⋯) menu
4. Select "Open Shell" or "View Logs"

### Step 3: Run Migration Command
In the shell/terminal, run:
```bash
npx prisma migrate deploy
```

Or to create a new migration:
```bash
npx prisma migrate dev --name add_is_super_admin_field
```

---

## Method 3: Using Railway's Deploy Command

### Step 1: Add Migration to Build Command
In your Railway project settings, you can add the migration to run automatically on deploy:

1. Go to your service settings
2. Add to "Deploy Command":
   ```bash
   npx prisma migrate deploy && npm start
   ```

This will run migrations automatically every time you deploy.

---

## Method 4: Manual SQL Execution (If above methods don't work)

If you have direct database access, you can run the SQL manually:

1. Go to Railway Dashboard → Your Database Service
2. Click on "Connect" or "Query" tab
3. Run this SQL:

```sql
ALTER TABLE "Admin" ADD COLUMN "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false;
```

---

## Verify Migration

After running the migration, verify it worked:

1. Connect to your database (via Railway dashboard or CLI)
2. Check the Admin table structure:
   ```sql
   \d "Admin"
   ```
   Or in Railway's database query interface:
   ```sql
   SELECT column_name, data_type, column_default 
   FROM information_schema.columns 
   WHERE table_name = 'Admin';
   ```

You should see the `isSuperAdmin` column with type `boolean` and default `false`.

---

## Troubleshooting

### Error: "Migration already applied"
If you get this error, the migration might already be applied. Check your database schema.

### Error: "Can't reach database server"
- Make sure your Railway database service is running
- Check that your service is linked to the correct database
- Verify environment variables are set correctly

### Error: "Migration file not found"
Make sure you've committed and pushed your migration files to GitHub, and Railway has pulled the latest code.

---

## After Migration

Once the migration is complete:

1. **Regenerate Prisma Client** (if needed):
   ```bash
   railway run npx prisma generate
   ```

2. **Restart your service** on Railway to ensure the new schema is loaded

3. **Test the feature**:
   - Try submitting an admin signup request
   - Login as superadmin
   - Approve the request
   - Verify the new admin can login

---

## Notes

- `prisma migrate deploy` is for production - it applies pending migrations without creating new ones
- `prisma migrate dev` is for development - it creates new migrations and applies them
- Always backup your database before running migrations in production

