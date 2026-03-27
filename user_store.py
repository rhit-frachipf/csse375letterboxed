from dataclasses import dataclass, field
from typing import Dict, List, Optional


USERS_LIST_KEY = "usersList"


@dataclass
class User:
    username: str
    password: str
    watched: Dict[str, str] = field(default_factory=dict)
    whattowatch: List[str] = field(default_factory=list)

    @classmethod
    def from_dict(cls, payload):
        return cls(
            username=payload.get("username", ""),
            password=payload.get("password", ""),
            watched=dict(payload.get("watched", {})),
            whattowatch=list(payload.get("whattowatch", [])),
        )

    def to_dict(self):
        return {
            "username": self.username,
            "password": self.password,
            "watched": dict(self.watched),
            "whattowatch": list(self.whattowatch),
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

    def set_movie_rating(self, username, movie, rating) -> bool:
        user = self.find_by_username(username)
        if not user:
            return False

        user.watched[movie] = rating
        self.update_user(user)
        return True


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
