# Websec GCP Deployment with Terraform

This directory contains Terraform configuration to deploy the websec Docker Compose application to Google Cloud Platform (GCP) using a Compute Engine VM.

## 📋 Overview

**What this deploys:**
- **Compute Engine VM**: e2-micro instance (always free tier eligible)
- **OS**: Container-Optimized OS (Docker pre-installed)
- **Region**: us-central1 (free tier eligible)
- **Disk**: 30 GB standard persistent disk (free tier limit)
- **Networking**: Ephemeral public IP, firewall rules for port 8888
- **Application**: Websec Docker Compose stack (app + ModSecurity)

**Estimated cost:** $0/month (within GCP free tier limits)

---

## 🚀 Prerequisites

### 1. Install Required Tools

**Google Cloud SDK (gcloud):**
```bash
# macOS
brew install google-cloud-sdk

# Linux
curl https://sdk.cloud.google.com | bash
exec -l $SHELL

# Verify installation
gcloud --version
```

**Terraform:**
```bash
# macOS
brew install terraform

# Linux
wget https://releases.hashicorp.com/terraform/1.6.0/terraform_1.6.0_linux_amd64.zip
unzip terraform_1.6.0_linux_amd64.zip
sudo mv terraform /usr/local/bin/

# Verify installation
terraform --version
```

### 2. Set Up GCP Project

**Authenticate with Google Cloud:**
```bash
gcloud auth login
gcloud auth application-default login
```

**Create or select a GCP project:**
```bash
# Create a new project
gcloud projects create modsecurity-demo --name="ModSecurity Demo"

# Or list existing projects
gcloud projects list

# Set the active project
gcloud config set project modsecurity-demo
```

**Enable required APIs:**
```bash
gcloud services enable compute.googleapis.com
gcloud services enable oslogin.googleapis.com
```

**Verify your account has necessary permissions:**
```bash
gcloud projects get-iam-policy modsecurity-demo
```

You need at least:
- `roles/compute.instanceAdmin.v1`
- `roles/compute.networkAdmin`
- `roles/iam.serviceAccountUser`

### 3. Set Up Google OAuth Credentials

