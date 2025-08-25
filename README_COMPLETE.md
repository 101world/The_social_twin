# 101 World - Complete AI Chat + Credit System

A production-ready, subscription-based AI chat platform with topic organization, media generation, and credit management.

🔥 **Latest Update**: Mobile UI optimized with hidden empty-state prompt and unified Create button features across desktop/mobile.

## 🚀 Features

### Core Functionality
- **Topic-based Chat Organization**: Create, manage, and organize conversations by topics
- **AI Text Generation**: Chat with AI assistants (1 credit per message)
- **Image Generation**: Create AI-generated images (5 credits per image)
- **Video Generation**: Generate AI videos (10 credits per video)
- **Image Modification**: Modify existing images (3 credits per modification)
- **Credit System**: Atomic credit deduction with transaction history
- **Subscription Plans**: Multiple tiers with different credit allocations

### Technical Features
- **Real-time Chat**: Live message updates and media generation status
- **Credit Management**: Secure credit deduction with database transactions
- **Media Storage**: Track all generated media with metadata
- **User Authentication**: Clerk-based authentication with Supabase backend
- **Responsive UI**: Modern, mobile-friendly interface
- **Settings Persistence**: RunPod URL configuration saved in localStorage

## 🏗️ Architecture

### Database Schema
- **users**: User profiles, credits, subscription status
- **chat_topics**: Organized conversation topics
- **chat_messages**: Individual chat messages with metadata
- **media_generations**: AI-generated media with status tracking
- **credit_transactions**: Complete audit trail of credit usage
- **subscription_plans**: Available subscription tiers

### API Endpoints
- `POST/GET /api/topics` - Topic management
- `GET/PUT/DELETE /api/topics/[topicId]` - Individual topic operations
- `POST/GET /api/topics/[topicId]/messages` - Message handling
- `POST/GET /api/topics/[topicId]/media` - Media generation
- `GET/POST /api/users/credits` - Credit management

### Security Features
- Row Level Security (RLS) policies
- User ownership validation
- Atomic credit operations
- Input sanitization and validation

## 🛠️ Setup Instructions

### 1. Prerequisites
- Node.js 18+ and npm
- Git
- Supabase account
- Clerk account
- Razorpay account (for payments)

### 2. Database Setup

#### Run the Complete Schema
1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy and paste the entire contents of `supabase_schema_complete.sql`
4. Execute the script

This will create:
- All necessary tables with proper relationships
- RLS policies for security
- Database functions for credit management
- Default subscription plans
- Indexes for performance

#### Verify Setup
Check that these tables exist:
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('users', 'chat_topics', 'chat_messages', 'media_generations', 'credit_transactions', 'subscription_plans');
```

### 3. Environment Configuration

Create `.env.local` with your credentials:

```env
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_key_here
CLERK_SECRET_KEY=sk_test_your_secret_here
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/

# Supabase Database
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here

# Razorpay Payments (configured for Indian market)
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_your_key_here
RAZORPAY_KEY_SECRET=your_secret_here
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
```

### 4. Install Dependencies

```bash
npm install
```

### 5. Run the Application

```bash
npm run dev
```

The app will be available at `http://localhost:3000`

## 📱 Usage Guide

### First Time Setup
1. **Sign In**: Use Clerk authentication to create an account
2. **Create Topic**: Click "New Topic" to start your first conversation
3. **Configure RunPod**: Go to Settings (gear icon) and add your RunPod URLs
4. **Start Chatting**: Select a topic and begin your conversation

### Chat Features

#### Text Generation
- Select "💬 Text" mode
- Type your message and press Enter
- Costs 1 credit per message
- AI responses are automatically generated

#### Image Generation
- Select "🖼️ Image" mode
- Describe the image you want
- Costs 5 credits per image
- Generated images appear in chat with download options

#### Video Generation
- Select "🎥 Video" mode
- Provide a detailed video description
- Costs 10 credits per video
- Videos include thumbnails and playback controls

#### Image Modification
- Select "✏️ Modify" mode
- Upload an image and describe changes
- Costs 3 credits per modification
- Supports various modification types

### Topic Management
- **Create**: Click "New Topic" with title and optional description
- **Organize**: Switch between topics for different conversation contexts
- **Edit**: Click the pencil icon to modify topic details
- **Archive**: Topics are soft-deleted and can be restored

### Credit System
- **View Balance**: Credits displayed in top-right corner
- **Usage Tracking**: See credit costs for each generation type
- **Low Credit Warnings**: Alerts when running low on credits
- **Transaction History**: Complete audit trail of all credit operations

## 🔧 Configuration

### RunPod Integration
Configure your AI service endpoints in Settings:

```javascript
// Example RunPod URLs
{
  "text": "https://your-runpod.com/text-generation",
  "image": "https://your-runpod.com/image-generation", 
  "video": "https://your-runpod.com/video-generation",
  "image-modify": "https://your-runpod.com/image-modification"
}
```

