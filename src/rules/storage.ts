/**
 * Enterprise Agent Supervisor - Storage Rules
 *
 * Comprehensive governance rules for all storage types:
 * - Browser Storage (localStorage, sessionStorage, IndexedDB)
 * - Database Access (SQL, NoSQL, transactions)
 * - File System (read, write, configuration)
 * - Cache (memory, distributed, CDN)
 * - Blob/Object Storage (S3, Azure Blob, GCS)
 */

import type { BusinessRule } from '../types/index.js';

// ============================================================================
// BROWSER STORAGE RULES
// ============================================================================

const browserStorageRules: BusinessRule[] = [
  {
    id: 'storage-001',
    name: 'Monitor localStorage Quota Usage',
    description: 'localStorage usage must be monitored to prevent quota exceeded errors',
    type: 'operational',
    enabled: true,
    priority: 900,
    conditions: [
      { field: 'actionCategory', operator: 'equals', value: 'data_modification' },
      { field: 'storageType', operator: 'equals', value: 'localStorage' },
      { field: 'estimatedSize', operator: 'greater_than', value: 4000000 }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'localStorage usage >4MB - approaching quota limit (5-10MB)' }
    ],
    riskWeight: 30,
    tags: ['storage', 'localStorage', 'quota', 'browser']
  },
  {
    id: 'storage-002',
    name: 'Require Auto-Cleanup of Old Data',
    description: 'localStorage must have cleanup strategy for old data',
    type: 'architecture',
    enabled: true,
    priority: 850,
    conditions: [
      { field: 'storageType', operator: 'equals', value: 'localStorage' },
      { field: 'hasCleanupStrategy', operator: 'not_equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Implement localStorage cleanup (TTL, LRU, size-based eviction)' }
    ],
    riskWeight: 25,
    tags: ['storage', 'localStorage', 'cleanup', 'maintenance']
  },
  {
    id: 'storage-003',
    name: 'Prohibit Sensitive Data in localStorage',
    description: 'Sensitive data must not be stored in localStorage',
    type: 'security',
    enabled: true,
    priority: 960,
    conditions: [
      { field: 'storageType', operator: 'in', value: ['localStorage', 'sessionStorage'] },
      { field: 'dataClassification', operator: 'in', value: ['confidential', 'restricted'] }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'deny', message: 'Sensitive data prohibited in localStorage (use secure HTTP-only cookies or encrypted storage)' }
    ],
    riskWeight: 55,
    tags: ['storage', 'security', 'localStorage', 'sensitive-data']
  },
  {
    id: 'storage-004',
    name: 'Deny Base64 Image Storage',
    description: 'Base64 images must not be stored in localStorage due to size',
    type: 'operational',
    enabled: true,
    priority: 920,
    conditions: [
      { field: 'storageType', operator: 'equals', value: 'localStorage' },
      { field: 'dataType', operator: 'equals', value: 'base64_image' }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'deny', message: 'Base64 images prohibited in localStorage (use blob URLs, IndexedDB, or server storage)' }
    ],
    riskWeight: 40,
    tags: ['storage', 'localStorage', 'images', 'quota']
  },
  {
    id: 'storage-005',
    name: 'Validate localStorage Access Error Handling',
    description: 'localStorage operations must handle quota exceeded errors',
    type: 'architecture',
    enabled: true,
    priority: 880,
    conditions: [
      { field: 'storageType', operator: 'equals', value: 'localStorage' },
      { field: 'hasErrorHandling', operator: 'not_equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Wrap localStorage operations in try/catch for quota exceeded errors' }
    ],
    riskWeight: 20,
    tags: ['storage', 'localStorage', 'error-handling']
  },
  {
    id: 'storage-006',
    name: 'Use IndexedDB for Large Data',
    description: 'Large datasets should use IndexedDB instead of localStorage',
    type: 'architecture',
    enabled: true,
    priority: 800,
    conditions: [
      { field: 'storageType', operator: 'equals', value: 'localStorage' },
      { field: 'dataSize', operator: 'greater_than', value: 1000000 }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Large data (>1MB) should use IndexedDB instead of localStorage' }
    ],
    riskWeight: 15,
    tags: ['storage', 'indexeddb', 'performance']
  },
  {
    id: 'storage-007',
    name: 'No Tokens in localStorage',
    description: 'Auth tokens and API keys must not be stored in localStorage',
    type: 'security',
    enabled: true,
    priority: 980,
    conditions: [
      { field: 'storageType', operator: 'in', value: ['localStorage', 'sessionStorage'] },
      { field: 'dataType', operator: 'in', value: ['auth_token', 'api_key', 'jwt'] }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'deny', message: 'Auth tokens/API keys prohibited in localStorage (use secure HTTP-only cookies)' }
    ],
    riskWeight: 70,
    tags: ['storage', 'security', 'localStorage', 'tokens', 'authentication']
  }
];

