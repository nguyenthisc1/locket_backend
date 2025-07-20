# Enhanced Conversation and Message Features

This document outlines the comprehensive conversation and message features implemented in the Locket app backend, including advanced messaging capabilities, group management, threads, reactions, and more.

## 🚀 Features Overview

### Conversation Features
- **Direct Messages & Group Chats**: Support for both 1-on-1 and group conversations
- **Group Management**: Admin controls, member permissions, and group settings
- **Thread Support**: Nested conversations for better organization
- **Conversation Settings**: Custom themes, wallpapers, and notification preferences
- **Search & Filtering**: Advanced search capabilities for conversations
- **Read Receipts**: Track message read status across participants

### Message Features
- **Multiple Message Types**: Text, images, videos, stickers, files, audio, and emotes
- **Reactions**: Emoji reactions with real-time updates
- **Reply System**: Reply to specific messages with context
- **Forward Messages**: Forward messages to other conversations
- **Message Editing**: Edit messages within a time limit
- **Message Pinning**: Pin important messages in conversations
- **Thread Messages**: Create threaded discussions
- **Advanced Search**: Search messages with multiple filters

## 📋 API Endpoints

### Conversations

#### Create Conversation
```http
POST /api/v1/conversations
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "My Group Chat",
  "participants": ["507f1f77bcf86cd799439011", "507f1f77bcf86cd799439012"],
  "isGroup": true,
  "groupSettings": {
    "allowMemberInvite": true,
    "allowMemberEdit": false,
    "allowMemberDelete": false,
    "allowMemberPin": false
  },
  "settings": {
    "muteNotifications": false,
    "theme": "default",
    "customEmoji": "🎉"
  }
}
```

#### Get User Conversations
```http
GET /api/v1/conversations?page=1&limit=20
Authorization: Bearer <token>
```

#### Search Conversations
```http
GET /api/v1/conversations/search?query=group&isGroup=true&page=1&limit=20
Authorization: Bearer <token>
```

#### Update Conversation
```http
PUT /api/v1/conversations/:conversationId
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Updated Group Name",
  "settings": {
    "muteNotifications": true,
    "theme": "dark"
  }
}
```

#### Add Participants
```http
POST /api/v1/conversations/:conversationId/participants
Authorization: Bearer <token>
Content-Type: application/json

{
  "userIds": ["507f1f77bcf86cd799439013", "507f1f77bcf86cd799439014"]
}
```

#### Remove Participant
```http
DELETE /api/v1/conversations/:conversationId/participants
Authorization: Bearer <token>
Content-Type: application/json

{
  "userId": "507f1f77bcf86cd799439013"
}
```

#### Get Threads
```http
GET /api/v1/conversations/:conversationId/threads?page=1&limit=20
Authorization: Bearer <token>
```

#### Leave Conversation
```http
POST /api/v1/conversations/:conversationId/leave
Authorization: Bearer <token>
```

#### Delete Conversation
```http
DELETE /api/v1/conversations/:conversationId
Authorization: Bearer <token>
```

### Messages

#### Send Message
```http
POST /api/v1/messages
Authorization: Bearer <token>
Content-Type: application/json

{
  "conversationId": "507f1f77bcf86cd799439011",
  "text": "Hello everyone!",
  "type": "text",
  "metadata": {
    "clientMessageId": "msg_123",
    "platform": "ios"
  }
}
```

#### Send Media Message
```http
POST /api/v1/messages
Authorization: Bearer <token>
Content-Type: application/json

{
  "conversationId": "507f1f77bcf86cd799439011",
  "type": "image",
  "attachments": [
    {
      "url": "https://example.com/image.jpg",
      "type": "image",
      "fileName": "photo.jpg",
      "fileSize": 1024000,
      "width": 1920,
      "height": 1080,
      "mimeType": "image/jpeg"
    }
  ]
}
```

#### Send Sticker
```http
POST /api/v1/messages
Authorization: Bearer <token>
Content-Type: application/json

{
  "conversationId": "507f1f77bcf86cd799439011",
  "type": "sticker",
  "sticker": {
    "stickerId": "sticker_123",
    "stickerPackId": "pack_456",
    "emoji": "😄"
  }
}
```

#### Reply to Message
```http
POST /api/v1/messages/:messageId/reply
Authorization: Bearer <token>
Content-Type: application/json

{
  "text": "This is my reply!",
  "type": "text"
}
```

#### Add Reaction
```http
POST /api/v1/messages/:messageId/reactions
Authorization: Bearer <token>
Content-Type: application/json

{
  "reactionType": "❤️"
}
```

#### Remove Reaction
```http
DELETE /api/v1/messages/:messageId/reactions
Authorization: Bearer <token>
```

