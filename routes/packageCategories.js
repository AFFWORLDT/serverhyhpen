const express = require('express');
const router = express.Router();
const PackageCategory = require('../models/PackageCategory');
const Package = require('../models/Package');
const { auth } = require('../middleware/auth');
const { isAdmin } = require('../middleware/roleAuth');

// Get all categories (public - for display)
router.get('/', async (req, res) => {
  try {
    const { isActive } = req.query;
    
    const filter = {};
    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }
    
    const categories = await PackageCategory.find(filter)
      .sort({ displayOrder: 1, name: 1 });
    
    res.json({
      success: true,
      data: {
        categories
      }
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Get single category by ID
router.get('/:id', async (req, res) => {
  try {
    const category = await PackageCategory.findById(req.params.id);
    
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    res.json({
      success: true,
      data: {
        category
      }
    });
  } catch (error) {
    console.error('Error fetching category:', error);
    res.status(500).json({ error: 'Failed to fetch category' });
  }
});

// Create new category (admin only)
router.post('/', auth, isAdmin, async (req, res) => {
  try {
    const {
      name,
      description,
      color,
      bgColor,
      textColor,
      displayOrder,
      isActive
    } = req.body;
    
    // Validation
    if (!name) {
      return res.status(400).json({ error: 'Category name is required' });
    }
    
    // Check if category with same name or slug already exists
    const existingCategory = await PackageCategory.findOne({
      $or: [
        { name: name.trim() },
        { slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') }
      ]
    });
    
    if (existingCategory) {
      return res.status(400).json({ error: 'Category with this name already exists' });
    }
    
    const newCategory = new PackageCategory({
      name: name.trim(),
      description: description?.trim() || '',
      color: color || '#3b82f6',
      bgColor: bgColor || '#dbeafe',
      textColor: textColor || '#1e40af',
      displayOrder: displayOrder || 0,
      isActive: isActive !== undefined ? isActive : true,
      createdBy: req.user.userId
    });
    
    await newCategory.save();
    
    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: {
        category: newCategory
      }
    });
  } catch (error) {
    console.error('Error creating category:', error);
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Category with this name or slug already exists' });
    }
    res.status(500).json({ error: 'Failed to create category' });
  }
});

// Update category (admin only)
router.put('/:id', auth, isAdmin, async (req, res) => {
  try {
    const {
      name,
      description,
      color,
      bgColor,
      textColor,
      displayOrder,
      isActive
    } = req.body;
    
    const category = await PackageCategory.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    // Check if name change would conflict with existing category
    if (name && name.trim() !== category.name) {
      const existingCategory = await PackageCategory.findOne({
        _id: { $ne: req.params.id },
        $or: [
          { name: name.trim() },
          { slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') }
        ]
      });
      
      if (existingCategory) {
        return res.status(400).json({ error: 'Category with this name already exists' });
      }
    }
    
    // Update fields
    if (name !== undefined) category.name = name.trim();
    if (description !== undefined) category.description = description?.trim() || '';
    if (color !== undefined) category.color = color;
    if (bgColor !== undefined) category.bgColor = bgColor;
    if (textColor !== undefined) category.textColor = textColor;
    if (displayOrder !== undefined) category.displayOrder = displayOrder;
    if (isActive !== undefined) category.isActive = isActive;
    category.updatedBy = req.user.userId;
    
    // Regenerate slug if name changed
    if (name && name.trim() !== category.name) {
      category.slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
    }
    
    await category.save();
    
    res.json({
      success: true,
      message: 'Category updated successfully',
      data: {
        category
      }
    });
  } catch (error) {
    console.error('Error updating category:', error);
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Category with this name or slug already exists' });
    }
    res.status(500).json({ error: 'Failed to update category' });
  }
});

// Delete category (admin only)
router.delete('/:id', auth, isAdmin, async (req, res) => {
  try {
    const category = await PackageCategory.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    // Check if category is in use by any package
    const packagesUsingCategory = await Package.countDocuments({
      category: category.slug
    });
    
    if (packagesUsingCategory > 0) {
      return res.status(400).json({
        error: `Cannot delete category. ${packagesUsingCategory} package(s) are using this category. Please update or remove those packages first.`
      });
    }
    
    await PackageCategory.findByIdAndDelete(req.params.id);
    
    res.json({
      success: true,
      message: 'Category deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

module.exports = router;

