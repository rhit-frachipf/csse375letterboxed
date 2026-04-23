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


def current_user():
    username = flask.session.get("username")
    if not username:
        return None
    return user_repository.find_by_username(username)


def user_public_profile(user):
    if not user:
        return None

    return {
        "username": user.username,
        "watchlist": list(user.whattowatch),
        "watched": dict(user.watched),
    }


def addToWatchList(movie):
    user = current_user()
    if not user:
        return False
    return user_repository.toggle_watchlist_movie(user.username, movie)


def addToWatched(movie, rating, review=""):
    user = current_user()
    if not user:
        return False
    return user_repository.set_movie_rating(user.username, movie, rating, review)

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
    if not current_user():
        return flask.jsonify({"found": False}), 401

    username = (flask.request.args.get("username") or "").strip()
    if not username:
        return flask.jsonify({"found": False}), 400

    user = user_repository.find_by_username(username)
    profile = user_public_profile(user)
    if not profile:
        return flask.jsonify({"found": False}), 404

    return flask.jsonify({
        "found": True,
        "profile": profile,
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

@app.post('/add-to-watchlist')
def add_to_watchlist():
    post_data = flask.request.form
    return bool_response(addToWatchList(post_data.get("movie")))

@app.post('/add-to-watched')
def add_to_watched():
    post_data = flask.request.form
    return bool_response(addToWatched(post_data.get("movie"), post_data.get("rating"), post_data.get("review", "")))


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