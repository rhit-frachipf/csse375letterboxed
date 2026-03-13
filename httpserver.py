import flask
import json
import os
import pickledb

app = flask.Flask(__name__,             # ie "http_server_starter"
            static_url_path='', 	    # Treat all files as static files.
            static_folder='public')	    # Look in the public folder.

db = pickledb.load("users.db", auto_dump=True)
list_name = "usersList"
users = []
app.username = ""
app.password = ""
app.watched = {}
app.watchlist = []
app.loggedin = False

if not db.get(list_name):
    db.lcreate(list_name)

def signup():
    for x in db.getall():
        users = db.get(x)
        usernamelist = []
        for y in users:
            usernamelist.append(y.get("username"))
        if (app.username in usernamelist):
            print("User already exists")
            break
        else:
            entry = {"username": app.username,
                     "password": app.password,
                     "watched": {},
                     "whattowatch": []}
            db.ladd(list_name, entry)
            login()

def addToWatchList(movie):
    # Retrieve the list of users
    users_list = db.get("usersList")

    # Find the user and append a new movie to their whattowatch list
    for user in users_list:
        if user["username"] == app.username:
            for movies in user["whattowatch"]:
                if movies == movie:
                    user["whattowatch"].remove(movie)
                    db.set("usersList", users_list)
                    return
            user["whattowatch"].append(movie)

    # Save the updated users list back to the database
    db.set("usersList", users_list)
    return

def addToWatched(movie, rating):
    # Retrieve the list of users
    users_list = db.get("usersList")

    # Find the user and append a new movie to their whattowatch list
    for user in users_list:
        if user["username"] == app.username:
            # for movies in user["watched"]:
            #     # print(movies)
            #     # print(movie)
            #     if movies == movie:
            #         return
            user["watched"][movie] = rating

    # Save the updated users list back to the database
    db.set("usersList", users_list)
    return

def login():
    # print(app.username)
    for x in db.getall():
        users = db.get(x)
        usernamelist = []
        for y in users:
            usernamelist.append(y.get("username"))
        if (app.username in usernamelist):
            for z in users:
                if (app.username == z.get("username")):
                    if (app.password == z.get("password")):
                        # print("Logged in!")
                        # print(app.username)
                        app.watched = z.get("watched")
                        # print(app.watched)
                        app.watchlist = z.get("whattowatch")
                        app.loggedin = True
                    else:
                        print("Password is incorrect")
        else:
            print("User does not exist")

@app.route("/")
def home():
    return flask.send_from_directory(app.static_folder, "signin.html")

@app.route('/get-watched')
def get_watched():
    return flask.jsonify(app.watched)

@app.route('/get-watchlist')
def get_watchlist():
    return flask.jsonify(app.watchlist)

@app.post('/add-to-watchlist')
def add_to_watchlist():
    post_data = flask.request.form
    addToWatchList(post_data.get("movie"))

    data=json.dumps( app.loggedin )
    
    return flask.Response(data,
                          status=200,
                          headers={
                              "Content-Type":"application/json"
                          }
                          )

@app.post('/add-to-watched')
def add_to_watched():
    post_data = flask.request.form
    addToWatched(post_data.get("movie"), post_data.get("rating"))

    data=json.dumps( app.loggedin )
    
    return flask.Response(data,
                          status=200,
                          headers={
                              "Content-Type":"application/json"
                          }
                          )


@app.post("/API/LOGIN")
def handle_login():
    post_data = flask.request.form
    
    app.username = post_data.get("username")
    app.password = post_data.get("password")
    app.loggedin = post_data.get("loggedin")

    login()

    data=json.dumps( app.loggedin )
    
    return flask.Response(data,
                          status=200,
                          headers={
                              "Content-Type":"application/json"
                          }
                          )

@app.post("/API/SIGNUP")
def handle_signup():
    # print("/API/SIGNUP invoked, post_data:")
    post_data = flask.request.form
    # print("Post data: ", post_data)
    
    app.username = post_data.get("username")
    app.password = post_data.get("password")

    signup()

    data=json.dumps( app.loggedin )
    
    return flask.Response(data,
                          status=200,
                          headers={
                              "Content-Type":"application/json"
                          }
                          )

@app.get("/shutdown")
def shutdown():
    print("Shutting down the server")
    os._exit(0)

# TODO - Change Port to an appropriate individual port for yourself
if __name__ == "__main__":
    app.run(host='0.0.0.0', port=10470)