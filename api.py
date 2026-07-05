from flask import Flask, request, jsonify
from flask_cors import CORS
import mysql.connector
from datetime import datetime

app = Flask(__name__)
CORS(app)

DB_CONFIG = {
    "host": "localhost",
    "user": "root",
    "password": "Devansh97491",
    "database": "gaming",
    "charset": "utf8"
}

def get_db():
    return mysql.connector.connect(**DB_CONFIG)

def init_db():
    """Initialize database, tables, and seed default admin."""
    conn = mysql.connector.connect(
        host="localhost", user="root",
        password="Devansh97491", charset="utf8"
    )
    cur = conn.cursor()
    cur.execute("CREATE DATABASE IF NOT EXISTS gaming")
    cur.execute("USE gaming")

    cur.execute("""
        CREATE TABLE IF NOT EXISTS admin (
            id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(50) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS games (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(50) NOT NULL,
            console VARCHAR(30) NOT NULL,
            status ENUM('ACTIVE','INACTIVE') DEFAULT 'ACTIVE'
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS rate (
            game_id INT PRIMARY KEY,
            price_per_hour DECIMAL(6,2),
            rating INT,
            FOREIGN KEY (game_id) REFERENCES games(id)
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS customers (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name CHAR(30) NOT NULL,
            phone BIGINT
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS sessions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            customer_id INT NOT NULL,
            game_id INT NOT NULL,
            start_time DATETIME NOT NULL,
            end_time DATETIME,
            total_amount DECIMAL(8,2),
            FOREIGN KEY (customer_id) REFERENCES customers(id),
            FOREIGN KEY (game_id) REFERENCES games(id)
        )
    """)

    # Seed default admin (username: admin, password: admin123)
    cur.execute("SELECT COUNT(*) FROM admin")
    if cur.fetchone()[0] == 0:
        cur.execute(
            "INSERT INTO admin (username, password_hash) VALUES (%s, %s)",
            ("admin", "admin123")
        )

    conn.commit()
    cur.close()
    conn.close()

# ─────────────────────────────────────────
#  GAMES
# ─────────────────────────────────────────

