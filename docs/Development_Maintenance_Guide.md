# Development and Maintenance Guide

## 1. Repository Structure
- Backend entrypoint: `httpserver.py`
- Domain/data layer: `user_store.py`
- Frontend pages: `public/*.html`
- Frontend scripts: `public/scripts/*.js`
- Tests: `tests/`

## 2. Refactoring Summary (Milestones 2-4)
- Moved authentication state from Flask global fields to session-based handling.
- Introduced `UserRepository` and `AuthService` for cleaner separation.
- Split frontend logic into smaller modules (`api`, `ui`, `storage`, app flow).
- Added characterization and regression tests to preserve behavior through change.

## 3. Maintenance Tasks
- Add endpoint tests for new backend features.
- Add UI and API module tests for new frontend behavior.
- Keep CI green before merge.
- Update SRS/SADS when requirements or architecture change.

## 4. Coding and Test Practices
- Prefer small functions and reusable helpers.
- Keep route handlers thin; place business logic in repository/service layer.
- Use fake DB/document stubs in tests when isolating behavior.