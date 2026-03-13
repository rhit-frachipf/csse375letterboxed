import unittest

import httpserver


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
                "watched": {"Inception": "5"},
                "whattowatch": ["Dune"],
            }
        ]
        self.fake_db = FakeDB({self.users_list_key: [dict(self.seed_users[0])]})

        httpserver.db = self.fake_db
        httpserver.app.config["TESTING"] = True
        httpserver.app.username = ""
        httpserver.app.password = ""
        httpserver.app.watched = {}
        httpserver.app.watchlist = []
        httpserver.app.loggedin = False

        self.client = httpserver.app.test_client()

    def test_login_endpoint_success_sets_user_state(self):
        response = self.client.post(
            "/API/LOGIN",
            data={"username": "alice", "password": "pass123", "loggedin": "False"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), True)
        self.assertTrue(httpserver.app.loggedin)
        self.assertEqual(httpserver.app.watched, {"Inception": "5"})
        self.assertEqual(httpserver.app.watchlist, ["Dune"])

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

    def test_add_to_watchlist_toggles_movie_for_current_user(self):
        httpserver.app.username = "alice"

        httpserver.addToWatchList("Interstellar")
        self.assertIn("Interstellar", httpserver.db.get(self.users_list_key)[0]["whattowatch"])

        httpserver.addToWatchList("Interstellar")
        self.assertNotIn("Interstellar", httpserver.db.get(self.users_list_key)[0]["whattowatch"])

    def test_add_to_watched_updates_movie_rating(self):
        httpserver.app.username = "alice"

        httpserver.addToWatched("Arrival", "4")

        watched = httpserver.db.get(self.users_list_key)[0]["watched"]
        self.assertEqual(watched["Arrival"], "4")


if __name__ == "__main__":
    unittest.main()
