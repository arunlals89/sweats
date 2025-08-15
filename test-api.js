// Test script for the Sweats Challenge Sharing API
// Run with: node test-api.js

const baseUrl = 'http://localhost:3001';

// Sample challenge data
const sampleChallenges = [
  {
    title: "30-Day Step Challenge",
    description: "Walk 10,000 steps daily for 30 days and transform your health!",
    type: "steps",
    goal: 10000,
    unit: "steps",
    duration: 30,
    participants: 127,
    createdBy: "Sarah Johnson",
    difficulty: "medium",
    tags: ["walking", "fitness", "30days", "health"]
  },
  {
    title: "Morning 5K Run",
    description: "Start your day with energy! Run 5 kilometers every morning for a week.",
    type: "distance",
    goal: 5,
    unit: "km",
    duration: 7,
    participants: 45,
    createdBy: "Mike Chen",
    difficulty: "hard",
    tags: ["running", "morning", "cardio"]
  },
  {
    title: "Weight Loss Journey",
    description: "Lose 10 pounds in 8 weeks with healthy habits and community support.",
    type: "weight_loss",
    goal: 10,
    unit: "lbs",
    duration: 56,
    participants: 89,
    createdBy: "Emma Davis",
    difficulty: "medium",
    tags: ["weightloss", "health", "transformation"]
  },
  {
    title: "Daily Workout Streak",
    description: "Complete at least 30 minutes of exercise every day for 21 days.",
    type: "workout",
    goal: 30,
    unit: "minutes",
    duration: 21,
    participants: 203,
    createdBy: "Alex Rodriguez",
    difficulty: "easy",
    tags: ["workout", "consistency", "habit"]
  }
];

async function testCreateChallenge(challengeData) {
  try {
    console.log(`\n🧪 Testing challenge: "${challengeData.title}"`);
    
    const response = await fetch(`${baseUrl}/api/challenges`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(challengeData)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Challenge created successfully!');
      console.log(`   Share URL: ${result.data.shareableUrl}`);
      console.log(`   Share ID: ${result.data.shareId}`);
      console.log(`   QR Code: ${result.data.qrCode ? 'Generated' : 'Failed'}`);
      
      return result.data;
    } else {
      console.log('❌ Failed to create challenge:', result.message);
      return null;
    }
  } catch (error) {
    console.log('❌ Error creating challenge:', error.message);
    return null;
  }
}

async function testGetChallenge(shareId) {
  try {
    console.log(`\n🔍 Testing get challenge: ${shareId}`);
    
    const response = await fetch(`${baseUrl}/api/challenges/${shareId}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Challenge retrieved successfully!');
      console.log(`   Title: ${result.data.title}`);
      console.log(`   Type: ${result.data.type}`);
      console.log(`   Participants: ${result.data.participants}`);
      return result.data;
    } else {
      console.log('❌ Failed to get challenge:', result.message);
      return null;
    }
  } catch (error) {
    console.log('❌ Error getting challenge:', error.message);
    return null;
  }
}

async function testImageGeneration(shareId) {
  try {
    console.log(`\n🖼️  Testing image generation: ${shareId}`);
    
    const response = await fetch(`${baseUrl}/api/challenges/${shareId}/image`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const imageBuffer = await response.arrayBuffer();
    console.log('✅ Image generated successfully!');
    console.log(`   Size: ${imageBuffer.byteLength} bytes`);
    console.log(`   URL: ${baseUrl}/api/challenges/${shareId}/image`);
    
    return true;
  } catch (error) {
    console.log('❌ Error generating image:', error.message);
    return false;
  }
}

async function testChallengeSharePage(shareId) {
  try {
    console.log(`\n📄 Testing challenge share page: ${shareId}`);
    
    const response = await fetch(`${baseUrl}/challenge/${shareId}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const html = await response.text();
    console.log('✅ Share page generated successfully!');
    console.log(`   HTML size: ${html.length} characters`);
    console.log(`   URL: ${baseUrl}/challenge/${shareId}`);
    
    // Check for essential meta tags
    const hasOgTitle = html.includes('property="og:title"');
    const hasOgImage = html.includes('property="og:image"');
    const hasTwitterCard = html.includes('name="twitter:card"');
    
    console.log(`   Meta tags: OG Title: ${hasOgTitle ? '✅' : '❌'}, OG Image: ${hasOgImage ? '✅' : '❌'}, Twitter Card: ${hasTwitterCard ? '✅' : '❌'}`);
    
    return true;
  } catch (error) {
    console.log('❌ Error testing share page:', error.message);
    return false;
  }
}

async function runTests() {
  console.log('🚀 Starting Sweats Challenge API Tests...');
  console.log(`📡 Testing server at: ${baseUrl}`);
  
  // Test server health
  try {
    const healthResponse = await fetch(`${baseUrl}/`);
    if (healthResponse.ok) {
      console.log('✅ Server is running and accessible');
    } else {
      console.log('❌ Server health check failed');
      return;
    }
  } catch (error) {
    console.log('❌ Cannot connect to server. Make sure it\'s running with: npm run dev');
    return;
  }

  const createdChallenges = [];

  // Test creating challenges
  console.log('\n📝 Testing Challenge Creation...');
  for (const challengeData of sampleChallenges) {
    const result = await testCreateChallenge(challengeData);
    if (result) {
      createdChallenges.push(result);
    }
    await new Promise(resolve => setTimeout(resolve, 500)); // Small delay between requests
  }

  if (createdChallenges.length === 0) {
    console.log('❌ No challenges were created successfully. Stopping tests.');
    return;
  }

  // Test retrieving challenges
  console.log('\n📖 Testing Challenge Retrieval...');
  for (const challenge of createdChallenges) {
    await testGetChallenge(challenge.shareId);
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  // Test image generation
  console.log('\n🎨 Testing Image Generation...');
  for (const challenge of createdChallenges) {
    await testImageGeneration(challenge.shareId);
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  // Test share pages
  console.log('\n🌐 Testing Share Pages...');
  for (const challenge of createdChallenges) {
    await testChallengeSharePage(challenge.shareId);
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  // Summary
  console.log('\n📊 Test Summary:');
  console.log(`   Challenges created: ${createdChallenges.length}/${sampleChallenges.length}`);
  console.log(`   All share URLs:`);
  createdChallenges.forEach((challenge, index) => {
    console.log(`   ${index + 1}. ${challenge.shareableUrl}`);
  });

  console.log('\n🎉 Tests completed! You can now:');
  console.log('   1. Visit the share URLs above to see the challenge pages');
  console.log('   2. Test social media sharing by copying the URLs');
  console.log('   3. Scan the QR codes with your phone camera');
  console.log('   4. Check the generated preview images');
}

// Check if fetch is available (Node.js 18+)
if (typeof fetch === 'undefined') {
  console.log('❌ This test requires Node.js 18+ with built-in fetch support.');
  console.log('   Alternatively, install node-fetch: npm install node-fetch');
  process.exit(1);
}

// Run the tests
runTests().catch(error => {
  console.error('❌ Test suite failed:', error);
  process.exit(1);
});
