# IoT Device Monitor

A real-time dashboard that brings every IoT device into one view, so you can track their readings and spot abnormal values at a glance.

![IoT Device Monitor dashboard](docs/dashboard.png)

## What it does

- Shows the latest temperature, humidity and pressure from each device, with a bar and a threshold tick on every metric
- Flags readings that go over their limit (amber highlight, red value)
- Keeps a reading log, newest first, that you can filter by metric and by number of readings
- Summarises the fleet: online devices, readings shown, readings over limit, newest reading time
- Refreshes every 5 seconds and shows a clear message when the API can't be reached

## How it works

```
Python simulator ──MQTT──> broker ──MQTT──> subscriber ──> SQLite ──> FastAPI ──HTTP──> React dashboard
```

| Part | Tech | File |
| --- | --- | --- |
| Simulated devices (6 of them) | Python, paho-mqtt | `backend/simulator/device_simulator.py` |
| MQTT subscriber, saves every message | Python, paho-mqtt, SQLite | `backend/mqtt_subscriber.py` |
| REST API | FastAPI | `backend/main.py` |
| Dashboard | React (Create React App) | `frontend/dashboard/` |

Each device publishes a JSON payload every 5 seconds to `iot/devices/<id>/all`:

```json
{"device": 1, "temperature": 24.93, "humidity": 82.23, "pressure": 907.68, "timestamp": "2025-09-25 12:13:35"}
```

The subscriber listens on `iot/devices/+/all` and stores each message in the `device_state` table, with the metrics kept as a JSON string. New metrics show up in the dashboard without any code change.

## Getting started

You need Python 3.10+ and Node.js 18+.

### 1. Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install fastapi uvicorn "paho-mqtt<2"
```

`paho-mqtt` must be below version 2, because the scripts use the older `mqtt.Client()` constructor.

Open three terminals in the `backend` folder, with the virtual environment active in each:

```bash
# Terminal 1: API on http://127.0.0.1:8000
uvicorn main:app --reload

# Terminal 2: listens for MQTT messages and saves them
python mqtt_subscriber.py

# Terminal 3: simulated devices
python simulator/device_simulator.py
```

The database file (`iot_db.db`) is created automatically on first run.

### 2. Frontend

```bash
cd frontend/dashboard
npm install
npm start
```

Open http://localhost:3000. Readings appear within a few seconds of the simulator starting.

## API

The API runs on port 8000 and allows requests from `localhost:3000`.

| Endpoint | Description |
| --- | --- |
| `GET /devices` | Device IDs that have reported data |
| `GET /metrics` | Metric names found in the stored readings |
| `GET /data?limit=10` | Latest readings, newest first |
| `GET /data?limit=10&metric=temperature` | Same, but only one metric |
| `GET /data?device=3` | Readings from one device |

Interactive docs are available at http://127.0.0.1:8000/docs.

## Alert thresholds

Set in `frontend/dashboard/src/App.js` (`isAboveNormal`):

| Metric | Over limit when |
| --- | --- |
| Temperature | above 30 °C |
| Pressure | above 101325 Pa |

Humidity has no alert. The simulator produces pressure values between 800 and 1220, so the pressure threshold is never reached with simulated data. Adjust it if your sensors report in a different unit.

## Project structure

```
.
├── backend/
│   ├── main.py                  # FastAPI app
│   ├── mqtt_subscriber.py       # MQTT -> SQLite
│   ├── simulator/
│   │   └── device_simulator.py  # fake devices
│   └── src/db/connection.py     # SQLite connection and tables
├── frontend/dashboard/
│   └── src/
│       ├── App.js               # dashboard logic and layout
│       └── App.css              # styles
└── docs/dashboard.png
```

## Notes

- The simulator and subscriber use the public broker `broker.hivemq.com`, which anyone can publish to. For anything beyond a demo, run your own broker (for example Mosquitto) and change `broker` in both scripts.
- The API address (`http://127.0.0.1:8000`) is set at the top of `frontend/dashboard/src/App.js`.
- `docker-compose.yml` is a work in progress and doesn't run yet, because the backend has no working Dockerfile.

## Ideas for next steps

- Charts of each metric over time
- Alert notifications (email or chat) when a device goes over its limit
- Real devices publishing instead of the simulator
- Authentication on the MQTT broker and the API
