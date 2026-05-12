import flask
import os
import pickledb
from user_store import AuthService, UserRepository


class PickleDBAdapter:
    def __init__(self, database):
        self.database = database

    def get(self, key):
        return self.database.get(key)

    def set(self, key, value):
        self.database.set(key, value)
        self.database.save()
        return True


def load_database(path):
    if hasattr(pickledb, "load"):
        return pickledb.load(path, auto_dump=True)

    database = pickledb.PickleDB(path)
    database.load()
    return PickleDBAdapter(database)

app = flask.Flask(__name__,             # ie "http_server_starter"
            static_url_path='', 	    # Treat all files as static files.
            static_folder='public')	    # Look in the public folder.
app.secret_key = os.environ.get("LETTERBOXED_SECRET", "letterboxed-dev-secret")

db = load_database("users.db")
user_repository = UserRepository(db)
auth_service = AuthService(user_repository)


def bool_response(value, status=200):
    return flask.jsonify(bool(value)), status


def to_bool(raw_value):
    return str(raw_value).strip().lower() in {"1", "true", "yes", "on"}


def current_user():
    username = flask.session.get("username")
    if not username:
        return None
    return user_repository.find_by_username(username)


def user_public_profile(user, viewer=None):
    if not user:
        return None

    is_self = bool(viewer and viewer.username == user.username)
    privacy = user_repository.get_privacy_settings(user.username)

    watchlist = list(user.whattowatch)
    watched_payload = dict(user.watched)

    if not is_self:
        if not privacy.get("showWatchlist", True):
            watchlist = []

        show_ratings = privacy.get("showRatings", True)
        show_reviews = privacy.get("showReviews", True)
        filtered_watched = {}
        for title, watched_value in watched_payload.items():
            has_review_object = watched_value and isinstance(watched_value, dict)
            rating = str(watched_value.get("rating", "")).strip() if has_review_object else str(watched_value or "").strip()
            review = str(watched_value.get("review", "")).strip() if has_review_object else ""

            if show_ratings and show_reviews:
                filtered_watched[title] = {
                    "rating": rating,
                    "review": review,
                }
            elif show_ratings:
                filtered_watched[title] = rating
            elif show_reviews and review:
                filtered_watched[title] = {"review": review}

        watched_payload = filtered_watched

    return {
        "username": user.username,
        "watchlist": watchlist,
        "watched": watched_payload,
        "privacy": privacy,
    }


def addToWatchList(movie):
    user = current_user()
    if not user:
        return False

    was_in_watchlist = movie in user.whattowatch
    was_successful = user_repository.toggle_watchlist_movie(user.username, movie)
    if was_successful:
        user_repository.add_activity(user.username, {
            "type": "watchlist_removed" if was_in_watchlist else "watchlist_added",
            "movie": movie,
        })
    return was_successful


def addToWatched(movie, rating, review=""):
    user = current_user()
    if not user:
        return False

    was_successful = user_repository.set_movie_rating(user.username, movie, rating, review)
    if was_successful:
        user_repository.add_activity(user.username, {
            "type": "rated_movie",
            "movie": movie,
            "rating": str(rating),
            "review": review or "",
        })
    return was_successful

@app.route("/")
def home():
    return flask.send_from_directory(app.static_folder, "signin.html")

@app.route('/get-watched')
def get_watched():
    user = current_user()
    return flask.jsonify(user.watched if user else {})

@app.route('/get-watchlist')
def get_watchlist():
    user = current_user()
    return flask.jsonify(user.whattowatch if user else [])


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

    return flask.jsonify({
        "found": True,
        "profile": profile,
        "isFollowing": user_repository.is_following(viewer.username, user.username),
        "isSelf": viewer.username == user.username,
        "visibility": profile.get("privacy", {}),
    })


@app.route('/get-user-suggestions')
def get_user_suggestions():
    user = current_user()
    if not user:
        return flask.jsonify([]), 401

    query = (flask.request.args.get("query") or "").strip()
    if not query:
        return flask.jsonify([])

    suggestions = user_repository.search_usernames(
        query,
        limit=8,
        exclude_username=user.username,
    )
    return flask.jsonify(suggestions)


@app.post('/follow-user')
def follow_user():
    user = current_user()
    if not user:
        return bool_response(False, 401)

    target_username = (flask.request.form.get("username") or "").strip()
    return bool_response(user_repository.follow_user(user.username, target_username))


@app.post('/unfollow-user')
def unfollow_user():
    user = current_user()
    if not user:
        return bool_response(False, 401)

    target_username = (flask.request.form.get("username") or "").strip()
    return bool_response(user_repository.unfollow_user(user.username, target_username))


