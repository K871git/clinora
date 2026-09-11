# Clinora — Network Setup Guide
## Doctor's PC + Pharmacist's PC Connection

---

## Overview

Clinora works across two PCs on the same network:

- **Doctor's PC** — runs MySQL database locally. All data lives here.
- **Pharmacist's PC** — connects to Doctor's PC over LAN. No local database needed.

Both PCs must be on the **same WiFi router or LAN switch**.

---

## Step 1 — Install MySQL on Doctor's PC

If MySQL is not already installed, download **MySQL Community Server** from the official site and install it. During installation, set a root password and remember it.

After installation, verify MySQL is running. Open **PowerShell as Administrator** and run:

```powershell
Get-Service -Name "MySQL*"
```

You should see a service with **Status: Running**. If it shows Stopped, start it:

```powershell
Start-Service -Name "MySQL"
```

> The service name may be `MySQL`, `MySQL55`, `MySQL57`, or `MySQL80` depending on your version.

---

## Step 2 — Find Your MySQL Version and Base Directory

Open **MySQL Command Line Client** and run:

```sql
SELECT VERSION();
```

Then run:

```sql
SELECT @@basedir;
```

This shows where MySQL is installed, for example:
```
C:/Program Files/MySQL/MySQL Server 5.5/
```

Write down both — you will need the basedir in Step 4.

---

## Step 3 — Create the Clinora Database

Still in MySQL, run:

```sql
CREATE DATABASE IF NOT EXISTS clinoradb CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Verify it was created:

```sql
SHOW DATABASES;
```

You should see `clinoradb` in the list.

---

## Step 4 — Create a Dedicated MySQL User

Run the following to create a user that both Doctor and Pharmacist PCs can use:

```sql
CREATE USER 'clinora'@'localhost' IDENTIFIED BY 'StrongPassword@123';
CREATE USER 'clinora'@'%' IDENTIFIED BY 'StrongPassword@123';

GRANT ALL PRIVILEGES ON clinoradb.* TO 'clinora'@'localhost';
GRANT ALL PRIVILEGES ON clinoradb.* TO 'clinora'@'%';

FLUSH PRIVILEGES;
```

> Replace `StrongPassword@123` with your own strong password. Write it down — you will need it during Clinora setup on both PCs.

Verify the user was created:

```sql
SELECT user, host FROM mysql.user WHERE user = 'clinora';
```

You should see two rows — one for `localhost` and one for `%`.

---

## Step 5 — Allow MySQL to Accept Remote Connections

### 5a — Check current state

In MySQL, run:

```sql
SHOW VARIABLES LIKE 'bind_address';
```

- If result shows `*` or `0.0.0.0` — MySQL already accepts remote connections. **Skip to Step 6.**
- If result shows `127.0.0.1` or `localhost` — continue below.
- If result shows **Empty set** — your MySQL version (5.5 or older) does not expose this variable. Continue below — you still need to set it.

---

### 5b — Find the my.ini config file

In MySQL, run:

```sql
SELECT @@basedir;
```

The my.ini file is inside that folder. Open **Command Prompt** and check if it exists:

```cmd
dir "C:\Program Files\MySQL\MySQL Server 5.5\my.ini"
```

Replace the path with your actual basedir from above.

- If the file exists — open it and go to **5c**.
- If the file does not exist — go to **5d**.

---

### 5c — my.ini exists — add bind-address

Open the file with **Notepad as Administrator**:

```cmd
notepad "C:\Program Files\MySQL\MySQL Server 5.5\my.ini"
```

Find the `[mysqld]` section. It looks like this:

```ini
[mysqld]
```

Add this line **directly below** `[mysqld]`:

```ini
[mysqld]
bind-address = 0.0.0.0
```

> Do not look for an existing `bind-address` line — it won't be there. Just add the new line.

Save the file and go to **5e**.

---

### 5d — my.ini does not exist — create it

Open **Notepad as Administrator** and create a new file with this content:

```ini
[mysqld]
bind-address = 0.0.0.0
```

Save it at exactly this path (use your actual basedir):

```
C:\Program Files\MySQL\MySQL Server 5.5\my.ini
```

Go to **5e**.

---

### 5e — Restart MySQL

Open **PowerShell as Administrator** and run:

```powershell
net stop MySQL
net start MySQL
```

> If your service name is different (MySQL55, MySQL57, MySQL80), use that instead:
> ```powershell
> net stop MySQL55
> net start MySQL55
> ```

Verify MySQL is running again:

```powershell
Get-Service -Name "MySQL*"
```

---

## Step 6 — Open Port 3306 in Windows Firewall

On the **Doctor's PC**, open **PowerShell as Administrator** and run:

```powershell
New-NetFirewallRule -DisplayName "MySQL Clinora" -Direction Inbound -Protocol TCP -LocalPort 3306 -Action Allow
```

Verify the rule was added:

```powershell
Get-NetFirewallRule -DisplayName "MySQL Clinora"
```

You should see the rule with **Enabled: True**.

---

## Step 7 — Find the Doctor's PC IP Address

On the **Doctor's PC**, open **Command Prompt** and run:

```cmd
ipconfig
```

Look for the **IPv4 Address** under your active adapter (WiFi or Ethernet):

```
Wireless LAN adapter Wi-Fi:
   IPv4 Address. . . . . . . . . . . : 192.168.1.5
