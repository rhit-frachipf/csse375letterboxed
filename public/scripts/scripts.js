(function (root, factory) {
    if (typeof module === "object" && module.exports) {
        const app = require("./app");
        module.exports = factory(app, root);
    } else {
        root.LetterboxEntrypoint = factory(root.LetterboxApp, root);
    }
})(typeof globalThis !== "undefined" ? globalThis : this, function (app, root) {
    root.opensignin = app.openSignin;
    root.opensignup = app.openSignup;
    root.openmymovies = app.openMyMovies;
    root.openwatchlist = app.openWatchlist;
    root.opensearch = app.openSearch;
    root.openmovie = app.openMovie;
    root.openfinduser = app.openFindUser;
    root.openuserprofile = app.openUserProfile;
    return app;
});