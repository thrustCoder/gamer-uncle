# Push-to-Talk Implementation Phases

## Overview
This document outlines the phased implementation approach for adding push-to-talk functionality to Gamer Uncle, following the architecture patterns established in the codebase.

---

## Phase 0: Security Infrastructure Setup

### 🎯 Objective
Establish Azure Front Door (AFD) and Web Application Firewall (WAF) protection for all API endpoints before implementing voice features.

### 📋 Tasks

#### Azure Infrastructure
- [ ] Configure Azure Front Door for existing App Service
- [ ] Set up WAF policies with rate limiting rules
- [ ] Configure health probes using existing `/health` endpoint
- [ ] Set up origin routing for `/api/*` paths
- [ ] Disable caching for API endpoints (dynamic content)

#### Security Policies
- [ ] Implement geographic restrictions if needed
- [ ] Configure bot protection rules
- [ ] Set up custom WAF rules for common attack patterns
- [ ] Configure global and per-IP rate limiting

#### Configuration Updates
- [ ] Update mobile app `API_BASE_URL` to point to AFD endpoint
- [ ] Update pipeline deployment configs for AFD routing
- [ ] Configure CORS policies through AFD

#### Testing & Validation
- [ ] Verify existing `/api/recommendations` endpoint works through AFD
- [ ] Test rate limiting functionality through new routing
- [ ] Run functional tests against AFD endpoint
- [ ] Validate E2E tests with new API base URL

### ✅ Success Criteria
- All existing API functionality works through Azure Front Door
- Rate limiting policies are enforced correctly
- E2E and functional tests pass with AFD routing
- Security policies are active and logging properly

---

## Phase 1: Core Voice Implementation

### 🎯 Objective
Implement basic push-to-talk functionality with WebRTC integration and backend voice session management.

### 📋 Backend Tasks

#### Shared Models
- [ ] Create `VoiceSessionRequest.cs` in `services/shared/models/`
- [ ] Create `VoiceSessionResponse.cs` in `services/shared/models/`
- [ ] Add models to shared project references

#### API Controller
- [ ] Implement `VoiceController.cs` following existing controller patterns
- [ ] Add rate limiting with `[EnableRateLimiting("DefaultPolicy")]`
- [ ] Implement structured error handling with IP/UserAgent logging
- [ ] Add correlation ID tracking for debugging

#### Service Layer
- [ ] Create `IGameDataService` interface for Cosmos DB queries
- [ ] Implement `GameDataService` with preload context logic
- [ ] Create `IFoundryVoiceService` interface for voice session management
- [ ] Implement `FoundryVoiceService` with session creation logic
- [ ] Register services in `Program.cs`

#### Configuration
- [ ] Add voice service settings to `appsettings.json`
- [ ] Configure environment-specific voice settings
- [ ] Set up `DefaultAzureCredential` authentication for Foundry services

### 📋 Frontend Tasks

#### Mobile App Setup
- [ ] Install `expo-dev-client` and `react-native-webrtc` dependencies
- [ ] Update `app.json` with WebRTC plugins and permissions
- [ ] Create custom Expo development build

#### Voice Session Hook
- [ ] Implement `hooks/useVoiceSession.ts` with WebRTC integration
- [ ] Add error handling and retry logic
- [ ] Implement audio stream management
- [ ] Add session state management

#### UI Components
- [ ] Create `styles/chatVoiceStyles.ts` following existing style patterns
- [ ] Add mic button to `ChatScreen.tsx` following existing UI patterns
- [ ] Implement press-and-hold interaction pattern
- [ ] Add visual feedback for active voice sessions

### 📋 Testing

#### Backend Tests
- [ ] Create `VoiceControllerTests.cs` in `services/tests/functional/`
- [ ] Test valid voice session creation
- [ ] Test error scenarios (invalid gameId, zero players)
- [ ] Test rate limiting on voice endpoints
- [ ] Follow anti-fallback testing patterns

#### Frontend Tests
- [ ] Create `useVoiceSession.test.ts` with React Native Testing Library
- [ ] Mock WebRTC dependencies
- [ ] Test session lifecycle (start/stop)
- [ ] Test error handling scenarios

#### Integration Testing
- [ ] Add voice endpoint to E2E test suite
- [ ] Test voice session creation through AFD
- [ ] Validate correlation ID tracking

