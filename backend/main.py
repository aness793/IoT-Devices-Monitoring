"""
API endpoints for IoT Device Network Monitor backend.
Provides endpoints to insert and retrieve device data using FastAPI.
"""
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from src.db.connection import conn
import json
app = FastAPI()


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- POST (insert new reading) ---
# @app.post("/data")
# async def post_data(request: Request):
#     data = await request.json()
#     value = data.get("value")
#     timestamp = data.get("timestamp")  # simulator sends timestamp
#     cursor = conn.cursor()
#     cursor.execute(
#         "INSERT INTO state (device, metric, value, timestamp) VALUES (?, ?, ?, ?)",
#         (data.get("device"), data.get("metric"), value, timestamp),
#     )
#     conn.commit()
#     cursor.close()
#     return {"status": "success", "inserted": data}



# --- GET (fetch recent readings) ---

# List all device IDs
@app.get('/devices')
def get_devices():
    cursor = conn.cursor()
    cursor.execute('SELECT DISTINCT device FROM device_state ORDER BY device')
    rows = cursor.fetchall()
    cursor.close()
    return [r[0] for r in rows]

# @app.get("/metrics/{metric}")
# def get_metric(metric: str = "temperature"):
#     cursor = conn.cursor()
#     cursor.execute("""
#                     SELECT device,metric,value,timestamp from state where metric=? order by metric 
#                    """, (metric,) )
#     rows = cursor.fetchall()
#     cursor.close()
#     if rows:
#         return [{"device": r[0], "metric": r[1],"value":r[2],"timestamp":r[3]} for r in rows]
#     else:
#         return "metric does not exist"
from typing import Optional
@app.get("/data")
def filtered_data(device: Optional[str] = None, metric: Optional[str] = None, limit: int = 10):
    query = "SELECT device, data, timestamp FROM device_state"
    conditions = []
    params = []

    if device is not None:
        conditions.append("device = ?")
        params.append(device)

    if conditions:
        query += " WHERE " + " AND ".join(conditions)

    query += " ORDER BY timestamp DESC ,device ASC LIMIT ?"
    params.append(limit)

    cursor = conn.cursor()
    cursor.execute(query, tuple(params))
    rows = cursor.fetchall()
    cursor.close()

    results = []
    for r in rows:
        try:
            data = json.loads(r[1])  # convert JSON string back to dict
        except Exception as e:
            print(f"Error decoding JSON for row {r}: {e}")
            continue
        if metric:
            value = data.get(metric, None)
            if value is not None:
                results.append({
                    "device": r[0],
                    "metric": metric,
                    "value": value,
                    "timestamp": r[2]
                })
        else:
            results.append({
                "device": r[0],
                "data": data,
                "timestamp": r[2]
            })

    if not results:
        print("/data endpoint: No results found for query.")
    return results


@app.get("/metrics")
def list_metrics(device: Optional[str] = None, limit: int = 1000):
    """
    Return unique metric keys found in the JSON `data` column.
    Optional filter by `device`. Limits number of rows scanned for performance.
    """
    query = "SELECT data FROM device_state"
    params = []
    if device is not None:
        query += " WHERE device = ?"
        params.append(device)
    query += " ORDER BY timestamp DESC LIMIT ?"
    params.append(limit)

    cursor = conn.cursor()
    cursor.execute(query, tuple(params))
    rows = cursor.fetchall()
    cursor.close()

    keys = set()
    for (data_json,) in rows:
        try:
            data = json.loads(data_json)
            if isinstance(data, dict):
                keys.update(data.keys())
        except Exception as e:
            print(f"/metrics endpoint: Error decoding JSON: {e}")
            continue

    return sorted(keys)
