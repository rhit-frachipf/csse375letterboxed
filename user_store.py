from dataclasses import dataclass, field
from typing import Dict, List, Optional
import time


USERS_LIST_KEY = "usersList"


@dataclass
class User:
    username: str
    password: str
    watched: Dict[str, str] = field(default_factory=dict)
    whattowatch: List[str] = field(default_factory=list)
    following: List[str] = field(default_factory=list)
    activity: List[Dict[str, str]] = field(default_factory=list)

    @classmethod
    def from_dict(cls, payload):
        return cls(
            username=payload.get("username", ""),
            password=payload.get("password", ""),
            watched=dict(payload.get("watched", {})),
            whattowatch=list(payload.get("whattowatch", [])),
            following=list(payload.get("following", [])),
            activity=list(payload.get("activity", [])),
        )

    def to_dict(self):
        return {
            "username": self.username,
            "password": self.password,
            "watched": dict(self.watched),
            "whattowatch": list(self.whattowatch),
            "following": list(self.following),
            "activity": list(self.activity),
        }


class UserRepository:
    def __init__(self, database, list_name=USERS_LIST_KEY):
        self.database = database
        self.list_name = list_name
        self.ensure_store()

    def ensure_store(self):
        if self.database.get(self.list_name) is None:
            self.database.set(self.list_name, [])

    def _load_users(self):
        raw_users = self.database.get(self.list_name) or []
        return [User.from_dict(user) for user in raw_users]

    def _save_users(self, users):
        self.database.set(self.list_name, [user.to_dict() for user in users])

    def find_by_username(self, username) -> Optional[User]:
        for user in self._load_users():
            if user.username == username:
                return user
        return None

    def search_usernames(self, query, limit=8, exclude_username=None) -> List[str]:
        normalized_query = (query or "").strip().lower()
        if not normalized_query:
            return []

        normalized_exclude = (exclude_username or "").strip().lower()
        matched = []
        for user in self._load_users():
            username = user.username or ""
            normalized_username = username.lower()
            if normalized_exclude and normalized_username == normalized_exclude:
                continue
            if normalized_query in normalized_username:
                matched.append(username)

        matched.sort(key=lambda username: (
            0 if username.lower().startswith(normalized_query) else 1,
            username.lower(),
        ))
        return matched[:limit]

    def create_user(self, username, password) -> Optional[User]:
        if self.find_by_username(username):
            return None

        users = self._load_users()
        user = User(username=username, password=password)
        users.append(user)
        self._save_users(users)
        return user

    def update_user(self, updated_user: User) -> User:
        users = self._load_users()
        for index, user in enumerate(users):
            if user.username == updated_user.username:
                users[index] = updated_user
                self._save_users(users)
                return updated_user

        users.append(updated_user)
        self._save_users(users)
        return updated_user

    def toggle_watchlist_movie(self, username, movie) -> bool:
        user = self.find_by_username(username)
        if not user:
            return False

        if movie in user.whattowatch:
            user.whattowatch.remove(movie)
        else:
            user.whattowatch.append(movie)

        self.update_user(user)
        return True

    def set_movie_rating(self, username, movie, rating, review="") -> bool:
        user = self.find_by_username(username)
        if not user:
            return False

        user.watched[movie] = {
            "rating": str(rating),
            "review": review or "",
        }
        self.update_user(user)
        return True

    def search_usernames(self, query, limit=8, exclude_username=None) -> List[str]:
        normalized_query = (query or "").strip().lower()
        if not normalized_query:
            return []

        normalized_exclude = (exclude_username or "").strip().lower()
        matched = []
        for user in self._load_users():
            username = user.username or ""
            normalized_username = username.lower()
            if normalized_exclude and normalized_username == normalized_exclude:
                continue
            if normalized_query in normalized_username:
                matched.append(username)

        matched.sort(key=lambda username: (
            0 if username.lower().startswith(normalized_query) else 1,
            username.lower(),
        ))
        return matched[:limit]

    def follow_user(self, username, target_username) -> bool:
        if not username or not target_username or username == target_username:
            return False

        user = self.find_by_username(username)
        target_user = self.find_by_username(target_username)
        if not user or not target_user:
            return False

        if target_username in user.following:
            return True

        user.following.append(target_username)
        self.update_user(user)
        return True

    def unfollow_user(self, username, target_username) -> bool:
        user = self.find_by_username(username)
        if not user:
            return False

        if target_username not in user.following:
            return True

        user.following.remove(target_username)
        self.update_user(user)
        return True

    def is_following(self, username, target_username) -> bool:
        user = self.find_by_username(username)
        if not user:
            return False
        return target_username in user.following

    def list_following(self, username) -> List[str]:
        user = self.find_by_username(username)
        if not user:
            return []
        return list(user.following)

    def add_activity(self, username, activity_entry) -> bool:
        user = self.find_by_username(username)
        if not user:
            return False

        payload = dict(activity_entry or {})
        payload["timestamp"] = int(payload.get("timestamp") or time.time())
        user.activity.append(payload)
        user.activity = user.activity[-200:]
        self.update_user(user)
        return True

    def get_activity_feed(self, username, limit=25) -> List[Dict[str, str]]:
        user = self.find_by_username(username)
        if not user:
            return []

        feed_items = []
        for followed_username in user.following:
            followed_user = self.find_by_username(followed_username)
            if not followed_user:
                continue

            for activity_entry in followed_user.activity:
                item = dict(activity_entry)
                item["username"] = followed_user.username
                item["timestamp"] = int(item.get("timestamp") or 0)
                feed_items.append(item)

        feed_items.sort(key=lambda item: item.get("timestamp", 0), reverse=True)
        return feed_items[:limit]


class AuthService:
    def __init__(self, user_repository: UserRepository):
        self.user_repository = user_repository

    def signup(self, username, password) -> Optional[User]:
        if not username or not password:
            return None
        return self.user_repository.create_user(username, password)

    def login(self, username, password) -> Optional[User]:
        if not username or not password:
            return None

        user = self.user_repository.find_by_username(username)
        if not user or user.password != password:
            return None

        return user
