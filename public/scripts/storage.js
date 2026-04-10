(function (root, factory) {
    if (typeof module === "object" && module.exports) {
        module.exports = factory(root);
    } else {
        root.LetterboxStorage = factory(root);
    }
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
    const STORAGE_KEY = "letterboxed.appState";

    function createDefaultState() {
        return {
            loggedIn: false,
            selectedMovie: null,
            viewedUserProfile: null,
        };
    }

    function parseState(rawState) {
        if (!rawState) {
            return createDefaultState();
        }

        try {
            const parsed = JSON.parse(rawState);
            return {
                loggedIn: Boolean(parsed.loggedIn),
                selectedMovie: parsed.selectedMovie || null,
                viewedUserProfile: parsed.viewedUserProfile || null,
            };
        } catch (error) {
            return createDefaultState();
        }
    }

    function loadAppState(storage) {
        const storageProvider = storage || root.localStorage;
        if (!storageProvider) {
            return createDefaultState();
        }

        return parseState(storageProvider.getItem(STORAGE_KEY));
    }

    function saveAppState(state, storage) {
        const storageProvider = storage || root.localStorage;
        if (!storageProvider) {
            return state;
        }

        const nextState = {
            loggedIn: Boolean(state.loggedIn),
            selectedMovie: state.selectedMovie || null,
            viewedUserProfile: state.viewedUserProfile || null,
        };
        storageProvider.setItem(STORAGE_KEY, JSON.stringify(nextState));
        return nextState;
    }

    function setLoggedIn(loggedIn, storage) {
        const state = loadAppState(storage);
        state.loggedIn = Boolean(loggedIn);
        return saveAppState(state, storage);
    }

    function setSelectedMovie(movie, storage) {
        const state = loadAppState(storage);
        state.selectedMovie = movie || null;
        return saveAppState(state, storage);
    }

    function clearAppState(storage) {
        return saveAppState(createDefaultState(), storage);
    }

    function setViewedUserProfile(username, storageProvider) {
        const state = loadAppState(storageProvider);
        state.viewedUserProfile = username || null;
        return saveAppState(state, storageProvider);
    }

    function getViewedUserProfile(storageProvider) {
        const state = loadAppState(storageProvider);
        return state.viewedUserProfile;
    }

    return {
        STORAGE_KEY,
        createDefaultState,
        loadAppState,
        saveAppState,
        setLoggedIn,
        setSelectedMovie,
        clearAppState,
        setViewedUserProfile,
        getViewedUserProfile,
    };
});