#### Forward Messages
```http
POST /api/v1/messages/forward
Authorization: Bearer <token>
Content-Type: application/json

{
  "targetConversationIds": ["507f1f77bcf86cd799439011", "507f1f77bcf86cd799439012"],
  "messageIds": ["507f1f77bcf86cd799439013", "507f1f77bcf86cd799439014"]
}
```

#### Get Thread Messages
```http
GET /api/v1/messages/:messageId/thread?page=1&limit=50
Authorization: Bearer <token>
```

#### Pin/Unpin Message
```http
POST /api/v1/messages/:messageId/pin
Authorization: Bearer <token>
Content-Type: application/json

{
  "action": "pin"
}
```

#### Search Messages
```http
GET /api/v1/messages/search?query=hello&type=text&hasAttachments=true&page=1&limit=20
Authorization: Bearer <token>
```

#### Edit Message
```http
PUT /api/v1/messages/:messageId
Authorization: Bearer <token>
Content-Type: application/json

{
  "text": "Updated message content"
}
```

#### Delete Message
```http
DELETE /api/v1/messages/:messageId
Authorization: Bearer <token>
```

## 🗄️ Database Models

### Conversation Model
```javascript
{
  name: String,                    // Group name (null for DMs)
  participants: [ObjectId],        // User IDs
  isGroup: Boolean,                // Group or DM
  admin: ObjectId,                 // Group admin
  groupSettings: {
    allowMemberInvite: Boolean,
    allowMemberEdit: Boolean,
    allowMemberDelete: Boolean,
    allowMemberPin: Boolean
  },
  lastMessage: {
    messageId: ObjectId,
    text: String,
    senderId: ObjectId,
    timestamp: Date
  },
  parentConversation: ObjectId,    // For threads
  threadInfo: {
    parentMessageId: ObjectId,
    threadCount: Number,
    lastThreadMessage: Date,
    participants: [ObjectId]
  },
  isActive: Boolean,
  pinnedMessages: [ObjectId],
  settings: {
    muteNotifications: Boolean,
    customEmoji: String,
    theme: String,
    wallpaper: String
  },
  readReceipts: [{
    userId: ObjectId,
    lastReadMessageId: ObjectId,
    lastReadAt: Date
  }]
}
```

### Message Model
```javascript
{
  conversationId: ObjectId,
  senderId: ObjectId,
  text: String,
  type: String,                    // text, image, video, sticker, file, audio, emote
  attachments: [{
    url: String,
    type: String,
    fileName: String,
    fileSize: Number,
    duration: Number,
    thumbnail: String,
    mimeType: String,
    width: Number,
    height: Number
  }],
  replyTo: ObjectId,
  replyInfo: {
    messageId: ObjectId,
    text: String,
    senderName: String,
    attachmentType: String
  },
  forwardedFrom: ObjectId,
  forwardInfo: {
    originalMessageId: ObjectId,
    originalSenderId: ObjectId,
    originalSenderName: String,
    originalConversationId: ObjectId,
    originalConversationName: String,
    forwardedAt: Date
  },
  threadInfo: {
    parentMessageId: ObjectId,
    replyCount: Number,
    lastReplyAt: Date,
    participants: [ObjectId]
  },
  reactions: [{
    userId: ObjectId,
    type: String,
    createdAt: Date
  }],
  isRead: Boolean,
  isEdited: Boolean,
  isDeleted: Boolean,
  isPinned: Boolean,
  editHistory: [{
    text: String,
    editedAt: Date
  }],
  metadata: {
    clientMessageId: String,
    deviceId: String,
    platform: String
  },
  sticker: {
    stickerId: String,
    stickerPackId: String,
    emoji: String
  },
  emote: {
    emoteId: String,
    emoteType: String,
    emoji: String
  }
}
```

## 🔧 DTOs and Validation

### Conversation DTOs
- `ConversationDTO`: Base conversation data transfer object
- `CreateConversationDTO`: For creating new conversations
- `UpdateConversationDTO`: For updating conversation settings
- `AddParticipantDTO`: For adding participants
- `RemoveParticipantDTO`: For removing participants
- `SearchConversationsDTO`: For conversation search
- `ConversationResponseDTO`: Response with populated data
- `ConversationListResponseDTO`: Paginated conversation list

### Message DTOs
- `MessageDTO`: Base message data transfer object
- `CreateMessageDTO`: For sending messages
- `UpdateMessageDTO`: For editing messages
- `AddReactionDTO`: For adding reactions
- `RemoveReactionDTO`: For removing reactions
- `ForwardMessageDTO`: For forwarding messages
- `ReplyMessageDTO`: For replying to messages
- `SearchMessagesDTO`: For message search
- `ThreadMessagesDTO`: For thread operations
- `PinMessageDTO`: For pinning/unpinning messages
- `MessageResponseDTO`: Response with populated data
- `MessageListResponseDTO`: Paginated message list

