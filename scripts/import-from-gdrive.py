import os
import sys
import json
import requests
from google.oauth2 import service_account
import google.auth.transport.requests

# Project paths
PROJECT_ROOT = "/opt/Ergomarket_content_factory/longevity-portal"
KEY_FILE = os.path.join(PROJECT_ROOT, "google-key.json")
FOLDER_ID = "11t8ffjk_LGQRouelfR28ZK2N3TWnRiDh"
IMPORT_URL = "http://127.0.0.1:3001/api/v1/import" # Local request bypasses routing/external network

# Status log file to remember imported file IDs (to prevent re-importing the same files)
HISTORY_FILE = os.path.join(PROJECT_ROOT, "imported_google_files.json")

def get_imported_history():
    if os.path.exists(HISTORY_FILE):
        try:
            with open(HISTORY_FILE, "r") as f:
                return json.load(f)
        except Exception:
            return []
    return []

def save_to_history(file_id):
    history = get_imported_history()
    if file_id not in history:
        history.append(file_id)
        with open(HISTORY_FILE, "w") as f:
            json.dump(history, f)

def get_drive_service():
    scopes = ['https://www.googleapis.com/auth/drive.readonly']
    creds = service_account.Credentials.from_service_account_file(KEY_FILE, scopes=scopes)
    return creds

def get_gdrive_headers(creds):
    auth_req = google.auth.transport.requests.Request()
    creds.refresh(auth_req)
    return {"Authorization": f"Bearer {creds.token}"}

def main():
    print("=== Google Drive Auto Import Job Started ===")
    
    if not os.path.exists(KEY_FILE):
        print(f"Error: Credentials key file not found at {KEY_FILE}")
        sys.exit(1)
        
    try:
        creds = get_drive_service()
        headers = get_gdrive_headers(creds)
        
        # 1. Query files in folder (mimeType is json and trashed=false), sorted by modifiedTime desc
        query = f"'{FOLDER_ID}' in parents and mimeType = 'application/json' and trashed = false"
        url = f"https://www.googleapis.com/drive/v3/files?q={query}&orderBy=modifiedTime desc&fields=files(id, name, modifiedTime)"
        
        res = requests.get(url, headers=headers)
        if res.status_code != 200:
            print(f"Error fetching files from Google Drive API: {res.text}")
            sys.exit(1)
            
        data = res.json()
        files = data.get("files", [])
        
        if not files:
            print("No JSON files found in Google Drive folder.")
            sys.exit(0)
            
        # 2. Get the latest modified file
        latest_file = files[0]
        file_id = latest_file["id"]
        file_name = latest_file["name"]
        print(f"Latest file found: {file_name} (ID: {file_id}, Modified: {latest_file['modifiedTime']})")
        
        # 3. Check if we already imported this file
        history = get_imported_history()
        if file_id in history:
            print(f"File {file_name} ({file_id}) has already been imported. Skipping.")
            sys.exit(0)
            
        # 4. Download file content
        download_url = f"https://www.googleapis.com/drive/v3/files/{file_id}?alt=media"
        dl_res = requests.get(download_url, headers=headers)
        if dl_res.status_code != 200:
            print(f"Error downloading file {file_name}: {dl_res.text}")
            sys.exit(1)
            
        try:
            payload = dl_res.json()
        except ValueError:
            print("Downloaded file content is not valid JSON.")
            sys.exit(1)
            
        # 5. Extract API key from .env.local if not present in payload
        # (This allows Claude to generate json without needing to know the API key)
        if "apiKey" not in payload or not payload["apiKey"]:
            # Extract supabase service role key to use as API Key
            env_file = os.path.join(PROJECT_ROOT, ".env.local")
            service_key = None
            if os.path.exists(env_file):
                with open(env_file, "r") as ef:
                    for line in ef:
                        if line.startswith("SUPABASE_SERVICE_ROLE_KEY="):
                            service_key = line.split("=", 1)[1].strip().strip('"').strip("'")
                            break
            if service_key:
                payload["apiKey"] = service_key
            else:
                payload["apiKey"] = "VPNTaskbot!2026"
                
        # 6. Post to local API import endpoint
        print(f"Importing contents of {file_name} into local platform database...")
        import_res = requests.post(IMPORT_URL, json=payload, headers={"Content-Type": "application/json"})
        
        print(f"API Response status: {import_res.status_code}")
        print(f"API Response body: {import_res.text}")
        
        if import_res.status_code == 200:
            import_data = import_res.json()
            if import_data.get("success"):
                save_to_history(file_id)
                print(f"Successfully imported {import_data.get('importedCount')} posts!")
            else:
                print(f"Platform returned unsuccessful status: {import_data.get('error')}")
        else:
            print("Import failed.")
            
    except Exception as e:
        print(f"Critical error during import job: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()
