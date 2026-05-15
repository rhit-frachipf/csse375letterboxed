# Ethics and Error Handling (Objective 1)

## 1. Ethics Review

### IEEE Standard Alignment (3 items)
- Protect public welfare and user trust:
  - Privacy controls were implemented so users can control visibility of watchlist, ratings, reviews, and activity.
- Be honest and realistic about claims and limitations:
  - Deferred items are documented (security hardening and database scalability upgrades).
- Improve technical competence and quality:
  - The team used automated tests and CI to validate behavior before delivery.

### AI Use Concern and Handling
Concern: AI-generated code can introduce incorrect logic or hidden defects if accepted blindly.
Handling: AI output was reviewed, refactored, and validated with backend/frontend tests before acceptance.

## 2. Error Handling

### Scope
- Unauthenticated access (401 responses)
- Missing or invalid request inputs (400 responses)
- Not-found resources (404 responses)
- Controlled boolean response fallback for mutation endpoints

### Example Snippet (from `httpserver.py`)
```python
@app.route('/get-user-profile')
def get_user_profile():
    viewer = current_user()
    if not viewer:
        return flask.jsonify({"found": False}), 401

    username = (flask.request.args.get("username") or "").strip()
    if not username:
        return flask.jsonify({"found": False}), 400

    user = user_repository.find_by_username(username)
    profile = user_public_profile(user, viewer)
    if not profile:
        return flask.jsonify({"found": False}), 404
```

### User Testing Notes
- Users attempted protected actions while logged out and confirmed the system rejected requests without crashing.
- Users tested empty inputs in profile lookup and confirmed controlled error responses.