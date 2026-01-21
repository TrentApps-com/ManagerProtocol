/**
 * WebSocket & Real-Time Communication Rules
 * Governance rules for WebSocket, Socket.IO, and real-time connections
 */

import type { BusinessRule } from '../types/index.js';
import {
  createEncryptionRule,
  createValidationRule,
  createRateLimitRule
} from './shared-patterns.js';

export const websocketRules: BusinessRule[] = [
  {
    id: 'ws-001',
    name: 'Require WebSocket Authentication',
    description: 'WebSocket connections must authenticate before upgrade',
    type: 'security',
    enabled: true,
    priority: 970,
    conditions: [
      { field: 'actionCategory', operator: 'equals', value: 'network' },
      { field: 'protocol', operator: 'in', value: ['websocket', 'socket.io'] },
      { field: 'authenticated', operator: 'not_equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'deny', message: 'WebSocket connections require authentication before upgrade' }
    ],
    riskWeight: 60,
    tags: ['websocket', 'socket.io', 'security', 'authentication']
  },
  // Message Rate Limiting - uses shared rate limit pattern
  createRateLimitRule({
    id: 'ws-002',
    name: 'Enforce Message Rate Limiting',
    description: 'WebSocket messages must be rate limited per connection',
    limitType: 'message',
    scope: {
      protocol: ['websocket', 'socket.io']
    },
    actionType: 'warn',
    message: 'Implement message rate limiting to prevent flood attacks (e.g., 100 msg/min)',
    priority: 920,
    riskWeight: 40,
    tags: ['websocket', 'dos']
  }),
  {
    id: 'ws-003',
    name: 'Validate Binary Message Size',
    description: 'Binary WebSocket messages must have size limits',
    type: 'security',
    enabled: true,
    priority: 900,
    conditions: [
      { field: 'protocol', operator: 'in', value: ['websocket', 'socket.io'] },
      { field: 'messageType', operator: 'equals', value: 'binary' },
      { field: 'maxMessageSize', operator: 'not_exists', value: null }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Set maximum binary message size to prevent memory exhaustion' }
    ],
    riskWeight: 35,
    tags: ['websocket', 'binary', 'validation', 'dos']
  },
  {
    id: 'ws-004',
    name: 'Require Connection Heartbeat',
    description: 'WebSocket connections should implement ping/pong heartbeat',
    type: 'architecture',
    enabled: true,
    priority: 850,
    conditions: [
      { field: 'protocol', operator: 'in', value: ['websocket', 'socket.io'] },
      { field: 'heartbeatEnabled', operator: 'not_equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Implement heartbeat (ping/pong) to detect dead connections' }
    ],
    riskWeight: 25,
    tags: ['websocket', 'heartbeat', 'connection-health']
  },
  {
    id: 'ws-005',
    name: 'Limit Concurrent Connections',
    description: 'Limit concurrent WebSocket connections per user',
    type: 'operational',
    enabled: true,
    priority: 880,
    conditions: [
      { field: 'protocol', operator: 'in', value: ['websocket', 'socket.io'] },
      { field: 'concurrentConnections', operator: 'greater_than', value: 10 }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'User has >10 concurrent WebSocket connections - possible abuse or leaked connections' }
    ],
    riskWeight: 30,
    tags: ['websocket', 'limits', 'abuse-prevention']
  },
  // Message Schema Validation - uses shared validation pattern
  createValidationRule({
    id: 'ws-006',
    name: 'Validate Message Schema',
    description: 'WebSocket messages should be validated against schema',
    validationType: 'message',
    scope: {
      protocol: ['websocket', 'socket.io']
    },
    actionType: 'warn',
    message: 'Validate WebSocket message structure/schema to prevent injection attacks',
    priority: 860,
    riskWeight: 35,
    tags: ['websocket']
  }),
  // WebSocket TLS Requirement - uses shared encryption pattern
  createEncryptionRule({
    id: 'ws-007',
    name: 'WebSocket TLS Requirement',
    description: 'Production WebSocket connections must use TLS (wss://)',
    encryptionType: 'tls',
    scope: {
      protocol: ['websocket', 'socket.io'],
      environment: 'production'
    },
    actionType: 'deny',
    message: 'Production WebSocket connections must use wss:// (TLS encrypted)',
    priority: 950,
    riskWeight: 55,
    tags: ['websocket', 'tls']
  })
];
