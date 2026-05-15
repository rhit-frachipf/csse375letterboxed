# Software Requirements Specification (SRS)

## 1. Scope
Letterboxed is a web application for tracking movies, writing ratings/reviews, managing watchlists, and interacting with other users through profiles and follow activity.

## 2. Delivered Functional Requirements
- FR1: User signup, login, and logout.
- FR2: Search movies and show suggestions while typing.
- FR3: Add/remove movies in watchlist.
- FR4: Mark movies watched with rating and optional written review.
- FR5: View personal watchlist and watched list.
- FR6: Find users and view user profiles.
- FR7: Follow/unfollow users.
- FR8: View activity feed from followed users.
- FR9: Set privacy controls (watchlist, ratings, reviews, activity visibility).
- FR10: Update username/password in settings.
- FR11: Toggle theme preference.

## 3. Non-Functional Requirements
- NFR1: System behavior verified by automated backend and frontend tests.
- NFR2: CI executes test suites on push/pull request.
- NFR3: Session-based authentication required for protected operations.
- NFR4: Basic error handling for unauthenticated/invalid requests.

## 4. Deferred / Not Fully Delivered
- DR1: Production-grade password hashing and stronger security hardening.
- DR2: Migration from file-based storage to a transactional database.
- DR3: Horizontal scalability hardening beyond course scope.

## 5. Acceptance Summary
The delivered build satisfies the core user functionality planned in Milestones 2-4 and supports demonstration use by multiple users through session-based web workflows.