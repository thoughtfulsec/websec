# GCP Project Configuration
variable "project_id" {
  description = "GCP Project ID"
  type        = string
  default     = "modsecurity-demo"
}

variable "region" {
  description = "GCP region (use us-central1, us-west1, or us-east1 for free tier)"
  type        = string
  default     = "us-central1"
}

variable "zone" {
  description = "GCP zone"
  type        = string
  default     = "us-central1-a"
}

# Compute Instance Configuration
variable "instance_name" {
  description = "Name of the Compute Engine instance"
  type        = string
  default     = "websec-app"
}

variable "machine_type" {
  description = "Machine type (e2-micro for free tier)"
  type        = string
  default     = "e2-micro"
}

variable "os_image" {
  description = "OS image (Container-Optimized OS has Docker pre-installed)"
  type        = string
  default     = "cos-cloud/cos-stable"
}

variable "disk_size_gb" {
  description = "Boot disk size in GB (30 GB is free tier limit)"
  type        = number
  default     = 30
}

# Application Configuration
variable "repo_url" {
  description = "GitHub repository URL"
  type        = string
  default     = "https://github.com/thoughtfulsec/websec.git"
}

variable "repo_branch" {
  description = "Git branch to clone"
  type        = string
  default     = "main"
}

# Environment Variables (sensitive)
variable "google_client_id" {
  description = "Google OAuth Client ID"
  type        = string
  sensitive   = true
}

variable "google_client_secret" {
  description = "Google OAuth Client Secret"
  type        = string
  sensitive   = true
}

variable "session_secret" {
  description = "Session secret for express-session"
  type        = string
  sensitive   = true
  
  # Generate with: openssl rand -base64 32
}

variable "jwt_public_key_prod" {
  description = "JWT production public key (ES256)"
  type        = string
  sensitive   = true
}

variable "jwt_public_key_dev" {
  description = "JWT development public key (ES256)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "jwt_private_key_dev" {
  description = "JWT development private key (ES256)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "node_env" {
  description = "Node environment (development or production)"
  type        = string
  default     = "production"
}
