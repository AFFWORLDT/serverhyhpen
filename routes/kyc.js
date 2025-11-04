const express = require('express');
const router = express.Router();
const { auth, adminAuth } = require('../middleware/auth');
const KYCDocument = require('../models/KYCDocument');
const User = require('../models/User');
const { createCloudinaryStorage, deleteImage } = require('../utils/cloudinary');

// Configure Cloudinary for file uploads (supports PDF and images)
const upload = createCloudinaryStorage('kyc-documents', ['jpg', 'jpeg', 'png', 'gif', 'webp'], 10485760, true); // 10MB, allow PDF

// Get all KYC documents for a member (Admin only)
router.get('/member/:memberId', auth, adminAuth, async (req, res) => {
  try {
    const { memberId } = req.params;
    
    const documents = await KYCDocument.find({ member: memberId })
        .populate('member', 'firstName lastName email profileImage')
      .populate('verifiedBy', 'firstName lastName')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: documents
    });
  } catch (error) {
    console.error('Error fetching KYC documents:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching KYC documents',
      error: error.message
    });
  }
});

// Get KYC status for a member
router.get('/status/:memberId', auth, async (req, res) => {
  try {
    const { memberId } = req.params;
    const user = req.user;

    // Check if user can access this member's KYC status
    if (user.role !== 'admin' && user._id.toString() !== memberId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const member = await User.findById(memberId).select('kycStatus kycEnabled kycRequired kycCompletedAt kycExpiryDate kycNotes');
    
    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }

    const documents = await KYCDocument.find({ member: memberId, isActive: true })
      .select('documentType status expiryDate')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: {
        member: member,
        documents: documents
      }
    });
  } catch (error) {
    console.error('Error fetching KYC status:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching KYC status',
      error: error.message
    });
  }
});

// Create/Update KYC document
router.post('/document', auth, upload.array('documents', 5), async (req, res) => {
  try {
    const user = req.user;
    const {
      memberId,
      documentType,
      documentName,
      documentNumber,
      issueDate,
      expiryDate,
      issuingAuthority
    } = req.body;

    // Check if user can create KYC documents for this member
    if (user.role !== 'admin' && user._id.toString() !== memberId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one document file is required'
      });
    }

    const documentFiles = req.files.map(file => ({
      fileName: file.originalname,
      fileUrl: file.secure_url || file.url,
      publicId: file.public_id,
      fileType: file.mimetype,
      fileSize: file.bytes || file.size,
      uploadedAt: new Date(),
      resourceType: file.resource_type || 'auto'
    }));

    const kycDocument = new KYCDocument({
      member: memberId,
      documentType,
      documentName,
      documentNumber,
      issueDate: new Date(issueDate),
      expiryDate: new Date(expiryDate),
      issuingAuthority,
      documentFiles,
      status: 'pending'
    });

    await kycDocument.save();

    // Update member's KYC status
    await User.findByIdAndUpdate(memberId, {
      kycStatus: 'in_progress',
      kycEnabled: true
    });

    res.status(201).json({
      success: true,
      message: 'KYC document uploaded successfully',
      data: kycDocument
    });
  } catch (error) {
    console.error('Error creating KYC document:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating KYC document',
      error: error.message
    });
  }
});

// Update KYC document status (Admin only)
router.put('/document/:documentId/status', auth, adminAuth, async (req, res) => {
  try {
    const { documentId } = req.params;
    const { status, verificationNotes, rejectionReason } = req.body;
    const adminUser = req.user;

    const document = await KYCDocument.findById(documentId);
    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'KYC document not found'
      });
    }

    document.status = status;
    document.verificationNotes = verificationNotes || '';
    document.verifiedBy = adminUser._id;
    document.verifiedAt = new Date();

    if (status === 'rejected') {
      document.rejectionReason = rejectionReason || '';
    }

    await document.save();

    // Update member's overall KYC status
    const memberDocuments = await KYCDocument.find({ 
      member: document.member, 
      isActive: true 
    });

    const allApproved = memberDocuments.every(doc => doc.status === 'approved');
    const anyRejected = memberDocuments.some(doc => doc.status === 'rejected');
    const anyExpired = memberDocuments.some(doc => doc.isExpired());

    let newKycStatus = 'in_progress';
    if (allApproved && memberDocuments.length > 0) {
      newKycStatus = 'approved';
    } else if (anyRejected) {
      newKycStatus = 'rejected';
    } else if (anyExpired) {
      newKycStatus = 'expired';
    }

    await User.findByIdAndUpdate(document.member, {
      kycStatus: newKycStatus,
      kycCompletedAt: newKycStatus === 'approved' ? new Date() : null,
      kycVerifiedBy: adminUser._id,
      kycVerifiedAt: new Date()
    });

    res.json({
      success: true,
      message: 'KYC document status updated successfully',
      data: document
    });
  } catch (error) {
    console.error('Error updating KYC document status:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating KYC document status',
      error: error.message
    });
  }
});

