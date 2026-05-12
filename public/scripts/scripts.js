(function (root, factory) {
    if (typeof module === "object" && module.exports) {
        const app = require("./app");
        const storage = require("./storage");
        module.exports = factory(app, storage, root);
    } else {
        root.LetterboxEntrypoint = factory(root.LetterboxApp, root.LetterboxStorage, root);
    }
})(typeof globalThis !== "undefined" ? globalThis : this, function (app, storage, root) {
    function applyThemeToDocument(theme, documentRef) {
        const doc = documentRef || root.document;
        if (!doc || !doc.body) {
            return;
        }

        if (theme === "light") {
            doc.body.classList.add("light-mode");
        } else {
            doc.body.classList.remove("light-mode");
        }
    }

    function applyStoredTheme() {
        if (!storage || typeof storage.getTheme !== "function") {
            return;
        }
        applyThemeToDocument(storage.getTheme(), root.document);
    }

    if (root.document) {
        if (root.document.readyState === "loading") {
            root.document.addEventListener("DOMContentLoaded", applyStoredTheme);
        } else {
            applyStoredTheme();
        }
    }

    root.opensignin = app.openSignin;
    root.opensignup = app.openSignup;
    root.openmymovies = app.openMyMovies;
    root.openwatchlist = app.openWatchlist;
    root.opensearch = app.openSearch;
    root.openmovie = app.openMovie;
    root.openfinduser = app.openFindUser;
    root.openuserprofile = app.openUserProfile;
    root.opensettings = app.openSettings;
    root.openfriends = app.openFriends;
    root.applyThemeToDocument = applyThemeToDocument;
    return app;
});