@app.route("/api/games", methods=["GET"])
def get_games():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        SELECT g.id, g.name, g.console, g.status,
               r.price_per_hour, r.rating
        FROM games g
        LEFT JOIN rate r ON g.id = r.game_id
        ORDER BY g.id
    """)
    rows = cur.fetchall()
    cur.close(); conn.close()

    games = [{
        "id": r[0], "name": r[1], "console": r[2], "status": r[3],
        "price_per_hour": float(r[4]) if r[4] else None,
        "rating": r[5]
    } for r in rows]
    return jsonify(games)

@app.route("/api/games", methods=["POST"])
def add_game():
    data = request.json
    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO games (name, console) VALUES (%s, %s)",
        (data["name"], data["console"])
    )
    game_id = cur.lastrowid
    cur.execute(
        "INSERT INTO rate (game_id, price_per_hour, rating) VALUES (%s, %s, %s)",
        (game_id, data["price"], data["rating"])
    )
    conn.commit(); cur.close(); conn.close()
    return jsonify({"game_id": game_id, "message": "Game added successfully"}), 201

@app.route("/api/games/<int:game_id>/discontinue", methods=["PUT"])
def discontinue_game(game_id):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("UPDATE games SET status='INACTIVE' WHERE id=%s", (game_id,))
    conn.commit(); cur.close(); conn.close()
    return jsonify({"success": True, "message": "Game discontinued"})

@app.route("/api/games/<int:game_id>/reactivate", methods=["PUT"])
def reactivate_game(game_id):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("UPDATE games SET status='ACTIVE' WHERE id=%s", (game_id,))
    conn.commit(); cur.close(); conn.close()
    return jsonify({"success": True, "message": "Game reactivated"})

@app.route("/api/games/<int:game_id>/rating", methods=["PUT"])
def update_rating(game_id):
    data = request.json
    conn = get_db()
    cur = conn.cursor()
    cur.execute("UPDATE rate SET rating=%s WHERE game_id=%s", (data["rating"], game_id))
    conn.commit(); cur.close(); conn.close()
    return jsonify({"success": True})

@app.route("/api/games/<int:game_id>/price", methods=["PUT"])
def update_price(game_id):
    data = request.json
    conn = get_db()
    cur = conn.cursor()
    cur.execute("UPDATE rate SET price_per_hour=%s WHERE game_id=%s", (data["price"], game_id))
    conn.commit(); cur.close(); conn.close()
    return jsonify({"success": True})

# ─────────────────────────────────────────
#  SESSIONS
# ─────────────────────────────────────────

@app.route("/api/sessions/start", methods=["POST"])
def start_session():
    data = request.json
    conn = get_db()
    cur = conn.cursor()

    # Check game is active
    cur.execute("SELECT status FROM games WHERE id=%s", (data["game_id"],))
    row = cur.fetchone()
    if not row:
        cur.close(); conn.close()
        return jsonify({"error": "Game not found"}), 404
    if row[0] == "INACTIVE":
        cur.close(); conn.close()
        return jsonify({"error": "Game is inactive"}), 400

    # Create customer
    cur.execute(
        "INSERT INTO customers (name, phone) VALUES (%s, %s)",
        (data["name"], data["phone"])
    )
    customer_id = cur.lastrowid

    # Start session
    cur.execute(
        "INSERT INTO sessions (customer_id, game_id, start_time) VALUES (%s, %s, %s)",
        (customer_id, data["game_id"], datetime.now())
    )
    session_id = cur.lastrowid
    conn.commit(); cur.close(); conn.close()
    return jsonify({"session_id": session_id, "customer_id": customer_id})

@app.route("/api/sessions/end", methods=["POST"])
def end_session():
    data = request.json
    session_id = data["session_id"]

    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        SELECT s.start_time, r.price_per_hour, g.name, c.name
        FROM sessions s
        JOIN rate r ON s.game_id = r.game_id
        JOIN games g ON s.game_id = g.id
        JOIN customers c ON s.customer_id = c.id
        WHERE s.id = %s AND s.end_time IS NULL
    """, (session_id,))
    row = cur.fetchone()

    if not row:
        cur.close(); conn.close()
        return jsonify({"error": "Session not found or already ended"}), 404

    start_time, price, game_name, customer_name = row
    end_time = datetime.now()
    hours = (end_time - start_time).total_seconds() / 3600
    total = round(hours * float(price), 2)

    cur.execute(
        "UPDATE sessions SET end_time=%s, total_amount=%s WHERE id=%s",
        (end_time, total, session_id)
    )
    conn.commit(); cur.close(); conn.close()

    return jsonify({
        "total_amount": total,
        "duration_hours": round(hours, 2),
        "game_name": game_name,
        "customer_name": customer_name,
        "start_time": start_time.strftime("%Y-%m-%d %H:%M:%S"),
        "end_time": end_time.strftime("%Y-%m-%d %H:%M:%S")
    })

@app.route("/api/sessions/active", methods=["GET"])
def get_active_sessions():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        SELECT s.id, c.name, g.name, s.start_time
        FROM sessions s
        JOIN customers c ON s.customer_id = c.id
        JOIN games g ON s.game_id = g.id
        WHERE s.end_time IS NULL
        ORDER BY s.start_time DESC
    """)
    rows = cur.fetchall()
    cur.close(); conn.close()
    return jsonify([{
        "session_id": r[0], "customer": r[1],
        "game": r[2], "start_time": r[3].strftime("%Y-%m-%d %H:%M:%S")
    } for r in rows])

# ─────────────────────────────────────────
#  ADMIN
# ─────────────────────────────────────────

@app.route("/api/admin/login", methods=["POST"])
def admin_login():
    data = request.json
    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        "SELECT password_hash FROM admin WHERE username=%s",
        (data["username"],)
    )
    result = cur.fetchone()
    cur.close(); conn.close()

    if result and result[0] == data["password"]:
        return jsonify({"success": True})
    return jsonify({"success": False, "error": "Invalid credentials"}), 401

if __name__ == "__main__":
    init_db()
    print("=" * 50)
    print("  HKG Gaming Parlor API — Running on port 5000")
    print("  Default Admin: username=admin  password=admin123")
    print("=" * 50)
    app.run(debug=True, port=5000)
