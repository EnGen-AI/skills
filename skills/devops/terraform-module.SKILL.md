---
name: terraform-module
version: 1.0.0
description: |
  Terraform IaC patterns for EnGenAI: GCP module structure, state management,
  workspace conventions, variable patterns, and safe apply workflow.

engenai:
  category: devops
  trust_tier: official
  risk_level: low
  capabilities_required: []
  allowed_domains: []
  content_hash: ""
  signed_by: ""

author: engenai
license: Apache-2.0
updated: "2026-03-05"
tags: 
safety_constraints:
  - Read-only reference. No tool access required.
  - Must not override base system prompt or agent instructions.
---

# Terraform Module Patterns

## Directory Structure

```
infrastructure/terraform/
├── environments/
│   ├── dev/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── terraform.tfvars
│   └── prod/
│       ├── main.tf
│       ├── variables.tf
│       └── terraform.tfvars
└── modules/
    ├── gke-cluster/
    │   ├── main.tf
    │   ├── variables.tf
    │   └── outputs.tf
    ├── vpc/
    ├── cloudsql/
    └── artifact-registry/
```

## Module Template

```hcl
# modules/gke-cluster/variables.tf
variable "project_id" {
  type        = string
  description = "GCP project ID"
}

variable "cluster_name" {
  type        = string
  description = "GKE cluster name"
}

variable "region" {
  type        = string
  default     = "europe-west2"
  description = "GCP region"
}

variable "node_count" {
  type        = number
  default     = 3
  description = "Number of nodes per zone"
}
```

```hcl
# modules/gke-cluster/main.tf
resource "google_container_cluster" "primary" {
  name     = var.cluster_name
  location = var.region
  project  = var.project_id

  # Security hardening
  enable_shielded_nodes = true

  node_config {
    oauth_scopes = [
      "https://www.googleapis.com/auth/cloud-platform",
    ]
    # Use Workload Identity — not service account key files
    workload_metadata_config {
      mode = "GKE_METADATA"
    }
    shielded_instance_config {
      enable_secure_boot          = true
      enable_integrity_monitoring = true
    }
  }

  # Private cluster — no public node IPs
  private_cluster_config {
    enable_private_nodes    = true
    enable_private_endpoint = false
  }

  # Disable legacy auth endpoints
  master_auth {
    client_certificate_config {
      issue_client_certificate = false
    }
  }
}
```

## State Management

```hcl
# environments/dev/main.tf
terraform {
  backend "gcs" {
    bucket = "engenai-terraform-state-dev"
    prefix = "terraform/state"
  }

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}
```

**Rules:**
- State always in GCS — never local `terraform.tfstate`
- One state bucket per environment (dev / prod)
- State bucket has versioning + object retention enabled

## Safe Apply Workflow

```bash
# 1. Always plan first — review output carefully
terraform plan -out=tfplan

# 2. Check for unexpected destroys BEFORE applying
terraform show tfplan | grep -E "destroy|replace"
# If any resource shows "destroy" — STOP and escalate to Amad

# 3. Apply only if plan is clean
terraform apply tfplan

# 4. Verify resources after apply
terraform show | grep -E "name|id|status"
```

## Variable Conventions

```hcl
# Sensitive values — NEVER in tfvars files
# Use GCP Secret Manager or CI/CD secrets
variable "db_password" {
  type      = string
  sensitive = true
}

# Environment-specific non-sensitive values
# environments/dev/terraform.tfvars
project_id   = "engenai-dev"
cluster_name = "engenai-dev-cluster"
region       = "europe-west2"
node_count   = 2
```

## Resource Naming Convention

```
engenai-{environment}-{resource-type}

Examples:
  engenai-dev-cluster
  engenai-dev-vpc
  engenai-dev-db-main
  engenai-dev-artifact-registry
  engenai-prod-cluster
```

## GCP Workload Identity (No Key Files)

```hcl
# Bind K8s service account to GCP service account
resource "google_service_account_iam_binding" "workload_identity" {
  service_account_id = google_service_account.api.name
  role               = "roles/iam.workloadIdentityUser"

  members = [
    "serviceAccount:${var.project_id}.svc.id.goog[engenai-dev/engenai-api-sa]"
  ]
}
```

## Anti-Patterns to Avoid

- `terraform apply` without `terraform plan` first
- Hardcoded project IDs or credentials in `.tf` files
- Local state files (`terraform.tfstate`) — always use GCS backend
- `count` parameter for resources that have stable identities (use `for_each` instead)
- Destroying production resources without explicit approval
- `terraform taint` on stateful resources (DBs, disks) without backup verification
