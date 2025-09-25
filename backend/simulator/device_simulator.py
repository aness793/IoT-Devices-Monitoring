import time, random
import datetime
import paho.mqtt.client as mqtt
client = mqtt.Client()
import json
broker = 'broker.hivemq.com'
port  = 1883


client.connect(broker,port)
while True:
    for id in range(1,7):
        metrics = {
            "device": id,
            "temperature": random.uniform(20, 50),
            "humidity": random.uniform(0, 100),
            "pressure": random.uniform(800, 1220)
        }
        metrics["timestamp"] = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        payload = json.dumps(metrics)
        client.publish(f'iot/devices/{id}/all', payload)
        print(f"Published to iot/devices/{id}/all: {payload}")
        time.sleep(5)
        # client.publish(f'iot/devices/{id}/temperature', f'{temp:.2f}')
        # client.publish(f'iot/devices/{id}/humidity', f'{hum}')
        # client.publish(f'iot/devices/{id}/battery', f'{battery}')
        # print(f'temperature: {temp:.2f}°C published to topic: iot/devices/{id}/temperature')
        # print(f'humidity: {temp:.2f}% published to topic: iot/devices/{id}/humidity')
        # print(f'battery: {temp:.2f}% published to topic: iot/devices/{id}/battery')