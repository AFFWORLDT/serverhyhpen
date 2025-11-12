# Cloudinary Integration - Batch Update Guide

This document tracks the Cloudinary integration progress across all routes.

## Routes Updated ✅
1. ✅ `routes/profile.js` - Profile image uploads
2. ✅ `routes/banners.js` - Banner images

## Routes To Update
1. ⏳ `routes/offers.js` - Offer images
2. ⏳ `routes/events.js` - Event images
3. ⏳ `routes/news.js` - News images
4. ⏳ `routes/pro-tips.js` - Pro tip images and gallery
5. ⏳ `routes/kyc.js` - KYC documents (PDF + images)

## Update Pattern

For each route:
1. Replace multer diskStorage with `createCloudinaryStorage`
2. Update file handling to use Cloudinary URLs
3. Add deleteImage calls when deleting/updating
4. Store public_id for future deletion






