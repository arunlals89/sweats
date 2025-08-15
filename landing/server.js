const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet({
  contentSecurityPolicy: false // Allow inline styles for dynamic meta tags
}));
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static('.', {
  setHeaders: (res, path) => {
    if (path.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
}));

// In-memory store for challenges (in production, use a database)
const challengeStore = new Map();

// Challenge data structure
const createChallengeData = (data) => ({
  id: data.id || uuidv4(),
  title: data.title || 'Fitness Challenge',
  description: data.description || 'Join this amazing fitness challenge!',
  type: data.type || 'steps', // steps, distance, workout, weight_loss, consistency
  goal: data.goal || 10000,
  unit: data.unit || 'steps',
  duration: data.duration || 7, // days
  participants: data.participants || 0,
  startDate: data.startDate || new Date().toISOString(),
  endDate: data.endDate || new Date(Date.now() + (data.duration || 7) * 24 * 60 * 60 * 1000).toISOString(),
  createdBy: data.createdBy || 'Anonymous',
  avatar: data.avatar || null,
  prize: data.prize || null,
  difficulty: data.difficulty || 'medium', // easy, medium, hard
  tags: data.tags || [],
  isPublic: data.isPublic !== false,
  shareableUrl: null,
  qrCode: null,
  createdAt: new Date().toISOString()
});

// Generate challenge preview image as SVG
const generateChallengeImage = async (challengeData) => {
  try {
    const width = 1200;
    const height = 630;
    
    // Create SVG for the challenge preview
    const svg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#000000"/>
            <stop offset="100%" style="stop-color:#1C1C1E"/>
          </linearGradient>
          <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" style="stop-color:#00E676"/>
            <stop offset="100%" style="stop-color:#00C853"/>
          </linearGradient>
        </defs>
        
        <!-- Background -->
        <rect width="100%" height="100%" fill="url(#bg)"/>
        
        <!-- Header bar -->
        <rect x="0" y="0" width="100%" height="8" fill="url(#accent)"/>
        
        <!-- Sweats logo and branding -->
        <text x="60" y="100" font-family="Arial, sans-serif" font-size="32" font-weight="bold" fill="white">
          🏃‍♂️ Sweats
        </text>
        
        <!-- Challenge title -->
        <text x="60" y="200" font-family="Arial, sans-serif" font-size="48" font-weight="bold" fill="white">
          ${challengeData.title.length > 30 ? challengeData.title.substring(0, 30) + '...' : challengeData.title}
        </text>
        
        <!-- Challenge details -->
        <text x="60" y="260" font-family="Arial, sans-serif" font-size="24" fill="#9E9E9E">
          ${challengeData.type.toUpperCase()} CHALLENGE
        </text>
        
        <!-- Goal -->
        <text x="60" y="320" font-family="Arial, sans-serif" font-size="32" fill="#00E676">
          Goal: ${challengeData.goal.toLocaleString()} ${challengeData.unit}
        </text>
        
        <!-- Duration -->
        <text x="60" y="370" font-family="Arial, sans-serif" font-size="24" fill="white">
          Duration: ${challengeData.duration} days
        </text>
        
        <!-- Participants -->
        <text x="60" y="420" font-family="Arial, sans-serif" font-size="24" fill="white">
          ${challengeData.participants} participants joined
        </text>
        
        <!-- Description -->
        <text x="60" y="480" font-family="Arial, sans-serif" font-size="20" fill="#9E9E9E">
          ${challengeData.description.length > 80 ? challengeData.description.substring(0, 80) + '...' : challengeData.description}
        </text>
        
        <!-- Call to action -->
        <rect x="60" y="520" width="300" height="60" rx="30" fill="url(#accent)"/>
        <text x="210" y="560" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="white" text-anchor="middle">
          Join Challenge
        </text>
        
        <!-- App icon placeholder -->
        <circle cx="1050" cy="150" r="80" fill="url(#accent)"/>
        <text x="1050" y="170" font-family="Arial, sans-serif" font-size="60" fill="white" text-anchor="middle">
          💪
        </text>
        
        <!-- QR Code placeholder -->
        <rect x="950" y="400" width="180" height="180" rx="20" fill="white"/>
        <text x="1040" y="500" font-family="Arial, sans-serif" font-size="16" fill="black" text-anchor="middle">
          Scan to Join
        </text>
      </svg>
    `;
    
    return Buffer.from(svg, 'utf-8');
  } catch (error) {
    console.error('Error generating challenge image:', error);
    return null;
  }
};

// API Routes

// Create or update a challenge share
app.post('/api/challenges', async (req, res) => {
  try {
    const challengeData = createChallengeData(req.body);
    
    // Generate shareable URL
    const shareId = uuidv4();
    challengeData.shareableUrl = `${req.protocol}://${req.get('host')}/challenge/${shareId}`;
    
    // Generate QR code
    try {
      challengeData.qrCode = await QRCode.toDataURL(challengeData.shareableUrl);
    } catch (qrError) {
      console.error('QR code generation failed:', qrError);
    }
    
    // Store challenge data
    challengeStore.set(shareId, challengeData);
    
    res.status(201).json({
      success: true,
      data: {
        id: challengeData.id,
        shareId,
        shareableUrl: challengeData.shareableUrl,
        qrCode: challengeData.qrCode
      }
    });
  } catch (error) {
    console.error('Error creating challenge:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create challenge share'
    });
  }
});

