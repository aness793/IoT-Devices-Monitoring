"""
datab base and conn
"""
import os
import sqlite3 as sql
import json

# Dynamically resolve the database path relative to this file
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.abspath(os.path.join(BASE_DIR, '..', '..', 'iot_db.db'))
conn = sql.connect(DB_PATH, check_same_thread=False)
cursor = conn.cursor()
cursor.execute("""
               CREATE TABLE IF NOT EXISTS device_state (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device TEXT,
    data TEXT, -- store all metrics as JSON string
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);
               """)

cursor.execute("""
               CREATE TABLE IF NOT EXISTS devices (
                    id INTEGER PRIMARY KEY
               )
               """)

def state_insert(device, metrics_dict, timestamp=None):
    import datetime
    if timestamp is None:
        timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    cursor.execute(
        'INSERT INTO device_state (device, data, timestamp) VALUES (?, ?, ?)',
        (device, json.dumps(metrics_dict), timestamp)
    )
    cursor.execute('INSERT OR IGNORE INTO devices (id) VALUES (?) ', (device,))
    conn.commit()
