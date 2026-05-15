# Software Architecture and Design Specification (SADS)

## 1. Architecture Overview
The system uses a simple 3-layer web architecture:
- Presentation Layer: Static HTML/CSS/JavaScript pages under `public/`.
- Application Layer: Flask routes in `httpserver.py`.
- Data Layer: Repository/service logic in `user_store.py` with PickleDB-backed persistence.

## 2. Main Components
- `httpserver.py`: Route handlers, session checks, request parsing, JSON responses.
- `user_store.py`: `User`, `UserRepository`, `AuthService` domain/data logic.
- `public/scripts/api.js`: Client API adapter for backend and OMDb calls.
- `public/scripts/ui.js`, `app.js`, `storage.js`, `scripts.js`: UI behavior and page workflows.

## 3. Data Model Summary
- User fields: username, password, watched, whattowatch, following, activity, privacy.
- Watched entry: rating + review structure.
- Privacy model: showWatchlist, showRatings, showReviews, showActivity flags.

## 4. Key Design Decisions
- Session-based authentication replaced global in-memory user state.
- Repository/service split improved testability and modularity.
- Frontend code split into smaller modules reduced duplication and improved maintainability.
- Characterization and regression tests used to preserve behavior during refactoring.

## 5. Design Constraints
- Course project scope prioritizes delivery of functional behavior over enterprise-scale infrastructure.
- PickleDB selected for simplicity; production database migration is a future improvement.