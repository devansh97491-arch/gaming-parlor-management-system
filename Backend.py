import mysql.connector
paa=mysql.connector.connect(host="localhost", user="root", 
password="Devansh97491", charset="utf8") 
if paa.is_connected()==True: 
    print("="*33,"WELCOME TO HKG GAMING PARLOR",'='*33) 
cur=paa.cursor() 
# Database
cur.execute("create database if not exists gaming") 
cur.execute("use gaming") 
# Admin table (single admin, but stored properly)
cur.execute("""
CREATE TABLE IF NOT EXISTS admin (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL
)
""")
# Games table
cur.execute("""
            create table if not exists games(id integer primary key, name varchar(20) Not Null, 
            console varchar(20) Not Null,status ENUM('ACTIVE','INACTIVE') DEFAULT 'ACTIVE')
            """) 
# Rates table (separate, as per your original design)
cur.execute("""
            create table if not exists rate(
            Game_id integer primary key, price_per_hour Decimal(6,2), 
            rating Integer,Foreign Key(Game_id) References games(id)
            )
            """) 
# Customers table
cur.execute("""
            create table if not exists customers(
            id integer AUTO_INCREMENT primary key, 
            name char(30) NOt null, phone integer 
            )""") 
# Sessions table
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
ps="red" 
def create_customer(name, phone):
    cur.execute(
        "INSERT INTO customers (name, phone) VALUES (%s, %s)",
        (name, phone)
    )
    paa.commit()
    return cur.lastrowid
def get_game_details(game_id):
    cur.execute("""
        SELECT g.name, g.console, r.rating, r.price_per_hour
        FROM games g
        JOIN rates r ON g.id = r.game_id
        WHERE g.id = %s
    """, (game_id,))
    return cur.fetchone()

from datetime import datetime

def start_session(customer_id, game_id):
    cur.execute("""
        INSERT INTO sessions (customer_id, game_id, start_time)
        VALUES (%s, %s, %s)
    """, (customer_id, game_id, datetime.now()))
    paa.commit()
    return cur.lastrowid

def end_session(session_id):
    cur.execute("""
        SELECT s.start_time, r.price_per_hour
        FROM sessions s
        JOIN rates r ON s.game_id = r.game_id
        WHERE s.id = %s
    """, (session_id,))
    
    start_time, price = cur.fetchone()
    end_time = datetime.now()
    
    hours = (end_time - start_time).total_seconds() / 3600
    total = round(hours * price, 2)

    cur.execute("""
        UPDATE sessions
        SET end_time = %s, total_amount = %s
        WHERE id = %s
    """, (end_time, total, session_id))
    
    paa.commit()
    return total

def get_all_games():
    cur.execute("""
        SELECT g.id, g.name, g.console, r.price_per_hour,r.rating
        FROM games g
        LEFT JOIN rates r ON g.id = r.game_id
    """)
    return cur.fetchall()

def admin_login(username, password):
    cur.execute(
        "SELECT password_hash FROM admin WHERE username=%s",
        (username,)
    )
    result = cur.fetchone()

    if result:
        stored_hash = result[0]
        return password == stored_hash   # later: use hashing
    return False

def add_game(name, console, price, rating):
    cur.execute(
        "INSERT INTO games (name, console) VALUES (%s, %s)",
        (name, console)
    )
    game_id = cur.lastrowid

    cur.execute(
        "INSERT INTO rates (game_id, price_per_hour, rating) VALUES (%s, %s, %s)",
        (game_id, price, rating)
    )

    paa.commit()

def discontinue_game(game_id):
    cur.execute(
        "UPDATE games SET status='INACTIVE' WHERE id=%s",
        (game_id,)
    )
    paa.commit()

def update_rating(game_id, new_rating):
    cur.execute(
        "UPDATE rates SET rating=%s WHERE game_id=%s",
        (new_rating, game_id)
    )
    paa.commit()

def update_price(game_id, new_price):
    cur.execute(
        "UPDATE rates SET price_per_hour=%s WHERE game_id=%s",
        (new_price, game_id)
    )
    paa.commit()

def handle_view_games():
    games = get_all_games()

    print("\nAvailable Games:")
    print("-" * 60)
    for g in games:
        print(f"ID: {g[0]} | {g[1]} | {g[2]} | ₹{g[3]} | Rating: {g[4]}")
    print("-" * 60)

def handle_start_session():
    name = input("Enter customer name: ")
    phone = input("Enter phone: ")
    game_id = int(input("Enter game ID: "))

    customer_id = create_customer(name, phone)
    session_id = start_session(customer_id, game_id)

    print("✅ Session started successfully")
    print("Session ID:", session_id)

def handle_end_session():
    session_id = int(input("Enter session ID: "))

    amount = end_session(session_id)

    print("💰 Total Bill: ₹", amount)

def admin_menu():
    while True:
        print("\n--- ADMIN MENU ---")
        print("1. Add Game")
        print("2. Discontinue Game")
        print("3. Update Rating")
        print("4. Update Price")
        print("5. Back")

        choice = input("Enter choice: ")

        if choice == "1":
            name = input("Game name: ")
            console = input("Console name: ")
            price = float(input("Price per hour: "))
            rating = int(input("Rating: "))
            add_game(name, console, price, rating)
            print("Game added successfully")

        elif choice == "2":
            game_id = int(input("Game ID: "))
            discontinue_game(game_id)
            print("Game discontinued")

        elif choice == "3":
            game_id = int(input("Game ID: "))
            rating = int(input("New rating: "))
            update_rating(game_id, rating)
            print("Rating updated")

        elif choice == "4":
            game_id = int(input("Game ID: "))
            price = float(input("New price: "))
            update_price(game_id, price)
            print("Price updated")

        elif choice == "5":
            break


def handle_admin_login():
    username = input("Enter admin username: ")
    password = input("Enter admin password: ")

    if admin_login(username, password):
        print("Login successful")
        admin_menu()
    else:
        print("Invalid credentials")

             
def main():
    while True:
        print("\n===== GAMING ZONE MANAGEMENT =====")
        print("1. Start Session")
        print("2. End Session")
        print("3. View Games")
        print("4. Admin Login")
        print("5. Exit")

        choice = input("Enter your choice: ")

        if choice == "1":
            handle_start_session()

        elif choice == "2":
            handle_end_session()

        elif choice == "3":
            handle_view_games()

        elif choice == "4":
            handle_admin_login()

        elif choice == "5":
            print("Exiting system...")
            break

        else:
            print("Invalid choice")

if __name__ == "__main__":
    main()
