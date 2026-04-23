import unittest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import httpserver
from user_store import AuthService, UserRepository


class FakeDB:
    def __init__(self, initial=None):
        self.data = dict(initial or {})

    def get(self, key):
        return self.data.get(key)

    def set(self, key, value):
        self.data[key] = value
        return True

    def getall(self):
        return list(self.data.keys())

    def lcreate(self, key):
        self.data[key] = []
        return True

    def ladd(self, key, value):
        self.data.setdefault(key, []).append(value)
        return True


class HttpServerTests(unittest.TestCase):
    def setUp(self):
        self.users_list_key = "usersList"
        self.seed_users = [
            {
                "username": "alice",
                "password": "pass123",
                "watched": {
                    "Inception": {
                        "rating": "5",
                        "review": "Mind-bending classic",
                    }
                },
                "whattowatch": ["Dune"],
            }
        ]
        self.fake_db = FakeDB({self.users_list_key: [dict(self.seed_users[0])]})

        httpserver.db = self.fake_db
        httpserver.user_repository = UserRepository(self.fake_db)
        httpserver.auth_service = AuthService(httpserver.user_repository)
        httpserver.app.config["TESTING"] = True

        self.client = httpserver.app.test_client()

    def login_as_alice(self):
        return self.client.post(
            "/API/LOGIN",
            data={"username": "alice", "password": "pass123"},
        )

    def test_login_endpoint_success_sets_session_user(self):
        response = self.client.post(
            "/API/LOGIN",
            data={"username": "alice", "password": "pass123"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), True)

        with self.client.session_transaction() as session_state:
            self.assertEqual(session_state["username"], "alice")

    def test_signup_creates_new_user_and_logs_in(self):
        response = self.client.post(
            "/API/SIGNUP",
            data={"username": "bob", "password": "pw"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), True)

        users = httpserver.db.get(self.users_list_key)
        added_users = [user for user in users if user["username"] == "bob"]
        self.assertEqual(len(added_users), 1)
        self.assertEqual(added_users[0]["password"], "pw")
        self.assertEqual(added_users[0]["watched"], {})
        self.assertEqual(added_users[0]["whattowatch"], [])

        with self.client.session_transaction() as session_state:
            self.assertEqual(session_state["username"], "bob")

    def test_add_to_watchlist_toggles_movie_for_current_user(self):
        self.login_as_alice()

        self.client.post("/add-to-watchlist", data={"movie": "Interstellar"})
        self.assertIn("Interstellar", httpserver.db.get(self.users_list_key)[0]["whattowatch"])

        self.client.post("/add-to-watchlist", data={"movie": "Interstellar"})
        self.assertNotIn("Interstellar", httpserver.db.get(self.users_list_key)[0]["whattowatch"])

    def test_add_to_watched_updates_movie_rating_and_review(self):
        self.login_as_alice()

        self.client.post(
            "/add-to-watched",
            data={"movie": "Arrival", "rating": "4", "review": "Slow burn done right"},
        )

        watched = httpserver.db.get(self.users_list_key)[0]["watched"]
        self.assertEqual(watched["Arrival"]["rating"], "4")
        self.assertEqual(watched["Arrival"]["review"], "Slow burn done right")

    def test_get_watched_reads_from_session_user(self):
        self.login_as_alice()

        response = self.client.get("/get-watched")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.get_json(),
            {
                "Inception": {
                    "rating": "5",
                    "review": "Mind-bending classic",
                }
            },
        )

    def test_logout_clears_the_session(self):
        self.login_as_alice()

        response = self.client.post("/API/LOGOUT")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), True)
        with self.client.session_transaction() as session_state:
            self.assertNotIn("username", session_state)

    # --- Characterization tests in anticipation of:
    #     1. Viewing other users' ratings for a movie on the movie page
    #     2. Viewing other users' watchlists and rated movies
    # These tests pin down current UserRepository behavior so refactors
    # (e.g., new endpoints, cross-user queries) don't silently break it.

    def test_find_by_username_returns_correct_user(self):
        # Pins that find_by_username returns the right user object by name,
        # which any cross-user lookup endpoint will rely on.
        user = httpserver.user_repository.find_by_username("alice")

        self.assertIsNotNone(user)
        self.assertEqual(user.username, "alice")

    def test_find_by_username_returns_none_for_unknown_user(self):
        # Pins the boundary: looking up a non-existent user returns None,
        # not an exception -- important before adding "view user" endpoints.
        user = httpserver.user_repository.find_by_username("nobody")

        self.assertIsNone(user)

    def test_load_users_returns_all_seeded_users(self):
        # Pins that _load_users reflects every user in the store.
        # Any "list all users" or "browse users" feature will depend on this.
        users = httpserver.user_repository._load_users()

        usernames = [u.username for u in users]
        self.assertIn("alice", usernames)

    def test_user_watched_dict_shape_is_rating_and_review(self):
        # Pins the exact shape of a watched entry so that a new endpoint
        # exposing watched data to other users returns a consistent structure.
        user = httpserver.user_repository.find_by_username("alice")

        inception = user.watched.get("Inception")
        self.assertIsNotNone(inception)
        self.assertIn("rating", inception)
        self.assertIn("review", inception)
        self.assertEqual(inception["rating"], "5")
        self.assertEqual(inception["review"], "Mind-bending classic")

    def test_user_whattowatch_is_a_list_of_strings(self):
        # Pins that the watchlist is a plain list of title strings,
        # so an endpoint exposing another user's watchlist returns
        # the expected type without deserialisation surprises.
        user = httpserver.user_repository.find_by_username("alice")

        self.assertIsInstance(user.whattowatch, list)
        self.assertIn("Dune", user.whattowatch)

    def test_get_watched_returns_empty_dict_when_not_logged_in(self):
        # Pins the unauthenticated case: any new cross-user endpoint should
        # NOT accidentally expose data when there is no session.
        response = self.client.get("/get-watched")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), {})

    def test_get_watchlist_returns_current_users_watchlist(self):
        # Pins the existing /get-watchlist response shape so we can safely
        # add a parallel "get another user's watchlist" endpoint later.
        self.login_as_alice()

        response = self.client.get("/get-watchlist")

        self.assertEqual(response.status_code, 200)
        self.assertIn("Dune", response.get_json())

    def test_get_watchlist_returns_empty_list_when_not_logged_in(self):
        # Symmetric boundary test to the watched case above.
        response = self.client.get("/get-watchlist")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), [])

    def test_get_user_profile_returns_profile_when_user_exists(self):
        self.login_as_alice()

        response = self.client.get("/get-user-profile", query_string={"username": "alice"})

        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(payload["found"], True)
        self.assertEqual(payload["profile"]["username"], "alice")
        self.assertIn("Dune", payload["profile"]["watchlist"])
        self.assertIn("Inception", payload["profile"]["watched"])

    def test_get_user_profile_returns_not_found_for_unknown_user(self):
        self.login_as_alice()

        response = self.client.get("/get-user-profile", query_string={"username": "does-not-exist"})

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.get_json()["found"], False)

    def test_get_user_profile_requires_login(self):
        response = self.client.get("/get-user-profile", query_string={"username": "alice"})

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.get_json()["found"], False)

    def test_get_user_suggestions_returns_matching_usernames(self):
        self.fake_db.get(self.users_list_key).extend([
            {
                "username": "bob",
                "password": "pw",
                "watched": {},
                "whattowatch": [],
            },
            {
                "username": "bobby",
                "password": "pw",
                "watched": {},
                "whattowatch": [],
            },
            {
                "username": "charlie",
                "password": "pw",
                "watched": {},
                "whattowatch": [],
            },
        ])

        self.login_as_alice()
        response = self.client.get("/get-user-suggestions", query_string={"query": "bo"})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), ["bob", "bobby"])

    def test_get_user_suggestions_requires_login(self):
        response = self.client.get("/get-user-suggestions", query_string={"query": "a"})

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.get_json(), [])

    def test_second_user_watched_is_independent_from_first(self):
        # Pins that two users' watched dicts are fully isolated from each other.
        # Adding "see other users' ratings" must not merge or cross-contaminate
        # per-user watched data.
        self.fake_db.get(self.users_list_key).append({
            "username": "bob",
            "password": "pw",
            "watched": {"Dune": {"rating": "3", "review": "Visually stunning"}},
            "whattowatch": [],
        })

        alice = httpserver.user_repository.find_by_username("alice")
        bob = httpserver.user_repository.find_by_username("bob")

        self.assertNotIn("Dune", alice.watched)
        self.assertNotIn("Inception", bob.watched)
        self.assertEqual(bob.watched["Dune"]["rating"], "3")


if __name__ == "__main__":
    unittest.main()