// Toggle KYC requirement for a member (Admin only)
router.put('/toggle/:memberId', auth, adminAuth, async (req, res) => {
  try {
    const { memberId } = req.params;
    const { kycEnabled, kycRequired, kycNotes } = req.body;

    const updateData = {};
    if (kycEnabled !== undefined) updateData.kycEnabled = kycEnabled;
    if (kycRequired !== undefined) updateData.kycRequired = kycRequired;
    if (kycNotes !== undefined) updateData.kycNotes = kycNotes;

    const member = await User.findByIdAndUpdate(
      memberId,
      updateData,
      { new: true }
    ).select('firstName lastName email kycStatus kycEnabled kycRequired kycNotes');

    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }

    res.json({
      success: true,
      message: 'KYC settings updated successfully',
      data: member
    });
  } catch (error) {
    console.error('Error updating KYC settings:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating KYC settings',
      error: error.message
    });
  }
});

// Update membership details (Admin only)
router.put('/membership/:memberId', auth, adminAuth, async (req, res) => {
  try {
    const { memberId } = req.params;
    const {
      membershipStatus,
      membershipType,
      membershipStartDate,
      membershipEndDate,
      membershipRenewalDate,
      membershipNotes
    } = req.body;

    const updateData = {};
    if (membershipStatus !== undefined) updateData.membershipStatus = membershipStatus;
    if (membershipType !== undefined) updateData.membershipType = membershipType;
    if (membershipStartDate !== undefined) updateData.membershipStartDate = new Date(membershipStartDate);
    if (membershipEndDate !== undefined) updateData.membershipEndDate = new Date(membershipEndDate);
    if (membershipRenewalDate !== undefined) updateData.membershipRenewalDate = new Date(membershipRenewalDate);
    if (membershipNotes !== undefined) updateData.membershipNotes = membershipNotes;

    const member = await User.findByIdAndUpdate(
      memberId,
      updateData,
      { new: true }
    ).select('firstName lastName email membershipStatus membershipType membershipStartDate membershipEndDate membershipRenewalDate membershipNotes');

    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }

    res.json({
      success: true,
      message: 'Membership details updated successfully',
      data: member
    });
  } catch (error) {
    console.error('Error updating membership details:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating membership details',
      error: error.message
    });
  }
});

// Delete KYC document (Admin only)
router.delete('/document/:documentId', auth, adminAuth, async (req, res) => {
  try {
    const { documentId } = req.params;

    const document = await KYCDocument.findById(documentId);
    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'KYC document not found'
      });
    }

    // Delete files from Cloudinary if exists
    if (document.documentFiles && document.documentFiles.length > 0) {
      for (const file of document.documentFiles) {
        if (file.publicId) {
          try {
            await deleteImage(file.publicId);
          } catch (deleteError) {
            console.log('Document deletion warning:', deleteError.message);
          }
        }
      }
    }

    await KYCDocument.findByIdAndDelete(documentId);

    res.json({
      success: true,
      message: 'KYC document deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting KYC document:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting KYC document',
      error: error.message
    });
  }
});

// Get KYC statistics (Admin only)
router.get('/statistics', auth, adminAuth, async (req, res) => {
  try {
    const totalMembers = await User.countDocuments({ role: 'member' });
    const kycCompleted = await User.countDocuments({ 
      role: 'member', 
      kycStatus: 'approved' 
    });
    const kycPending = await User.countDocuments({ 
      role: 'member', 
      kycStatus: { $in: ['in_progress', 'pending_review'] } 
    });
    const kycRejected = await User.countDocuments({ 
      role: 'member', 
      kycStatus: 'rejected' 
    });
    const kycExpired = await User.countDocuments({ 
      role: 'member', 
      kycStatus: 'expired' 
    });

    const expiredDocuments = await KYCDocument.find({
      expiryDate: { $lt: new Date() },
      isActive: true
    }).countDocuments();

    res.json({
      success: true,
      data: {
        totalMembers,
        kycCompleted,
        kycPending,
        kycRejected,
        kycExpired,
        expiredDocuments,
        completionRate: totalMembers > 0 ? Math.round((kycCompleted / totalMembers) * 100) : 0
      }
    });
  } catch (error) {
    console.error('Error fetching KYC statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching KYC statistics',
      error: error.message
    });
  }
});

module.exports = router;