1. Go to [Google Cloud Console - Credentials](https://console.cloud.google.com/apis/credentials)
2. Click **"Create Credentials"** → **"OAuth 2.0 Client ID"**
3. Configure OAuth consent screen (if not done already)
4. Application type: **"Web application"**
5. Add authorized redirect URIs:
   - `http://localhost:8888/auth/google/callback` (for local testing)
   - You'll add the production URL after deployment
6. Copy the **Client ID** and **Client Secret**

---

## 📝 Configuration & Deployment

Since Terraform automatically reads environment variables prefixed with `TF_VAR_` and maps them to Terraform variables, we'll use a helper script, `load-env.sh` to load your existing `.env` file and export the necessary variables.

| Environment Variable | Terraform Variable | Source |
|---------------------|-------------------|--------|
| `TF_VAR_google_client_id` | `google_client_id` | `GOOGLE_CLIENT_ID` from `.env` |
| `TF_VAR_google_client_secret` | `google_client_secret` | `GOOGLE_CLIENT_SECRET` from `.env` |
| `TF_VAR_session_secret` | `session_secret` | `SESSION_SECRET` from `.env` |
| `TF_VAR_jwt_public_key_prod` | `jwt_public_key_prod` | `JWT_PUBLIC_KEY_PROD` from `.env` |
| `TF_VAR_jwt_public_key_dev` | `jwt_public_key_dev` | `JWT_PUBLIC_KEY_DEV` from `.env` |
| `TF_VAR_jwt_private_key_dev` | `jwt_private_key_dev` | `JWT_PRIVATE_KEY_DEV` from `.env` |
| `TF_VAR_project_id` | `project_id` | Set manually |


**Load your existing `.env` file and export as Terraform variables:**

```bash
cd terraform
# Load environment variables from root .env file
source load-env.sh

# Set your GCP project ID
export TF_VAR_project_id="modsecurity-demo"

terraform init
terraform plan
terraform apply
```

**Deployment takes ~2-3 minutes:**
1. Terraform creates the VM (~30 seconds)
2. Startup script runs in background (~2-3 minutes):
   - Clones the repository
   - Installs Docker Compose
   - Creates .env file
   - Runs `docker-compose up --build -d`

### Step 5: Get Deployment Info

After `terraform apply` completes, you'll see outputs:

```
Example Outputs:

application_url = "http://34.123.45.67:8888"
google_oauth_callback_url = "http://34.123.45.67:8888/auth/google/callback"
public_ip = "34.123.45.67"
ssh_command = "gcloud compute ssh websec-app --zone=us-central1-a --project=modsecurity-demo"

next_steps = <<EOT
╔════════════════════════════════════════════════════════════════════════════╗
║                    DEPLOYMENT SUCCESSFUL! 🎉                               ║
╚════════════════════════════════════════════════════════════════════════════╝
...
EOT
```

**Save these values!** You'll need them for the next steps.

---

## 🔧 Post-Deployment Configuration

### Step 1: Update Google OAuth Settings

1. Go to [Google Cloud Console - Credentials](https://console.cloud.google.com/apis/credentials)
2. Click on your OAuth 2.0 Client ID
3. Add to **Authorized JavaScript origins**:
   ```
   http://YOUR_PUBLIC_IP:8888
   ```
4. Add to **Authorized redirect URIs**:
   ```
   http://YOUR_PUBLIC_IP:8888/auth/google/callback
   ```
5. Click **Save**

### Step 2: Wait for Startup Script to Complete

The startup script runs in the background. Wait 2-3 minutes for Docker Compose to build and start.

**Monitor startup progress:**
```bash
# View serial console output (shows startup script logs)
gcloud compute instances get-serial-port-output websec-app \
  --zone=us-central1-a \
  --project=modsecurity-demo
```

Look for:
```
✅ Application is healthy and responding!
Deployment complete!
```

### Step 3: Verify Deployment

**SSH into the VM:**
```bash
gcloud compute ssh websec-app --zone=us-central1-a --project=modsecurity-demo
```

**Check Docker containers:**
```bash
sudo docker ps
```

Expected output:
```
CONTAINER ID   IMAGE                              STATUS         PORTS
abc123...      owasp/modsecurity-crs:nginx-alpine Up 2 minutes   0.0.0.0:8888->8080/tcp
def456...      websec-app                         Up 2 minutes   8000/tcp
```

**Check logs:**
```bash
cd /home/chronos/websec
sudo docker-compose logs -f
```

**Exit SSH:**
```bash
exit
```

## 📊 Monitoring and Maintenance

### View Application Logs

```bash
# SSH into the VM
gcloud compute ssh websec-app --zone=us-central1-a --project=modsecurity-demo

# View all logs
cd /home/chronos/websec
sudo docker-compose logs -f

# View specific service logs
sudo docker-compose logs -f app
sudo docker-compose logs -f modsecurity
```

### Restart the Application

```bash
# SSH into the VM
gcloud compute ssh websec-app --zone=us-central1-a --project=modsecurity-demo

# Restart services
cd /home/chronos/websec
sudo docker-compose restart

# Or rebuild and restart
sudo docker-compose up --build -d
```

### Update the Application

```bash
# SSH into the VM
gcloud compute ssh websec-app --zone=us-central1-a --project=modsecurity-demo

# Pull latest code
cd /home/chronos/websec
git pull origin main

# Rebuild and restart
sudo docker-compose down && sudo docker-compose up --build -d
```

---

## 🗑️ Cleanup

### Destroy All Resources

```bash
cd terraform
terraform destroy
```

Type `yes` when prompted.

This will delete:
- ✅ Compute Engine instance
- ✅ Firewall rules
- ✅ All associated resources

---

## 🐛 Troubleshooting

### Application Not Responding

**Check if containers are running:**
```bash
gcloud compute ssh websec-app --zone=us-central1-a --project=modsecurity-demo
sudo docker ps
```

**Check startup script logs:**
```bash
gcloud compute instances get-serial-port-output websec-app \
  --zone=us-central1-a \
  --project=modsecurity-demo | tail -100
```

**Check Docker logs:**
```bash
gcloud compute ssh websec-app --zone=us-central1-a --project=modsecurity-demo
cd /home/chronos/websec
sudo docker-compose logs --tail=100
```

### OAuth Redirect Not Working

1. Verify callback URL in Google Cloud Console matches: `http://YOUR_IP:8888/auth/google/callback`
2. Check that your email is added as a test user (if OAuth app is in testing mode)
3. Verify `GOOGLE_CALLBACK_URL` in .env file on the VM

### Port 8888 Not Accessible

**Check firewall rules:**
```bash
gcloud compute firewall-rules list --filter="name:websec"
```

**Test from local machine:**
```bash
curl http://YOUR_PUBLIC_IP:8888/health
```

### Out of Memory (e2-micro has only 1GB RAM)

**Check memory usage:**
```bash
gcloud compute ssh websec-app --zone=us-central1-a --project=modsecurity-demo
free -h
sudo docker stats
```

**If memory is full, upgrade to e2-small:**

Edit `terraform.tfvars`:
```hcl
machine_type = "e2-small"  # 2GB RAM, ~$12/month
```

Then:
```bash
terraform apply
```

---

## 💰 Cost Optimization

### Free Tier Limits

**Always Free (as long as you stay within limits):**
- ✅ 1 e2-micro instance in us-central1, us-west1, or us-east1
- ✅ 30 GB standard persistent disk
- ✅ 1 GB network egress per month

**What costs extra:**
- ❌ Static IP address (~$3/month) - we use ephemeral IP (free)
- ❌ Snapshots/backups (~$0.026/GB/month)
- ❌ Network egress over 1 GB/month (~$0.12/GB)

---

## 🔒 Security Considerations

### Current Setup (Development/Demo)

- ⚠️ HTTP only (no HTTPS)
- ⚠️ Ephemeral IP (changes if VM restarts)
- ⚠️ Public access on port 8888
- ⚠️ Default service account

### Production Hardening (Optional)

1. **Add HTTPS with Let's Encrypt**
2. **Use a custom domain**
3. **Restrict firewall to specific IPs**
4. **Create custom service account with minimal permissions**
5. **Enable Cloud Armor for DDoS protection**
6. **Set up automated backups**
7. **Enable Cloud Monitoring alerts**

---

## 📚 Additional Resources

- [GCP Free Tier](https://cloud.google.com/free)
- [Container-Optimized OS](https://cloud.google.com/container-optimized-os/docs)
- [Terraform Google Provider](https://registry.terraform.io/providers/hashicorp/google/latest/docs)
- [GCP Compute Engine](https://cloud.google.com/compute/docs)