## 🛡️ Security & Permissions

### Authentication
- All endpoints require JWT authentication
- Token validation via `authMiddleware`

### Authorization
- **Conversation Access**: Users can only access conversations they're participants in
- **Message Permissions**: 
  - Only sender can edit/delete their messages
  - Message editing limited to 15 minutes after sending
  - Group admin controls for group-specific actions
- **Group Permissions**:
  - Admin can manage all group settings
  - Member permissions controlled by `groupSettings`
  - Cannot remove admin from group

## 📊 Performance Optimizations

### Database Indexes
```javascript
// Conversation indexes
conversationSchema.index({ participants: 1 });
conversationSchema.index({ isGroup: 1 });
conversationSchema.index({ parentConversation: 1 });
conversationSchema.index({ 'lastMessage.timestamp': -1 });
conversationSchema.index({ 'threadInfo.lastThreadMessage': -1 });

// Message indexes
messageSchema.index({ conversationId: 1, createdAt: -1 });
messageSchema.index({ senderId: 1 });
messageSchema.index({ replyTo: 1 });
messageSchema.index({ 'threadInfo.parentMessageId': 1 });
messageSchema.index({ type: 1 });
messageSchema.index({ 'reactions.userId': 1 });
messageSchema.index({ isDeleted: 1 });
messageSchema.index({ isPinned: 1 });
```

### Pagination
- All list endpoints support pagination
- Configurable page size limits
- Efficient skip/limit queries

### Population
- Strategic population of related data
- Selective field projection
- Nested population for complex relationships

## 🔄 Real-time Features

### WebSocket Integration Ready
The models and controllers are designed to support real-time features:
- Message delivery status
- Typing indicators
- Online/offline status
- Real-time reactions
- Live message updates

### Event-Driven Architecture
- Message creation events
- Reaction updates
- Conversation state changes
- Thread activity notifications

## 🧪 Testing Considerations

### Unit Tests
- DTO validation tests
- Controller method tests
- Model method tests
- Permission validation tests

### Integration Tests
- API endpoint tests
- Database operation tests
- Authentication flow tests
- Error handling tests

### Performance Tests
- Large conversation load tests
- Message search performance
- Pagination efficiency tests

## 🚀 Deployment Considerations

### Environment Variables
```bash
# Database
MONGODB_URI=mongodb://localhost:27017/locket_app

# JWT
JWT_SECRET=your_jwt_secret
JWT_REFRESH_SECRET=your_refresh_secret

# Cloudinary (for media uploads)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

### Scaling Considerations
- Database connection pooling
- Message queue for heavy operations
- CDN for media files
- Redis for caching
- Horizontal scaling with load balancers

## 📱 Flutter Integration

### API Service Example
```dart
class ConversationService {
  static Future<ConversationResponse> createConversation({
    required String name,
    required List<String> participants,
    bool isGroup = false,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/conversations'),
      headers: await _getAuthHeaders(),
      body: jsonEncode({
        'name': name,
        'participants': participants,
        'isGroup': isGroup,
      }),
    );
    
    return ConversationResponse.fromJson(jsonDecode(response.body));
  }
}
```

### Message Service Example
```dart
class MessageService {
  static Future<MessageResponse> sendMessage({
    required String conversationId,
    required String text,
    String? replyTo,
    List<Attachment>? attachments,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/messages'),
      headers: await _getAuthHeaders(),
      body: jsonEncode({
        'conversationId': conversationId,
        'text': text,
        'replyTo': replyTo,
        'attachments': attachments?.map((a) => a.toJson()).toList(),
      }),
    );
    
    return MessageResponse.fromJson(jsonDecode(response.body));
  }
}
```

## 🔮 Future Enhancements

### Planned Features
- **Voice Messages**: Audio recording and playback
- **Video Calls**: WebRTC integration
- **Message Encryption**: End-to-end encryption
- **Message Scheduling**: Send messages at specific times
- **Message Translation**: Multi-language support
- **Advanced Search**: Full-text search with filters
- **Message Templates**: Predefined message templates
- **Message Analytics**: Usage statistics and insights

### Technical Improvements
- **GraphQL API**: More efficient data fetching
- **Microservices**: Service decomposition
- **Event Sourcing**: Message history and audit trails
- **Machine Learning**: Smart message suggestions
- **Push Notifications**: Real-time notifications
- **Offline Support**: Message queuing and sync

## 📚 Additional Resources

- [API Documentation](./src/docs/)
- [Swagger UI](./api/v1/docs)
- [Database Schema](./src/models/)
- [Controller Logic](./src/controllers/)
- [Route Definitions](./src/routes/)
- [DTO Definitions](./src/dtos/)

---

This comprehensive messaging system provides a solid foundation for a modern chat application with advanced features, scalability, and maintainability. 