### Subscription Plans
Default plans are automatically created:

| Plan | Monthly Price | Credits/Month | Features |
|------|---------------|---------------|----------|
| Free | $0 | 10 | Basic access, limited features |
| Starter | $9.99 | 100 | Standard features |
| Pro | $19.99 | 500 | Advanced features, priority support |
| Enterprise | $49.99 | 2000 | Full features, API access |

## 🚀 Production Deployment

### 1. Environment Variables
- Set production Clerk keys
- Configure production Supabase instance
- Add Razorpay webhook endpoints
- Set proper CORS origins

### 2. Database Optimization
- Monitor query performance
- Add additional indexes as needed
- Set up database backups
- Configure connection pooling

### 3. Security Hardening
- Enable HTTPS everywhere
- Set secure cookie options
- Configure CSP headers
- Implement rate limiting

### 4. Monitoring & Analytics
- Set up error tracking (Sentry)
- Monitor API response times
- Track credit usage patterns
- Set up alerts for system issues

## 🔒 Security Features

### Authentication
- Clerk-based user management
- JWT token validation
- Secure session handling

### Data Protection
- Row Level Security (RLS)
- User data isolation
- Input sanitization
- SQL injection prevention

### Credit Security
- Atomic transactions
- Balance validation
- Audit trail logging
- Fraud detection hooks

## 📊 Performance Optimization

### Database
- Efficient indexing strategy
- Query optimization
- Connection pooling
- Read replicas for scaling

### Frontend
- Component lazy loading
- Message pagination
- Image optimization
- Debounced input handling

### API
- Response caching
- Request batching
- Background job processing
- CDN integration

## 🧪 Testing

### API Testing
```bash
# Test topic creation
curl -X POST http://localhost:3000/api/topics \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT" \
  -d '{"title": "Test Topic", "description": "Test Description"}'

# Test message posting
curl -X POST http://localhost:3000/api/topics/TOPIC_ID/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT" \
  -d '{"content": "Hello AI!", "role": "user"}'
```

### Frontend Testing
- Test topic creation and management
- Verify credit deduction accuracy
- Test media generation workflows
- Validate responsive design

## 🐛 Troubleshooting

### Common Issues

#### Database Connection Errors
```bash
# Check Supabase connection
npm run db:test

# Verify environment variables
echo $NEXT_PUBLIC_SUPABASE_URL
```

#### Credit System Issues
```sql
-- Check user credits
SELECT * FROM users WHERE id = 'your_user_id';

-- View credit transactions
SELECT * FROM credit_transactions WHERE user_id = 'your_user_id' ORDER BY created_at DESC;
```

#### Media Generation Failures
- Verify RunPod URLs are correct
- Check credit balance
- Review API response logs
- Validate prompt content

### Debug Mode
Enable debug logging:

```env
DEBUG=app:*,api:*,db:*
NODE_ENV=development
```

## 🔮 Future Enhancements

### Planned Features
- **Real-time Updates**: WebSocket integration for live chat
- **Advanced AI Models**: Multiple model selection
- **Batch Processing**: Generate multiple images/videos at once
- **API Access**: RESTful API for external integrations
- **Admin Panel**: User management and analytics
- **Mobile App**: React Native mobile application

### Integration Opportunities
- **Razorpay Webhooks**: Automatic credit top-ups
- **Analytics**: Usage tracking and insights
- **CDN**: Media storage and delivery optimization
- **Queue System**: Background job processing
- **Monitoring**: Application performance monitoring

## 📚 API Reference

### Authentication
All API endpoints require a valid Clerk JWT token in the Authorization header:

```http
Authorization: Bearer <jwt_token>
```

### Rate Limits
- **Text Generation**: 100 requests/minute
- **Image Generation**: 20 requests/minute  
- **Video Generation**: 10 requests/minute
- **API Calls**: 1000 requests/hour

### Error Codes
- `400` - Bad Request (invalid input)
- `401` - Unauthorized (missing/invalid token)
- `402` - Payment Required (insufficient credits)
- `404` - Not Found (resource doesn't exist)
- `429` - Too Many Requests (rate limit exceeded)
- `500` - Internal Server Error

## 🤝 Contributing

### Development Setup
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

### Code Style
- Use TypeScript for all new code
- Follow ESLint configuration
- Write meaningful commit messages
- Add JSDoc comments for complex functions

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

### Getting Help
- Check the troubleshooting section
- Review API documentation
- Search existing issues
- Create a new issue with detailed information

### Community
- Join our Discord server
- Follow updates on Twitter
- Subscribe to our newsletter
- Contribute to documentation

---

**Built with ❤️ for the 101 World community**

*This system is designed to be production-ready and scalable. Follow the setup instructions carefully and test thoroughly before deploying to production.*

---

Note: Deployment trigger commit for MOBILE GEN flow verification (2025-08-25).
