# Output the public IP address
output "public_ip" {
  value       = google_compute_instance.websec_vm.network_interface[0].access_config[0].nat_ip
  description = "Public IP address of the websec VM"
}

# Output the instance name
output "instance_name" {
  value       = google_compute_instance.websec_vm.name
  description = "Name of the Compute Engine instance"
}

# Output the zone
output "zone" {
  value       = google_compute_instance.websec_vm.zone
  description = "Zone where the instance is deployed"
}

# Output the SSH command
output "ssh_command" {
  value       = "gcloud compute ssh ${google_compute_instance.websec_vm.name} --zone=${google_compute_instance.websec_vm.zone} --project=${var.project_id}"
  description = "Command to SSH into the VM"
}

# Output the application URL
output "application_url" {
  value       = "http://${google_compute_instance.websec_vm.network_interface[0].access_config[0].nat_ip}:8888"
  description = "URL to access the websec application"
}

# Output the Google OAuth callback URL (for updating Google Cloud Console)
output "google_oauth_callback_url" {
  value       = "http://${google_compute_instance.websec_vm.network_interface[0].access_config[0].nat_ip}:8888/auth/google/callback"
  description = "Google OAuth callback URL - UPDATE THIS IN GOOGLE CLOUD CONSOLE"
}

# Output instructions
output "next_steps" {
  value = <<-EOT
  
  ╔════════════════════════════════════════════════════════════════════════════╗
  ║                    DEPLOYMENT SUCCESSFUL! 🎉                               ║
  ╚════════════════════════════════════════════════════════════════════════════╝
  
  📋 Next Steps:
  
  1. UPDATE GOOGLE OAUTH SETTINGS:
     Go to: https://console.cloud.google.com/apis/credentials
     Update your OAuth 2.0 Client with:
     
     Authorized JavaScript origins:
       http://${google_compute_instance.websec_vm.network_interface[0].access_config[0].nat_ip}:8888
     
     Authorized redirect URIs:
       http://${google_compute_instance.websec_vm.network_interface[0].access_config[0].nat_ip}:8888/auth/google/callback
  
  2. SSH INTO THE VM:
     ${format("gcloud compute ssh %s --zone=%s --project=%s", google_compute_instance.websec_vm.name, google_compute_instance.websec_vm.zone, var.project_id)}
  
  3. CHECK APPLICATION STATUS:
     Once inside the VM, run:
       sudo docker ps
       sudo docker-compose logs -f
  
  4. ACCESS THE APPLICATION:
     Open in browser: http://${google_compute_instance.websec_vm.network_interface[0].access_config[0].nat_ip}:8888
  
  5. MONITOR STARTUP (first boot takes 2-3 minutes):
     ${format("gcloud compute instances get-serial-port-output %s --zone=%s --project=%s", google_compute_instance.websec_vm.name, google_compute_instance.websec_vm.zone, var.project_id)}
  
  ⚠️  IMPORTANT: The startup script runs in the background. Wait 2-3 minutes
      for Docker Compose to build and start the containers.
  
  EOT
  description = "Post-deployment instructions"
}

