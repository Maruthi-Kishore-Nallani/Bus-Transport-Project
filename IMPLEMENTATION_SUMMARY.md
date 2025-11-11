# Implementation Summary (concise)

- Client pages: `page.html` (user), `admin.html`, `admin-dashboard.html`, `admin-signup.html`, shared styles in `styles.css`, client logic in `script.js`.
- Server: `server.js` (Express API: availability, routes, settings, admin login, approvals).
- Data: SQLite via Prisma (`prisma/dev.db`); models: Admin, Bus, Stop, AvailabilityLog. Seed populates sample data.
- Settings: editable via Admin → Settings; stored in `settings.json`.
- Admin approvals: public signup stored in `pending_admins.json` until superadmin approves; approved admins saved in DB.

