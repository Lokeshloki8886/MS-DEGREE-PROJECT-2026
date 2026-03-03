from flask import Flask, request, jsonify, session
from flask_cors import CORS
import mysql.connector
import bcrypt

app = Flask(__name__)
app.secret_key = 'splitwise-secret-key-2026'

CORS(app, supports_credentials=True, origins=["http://localhost:3000"])

db_config = {
    'host': 'localhost',
    'user': 'root',
    'password': 'dell2015',
    'database': 'splitwise'
}


def get_db():
    conn = mysql.connector.connect(**db_config)
    return conn


@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({'error': 'Username and password are required'}), 400

    hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())

    try:
        conn = get_db()
        cur = conn.cursor(dictionary=True)
        cur.execute("INSERT INTO users (username, password) VALUES (%s, %s)", (username, hashed.decode('utf-8')))
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({'message': 'User registered successfully'}), 201
    except mysql.connector.IntegrityError:
        return jsonify({'error': 'Username already taken'}), 409
    except Exception as e:
        return jsonify({'error': 'Something went wrong'}), 500


@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({'error': 'Username and password are required'}), 400

    conn = get_db()
    cur = conn.cursor(dictionary=True)
    cur.execute("SELECT * FROM users WHERE username = %s", (username,))
    user = cur.fetchone()
    cur.close()
    conn.close()

    if user and bcrypt.checkpw(password.encode('utf-8'), user['password'].encode('utf-8')):
        session['user_id'] = user['id']
        session['username'] = user['username']
        return jsonify({'message': 'Logged in', 'username': user['username']}), 200
    else:
        return jsonify({'error': 'Invalid username or password'}), 401


@app.route('/api/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'message': 'Logged out'}), 200


@app.route('/api/me', methods=['GET'])
def me():
    if 'user_id' in session:
        return jsonify({'user_id': session['user_id'], 'username': session['username']}), 200
    else:
        return jsonify({'error': 'Not logged in'}), 401


if __name__ == '__main__':
    app.run(debug=True, port=5000)