// ============================================================================
// DATABASE ACCESS RULES
// ============================================================================

const databaseStorageRules: BusinessRule[] = [
  {
    id: 'storage-db-001',
    name: 'Database Connection Pool Limit',
    description: 'Database connections must use connection pooling with limits',
    type: 'operational',
    enabled: true,
    priority: 880,
    conditions: [
      { field: 'storageType', operator: 'in', value: ['sql', 'postgresql', 'mysql', 'mongodb'] },
      { field: 'connectionPoolEnabled', operator: 'not_equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Database operations should use connection pooling to prevent exhaustion' }
    ],
    riskWeight: 30,
    tags: ['storage', 'database', 'connection-pool', 'performance']
  },
  {
    id: 'storage-db-002',
    name: 'Transaction Boundary Required',
    description: 'Multi-table database operations require explicit transaction boundaries',
    type: 'architecture',
    enabled: true,
    priority: 900,
    conditions: [
      { field: 'actionCategory', operator: 'equals', value: 'data_modification' },
      { field: 'storageType', operator: 'in', value: ['sql', 'postgresql', 'mysql'] },
      { field: 'multiTableOperation', operator: 'equals', value: true },
      { field: 'transactionBoundary', operator: 'not_exists', value: null }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Multi-table operations should define transaction boundaries for data consistency' }
    ],
    riskWeight: 35,
    tags: ['storage', 'database', 'transactions', 'consistency']
  },
  {
    id: 'storage-db-003',
    name: 'Prevent Unbounded Queries',
    description: 'Database queries must have result limits to prevent memory exhaustion',
    type: 'operational',
    enabled: true,
    priority: 920,
    conditions: [
      { field: 'actionCategory', operator: 'equals', value: 'data_access' },
      { field: 'storageType', operator: 'in', value: ['sql', 'postgresql', 'mysql', 'mongodb', 'cosmos-db'] },
      { field: 'hasResultLimit', operator: 'not_equals', value: true },
      { field: 'returnsCollection', operator: 'equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Database queries returning collections should have LIMIT/TOP clause' }
    ],
    riskWeight: 25,
    tags: ['storage', 'database', 'performance', 'pagination']
  },
  {
    id: 'storage-db-004',
    name: 'Index Required for Frequent Queries',
    description: 'Frequently executed queries should use indexed fields',
    type: 'architecture',
    enabled: true,
    priority: 800,
    conditions: [
      { field: 'actionCategory', operator: 'equals', value: 'data_access' },
      { field: 'storageType', operator: 'in', value: ['sql', 'postgresql', 'mysql', 'mongodb'] },
      { field: 'queryFrequency', operator: 'equals', value: 'high' },
      { field: 'usesIndex', operator: 'not_equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'High-frequency queries should use indexed fields for performance' }
    ],
    riskWeight: 20,
    tags: ['storage', 'database', 'indexing', 'performance']
  },
  {
    id: 'storage-db-005',
    name: 'Parameterized Queries Required',
    description: 'Database queries must use parameterized statements to prevent injection',
    type: 'security',
    enabled: true,
    priority: 980,
    conditions: [
      { field: 'actionCategory', operator: 'equals', value: 'data_access' },
      { field: 'storageType', operator: 'in', value: ['sql', 'postgresql', 'mysql'] },
      { field: 'queryParameterized', operator: 'not_equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'deny', message: 'Database queries must use parameterized statements (SQL injection prevention)' }
    ],
    riskWeight: 70,
    tags: ['storage', 'database', 'security', 'sql-injection']
  },
  {
    id: 'storage-db-006',
    name: 'Database Backup Before Schema Change',
    description: 'Schema changes in production require backup verification',
    type: 'operational',
    enabled: true,
    priority: 950,
    conditions: [
      { field: 'storageType', operator: 'in', value: ['sql', 'postgresql', 'mysql', 'mongodb'] },
      { field: 'operation', operator: 'in', value: ['alter_table', 'drop_table', 'create_index', 'drop_index', 'migration'] },
      { field: 'environment', operator: 'equals', value: 'production' },
      { field: 'backupVerified', operator: 'not_equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'require_approval', message: 'Production schema changes require backup verification' }
    ],
    riskWeight: 50,
    tags: ['storage', 'database', 'schema', 'backup', 'migration']
  },
  {
    id: 'storage-db-007',
    name: 'Read Replica for Heavy Reads',
    description: 'High-volume read operations should use read replicas',
    type: 'architecture',
    enabled: true,
    priority: 750,
    conditions: [
      { field: 'actionCategory', operator: 'equals', value: 'data_access' },
      { field: 'storageType', operator: 'in', value: ['sql', 'postgresql', 'mysql'] },
      { field: 'queryVolume', operator: 'equals', value: 'high' },
      { field: 'usesReadReplica', operator: 'not_equals', value: true },
      { field: 'environment', operator: 'equals', value: 'production' }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'High-volume reads should consider read replicas to reduce primary load' }
    ],
    riskWeight: 15,
    tags: ['storage', 'database', 'read-replica', 'scaling']
  }
];

// ============================================================================
// FILE SYSTEM RULES
// ============================================================================

const fileSystemStorageRules: BusinessRule[] = [
  {
    id: 'storage-fs-001',
    name: 'Block Access to System Files',
    description: 'Prevents access to critical system files and directories',
    type: 'security',
    enabled: true,
    priority: 990,
    conditions: [
      { field: 'storageType', operator: 'equals', value: 'filesystem' },
      { field: 'filePath', operator: 'matches_regex', value: '^(/etc|/sys|/proc|/boot|C:\\\\Windows|C:\\\\System32)' }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'deny', message: 'Access to system files is prohibited' }
    ],
    riskWeight: 65,
    tags: ['storage', 'filesystem', 'security', 'system-files']
  },
  {
    id: 'storage-fs-002',
    name: 'Require Approval for Config File Changes',
    description: 'Configuration file modifications require approval in production',
    type: 'security',
    enabled: true,
    priority: 900,
    conditions: [
      { field: 'storageType', operator: 'equals', value: 'filesystem' },
      { field: 'operation', operator: 'in', value: ['write', 'delete', 'modify'] },
      { field: 'filePath', operator: 'matches_regex', value: '\\.(conf|config|yml|yaml|json|env|ini|toml)$' },
      { field: 'environment', operator: 'equals', value: 'production' }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'require_approval', message: 'Production configuration file changes require approval' }
    ],
    riskWeight: 35,
    tags: ['storage', 'filesystem', 'configuration', 'production']
  },
  {
    id: 'storage-fs-003',
    name: 'Prevent Path Traversal',
    description: 'File paths must not contain path traversal sequences',
    type: 'security',
    enabled: true,
    priority: 1000,
    conditions: [
      { field: 'storageType', operator: 'equals', value: 'filesystem' },
      { field: 'filePath', operator: 'matches_regex', value: '(\\.\\./|\\.\\.\\\\|%2e%2e)' }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'deny', message: 'Path traversal attack detected - operation blocked' },
      { type: 'notify', message: 'Security alert: Path traversal attempt detected' }
    ],
    riskWeight: 80,
    tags: ['storage', 'filesystem', 'security', 'path-traversal']
  },
  {
    id: 'storage-fs-004',
    name: 'File Size Limit Enforcement',
    description: 'File operations must respect size limits',
    type: 'operational',
    enabled: true,
    priority: 850,
    conditions: [
      { field: 'storageType', operator: 'equals', value: 'filesystem' },
      { field: 'operation', operator: 'in', value: ['write', 'upload'] },
      { field: 'fileSize', operator: 'greater_than', value: 104857600 } // 100MB
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'require_approval', message: 'File upload >100MB requires approval' }
    ],
    riskWeight: 25,
    tags: ['storage', 'filesystem', 'upload', 'size-limit']
  },
  {
    id: 'storage-fs-005',
    name: 'Temp File Cleanup Required',
    description: 'Temporary files must be cleaned up after use',
    type: 'operational',
    enabled: true,
    priority: 750,
    conditions: [
      { field: 'storageType', operator: 'equals', value: 'filesystem' },
      { field: 'filePath', operator: 'matches_regex', value: '(/tmp/|/temp/|\\\\temp\\\\|\\\\tmp\\\\|\\.tmp$)' },
      { field: 'hasCleanupStrategy', operator: 'not_equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Temporary files should have cleanup strategy (TTL or explicit deletion)' }
    ],
    riskWeight: 15,
    tags: ['storage', 'filesystem', 'temp', 'cleanup']
  },
  {
    id: 'storage-fs-006',
    name: 'Executable Upload Prevention',
    description: 'Prevent upload of executable files',
    type: 'security',
    enabled: true,
    priority: 970,
    conditions: [
      { field: 'storageType', operator: 'equals', value: 'filesystem' },
      { field: 'operation', operator: 'equals', value: 'upload' },
      { field: 'filePath', operator: 'matches_regex', value: '\\.(exe|dll|sh|bash|ps1|bat|cmd|msi|jar|py|rb|php|pl)$' }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'deny', message: 'Executable file uploads are prohibited for security' }
    ],
    riskWeight: 60,
    tags: ['storage', 'filesystem', 'security', 'executable', 'upload']
  }
];

