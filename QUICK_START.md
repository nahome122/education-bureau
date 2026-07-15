# Quick Start Guide - Login Options

## ✅ Option 1: Use Mock Mode NOW (No Database Setup Required)

The app works in **offline mock mode** with full functionality. Just run:

```bash
# Terminal 1 - Start Server
cd server
npm install
npm run dev

# Terminal 2 - Start Client  
cd client
npm install
npm run dev
```

Then open: `http://localhost:5173`

### Login Credentials (Mock Mode):
```
Username: belete.guta
Password: Employee@123
```

This works **immediately** - no database setup needed. All data persists in browser localStorage.

---

## Option 2: Setup MariaDB (For Production)

MariaDB is installed at `C:\Program Files\MariaDB` but needs configuration.

### Step 1: Start MariaDB
Open Command Prompt (cmd.exe) as Administrator and run:

```cmd
"C:\Program Files\MariaDB\bin\mysqld" --console
```

### Step 2: In a new Command Prompt, reset credentials:

```cmd
cd "C:\Users\Nafel\OneDrive\Desktop\wachale woreda education\server"
node src/scripts/resetUsers.js
```

### Step 3: Then start your app
```bash
npm run dev
```

---

## Recommended: Start with Mock Mode

👉 **For testing and development:** Use mock mode (Option 1)  
👉 **For production/persistent data:** Setup MariaDB (Option 2)

Mock mode includes:
- ✅ Full CRUD operations
- ✅ All features working
- ✅ Data persists in browser
- ✅ No database setup required
