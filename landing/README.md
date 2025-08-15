# Sweats Landing Server

A Node.js server for creating shareable challenge URLs with rich social media previews.

## Features

- 🔗 Create shareable challenge URLs with unique IDs
- 🖼️ Generate dynamic preview images for social sharing
- 📱 QR code generation for easy mobile access
- 🎯 Rich meta tags for Facebook, Twitter, WhatsApp, Instagram
- 🔄 Deep linking to Sweats app
- 💾 In-memory challenge storage (production ready for database)
- 🎨 Beautiful, responsive challenge preview pages

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the development server:**
   ```bash
   npm run dev
   ```

3. **Start the production server:**
   ```bash
   npm start
   ```

The server will be available at `http://localhost:3001`

## API Endpoints

### Create Challenge Share
```
POST /api/challenges
```

**Request Body:**
```json
{
  "title": "30-Day Step Challenge",
  "description": "Walk 10,000 steps daily for 30 days!",
  "type": "steps",
  "goal": 10000,
  "unit": "steps",
  "duration": 30,
  "participants": 15,
  "createdBy": "John Doe",
  "difficulty": "medium",
  "tags": ["walking", "fitness", "30days"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "challenge-uuid",
    "shareId": "share-uuid",
    "shareableUrl": "https://yourdomain.com/challenge/share-uuid",
    "qrCode": "data:image/png;base64,..."
  }
}
```

### Get Challenge Data
```
GET /api/challenges/:shareId
```

### Get Challenge Preview Image
```
GET /api/challenges/:shareId/image
```
Returns a 1200x630 PNG image optimized for social media sharing.

### Challenge Share Page
```
GET /challenge/:shareId
```
Returns a fully rendered HTML page with rich meta tags for social sharing.

## Environment Variables

Create a `.env` file with the following variables:

```env
PORT=3001
NODE_ENV=development
APP_NAME=Sweats
APP_URL=sweats://
APP_STORE_URL=https://apps.apple.com/app/sweats
```

## Social Media Integration

The generated challenge pages include optimized meta tags for:

- **Facebook/LinkedIn**: Open Graph tags with preview images
- **Twitter**: Twitter Card with large image support
- **WhatsApp**: Rich link previews with images
- **Instagram**: Image support for stories and bio links
- **Telegram**: Image previews in shared links

## Deep Linking

When users click "Join Challenge", the app attempts to:
1. Open the Sweats app directly using `sweats://challenge/{challengeId}`
2. Fallback to the App Store if the app isn't installed

## Challenge Types

Supported challenge types:
- `steps` - Daily step goals
- `distance` - Running/walking distance
- `workout` - Workout frequency
- `weight_loss` - Weight loss goals
- `consistency` - Habit consistency

## Image Generation

The server automatically generates beautiful challenge preview images using:
- SVG-based graphics for crisp visuals
- Challenge-specific branding and colors
- QR codes for easy mobile access
- Optimized 1200x630 dimensions for social media

## Usage in Sweats App

From your React Native app, you can create shareable challenges:

```javascript
const createShareableChallenge = async (challengeData) => {
  try {
    const response = await fetch('http://localhost:3001/api/challenges', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(challengeData)
    });
    
    const result = await response.json();
    
    if (result.success) {
      // Use result.data.shareableUrl for sharing
      // Use result.data.qrCode for QR code display
      return result.data;
    }
  } catch (error) {
    console.error('Failed to create shareable challenge:', error);
  }
};

// Example usage
const shareChallenge = async () => {
  const shareData = await createShareableChallenge({
    title: "Morning Run Challenge",
    description: "Run 5km every morning for a week!",
    type: "distance",
    goal: 5,
    unit: "km",
    duration: 7,
    participants: 23,
    createdBy: currentUser.name,
    difficulty: "medium"
  });
  
  if (shareData) {
    // Open native share dialog
    Share.share({
      message: `Join my ${shareData.title} on Sweats!`,
      url: shareData.shareableUrl
    });
  }
};
```

## Production Deployment

For production deployment:

1. **Environment Setup:**
   - Set `NODE_ENV=production`
   - Configure proper domain in meta tags
   - Set up database connection (replace in-memory store)

2. **Database Integration:**
   - Replace Map-based storage with PostgreSQL/MongoDB
   - Add proper data persistence
   - Implement cleanup for expired challenges

3. **Image Storage:**
   - Store generated images in AWS S3 or similar
   - Implement image caching
   - Add CDN for faster delivery

4. **Security:**
   - Add rate limiting
   - Implement API authentication
   - Add CORS configuration
   - Input validation and sanitization

## File Structure

```
landing/
├── server.js          # Main server file
├── package.json       # Dependencies and scripts
├── .env              # Environment variables
├── 404.html          # 404 error page
├── README.md         # This file
└── public/           # Static assets (if needed)
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details.
