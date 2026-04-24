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


class UseCaseDriver:
    """Driver beneath the GUI layer for repeatable use-case execution."""

    def __init__(self):
        users = [{
            "username": "driverAlice",
            "password": "pw",
            "watched": {},
            "whattowatch": [],
        }, {
            "username": "driverBob",
            "password": "pw",
            "watched": {},
            "whattowatch": [],
        }]
        self.fake_db = FakeDB({"usersList": users})
        httpserver.db = self.fake_db
        httpserver.user_repository = UserRepository(self.fake_db)
        httpserver.auth_service = AuthService(httpserver.user_repository)
        httpserver.app.config["TESTING"] = True
        self.client = httpserver.app.test_client()

    def login(self, username, password):
        response = self.client.post("/API/LOGIN", data={"username": username, "password": password})
        return response.get_json()

    def run_discover_and_follow_user(self):
        self.login("driverAlice", "pw")
        suggestions = self.client.get("/get-user-suggestions", query_string={"query": "driverB"}).get_json()
        followed = self.client.post("/follow-user", data={"username": "driverBob"}).get_json()
        following = self.client.get("/get-following").get_json()
        return {
            "suggestions": suggestions,
            "followed": followed,
            "following": following,
        }

    def run_share_activity_and_feed(self):
        self.login("driverBob", "pw")
        self.client.post("/add-to-watchlist", data={"movie": "Arrival"})
        self.client.post("/add-to-watched", data={"movie": "Arrival", "rating": "4", "review": "Great"})

        self.login("driverAlice", "pw")
        self.client.post("/follow-user", data={"username": "driverBob"})
        return self.client.get("/get-activity-feed").get_json()


if __name__ == "__main__":
    driver = UseCaseDriver()
    print("Discover/follow scenario:", driver.run_discover_and_follow_user())
    print("Activity feed scenario:", driver.run_share_activity_and_feed())
