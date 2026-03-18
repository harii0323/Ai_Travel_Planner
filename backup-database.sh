#!/bin/bash

##############################################################################
# AI Travel Planner - Database Backup Script
# 
# Creates automated backups of MongoDB database
# Usage: ./backup-database.sh
# 
# Setup cron job (daily at 2 AM):
# 0 2 * * * /path/to/backup-database.sh >> /var/log/backup.log 2>&1
#
##############################################################################

set -e

# Configuration
BACKUP_DIR="${BACKUP_DIR:-./backups/database}"
MONGODB_URI="${MONGODB_URI:-mongodb://localhost:27017/ai-travel-planner}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
COMPRESS="${COMPRESS:-true}"
UPLOAD_TO_S3="${UPLOAD_TO_S3:-false}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging functions
log() {
  echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

log_success() {
  echo -e "${GREEN}✅ $1${NC}"
}

log_error() {
  echo -e "${RED}❌ $1${NC}" >&2
}

log_warning() {
  echo -e "${YELLOW}⚠️  $1${NC}"
}

##############################################################################
# BACKUP FUNCTIONS
##############################################################################

backup_mongodb() {
  local backup_timestamp=$(date +%Y%m%d_%H%M%S)
  local backup_path="$BACKUP_DIR/mongodb_$backup_timestamp"
  
  log "Starting MongoDB backup..."
  log "Backup directory: $backup_path"
  
  mkdir -p "$backup_path"
  
  # Create backup using mongodump
  if command -v mongodump &> /dev/null; then
    log "Using mongodump for backup..."
    
    if mongodump --uri="$MONGODB_URI" --out="$backup_path" 2>/dev/null; then
      log_success "MongoDB dump completed"
    else
      log_error "mongodump failed"
      rm -rf "$backup_path"
      return 1
    fi
  else
    log_warning "mongodump not found, using MongoDB Atlas export if available"
    # For MongoDB Atlas, export using: https://cloud.mongodb.com/
    return 1
  fi
  
  # Create metadata
  cat > "$backup_path/metadata.json" << EOF
{
  "timestamp": "$(date -I)",
  "database": "ai-travel-planner",
  "size": "$(du -sh "$backup_path" | cut -f1)",
  "method": "mongodump",
  "compressed": $COMPRESS
}
EOF
  
  # Compress if enabled
  if [ "$COMPRESS" = true ]; then
    log "Compressing backup..."
    
    local compressed_file="$backup_path.tar.gz"
    tar -czf "$compressed_file" -C "$BACKUP_DIR" "mongodb_$backup_timestamp" 2>/dev/null
    
    if [ $? -eq 0 ]; then
      log_success "Backup compressed to: $compressed_file"
      local compressed_size=$(du -sh "$compressed_file" | cut -f1)
      log "Compressed size: $compressed_size"
      
      # Remove uncompressed backup
      rm -rf "$backup_path"
      backup_path="$compressed_file"
    else
      log_error "Compression failed, keeping uncompressed backup"
    fi
  fi
  
  # Upload to S3 if configured
  if [ "$UPLOAD_TO_S3" = true ]; then
    upload_to_s3 "$backup_path"
  fi
  
  log_success "Backup completed: $backup_path"
  echo "$backup_path"
}

backup_collections_to_json() {
  local backup_timestamp=$(date +%Y%m%d_%H%M%S)
  local backup_path="$BACKUP_DIR/collections_$backup_timestamp"
  
  log "Exporting collections to JSON..."
  mkdir -p "$backup_path"
  
  # Collections to backup
  local collections=("users" "itineraries")
  
  if command -v mongoexport &> /dev/null; then
    for collection in "${collections[@]}"; do
      log "Exporting $collection..."
      
      mongoexport \
        --uri="$MONGODB_URI" \
        --collection="$collection" \
        --out="$backup_path/${collection}.json" \
        --jsonArray 2>/dev/null
      
      if [ $? -eq 0 ]; then
        local file_size=$(du -sh "$backup_path/${collection}.json" | cut -f1)
        log_success "Exported $collection ($file_size)"
      else
        log_error "Failed to export $collection"
      fi
    done
  else
    log_error "mongoexport not found"
    return 1
  fi
  
  log_success "Collection export completed: $backup_path"
  echo "$backup_path"
}

upload_to_s3() {
  local backup_file="$1"
  
  # optional: if you use AWS S3 for offsite backups
  if ! command -v aws &> /dev/null; then
    log_warning "AWS CLI not found, skipping S3 upload"
    return 1
  fi
  
  if [ -z "$AWS_S3_BUCKET" ]; then
    log_warning "AWS_S3_BUCKET not set, skipping S3 upload"
    return 1
  fi
  
  log "Uploading to S3: s3://$AWS_S3_BUCKET/backups/"
  
  if aws s3 cp "$backup_file" "s3://$AWS_S3_BUCKET/backups/" --sse AES256; then
    log_success "Backup uploaded to S3"
    return 0
  else
    log_error "S3 upload failed"
    return 1
  fi
}

cleanup_old_backups() {
  log "Cleaning up old backups (keeping last $RETENTION_DAYS days)..."
  
  find "$BACKUP_DIR" -type f -mtime +$RETENTION_DAYS -delete
  
  local deleted=$(find "$BACKUP_DIR" -type f -mtime +$RETENTION_DAYS | wc -l)
  if [ "$deleted" -gt 0 ]; then
    log_success "Deleted $deleted old backup(s)"
  else
    log "No old backups to delete"
  fi
}

list_backups() {
  log "Recent backups:"
  log "=============="
  
  if [ -d "$BACKUP_DIR" ]; then
    ls -lhS "$BACKUP_DIR" | head -10 | awk '{print $9, "(" $5 ")"}'
  else
    log_warning "Backup directory not found: $BACKUP_DIR"
  fi
}

restore_from_backup() {
  local backup_file="$1"
  
  if [ -z "$backup_file" ]; then
    log_error "No backup file specified"
    return 1
  fi
  
  if [ ! -f "$backup_file" ]; then
    log_error "Backup file not found: $backup_file"
    return 1
  fi
  
  log "Restoring from backup: $backup_file"
  
  # Check if compressed
  if [[ "$backup_file" == *.tar.gz ]]; then
    log "Extracting compressed backup..."
    local extract_dir=$(mktemp -d)
    tar -xzf "$backup_file" -C "$extract_dir"
    backup_file="$extract_dir/$(ls $extract_dir)"
  fi
  
  log "Restoring to MongoDB..."
  
  if mongorestore --uri="$MONGODB_URI" --dir="$backup_file" 2>/dev/null; then
    log_success "Restore completed successfully"
    return 0
  else
    log_error "Restore failed"
    return 1
  fi
}

verify_backup() {
  local backup_file="$1"
  
  log "Verifying backup integrity..."
  
  if [ ! -f "$backup_file" ]; then
    log_error "Backup file not found: $backup_file"
    return 1
  fi
  
  if [[ "$backup_file" == *.tar.gz ]]; then
    if tar -tzf "$backup_file" > /dev/null 2>&1; then
      log_success "Backup integrity verified"
      return 0
    else
      log_error "Backup file is corrupted"
      return 1
    fi
  else
    log_success "Backup file exists and is accessible"
    return 0
  fi
}

##############################################################################
# MAIN EXECUTION
##############################################################################

main() {
  log "========================================"
  log "Database Backup Script"
  log "========================================"
  log "Database: MongoDB"
  log "Backup location: $BACKUP_DIR"
  log "Retention period: $RETENTION_DAYS days"
  log ""

  # Create backup directory
  mkdir -p "$BACKUP_DIR"

  # Perform backup
  if backup_mongodb; then
    backup_mongodb_file="$?"
  fi
  
  # Also backup collections as JSON
  if backup_collections_to_json; then
    log_success "JSON export completed"
  fi
  
  echo ""
  
  # Cleanup old backups
  cleanup_old_backups
  
  echo ""
  
  # List recent backups
  list_backups
  
  echo ""
  log_success "Backup job completed at $(date)"
}

# Parse command line arguments
case "${1:-backup}" in
  backup)
    main
    ;;
  list)
    list_backups
    ;;
  restore)
    restore_from_backup "$2"
    ;;
  verify)
    verify_backup "$2"
    ;;
  *)
    echo "Usage: $0 {backup|list|restore <file>|verify <file>}"
    exit 1
    ;;
esac
