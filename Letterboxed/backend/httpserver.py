from flask import Flask, request, jsonify
import pickledb

app = Flask(__name__)
db = pickledb.load('database.db', auto_dump=True)

# Route to create a new account
@app.route('/api/auth/signup', methods=['POST'])
def signup():
    data = request.get_json()
    username = data['username']
    password = data['password']
    if db.exists(username):
        return jsonify({'message': 'User already exists'}), 400
    db.set(username, password)
    return jsonify({'message': 'Account created successfully'}), 201

# Route to sign in
@app.route('/api/auth/signin', methods=['POST'])
def signin():
    data = request.get_json()
    username = data['username']
    password = data['password']
    if db.exists(username) and db.get(username) == password:
        return jsonify({'message': 'Sign in successful'}), 200
    return jsonify({'message': 'Invalid username or password'}), 401

# Sample route to get a list of movies
@app.route('/api/movies', methods=['GET'])
def get_movies():
    # You would replace this with real movie data
    movies = [
        {'title': 'Inception', 'year': 2010, 'genre': 'Sci-Fi'},
        {'title': 'The Dark Knight', 'year': 2008, 'genre': 'Action'},
    ]
    return jsonify(movies)

if __name__ == '__main__':
    app.run(port=5000)
