(function (root, factory) {
    if (typeof module === "object" && module.exports) {
        module.exports = factory(root);
    } else {
        root.LetterboxApi = factory(root);
    }
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
    const OMDB_API_KEY = "10707b46";

    async function postForm(url, payload, fetchImpl) {
        const fetchClient = fetchImpl || root.fetch;
        const response = await fetchClient(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams(payload).toString(),
        });

        return response.json();
    }

    async function login(username, password, fetchImpl) {
        return postForm("/API/LOGIN", { username, password }, fetchImpl);
    }

    async function signup(username, password, fetchImpl) {
        return postForm("/API/SIGNUP", { username, password }, fetchImpl);
    }

    async function logout(fetchImpl) {
        return postForm("/API/LOGOUT", {}, fetchImpl);
    }

    async function addToWatchlist(movie, fetchImpl) {
        return postForm("/add-to-watchlist", { movie }, fetchImpl);
    }

    async function addToWatched(movie, rating, review, fetchImpl) {
        return postForm("/add-to-watched", { movie, rating, review: review || "" }, fetchImpl);
    }

    async function fetchWatched(fetchImpl) {
        const fetchClient = fetchImpl || root.fetch;
        const response = await fetchClient("/get-watched");
        return response.json();
    }

    async function fetchWatchlist(fetchImpl) {
        const fetchClient = fetchImpl || root.fetch;
        const response = await fetchClient("/get-watchlist");
        return response.json();
    }

    async function fetchUserProfile(username, fetchImpl) {
        const fetchClient = fetchImpl || root.fetch;
        const response = await fetchClient(
            `/get-user-profile?username=${encodeURIComponent(username || "")}`
        );
        return response.json();
    }

    async function fetchUserSuggestions(query, fetchImpl) {
        const fetchClient = fetchImpl || root.fetch;
        const response = await fetchClient(
            `/get-user-suggestions?query=${encodeURIComponent(query || "")}`
        );
        return response.json();
    }

    async function followUser(username, fetchImpl) {
        return postForm("/follow-user", { username }, fetchImpl);
    }

    async function unfollowUser(username, fetchImpl) {
        return postForm("/unfollow-user", { username }, fetchImpl);
    }

    async function fetchFollowing(fetchImpl) {
        const fetchClient = fetchImpl || root.fetch;
        const response = await fetchClient("/get-following");
        return response.json();
    }

    async function fetchActivityFeed(limit, fetchImpl) {
        const fetchClient = fetchImpl || root.fetch;
        const query = typeof limit === "number" ? `?limit=${encodeURIComponent(limit)}` : "";
        const response = await fetchClient(`/get-activity-feed${query}`);
        return response.json();
    }

    function normalizeMovie(payload) {
        return {
            title: payload.Title,
            year: payload.Year,
            plot: payload.Plot,
            genre: payload.Genre,
            director: payload.Director,
            poster: payload.Poster,
        };
    }

    async function fetchMovieByTitle(title, fetchImpl) {
        const fetchClient = fetchImpl || root.fetch;
        const response = await fetchClient(
            `http://www.omdbapi.com/?t=${encodeURIComponent(title)}&apikey=${OMDB_API_KEY}`
        );
        const data = await response.json();

        if (data.Response !== "True") {
            return null;
        }

        return normalizeMovie(data);
    }

    async function fetchPosterByTitle(title, fetchImpl) {
        const movie = await fetchMovieByTitle(title, fetchImpl);
        return movie ? movie.poster : null;
    }

    async function searchMovies(searchTerm, fetchImpl) {
        const fetchClient = fetchImpl || root.fetch;
        const response = await fetchClient(
            `http://www.omdbapi.com/?s=${encodeURIComponent(searchTerm)}&apikey=${OMDB_API_KEY}`
        );
        const data = await response.json();

        if (data.Response !== "True" || !data.Search) {
            return [];
        }

        return data.Search.slice(0, 5).map(normalizeMovie);
    }

    return {
        postForm,
        login,
        signup,
        logout,
        addToWatchlist,
        addToWatched,
        fetchWatched,
        fetchWatchlist,
        fetchUserProfile,
        fetchUserSuggestions,
        followUser,
        unfollowUser,
        fetchFollowing,
        fetchActivityFeed,
        fetchMovieByTitle,
        fetchPosterByTitle,
        searchMovies,
        normalizeMovie,
    };
});
