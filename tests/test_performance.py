"""
Q4 tests — technology-facing, critiquing the product.

These tests do not verify that a feature works correctly (that is Q2's job).
They probe non-functional properties: response latency, throughput under
concurrent load, and behaviour when the data store grows large.

Run with:
    pytest test_performance.py -v
"""

import statistics
import threading
import time
import unittest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import httpserver
from user_store import AuthService, UserRepository


# ---------------------------------------------------------------------------
# Shared test infrastructure
# ---------------------------------------------------------------------------

class FakeDB:
    def __init__(self, initial=None):
        self.data = dict(initial or {})

    def get(self, key):
        return self.data.get(key)

    def set(self, key, value):
        self.data[key] = value
        return True


def _make_user(username, *, watched_count=0, watchlist_count=0):
    """Return a user dict with the given number of watched/watchlist entries."""
    watched = {
        f"Movie {i}": {"rating": str((i % 5) + 1), "review": f"Review text {i}"}
        for i in range(watched_count)
    }
    whattowatch = [f"Queued Movie {i}" for i in range(watchlist_count)]
    return {
        "username": username,
        "password": "pw",
        "watched": watched,
        "whattowatch": whattowatch,
        "following": [],
        "activity": [],
        "privacy": {
            "showWatchlist": True,
            "showRatings": True,
            "showReviews": True,
            "showActivity": True,
        },
    }


class PerformanceTestBase(unittest.TestCase):
    """Mixin that wires up a fresh Flask test client before each test."""

    def setUp(self):
        self._build_db([])

    def _build_db(self, users):
        self.fake_db = FakeDB({"usersList": users})
        httpserver.db = self.fake_db
        httpserver.user_repository = UserRepository(self.fake_db)
        httpserver.auth_service = AuthService(httpserver.user_repository)
        httpserver.app.config["TESTING"] = True
        self.client = httpserver.app.test_client()

    def _login(self, username, password="pw"):
        self.client.post("/API/LOGIN", data={"username": username, "password": password})


# ---------------------------------------------------------------------------
# Latency tests — individual endpoints must respond within a tight budget
# ---------------------------------------------------------------------------

# Acceptable wall-clock ceiling for a single in-process request (seconds).
# These are generous enough that a cold Python interpreter still passes, but
# tight enough to catch an accidental O(n²) loop on a realistic user base.
LATENCY_BUDGET = {
    "login":          0.05,
    "get_watched":    0.05,
    "get_watchlist":  0.05,
    "get_following":  0.05,
    "activity_feed":  0.10,   # reads N following users' activity lists
    "user_profile":   0.10,
    "user_suggestions": 0.10,
    "movie_ratings":  0.10,
}


class LatencyTests(PerformanceTestBase):
    """Each endpoint must answer within its latency budget for a realistic DB."""

    REALISTIC_USER_COUNT = 200

    def setUp(self):
        users = [
            _make_user(f"user{i}", watched_count=20, watchlist_count=10)
            for i in range(self.REALISTIC_USER_COUNT)
        ]
        # Alice follows the first 50 users so the activity feed has real work.
        alice = _make_user("alice", watched_count=15, watchlist_count=8)
        alice["following"] = [f"user{i}" for i in range(50)]
        users.append(alice)
        self._build_db(users)
        self._login("alice")

    def _measure(self, fn, repetitions=5):
        """Return median wall-clock seconds over *repetitions* calls."""
        times = []
        for _ in range(repetitions):
            start = time.perf_counter()
            fn()
            times.append(time.perf_counter() - start)
        return statistics.median(times)

    def test_login_latency(self):
        elapsed = self._measure(
            lambda: self.client.post(
                "/API/LOGIN", data={"username": "alice", "password": "pw"}
            )
        )
        self.assertLess(
            elapsed, LATENCY_BUDGET["login"],
            f"Login median latency {elapsed:.3f}s exceeded budget "
            f"{LATENCY_BUDGET['login']}s with {self.REALISTIC_USER_COUNT} users in DB",
        )

    def test_get_watched_latency(self):
        elapsed = self._measure(lambda: self.client.get("/get-watched"))
        self.assertLess(elapsed, LATENCY_BUDGET["get_watched"],
                        f"GET /get-watched took {elapsed:.3f}s")

    def test_get_watchlist_latency(self):
        elapsed = self._measure(lambda: self.client.get("/get-watchlist"))
        self.assertLess(elapsed, LATENCY_BUDGET["get_watchlist"],
                        f"GET /get-watchlist took {elapsed:.3f}s")

    def test_get_following_latency(self):
        elapsed = self._measure(lambda: self.client.get("/get-following"))
        self.assertLess(elapsed, LATENCY_BUDGET["get_following"],
                        f"GET /get-following took {elapsed:.3f}s")

    def test_activity_feed_latency(self):
        elapsed = self._measure(lambda: self.client.get("/get-activity-feed"))
        self.assertLess(elapsed, LATENCY_BUDGET["activity_feed"],
                        f"GET /get-activity-feed took {elapsed:.3f}s")

    def test_user_profile_latency(self):
        elapsed = self._measure(
            lambda: self.client.get("/get-user-profile",
                                    query_string={"username": "user0"})
        )
        self.assertLess(elapsed, LATENCY_BUDGET["user_profile"],
                        f"GET /get-user-profile took {elapsed:.3f}s")

    def test_user_suggestions_latency(self):
        elapsed = self._measure(
            lambda: self.client.get("/get-user-suggestions",
                                    query_string={"query": "user1"})
        )
        self.assertLess(elapsed, LATENCY_BUDGET["user_suggestions"],
                        f"GET /get-user-suggestions took {elapsed:.3f}s")

    def test_movie_ratings_latency(self):
        elapsed = self._measure(
            lambda: self.client.get("/get-movie-ratings",
                                    query_string={"movie": "Movie 0"})
        )
        self.assertLess(elapsed, LATENCY_BUDGET["movie_ratings"],
                        f"GET /get-movie-ratings took {elapsed:.3f}s")