### ✅ Success Criteria
- Voice session endpoint responds correctly
- Mobile app can request voice sessions
- WebRTC connection establishes successfully
- All tests pass including rate limiting
- Basic mic button UI is functional

---

## Phase 2: Production Security & Foundry Integration

### 🎯 Objective
Complete production-ready security implementation and full Foundry Live Voice integration.

### 📋 Security Implementation

#### EasyAuth Integration
- [ ] Configure EasyAuth for voice endpoints specifically
- [ ] Set up identity provider integration
- [ ] Configure token validation for voice sessions
- [ ] Test authentication flow through AFD

#### Voice-Specific Security
- [ ] Implement ephemeral token generation (<5 min TTL)
- [ ] Add voice-specific WAF rules to AFD
- [ ] Configure voice endpoint protection policies
- [ ] Set up session-based rate limiting

#### Monitoring & Logging
- [ ] Add Application Insights tracking for voice sessions
- [ ] Implement correlation ID logging across services
- [ ] Add performance metrics for Cosmos queries
- [ ] Set up alerting for voice session failures

### 📋 Foundry Live Voice Integration

#### Backend Integration
- [ ] Complete `FoundryVoiceService` implementation
- [ ] Implement Cosmos DB projection queries for preload context
- [ ] Add context injection as system messages
- [ ] Implement session binding to existing agent conversations

#### WebRTC Signaling
- [ ] Complete WebRTC signaling implementation in mobile app
- [ ] Implement offer/answer exchange with Foundry
- [ ] Add ICE candidate handling
- [ ] Configure audio stream management

#### Context Management
- [ ] Implement preload snippet optimization
- [ ] Add caching for common game lookups
- [ ] Implement mid-turn context streaming
- [ ] Add TTL management for cached data

### 📋 Production Readiness

#### Performance Optimization
- [ ] Target <50ms Cosmos latency for preload queries
- [ ] Implement Redis caching for frequent lookups
- [ ] Optimize WebRTC connection establishment
- [ ] Add performance monitoring and alerting

#### Error Handling & Fallbacks
- [ ] Implement graceful fallback to text chat
- [ ] Add WebRTC connection failure handling
- [ ] Implement audio device error recovery
- [ ] Add network interruption handling

#### iOS App Store Preparation
- [ ] Configure production iOS build settings
- [ ] Set up App Store provisioning profiles
- [ ] Configure push notification certificates if needed
- [ ] Prepare app metadata and screenshots

### 📋 Final Testing

#### Security Testing
- [ ] Penetration testing of voice endpoints
- [ ] Token expiration and refresh testing
- [ ] Rate limiting validation under load
- [ ] Authentication bypass testing

#### Performance Testing
- [ ] Load testing voice session creation
- [ ] WebRTC connection stress testing
- [ ] Cosmos DB query performance validation
- [ ] End-to-end latency measurement

#### User Acceptance Testing
- [ ] Voice quality validation
- [ ] Push-to-talk responsiveness testing
- [ ] Cross-device compatibility testing
- [ ] Accessibility compliance validation

### ✅ Success Criteria
- Full push-to-talk functionality works end-to-end
- Security policies are enforced and tested
- Performance targets are met (<300ms response time)
- iOS app is ready for App Store submission
- All monitoring and alerting is functional

---

## 🚀 Deployment Strategy

### Phase 0 Deployment
- Deploy AFD and WAF to existing infrastructure
- Update mobile app configuration via app updates
- Monitor existing functionality through new routing

### Phase 1 Deployment
- Deploy backend voice services to existing App Service
- Release mobile app update with custom dev client requirement
- Feature flag voice functionality for gradual rollout

### Phase 2 Deployment
- Enable EasyAuth and full security policies
- Complete Foundry integration
- Full production release to App Store

---

## 📊 Success Metrics

### Technical Metrics
- Voice session creation time: <200ms
- WebRTC connection establishment: <500ms
- End-to-end latency: <300ms
- Voice session success rate: >99%

### Security Metrics
- Zero security vulnerabilities in voice endpoints
- Rate limiting effectiveness: >95% attack mitigation
- Token security: No unauthorized access incidents

### User Experience Metrics
- Voice feature adoption rate: >30% of active users
- Session completion rate: >90%
- User satisfaction