// Get challenge data
app.get('/api/challenges/:shareId', (req, res) => {
  try {
    const { shareId } = req.params;
    const challengeData = challengeStore.get(shareId);
    
    if (!challengeData) {
      return res.status(404).json({
        success: false,
        message: 'Challenge not found'
      });
    }
    
    res.json({
      success: true,
      data: challengeData
    });
  } catch (error) {
    console.error('Error fetching challenge:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch challenge'
    });
  }
});

// Get challenge preview image
app.get('/api/challenges/:shareId/image', async (req, res) => {
  try {
    const { shareId } = req.params;
    const challengeData = challengeStore.get(shareId);
    
    if (!challengeData) {
      return res.status(404).send('Challenge not found');
    }
    
    const svgBuffer = await generateChallengeImage(challengeData);
    
    if (!svgBuffer) {
      return res.status(500).send('Failed to generate image');
    }
    
    res.set({
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=3600'
    });
    
    res.send(svgBuffer);
  } catch (error) {
    console.error('Error generating image:', error);
    res.status(500).send('Failed to generate image');
  }
});

// Challenge share page with meta tags for social sharing
app.get('/challenge/:shareId', (req, res) => {
  try {
    const { shareId } = req.params;
    const challengeData = challengeStore.get(shareId);
    
    if (!challengeData) {
      return res.status(404).sendFile(path.join(__dirname, '404.html'));
    }
    
    const challengeUrl = `${req.protocol}://${req.get('host')}/challenge/${shareId}`;
    const imageUrl = `${req.protocol}://${req.get('host')}/api/challenges/${shareId}/image`;
    const appDeepLink = `sweats://challenge/${challengeData.id}`;
    const appStoreUrl = 'https://apps.apple.com/app/sweats'; // Update with actual App Store URL
    
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${challengeData.title} - Sweats Challenge</title>
    <meta name="description" content="${challengeData.description}">
    
    <!-- Open Graph Meta Tags for Facebook, LinkedIn, etc. -->
    <meta property="og:title" content="${challengeData.title} - Sweats Challenge">
    <meta property="og:description" content="${challengeData.description}">
    <meta property="og:image" content="${imageUrl}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:url" content="${challengeUrl}">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="Sweats">
    
    <!-- Twitter Card Meta Tags -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${challengeData.title} - Sweats Challenge">
    <meta name="twitter:description" content="${challengeData.description}">
    <meta name="twitter:image" content="${imageUrl}">
    <meta name="twitter:site" content="@sweatsapp">
    
    <!-- WhatsApp specific -->
    <meta property="og:image:alt" content="Join ${challengeData.title} on Sweats">
    
    <!-- Instagram specific -->
    <meta property="instagram:image" content="${imageUrl}">
    
    <!-- Telegram specific -->
    <meta property="telegram:image" content="${imageUrl}">
    
    <!-- Favicon -->
    <link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon.png">
    <link rel="apple-touch-icon" sizes="180x180" href="/assets/icon.png">
    
    <!-- Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Urbanist:ital,wght@0,100..900;1,100..900&display=swap" rel="stylesheet">
    
    <!-- Ionicons -->
    <script type="module" src="https://unpkg.com/ionicons@7.1.0/dist/ionicons/ionicons.esm.js"></script>
    <script nomodule src="https://unpkg.com/ionicons@7.1.0/dist/ionicons/ionicons.js"></script>
    
    <style>
        :root {
            --primary-bg: #000000;
            --secondary-bg: #1C1C1E;
            --card-bg: #2C2C2E;
            --accent-green: #00E676;
            --accent-blue: #007AFF;
            --accent-purple: #BF5AF2;
            --accent-orange: #FF9500;
            --accent-red: #FF3B30;
            --text-primary: #FFFFFF;
            --text-secondary: #9E9E9E;
            --text-tertiary: #666666;
            --border-color: #3A3A3C;
            --glass-bg: rgba(255, 255, 255, 0.05);
            --glass-border: rgba(255, 255, 255, 0.1);
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Urbanist', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: var(--primary-bg);
            color: var(--text-primary);
            line-height: 1.6;
            min-height: 100vh;
        }

        .container {
            max-width: 800px;
            margin: 0 auto;
            padding: 2rem;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            justify-content: center;
        }

        .challenge-card {
            background: var(--glass-bg);
            border: 1px solid var(--glass-border);
            border-radius: 24px;
            padding: 3rem;
            backdrop-filter: blur(20px);
            text-align: center;
            position: relative;
            overflow: hidden;
        }

        .challenge-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 4px;
            background: linear-gradient(90deg, var(--accent-green), var(--accent-blue));
        }

        .logo {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
            margin-bottom: 2rem;
            font-size: 1.5rem;
            font-weight: 800;
        }

        .logo-icon {
            width: 40px;
            height: 40px;
            background: linear-gradient(135deg, var(--accent-green), #00C853);
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
        }

        .challenge-type {
            display: inline-block;
            background: var(--accent-green);
            color: var(--primary-bg);
            padding: 0.5rem 1rem;
            border-radius: 50px;
            font-size: 0.875rem;
            font-weight: 600;
            text-transform: uppercase;
            margin-bottom: 1rem;
        }

        .challenge-title {
            font-size: 2.5rem;
            font-weight: 800;
            margin-bottom: 1rem;
            background: linear-gradient(135deg, var(--text-primary), var(--accent-green));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        .challenge-description {
            font-size: 1.1rem;
            color: var(--text-secondary);
            margin-bottom: 2rem;
            line-height: 1.6;
        }

        .challenge-stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 1.5rem;
            margin-bottom: 2rem;
        }

        .stat {
            background: var(--secondary-bg);
            border-radius: 16px;
            padding: 1.5rem;
        }

        .stat-value {
            font-size: 1.8rem;
            font-weight: 700;
            color: var(--accent-green);
            margin-bottom: 0.5rem;
        }

        .stat-label {
            font-size: 0.9rem;
            color: var(--text-secondary);
            text-transform: uppercase;
            font-weight: 500;
        }

        .action-buttons {
            display: flex;
            flex-direction: column;
            gap: 1rem;
            align-items: center;
        }

        .primary-button {
            background: linear-gradient(135deg, var(--accent-green), #00C853);
            color: var(--text-primary);
            padding: 1rem 2rem;
            border-radius: 16px;
            text-decoration: none;
            font-weight: 600;
            font-size: 1.1rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
            transition: all 0.3s ease;
            border: none;
            cursor: pointer;
            width: 100%;
            max-width: 300px;
            justify-content: center;
        }

        .primary-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 15px 40px rgba(0, 230, 118, 0.4);
        }

        .secondary-button {
            color: var(--text-primary);
            padding: 1rem 2rem;
            border: 1px solid var(--border-color);
            border-radius: 16px;
            text-decoration: none;
            font-weight: 600;
            font-size: 1rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
            transition: all 0.3s ease;
            background: var(--glass-bg);
            backdrop-filter: blur(10px);
            width: 100%;
            max-width: 300px;
            justify-content: center;
        }

        .secondary-button:hover {
            border-color: var(--accent-green);
            background: rgba(0, 230, 118, 0.1);
        }

        .share-buttons {
            margin-top: 2rem;
            padding-top: 2rem;
            border-top: 1px solid var(--border-color);
        }

        .share-title {
            font-size: 1.2rem;
            font-weight: 600;
            margin-bottom: 1rem;
        }

        .share-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
            gap: 1rem;
        }

        .share-button {
            background: var(--secondary-bg);
            border: 1px solid var(--border-color);
            border-radius: 12px;
            padding: 1rem;
            text-decoration: none;
            color: var(--text-primary);
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 0.5rem;
            transition: all 0.3s ease;
            font-size: 0.875rem;
            font-weight: 500;
        }

        .share-button:hover {
            transform: translateY(-2px);
            border-color: var(--accent-green);
        }

        .share-button ion-icon {
            font-size: 1.5rem;
        }

        .qr-section {
            margin-top: 2rem;
            padding-top: 2rem;
            border-top: 1px solid var(--border-color);
        }

        .qr-code {
            width: 150px;
            height: 150px;
            margin: 1rem auto;
            background: white;
            border-radius: 16px;
            padding: 1rem;
        }

        .qr-code img {
            width: 100%;
            height: 100%;
        }

        @media (max-width: 768px) {
            .container {
                padding: 1rem;
            }

            .challenge-card {
                padding: 2rem;
            }

            .challenge-title {
                font-size: 2rem;
            }

            .challenge-stats {
                grid-template-columns: 1fr 1fr;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="challenge-card">
            <div class="logo">
                <div class="logo-icon">💪</div>
                Sweats
            </div>
            
            <div class="challenge-type">${challengeData.type} Challenge</div>
            
            <h1 class="challenge-title">${challengeData.title}</h1>
            
            <p class="challenge-description">${challengeData.description}</p>
            
            <div class="challenge-stats">
                <div class="stat">
                    <div class="stat-value">${challengeData.goal.toLocaleString()}</div>
                    <div class="stat-label">${challengeData.unit} Goal</div>
                </div>
                <div class="stat">
                    <div class="stat-value">${challengeData.duration}</div>
                    <div class="stat-label">Days</div>
                </div>
                <div class="stat">
                    <div class="stat-value">${challengeData.participants}</div>
                    <div class="stat-label">Participants</div>
                </div>
                <div class="stat">
                    <div class="stat-value">${challengeData.difficulty}</div>
                    <div class="stat-label">Difficulty</div>
                </div>
            </div>
            
            <div class="action-buttons">
                <button class="primary-button" onclick="openApp()">
                    <ion-icon name="rocket"></ion-icon>
                    Join Challenge in Sweats
                </button>
                
                <a href="${appStoreUrl}" class="secondary-button" target="_blank">
                    <ion-icon name="download"></ion-icon>
                    Download Sweats App
                </a>
            </div>
            
            <div class="share-buttons">
                <h3 class="share-title">Share this Challenge</h3>
                <div class="share-grid">
                    <a href="#" class="share-button" onclick="shareToWhatsApp()">
                        <ion-icon name="logo-whatsapp"></ion-icon>
                        WhatsApp
                    </a>
                    <a href="#" class="share-button" onclick="shareToTwitter()">
                        <ion-icon name="logo-twitter"></ion-icon>
                        Twitter
                    </a>
                    <a href="#" class="share-button" onclick="shareToFacebook()">
                        <ion-icon name="logo-facebook"></ion-icon>
                        Facebook
                    </a>
                    <a href="#" class="share-button" onclick="shareToInstagram()">
                        <ion-icon name="logo-instagram"></ion-icon>
                        Instagram
                    </a>
                    <a href="#" class="share-button" onclick="copyLink()">
                        <ion-icon name="link"></ion-icon>
                        Copy Link
                    </a>
                </div>
            </div>
            
            ${challengeData.qrCode ? `
            <div class="qr-section">
                <h3 class="share-title">Scan to Join</h3>
                <div class="qr-code">
                    <img src="${challengeData.qrCode}" alt="QR Code to join challenge">
                </div>
                <p style="font-size: 0.875rem; color: var(--text-secondary);">
                    Scan with your phone camera to open in Sweats app
                </p>
            </div>
            ` : ''}
        </div>
    </div>

    <script>
        const challengeData = ${JSON.stringify(challengeData)};
        const shareUrl = '${challengeUrl}';
        const appDeepLink = '${appDeepLink}';
        const appStoreUrl = '${appStoreUrl}';

        function openApp() {
            // Try to open the app with deep link
            window.location.href = appDeepLink;
            
            // Fallback to App Store after a delay
            setTimeout(() => {
                window.open(appStoreUrl, '_blank');
            }, 2000);
        }

        function shareToWhatsApp() {
            const text = encodeURIComponent(\`Join me in the "\${challengeData.title}" challenge on Sweats! \${challengeData.description} \${shareUrl}\`);
            window.open(\`https://wa.me/?text=\${text}\`, '_blank');
        }

        function shareToTwitter() {
            const text = encodeURIComponent(\`Join me in the "\${challengeData.title}" challenge on Sweats! \${challengeData.description}\`);
            window.open(\`https://twitter.com/intent/tweet?text=\${text}&url=\${encodeURIComponent(shareUrl)}\`, '_blank');
        }

        function shareToFacebook() {
            window.open(\`https://www.facebook.com/sharer/sharer.php?u=\${encodeURIComponent(shareUrl)}\`, '_blank');
        }

        function shareToInstagram() {
            // Instagram doesn't support direct URL sharing, so copy to clipboard
            copyLink();
            alert('Link copied! You can now paste it in your Instagram story or bio.');
        }

        function copyLink() {
            navigator.clipboard.writeText(shareUrl).then(() => {
                // Show temporary feedback
                const button = event.target.closest('.share-button');
                const originalText = button.innerHTML;
                button.innerHTML = '<ion-icon name="checkmark"></ion-icon>Copied!';
                button.style.borderColor = 'var(--accent-green)';
                button.style.color = 'var(--accent-green)';
                
                setTimeout(() => {
                    button.innerHTML = originalText;
                    button.style.borderColor = '';
                    button.style.color = '';
                }, 2000);
            }).catch(() => {
                // Fallback for older browsers
                const textArea = document.createElement('textarea');
                textArea.value = shareUrl;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                alert('Link copied to clipboard!');
            });
        }

        // Web Share API support (for mobile browsers)
        if (navigator.share) {
            const nativeShareButton = document.createElement('button');
            nativeShareButton.className = 'share-button';
            nativeShareButton.innerHTML = '<ion-icon name="share"></ion-icon>Share';
            nativeShareButton.onclick = () => {
                navigator.share({
                    title: \`\${challengeData.title} - Sweats Challenge\`,
                    text: challengeData.description,
                    url: shareUrl
                });
            };
            
            const shareGrid = document.querySelector('.share-grid');
            shareGrid.appendChild(nativeShareButton);
        }

        // Track page view (you can integrate with analytics)
        console.log('Challenge page viewed:', challengeData.id);
    </script>
</body>
</html>
    `;
    
    res.send(html);
  } catch (error) {
    console.error('Error serving challenge page:', error);
    res.status(500).send('Internal server error');
  }
});

// 404 page
app.get('*', (req, res) => {
  res.status(404).sendFile(path.join(__dirname, '404.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Sweats landing server running on port ${PORT}`);
  console.log(`📱 Ready to create shareable challenge URLs`);
  console.log(`🌐 Local: http://localhost:${PORT}`);
});

module.exports = app;
