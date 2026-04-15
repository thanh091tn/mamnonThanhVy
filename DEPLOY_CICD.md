# CI/CD setup

This project includes a GitHub Actions workflow at `.github/workflows/ci-cd.yml`.

## What it does

- On every push to `main`, it verifies that:
  - backend dependencies install
  - frontend dependencies install
  - frontend build succeeds
- If verification passes, GitHub Actions connects to the Ubuntu server over SSH and runs `scripts/deploy.sh`

## Server prerequisites

The server should already have:

- Node.js 20
- nginx
- PostgreSQL
- a systemd service named `mamnon-backend`
- the repo cloned at `/var/www/mamnonThanhVy`

Your backend `.env` should stay on the server at `backend/.env`.

## GitHub secrets

In GitHub, open `Settings -> Secrets and variables -> Actions` and create:

- `SERVER_HOST`: server IP or domain
- `SERVER_USER`: SSH user, for example `root`
- `SERVER_SSH_KEY`: private key content used to SSH into the server
- `SERVER_PORT`: usually `22`
- `SERVER_APP_DIR`: usually `/var/www/mamnonThanhVy`

## Windows setup

Open `PowerShell` on your computer and run:

```powershell
ssh-keygen -t ed25519 -C "github-actions-deploy"
```

When asked where to save the key, you can press `Enter` to use the default path:

```text
C:\Users\<your-user>\.ssh\id_ed25519
```

Then show the public key:

```powershell
Get-Content $env:USERPROFILE\.ssh\id_ed25519.pub
```

Copy that full public key text.

## Add the public key to the Ubuntu server

SSH into the server:

```powershell
ssh root@112.78.4.126
```

Then run:

```bash
mkdir -p ~/.ssh
chmod 700 ~/.ssh
nano ~/.ssh/authorized_keys
```

Paste the public key into `authorized_keys`, save the file, then run:

```bash
chmod 600 ~/.ssh/authorized_keys
```

## Add the private key to GitHub

Back on your Windows machine, print the private key:

```powershell
Get-Content $env:USERPROFILE\.ssh\id_ed25519
```

Copy the full private key content including:

- `-----BEGIN OPENSSH PRIVATE KEY-----`
- `-----END OPENSSH PRIVATE KEY-----`

Paste that value into the GitHub Actions secret `SERVER_SSH_KEY`.

## Exact GitHub secret values for this server

Use these values:

- `SERVER_HOST`: `112.78.4.126`
- `SERVER_USER`: `root`
- `SERVER_PORT`: `22`
- `SERVER_APP_DIR`: `/var/www/mamnonThanhVy`
- `SERVER_SSH_KEY`: paste your private key content

## First manual server checks

Run these once on the server to confirm deployment will work:

```bash
cd /var/www/mamnonThanhVy
bash scripts/check-deploy-ready.sh
bash scripts/deploy.sh
systemctl status mamnon-backend
curl http://127.0.0.1:3000/api/health
```

## Trigger a deployment

After secrets are saved:

1. Commit and push to `main`
2. Open `GitHub -> Actions -> CI/CD`
3. Wait for `verify` and `deploy` to finish

Or trigger it manually with `Run workflow` in the Actions tab.

## Notes

- `scripts/deploy.sh` uses `git pull --ff-only origin main`
- frontend is rebuilt on every deploy
- backend service is restarted on every deploy
- nginx is reloaded after deployment
