import json
import requests

# Read the trace file
with open(r"C:\Optimotive-dev\OptiDiagFlow\ExamplesForClaude\TraceLogsComplete\Landrover\Defender\2020\Camera Calibration\8873778.txt", "r") as f:
    trace_content = f.read()

# Prepare the job data
job_data = {
    "name": "Land Rover Defender Camera Calibration - Full Trace",
    "jobType": "DIAGNOSTIC",
    "vehicleModelYearId": "cmfochyq60004uczcty2z5o8a",  # Land Rover Defender 2020 ID
    "vin": "SALWA2AN7L1234567",
    "traceFiles": [
        {
            "name": "8873778.txt",
            "content": trace_content
        }
    ]
}

# Send POST request
response = requests.post(
    "http://localhost:6001/api/jobs",
    json=job_data,
    headers={"Content-Type": "application/json"}
)

# Print result
if response.status_code == 201:
    result = response.json()
    print(f"Job created successfully!")
    print(f"Job ID: {result['id']}")
    print(f"Job Name: {result['name']}")
    print(f"Message Count: {result.get('messageCount', 'Processing...')}")
else:
    print(f"Failed to create job: {response.status_code}")
    print(response.text)