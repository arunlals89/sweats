# Fix for Domain Redirect Issue

## Problem
Your GitHub Pages site at `http://arunlals89.github.io/sweats/` is redirecting to `sweats.in`

## Root Cause
This redirect is likely caused by a **custom domain configuration** in your GitHub repository settings.

## Solution Steps

### 1. Check GitHub Repository Settings
1. Go to your GitHub repository: https://github.com/arunlals89/sweats
2. Click on **Settings** tab
3. Scroll down to **Pages** section
4. Check if there's a custom domain set to `sweats.in`

### 2. Remove Custom Domain (if found)
1. In the **Pages** settings, find the **Custom domain** field
2. If it shows `sweats.in`, **delete it** and leave the field empty
3. Click **Save**

### 3. Verify DNS/Domain Settings
If you want to use `sweats.in` later:
- You'll need to configure DNS records to point to GitHub Pages
- Add CNAME file with `sweats.in` content
- But for now, remove the custom domain to use GitHub Pages URL

### 4. Alternative: Force GitHub Pages URL
If the custom domain setting is not the issue, you can force GitHub Pages to use the standard URL by ensuring no CNAME file exists (which we've already done).

## Expected Result
After removing the custom domain from GitHub settings:
- ✅ `https://arunlals89.github.io/sweats/` should work without redirecting
- ✅ No more mixed content errors
- ✅ Site loads properly on GitHub Pages

## If You Want to Use sweats.in Domain Later
1. Configure DNS records for `sweats.in` to point to GitHub Pages
2. Add a CNAME file with `sweats.in` content
3. Set up the custom domain in GitHub Pages settings
4. Update all meta tags and URLs to use `sweats.in`

For now, remove the custom domain configuration to make the GitHub Pages URL work properly.
