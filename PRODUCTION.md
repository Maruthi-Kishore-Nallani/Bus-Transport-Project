# Production Deployment Guide

This document outlines the security and production-ready features implemented in the codebase.

## Security Features

### 1. **Environment Variable Validation**
- Required environment variables are validated on startup in production mode
- Missing variables cause the application to exit with an error
- Required variables: `ADMIN_JWT_SECRET`, `DATABASE_URL`, `MAIN_ADMIN_EMAIL`, `MAIN_ADMIN_PASSWORD`

### 2. **Security Headers (Helmet)**
- Helmet middleware adds security headers to all responses
- Protects against common vulnerabilities (XSS, clickjacking, etc.)
- Content Security Policy enabled in production

### 3. **Rate Limiting**
- General API endpoints: 100 requests per 15 minutes per IP (production)
- Authentication endpoints: 5 requests per 15 minutes per IP
- Prevents brute force attacks and API abuse

### 4. **CORS Configuration**
- Configurable allowed origins via `ALLOWED_ORIGINS` environment variable
- Comma-separated list of allowed domains
- Credentials enabled for authenticated requests

### 5. **Input Validation & Sanitization**
- All user inputs are sanitized and validated
- Email format validation
- Coordinate range validation (lat: -90 to 90, lng: -180 to 180)
- String length limits and XSS prevention

### 6. **Secure Logging**
- Production logs don't expose sensitive data
- Email addresses and coordinates are sanitized in logs
- Error messages don't leak internal implementation details
- Full error stacks only shown in development mode

### 7. **Request Size Limits**
- Body parser limits set to 10MB
- Prevents DoS attacks via large payloads

### 8. **Error Handling**
- Generic error messages in production
- Detailed errors only in development
- 404 handler for unknown routes
- Global error handler catches unhandled exceptions

## Environment Variables

### Required for Production

```env
NODE_ENV=production
PORT=3000
ADMIN_JWT_SECRET=<strong-random-secret>
DATABASE_URL=<postgresql-connection-string>
MAIN_ADMIN_EMAIL=<superadmin-email>
MAIN_ADMIN_PASSWORD=<superadmin-password>
GOOGLE_MAPS_API_KEY=<your-api-key>
ALLOWED_ORIGINS=https://yourdomain.com
```

### Optional

```env
SEARCH_RADIUS_KM=1.5
GEOCODE_COUNTRY=IN
GEOCODE_REGION=in
```

## Deployment Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Generate a strong `ADMIN_JWT_SECRET` (use a secure random string)
- [ ] Configure `DATABASE_URL` with production database credentials
- [ ] Set `MAIN_ADMIN_EMAIL` and `MAIN_ADMIN_PASSWORD` for superadmin
- [ ] Configure `ALLOWED_ORIGINS` with your domain(s)
- [ ] Ensure `.env` file is not committed to version control
- [ ] Install dependencies: `npm install --production`
- [ ] Run database migrations: `npm run db:migrate`
- [ ] Seed initial data: `npm run db:seed`
- [ ] Use a process manager (PM2, systemd, etc.) for production
- [ ] Set up reverse proxy (nginx, Apache) with SSL/TLS
- [ ] Configure firewall rules
- [ ] Set up monitoring and logging
- [ ] Regular backups of database

## Security Best Practices

1. **Never commit `.env` file** - Use environment variables or secrets management
2. **Use HTTPS** - Always use SSL/TLS in production
3. **Strong Secrets** - Use cryptographically secure random strings for JWT secrets
4. **Database Security** - Use strong database passwords and restrict access
5. **Regular Updates** - Keep dependencies updated for security patches
6. **Monitoring** - Set up error tracking and monitoring (e.g., Sentry)
7. **Backups** - Regular automated backups of database

## Running in Production

```bash
# Install production dependencies only
npm install --production

# Set environment
export NODE_ENV=production

# Run migrations
npm run db:migrate

# Start server
npm start
```

## Process Manager Example (PM2)

```bash
# Install PM2
npm install -g pm2

# Start application
pm2 start server.js --name bus-transport --env production

# Save PM2 configuration
pm2 save

# Set up PM2 to start on boot
pm2 startup
```

## Nginx Reverse Proxy Example

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Monitoring

- Check application health: `GET /api/health`
- Monitor logs for errors
- Set up alerts for high error rates
- Monitor database connection pool
- Track API response times

## Troubleshooting

### Application won't start
- Check all required environment variables are set
- Verify database connection string is correct
- Check port is not already in use

### Rate limiting issues
- Adjust rate limits in `server.js` if needed
- Check if legitimate traffic is being blocked

### CORS errors
- Verify `ALLOWED_ORIGINS` includes your frontend domain
- Check CORS configuration in `server.js`

