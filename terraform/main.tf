terraform {
  required_version = ">= 1.0"
  
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# Compute Engine instance with Container-Optimized OS
resource "google_compute_instance" "websec_vm" {
  name         = var.instance_name
  machine_type = var.machine_type
  zone         = var.zone

  # Always free tier: e2-micro in us-central1, us-west1, or us-east1
  boot_disk {
    initialize_params {
      image = var.os_image
      size  = var.disk_size_gb
      type  = "pd-standard" # Standard persistent disk (free tier)
    }
  }

  network_interface {
    network = "default"
    
    # Ephemeral public IP (free)
    access_config {
      # Leave empty for ephemeral IP
      # To use static IP: nat_ip = google_compute_address.static_ip.address
    }
  }

  # OS Login for SSH access (no manual key management)
  metadata = {
    enable-oslogin = "TRUE"
    
    # Startup script to deploy the application
    startup-script = templatefile("${path.module}/startup-script.sh", {
      repo_url           = var.repo_url
      repo_branch        = var.repo_branch
      google_client_id   = var.google_client_id
      google_client_secret = var.google_client_secret
      session_secret     = var.session_secret
      jwt_public_key_prod = var.jwt_public_key_prod
      jwt_public_key_dev  = var.jwt_public_key_dev
      jwt_private_key_dev = var.jwt_private_key_dev
      node_env           = var.node_env
    })
  }

  # Network tags for firewall rules
  tags = ["websec-app", "http-server"]

  # Allow the instance to be deleted by Terraform
  allow_stopping_for_update = true

  # Service account with minimal permissions
  service_account {
    # Use default compute service account
    # For production, create a custom service account with minimal permissions
    scopes = [
      "https://www.googleapis.com/auth/devstorage.read_only",
      "https://www.googleapis.com/auth/logging.write",
      "https://www.googleapis.com/auth/monitoring.write",
    ]
  }

  # Labels for organization
  labels = {
    environment = var.node_env
    application = "websec"
    managed_by  = "terraform"
  }
}

# Firewall rule to allow HTTP traffic on port 8888
resource "google_compute_firewall" "allow_websec" {
  name    = "allow-websec-8888"
  network = "default"

  allow {
    protocol = "tcp"
    ports    = ["8888"]
  }

  # Allow from anywhere (public access)
  source_ranges = ["0.0.0.0/0"]
  
  # Apply to instances with this tag
  target_tags = ["websec-app"]

  description = "Allow HTTP traffic on port 8888 for websec application"
}

# Optional: Firewall rule to allow SSH (usually already exists in default network)
resource "google_compute_firewall" "allow_ssh" {
  name    = "allow-ssh-websec"
  network = "default"

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }

  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["websec-app"]

  description = "Allow SSH access to websec VM"
}

# Optional: Static IP address (costs ~$3/month, comment out for free tier)
# resource "google_compute_address" "static_ip" {
#   name   = "websec-static-ip"
#   region = var.region
# }

