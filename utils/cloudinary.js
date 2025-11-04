const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Configure Cloudinary
cloudinary.config({
  cloud_name: 'dsght9yix',
  api_key: '633852447595793',
  api_secret: 'Zk00n0-MvM_3-YVMal_H-NM0RKw',
  secure: true
});

// Test Cloudinary connection
cloudinary.api.ping((error, result) => {
  if (error) {
    console.error('❌ Cloudinary connection failed:', error);
  } else {
    console.log('✅ Cloudinary connected successfully');
  }
});

/**
 * Create Cloudinary storage for multer
 * @param {string} folder - Cloudinary folder path
 * @param {Array} allowedFormats - Allowed image formats
 * @param {number} maxFileSize - Max file size in bytes (default: 5MB)
 * @param {boolean} allowPDF - Allow PDF files (default: false)
 * @returns {multer} Multer instance
 */
const createCloudinaryStorage = (folder, allowedFormats = ['jpg', 'jpeg', 'png', 'gif', 'webp'], maxFileSize = 5242880, allowPDF = false) => {
  const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: async (req, file) => {
      const isPDF = file.mimetype === 'application/pdf';
      const resourceType = isPDF ? 'raw' : 'image';
      
      return {
        folder: `hyphen-wellness/${folder}`,
        allowed_formats: isPDF ? ['pdf'] : allowedFormats,
        transformation: isPDF ? [] : [
          { width: 1920, height: 1080, crop: 'limit', quality: 'auto' },
          { fetch_format: 'auto' }
        ],
        resource_type: resourceType,
        public_id: `${file.fieldname}-${Date.now()}-${Math.round(Math.random() * 1E9)}`
      };
    }
  });

  return multer({
    storage: storage,
    limits: {
      fileSize: maxFileSize
    },
    fileFilter: (req, file, cb) => {
      if (allowPDF && file.mimetype === 'application/pdf') {
        return cb(null, true);
      }
      
      const allowedTypes = /jpeg|jpg|png|gif|webp/;
      const extname = allowedTypes.test(file.originalname.toLowerCase());
      const mimetype = allowedTypes.test(file.mimetype);
      
      if (mimetype && extname) {
        return cb(null, true);
      } else {
        cb(new Error('Only image files (JPEG, JPG, PNG, GIF, WEBP)' + (allowPDF ? ' and PDF files' : '') + ' are allowed!'));
      }
    }
  });
};

/**
 * Upload image to Cloudinary
 * @param {Buffer|string} file - File buffer or file path
 * @param {string} folder - Cloudinary folder
 * @param {Object} options - Additional options
 * @returns {Promise} Cloudinary upload result
 */
const uploadImage = async (file, folder = 'general', options = {}) => {
  try {
    const uploadOptions = {
      folder: `hyphen-wellness/${folder}`,
      resource_type: 'auto',
      transformation: [
        { width: 1920, height: 1080, crop: 'limit', quality: 'auto' },
        { fetch_format: 'auto' }
      ],
      ...options
    };

    let uploadResult;
    if (Buffer.isBuffer(file)) {
      uploadResult = await cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
        if (error) throw error;
        return result;
      }).end(file);
    } else {
      uploadResult = await cloudinary.uploader.upload(file, uploadOptions);
    }

    return {
      success: true,
      public_id: uploadResult.public_id,
      secure_url: uploadResult.secure_url,
      url: uploadResult.url,
      width: uploadResult.width,
      height: uploadResult.height,
      format: uploadResult.format,
      bytes: uploadResult.bytes
    };
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw new Error(`Failed to upload image: ${error.message}`);
  }
};

/**
 * Upload multiple images to Cloudinary
 * @param {Array} files - Array of file buffers or paths
 * @param {string} folder - Cloudinary folder
 * @param {Object} options - Additional options
 * @returns {Promise} Array of upload results
 */