```

Write this IP down. You will enter it on the Pharmacist's PC.

> **Important:** This IP can change every time the router restarts. To make it permanent, set a **static IP** on the Doctor's PC:
> - Go to Control Panel → Network → your WiFi/Ethernet adapter → Properties → IPv4 → Use the following IP address
> - Enter the same IP, subnet mask `255.255.255.0`, and your router's IP as gateway

---

## Step 8 — Test the Connection from Pharmacist's PC

On the **Pharmacist's PC**, open **Command Prompt** and run:

```cmd
mysql -h 192.168.1.5 -u clinora -p clinoradb
```

Replace `192.168.1.5` with the actual Doctor's PC IP from Step 7.

Enter the password when prompted (`StrongPassword@123` or whatever you set).

**Results:**

| What you see | Meaning | Fix |
|---|---|---|
| `mysql>` prompt appears | Connection successful — everything works | None, proceed to Step 9 |
| `Access denied for user` | Wrong password or user missing `%` host | Re-check Step 4 |
| `Can't connect to MySQL server` | bind-address not set or firewall blocking | Re-check Step 5 and Step 6 |
| Connection timed out | PCs not on same network | Ensure both on same WiFi/router |

Type `exit` to close the MySQL session.

---

## Step 9 — Install and Set Up Clinora

### On Doctor's PC

1. Run `Clinora_1.0.0_x64-setup.exe` and complete installation
2. Open Clinora — the **Setup Wizard** appears
3. Select **Doctor's PC**
4. Enter:
   - Username: `clinora`
   - Password: `StrongPassword@123`
5. Click **Test Connection** — should show success
6. Click **Save & Continue** — app restarts automatically
7. **License screen** appears — paste the license key provided to you
8. Log in with your admin credentials

---

### On Pharmacist's PC

1. Run `Clinora_1.0.0_x64-setup.exe` and complete installation
2. Open Clinora — the **Setup Wizard** appears
3. Select **Pharmacist's PC**
4. Enter:
   - Doctor's IP: `192.168.1.5` (from Step 7)
   - Username: `clinora`
   - Password: `StrongPassword@123`
5. Click **Test Connection** — should show success
6. Click **Save & Continue** — app restarts automatically
7. **License screen** appears — paste the **same license key** as Doctor's PC
8. Log in with your credentials

---

## Troubleshooting

| Problem | Likely Cause | Fix |
|---|---|---|
| `Access denied for user 'clinora'@...` | Wrong password or missing `%` user | Re-run Step 4 |
| `Can't connect to MySQL server on 192.168.x.x` | bind-address is still 127.0.0.1 or firewall blocking | Re-check Step 5 and Step 6 |
| Connection timed out | PCs not on same network | Ensure both PCs on same WiFi/router |
| Works today, fails tomorrow | Doctor's PC IP changed (DHCP) | Set static IP on Doctor's PC (Step 7) |
| App crashes on open | Database not created | Run Step 3 again |
| Setup wizard keeps appearing | Config not saved properly | Check if `data/clinora.cfg` exists next to the Clinora exe |
| `ERROR 1396: Operation CREATE USER failed` | User already exists from a previous attempt | Run `DROP USER 'clinora'@'%';` then re-run Step 4 |

---

---

## License Key Generation (For Clinora Provider Only)

This section is for the person who distributes Clinora — not for the clinic client.

### Tool location

```
clinora-keygen\target\release\clinora-keygen.exe
```

This tool only runs on the authorized developer PC. If you copy it to any other machine it will exit immediately without doing anything.

---

### How to generate a key

**Step 1 — Open a terminal in the keygen folder**

Open PowerShell or Command Prompt and navigate to the folder:

```powershell
cd "d:\new_live\clinora\clinora-keygen\target\release"
```

**Step 2 — Run the keygen**

```powershell
.\clinora-keygen.exe
```

**Step 3 — Enter the master password when prompted**

```
Enter master password:
```

Type exactly:

```
ClinoraKeygen@2025!
```

**Step 4 — Enter the Clinic ID**

```
Enter Clinic ID (e.g. CLINIC-001 or clinic name):
```

Type any name that identifies the clinic, for example:

```
DrSmithClinic
```

or

```
CLINIC-001
```

**Step 5 — Copy the output key**

The tool prints the license key:

```
══════════════════════════════════════════════════
  Clinic  : DrSmithClinic
  License Key:
  DrSmithClinic:AbCdXxYyZz...base64...==
══════════════════════════════════════════════════
```

Copy the entire line starting from the clinic name — everything including the long base64 part at the end.

**Step 6 — Send the key to the client**

Send it via WhatsApp, email, or any way you prefer. The client pastes this key into the Clinora license screen.

**Step 7 — Generate another or exit**

```
Generate another key? (y/n):
```

Type `y` to generate another key for a different clinic, or `n` to exit.

---

### Important rules

- **One key per clinic** — generate one key and use it on both Doctor's PC and Pharmacist's PC at the same clinic.
- **Same key forever** — if the client reinstalls Clinora, give them the same key again. No need to generate a new one.
- **Keep the keygen exe private** — never share this exe or its password with anyone.
- **Keygen only runs on your PC** — if your PC changes, add the new machine GUID to the whitelist in source and rebuild the keygen.

---

## Notes

- The **license key is the same** for Doctor's PC and Pharmacist's PC — one key per clinic.
- The Pharmacist's PC does **not** need MySQL installed — it only connects to Doctor's MySQL remotely.
- Keep the Doctor's PC **powered on and connected to the network** whenever the Pharmacist needs to use Clinora.
- If Clinora is reinstalled on any PC, the Setup Wizard will appear again — re-enter the same credentials.