@app.route('/get-following')
def get_following():
    user = current_user()
    if not user:
        return flask.jsonify([]), 401
    return flask.jsonify(user_repository.list_following(user.username))


@app.route('/get-activity-feed')
def get_activity_feed():
    user = current_user()
    if not user:
        return flask.jsonify([]), 401

    raw_limit = flask.request.args.get("limit")
    try:
        limit = int(raw_limit) if raw_limit else 25
    except ValueError:
        limit = 25
    limit = max(1, min(limit, 100))

    return flask.jsonify(user_repository.get_activity_feed(user.username, limit=limit))


@app.route('/get-settings')
def get_settings():
    user = current_user()
    if not user:
        return flask.jsonify({}), 401

    return flask.jsonify({
        "username": user.username,
        "privacy": user_repository.get_privacy_settings(user.username),
    })


@app.post('/update-privacy-settings')
def update_privacy_settings():
    user = current_user()
    if not user:
        return bool_response(False, 401)

    post_data = flask.request.form
    privacy_settings = {
        "showWatchlist": to_bool(post_data.get("showWatchlist", "true")),
        "showRatings": to_bool(post_data.get("showRatings", "true")),
        "showReviews": to_bool(post_data.get("showReviews", "true")),
        "showActivity": to_bool(post_data.get("showActivity", "true")),
    }
    return bool_response(user_repository.update_privacy_settings(user.username, privacy_settings))


@app.post('/update-password')
def update_password():
    user = current_user()
    if not user:
        return bool_response(False, 401)

    post_data = flask.request.form
    current_password = post_data.get("currentPassword")
    new_password = post_data.get("newPassword")
    return bool_response(user_repository.update_password(user.username, current_password, new_password))


@app.post('/update-username')
def update_username():
    user = current_user()
    if not user:
        return bool_response(False, 401)

    post_data = flask.request.form
    new_username = (post_data.get("newUsername") or "").strip()
    current_password = post_data.get("currentPassword")
    renamed_user = user_repository.rename_user(user.username, new_username, current_password)
    if not renamed_user:
        return bool_response(False)

    flask.session["username"] = renamed_user.username
    return bool_response(True)

@app.post('/add-to-watchlist')
def add_to_watchlist():
    post_data = flask.request.form
    return bool_response(addToWatchList(post_data.get("movie")))

@app.post('/add-to-watched')
def add_to_watched():
    post_data = flask.request.form
    return bool_response(addToWatched(post_data.get("movie"), post_data.get("rating"), post_data.get("review", "")))

@app.route('/get-movie-ratings')
def get_movie_ratings():
    viewer = current_user()
    if not viewer:
        return flask.jsonify([]), 401
    
    movie_title = (flask.request.args.get("movie") or "").strip()
    if not movie_title:
        return flask.jsonify([]), 400
    
    all_users = user_repository._load_users()
    ratings = []
    
    for user in all_users:
        if user.username == viewer.username:
            continue
        
        watched_value = user.watched.get(movie_title)
        if not watched_value:
            continue
        
        privacy = user_repository.get_privacy_settings(user.username)
        show_ratings = privacy.get("showRatings", True)
        show_reviews = privacy.get("showReviews", True)

        if not show_ratings and not show_reviews:
            continue

        has_review_object = watched_value and isinstance(watched_value, dict)
        rating = str(watched_value.get("rating", "")).strip() if has_review_object else str(watched_value or "").strip()
        review = str(watched_value.get("review", "")).strip() if has_review_object else ""

        rating_entry = {"username": user.username}

        if show_ratings:
            rating_entry["rating"] = rating
        if show_reviews and review:
            rating_entry["review"] = review
            
            ratings.append(rating_entry)
    
    return flask.jsonify(ratings)

@app.post("/API/LOGIN")
def handle_login():
    post_data = flask.request.form
    user = auth_service.login(post_data.get("username"), post_data.get("password"))
    if not user:
        flask.session.pop("username", None)
        return bool_response(False)

    flask.session["username"] = user.username
    return bool_response(True)

@app.post("/API/SIGNUP")
def handle_signup():
    post_data = flask.request.form
    user = auth_service.signup(post_data.get("username"), post_data.get("password"))
    if not user:
        return bool_response(False)

    flask.session["username"] = user.username
    return bool_response(True)


@app.post("/API/LOGOUT")
def handle_logout():
    flask.session.clear()
    return bool_response(True)

@app.get("/shutdown")
def shutdown():
    print("Shutting down the server")
    os._exit(0)

# TODO - Change Port to an appropriate individual port for yourself
if __name__ == "__main__":
    app.run(host='0.0.0.0', port=10470)