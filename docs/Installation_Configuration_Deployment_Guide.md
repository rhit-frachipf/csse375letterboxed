# Installation, Configuration, and Deployment Guide

## 1. Prerequisites
- Python 3.11+
- Node.js 20+ and npm (for frontend tests)

## 2. Setup
1. Clone the repository.
2. Install Python dependencies:
   - `pip install flask pickledb`
3. Install JavaScript dependencies:
   - `npm ci`

## 3. Run the System
- Start server:
  - `python httpserver.py`
- Open browser to:
  - `http://localhost:5000`

## 4. Configuration
- Environment variable for Flask secret:
  - `LETTERBOXED_SECRET` (optional; defaults to development value)
- Data file:
  - `users.db` in project root.

## 5. Run Tests
- Backend:
  - `python -m unittest -q tests/test_httpserver.py`
- Frontend:
  - `npm test -- --runInBand`

## 6. CI
GitHub Actions workflow in `.github/workflows/ci.yml` runs backend and frontend tests on push and pull requests.