# 🚀 Mathrubhumi — Complete Windows Server Deployment Guide

**Last Updated:** 2026-03-13  
**For:** Deploying the Mathrubhumi application on a Windows Server in a LAN environment  
**Audience:** Anyone with basic computer skills — every single step is explained

---

## Table of Contents

1. [What Are We Building?](#1-what-are-we-building)
2. [What You Need Before Starting](#2-what-you-need-before-starting)
3. [Phase 1: Install Software on the Server](#phase-1-install-software-on-the-server)
4. [Phase 2: Get the Project Code](#phase-2-get-the-project-code)
5. [Phase 3: Set Up the Database](#phase-3-set-up-the-database)
6. [Phase 4: Set Up the Backend (Django)](#phase-4-set-up-the-backend-django)
7. [Phase 5: Set Up the Frontend (React)](#phase-5-set-up-the-frontend-react)
8. [Phase 6: Set Up Nginx (Web Server)](#phase-6-set-up-nginx-web-server)
9. [Phase 7: Make Everything Start Automatically](#phase-7-make-everything-start-automatically)
10. [Phase 8: Configure Windows Firewall](#phase-8-configure-windows-firewall)
11. [Phase 9: Testing from All Branches](#phase-9-testing-from-all-branches)
12. [Phase 10: Set Up Automatic Backups](#phase-10-set-up-automatic-backups)
13. [Common Operations Reference](#common-operations-reference)
14. [Troubleshooting](#troubleshooting)
15. [Pre-Handover Checklist](#pre-handover-checklist)

---

## 1. What Are We Building?

The Mathrubhumi application is a book distribution management system with three parts:

```
┌─────────────────────────────────────────────────────────────────┐
│                     CLIENT'S NETWORK (LAN)                      │
│                                                                  │
│   Branch 1 PC ─┐                                                │
│   Branch 2 PC ─┤                    ┌──────────────────────┐    │
│   Branch 3 PC ─┼── Open browser ──► │   PRODUCTION SERVER  │    │
│   Branch 4 PC ─┤   http://SERVER_IP │                      │    │
│   Branch N PC ─┘                    │  ┌──────────────┐    │    │
│                                      │  │    Nginx     │    │    │
│                                      │  │  (Port 80)   │    │    │
│                                      │  └──┬───────┬───┘    │    │
│                                      │     │       │         │    │
│                                      │     ▼       ▼         │    │
│                                      │ ┌───────┐ ┌───────┐  │    │
│                                      │ │Django │ │React  │  │    │
│                                      │ │Backend│ │Build  │  │    │
│                                      │ │(8000) │ │(files)│  │    │
│                                      │ └───┬───┘ └───────┘  │    │
│                                      │     │                 │    │
│                                      │     ▼                 │    │
│                                      │ ┌───────────┐        │    │
│                                      │ │PostgreSQL │        │    │
│                                      │ │  Database │        │    │
│                                      │ │  (5432)   │        │    │
│                                      │ └───────────┘        │    │
│                                      └──────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

**In simple terms:**
- **PostgreSQL** = The database where all the data is stored (books, sales, customers, etc.)
- **Django Backend** = The "brain" of the app — handles login, saves sales, generates reports
- **React Frontend** = The "face" of the app — what users see in their browser
- **Nginx** = The "traffic controller" — directs browser requests to the right place

Every branch on the network opens a browser, types the server's IP address, and uses the app. No software needs to be installed on branch computers — just a browser.

---

## 2. What You Need Before Starting

### Hardware/Network Info to Collect

| Item | What it means | Example | Where to get it |
|------|---------------|---------|-----------------|
| Server IP address | The network address of the server | `192.168.1.100` | Run `ipconfig` on the server |
| Admin access | You need admin rights on the server | Username + password | Client IT team |
| Network subnet | The IP range of all branches | `192.168.1.0/24` | Client IT team |
| Internet access | Needed ONLY during setup to download software | Temporary is fine | Client IT team |

### Software You'll Download (All Free)

| Software | Version | What it does | Download Link |
|----------|---------|-------------|---------------|
| Git | Latest | Downloads the project code | https://git-scm.com/download/win |
| Python | 3.12+ | Runs the backend server | https://www.python.org/downloads/ |
| Node.js | 20 LTS | Builds the frontend | https://nodejs.org/ |
| PostgreSQL | 16+ | The database | https://www.postgresql.org/download/windows/ |
| Nginx | Latest | Web server / traffic controller | https://nginx.org/en/download.html |
| NSSM | Latest | Makes programs run as Windows Services | https://nssm.cc/download |

> **TIP:** Download all of these onto a USB drive BEFORE going to the client site, in case the server has limited internet.

---

## Phase 1: Install Software on the Server

### Step 1.1 — Find the Server's IP Address

1. Press `Win + R`, type `cmd`, press Enter
2. Type this command and press Enter:
   ```
   ipconfig
   ```
3. Look for the line that says **IPv4 Address** under the active network adapter
4. Write this IP address down. Example: `192.168.1.100`
5. This is the **SERVER_IP** — you'll use it throughout this guide

> **IMPORTANT:** Wherever you see `SERVER_IP` in this guide, replace it with the actual IP address from this step.

---

### Step 1.2 — Install Git

1. Download Git from https://git-scm.com/download/win
2. Run the installer
3. **Click "Next" for everything** — all default settings are fine
4. On the "Adjusting your PATH" screen, make sure **"Git from the command line and also from 3rd-party software"** is selected
5. Finish the installation

**Verify it works:**
```
Open Command Prompt (Win + R → cmd → Enter)
Type: git --version
Expected output: git version 2.x.x
```

---

### Step 1.3 — Install Python

1. Download Python from https://www.python.org/downloads/
2. Run the installer
3. ⚠️ **CRITICAL:** On the FIRST screen, check the box that says **"Add Python to PATH"** at the bottom
4. Click **"Install Now"**
5. After installation, click **"Disable path length limit"** if it appears
6. Finish the installation

**Verify it works:**
```
Close and reopen Command Prompt
Type: python --version
Expected output: Python 3.12.x (or similar)

Type: pip --version
Expected output: pip 24.x.x (or similar)
```

> **If `python` doesn't work**, try `python3` instead. If neither works, Python wasn't added to PATH — reinstall and check the PATH checkbox.

---

### Step 1.4 — Install Node.js

1. Download Node.js **LTS** version from https://nodejs.org/
2. Run the installer
3. Click "Next" for everything — all defaults are fine
4. Finish the installation

**Verify it works:**
```
Close and reopen Command Prompt
Type: node --version
Expected output: v20.x.x

Type: npm --version
Expected output: 10.x.x
```

---

### Step 1.5 — Install PostgreSQL

1. Download the PostgreSQL installer from https://www.postgresql.org/download/windows/
2. Click **"Download the installer"** (by EDB)
3. Run the installer
4. Follow the wizard:
   - **Installation directory:** Keep the default (e.g., `C:\Program Files\PostgreSQL\16`)
   - **Components:** Keep all checked (PostgreSQL Server, pgAdmin 4, Stack Builder, Command Line Tools)
   - **Data directory:** Keep the default
   - **Password:** ⚠️ **Set a strong password for the `postgres` superuser**. Write it down!
     - Example: `Mathrubhumi@DB2026`
   - **Port:** Keep the default `5432`
   - **Locale:** Keep the default
5. Click "Next" until installation completes
6. Uncheck "Launch Stack Builder" at the end — you don't need it

**Verify it works:**
```
Open Command Prompt
Type: psql --version
Expected output: psql (PostgreSQL) 16.x
```

> **If `psql` doesn't work:** You need to add PostgreSQL to PATH:
> 1. Search for "Environment Variables" in Windows Start
> 2. Click "Edit the system environment variables" → "Environment Variables"
> 3. Under "System variables", find `Path`, click "Edit"
> 4. Click "New" and add: `C:\Program Files\PostgreSQL\16\bin`
> 5. Click OK on all dialogs
> 6. Close and reopen Command Prompt

---

### Step 1.6 — Download Nginx

Nginx on Windows doesn't have an installer — it's just a zip file.

1. Download from https://nginx.org/en/download.html (get the **Stable** Windows version)
2. Extract the zip file to `C:\nginx`
3. You should now have `C:\nginx\nginx.exe`

**Verify it works:**
```
Open Command Prompt
Type: C:\nginx\nginx.exe -v
Expected output: nginx/1.x.x
```

---

### Step 1.7 — Download NSSM (Service Manager)

NSSM lets us make programs start automatically when Windows boots.

1. Download from https://nssm.cc/download (get the latest release)
2. Extract the zip
3. Inside the folder, find the `win64` directory
4. Copy `nssm.exe` from the `win64` folder to `C:\nssm\nssm.exe`
5. Add `C:\nssm` to your system PATH (same process as Step 1.5 note)

**Verify it works:**
```
Close and reopen Command Prompt
Type: nssm version
Expected output: NSSM x.x.x ...
```

---

## Phase 2: Get the Project Code

### Step 2.1 — Create the Project Folder

```
Open Command Prompt as Administrator (right-click → Run as administrator)
Type these commands one by one:

mkdir C:\mathrubhumi
cd C:\mathrubhumi
```

### Step 2.2 — Clone the Repository

```
git clone YOUR_REPOSITORY_URL .
```

> Replace `YOUR_REPOSITORY_URL` with your actual Git repository URL. For example:
> ```
> git clone https://github.com/your-username/mathrubhumi.git .
> ```
> The `.` at the end means "clone into the current directory".

After cloning, you should have:
```
C:\mathrubhumi\
├── mathrubhumi-backend\     ← Django backend
├── mathrubhumi-frontend\    ← React frontend
├── .gitignore
└── ...
```

**Verify:**
```
dir C:\mathrubhumi
```
You should see both `mathrubhumi-backend` and `mathrubhumi-frontend` folders.

---

## Phase 3: Set Up the Database

### Step 3.1 — Open PostgreSQL Command Line

```
Open Command Prompt
Type: psql -U postgres
Enter the password you set during PostgreSQL installation
```

You should see a `postgres=#` prompt.

### Step 3.2 — Create the Application Database and User

Type these SQL commands one at a time inside the PostgreSQL prompt:

```sql
-- Create a dedicated user for the application
CREATE USER mathrubhumi_user WITH PASSWORD 'ChooseAStrongPassword123!';

-- Create the database
CREATE DATABASE mathrubhumi OWNER mathrubhumi_user;

-- Grant all privileges
GRANT ALL PRIVILEGES ON DATABASE mathrubhumi TO mathrubhumi_user;

-- Exit PostgreSQL
\q
```

> ⚠️ **Replace** `ChooseAStrongPassword123!` **with a strong password of your choice.** Write it down — you'll need it in Phase 4.

### Step 3.3 — Verify the Database was Created

```
psql -U mathrubhumi_user -d mathrubhumi
```
Enter the password you just set. If you see `mathrubhumi=>` prompt, it worked. Type `\q` to exit.

> **The database is currently empty.** We'll populate it with tables using Django migrations in Phase 4.

---

## Phase 4: Set Up the Backend (Django)

### Step 4.1 — Create a Python Virtual Environment

A virtual environment is an isolated space for the project's Python packages, so they don't interfere with other programs on the server.

```
cd C:\mathrubhumi\mathrubhumi-backend
python -m venv .venv
```

### Step 4.2 — Activate the Virtual Environment

```
.venv\Scripts\activate
```

Your command prompt should now show `(.venv)` at the beginning of the line. This means you're inside the virtual environment.

> **Every time** you need to run backend commands, you must activate the virtual environment first with this command.

### Step 4.3 — Install Python Dependencies

```
pip install --upgrade pip
pip install -r requirements.txt
pip install waitress
```

**What is waitress?** It's the Windows-compatible server that runs Django in production. The project includes `gunicorn` in requirements.txt, but gunicorn only works on Linux. `waitress` is the Windows equivalent.

### Step 4.4 — Create the Environment Configuration File

The `.env` file contains all the secret settings (passwords, keys, etc.). It is NEVER uploaded to Git.

1. Open Notepad (or any text editor)
2. Paste the following content, **replacing the placeholder values**:

```
# =============================================
# MATHRUBHUMI PRODUCTION ENVIRONMENT CONFIG
# =============================================

# Secret Key — Generate one using the command below, then paste it here
# python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
DJANGO_SECRET_KEY=PASTE_YOUR_GENERATED_KEY_HERE

# Must be false on the production server  
DJANGO_DEBUG=false

# Server's LAN IP address (the one you found in Step 1.1)
DJANGO_ALLOWED_HOSTS=SERVER_IP,localhost,127.0.0.1

# Database credentials (must match what you set in Step 3.2)
DB_NAME=mathrubhumi
DB_USER=mathrubhumi_user
DB_PASSWORD=ChooseAStrongPassword123!
DB_HOST=localhost
DB_PORT=5432

# CORS — tells the backend to accept requests from the frontend
DJANGO_CORS_ALLOW_ALL_ORIGINS=false
DJANGO_CORS_ALLOW_CREDENTIALS=true
DJANGO_CORS_ALLOWED_ORIGINS=http://SERVER_IP

# CSRF trusted origins
DJANGO_CSRF_TRUSTED_ORIGINS=http://SERVER_IP

# Since this is HTTP on a private LAN (no internet SSL), disable SSL settings
DJANGO_SECURE_SSL_REDIRECT=false
DJANGO_SESSION_COOKIE_SECURE=false
DJANGO_CSRF_COOKIE_SECURE=false
DJANGO_SECURE_HSTS_SECONDS=0
```

3. Save this file as `.env` in `C:\mathrubhumi\mathrubhumi-backend\.env`

> ⚠️ **When saving in Notepad:**
> - In the "Save as type" dropdown, select **"All Files (*.*)"**
> - Type the filename as `.env` (with the dot at the beginning)
> - Make sure it doesn't save as `.env.txt`

### Step 4.5 — Generate the Secret Key

```
cd C:\mathrubhumi\mathrubhumi-backend
.venv\Scripts\activate
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

This will print a long random string. **Copy it** and paste it into the `.env` file as the `DJANGO_SECRET_KEY` value.

### Step 4.6 — Replace SERVER_IP in the .env File

Open the `.env` file and replace every `SERVER_IP` with the actual IP address from Step 1.1.

For example, if your server IP is `192.168.1.100`:
- `DJANGO_ALLOWED_HOSTS=192.168.1.100,localhost,127.0.0.1`
- `DJANGO_CORS_ALLOWED_ORIGINS=http://192.168.1.100`
- `DJANGO_CSRF_TRUSTED_ORIGINS=http://192.168.1.100`

### Step 4.7 — Run Database Migrations

Migrations create all the tables, columns, and database functions that the application needs.

```
cd C:\mathrubhumi\mathrubhumi-backend
.venv\Scripts\activate

python manage.py migrate
```

You should see output like:
```
Operations to perform:
  Apply all migrations: accounts, admin, auth, contenttypes, sessions, token_blacklist
Running migrations:
  Applying contenttypes.0001_initial... OK
  Applying accounts.0001_initial... OK
  Applying accounts.0002_create_mathrubhumi_tables... OK
  ... (many more OK lines)
```

> **Every line should say OK.** If any line shows an error, stop and fix it before proceeding.

### Step 4.8 — Create Database Functions

The application uses custom PostgreSQL functions for reports. Create them:

```
python manage.py create_db_functions
```

### Step 4.9 — Collect Static Files

Django admin panel needs its CSS and JavaScript files collected into one place:

```
python manage.py collectstatic --noinput
```

### Step 4.10 — Create the First Admin/Superuser

```
python manage.py createsuperuser
```

Follow the prompts to enter an email and password for the admin account.

### Step 4.11 — Test the Backend

```
cd C:\mathrubhumi\mathrubhumi-backend
.venv\Scripts\activate
python -m waitress --host=127.0.0.1 --port=8000 backend.wsgi:application
```

Open a **new** Command Prompt window and type:
```
curl http://127.0.0.1:8000/health/
```

You should see: `{"status": "healthy", ...}`

**If it works**, go back to the first Command Prompt and press `Ctrl + C` to stop the test server.

---

## Phase 5: Set Up the Frontend (React)

### Step 5.1 — Install Frontend Dependencies

```
cd C:\mathrubhumi\mathrubhumi-frontend
npm install
```

This will download all the JavaScript libraries the frontend needs. It may take a few minutes.

### Step 5.2 — Configure the API URL

The React app needs to know where to send API requests. Create a production config file:

1. Open Notepad
2. Type this single line (replace SERVER_IP with actual IP from Step 1.1):

```
REACT_APP_API_BASE_URL=http://SERVER_IP/api/
```

3. Save it as `.env.production` in `C:\mathrubhumi\mathrubhumi-frontend\.env.production`

> **Example:** If your server IP is `192.168.1.100`:
> ```
> REACT_APP_API_BASE_URL=http://192.168.1.100/api/
> ```

### Step 5.3 — Build the Frontend

```
cd C:\mathrubhumi\mathrubhumi-frontend
npm run build
```

This creates an optimized production build in `C:\mathrubhumi\mathrubhumi-frontend\build\`.

**Verify the build was successful:**
```
dir C:\mathrubhumi\mathrubhumi-frontend\build
```

You should see `index.html`, a `static` folder, and other files.

> **What does "build" mean?** The React source code gets compiled into plain HTML, CSS, and JavaScript files that any browser can understand. These files are what Nginx will serve to the branches.

---

## Phase 6: Set Up Nginx (Web Server)

Nginx is the "front door" of the application. It:
- Serves the React frontend files to browsers
- Forwards API requests to the Django backend
- Handles multiple branch connections efficiently

### Step 6.1 — Configure Nginx

1. Open Notepad **as Administrator**
2. Open the file `C:\nginx\conf\nginx.conf`
3. **Delete everything** in the file
4. Paste the following configuration (replace `SERVER_IP` with your actual IP):

```nginx
worker_processes  auto;

events {
    worker_connections  1024;
}

http {
    include       mime.types;
    default_type  application/octet-stream;
    sendfile      on;
    keepalive_timeout  65;

    # Gzip compression — makes pages load faster for branches
    gzip  on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript;
    gzip_min_length 256;

    server {
        listen       80;
        server_name  SERVER_IP;

        # Maximum file upload size
        client_max_body_size 10M;

        # ── API requests → Django Backend ──
        location /api/ {
            proxy_pass http://127.0.0.1:8000;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_connect_timeout 60s;
            proxy_read_timeout 120s;
        }

        # ── Health check → Django Backend ──
        location /health/ {
            proxy_pass http://127.0.0.1:8000;
            proxy_set_header Host $host;
        }

        # ── Django Admin panel → Django Backend ──
        location /admin/ {
            proxy_pass http://127.0.0.1:8000;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }

        # ── Django static files (admin panel CSS/JS) ──
        location /static/ {
            alias C:/mathrubhumi/mathrubhumi-backend/staticfiles/;
            expires 30d;
        }

        # ── React Frontend (everything else) ──
        location / {
            root C:/mathrubhumi/mathrubhumi-frontend/build;
            index index.html;
            try_files $uri $uri/ /index.html;
        }

        # ── Cache static assets (JS, CSS, images) ──
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            root C:/mathrubhumi/mathrubhumi-frontend/build;
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
}
```

5. Save the file

> **IMPORTANT:** Replace `SERVER_IP` in the `server_name` line with your actual server IP (e.g., `192.168.1.100`).

### Step 6.2 — Test the Nginx Configuration

```
C:\nginx\nginx.exe -t
```

You should see:
```
nginx: configuration file C:\nginx/conf/nginx.conf syntax is ok
nginx: configuration file C:\nginx/conf/nginx.conf test is successful
```

If you see any errors, double-check the paths and file contents.

---

## Phase 7: Make Everything Start Automatically

When the server restarts (power outage, Windows Update, etc.), we need the application to start automatically. We'll use **NSSM** to create Windows Services.

### Step 7.1 — Create the Django Backend Service

Open Command Prompt **as Administrator** and run:

```
nssm install MathrubhumiBackend
```

A GUI window will appear. Fill in the fields:

| Tab | Field | Value |
|-----|-------|-------|
| **Application** | Path | `C:\mathrubhumi\mathrubhumi-backend\.venv\Scripts\python.exe` |
| **Application** | Startup directory | `C:\mathrubhumi\mathrubhumi-backend` |
| **Application** | Arguments | `-m waitress --host=127.0.0.1 --port=8000 backend.wsgi:application` |
| **Details** | Display name | `Mathrubhumi Backend` |
| **Details** | Description | `Mathrubhumi Django Backend Server` |
| **I/O** | Output (stdout) | `C:\mathrubhumi\logs\backend-stdout.log` |
| **I/O** | Error (stderr) | `C:\mathrubhumi\logs\backend-stderr.log` |
| **Environment** | Environment variables | (See below) |

For the **Environment** tab, add all the variables from your `.env` file in this format:
```
DJANGO_SECRET_KEY=your_key_here
DJANGO_DEBUG=false
DJANGO_ALLOWED_HOSTS=192.168.1.100,localhost,127.0.0.1
DB_NAME=mathrubhumi
DB_USER=mathrubhumi_user
DB_PASSWORD=your_password_here
DB_HOST=localhost
DB_PORT=5432
DJANGO_CORS_ALLOW_ALL_ORIGINS=false
DJANGO_CORS_ALLOW_CREDENTIALS=true
DJANGO_CORS_ALLOWED_ORIGINS=http://192.168.1.100
DJANGO_CSRF_TRUSTED_ORIGINS=http://192.168.1.100
DJANGO_SECURE_SSL_REDIRECT=false
DJANGO_SESSION_COOKIE_SECURE=false
DJANGO_CSRF_COOKIE_SECURE=false
DJANGO_SECURE_HSTS_SECONDS=0
```

Click **"Install service"**.

**Create the logs directory:**
```
mkdir C:\mathrubhumi\logs
```

**Start the service:**
```
nssm start MathrubhumiBackend
```

**Verify it's running:**
```
nssm status MathrubhumiBackend
```
Should show: `SERVICE_RUNNING`

---

### Step 7.2 — Create the Nginx Service

```
nssm install MathrubhumiNginx
```

Fill in the fields:

| Tab | Field | Value |
|-----|-------|-------|
| **Application** | Path | `C:\nginx\nginx.exe` |
| **Application** | Startup directory | `C:\nginx` |
| **Details** | Display name | `Mathrubhumi Nginx` |
| **Details** | Description | `Mathrubhumi Web Server (Nginx)` |

Click **"Install service"**.

**Start the service:**
```
nssm start MathrubhumiNginx
```

**Verify it's running:**
```
nssm status MathrubhumiNginx
```
Should show: `SERVICE_RUNNING`

---

### Step 7.3 — Verify PostgreSQL Auto-Starts

PostgreSQL installs itself as a Windows Service automatically. Verify:

1. Press `Win + R`, type `services.msc`, press Enter
2. Find **"postgresql-x64-16"** (or similar) in the list
3. Make sure the **Startup Type** column says **"Automatic"**
4. Make sure the **Status** column says **"Running"**

---

### Step 7.4 — Verify All Services

Open Command Prompt as Administrator:

```
nssm status MathrubhumiBackend
nssm status MathrubhumiNginx
sc query postgresql-x64-16
```

All three should show as **Running**.

---

## Phase 8: Configure Windows Firewall

The firewall ensures that only the correct ports are accessible from the network.

### Step 8.1 — Allow HTTP (Port 80) from LAN

1. Press `Win + R`, type `wf.msc`, press Enter (opens Windows Firewall)
2. Click **"Inbound Rules"** on the left
3. Click **"New Rule..."** on the right
4. Select **"Port"** → Next
5. Select **"TCP"**, enter **"80"** → Next
6. Select **"Allow the connection"** → Next
7. Check all profiles (Domain, Private, Public) → Next
8. Name it: **"Mathrubhumi Web (HTTP)"** → Finish

### Step 8.2 — Block Direct Database Access

PostgreSQL should NOT be accessible from other computers. By default, Windows Firewall blocks this, but let's make sure:

1. In Windows Firewall, click **"Inbound Rules"**
2. Look for any rule mentioning **"PostgreSQL"** or port **"5432"**
3. If any rule ALLOWS connections on port 5432 from the network, **disable it** (right-click → Disable)

### Step 8.3 — Block Direct Backend Access

The backend runs on port 8000, but branches should access it through Nginx (port 80), not directly.

Port 8000 is NOT open by default, so no action needed. Just verify:

1. From a branch computer, try: `http://SERVER_IP:8000` in a browser
2. It should NOT load — that's correct

---

## Phase 9: Testing from All Branches

### Step 9.1 — Test from the Server Itself

Open a browser on the server and go to:
```
http://localhost
```

You should see the Mathrubhumi login page.

### Step 9.2 — Test from a Branch Computer

On any computer on the same LAN, open a browser and go to:
```
http://SERVER_IP
```
(Replace SERVER_IP with the actual IP, e.g., `http://192.168.1.100`)

You should see the login page.

### Step 9.3 — Complete Testing Checklist

Test these from a branch computer:

| # | Test | Expected Result | ✅ |
|---|------|-----------------|------|
| 1 | Open `http://SERVER_IP` | Login page loads | ☐ |
| 2 | Log in with credentials | Dashboard appears | ☐ |
| 3 | Select a branch | Branch data loads | ☐ |
| 4 | View Dashboard | Counts show correctly | ☐ |
| 5 | Open Title Master | Titles list loads | ☐ |
| 6 | Add a new title | Title saves successfully | ☐ |
| 7 | Edit a title | Changes save correctly | ☐ |
| 8 | Delete a title | Title is removed | ☐ |
| 9 | Open Sale Bill | Form loads correctly | ☐ |
| 10 | Search for a product | Suggestions appear | ☐ |
| 11 | Create a sale | Sale saves, ID generated | ☐ |
| 12 | Open Goods Inward | Form loads correctly | ☐ |
| 13 | Search for a supplier | Suggestions appear | ☐ |
| 14 | Create a goods inward | Entry saves correctly | ☐ |
| 15 | Open any Report | Report generates with data | ☐ |
| 16 | Leave idle for 30 mins | Auto-logout with message | ☐ |
| 17 | Two branches at once | Both work independently | ☐ |
| 18 | Reboot the server | App comes back online automatically | ☐ |

### Step 9.4 — Test Auto-Restart

This is the most important test:

1. **Restart the server**: Start → Restart
2. Wait 2-3 minutes for it to fully boot
3. From a branch computer, open `http://SERVER_IP`
4. The login page should appear — everything started automatically

---

## Phase 10: Set Up Automatic Backups

### Step 10.1 — Create the Backup Script

1. Open Notepad
2. Paste the following (replace the password with the ACTUAL database password):

```batch
@echo off
REM =============================================
REM Mathrubhumi Database Backup Script
REM Runs daily, keeps last 30 days of backups
REM =============================================

SET BACKUP_DIR=C:\mathrubhumi\backups
SET DB_NAME=mathrubhumi
SET DB_USER=mathrubhumi_user
SET PGPASSWORD=ChooseAStrongPassword123!

REM Create backup directory if it doesn't exist
IF NOT EXIST "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

REM Generate filename with today's date and time
SET TIMESTAMP=%date:~10,4%-%date:~4,2%-%date:~7,2%_%time:~0,2%%time:~3,2%
SET TIMESTAMP=%TIMESTAMP: =0%
SET BACKUP_FILE=%BACKUP_DIR%\mathrubhumi_%TIMESTAMP%.dump

REM Perform backup
echo [%date% %time%] Starting database backup...
pg_dump -U %DB_USER% -h localhost -d %DB_NAME% -F c -f "%BACKUP_FILE%"

IF %ERRORLEVEL% EQU 0 (
    echo [%date% %time%] Backup successful: %BACKUP_FILE% >> C:\mathrubhumi\logs\backup.log
    echo Backup successful: %BACKUP_FILE%
) ELSE (
    echo [%date% %time%] BACKUP FAILED! >> C:\mathrubhumi\logs\backup.log
    echo BACKUP FAILED!
)

REM Delete backups older than 30 days
forfiles /P "%BACKUP_DIR%" /S /D -30 /M *.dump /C "cmd /c del @path" 2>nul

echo Done.
```

3. Save as `C:\mathrubhumi\backup.bat`

### Step 10.2 — Schedule Daily Backup using Task Scheduler

1. Press `Win + R`, type `taskschd.msc`, press Enter
2. Click **"Create Basic Task..."** on the right panel
3. Fill in:
   - **Name:** `Mathrubhumi Daily Backup`
   - **Description:** `Automatic daily database backup at 11:30 PM`
   - Click Next
4. **Trigger:** Select "Daily" → Next
5. **Time:** Set to `11:30:00 PM`, set **Start date** to today → Next
6. **Action:** Select "Start a program" → Next
7. **Program/script:** `C:\mathrubhumi\backup.bat`
8. Click Finish

### Step 10.3 — Test the Backup

```
C:\mathrubhumi\backup.bat
```

Then verify:
```
dir C:\mathrubhumi\backups
```

You should see a `.dump` file with today's date.

---

## Common Operations Reference

### How to Restart the Application

```
# Open Command Prompt as Administrator

# Restart just the backend:
nssm restart MathrubhumiBackend

# Restart just the web server:
nssm restart MathrubhumiNginx

# Restart everything:
nssm restart MathrubhumiBackend
nssm restart MathrubhumiNginx
```

### How to View Logs

```
# Backend application logs:
type C:\mathrubhumi\logs\backend-stderr.log

# Live tail (keeps updating):
powershell Get-Content C:\mathrubhumi\logs\backend-stderr.log -Wait

# Backup logs:
type C:\mathrubhumi\logs\backup.log

# Nginx logs:
type C:\nginx\logs\error.log
type C:\nginx\logs\access.log
```

### How to Deploy a Code Update

When you make code changes and need to update the production server:

```
# Step 1: Go to the project directory
cd C:\mathrubhumi

# Step 2: Pull latest code from Git
git pull origin main

# Step 3: Update backend
cd mathrubhumi-backend
.venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py collectstatic --noinput

# Step 4: Restart backend service
nssm restart MathrubhumiBackend

# Step 5: Rebuild frontend
cd ..\mathrubhumi-frontend
npm install
npm run build

# Step 6: No restart needed for Nginx — it serves the new build files automatically
```

### How to Restore from a Backup

If something goes wrong and you need to restore the database:

```
# Step 1: Stop the backend
nssm stop MathrubhumiBackend

# Step 2: Drop and recreate the database
psql -U postgres
DROP DATABASE mathrubhumi;
CREATE DATABASE mathrubhumi OWNER mathrubhumi_user;
\q

# Step 3: Restore from backup (replace filename with actual backup)
pg_restore -U mathrubhumi_user -h localhost -d mathrubhumi C:\mathrubhumi\backups\mathrubhumi_2026-03-13_2330.dump

# Step 4: Start the backend
nssm start MathrubhumiBackend
```

---

## Troubleshooting

### "The page doesn't load from a branch computer"

1. **Check the server IP:** On the server, run `ipconfig` and confirm the IP
2. **Check Nginx is running:** `nssm status MathrubhumiNginx`
3. **Check the firewall allows port 80:** Open `wf.msc` and verify the HTTP rule exists
4. **Try from the server itself:** Open browser → `http://localhost`

### "Login fails — says 'An unexpected error occurred'"

1. **Check the backend is running:** `nssm status MathrubhumiBackend`
2. **Check the logs:** `type C:\mathrubhumi\logs\backend-stderr.log`
3. **Check database is running:** Open `services.msc` → PostgreSQL should be Running
4. **Test health endpoint:** Open `http://SERVER_IP/health/` in browser

### "Backend won't start — service keeps stopping"

1. **Check logs:** `type C:\mathrubhumi\logs\backend-stderr.log`
2. **Common causes:**
   - Wrong database password in `.env`
   - Missing `DJANGO_SECRET_KEY` in `.env`
   - PostgreSQL not running
3. **Test manually:**
   ```
   cd C:\mathrubhumi\mathrubhumi-backend
   .venv\Scripts\activate
   python -m waitress --host=127.0.0.1 --port=8000 backend.wsgi:application
   ```
   This will show the actual error message.

### "Reports show no data"

1. Run the database functions creation:
   ```
   cd C:\mathrubhumi\mathrubhumi-backend
   .venv\Scripts\activate
   python manage.py create_db_functions
   nssm restart MathrubhumiBackend
   ```

### "After Windows Update, app stops working"

```
# Restart all services
nssm restart MathrubhumiBackend
nssm restart MathrubhumiNginx
# Also verify PostgreSQL is running in services.msc
```

---

## Pre-Handover Checklist

Before leaving the client site, verify everything one final time:

| # | What to Check | How to Verify | Done |
|---|---------------|---------------|------|
| 1 | All three services running | `nssm status` for Backend and Nginx; `services.msc` for PostgreSQL | ☐ |
| 2 | App loads from branch browser | Open `http://SERVER_IP` from any branch PC | ☐ |
| 3 | Login works | Log in with actual user credentials | ☐ |
| 4 | Sales work | Create a test sale, verify it saves | ☐ |
| 5 | Reports work | Generate a sales report | ☐ |
| 6 | Auto-start on reboot | Restart the server, wait 3 mins, check app | ☐ |
| 7 | Daily backup scheduled | Check Task Scheduler for the backup task | ☐ |
| 8 | Database not exposed | From branch: `telnet SERVER_IP 5432` should fail | ☐ |
| 9 | `.env` file has correct values | Check `DJANGO_DEBUG=false` and correct IP | ☐ |
| 10 | Multiple branches work simultaneously | Two people on different PCs use the app at once | ☐ |
| 11 | Test backup works | Run `C:\mathrubhumi\backup.bat` and check `C:\mathrubhumi\backups\` | ☐ |
| 12 | Logs directory exists | `dir C:\mathrubhumi\logs` | ☐ |

---

## Summary of Folder Structure on the Server

```
C:\mathrubhumi\
├── mathrubhumi-backend\          ← Django backend code
│   ├── .venv\                    ← Python virtual environment
│   ├── .env                      ← SECRET configuration file
│   ├── accounts\                 ← Main application code
│   ├── backend\                  ← Django settings
│   ├── manage.py                 ← Django management tool
│   ├── requirements.txt          ← Python dependencies
│   └── staticfiles\              ← Collected static files
│
├── mathrubhumi-frontend\         ← React frontend code
│   ├── build\                    ← Compiled frontend (served by Nginx)
│   ├── .env.production           ← API URL configuration
│   ├── src\                      ← Source code
│   └── package.json              ← Node.js dependencies
│
├── backups\                      ← Daily database backup files
├── logs\                         ← Application log files
│   ├── backend-stdout.log
│   ├── backend-stderr.log
│   └── backup.log
│
├── backup.bat                    ← Backup script
└── WINDOWS_DEPLOYMENT_GUIDE.md   ← This file

C:\nginx\                         ← Nginx web server
├── nginx.exe
├── conf\nginx.conf               ← Nginx configuration
└── logs\                         ← Nginx logs

C:\nssm\                          ← NSSM service manager
└── nssm.exe
```