# ---------------------------------------------------------------------------
# Scalability tests — latency must not grow faster than linearly with DB size
# ---------------------------------------------------------------------------

class ScalabilityTests(PerformanceTestBase):
    """Doubling the DB should not more than double the response time."""

    # Ratio ceiling: if 2× the data takes more than this multiple of the time,
    # the implementation is likely super-linear (e.g. O(n²) nested loop).
    MAX_SCALING_FACTOR = 3.0

    def _median_latency(self, users, endpoint, query_string=None):
        self._build_db(users)
        self._login("alice")
        times = []
        for _ in range(5):
            start = time.perf_counter()
            self.client.get(endpoint, query_string=query_string or {})
            times.append(time.perf_counter() - start)
        return statistics.median(times)

    def _build_users(self, count):
        users = [
            _make_user(f"user{i}", watched_count=10)
            for i in range(count)
        ]
        alice = _make_user("alice")
        users.append(alice)
        return users

    def test_get_movie_ratings_scales_linearly_with_user_count(self):
        small_latency = self._median_latency(
            self._build_users(50),
            "/get-movie-ratings",
            {"movie": "Movie 0"},
        )
        large_latency = self._median_latency(
            self._build_users(200),
            "/get-movie-ratings",
            {"movie": "Movie 0"},
        )

        if small_latency > 0:
            ratio = large_latency / small_latency
            self.assertLess(
                ratio, self.MAX_SCALING_FACTOR,
                f"/get-movie-ratings scaling ratio {ratio:.1f}× when going "
                f"from 50 → 200 users (latencies: {small_latency:.3f}s → "
                f"{large_latency:.3f}s). Possible O(n²) scan.",
            )

    def test_user_suggestions_scales_linearly_with_user_count(self):
        small_latency = self._median_latency(
            self._build_users(50),
            "/get-user-suggestions",
            {"query": "user1"},
        )
        large_latency = self._median_latency(
            self._build_users(200),
            "/get-user-suggestions",
            {"query": "user1"},
        )

        if small_latency > 0:
            ratio = large_latency / small_latency
            self.assertLess(
                ratio, self.MAX_SCALING_FACTOR,
                f"/get-user-suggestions scaling ratio {ratio:.1f}× when going "
                f"from 50 → 200 users.",
            )


# ---------------------------------------------------------------------------
# Concurrent request tests — the server must not corrupt state under parallel
# load (this is especially important given PickleDB's single-writer model).
# ---------------------------------------------------------------------------

class ConcurrencyTests(PerformanceTestBase):
    """Multiple simultaneous requests must not produce garbled responses."""

    THREAD_COUNT = 20

    def setUp(self):
        users = [_make_user(f"user{i}", watched_count=5) for i in range(50)]
        alice = _make_user("alice", watched_count=5)
        self._build_db(users + [alice])

    def test_concurrent_reads_all_succeed(self):
        """All threads performing read requests must get HTTP 200."""
        # Log in once before spawning threads (session is per-client, not
        # shared, so we spin up a separate client per thread).
        errors = []

        def read_worker():
            try:
                client = httpserver.app.test_client()
                client.post("/API/LOGIN",
                            data={"username": "alice", "password": "pw"})
                response = client.get("/get-watched")
                if response.status_code != 200:
                    errors.append(f"status {response.status_code}")
            except Exception as exc:  # noqa: BLE001
                errors.append(str(exc))

        threads = [threading.Thread(target=read_worker)
                   for _ in range(self.THREAD_COUNT)]
        for t in threads:
            t.start()
        for t in threads:
            t.join(timeout=5)

        self.assertEqual(errors, [],
                         f"Concurrent reads produced errors: {errors}")

    def test_concurrent_watchlist_toggles_leave_consistent_state(self):
        """
        Many threads toggling the same movie on/off should not raise an
        exception. The final state (in or out) is non-deterministic due to
        interleaving, but the server must never 500 or return malformed JSON.
        """
        bad_responses = []

        def toggle_worker():
            try:
                client = httpserver.app.test_client()
                client.post("/API/LOGIN",
                            data={"username": "alice", "password": "pw"})
                response = client.post("/add-to-watchlist",
                                       data={"movie": "Shared Movie"})
                if response.status_code != 200:
                    bad_responses.append(f"status {response.status_code}")
                    return
                body = response.get_json()
                if body not in (True, False):
                    bad_responses.append(f"unexpected body: {body!r}")
            except Exception as exc:  # noqa: BLE001
                bad_responses.append(str(exc))

        threads = [threading.Thread(target=toggle_worker)
                   for _ in range(self.THREAD_COUNT)]
        for t in threads:
            t.start()
        for t in threads:
            t.join(timeout=5)

        self.assertEqual(bad_responses, [],
                         f"Concurrent toggles produced bad responses: "
                         f"{bad_responses}")


