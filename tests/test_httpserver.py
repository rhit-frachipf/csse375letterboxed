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
        self.assertEqual(payload["isSelf"], True)

    def test_get_user_profile_returns_not_found_for_unknown_user(self):
        self.login_as_alice()

        response = self.client.get("/get-user-profile", query_string={"username": "does-not-exist"})

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.get_json()["found"], False)

    def test_get_user_profile_requires_login(self):
        response = self.client.get("/get-user-profile", query_string={"username": "alice"})

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.get_json()["found"], False)

    def test_follow_and_unfollow_user_updates_following_list(self):
        self.fake_db.get(self.users_list_key).append({
            "username": "bob",
            "password": "pw",
            "watched": {},
            "whattowatch": [],
        })
        self.login_as_alice()

        follow_response = self.client.post("/follow-user", data={"username": "bob"})
        self.assertEqual(follow_response.status_code, 200)
        self.assertEqual(follow_response.get_json(), True)

        following_response = self.client.get("/get-following")
        self.assertEqual(following_response.status_code, 200)
        self.assertIn("bob", following_response.get_json())

        unfollow_response = self.client.post("/unfollow-user", data={"username": "bob"})
        self.assertEqual(unfollow_response.status_code, 200)
        self.assertEqual(unfollow_response.get_json(), True)

        following_response = self.client.get("/get-following")
        self.assertEqual(following_response.status_code, 200)
        self.assertNotIn("bob", following_response.get_json())

    def test_get_activity_feed_returns_followed_users_recent_activity(self):
        self.fake_db.get(self.users_list_key).append({
            "username": "bob",
            "password": "pw",
            "watched": {},
            "whattowatch": [],
        })

        self.client.post("/API/LOGIN", data={"username": "bob", "password": "pw"})
        self.client.post("/add-to-watchlist", data={"movie": "Arrival"})
        self.client.post("/add-to-watched", data={"movie": "Arrival", "rating": "4", "review": "Loved it"})

        self.login_as_alice()
        self.client.post("/follow-user", data={"username": "bob"})

        feed_response = self.client.get("/get-activity-feed")
        self.assertEqual(feed_response.status_code, 200)
        feed = feed_response.get_json()
        self.assertGreaterEqual(len(feed), 2)
        self.assertEqual(feed[0]["username"], "bob")
        self.assertIn(feed[0]["type"], ["rated_movie", "watchlist_added", "watchlist_removed"])

    def test_update_privacy_settings_hides_profile_fields_for_other_users(self):
        self.fake_db.get(self.users_list_key).append({
            "username": "bob",
            "password": "pw",
            "watched": {
                "Arrival": {
                    "rating": "4",
                    "review": "Nice film",
                }
            },
            "whattowatch": ["Dune"],
        })

        self.client.post("/API/LOGIN", data={"username": "bob", "password": "pw"})
        self.client.post("/update-privacy-settings", data={
            "showWatchlist": "false",
            "showRatings": "false",
            "showReviews": "false",
            "showActivity": "true",
        })

        self.login_as_alice()
        response = self.client.get("/get-user-profile", query_string={"username": "bob"})
        payload = response.get_json()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(payload["profile"]["watchlist"], [])
        self.assertEqual(payload["profile"]["watched"], {})

    def test_update_password_requires_correct_current_password(self):
        self.login_as_alice()

        bad_response = self.client.post("/update-password", data={
            "currentPassword": "wrong",
            "newPassword": "newpass",
        })
        self.assertEqual(bad_response.get_json(), False)

        ok_response = self.client.post("/update-password", data={
            "currentPassword": "pass123",
            "newPassword": "newpass",
        })
        self.assertEqual(ok_response.get_json(), True)

        login_response = self.client.post("/API/LOGIN", data={
            "username": "alice",
            "password": "newpass",
        })
        self.assertEqual(login_response.get_json(), True)

    def test_update_username_updates_login_identity(self):
        self.login_as_alice()

        response = self.client.post("/update-username", data={
            "newUsername": "alice2",
            "currentPassword": "pass123",
        })

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), True)

        with self.client.session_transaction() as session_state:
            self.assertEqual(session_state["username"], "alice2")

        users = httpserver.db.get(self.users_list_key)
        usernames = [user["username"] for user in users]
        self.assertIn("alice2", usernames)
        self.assertNotIn("alice", usernames)

    def test_private_activity_not_in_feed(self):
        self.fake_db.get(self.users_list_key).append({
            "username": "bob",
            "password": "pw",
            "watched": {},
            "whattowatch": [],
            "privacy": {
                "showWatchlist": True,
                "showRatings": True,
                "showReviews": True,
                "showActivity": False,
            },
        })

        self.client.post("/API/LOGIN", data={"username": "bob", "password": "pw"})
        self.client.post("/add-to-watchlist", data={"movie": "Arrival"})

        self.login_as_alice()
        self.client.post("/follow-user", data={"username": "bob"})
        feed_response = self.client.get("/get-activity-feed")

        self.assertEqual(feed_response.status_code, 200)
        self.assertEqual(feed_response.get_json(), [])

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

    def test_get_movie_ratings_returns_other_users_ratings_for_a_movie(self):
        # Verify that /get-movie-ratings returns ratings from other users
        # for a specific movie, excluding the current user's rating
        self.fake_db.get(self.users_list_key).extend([
            {
                "username": "bob",
                "password": "pw",
                "watched": {"Inception": {"rating": "4", "review": "Great!"}},
                "whattowatch": [],
                "following": [],
                "activity": [],
                "privacy": {"showRatings": True, "showReviews": True, "showWatchlist": True, "showActivity": True}
            },
            {
                "username": "charlie",
                "password": "pw",
                "watched": {"Inception": {"rating": "3", "review": "OK"}},
                "whattowatch": [],
                "following": [],
                "activity": [],
                "privacy": {"showRatings": True, "showReviews": True, "showWatchlist": True, "showActivity": True}
            }
        ])

        self.login_as_alice()
        response = self.client.get("/get-movie-ratings", query_string={"movie": "Inception"})

        self.assertEqual(response.status_code, 200)
        ratings = response.get_json()
        self.assertEqual(len(ratings), 2)
        
        usernames = [r["username"] for r in ratings]
        self.assertIn("bob", usernames)
        self.assertIn("charlie", usernames)
        self.assertNotIn("alice", usernames)  # Should not include self
        
        bob_rating = next(r for r in ratings if r["username"] == "bob")
        self.assertEqual(bob_rating["rating"], "4")
        self.assertEqual(bob_rating["review"], "Great!")

    def test_get_movie_ratings_requires_login(self):
        # Verify that /get-movie-ratings requires authentication
        response = self.client.get("/get-movie-ratings", query_string={"movie": "Inception"})

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.get_json(), [])

    def test_get_movie_ratings_returns_empty_list_for_movie_with_no_ratings(self):
        # Verify that when no other users have rated a movie, empty list is returned
        self.fake_db.get(self.users_list_key).append({
            "username": "bob",
            "password": "pw",
            "watched": {},
            "whattowatch": [],
            "following": [],
            "activity": [],
            "privacy": {"showRatings": True, "showReviews": True, "showWatchlist": True, "showActivity": True}
        })

        self.login_as_alice()
        response = self.client.get("/get-movie-ratings", query_string={"movie": "Avatar"})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), [])

    def test_get_movie_ratings_requires_movie_parameter(self):
        # Verify that /get-movie-ratings requires the movie parameter
        self.login_as_alice()
        response = self.client.get("/get-movie-ratings")

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.get_json(), [])

    def test_get_movie_ratings_includes_reviews_when_present(self):
        # Verify that reviews are included in the response
        self.fake_db.get(self.users_list_key).append({
            "username": "bob",
            "password": "pw",
            "watched": {"Inception": {"rating": "5", "review": "Amazing movie!"}},
            "whattowatch": [],
            "following": [],
            "activity": [],
            "privacy": {"showRatings": True, "showReviews": True, "showWatchlist": True, "showActivity": True}
        })

        self.login_as_alice()
        response = self.client.get("/get-movie-ratings", query_string={"movie": "Inception"})

        ratings = response.get_json()
        self.assertGreater(len(ratings), 0)
        bob_rating = next(r for r in ratings if r["username"] == "bob")
        self.assertIn("review", bob_rating)
        self.assertEqual(bob_rating["review"], "Amazing movie!")

    def test_get_movie_ratings_excludes_users_without_rating_for_movie(self):
        # Verify that users who haven't rated the movie are not included
        self.fake_db.get(self.users_list_key).extend([
            {
                "username": "bob",
                "password": "pw",
                "watched": {"Inception": {"rating": "4", "review": "Good"}},
                "whattowatch": [],
                "following": [],
                "activity": [],
                "privacy": {"showRatings": True, "showReviews": True, "showWatchlist": True, "showActivity": True}
            },
            {
                "username": "charlie",
                "password": "pw",
                "watched": {"Matrix": {"rating": "5", "review": "Great"}},
                "whattowatch": [],
                "following": [],
                "activity": [],
                "privacy": {"showRatings": True, "showReviews": True, "showWatchlist": True, "showActivity": True}
            }
        ])

        self.login_as_alice()
        response = self.client.get("/get-movie-ratings", query_string={"movie": "Inception"})

        ratings = response.get_json()
        usernames = [r["username"] for r in ratings]
        self.assertIn("bob", usernames)
        self.assertNotIn("charlie", usernames)  # Charlie didn't rate Inception


if __name__ == "__main__":
    unittest.main()