const uploadMultipleImages = async (files, folder = 'general', options = {}) => {
  try {
    const uploadPromises = files.map(file => uploadImage(file, folder, options));
    const results = await Promise.all(uploadPromises);
    return results;
  } catch (error) {
    console.error('Cloudinary multiple upload error:', error);
    throw new Error(`Failed to upload images: ${error.message}`);
  }
};

/**
 * Delete image from Cloudinary
 * @param {string} publicId - Cloudinary public ID
 * @returns {Promise} Deletion result
 */
const deleteImage = async (publicId) => {
  try {
    if (!publicId) {
      return { success: true, message: 'No image to delete' };
    }

    // Extract public_id from URL if full URL is provided
    let actualPublicId = publicId;
    if (publicId.includes('cloudinary.com')) {
      const urlParts = publicId.split('/');
      const uploadIndex = urlParts.findIndex(part => part === 'upload');
      if (uploadIndex !== -1 && uploadIndex + 1 < urlParts.length) {
        const versionIndex = uploadIndex + 1;
        const folderIndex = uploadIndex + 2;
        actualPublicId = urlParts.slice(folderIndex).join('/').replace(/\.[^/.]+$/, '');
      }
    }

    const result = await cloudinary.uploader.destroy(actualPublicId);
    
    if (result.result === 'ok') {
      return { success: true, message: 'Image deleted successfully' };
    } else {
      return { success: false, message: 'Image not found or already deleted' };
    }
  } catch (error) {
    console.error('Cloudinary delete error:', error);
    throw new Error(`Failed to delete image: ${error.message}`);
  }
};

/**
 * Delete multiple images from Cloudinary
 * @param {Array} publicIds - Array of Cloudinary public IDs
 * @returns {Promise} Deletion results
 */
const deleteMultipleImages = async (publicIds) => {
  try {
    const deletePromises = publicIds.map(publicId => deleteImage(publicId));
    const results = await Promise.all(deletePromises);
    return results;
  } catch (error) {
    console.error('Cloudinary multiple delete error:', error);
    throw new Error(`Failed to delete images: ${error.message}`);
  }
};

/**
 * Generate optimized image URL
 * @param {string} publicId - Cloudinary public ID
 * @param {Object} transformations - Image transformations
 * @returns {string} Optimized image URL
 */
const getOptimizedImageUrl = (publicId, transformations = {}) => {
  try {
    const defaultTransformations = {
      quality: 'auto',
      fetch_format: 'auto',
      ...transformations
    };

    return cloudinary.url(publicId, defaultTransformations);
  } catch (error) {
    console.error('Cloudinary URL generation error:', error);
    return publicId; // Return original if error
  }
};

/**
 * Generate responsive image URL with transformations
 * @param {string} publicId - Cloudinary public ID
 * @param {number} width - Image width
 * @param {number} height - Image height (optional)
 * @returns {string} Responsive image URL
 */
const getResponsiveImageUrl = (publicId, width, height = null) => {
  const transformations = {
    width: width,
    quality: 'auto',
    fetch_format: 'auto',
    crop: 'limit'
  };

  if (height) {
    transformations.height = height;
    transformations.crop = 'fill';
  }

  return getOptimizedImageUrl(publicId, transformations);
};

/**
 * Get thumbnail URL
 * @param {string} publicId - Cloudinary public ID
 * @param {number} size - Thumbnail size (default: 200)
 * @returns {string} Thumbnail URL
 */
const getThumbnailUrl = (publicId, size = 200) => {
  return getOptimizedImageUrl(publicId, {
    width: size,
    height: size,
    crop: 'fill',
    quality: 'auto',
    fetch_format: 'auto'
  });
};

module.exports = {
  cloudinary,
  createCloudinaryStorage,
  uploadImage,
  uploadMultipleImages,
  deleteImage,
  deleteMultipleImages,
  getOptimizedImageUrl,
  getResponsiveImageUrl,
  getThumbnailUrl
};