// ============================================================================
// CACHE RULES
// ============================================================================

const cacheStorageRules: BusinessRule[] = [
  {
    id: 'storage-cache-001',
    name: 'Cache TTL Required',
    description: 'Cached data must have explicit TTL to prevent stale data',
    type: 'architecture',
    enabled: true,
    priority: 850,
    conditions: [
      { field: 'storageType', operator: 'in', value: ['redis', 'memcached', 'cache'] },
      { field: 'operation', operator: 'equals', value: 'set' },
      { field: 'ttlSet', operator: 'not_equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Cache entries should have explicit TTL to prevent stale data' }
    ],
    riskWeight: 20,
    tags: ['storage', 'cache', 'ttl', 'staleness']
  },
  {
    id: 'storage-cache-002',
    name: 'No Sensitive Data in Cache',
    description: 'Sensitive data must not be cached without encryption',
    type: 'security',
    enabled: true,
    priority: 930,
    conditions: [
      { field: 'storageType', operator: 'in', value: ['redis', 'memcached', 'cache'] },
      { field: 'dataClassification', operator: 'in', value: ['confidential', 'restricted'] },
      { field: 'encryptionEnabled', operator: 'not_equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'deny', message: 'Sensitive data must be encrypted before caching' }
    ],
    riskWeight: 50,
    tags: ['storage', 'cache', 'security', 'encryption']
  },
  {
    id: 'storage-cache-003',
    name: 'Cache Key Namespacing',
    description: 'Cache keys should use namespacing to prevent collisions',
    type: 'architecture',
    enabled: true,
    priority: 750,
    conditions: [
      { field: 'storageType', operator: 'in', value: ['redis', 'memcached', 'cache'] },
      { field: 'cacheKeyNamespaced', operator: 'not_equals', value: true },
      { field: 'environment', operator: 'equals', value: 'production' }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Cache keys should use namespace prefix (e.g., app:env:key) to prevent collisions' }
    ],
    riskWeight: 15,
    tags: ['storage', 'cache', 'namespacing', 'best-practice']
  },
  {
    id: 'storage-cache-004',
    name: 'Cache Eviction Strategy Required',
    description: 'Cache should have defined eviction strategy',
    type: 'architecture',
    enabled: true,
    priority: 800,
    conditions: [
      { field: 'storageType', operator: 'in', value: ['redis', 'memcached', 'cache'] },
      { field: 'evictionPolicy', operator: 'not_exists', value: null },
      { field: 'environment', operator: 'equals', value: 'production' }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Production cache should define eviction policy (LRU, LFU, etc.)' }
    ],
    riskWeight: 20,
    tags: ['storage', 'cache', 'eviction', 'memory']
  },
  {
    id: 'storage-cache-005',
    name: 'Cache Stampede Prevention',
    description: 'High-traffic cache entries should use stampede protection',
    type: 'architecture',
    enabled: true,
    priority: 820,
    conditions: [
      { field: 'storageType', operator: 'in', value: ['redis', 'memcached', 'cache'] },
      { field: 'accessFrequency', operator: 'equals', value: 'high' },
      { field: 'stampedeProtection', operator: 'not_equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'High-frequency cache keys should use stampede protection (locking or probabilistic early expiry)' }
    ],
    riskWeight: 25,
    tags: ['storage', 'cache', 'stampede', 'performance']
  },
  {
    id: 'storage-cache-006',
    name: 'CDN Cache Headers Required',
    description: 'CDN-cached resources must have proper cache control headers',
    type: 'architecture',
    enabled: true,
    priority: 780,
    conditions: [
      { field: 'storageType', operator: 'equals', value: 'cdn' },
      { field: 'cacheControlSet', operator: 'not_equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'CDN resources should have Cache-Control headers for proper edge caching' }
    ],
    riskWeight: 15,
    tags: ['storage', 'cache', 'cdn', 'headers']
  }
];

// ============================================================================
// BLOB/OBJECT STORAGE RULES
// ============================================================================

const blobStorageRules: BusinessRule[] = [
  {
    id: 'storage-blob-001',
    name: 'Private Bucket by Default',
    description: 'Object storage buckets must be private unless explicitly required',
    type: 'security',
    enabled: true,
    priority: 960,
    conditions: [
      { field: 'storageType', operator: 'in', value: ['s3', 'azure-blob', 'gcs', 'blob'] },
      { field: 'operation', operator: 'equals', value: 'create_bucket' },
      { field: 'publicAccess', operator: 'equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'require_approval', message: 'Public bucket creation requires security review' }
    ],
    riskWeight: 55,
    tags: ['storage', 'blob', 'security', 'public-access']
  },
  {
    id: 'storage-blob-002',
    name: 'Server-Side Encryption Required',
    description: 'Object storage must use server-side encryption',
    type: 'security',
    enabled: true,
    priority: 940,
    conditions: [
      { field: 'storageType', operator: 'in', value: ['s3', 'azure-blob', 'gcs', 'blob'] },
      { field: 'environment', operator: 'equals', value: 'production' },
      { field: 'sseEnabled', operator: 'not_equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'deny', message: 'Production object storage must use server-side encryption (SSE)' }
    ],
    riskWeight: 50,
    tags: ['storage', 'blob', 'security', 'encryption', 'sse']
  },
  {
    id: 'storage-blob-003',
    name: 'Lifecycle Policy Required',
    description: 'Object storage buckets should have lifecycle policies',
    type: 'operational',
    enabled: true,
    priority: 800,
    conditions: [
      { field: 'storageType', operator: 'in', value: ['s3', 'azure-blob', 'gcs', 'blob'] },
      { field: 'operation', operator: 'equals', value: 'create_bucket' },
      { field: 'lifecyclePolicySet', operator: 'not_equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Object storage buckets should have lifecycle policies for cost optimization' }
    ],
    riskWeight: 20,
    tags: ['storage', 'blob', 'lifecycle', 'cost']
  },
  {
    id: 'storage-blob-004',
    name: 'Versioning for Critical Data',
    description: 'Critical data buckets should enable versioning',
    type: 'operational',
    enabled: true,
    priority: 850,
    conditions: [
      { field: 'storageType', operator: 'in', value: ['s3', 'azure-blob', 'gcs', 'blob'] },
      { field: 'dataClassification', operator: 'in', value: ['confidential', 'critical'] },
      { field: 'versioningEnabled', operator: 'not_equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Critical data buckets should enable versioning for recovery' }
    ],
    riskWeight: 25,
    tags: ['storage', 'blob', 'versioning', 'recovery']
  },
  {
    id: 'storage-blob-005',
    name: 'CORS Configuration Required',
    description: 'Web-accessible blob storage must have explicit CORS configuration',
    type: 'security',
    enabled: true,
    priority: 880,
    conditions: [
      { field: 'storageType', operator: 'in', value: ['s3', 'azure-blob', 'gcs', 'blob'] },
      { field: 'webAccessible', operator: 'equals', value: true },
      { field: 'corsConfigured', operator: 'not_equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Web-accessible blob storage should have explicit CORS configuration' }
    ],
    riskWeight: 30,
    tags: ['storage', 'blob', 'security', 'cors']
  },
  {
    id: 'storage-blob-006',
    name: 'Presigned URL Expiry Limit',
    description: 'Presigned URLs must have short expiry times',
    type: 'security',
    enabled: true,
    priority: 900,
    conditions: [
      { field: 'storageType', operator: 'in', value: ['s3', 'azure-blob', 'gcs', 'blob'] },
      { field: 'operation', operator: 'equals', value: 'generate_presigned_url' },
      { field: 'urlExpirySeconds', operator: 'greater_than', value: 3600 } // 1 hour
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Presigned URLs should expire within 1 hour for security' }
    ],
    riskWeight: 35,
    tags: ['storage', 'blob', 'security', 'presigned-url']
  },
  {
    id: 'storage-blob-007',
    name: 'Cross-Region Replication for DR',
    description: 'Critical buckets should have cross-region replication for disaster recovery',
    type: 'operational',
    enabled: true,
    priority: 750,
    conditions: [
      { field: 'storageType', operator: 'in', value: ['s3', 'azure-blob', 'gcs', 'blob'] },
      { field: 'dataClassification', operator: 'equals', value: 'critical' },
      { field: 'crossRegionReplication', operator: 'not_equals', value: true },
      { field: 'environment', operator: 'equals', value: 'production' }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Critical production data should have cross-region replication for DR' }
    ],
    riskWeight: 30,
    tags: ['storage', 'blob', 'replication', 'disaster-recovery']
  }
];

// ============================================================================
// COMBINED EXPORT
// ============================================================================

export const storageRules: BusinessRule[] = [
  ...browserStorageRules,
  ...databaseStorageRules,
  ...fileSystemStorageRules,
  ...cacheStorageRules,
  ...blobStorageRules
];
