/**
 * Sweats Challenge Sharing Integration
 * 
 * This file contains functions to integrate with the Sweats landing server
 * for creating shareable challenge URLs with rich social media previews.
 * 
 * Usage in your React Native app:
 * import { createShareableChallenge, shareChallenge } from './challengeSharing';
 */

import { Share, Linking, Alert } from 'react-native';

// Configuration
const LANDING_SERVER_URL = __DEV__ 
  ? 'http://localhost:3001' 
  : 'https://your-production-domain.com';

const APP_STORE_URL = 'https://apps.apple.com/app/sweats';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.sweats';

/**
 * Creates a shareable challenge with rich social media preview
 * @param {Object} challengeData - The challenge data
 * @returns {Promise<Object|null>} - Share data or null if failed
 */
export const createShareableChallenge = async (challengeData) => {
  try {
    const response = await fetch(`${LANDING_SERVER_URL}/api/challenges`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: challengeData.id,
        title: challengeData.title,
        description: challengeData.description,
        type: challengeData.type, // steps, distance, workout, weight_loss, consistency
        goal: challengeData.goal,
        unit: challengeData.unit,
        duration: challengeData.duration,
        participants: challengeData.participants || 0,
        startDate: challengeData.startDate,
        endDate: challengeData.endDate,
        createdBy: challengeData.createdBy,
        avatar: challengeData.avatar,
        prize: challengeData.prize,
        difficulty: challengeData.difficulty || 'medium',
        tags: challengeData.tags || [],
        isPublic: challengeData.isPublic !== false
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    
    if (result.success) {
      return {
        shareId: result.data.shareId,
        shareableUrl: result.data.shareableUrl,
        qrCode: result.data.qrCode,
        imageUrl: `${LANDING_SERVER_URL}/api/challenges/${result.data.shareId}/image`
      };
    } else {
      throw new Error(result.message || 'Failed to create shareable challenge');
    }
  } catch (error) {
    console.error('Error creating shareable challenge:', error);
    return null;
  }
};

/**
 * Opens the native share dialog with challenge details
 * @param {Object} shareData - Data returned from createShareableChallenge
 * @param {Object} challengeData - Original challenge data
 */
export const shareChallenge = async (shareData, challengeData) => {
  try {
    const shareMessage = `🏃‍♂️ Join me in the "${challengeData.title}" challenge on Sweats!\n\n${challengeData.description}\n\n💪 Goal: ${challengeData.goal.toLocaleString()} ${challengeData.unit}\n⏱️ Duration: ${challengeData.duration} days\n👥 ${challengeData.participants} people already joined!`;

    const shareOptions = {
      title: `${challengeData.title} - Sweats Challenge`,
      message: shareMessage,
      url: shareData.shareableUrl,
      subject: `Join my ${challengeData.title} challenge!` // For email sharing
    };

    const result = await Share.share(shareOptions);
    
    if (result.action === Share.sharedAction) {
      // Successfully shared
      console.log('Challenge shared successfully');
      return true;
    } else if (result.action === Share.dismissedAction) {
      // Share dialog was dismissed
      console.log('Share dialog dismissed');
      return false;
    }
  } catch (error) {
    console.error('Error sharing challenge:', error);
    Alert.alert('Share Error', 'Failed to share challenge. Please try again.');
    return false;
  }
};

/**
 * Shares to specific social media platforms
 */
export const shareToSpecificPlatform = (shareData, challengeData, platform) => {
  const encodedUrl = encodeURIComponent(shareData.shareableUrl);
  const encodedTitle = encodeURIComponent(challengeData.title);
  const encodedDescription = encodeURIComponent(challengeData.description);
  
  let shareUrl = '';
  
  switch (platform.toLowerCase()) {
    case 'whatsapp':
      const whatsappMessage = encodeURIComponent(
        `🏃‍♂️ Join me in the "${challengeData.title}" challenge on Sweats! ${challengeData.description} ${shareData.shareableUrl}`
      );
      shareUrl = `whatsapp://send?text=${whatsappMessage}`;
      break;
      
    case 'twitter':
      const tweetText = encodeURIComponent(
        `🏃‍♂️ Join me in the "${challengeData.title}" challenge on @sweatsapp! ${challengeData.description}`
      );
      shareUrl = `https://twitter.com/intent/tweet?text=${tweetText}&url=${encodedUrl}`;
      break;
      
    case 'facebook':
      shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
      break;
      
    case 'instagram':
      // Instagram doesn't support direct URL sharing, so we'll copy to clipboard
      Alert.alert(
        'Share to Instagram',
        'Link copied to clipboard! You can now paste it in your Instagram story or bio.',
        [{ text: 'OK' }]
      );
      // You would need to implement clipboard copying here
      return;
      
    case 'telegram':
      const telegramMessage = encodeURIComponent(
        `🏃‍♂️ Join me in the "${challengeData.title}" challenge on Sweats! ${challengeData.description}`
      );
      shareUrl = `https://t.me/share/url?url=${encodedUrl}&text=${telegramMessage}`;
      break;
      
    default:
      console.error('Unsupported platform:', platform);
      return;
  }
  
  Linking.openURL(shareUrl).catch(error => {
    console.error(`Failed to open ${platform}:`, error);
    Alert.alert('Error', `Could not open ${platform}. Please make sure the app is installed.`);
  });
};

/**
 * Generates a QR code component data for the challenge
 * @param {Object} shareData - Data returned from createShareableChallenge
 * @returns {Object} - QR code data for display
 */
export const getQRCodeData = (shareData) => {
  if (!shareData.qrCode) {
    return null;
  }
  
  return {
    uri: shareData.qrCode,
    url: shareData.shareableUrl,
    instructions: 'Scan with camera to join challenge'
  };
};

/**
 * Opens the challenge in the app or redirects to store
 * @param {string} challengeId - The challenge ID
 */
export const openChallengeInApp = async (challengeId) => {
  const deepLinkUrl = `sweats://challenge/${challengeId}`;
  
  try {
    const canOpen = await Linking.canOpenURL(deepLinkUrl);
    if (canOpen) {
      await Linking.openURL(deepLinkUrl);
    } else {
      // App not installed, redirect to store
      const storeUrl = Platform.OS === 'ios' ? APP_STORE_URL : PLAY_STORE_URL;
      await Linking.openURL(storeUrl);
    }
  } catch (error) {
    console.error('Failed to open challenge:', error);
    // Fallback to store
    const storeUrl = Platform.OS === 'ios' ? APP_STORE_URL : PLAY_STORE_URL;
    Linking.openURL(storeUrl);
  }
};

/**
 * Example usage in a React Native component:
 */

/*
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { createShareableChallenge, shareChallenge, getQRCodeData } from './challengeSharing';

const ChallengeShareExample = ({ challengeData }) => {
  const [shareData, setShareData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleCreateShare = async () => {
    setIsLoading(true);
    const result = await createShareableChallenge(challengeData);
    if (result) {
      setShareData(result);
    }
    setIsLoading(false);
  };

  const handleShare = () => {
    if (shareData) {
      shareChallenge(shareData, challengeData);
    }
  };

  const qrCodeData = shareData ? getQRCodeData(shareData) : null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{challengeData.title}</Text>
      
      {!shareData ? (
        <TouchableOpacity 
          style={styles.button} 
          onPress={handleCreateShare}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>
            {isLoading ? 'Creating Share Link...' : 'Create Share Link'}
          </Text>
        </TouchableOpacity>
      ) : (
        <View>
          <TouchableOpacity style={styles.button} onPress={handleShare}>
            <Text style={styles.buttonText}>Share Challenge</Text>
          </TouchableOpacity>
          
          {qrCodeData && (
            <View style={styles.qrContainer}>
              <Text style={styles.qrTitle}>Scan to Join</Text>
              <Image source={{ uri: qrCodeData.uri }} style={styles.qrCode} />
            </View>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#00E676',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
    marginBottom: 20,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  qrContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  qrTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  qrCode: {
    width: 150,
    height: 150,
  },
});
*/

export default {
  createShareableChallenge,
  shareChallenge,
  shareToSpecificPlatform,
  getQRCodeData,
  openChallengeInApp
};
