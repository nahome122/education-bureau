# Network Setup - Accessing from Other Devices

## Getting Your Server's IP Address

### On Windows (where the server is running):
```bash
ipconfig
```
Look for "IPv4 Address" under your network adapter (usually something like `192.168.x.x` or `10.0.x.x`)

### On Mac/Linux:
```bash
ifconfig
```

---

## Setup Instructions

### Step 1: Update Server Configuration

Edit `server/.env` and change the CLIENT_URL to your local IP:

```env
PORT=5000
CLIENT_URL=http://192.168.1.XXX:5173
```

Replace `192.168.1.XXX` with your actual IP address from Step 1.

---

### Step 2: Update Client Configuration

Edit `client/.env` and change the API URL:

```env
VITE_API_URL=http://192.168.1.XXX:5000/api
```

Replace `192.168.1.XXX` with your server's actual IP address.

---

### Step 3: Update Database Host (if needed)

If the database is on a different machine, edit `server/.env`:

```env
DB_HOST=192.168.1.YYY
```

If it's on the same machine, leave it as `localhost`.

---

### Step 4: Start the Application

**On the server machine:**
```bash
cd server
npm install
npm run dev
```

**On the client machine:**
```bash
cd client
npm install
npm run dev
```

---

### Step 5: Access from Another Device

Open your browser and navigate to:
```
http://192.168.1.XXX:5173
```

Replace with your actual server IP address.

---

## Troubleshooting

### Connection Refused
- Ensure both machines are on the same network
- Check that the firewall allows connections on ports 5000 and 5173
- Verify you're using the correct IP address (not localhost)

### CORS Error
- Make sure `CLIENT_URL` in `server/.env` matches the address you're accessing from
- If the IP differs, update both `.env` files

### Port Already in Use
- Change the port in `.env` and `vite.config.js`
- Or kill the process using that port

### Database Connection Failed
- Ensure MySQL is running
- Verify `DB_HOST` in `server/.env` is correct
- Check database credentials

---

## Production Deployment

For production, use:
- Environment variables from a secure `.env` file
- Consider using a reverse proxy (nginx, Apache)
- Enable HTTPS/SSL
- Use actual domain names instead of IP addresses
- Set `NODE_ENV=production`
