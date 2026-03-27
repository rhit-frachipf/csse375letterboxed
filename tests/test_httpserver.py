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


if __name__ == "__main__":
    unittest.main()
