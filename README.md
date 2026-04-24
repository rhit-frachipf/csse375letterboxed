# csse375letterboxed
Course project for CSSE375 - Letterboxed.

## Implemented Features

- Account signup, login, and logout
- Movie search with live suggestions and recommendation cards
- Watchlist and watched movie management with ratings/reviews
- Find User flow with autocomplete
- User profiles with follow/unfollow support
- Friend activity feed
- Privacy controls for watchlist/ratings/reviews/activity visibility
- Settings page for username/password updates
- Light mode and dark mode toggle

## Test Commands

- Backend tests: `python -m unittest -q tests/test_httpserver.py`
- Frontend tests: `npm test -- --runInBand`
- Use-case driver harness: `python tests/use_case_driver.py`

## CI

GitHub Actions workflow is defined in `.github/workflows/ci.yml`.