# ---------------------------------------------------------------------------
# Payload size tests — responses with large data must stay within reason
# ---------------------------------------------------------------------------

# Ceiling in bytes for each endpoint's JSON response body.
PAYLOAD_BUDGET = {
    "activity_feed":  50_000,   # 50 KB
    "movie_ratings":  100_000,  # 100 KB — all users' ratings for one movie
    "user_profile":   20_000,   # 20 KB
}


class PayloadSizeTests(PerformanceTestBase):
    """Response bodies must not grow unbounded as data accumulates."""

    def setUp(self):
        users = [
            _make_user(f"user{i}", watched_count=50, watchlist_count=20)
            for i in range(100)
        ]
        alice = _make_user("alice", watched_count=50, watchlist_count=20)
        alice["following"] = [f"user{i}" for i in range(100)]
        # Give every user a long activity log.
        for u in users:
            u["activity"] = [
                {"type": "rated_movie", "movie": f"Movie {j}",
                 "rating": "4", "review": "A fine film indeed."}
                for j in range(30)
            ]
        self._build_db(users + [alice])
        self._login("alice")

    def test_activity_feed_payload_is_bounded(self):
        response = self.client.get("/get-activity-feed")
        self.assertEqual(response.status_code, 200)
        size = len(response.data)
        self.assertLess(
            size, PAYLOAD_BUDGET["activity_feed"],
            f"/get-activity-feed returned {size:,} bytes "
            f"(budget: {PAYLOAD_BUDGET['activity_feed']:,} bytes). "
            f"The limit parameter may not be applied correctly.",
        )

    def test_movie_ratings_payload_is_bounded(self):
        response = self.client.get("/get-movie-ratings",
                                   query_string={"movie": "Movie 0"})
        self.assertEqual(response.status_code, 200)
        size = len(response.data)
        self.assertLess(
            size, PAYLOAD_BUDGET["movie_ratings"],
            f"/get-movie-ratings returned {size:,} bytes "
            f"(budget: {PAYLOAD_BUDGET['movie_ratings']:,} bytes).",
        )

    def test_user_profile_payload_is_bounded(self):
        response = self.client.get("/get-user-profile",
                                   query_string={"username": "user0"})
        self.assertEqual(response.status_code, 200)
        size = len(response.data)
        self.assertLess(
            size, PAYLOAD_BUDGET["user_profile"],
            f"/get-user-profile returned {size:,} bytes "
            f"(budget: {PAYLOAD_BUDGET['user_profile']:,} bytes).",
        )


# ---------------------------------------------------------------------------
# Throughput smoke test — the server should handle a burst without stalling
# ---------------------------------------------------------------------------

class ThroughputTests(PerformanceTestBase):
    """A short burst of sequential requests must complete within a wall-clock
    budget, catching catastrophic regressions (e.g. accidental sleep or DB
    file flush on every read)."""

    BURST_SIZE = 100
    BURST_BUDGET_SECONDS = 5.0

    def setUp(self):
        users = [_make_user(f"user{i}", watched_count=10) for i in range(50)]
        alice = _make_user("alice", watched_count=10)
        self._build_db(users + [alice])
        self._login("alice")

    def test_burst_of_get_watched_requests(self):
        start = time.perf_counter()
        for _ in range(self.BURST_SIZE):
            resp = self.client.get("/get-watched")
            self.assertEqual(resp.status_code, 200)
        elapsed = time.perf_counter() - start
        self.assertLess(
            elapsed, self.BURST_BUDGET_SECONDS,
            f"{self.BURST_SIZE} sequential GET /get-watched requests took "
            f"{elapsed:.2f}s (budget: {self.BURST_BUDGET_SECONDS}s).",
        )

    def test_burst_of_user_suggestions_requests(self):
        start = time.perf_counter()
        for i in range(self.BURST_SIZE):
            resp = self.client.get("/get-user-suggestions",
                                   query_string={"query": f"user{i % 10}"})
            self.assertEqual(resp.status_code, 200)
        elapsed = time.perf_counter() - start
        self.assertLess(
            elapsed, self.BURST_BUDGET_SECONDS,
            f"{self.BURST_SIZE} sequential GET /get-user-suggestions requests "
            f"took {elapsed:.2f}s (budget: {self.BURST_BUDGET_SECONDS}s).",
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)
