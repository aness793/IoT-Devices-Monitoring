import os
import sqlite3
import paho.mqtt.client as mqtt
from datetime import datetime
import json
# Dynamically resolve the database path relative to this file
# Use the same DB file as the API (backend/iot_db.db)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.abspath(os.path.join(BASE_DIR, 'iot_db.db'))
# Connect and ensure tables exist
conn = sqlite3.connect(DB_PATH, check_same_thread=False)
cursor = conn.cursor()
cursor.execute("""
    CREATE TABLE IF NOT EXISTS device_state (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device TEXT,
        data TEXT, -- store all metrics as JSON string
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
""")
cursor.execute("""
    CREATE TABLE IF NOT EXISTS devices (
        id INTEGER PRIMARY KEY
    )
""")
conn.commit()
# MQTT config
broker = 'broker.hivemq.com'
port = 1883
topic = "iot/devices/+/all"  # subscribe to the correct topic for all metrics
# Callback when a message arrives
def on_message(client, userdata, msg):
    try:
        payload = json.loads(msg.payload.decode())
        device = payload.get("device")
        timestamp = payload.get("timestamp", datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
        # remove device and timestamp fields from the JSON, keep only metrics
        metrics = {k: v for k, v in payload.items() if k not in ("device", "timestamp")}
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO device_state (device, data, timestamp) VALUES (?, ?, ?)",
            (device, json.dumps(metrics), timestamp)
        )
        conn.commit()
        print(f"Saved: Device: {device}, Metrics: {metrics}, Timestamp: {timestamp}")
    except Exception as e:
        print(f"Error processing message: {e}\nPayload: {msg.payload}")

print('working...')

# Setup MQTT client
client = mqtt.Client()
client.on_message = on_message
client.connect(broker, port)
client.subscribe(topic)
print(f"Listening on topic: {topic}...")
client.loop_forever()
