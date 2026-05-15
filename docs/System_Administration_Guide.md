# System Administration Guide

## 1. Runtime Operation
- Start service with `python httpserver.py`.
- Default app serves static files from `public/`.

## 2. Environment and Secrets
- Set `LETTERBOXED_SECRET` in deployment environment.
- Do not use development default secret in production.

## 3. Data Management
- Persistent user data is stored in `users.db`.
- Back up `users.db` before updates or deployment changes.

## 4. Basic Monitoring
- Monitor server startup and request errors in console logs.
- Run automated tests before deployment.

## 5. Recovery
- If data file corruption occurs, restore from latest backup.
- Re-run test suite after recovery.